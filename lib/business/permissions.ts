/**
 * Company team roles & access control for My Business workspace.
 *
 * Access levels (ordered):
 *   none  — no access
 *   view  — read-only (see data, no mutations)
 *   write — create/update content
 *   admin — manage team, roles, critical settings
 */

export type TeamRole =
  | 'owner'
  | 'admin'
  | 'member'
  | 'viewer'
  | 'finance'
  | 'operations'
  | 'sales';

export type AccessLevel = 'none' | 'view' | 'write' | 'admin';

export type PermissionResource =
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
  | 'invites';

const ALL_RESOURCES: PermissionResource[] = [
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

/** Default matrix — can be overridden per-member via business_users.permissions jsonb later. */
export const ROLE_PERMISSIONS: Record<TeamRole, Record<PermissionResource, AccessLevel>> = {
  owner: fill('admin'),
  admin: {
    ...fill('write'),
    team: 'admin',
    invites: 'admin',
    settings: 'admin',
    verification: 'admin',
  },
  member: {
    overview: 'view',
    profile: 'write',
    team: 'view',
    settings: 'view',
    legal: 'write',
    documents: 'write',
    projects: 'write',
    riad: 'write',
    banking: 'view',
    verification: 'view',
    invites: 'none',
  },
  viewer: {
    ...fill('view'),
    invites: 'none',
    team: 'view',
    banking: 'view',
    verification: 'view',
  },
  finance: {
    overview: 'view',
    profile: 'view',
    team: 'view',
    settings: 'view',
    legal: 'view',
    documents: 'write',
    projects: 'view',
    riad: 'view',
    banking: 'write',
    verification: 'view',
    invites: 'none',
  },
  operations: {
    overview: 'view',
    profile: 'view',
    team: 'view',
    settings: 'view',
    legal: 'view',
    documents: 'write',
    projects: 'write',
    riad: 'write',
    banking: 'view',
    verification: 'view',
    invites: 'none',
  },
  sales: {
    overview: 'view',
    profile: 'view',
    team: 'view',
    settings: 'view',
    legal: 'view',
    documents: 'write',
    projects: 'view',
    riad: 'view',
    banking: 'none',
    verification: 'view',
    invites: 'none',
  },
};

export const TEAM_ROLE_OPTIONS: ReadonlyArray<{
  value: TeamRole;
  label: string;
  description: string;
  /** Short rights summary for UI */
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
    description: 'Standard collaborator — edit profile, docs, projects, and RIAD.',
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
    description: 'Banking and financial documents; view rest of workspace.',
    rights: 'Write banking · view rest',
  },
  {
    value: 'operations',
    label: 'Operations',
    description: 'Projects, documents, and RIAD operations.',
    rights: 'Write ops · view rest',
  },
  {
    value: 'sales',
    label: 'Sales',
    description: 'Documents and commercial visibility; no banking.',
    rights: 'Write docs · no banking',
  },
] as const;

export function normalizeTeamRole(role?: string | null): TeamRole {
  const r = String(role || 'member').toLowerCase().trim();
  // Canonical values
  if (r === 'owner') return 'owner';
  if (r === 'admin') return 'admin';
  if (r === 'member') return 'member';
  if (r === 'viewer' || r === 'view' || r === 'view_only' || r === 'readonly' || r === 'read_only') {
    return 'viewer';
  }
  if (r === 'finance' || r === 'cfo' || r === 'accountant') return 'finance';
  if (r === 'operations' || r === 'ops' || r === 'coo') return 'operations';
  if (r === 'sales' || r === 'commercial') return 'sales';

  // Legacy free-text titles (onboarding historically stored job titles as "role")
  if (
    /\b(owner|ceo|founder|co-founder|managing director|\bmd\b|proprietor|principal)\b/.test(r)
  ) {
    return 'owner';
  }
  if (/\b(admin|administrator|director|head of)\b/.test(r)) {
    return 'admin';
  }
  if (/\b(view only|read only|readonly|observer|guest)\b/.test(r)) {
    return 'viewer';
  }
  if (/\b(finance|cfo|accounts|accountant|bookkeep)\b/.test(r)) {
    return 'finance';
  }
  if (/\b(operations|ops|logistics|warehouse|production)\b/.test(r)) {
    return 'operations';
  }
  if (/\b(sales|bdm|business development|commercial)\b/.test(r)) {
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

/** True if role can manage team invites / change roles. */
export function canManageTeam(role?: string | null) {
  return canAdmin(role, 'team') || canAdmin(role, 'invites');
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
    overview: 'Overview',
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
  };
  return map[resource];
}

export { ALL_RESOURCES };
