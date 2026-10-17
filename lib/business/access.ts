import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';
import { activityTouchDecision } from '@/lib/business/activity-touch';
import {
  canAccess,
  canManageTeam,
  normalizeTeamRole,
  type AccessLevel,
  type PermissionResource,
  type TeamRole,
} from '@/lib/business/permissions';

export type MembershipOk = {
  ok: true;
  userId: string;
  memberId: number;
  role: TeamRole;
  status: string;
  email?: string | null;
  name?: string | null;
  /** business_users.permissions jsonb (module allow-list etc.) */
  permissions?: unknown;
};

export type MembershipFail = {
  ok: false;
  error: string;
  status: number;
};

const MEMBERSHIP_TTL_MS = 45_000;
const membershipMemo = new Map<
  string,
  { at: number; value: Promise<MembershipOk | MembershipFail> }
>();

const MEMBERSHIP_COLUMNS_NO_ACTIVITY =
  'id, user_id, profile_id, status, role, email, name, invited_email, permissions';
const MEMBERSHIP_COLUMNS = `${MEMBERSHIP_COLUMNS_NO_ACTIVITY}, last_active_at`;

/**
 * One PostgREST embed on business_users.profile_id → profiles.deleted_at.
 * Production has two identical foreign keys, so the relationship name is required.
 * Without it PostgREST returns PGRST201 and the read falls back to two queries.
 * last_active_at is included so the activity stamp can skip a fresh value.
 */
export const MEMBERSHIP_EMBED_SELECT = `${MEMBERSHIP_COLUMNS}, profiles!business_users_profile_id_fkey!inner(deleted_at)`;
const MEMBERSHIP_EMBED_NO_ACTIVITY = `${MEMBERSHIP_COLUMNS_NO_ACTIVITY}, profiles!business_users_profile_id_fkey!inner(deleted_at)`;

type MembershipDb = {
  from: (table: string) => any;
};

let membershipClientForTests: MembershipDb | null = null;
/** null = not yet known. false = this process already saw an ambiguous embed. */
let membershipEmbedSupported: boolean | null = null;

/** Unit tests inject a fake. Production leaves this null. */
export function setMembershipClientForTests(client: MembershipDb | null): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Membership test client cannot be installed in production');
  }
  membershipClientForTests = client;
  membershipMemo.clear();
  membershipEmbedSupported = null;
}

function membershipDb(): MembershipDb {
  return membershipClientForTests || getSupabaseServer();
}

export function invalidateCompanyMembershipMemo(opts?: {
  companyId?: number;
  userId?: string | null;
}): void {
  const companyId = opts?.companyId;
  const userId = opts?.userId ? getCanonicalUserId(opts.userId) : '';
  if (userId && companyId && Number.isFinite(companyId)) {
    membershipMemo.delete(`${userId}:${companyId}`);
    return;
  }
  if (companyId && Number.isFinite(companyId)) {
    const suffix = `:${companyId}`;
    for (const k of membershipMemo.keys()) {
      if (k.endsWith(suffix)) membershipMemo.delete(k);
    }
    return;
  }
  if (userId) {
    const prefix = `${userId}:`;
    for (const k of membershipMemo.keys()) {
      if (k.startsWith(prefix)) membershipMemo.delete(k);
    }
    return;
  }
  membershipMemo.clear();
}

/**
 * Active company membership with role (for permission checks).
 */
export async function getCompanyMembership(
  privyUserId: string | null | undefined,
  companyId: number
): Promise<MembershipOk | MembershipFail> {
  const userId = getCanonicalUserId(privyUserId);
  if (!userId) {
    return { ok: false, error: 'Authentication required (privyUserId)', status: 401 };
  }
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return { ok: false, error: 'Valid companyId is required', status: 400 };
  }

  const memoKey = `${userId}:${companyId}`;
  const hit = membershipMemo.get(memoKey);
  if (hit && Date.now() - hit.at < MEMBERSHIP_TTL_MS) {
    return hit.value;
  }
  const value = loadCompanyMembership(userId, companyId);
  membershipMemo.set(memoKey, { at: Date.now(), value });
  void value.then((res) => {
    if (!res.ok) membershipMemo.delete(memoKey);
  });
  return value;
}

