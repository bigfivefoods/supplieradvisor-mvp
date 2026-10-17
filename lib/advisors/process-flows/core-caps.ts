/**
 * View caps for core process flows. Pure. No network.
 * Link gates follow the page guard, except Sales, which follows the server allow-list.
 */
import {
  TEAM_ROLE_OPTIONS,
  canView,
  canWrite,
  type PermissionResource,
  type TeamRole,
} from '@/lib/business/permissions';
import type { CoreFlowModuleId } from './types';

export const CORE_CAP_KEYS = [
  'canViewSuppliers',
  'canViewCustomers',
  'canViewInventory',
  'canViewOperations',
  'canViewManufacturing',
  'canViewDistribution',
  'canViewAccounting',
  'canViewSheq',
  'canViewProjects',
  'canViewPeople',
  'canViewNetwork',
  'canUseSalesPortal',
] as const;

export type CoreCapKey = (typeof CORE_CAP_KEYS)[number];

export const CORE_CAP_RESOURCE: Record<CoreCapKey, PermissionResource> = {
  canViewSuppliers: 'suppliers',
  canViewCustomers: 'customers',
  canViewInventory: 'inventory',
  canViewOperations: 'operations',
  canViewManufacturing: 'manufacturing',
  canViewDistribution: 'distribution',
  canViewAccounting: 'accounting',
  canViewSheq: 'sheq',
  canViewProjects: 'projects',
  canViewPeople: 'people',
  canViewNetwork: 'network',
  canUseSalesPortal: 'sales_portal',
};

/** Same five ids as assertSalesPortalAccess. Not derived from canView. */
export const SALES_PORTAL_SERVER_ROLES = [
  'sales_contractor',
  'owner',
  'admin',
  'finance',
  'sales',
] as const satisfies readonly TeamRole[];

export const CORE_HREF_ROOT: Record<CoreFlowModuleId, string> = {
  home: '/dashboard',
  suppliers: '/dashboard/suppliers',
  customers: '/dashboard/customers',
  'sales-portal': '/sales',
};

export const CORE_MODULE_RESOURCE: Record<CoreFlowModuleId, PermissionResource> = {
  home: 'dashboard',
  suppliers: 'suppliers',
  customers: 'customers',
  'sales-portal': 'sales_portal',
};

const TEAM_IDS: readonly TeamRole[] = TEAM_ROLE_OPTIONS.map((option) => option.value);

export function isExactTeamRole(role: string | null | undefined): role is TeamRole {
  return typeof role === 'string' && (TEAM_IDS as readonly string[]).includes(role);
}

function blankCaps(): Record<CoreCapKey, boolean> {
  const caps = {} as Record<CoreCapKey, boolean>;
  for (const key of CORE_CAP_KEYS) caps[key] = false;
  return caps;
}

export function coreFlowCaps(role: string | null | undefined): Record<CoreCapKey, boolean> {
  const caps = blankCaps();
  if (!isExactTeamRole(role)) return caps;
  for (const key of CORE_CAP_KEYS) {
    if (key === 'canUseSalesPortal') {
      caps[key] = (SALES_PORTAL_SERVER_ROLES as readonly string[]).includes(role);
    } else {
      caps[key] = canView(role, CORE_CAP_RESOURCE[key]);
    }
  }
  return caps;
}

export function writeRolesForCap(key: CoreCapKey): TeamRole[] {
  if (key === 'canUseSalesPortal') return [...SALES_PORTAL_SERVER_ROLES];
  return TEAM_IDS.filter((role) => canWrite(role, CORE_CAP_RESOURCE[key]));
}

export function whoWrites(key: CoreCapKey): string {
  return writeRolesForCap(key)
    .map((role) => role.replaceAll('_', ' '))
    .join(', ');
}

export type CoreFlowMountInput = {
  role: string | null | undefined;
  loading: boolean;
  module: CoreFlowModuleId;
  fixture: boolean;
};

export type CoreFlowMountState = {
  mount: boolean;
  role: TeamRole | null;
  caps: Record<CoreCapKey, boolean>;
};

function canMountModule(role: TeamRole, module: CoreFlowModuleId): boolean {
  if (role === 'sales_contractor' && module !== 'sales-portal') return false;
  if (module === 'sales-portal') return coreFlowCaps(role).canUseSalesPortal;
  return canView(role, CORE_MODULE_RESOURCE[module]);
}

export function coreFlowMountState(input: CoreFlowMountInput): CoreFlowMountState {
  if (input.fixture) {
    const role: TeamRole = 'owner';
    return { mount: canMountModule(role, input.module), role, caps: coreFlowCaps(role) };
  }
  if (input.loading || !isExactTeamRole(input.role)) {
    return { mount: false, role: null, caps: coreFlowCaps(input.role) };
  }
  const caps = coreFlowCaps(input.role);
  if (!canMountModule(input.role, input.module)) {
    return { mount: false, role: input.role, caps };
  }
  return { mount: true, role: input.role, caps };
}

export function flowRoleDefs(module: CoreFlowModuleId): { id: string; label: string }[] {
  return TEAM_ROLE_OPTIONS.filter(
    (option) => coreFlowMountState({ role: option.value, loading: false, module, fixture: false }).mount
  ).map((option) => ({ id: option.value, label: option.value.replaceAll('_', ' ') }));
}
