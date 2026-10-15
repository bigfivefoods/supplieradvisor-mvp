/**
 * ConstructionAdvisor® roles. Derived from the company permission matrix.
 * Do not add a parallel role list and do not edit permissions.ts.
 */
import { canAccess, normalizeTeamRole, type TeamRole } from '../business/permissions';
import type { ConstructiongraphStore } from './constructiongraph';

export type ConstructionRole = 'owner' | 'site_manager' | 'office' | 'viewer' | 'none';

export type ConstructionCapabilities = {
  role: ConstructionRole;
  canSeeMoney: boolean;
  canSeeCostsAndBoq: boolean;
  canSeeMargin: boolean;
  canEditProjects: boolean;
  canEditProgramme: boolean;
  canWriteDiary: boolean;
  canWriteSafety: boolean;
  canApproveVariations: boolean;
  canCertify: boolean;
  canManagePortals: boolean;
  canSeeAllProjects: boolean;
  canRaiseVariation: boolean;
  canEditProjectNotes: boolean;
};

export const CONSTRUCTION_COLLECTIONS = [
  'clients',
  'sites',
  'quotes',
  'drawings',
  'boq',
  'costs',
  'subcontractors',
  'materials',
  'plant',
  'programme',
  'safety',
  'variations',
  'certificates',
  'payments',
  'snags',
  'portals',
  'settings',
  'diary',
] as const;

export type ConstructionCollection = (typeof CONSTRUCTION_COLLECTIONS)[number];

const NONE_CAPS: Omit<ConstructionCapabilities, 'role'> = {
  canSeeMoney: false,
  canSeeCostsAndBoq: false,
  canSeeMargin: false,
  canEditProjects: false,
  canEditProgramme: false,
  canWriteDiary: false,
  canWriteSafety: false,
  canApproveVariations: false,
  canCertify: false,
  canManagePortals: false,
  canSeeAllProjects: false,
  canRaiseVariation: false,
  canEditProjectNotes: false,
};

/**
 * owner / admin → owner.
 * No operations access → none.
 * Operations write and no accounting view → site_manager.
 * Operations view (or better) and accounting write → office.
 * Any other role with operations view → viewer.
 */
export function resolveConstructionRole(
  companyRole: string | null | undefined
): ConstructionRole {
  const role = normalizeTeamRole(companyRole);
  if (role === 'owner' || role === 'admin') return 'owner';
  if (!canAccess(role, 'operations', 'view')) return 'none';
  const opsWrite = canAccess(role, 'operations', 'write');
  const accountingView = canAccess(role, 'accounting', 'view');
  const accountingWrite = canAccess(role, 'accounting', 'write');
  if (opsWrite && !accountingView) return 'site_manager';
  if (accountingWrite) return 'office';
  return 'viewer';
}

export function capabilitiesFor(role: ConstructionRole): ConstructionCapabilities {
  if (role === 'owner') {
    return {
      role,
      canSeeMoney: true,
      canSeeCostsAndBoq: true,
      canSeeMargin: true,
      canEditProjects: true,
      canEditProgramme: true,
      canWriteDiary: true,
      canWriteSafety: true,
      canApproveVariations: true,
      canCertify: true,
      canManagePortals: true,
      canSeeAllProjects: true,
      canRaiseVariation: true,
      canEditProjectNotes: true,
    };
  }
  if (role === 'site_manager') {
    return {
      role,
      canSeeMoney: false,
      canSeeCostsAndBoq: false,
      canSeeMargin: false,
      canEditProjects: false,
      canEditProgramme: true,
      canWriteDiary: true,
      canWriteSafety: true,
      canApproveVariations: false,
      canCertify: false,
      canManagePortals: false,
      canSeeAllProjects: true,
      canRaiseVariation: true,
      canEditProjectNotes: true,
    };
  }
  if (role === 'office') {
    return {
      role,
      canSeeMoney: true,
      canSeeCostsAndBoq: true,
      canSeeMargin: true,
      canEditProjects: false,
      canEditProgramme: false,
      canWriteDiary: false,
      canWriteSafety: false,
      canApproveVariations: true,
      canCertify: true,
      canManagePortals: false,
      canSeeAllProjects: true,
      canRaiseVariation: false,
      canEditProjectNotes: false,
    };
  }
  if (role === 'viewer') {
    return {
      role,
      canSeeMoney: true,
      canSeeCostsAndBoq: false,
      canSeeMargin: false,
      canEditProjects: false,
      canEditProgramme: false,
      canWriteDiary: false,
      canWriteSafety: false,
      canApproveVariations: false,
      canCertify: false,
      canManagePortals: false,
      canSeeAllProjects: true,
      canRaiseVariation: false,
      canEditProjectNotes: false,
    };
  }
  return { role: 'none', ...NONE_CAPS };
}

export function capabilitiesForCompanyRole(
  companyRole: string | null | undefined
): ConstructionCapabilities {
  return capabilitiesFor(resolveConstructionRole(companyRole));
}

const SITE_MANAGER_COLLECTIONS = new Set<ConstructionCollection>([
  'programme',
  'diary',
  'safety',
  'snags',
  'variations',
  'drawings',
  'materials',
  'plant',
  'sites',
]);

const OFFICE_COLLECTIONS = new Set<ConstructionCollection>([
  'payments',
  'certificates',
  'variations',
]);

export function allowedCollectionsForRole(role: ConstructionRole): ConstructionCollection[] {
  if (role === 'owner') return [...CONSTRUCTION_COLLECTIONS];
  if (role === 'site_manager') return [...SITE_MANAGER_COLLECTIONS];
  if (role === 'office') return [...OFFICE_COLLECTIONS];
  return [];
}

