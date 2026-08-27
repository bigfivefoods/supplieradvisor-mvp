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
  platformOwnerEmails,
} from '@/lib/system/platform-company';
import { canAppearInCompanySwitcher } from '@/lib/business/permissions';
import { sortCompaniesForSwitcher } from '@/lib/business/company-switcher-order';
import { safeFilterEmails } from '@/lib/security/email-filter';
import {
  isPlatformOperatorEmail,
  isPlatformOperatorUserId,
  resolveEmailsForUserId,
} from '@/lib/system/platform-control';

/**
 * POST /api/me/companies
 * Reliable company membership lookup for Privy-authenticated clients.
 * Uses service role so RLS never hides rows when there is no Supabase session
 * (auth is Privy-only). Also matches by email for legacy / cross-device rows.
 *
 * Body: { privyUserId?: string, includeDeleted?: boolean }
 * Identity and owner emails come from the verified Privy JWT only.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const _auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: body.privyUserId || legacyPrivyFrom(request),
    });
    if (!_auth.ok) return _auth.response;
    const userId = getCanonicalUserId(_auth.userId);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const variants = userIdMatchVariants(userId);

    // Emails from verified JWT + memberships already bound to this user_id.
    // Never trust body.email / body.emails for platform ownership or membership rewrite.
    const knownEmails = new Set<string>(_auth.emails || []);
    try {
      for (const e of await resolveEmailsForUserId(userId)) knownEmails.add(e);
    } catch {
      /* soft */
    }

    const primaryEmail =
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
     * Platform owners (PLATFORM_OWNER_EMAILS / PLATFORM_OPERATOR_EMAILS):
     * ensure the control-plane company exists and this user is an active owner
     * so it always appears in Switch company.
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
          jwtEmails: [...knownEmails],
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
      const emailList = safeFilterEmails([...knownEmails]);
      let emailMatches: typeof memberships = [];

      if (emailList.length) {
        const cols =
          'id, role, profile_id, status, user_id, email, invited_email, name, permissions';
        const [byEmail, byInvited] = await Promise.all([
          supabase
            .from('business_users')
            .select(cols)
            .eq('status', 'active')
            .in('email', emailList)
            .limit(80),
          supabase
            .from('business_users')
            .select(cols)
            .eq('status', 'active')
            .in('invited_email', emailList)
            .limit(80),
        ]);
        emailMatches = [
          ...((byEmail.data || []) as typeof memberships),
          ...((byInvited.data || []) as typeof memberships),
        ];
      }

      const seen = new Set(memberships.map((m) => m.id));
      for (const row of emailMatches) {
        if (!seen.has(row.id)) {
          memberships.push(row);
          seen.add(row.id);
        }
      }

      // Bind user_id only on unmatched invite rows (empty user_id). Never steal
      // an existing membership that belongs to another user_id.
      for (const row of emailMatches) {
        const existingUid = String(row.user_id || '').trim();
        if (existingUid && !variants.includes(existingUid)) continue;
        if (!existingUid) {
          await supabase
            .from('business_users')
            .update({
              user_id: userId,
              email: primaryEmail || row.email,
              status: 'active',
            })
            .eq('id', row.id)
            .is('user_id', null);
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
        email: primaryEmail,
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
        const candidates = memberships.filter(
          (b) => String(b.profile_id) === String(profile.id)
        );
        const bu =
          candidates.find((b) =>
            canAppearInCompanySwitcher(b.role ? String(b.role) : null)
          ) || candidates[0];
        if (!canAppearInCompanySwitcher(bu?.role || null)) return null;
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
          isPlatformCompanyProfile({
            trading_name: p.trading_name,
            legal_name: p.legal_name,
            metadata: p.metadata,
          });
        const meta =
          p.metadata && typeof p.metadata === 'object' ? p.metadata : {};
        const enabledModules = extractEnabledModulesFromMetadata(meta, {
          companyId: Number(p.id),
          companyName: String(p.trading_name || p.legal_name || ''),
        });
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
      })
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

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
              jwtEmails: [...knownEmails],
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
            trading_name: p.trading_name || 'Big Five Connect',
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

    // Connect → Group → Foods → VUKA, then remaining A–Z
    companies = sortCompaniesForSwitcher(companies);

    return NextResponse.json({
      success: true,
      companies,
      deletedCompanies,
      userId,
      email: primaryEmail,
      count: companies.length,
      platformBootstrap,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('me/companies error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