type MembershipRow = {
  id: number;
  role?: string;
  status?: string;
  email?: string | null;
  invited_email?: string | null;
  name?: string | null;
  permissions?: unknown;
  last_active_at?: string | null;
  profiles?: { deleted_at?: string | null } | Array<{ deleted_at?: string | null }> | null;
};

function embedUnsupported(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = `${error.code || ''} ${error.message || ''}`;
  return /PGRST200|PGRST201|relationship|embedded resource|schema cache|could not find/i.test(msg);
}

/** 'missing' means the embed payload has no profile object, which is not "not deleted". */
function deletedAtOf(row: MembershipRow | null | undefined): string | null | 'missing' {
  if (!row || !Object.prototype.hasOwnProperty.call(row, 'profiles')) return 'missing';
  const embedded = row.profiles;
  if (embedded == null) return 'missing';
  const prof = Array.isArray(embedded) ? embedded[0] : embedded;
  if (!prof || typeof prof !== 'object') return 'missing';
  const del = prof.deleted_at;
  if (del == null || del === '') return null;
  return String(del);
}

function notMember(): MembershipFail {
  return { ok: false, error: 'You are not an active member of this company', status: 403 };
}

function deletedCompany(): MembershipFail {
  return { ok: false, error: 'This company has been deleted', status: 410 };
}

function verifyFailed(): MembershipFail {
  return { ok: false, error: 'Failed to verify company membership', status: 500 };
}

function membershipFromRow(userId: string, row: MembershipRow): MembershipOk {
  const memberId = Number(row.id);
  touchMemberActivity(memberId, row.last_active_at);
  return {
    ok: true,
    userId,
    memberId,
    role: normalizeTeamRole(row.role),
    status: String(row.status || 'active'),
    email: row.email || row.invited_email || null,
    name: row.name || null,
    permissions: row.permissions ?? null,
  };
}

async function loadMembershipFallback(
  supabase: MembershipDb,
  userId: string,
  companyId: number,
  variants: string[]
): Promise<MembershipOk | MembershipFail> {
  const [members, prof] = await Promise.all([
    supabase
      .from('business_users')
      .select(MEMBERSHIP_COLUMNS)
      .eq('profile_id', companyId)
      .eq('status', 'active')
      .in('user_id', variants)
      .limit(1),
    supabase.from('profiles').select('deleted_at').eq('id', companyId).maybeSingle(),
  ]);
  if (members.error || prof.error) {
    console.error('getCompanyMembership error:', members.error || prof.error);
    return verifyFailed();
  }
  const rows = (members.data || []) as MembershipRow[];
  if (!rows.length) return notMember();
  if (prof?.data?.deleted_at) return deletedCompany();
  return membershipFromRow(userId, rows[0]);
}

async function loadCompanyMembership(
  userId: string,
  companyId: number
): Promise<MembershipOk | MembershipFail> {
  const supabase = membershipDb();
  const variants = userIdMatchVariants(userId);

  if (membershipEmbedSupported !== false) {
    let embedded = await supabase
      .from('business_users')
      .select(MEMBERSHIP_EMBED_SELECT)
      .eq('profile_id', companyId)
      .eq('status', 'active')
      .in('user_id', variants)
      .limit(1);

    if (embedded.error && /last_active_at/i.test(embedded.error.message || '')) {
      embedded = await supabase
        .from('business_users')
        .select(MEMBERSHIP_EMBED_NO_ACTIVITY)
        .eq('profile_id', companyId)
        .eq('status', 'active')
        .in('user_id', variants)
        .limit(1);
    }

    if (embedded.error && embedUnsupported(embedded.error)) {
      membershipEmbedSupported = false;
    } else if (embedded.error) {
      console.error('getCompanyMembership error:', embedded.error);
      return verifyFailed();
    } else {
      membershipEmbedSupported = true;
      const rows = (embedded.data || []) as MembershipRow[];
      if (!rows.length) return notMember();
      const deletedAt = deletedAtOf(rows[0]);
      if (deletedAt === 'missing') return verifyFailed();
      if (deletedAt) return deletedCompany();
      return membershipFromRow(userId, rows[0]);
    }
  }

  return loadMembershipFallback(supabase, userId, companyId, variants);
}

const activityTouchMemo = new Map<number, number>();

