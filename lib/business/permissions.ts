/**
 * Company team roles & module access control.
 *
 * Access levels (ordered):
 *   none  — no access
 *   view  — read-only
 *   write — create/update
 *   admin — manage team / critical settings
 */

export type TeamRole =
  | 'owner'
  | 'admin'
  | 'member'
  | 'viewer'
  | 'finance'
  | 'operations'
  | 'sales'
  /** Independent sales contractors — Customers module only (R/W), no full ERP. */
  | 'sales_contractor';

export type AccessLevel = 'none' | 'view' | 'write' | 'admin';

/** Workspace areas + full dashboard modules */
export type PermissionResource =
  | 'dashboard'
  | 'overview'
  | 'profile'
  | 'team'
  | 'settings'
  | 'legal'
  | 'documents'
  | 'projects'
  | 'riad'
  | 'banking'
  | 'verification'
  | 'invites'
  | 'customers'
  | 'suppliers'
  | 'containers'
  | 'network'
  | 'inventory'
  | 'operations'
  | 'manufacturing'
  | 'distribution'
  | 'accounting'
  | 'intelligence'
  | 'buyer'
  /** Independent sales contractor portal (/sales) */
  | 'sales_portal';

const ALL_RESOURCES: PermissionResource[] = [
  'dashboard',
  'overview',
  'profile',
  'team',
  'settings',
  'legal',
  'documents',
  'projects',
  'riad',
  'banking',
  'verification',
  'invites',
  'customers',
  'suppliers',
  'containers',
  'network',
  'inventory',
  'operations',
  'manufacturing',
  'distribution',
  'accounting',
  'intelligence',
  'buyer',
  'sales_portal',
];

const LEVEL_RANK: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  write: 2,
  admin: 3,
};

function fill(level: AccessLevel): Record<PermissionResource, AccessLevel> {
  const out = {} as Record<PermissionResource, AccessLevel>;
  for (const r of ALL_RESOURCES) out[r] = level;
  return out;
}

function fullAccess(level: AccessLevel): Record<PermissionResource, AccessLevel> {
  return fill(level);
}

/** Default matrix — can be overridden later via business_users.permissions jsonb. */
export const ROLE_PERMISSIONS: Record<TeamRole, Record<PermissionResource, AccessLevel>> = {
  owner: fullAccess('admin'),
  admin: {
    ...fullAccess('write'),
    team: 'admin',
    invites: 'admin',
    settings: 'admin',
    verification: 'admin',
  },
  member: {
    ...fullAccess('write'),
    team: 'view',
    settings: 'view',
    banking: 'view',
    verification: 'view',
    invites: 'none',
    accounting: 'view',
  },
  viewer: {
    ...fullAccess('view'),
    invites: 'none',
    banking: 'view',
    verification: 'view',
  },
  finance: {
    ...fullAccess('view'),
    documents: 'write',
    banking: 'write',
    accounting: 'write',
    customers: 'write',
    sales_portal: 'admin',
    invites: 'none',
  },
  operations: {
    ...fullAccess('view'),
    documents: 'write',
    projects: 'write',
    riad: 'write',
    inventory: 'write',
    operations: 'write',
    containers: 'write',
    manufacturing: 'write',
    distribution: 'write',
    invites: 'none',
  },
  sales: {
    ...fullAccess('view'),
    customers: 'write',
    sales_portal: 'write',
    documents: 'write',
    network: 'view',
    banking: 'none',
    accounting: 'none',
    invites: 'none',
  },
  /**
   * Independent sales contractors selling on behalf of the company:
   * Sales portal + Customers module R/W — no My Business, Suppliers, Containers, etc.
   */
  sales_contractor: {
    ...fill('none'),
    customers: 'write',
    sales_portal: 'write',
    dashboard: 'none',
    buyer: 'none',
  },
};

