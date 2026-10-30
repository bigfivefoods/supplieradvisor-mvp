/** Owner and admin may change Netcash settings and submit billing runs. */

export const NETCASH_ADMIN_ROLES = ['owner', 'admin'] as const;

const RUN_ROLES = new Set<string>(NETCASH_ADMIN_ROLES);

export function canManageNetcash(role: string | null | undefined): boolean {
  return RUN_ROLES.has(String(role || '').trim().toLowerCase());
}
