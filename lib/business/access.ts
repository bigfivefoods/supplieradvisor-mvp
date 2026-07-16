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
};

export type MembershipFail = {
  ok: false;
  error: string;
  status: number;
};

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

  const supabase = getSupabaseServer();
  const variants = userIdMatchVariants(userId);

  const { data, error } = await supabase
    .from('business_users')
    .select('id, user_id, profile_id, status, role, email, name, invited_email')
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

  const row = data[0];
  return {
    ok: true,
    userId,
    memberId: Number(row.id),
    role: normalizeTeamRole(row.role),
    status: String(row.status || 'active'),
    email: row.email || row.invited_email || null,
    name: row.name || null,
  };
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