export const TEAM_ROLE_OPTIONS: ReadonlyArray<{
  value: TeamRole;
  label: string;
  description: string;
  rights: string;
}> = [
  {
    value: 'owner',
    label: 'Owner',
    description: 'Full control including ownership transfer and billing-critical actions.',
    rights: 'Admin on everything',
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Manage team, settings, verification, and edit all company content.',
    rights: 'Write + manage team',
  },
  {
    value: 'member',
    label: 'Member',
    description: 'Standard collaborator across the workspace.',
    rights: 'Write content · view team',
  },
  {
    value: 'viewer',
    label: 'View only',
    description: 'Read-only access. Cannot invite, edit, or change settings.',
    rights: 'View only',
  },
  {
    value: 'finance',
    label: 'Finance',
    description: 'Banking, accounting, and financial documents.',
    rights: 'Write finance · view rest',
  },
  {
    value: 'operations',
    label: 'Operations',
    description: 'Inventory, containers, production, and logistics.',
    rights: 'Write ops · view rest',
  },
  {
    value: 'sales',
    label: 'Sales',
    description: 'Customers plus broader commercial visibility across the workspace.',
    rights: 'Write customers · view rest',
  },
  {
    value: 'sales_contractor',
    label: 'Sales contractor',
    description:
      'Independent sales contractors on your customer sales team. Portal with agreement, R199/mo 6-month sub, commission 3%–5% on deals. Customers CRM R/W — no full ERP.',
    rights: 'Sales portal + Customers R/W',
  },
] as const;

export function normalizeTeamRole(role?: string | null): TeamRole {
  const r = String(role || 'member').toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (r === 'owner') return 'owner';
  if (r === 'admin') return 'admin';
  if (r === 'member') return 'member';
  if (r === 'viewer' || r === 'view' || r === 'view_only' || r === 'readonly' || r === 'read_only') {
    return 'viewer';
  }
  if (r === 'finance' || r === 'cfo' || r === 'accountant') return 'finance';
  if (r === 'operations' || r === 'ops' || r === 'coo') return 'operations';
  if (
    r === 'sales_contractor' ||
    r === 'salescontractor' ||
    r === 'customer_sales' ||
    r === 'independent_sales' ||
    r === 'field_sales'
  ) {
    return 'sales_contractor';
  }
  if (r === 'sales' || r === 'commercial') return 'sales';

  const raw = String(role || '').toLowerCase();
  if (
    /\b(sales\s*contractor|independent\s*sales|field\s*sales|customer\s*rep)\b/.test(raw)
  ) {
    return 'sales_contractor';
  }
  if (
    /\b(owner|ceo|founder|co-founder|managing director|\bmd\b|proprietor|principal)\b/.test(raw)
  ) {
    return 'owner';
  }
  if (/\b(admin|administrator|director|head of)\b/.test(raw)) {
    return 'admin';
  }
  if (/\b(view only|read only|readonly|observer|guest)\b/.test(raw)) {
    return 'viewer';
  }
  if (/\b(finance|cfo|accounts|accountant|bookkeep)\b/.test(raw)) {
    return 'finance';
  }
  if (/\b(operations|ops|logistics|warehouse|production)\b/.test(raw)) {
    return 'operations';
  }
  if (/\b(sales|bdm|business development|commercial)\b/.test(raw)) {
    return 'sales';
  }
  return 'member';
}

export function getRolePermissions(
  role?: string | null
): Record<PermissionResource, AccessLevel> {
  return ROLE_PERMISSIONS[normalizeTeamRole(role)];
}

export function canAccess(
  role: string | null | undefined,
  resource: PermissionResource,
  need: AccessLevel = 'view'
): boolean {
  if (need === 'none') return true;
  const level = getRolePermissions(role)[resource] || 'none';
  return LEVEL_RANK[level] >= LEVEL_RANK[need];
}

export function canView(role: string | null | undefined, resource: PermissionResource) {
  return canAccess(role, resource, 'view');
}

export function canWrite(role: string | null | undefined, resource: PermissionResource) {
  return canAccess(role, resource, 'write');
}

export function canAdmin(role: string | null | undefined, resource: PermissionResource) {
  return canAccess(role, resource, 'admin');
}

export function canManageTeam(role?: string | null) {
  return canAdmin(role, 'team') || canAdmin(role, 'invites');
}

