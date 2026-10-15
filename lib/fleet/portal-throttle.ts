/**
 * FleetAdvisor® throttle classifier. The durable counter lives in Postgres.
 * This helper fails closed and is the shape the route will call later.
 * Do not import it across modules.
 */

export function throttleDecision(input: {
  companyId: number | null | undefined;
  scope: string | null | undefined;
  keyHash: string | null | undefined;
  emailOrInviteCount: number | null | undefined;
  workspaceCount: number | null | undefined;
}): boolean {
  if (input.companyId == null || !Number.isFinite(input.companyId) || input.companyId <= 0) return true;
  if (typeof input.scope !== 'string' || input.scope.trim() === '') return true;
  if (!['email', 'invite', 'ip'].includes(input.scope)) return true;
  if (typeof input.keyHash !== 'string' || input.keyHash.trim() === '') return true;
  if (input.emailOrInviteCount == null || input.workspaceCount == null) return true;
  if (!Number.isFinite(input.emailOrInviteCount) || !Number.isFinite(input.workspaceCount)) return true;
  if (input.emailOrInviteCount < 0 || input.workspaceCount < 0) return true;
  if (input.workspaceCount > 50) return true;
  if (input.emailOrInviteCount > 10) return true;
  return false;
}
