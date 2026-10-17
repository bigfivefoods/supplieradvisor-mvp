/**
 * Login bootstrap for POST /api/me/companies.
 * Independent reads share a round. Writes run only after a read shows they are needed.
 */
import { userIdMatchVariants } from '@/lib/auth/identity';
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
} from '@/lib/system/platform-company';
import {
  isPlatformOperatorEmail,
  resolveEmailsForUserId,
} from '@/lib/system/platform-control';
import { canAppearInCompanySwitcher } from '@/lib/business/permissions';
import { sortCompaniesForSwitcher } from '@/lib/business/company-switcher-order';
import { safeFilterEmails } from '@/lib/security/email-filter';

export type MeCompaniesDb = {
  from: (table: string) => any;
};

type ProfileRow = {
  id: number;
  trading_name?: string | null;
  legal_name?: string | null;
  supplier_status?: string | null;
  verification_status?: string | null;
  deleted_at?: string | null;
  business_type?: string | null;
  org_type?: string | null;
  metadata?: Record<string, unknown> | null;
  deletion_reason?: string | null;
  deleted_by?: string | null;
};

type MemberRow = {
  id: number;
  role?: string | null;
  profile_id: number;
  status?: string | null;
  user_id?: string | null;
  email?: string | null;
  invited_email?: string | null;
  name?: string | null;
  permissions?: unknown;
  profile?: ProfileRow | null;
};

const MEMBER_COLS =
  'id, role, profile_id, status, user_id, email, invited_email, name, permissions';
const PROFILE_COLS =
  'id, trading_name, legal_name, supplier_status, verification_status, deleted_at, business_type, org_type, metadata';
/**
 * Production business_users has two foreign keys on profile_id, so the
 * relationship must be named or PostgREST returns PGRST201.
 */
export const MEMBER_EMBED = `${MEMBER_COLS}, profiles!business_users_profile_id_fkey!inner(${PROFILE_COLS})`;

/** null = unknown. false = this process already saw an ambiguous embed. */
let memberEmbedSupported: boolean | null = null;

export function resetMeCompaniesEmbedForTests(): void {
  memberEmbedSupported = null;
}

export type PlatformBootstrap = {
  companyId?: number;
  created?: boolean;
  attached?: string[];
  error?: string;
  knownEmails?: string[];
};

export type LoadMyCompaniesOpts = {
  supabase: MeCompaniesDb;
  userId: string;
  jwtEmails?: string[] | null;
  includeDeleted?: boolean;
  ensurePlatformCompany?: (args: {
    userId: string;
    jwtEmails: string[];
  }) => Promise<{
    company: { id: number };
    created: boolean;
    ownersAttached: string[];
  }>;
  isPlatformEmail?: (email: string) => boolean;
};

function embedUnsupported(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = `${error.code || ''} ${error.message || ''}`;
  return /PGRST200|PGRST201|relationship|embedded resource|schema cache|could not find/i.test(msg);
}

function asProfile(raw: unknown): ProfileRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = (Array.isArray(raw) ? raw[0] : raw) as ProfileRow | undefined;
  if (!row || row.id == null) return null;
  return row;
}

function withProfile(raw: Record<string, unknown>): MemberRow {
  const profile = asProfile(raw.profiles);
  const { profiles: _drop, ...rest } = raw;
  return { ...(rest as MemberRow), profile };
}

async function readMembers(
  query: PromiseLike<{ data?: unknown; error?: { message?: string; code?: string } | null }>
): Promise<{ rows: MemberRow[]; embedded: boolean; error: string | null }> {
  const first = await query;
  if (!first.error) {
    const rows = ((first.data || []) as Record<string, unknown>[]).map(withProfile);
    return { rows, embedded: rows.every((row) => row.profile != null) || rows.length === 0, error: null };
  }
  return { rows: [], embedded: false, error: first.error.message || 'membership read failed' };
}

function memberQuery(
  supabase: MeCompaniesDb,
  select: string
) {
  return supabase.from('business_users').select(select).eq('status', 'active');
}

