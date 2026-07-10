import {
  assertCompanyPermission,
  type MembershipFail,
  type MembershipOk,
} from '@/lib/business/access';
import type { AccessLevel } from '@/lib/business/permissions';

/**
 * Membership + Accounting module access (view / write).
 * Use on all accounting API routes.
 */
export async function assertAccountingAccess(
  privyUserId: string | null | undefined,
  companyId: number,
  need: AccessLevel = 'view'
): Promise<MembershipOk | MembershipFail> {
  return assertCompanyPermission(privyUserId, companyId, 'accounting', need);
}
