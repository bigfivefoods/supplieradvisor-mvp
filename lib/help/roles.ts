import {
  TEAM_ROLE_OPTIONS,
  canView,
  resourceLabel,
  type PermissionResource,
} from '@/lib/business/permissions';

/** Role labels that can open a module on the default matrix. */
export function viewRoleLabels(resource: PermissionResource): string[] {
  return TEAM_ROLE_OPTIONS.filter((option) => canView(option.value, resource)).map(
    (option) => option.label
  );
}

export function gateMessage(resource: PermissionResource): string {
  return `Your role (…) cannot access ${resourceLabel(resource)}.`;
}

export const WRITE_ACCOUNTING =
  'Your role (…) does not have write access to accounting. Contact an admin.';

export const PERIOD_LOCK_ROLES =
  'Your role (…) cannot perform this action. Allowed: owner, admin, finance.';
