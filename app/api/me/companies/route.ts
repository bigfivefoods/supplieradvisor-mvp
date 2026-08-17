import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';
import { requireVerifiedUser, legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  homePathForEntity,
  resolveEntityKind,
} from '@/lib/entities/entity-kinds';
import { advisorLandingPath } from '@/lib/brand/advisor-skins';
import { extractEnabledModulesFromMetadata } from '@/lib/business/company-modules';
import { extractSidebarModuleOrder } from '@/lib/business/member-modules';
import { readPackagingFromMetadata } from '@/lib/product/architecture';
import {
  ensurePlatformCompany,
  isPlatformCompanyProfile,
  isPlatformOwnerEmail,
  PLATFORM_OWNER_EMAILS,
} from '@/lib/system/platform-company';
import {
  isPlatformOperatorEmail,
  isPlatformOperatorUserId,
  resolveEmailsForUserId,
} from '@/lib/system/platform-control';

/** Pin SupplierAdvisor platform company first in Switch company lists. */
function sortPlatformCompanyFirst<
  T extends {
    id: string;
    trading_name?: string | null;
    legal_name?: string | null;
    entity_kind?: string | null;
    business_type?: string | null;
    org_type?: string | null;
  },
>(companies: T[]): T[] {
  return [...companies].sort((a, b) => {
    const aPlat = isPlatformCompanyListItem(a);
    const bPlat = isPlatformCompanyListItem(b);
    if (aPlat && !bPlat) return -1;
    if (!aPlat && bPlat) return 1;
    return 0;
  });
}

function isPlatformCompanyListItem(c: {
  trading_name?: string | null;
  legal_name?: string | null;
  entity_kind?: string | null;
  business_type?: string | null;
  org_type?: string | null;
}): boolean {
  if (c.entity_kind === 'platform') return true;
  if (String(c.org_type || '').toLowerCase() === 'platform') return true;
  if (String(c.business_type || '').toLowerCase() === 'platform') return true;
  return isPlatformCompanyProfile({
    trading_name: c.trading_name,
    legal_name: c.legal_name,
  });
}