/** Sidebar module id → permission resource */
export const SIDEBAR_MODULE_RESOURCE: Record<string, PermissionResource> = {
  home: 'dashboard',
  'my-business': 'profile',
  network: 'network',
  suppliers: 'suppliers',
  customers: 'customers',
  'sales-portal': 'sales_portal',
  containers: 'containers',
  inventory: 'inventory',
  operations: 'operations',
  manufacturing: 'manufacturing',
  distribution: 'distribution',
  accounting: 'accounting',
  intelligence: 'intelligence',
};

/**
 * Map a dashboard path to the permission resource that guards it.
 */
export function resourceForPath(pathname: string | null | undefined): PermissionResource | null {
  if (!pathname) return null;
  if (pathname.startsWith('/sales')) return 'sales_portal';
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'dashboard';
  if (pathname.startsWith('/dashboard/select-company')) return null; // always allowed
  if (pathname.startsWith('/dashboard/my-business')) {
    if (pathname.includes('/team')) return 'team';
    if (pathname.includes('/settings')) return 'settings';
    if (pathname.includes('/legal')) return 'legal';
    if (pathname.includes('/documents')) return 'documents';
    if (pathname.includes('/projects')) return 'projects';
    if (pathname.includes('/riad')) return 'riad';
    if (pathname.includes('/profile')) return 'profile';
    return 'overview';
  }
  if (pathname.startsWith('/dashboard/customers') || pathname.startsWith('/dashboard/buyer')) {
    return 'customers';
  }
  if (pathname.startsWith('/dashboard/suppliers')) return 'suppliers';
  if (pathname.startsWith('/dashboard/containers')) return 'containers';
  if (pathname.startsWith('/dashboard/connections') || pathname.startsWith('/dashboard/network')) {
    return 'network';
  }
  if (pathname.startsWith('/dashboard/inventory')) return 'inventory';
  if (pathname.startsWith('/dashboard/operations')) return 'operations';
  if (pathname.startsWith('/dashboard/manufacturing')) return 'manufacturing';
  if (pathname.startsWith('/dashboard/distribution')) return 'distribution';
  if (pathname.startsWith('/dashboard/accounting') || pathname.startsWith('/dashboard/finance')) {
    return 'accounting';
  }
  if (pathname.startsWith('/dashboard/intelligence')) return 'intelligence';
  if (pathname.startsWith('/dashboard/invite-business')) return 'network';
  return 'dashboard';
}

export function canAccessPath(
  role: string | null | undefined,
  pathname: string | null | undefined,
  need: AccessLevel = 'view'
): boolean {
  const resource = resourceForPath(pathname);
  if (!resource) return true;
  return canAccess(role, resource, need);
}

/** Landing path after login / when denied another module */
export function defaultHomePathForRole(role?: string | null): string {
  const r = normalizeTeamRole(role);
  if (r === 'sales_contractor') return '/sales';
  if (r === 'finance') return '/dashboard/accounting';
  if (r === 'operations') return '/dashboard/operations';
  return '/dashboard';
}

export function accessLabel(level: AccessLevel): string {
  switch (level) {
    case 'admin':
      return 'Admin';
    case 'write':
      return 'Read / write';
    case 'view':
      return 'View only';
    default:
      return 'No access';
  }
}

export function resourceLabel(resource: PermissionResource): string {
  const map: Record<PermissionResource, string> = {
    dashboard: 'Dashboard',
    overview: 'My Business overview',
    profile: 'Profile',
    team: 'Team',
    settings: 'Settings',
    legal: 'Legal',
    documents: 'Documents',
    projects: 'Projects',
    riad: 'RIAD',
    banking: 'Banking',
    verification: 'Verification',
    invites: 'Invites',
    customers: 'Customers',
    suppliers: 'Suppliers',
    containers: 'Containers',
    network: 'Network',
    inventory: 'Inventory',
    operations: 'Operations',
    manufacturing: 'Manufacturing',
    distribution: 'Distribution',
    accounting: 'Accounting',
    intelligence: 'Intelligence',
    buyer: 'Buyer portal',
    sales_portal: 'Sales contractor portal',
  };
  return map[resource];
}

export { ALL_RESOURCES };