async function loadByUser(
  supabase: MeCompaniesDb,
  variants: string[]
): Promise<{ rows: MemberRow[]; error: string | null }> {
  if (memberEmbedSupported === false) {
    const plain = await readMembers(memberQuery(supabase, MEMBER_COLS).in('user_id', variants));
    if (plain.error) return { rows: [], error: plain.error };
    return { rows: plain.rows, error: null };
  }
  const embedded = memberQuery(supabase, MEMBER_EMBED).in('user_id', variants);
  const first = await readMembers(embedded);
  if (!first.error) {
    memberEmbedSupported = true;
    return { rows: first.rows, error: null };
  }
  if (embedUnsupported({ message: first.error })) memberEmbedSupported = false;
  const plain = await readMembers(memberQuery(supabase, MEMBER_COLS).in('user_id', variants));
  if (plain.error) return { rows: [], error: plain.error };
  return { rows: plain.rows, error: null };
}

async function loadByEmails(
  supabase: MeCompaniesDb,
  emails: string[]
): Promise<MemberRow[]> {
  if (!emails.length) return [];
  const select = memberEmbedSupported === false ? MEMBER_COLS : MEMBER_EMBED;
  const byEmail = memberQuery(supabase, select).in('email', emails).limit(80);
  const byInvited = memberQuery(supabase, select).in('invited_email', emails).limit(80);
  const [emailRes, invitedRes] = await Promise.all([
    readMembers(byEmail),
    readMembers(byInvited),
  ]);
  if (!emailRes.error && !invitedRes.error) {
    if (select === MEMBER_EMBED) memberEmbedSupported = true;
    return [...emailRes.rows, ...invitedRes.rows];
  }
  if (
    embedUnsupported({ message: emailRes.error || '' }) ||
    embedUnsupported({ message: invitedRes.error || '' })
  ) {
    memberEmbedSupported = false;
  }
  const [plainEmail, plainInvited] = await Promise.all([
    readMembers(memberQuery(supabase, MEMBER_COLS).in('email', emails).limit(80)),
    readMembers(memberQuery(supabase, MEMBER_COLS).in('invited_email', emails).limit(80)),
  ]);
  return [...plainEmail.rows, ...plainInvited.rows];
}

async function loadProfilesByIds(
  supabase: MeCompaniesDb,
  profileIds: number[]
): Promise<{ rows: ProfileRow[]; error: string | null }> {
  if (!profileIds.length) return { rows: [], error: null };
  let res = await supabase.from('profiles').select(PROFILE_COLS).in('id', profileIds);
  if (res.error && /deleted_at|column|schema cache/i.test(res.error.message || '')) {
    res = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, supplier_status, verification_status, business_type, org_type, metadata'
      )
      .in('id', profileIds);
  }
  if (res.error && /business_type|org_type|column|schema cache/i.test(res.error.message || '')) {
    res = await supabase
      .from('profiles')
      .select('id, trading_name, legal_name, supplier_status, verification_status, deleted_at')
      .in('id', profileIds);
  }
  if (res.error) return { rows: [], error: res.error.message || 'profiles failed' };
  return { rows: (res.data || []) as ProfileRow[], error: null };
}

async function hydrateProfiles(
  supabase: MeCompaniesDb,
  rows: MemberRow[]
): Promise<string | null> {
  const missing = rows.filter((row) => !row.profile && row.profile_id);
  if (!missing.length) return null;
  const ids = [...new Set(missing.map((row) => Number(row.profile_id)))];
  const loaded = await loadProfilesByIds(supabase, ids);
  if (loaded.error) return loaded.error;
  const byId = new Map(loaded.rows.map((row) => [String(row.id), row]));
  for (const row of missing) {
    row.profile = byId.get(String(row.profile_id)) || null;
  }
  return null;
}