const PRICE_KEYS = new Set(['amount', 'rate', 'actual_amount', 'contract_value', 'total']);

function variationHasPrice(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (row.amount != null || row.rate != null) return true;
  if (!Array.isArray(row.lines)) return false;
  return row.lines.some((line) => {
    if (!line || typeof line !== 'object') return false;
    const rec = line as Record<string, unknown>;
    return rec.amount != null || rec.rate != null;
  });
}

function sitePatchIsNotesOnly(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false;
  const allowed = new Set(['id', 'status', 'notes', 'sample']);
  return Object.keys(row as Record<string, unknown>).every((key) => allowed.has(key));
}

export function guardRoleMerge(
  role: ConstructionRole,
  incoming: unknown
): { ok: true } | { ok: false; status: 403; error: string } {
  if (role === 'owner') return { ok: true };
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return { ok: true };
  }
  const allowed = new Set(allowedCollectionsForRole(role));
  const body = incoming as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (key === 'updated_at') continue;
    if (!allowed.has(key as ConstructionCollection)) {
      return {
        ok: false,
        status: 403,
        error: 'Not available for your role',
      };
    }
  }
  if (role === 'site_manager') {
    if (Array.isArray(body.variations) && body.variations.some(variationHasPrice)) {
      return { ok: false, status: 403, error: 'Not available for your role' };
    }
    if (Array.isArray(body.subcontractors)) {
      const priced = body.subcontractors.some((row) => {
        if (!row || typeof row !== 'object') return false;
        return (row as { contract_value?: unknown }).contract_value != null;
      });
      if (priced) return { ok: false, status: 403, error: 'Not available for your role' };
    }
    if (Array.isArray(body.sites) && body.sites.some((row) => !sitePatchIsNotesOnly(row))) {
      return { ok: false, status: 403, error: 'Not available for your role' };
    }
  }
  if (role === 'office' && Array.isArray(body.variations)) {
    return { ok: true };
  }
  return { ok: true };
}

function omit<T extends Record<string, unknown>>(row: T, keys: string[]): T {
  const next = { ...row };
  for (const key of keys) delete next[key];
  return next;
}

function stripVariationPrices(row: Record<string, unknown>): Record<string, unknown> {
  const next = omit(row, ['amount', 'rate']);
  if (Array.isArray(row.lines)) {
    next.lines = (row.lines as Record<string, unknown>[]).map((line) =>
      line && typeof line === 'object' ? omit(line, ['amount', 'rate']) : line
    );
  }
  return next;
}

/**
 * site_manager and viewer responses omit money keys entirely.
 * owner is the same store. office keeps the book (read/approve on the desk).
 */
export function storeForRole(
  store: ConstructiongraphStore,
  role: ConstructionRole
): ConstructiongraphStore {
  if (role === 'owner' || role === 'office') return store;
  const next = structuredClone(store) as unknown as Record<string, unknown>;
  delete next.costs;
  delete next.payments;
  delete next.certificates;
  const list = (value: unknown) => (Array.isArray(value) ? value : []);
  next.boq = list(next.boq).map((row) =>
    omit(row as Record<string, unknown>, ['rate', 'amount', 'actual_amount'])
  );
  next.sites = list(next.sites).map((row) =>
    omit(row as Record<string, unknown>, ['contract_value'])
  );
  next.subcontractors = list(next.subcontractors).map((row) =>
    omit(row as Record<string, unknown>, ['contract_value'])
  );
  next.quotes = list(next.quotes).map((row) =>
    omit(row as Record<string, unknown>, ['total'])
  );
  if (role === 'site_manager' || role === 'none') {
    next.variations = list(next.variations).map((row) =>
      stripVariationPrices(row as Record<string, unknown>)
    );
  }
  for (const key of Object.keys(next)) {
    if (PRICE_KEYS.has(key)) delete next[key];
  }
  return next as unknown as ConstructiongraphStore;
}

const RESPONSE_MONEY_KEYS = new Set([
  'costs',
  'payments',
  'certificates',
  'contract_value',
  'contractValue',
  'rate',
  'amount',
  'actual_amount',
  'budget',
  'variance',
  'boqPlanned',
  'boqActual',
  'boqLines',
  'boqAmount',
  'plannedBillings',
  'claimedBillings',
  'paidBillings',
  'outstandingBillings',
  'certified',
  'retention',
  'planned_amount',
  'claimed_amount',
  'certified_amount',
  'paid_amount',
  'publicToken',
  'public_token',
  'token',
  'token_hash',
]);

/** Drop money keys from a staff JSON body for site managers and viewers. */
export function redactRolePayload(value: unknown, role: ConstructionRole): unknown {
  if (role !== 'site_manager' && role !== 'viewer') return value;
  if (Array.isArray(value)) return value.map((item) => redactRolePayload(item, role));
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (RESPONSE_MONEY_KEYS.has(key)) continue;
    out[key] = redactRolePayload(child, role);
  }
  return out;
}

export function roleMatrix(): Record<TeamRole, ConstructionCapabilities> {
  const roles: TeamRole[] = [
    'owner',
    'admin',
    'member',
    'viewer',
    'finance',
    'operations',
    'sales',
    'sales_contractor',
  ];
  const out = {} as Record<TeamRole, ConstructionCapabilities>;
  for (const role of roles) out[role] = capabilitiesForCompanyRole(role);
  return out;
}