type ActivityTouchRuntime = {
  now: () => number;
  schedule: (task: () => Promise<void>) => void;
  update: (memberId: number, stamp: string) => Promise<void>;
};

let activityTouchRuntime: ActivityTouchRuntime | null = null;

type ActivityScheduler = (task: () => Promise<void>) => void;

/**
 * instrumentation.ts and route handlers are separate module instances, so a
 * module-level slot set from register() is invisible to the route. Symbol.for
 * is shared by every copy in the isolate.
 */
const ACTIVITY_SCHEDULER = Symbol.for('supplieradvisor.memberActivityScheduler');

/**
 * Installed from instrumentation on the Node server. The client bundle must
 * not import next/server's after(), so this module only calls a callback.
 */
export function setActivityScheduler(schedule: ActivityScheduler | null): void {
  const slot = globalThis as Record<symbol, ActivityScheduler | undefined>;
  if (schedule) slot[ACTIVITY_SCHEDULER] = schedule;
  else delete slot[ACTIVITY_SCHEDULER];
}

function readActivityScheduler(): ActivityScheduler | null {
  const slot = (globalThis as Record<symbol, unknown>)[ACTIVITY_SCHEDULER];
  return typeof slot === 'function' ? (slot as ActivityScheduler) : null;
}

/** Unit tests supply a clock, a late scheduler, and a fake update. */
export function setActivityTouchRuntimeForTests(runtime: ActivityTouchRuntime | null): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Activity test runtime cannot be installed in production');
  }
  activityTouchRuntime = runtime;
  activityTouchMemo.clear();
}

/** Drops only the touch throttle, not the membership memo. */
export function clearActivityTouchMemoForTests(): void {
  activityTouchMemo.clear();
}

function scheduleAfterResponse(task: () => Promise<void>): void {
  const schedule = readActivityScheduler();
  if (schedule) {
    schedule(task);
    return;
  }
  void task().catch(() => undefined);
}

async function defaultActivityUpdate(memberId: number, stamp: string): Promise<void> {
  const supabase = membershipDb();
  await supabase
    .from('business_users')
    .update({ last_active_at: stamp, updated_at: stamp })
    .eq('id', memberId);
}

/**
 * Stamp last_active_at at most once per five minutes per member.
 * The team list reads this at minute resolution, so the floor stays five
 * minutes. The write goes to the shared scheduler when instrumentation has
 * installed one. With no scheduler, it still runs in this turn and can be
 * dropped when the isolate freezes. Confirm the held write on a Vercel preview.
 */
function touchMemberActivity(memberId: number, lastActiveAt?: string | null): void {
  const now = activityTouchRuntime ? activityTouchRuntime.now() : Date.now();
  const decision = activityTouchDecision({
    memberId,
    lastActiveAt,
    now,
    lastScheduledAt: activityTouchMemo.get(memberId),
  });
  if (!decision.write) return;
  activityTouchMemo.set(memberId, now);
  const schedule = activityTouchRuntime?.schedule || scheduleAfterResponse;
  const update = activityTouchRuntime?.update || defaultActivityUpdate;
  const stamp = new Date(now).toISOString();
  schedule(async () => {
    try {
      await update(memberId, stamp);
    } catch {
      /* column or network — last login stays stale */
    }
  });
}

/**
 * Membership required + minimum access on a resource.
 */
export async function assertCompanyPermission(
  privyUserId: string | null | undefined,
  companyId: number,
  resource: PermissionResource,
  need: AccessLevel = 'view'
): Promise<MembershipOk | MembershipFail> {
  const mem = await getCompanyMembership(privyUserId, companyId);
  if (!mem.ok) return mem;

  if (!canAccess(mem.role, resource, need)) {
    return {
      ok: false,
      error: `Your role (${mem.role}) does not have ${need} access to ${resource}. Contact an admin.`,
      status: 403,
    };
  }

  return mem;
}

export async function assertCanManageTeam(
  privyUserId: string | null | undefined,
  companyId: number
) {
  const mem = await getCompanyMembership(privyUserId, companyId);
  if (!mem.ok) return mem;
  if (!canManageTeam(mem.role)) {
    return {
      ok: false as const,
      error: 'Only owners and admins can manage team members and invitations.',
      status: 403,
    };
  }
  return mem;
}

export { canAccess, canManageTeam, normalizeTeamRole };
