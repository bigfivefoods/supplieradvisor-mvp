import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';
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
  const supabase = getSupabaseServer();
  const variants = userIdMatchVariants(userId);

  const { data, error } = await supabase
    .from('business_users')
    .select(
      'id, user_id, profile_id, status, role, email, name, invited_email, permissions'
    )
    .eq('profile_id', companyId)
    .eq('status', 'active')
    .in('user_id', variants)
    .limit(1);

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
  };
  const memberId = Number(row.id);
  touchMemberActivity(memberId);
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

const ACTIVITY_TOUCH_MS = 5 * 60 * 1000;
const activityTouchMemo = new Map<number, number>();

/** Stamp last_active_at at most every 5 minutes per member. */
function touchMemberActivity(memberId: number): void {
  if (!Number.isFinite(memberId) || memberId <= 0) return;
  const now = Date.now();
  const prev = activityTouchMemo.get(memberId) || 0;
  if (now - prev < ACTIVITY_TOUCH_MS) return;
  activityTouchMemo.set(memberId, now);
  void (async () => {
    try {
      const supabase = getSupabaseServer();
      const stamp = new Date().toISOString();
      await supabase
        .from('business_users')
        .update({ last_active_at: stamp, updated_at: stamp })
        .eq('id', memberId);
    } catch {
      /* column or network — last login stays stale */
    }
  })();
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