function companyFromProfile(
  profile: ProfileRow,
  bu: MemberRow | undefined
) {
  const p = profile;
  const ent = resolveEntityKind(p.org_type || p.business_type);
  const isPlatform =
    String(p.org_type || '').toLowerCase() === 'platform' ||
    String(p.business_type || '').toLowerCase() === 'platform' ||
    isPlatformCompanyProfile({
      trading_name: p.trading_name,
      legal_name: p.legal_name,
      metadata: p.metadata,
    });
  const meta = p.metadata && typeof p.metadata === 'object' ? p.metadata : {};
  const enabledModules = extractEnabledModulesFromMetadata(meta, {
    companyId: Number(p.id),
    companyName: String(p.trading_name || p.legal_name || ''),
  });
  const packIds = readPackagingFromMetadata(meta)?.packIds || [];
  const sidebarOrder = extractSidebarModuleOrder(bu?.permissions);
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
    home_path:
      isPlatform && enabledModules.platform !== false
        ? '/dashboard/platform'
        : advisorHome || homePathForEntity(p.business_type, p.org_type),
    role: bu?.role || 'member',
  };
}

function mapCompanies(memberships: MemberRow[]) {
  const byProfile = new Map<string, MemberRow[]>();
  for (const row of memberships) {
    if (!row.profile || row.profile.deleted_at) continue;
    const key = String(row.profile_id);
    const list = byProfile.get(key) || [];
    list.push(row);
    byProfile.set(key, list);
  }
  const companies = [];
  for (const candidates of byProfile.values()) {
    const profile = candidates[0].profile;
    if (!profile) continue;
    const bu =
      candidates.find((b) => canAppearInCompanySwitcher(b.role ? String(b.role) : null)) ||
      candidates[0];
    if (!canAppearInCompanySwitcher(bu?.role || null)) continue;
    companies.push(companyFromProfile(profile, bu));
  }
  return companies;
}

