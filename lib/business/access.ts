import { after } from 'next/server';
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

const MEMBERSHIP_COLUMNS =
  'id, user_id, profile_id, status, role, email, name, invited_email, permissions, last_active_at';
const MEMBERSHIP_COLUMNS_NO_ACTIVITY =
  'id, user_id, profile_id, status, role, email, name, invited_email, permissions';

type MembershipDb = {
  from: (table: string) => any;
};

let membershipClientForTests: MembershipDb | null = null;

/** Unit tests inject a fake. Production leaves this null. */
export function setMembershipClientForTests(client: MembershipDb | null): void {
  membershipClientForTests = client;
  membershipMemo.clear();
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

async function loadCompanyMembership(
  userId: string,
  companyId: number
): Promise<MembershipOk | MembershipFail> {
  const supabase = membershipDb();
  const variants = userIdMatchVariants(userId);

  let { data, error } = await supabase
    .from('business_users')
    .select(MEMBERSHIP_COLUMNS)
    .eq('profile_id', companyId)
    .eq('status', 'active')
    .in('user_id', variants)
    .limit(1);

  if (error && /last_active_at/i.test(error.message || '')) {
    const retry = await supabase
      .from('business_users')
      .select(MEMBERSHIP_COLUMNS_NO_ACTIVITY)
      .eq('profile_id', companyId)
      .eq('status', 'active')
      .in('user_id', variants)
      .limit(1);
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error('getCompanyMembership error:', error);
    return { ok: false, error: 'Failed to verify company membership', status: 500 };
  }

  if (!data || data.length === 0) {
    return { ok: false, error: 'You are not an active member of this company', status: 403 };
  }

  // Soft-deleted companies cannot be used
  const { data: prof } = await supabase
    .from('profiles')
    .select('deleted_at')
    .eq('id', companyId)
    .maybeSingle();
  if (prof?.deleted_at) {
    return {
      ok: false,
      error: 'This company has been deleted',
      status: 410,
    };
  }

  const row = data[0] as {
    id: number;
    role?: string;
    status?: string;
    email?: string | null;
    invited_email?: string | null;
    name?: string | null;
    permissions?: unknown;
    last_active_at?: string | null;
  };
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

const activityTouchMemo = new Map<number, number>();

type ActivityTouchRuntime = {
  now: () => number;
  schedule: (task: () => Promise<void>) => void;
  update: (memberId: number, stamp: string) => Promise<void>;
};

let activityTouchRuntime: ActivityTouchRuntime | null = null;

/** Unit tests supply a clock, a late scheduler, and a fake update. */
export function setActivityTouchRuntimeForTests(runtime: ActivityTouchRuntime | null): void {
  activityTouchRuntime = runtime;
  activityTouchMemo.clear();
}

/** Drops only the touch throttle, not the membership memo. */
export function clearActivityTouchMemoForTests(): void {
  activityTouchMemo.clear();
}

function scheduleAfterResponse(task: () => Promise<void>): void {
  try {
    after(() => {
      void task().catch(() => undefined);
    });
  } catch {
    void task().catch(() => undefined);
  }
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
 * minutes. The write is scheduled with after() so the response does not
 * drop it, and it is skipped when the stored stamp is already inside the window.
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
