/**
 * ConstructionAdvisor® staff action allow-list.
 * Uses the company role matrix. Do not invent a second permission table.
 */
import { ROLES_OPS_CRITICAL } from '@/lib/auth/api-auth';
import { canAccess, type TeamRole } from '@/lib/business/permissions';

export const CONSTRUCTION_OPS_ACTIONS = [
  'ensure_portal',
  'ensure_client_portal',
  'ensure_contractor_portal',
  'revoke_portal',
  'reissue_portal',
  'seed_demo',
] as const;

export type ConstructionOpsAction = (typeof CONSTRUCTION_OPS_ACTIONS)[number];

export type ConstructionStaffAction =
  | 'read'
  | 'merge'
  | 'replace'
  | ConstructionOpsAction;

const OPS = new Set<string>(CONSTRUCTION_OPS_ACTIONS);

export function normaliseConstructionAction(
  method: 'GET' | 'POST',
  action: string | undefined
): ConstructionStaffAction {
  if (method === 'GET') return 'read';
  const name = String(action || 'merge');
  if (name === 'replace') return 'replace';
  if (OPS.has(name)) return name as ConstructionOpsAction;
  return 'merge';
}

export function constructionStaffAllows(
  role: TeamRole,
  action: ConstructionStaffAction
): boolean {
  if (action === 'read') return canAccess(role, 'operations', 'view');
  if (action === 'merge') return canAccess(role, 'operations', 'write');
  if (action === 'replace') return role === 'owner' || role === 'admin';
  if (OPS.has(action)) return (ROLES_OPS_CRITICAL as readonly string[]).includes(role);
  return false;
}