/**
 * POST /api/me/companies
 * Reliable company membership lookup for Privy-authenticated clients.
 * Uses service role so RLS never hides rows when there is no Supabase session
 * (auth is Privy-only). Also matches by email for legacy / cross-device rows.
 *
 * Body: { privyUserId: string, email?: string | null, emails?: string[] }
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
    const bodyEmails: string[] = Array.isArray(body.emails)
      ? body.emails.map((e: unknown) => String(e).toLowerCase().trim()).filter(Boolean)
      : [];

    if (!userId) {
      return NextResponse.json({ error: 'privyUserId is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const variants = userIdMatchVariants(userId);

    // Resolve all known emails for this user (body + business_users history)
    const knownEmails = new Set<string>();
    if (email) knownEmails.add(email);
    for (const e of bodyEmails) knownEmails.add(e);
    try {
      for (const e of await resolveEmailsForUserId(userId)) knownEmails.add(e);
    } catch {
      /* soft */
    }

    const primaryEmail =
      email ||
      [...knownEmails].find(
        (e) => isPlatformOwnerEmail(e) || isPlatformOperatorEmail(e)
      ) ||
      [...knownEmails][0] ||
      null;

    const isPlatformUser =
      [...knownEmails].some(
        (e) => isPlatformOwnerEmail(e) || isPlatformOperatorEmail(e)
      ) || (await isPlatformOperatorUserId(userId));

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
      knownEmails?: string[];
    } | null = null;
    if (isPlatformUser) {
      try {
        const result = await ensurePlatformCompany({
          userId,
          email:
            primaryEmail ||
            PLATFORM_OWNER_EMAILS[0],
        });
        platformBootstrap = {
          companyId: result.company.id,
          created: result.created,
          attached: result.ownersAttached,
          knownEmails: [...knownEmails],
        };
      } catch (e: unknown) {
        console.error('me/companies platform bootstrap soft-fail:', e);
        platformBootstrap = {
          error: e instanceof Error ? e.message : 'bootstrap failed',
          knownEmails: [...knownEmails],
        };
      }
    }

    // 1) Memberships by user_id variants
    const { data: byUser, error: byUserError } = await supabase
      .from('business_users')
      .select(
        'id, role, profile_id, status, user_id, email, invited_email, name, permissions'
      )
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

    // 2) Also match active memberships by any known email (covers legacy / id drift)
    if (knownEmails.size > 0) {
      const emailList = [...knownEmails];
      let emailMatches: typeof memberships = [];

      for (const em of emailList) {
        const { data: byEmailRows, error: emailError } = await supabase
          .from('business_users')
          .select(
            'id, role, profile_id, status, user_id, email, invited_email, name, permissions'
          )
          .eq('status', 'active')
          .or(`email.eq.${em},invited_email.eq.${em}`)
          .limit(50);
        if (!emailError && byEmailRows?.length) {
          emailMatches = emailMatches.concat(byEmailRows as typeof memberships);
        }
      }

      // Fallback scan if filters returned nothing for platform owners
      if (emailMatches.length === 0 && isPlatformUser) {
        const { data: allActive } = await supabase
          .from('business_users')
          .select(
            'id, role, profile_id, status, user_id, email, invited_email, name, permissions'
          )
          .eq('status', 'active')
          .limit(3000);
        if (allActive) {
          emailMatches = allActive.filter((row) => {
            const e1 = (row.email || '').toLowerCase();
            const e2 = (row.invited_email || '').toLowerCase();
            return emailList.includes(e1) || emailList.includes(e2);
          }) as typeof memberships;
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
        if (row.user_id && !variants.includes(String(row.user_id))) {
          await supabase
            .from('business_users')
            .update({
              user_id: userId,
              email: primaryEmail || row.email,
              status: 'active',
            })
            .eq('id', row.id);
        }
      }
    }

    // 3) After platform bootstrap, re-pull memberships for that profile
    if (platformBootstrap?.companyId) {
      const { data: platMem } = await supabase
        .from('business_users')
        .select(
          'id, role, profile_id, status, user_id, email, invited_email, name, permissions'
        )
        .eq('profile_id', platformBootstrap.companyId)
        .eq('status', 'active')
        .limit(20);
      const seen = new Set(memberships.map((m) => m.id));
      for (const row of platMem || []) {
        const uid = String(row.user_id || '');
        const e1 = (row.email || '').toLowerCase();
        const e2 = (row.invited_email || '').toLowerCase();
        const mine =
          variants.includes(uid) ||
          knownEmails.has(e1) ||
          knownEmails.has(e2);
        if (mine && !seen.has(row.id)) {
          memberships.push(row);
          seen.add(row.id);
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
        'id, trading_name, legal_name, supplier_status, verification_status, deleted_at, business_type, org_type, metadata'
      )
      .in('id', profileIds);

    let { data: profiles, error: profilesError } = await profilesQuery;

    // Soft-deleted filter; retry without deleted_at if column missing
    if (profilesError && /deleted_at|column|schema cache/i.test(profilesError.message)) {
      const retry = await supabase
        .from('profiles')
        .select(
          'id, trading_name, legal_name, supplier_status, verification_status, business_type, org_type, metadata'
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
          metadata?: Record<string, unknown> | null;
        };
        const ent = resolveEntityKind(p.org_type || p.business_type);
        const isPlatform =
          String(p.org_type || '').toLowerCase() === 'platform' ||
          String(p.business_type || '').toLowerCase() === 'platform' ||
          /^supplier\s*advisor$/i.test(String(p.trading_name || '').trim());
        const meta =
          p.metadata && typeof p.metadata === 'object' ? p.metadata : {};
        const enabledModules = extractEnabledModulesFromMetadata(meta);
        const packIds = readPackagingFromMetadata(meta)?.packIds || [];
        const sidebarOrder = extractSidebarModuleOrder(
          (bu as { permissions?: unknown } | undefined)?.permissions
        );
        const advisorHome = advisorLandingPath({
          enabledModules,
          packIds,
          sidebarOrder,
        });
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
            : advisorHome || homePathForEntity(p.business_type, p.org_type),
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
        // Guarantee membership row for this user on the platform company
        if (userId) {
          try {
            await ensurePlatformCompany({
              userId,
              email: primaryEmail || PLATFORM_OWNER_EMAILS[0],
            });
          } catch {
            /* already logged in bootstrap */
          }
        }
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
          companies.unshift({
            id: String(p.id),
            trading_name: p.trading_name || 'SupplierAdvisor',
            legal_name: p.legal_name,
            supplier_status: p.supplier_status || 'active',
            verification_status: p.verification_status || 'verified',
            business_type: p.business_type || 'platform',
            org_type: p.org_type || 'platform',
            entity_kind: 'platform',
            entity_badge: 'Platform',
            home_path: '/dashboard/platform',
            role: 'owner',
          });
        }
      } catch {
        /* soft */
      }
    }

    // Always pin SupplierAdvisor (platform control plane) first on Switch company
    companies = sortPlatformCompanyFirst(companies);

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