async function loadDeleted(
  supabase: MeCompaniesDb,
  variants: string[]
) {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, trading_name, deleted_at, deleted_by, deletion_reason')
      .not('deleted_at', 'is', null)
      .in('deleted_by', variants)
      .limit(20);
    return (data || []).map((p: ProfileRow) => {
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
    return [];
  }
}

export async function loadMyCompanies(
  opts: LoadMyCompaniesOpts
): Promise<{ status: number; body: Record<string, unknown> }> {
  const supabase = opts.supabase;
  const userId = opts.userId;
  const variants = userIdMatchVariants(userId);
  const isPlatformEmail =
    opts.isPlatformEmail ||
    ((email: string) => isPlatformOwnerEmail(email) || isPlatformOperatorEmail(email));
  const ensure =
    opts.ensurePlatformCompany ||
    ((args) => ensurePlatformCompany(args));

  const knownEmails = new Set<string>();
  for (const email of opts.jwtEmails || []) {
    const cleaned = String(email || '').trim().toLowerCase();
    if (cleaned) knownEmails.add(cleaned);
  }
  const jwtList = safeFilterEmails([...knownEmails]);

  const byUserP = loadByUser(supabase, variants);
  const storedEmailsP = resolveEmailsForUserId(userId, supabase);
  const jwtMatchP = jwtList.length ? loadByEmails(supabase, jwtList) : Promise.resolve([]);
  const deletedP = opts.includeDeleted
    ? loadDeleted(supabase, variants)
    : Promise.resolve([]);

  const [byUser, storedEmails, jwtMatches, deletedCompanies] = await Promise.all([
    byUserP,
    storedEmailsP,
    jwtMatchP,
    deletedP,
  ]);

  if (byUser.error) {
    console.error('me/companies by user error:', byUser.error);
    return {
      status: 500,
      body: { error: 'Failed to load memberships', details: byUser.error },
    };
  }

  for (const email of storedEmails) knownEmails.add(email);
  const extraEmails = safeFilterEmails([...knownEmails]).filter((email) => !jwtList.includes(email));
  const extraMatches = extraEmails.length ? await loadByEmails(supabase, extraEmails) : [];
  const emailMatches = [...jwtMatches, ...extraMatches];

  const seen = new Set<number>();
  const memberships: MemberRow[] = [];
  const add = (row: MemberRow) => {
    if (seen.has(Number(row.id))) return;
    seen.add(Number(row.id));
    memberships.push(row);
  };
  for (const row of byUser.rows) add(row);
  for (const row of emailMatches) add(row);

  const primaryEmail =
    [...knownEmails].find((email) => isPlatformEmail(email)) ||
    [...knownEmails][0] ||
    null;

  const bindSeen = new Set<number>();
  const toBind = emailMatches.filter((row) => {
    if (String(row.user_id || '').trim()) return false;
    if (bindSeen.has(Number(row.id))) return false;
    bindSeen.add(Number(row.id));
    return true;
  });
  if (toBind.length) {
    await Promise.all(
      toBind.map((row) =>
        supabase
          .from('business_users')
          .update({
            user_id: userId,
            email: primaryEmail || row.email,
            status: 'active',
          })
          .eq('id', row.id)
          .is('user_id', null)
      )
    );
    for (const row of toBind) {
      const held = memberships.find((item) => item.id === row.id);
      if (held) held.user_id = userId;
    }
  }

  const isPlatformUser = [...knownEmails].some((email) => isPlatformEmail(email));
  let platformBootstrap: PlatformBootstrap | null = null;
  if (isPlatformUser) {
    try {
      // Still runs when this user already has a visible platform membership.
      // ensurePlatformCompany refreshes platform metadata and re-promotes
      // owner emails. Skipping it would drop that login-time work.
      const result = await ensure({
        userId,
        jwtEmails: [...knownEmails],
      });
      platformBootstrap = {
        companyId: result.company.id,
        created: result.created,
        attached: result.ownersAttached,
        knownEmails: [...knownEmails],
      };
      const pullSelect = memberEmbedSupported === false ? MEMBER_COLS : MEMBER_EMBED;
      const pulled = await readMembers(
        memberQuery(supabase, pullSelect)
          .eq('profile_id', result.company.id)
          .limit(20)
      );
      const pulledRows = pulled.error
        ? (
            await readMembers(
              memberQuery(supabase, MEMBER_COLS)
                .eq('profile_id', result.company.id)
                .limit(20)
            )
          ).rows
        : pulled.rows;
      for (const row of pulledRows) {
        const uid = String(row.user_id || '');
        const e1 = (row.email || '').toLowerCase();
        const e2 = (row.invited_email || '').toLowerCase();
        const mine = variants.includes(uid) || knownEmails.has(e1) || knownEmails.has(e2);
        if (mine) add(row);
      }
    } catch (e: unknown) {
      console.error('me/companies platform bootstrap soft-fail:', e);
      platformBootstrap = {
        error: e instanceof Error ? e.message : 'bootstrap failed',
        knownEmails: [...knownEmails],
      };
    }
  }

  const hydrateError = await hydrateProfiles(supabase, memberships);
  if (hydrateError) {
    console.error('me/companies profiles error:', hydrateError);
    return {
      status: 500,
      body: { error: 'Failed to load company profiles', details: hydrateError },
    };
  }

  if (memberships.length === 0) {
    return {
      status: 200,
      body: {
        success: true,
        companies: [],
        userId,
        email: primaryEmail,
        debug: { matchedByUser: byUser.rows.length, variants },
      },
    };
  }

  let companies = mapCompanies(memberships);

  if (
    platformBootstrap?.companyId &&
    !companies.some((company) => Number(company.id) === Number(platformBootstrap!.companyId))
  ) {
    const { data: plat } = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, supplier_status, verification_status, business_type, org_type, deleted_at'
      )
      .eq('id', platformBootstrap.companyId)
      .maybeSingle();
    if (plat && !(plat as ProfileRow).deleted_at) {
      const p = plat as ProfileRow;
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
  }

  companies = sortCompaniesForSwitcher(companies);

  return {
    status: 200,
    body: {
      success: true,
      companies,
      deletedCompanies: opts.includeDeleted ? deletedCompanies : [],
      userId,
      email: primaryEmail,
      count: companies.length,
      platformBootstrap,
    },
  };
}
