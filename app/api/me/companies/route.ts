import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';
import { requireVerifiedUser, legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  homePathForEntity,
  resolveEntityKind,
} from '@/lib/entities/entity-kinds';
import {
  ensurePlatformCompany,
  isPlatformOwnerEmail,
} from '@/lib/system/platform-company';
import { isPlatformOperatorEmail } from '@/lib/system/platform-control';

/**
 * POST /api/me/companies
 * Reliable company membership lookup for Privy-authenticated clients.
 * Uses service role so RLS never hides rows when there is no Supabase session
 * (auth is Privy-only). Also matches by email for legacy / cross-device rows.
 *
 * Body: { privyUserId: string, email?: string | null }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const _auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: body.privyUserId || legacyPrivyFrom(request),
    });
    if (!_auth.ok) return _auth.response;
    const userId =
      getCanonicalUserId(_auth.userId) || getCanonicalUserId(body.privyUserId);
    const email = body.email ? String(body.email).toLowerCase().trim() : null;

    if (!userId) {
      return NextResponse.json({ error: 'privyUserId is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const variants = userIdMatchVariants(userId);

    /**
     * Platform owners (craig@bigfivefoods.com / craig@bigfivegroup.africa):
     * ensure SupplierAdvisor control-plane company exists and this user is
     * an active owner so it always appears in Switch company.
     */
    let platformBootstrap: {
      companyId?: number;
      created?: boolean;
      attached?: string[];
      error?: string;
    } | null = null;
    if (
      email &&
      (isPlatformOwnerEmail(email) || isPlatformOperatorEmail(email))
    ) {
      try {
        const result = await ensurePlatformCompany({
          userId,
          email,
        });
        platformBootstrap = {
          companyId: result.company.id,
          created: result.created,
          attached: result.ownersAttached,
        };
      } catch (e: unknown) {
        console.error('me/companies platform bootstrap soft-fail:', e);
        platformBootstrap = {
          error: e instanceof Error ? e.message : 'bootstrap failed',
        };
      }
    }

    // 1) Memberships by user_id variants
    const { data: byUser, error: byUserError } = await supabase
      .from('business_users')
      .select('id, role, profile_id, status, user_id, email, invited_email, name')
      .in('user_id', variants)
      .eq('status', 'active');

    if (byUserError) {
      console.error('me/companies by user error:', byUserError);
      return NextResponse.json(
        { error: 'Failed to load memberships', details: byUserError.message },
        { status: 500 }
      );
    }

    let memberships = byUser || [];

    // 2) Also match active memberships by email (covers legacy rows / id format drift)
    if (email) {
      // Prefer exact email filters (avoids loading entire table)
      const { data: byEmailRows, error: emailError } = await supabase
        .from('business_users')
        .select('id, role, profile_id, status, user_id, email, invited_email, name')
        .eq('status', 'active')
        .or(`email.eq.${email},invited_email.eq.${email}`)
        .limit(100);

      let emailMatches = byEmailRows || [];

      // Fallback: scan if .or filter unsupported
      if (emailError || emailMatches.length === 0) {
        const { data: allActive } = await supabase
          .from('business_users')
          .select(
            'id, role, profile_id, status, user_id, email, invited_email, name'
          )
          .eq('status', 'active')
          .limit(2000);
        if (allActive) {
          emailMatches = allActive.filter((row) => {
            const e1 = (row.email || '').toLowerCase();
            const e2 = (row.invited_email || '').toLowerCase();
            return e1 === email || e2 === email;
          });
        }
      }

      const seen = new Set(memberships.map((m) => m.id));
      for (const row of emailMatches) {
        if (!seen.has(row.id)) {
          memberships.push(row);
          seen.add(row.id);
        }
      }

      // Heal user_id on email-matched rows so future lookups are fast/consistent
      for (const row of emailMatches) {
        if (row.user_id !== userId) {
          await supabase
            .from('business_users')
            .update({ user_id: userId, email: email })
            .eq('id', row.id);
        }
      }
    }

    if (memberships.length === 0) {
      return NextResponse.json({
        success: true,
        companies: [],
        userId,
        email,
        debug: { matchedByUser: (byUser || []).length, variants },
      });
    }

    const profileIds = [...new Set(memberships.map((m) => m.profile_id).filter(Boolean))];

    let profilesQuery = supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, supplier_status, verification_status, deleted_at, business_type, org_type'
      )
      .in('id', profileIds);

    let { data: profiles, error: profilesError } = await profilesQuery;

    // Soft-deleted filter; retry without deleted_at if column missing
    if (profilesError && /deleted_at|column|schema cache/i.test(profilesError.message)) {
      const retry = await supabase
        .from('profiles')
        .select(
          'id, trading_name, legal_name, supplier_status, verification_status, business_type, org_type'
        )
        .in('id', profileIds);
      profiles = retry.data as typeof profiles;
      profilesError = retry.error;
    }
    if (profilesError && /business_type|org_type|column|schema cache/i.test(profilesError.message || '')) {
      const retry = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name, supplier_status, verification_status, deleted_at')
        .in('id', profileIds);
      profiles = retry.data as typeof profiles;
      profilesError = retry.error;
    }

    if (profilesError) {
      console.error('me/companies profiles error:', profilesError);
      return NextResponse.json(
        { error: 'Failed to load company profiles', details: profilesError.message },
        { status: 500 }
      );
    }

    let companies = (profiles || [])
      .filter((profile) => {
        const del = (profile as { deleted_at?: string | null }).deleted_at;
        return !del;
      })
      .map((profile) => {
        const bu = memberships.find(
          (b) => String(b.profile_id) === String(profile.id)
        );
        const p = profile as {
          id: number;
          trading_name?: string;
          legal_name?: string | null;
          supplier_status?: string | null;
          verification_status?: string | null;
          business_type?: string | null;
          org_type?: string | null;
        };
        const ent = resolveEntityKind(p.org_type || p.business_type);
        const isPlatform =
          String(p.org_type || '').toLowerCase() === 'platform' ||
          String(p.business_type || '').toLowerCase() === 'platform' ||
          /^supplier\s*advisor$/i.test(String(p.trading_name || '').trim());
        return {
          id: String(p.id),
          trading_name: p.trading_name,
          legal_name: p.legal_name,
          supplier_status: p.supplier_status,
          verification_status: p.verification_status,
          business_type: p.business_type || null,
          org_type: p.org_type || null,
          entity_kind: isPlatform ? 'platform' : ent.id,
          entity_badge: isPlatform ? 'Platform' : ent.shortLabel,
          home_path: isPlatform
            ? '/dashboard/platform'
            : homePathForEntity(p.business_type, p.org_type),
          role: bu?.role || 'member',
        };
      });

    // Soft-deleted companies this user deleted (restore window)
    let deletedCompanies: Array<{
      id: string;
      trading_name: string;
      deleted_at: string;
      restore_until?: string | null;
    }> = [];
    if (body.includeDeleted) {
      try {
        const { data: deletedRows } = await supabase
          .from('profiles')
          .select('id, trading_name, deleted_at, deleted_by, deletion_reason')
          .not('deleted_at', 'is', null)
          .in('deleted_by', variants)
          .limit(20);
        deletedCompanies = (deletedRows || []).map((p) => {
          let restore_until: string | null = null;
          let name = String(p.trading_name || '').replace(/^\[Deleted\]\s*/i, '');
          try {
            const meta = JSON.parse(String(p.deletion_reason || '{}')) as {
              original_trading_name?: string;
              restore_until?: string;
            };
            if (meta.original_trading_name) name = meta.original_trading_name;
            if (meta.restore_until) restore_until = meta.restore_until;
          } catch {
            /* ignore */
          }
          return {
            id: String(p.id),
            trading_name: name,
            deleted_at: String(p.deleted_at),
            restore_until,
          };
        });
      } catch {
        /* column missing */
      }
    }

    // Ensure platform company is present in the list when bootstrap succeeded
    // but membership join somehow missed it (e.g. eventual consistency).
    if (
      platformBootstrap?.companyId &&
      !companies.some((c) => Number(c.id) === Number(platformBootstrap!.companyId))
    ) {
      try {
        const { data: plat } = await supabase
          .from('profiles')
          .select(
            'id, trading_name, legal_name, supplier_status, verification_status, business_type, org_type, deleted_at'
          )
          .eq('id', platformBootstrap.companyId)
          .maybeSingle();
        if (plat && !(plat as { deleted_at?: string | null }).deleted_at) {
          const p = plat as {
            id: number;
            trading_name?: string;
            legal_name?: string | null;
            supplier_status?: string | null;
            verification_status?: string | null;
            business_type?: string | null;
            org_type?: string | null;
          };
          const ent = resolveEntityKind(p.org_type || p.business_type);
          companies.unshift({
            id: String(p.id),
            trading_name: p.trading_name || 'SupplierAdvisor',
            legal_name: p.legal_name,
            supplier_status: p.supplier_status,
            verification_status: p.verification_status,
            business_type: p.business_type || 'platform',
            org_type: p.org_type || 'platform',
            entity_kind: ent.id,
            entity_badge: ent.shortLabel || 'Platform',
            home_path: '/dashboard/platform',
            role: 'owner',
          });
        }
      } catch {
        /* soft */
      }
    }

    return NextResponse.json({
      success: true,
      companies,
      deletedCompanies,
      userId,
      email,
      count: companies.length,
      platformBootstrap,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('me/companies error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
