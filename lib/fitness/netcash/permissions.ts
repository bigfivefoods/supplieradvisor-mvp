/** Owner and admin may change Netcash settings and submit billing runs. */

const RUN_ROLES = new Set(['owner', 'admin']);

export function canManageNetcash(role: string | null | undefined): boolean {
  return RUN_ROLES.has(String(role || '').trim().toLowerCase());
}
