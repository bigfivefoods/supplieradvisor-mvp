import {
  canAccess,
  resourceForPath,
  SIDEBAR_MODULE_RESOURCE,
  type AccessLevel,
} from '@/lib/business/permissions';

export const RECOVERY_RESOURCE = 'recovery' as const;
export const RECOVERY_TRUST_RESOURCE = 'recovery_trust' as const;
export const RECOVERGRAPH_MODULE_ID = 'recovergraph';

export function canRecovery(
  role: string | null | undefined,
  need: AccessLevel = 'view'
): boolean {
  return canAccess(role, RECOVERY_RESOURCE, need);
}

export function canRecoveryTrust(
  role: string | null | undefined,
  need: AccessLevel = 'view'
): boolean {
  return canAccess(role, RECOVERY_TRUST_RESOURCE, need);
}

export function recoveryResourceForPath(pathname: string | null | undefined) {
  return resourceForPath(pathname);
}

export function sidebarResourceForRecovergraph() {
  return SIDEBAR_MODULE_RESOURCE[RECOVERGRAPH_MODULE_ID];
}
