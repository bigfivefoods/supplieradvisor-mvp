import { NextRequest } from 'next/server';
import { requireVerifiedUser } from '@/lib/auth/api-auth';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { normalizeTeamRole, type TeamRole } from '@/lib/business/permissions';

export const RECOVER_COMPANY_COOKIE = 'sa_company_id';

export type MemberCompany = {
  companyId: number;
  role: TeamRole;
  email: string | null;
  userId: string;
};

/**
 * Company id comes from the signed-in membership.
 * A cookie may choose among the caller's own companies. Body and query are ignored.
 */
export async function resolveMemberCompany(
  request: NextRequest
): Promise<{ ok: true; member: MemberCompany } | { ok: false; status: number; error: string }> {
  const auth = await requireVerifiedUser(request);
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: 'Authentication required.' };
  }
  const userId = getCanonicalUserId(auth.userId);
  if (!userId) return { ok: false, status: 401, error: 'Authentication required.' };

  const supabase = getSupabaseServer();
  const found = await supabase
    .from('business_users')
    .select('profile_id, role, status, email, invited_email')
    .eq('status', 'active')
    .in('user_id', userIdMatchVariants(userId));
  if (found.error || !found.data) {
    return { ok: false, status: 403, error: 'You do not have access to do that.' };
  }

  const memberships = (found.data as Array<Record<string, unknown>>)
    .map((row) => ({
      companyId: Number(row.profile_id),
      role: normalizeTeamRole(String(row.role || '')),
      email: String(row.email || row.invited_email || auth.emails[0] || '')
        .trim()
        .toLowerCase() || null,
    }))
    .filter((row) => Number.isInteger(row.companyId) && row.companyId > 0);

  if (!memberships.length) {
    return { ok: false, status: 403, error: 'You do not have access to do that.' };
  }

  const hinted = Number(request.cookies.get(RECOVER_COMPANY_COOKIE)?.value || '');
  const chosen =
    memberships.find((row) => row.companyId === hinted) ||
    (memberships.length === 1 ? memberships[0] : null);
  if (!chosen) {
    return { ok: false, status: 400, error: 'Choose a company.' };
  }
  return {
    ok: true,
    member: { ...chosen, userId },
  };
}
