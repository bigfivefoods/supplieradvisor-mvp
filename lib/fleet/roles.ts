/**
 * FleetAdvisor® roles derived from the company permission matrix.
 * Do not edit permissions.ts and do not keep a parallel company-role list.
 */
import { canAccess, normalizeTeamRole, TEAM_ROLE_OPTIONS, type TeamRole } from '../business/permissions';
import type { FleetBook, FleetOpName, FleetRole } from './types';
import { FLEET_OPS } from './types';

export type FleetCapabilities = {
  role: FleetRole;
  seesRates: boolean;
  seesCosts: boolean;
  seesDriverPay: boolean;
  canEditRegister: boolean;
  canArchive: boolean;
  canEditSettings: boolean;
  canOwnerSwitches: boolean;
  canConfirmRealData: boolean;
  canManageReminders: boolean;
  canImportShip: boolean;
  canImportCsv: boolean;
  canExportCompliance: boolean;
  canManageTrailers: boolean;
  readOnly: boolean;
};

const WRITE_OPS: FleetOpName[] = [
  'vehicle.upsert',
  'vehicle.set_status',
  'driver.upsert',
  'compliance.upsert',
  'compliance.renew',
  'compliance.bulk_upsert',
  'trailer.link',
  'trailer.unlink',
  'job.upsert',
  'odometer.add',
];

/**
 * owner → owner.
 * admin → manager (before the dispatcher rule: admin can write operations and cannot view accounting).
 * no operations view → none.
 * operations write and no accounting view → dispatcher.
 * operations view and accounting write → office.
 * any other operations view → viewer.
 * Unknown, empty, or missing company roles are none. They do not write.
 */
export function resolveFleetRole(companyRole: string | null | undefined): FleetRole {
  const raw = String(companyRole ?? '').trim().toLowerCase();
  if (!raw || !TEAM_ROLE_OPTIONS.some((option) => option.value === raw)) return 'none';
  const role: TeamRole = normalizeTeamRole(companyRole);
  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'manager';
  if (!canAccess(role, 'operations', 'view')) return 'none';
  if (canAccess(role, 'operations', 'write') && !canAccess(role, 'accounting', 'view')) return 'dispatcher';
  if (canAccess(role, 'accounting', 'write')) return 'office';
  return 'viewer';
}

export function capabilitiesFor(
  role: FleetRole,
  flags: { dispatcherSeesRates?: boolean } = {}
): FleetCapabilities {
  const seesRates =
    role === 'owner' ||
    role === 'manager' ||
    role === 'office' ||
    role === 'viewer' ||
    (role === 'dispatcher' && flags.dispatcherSeesRates === true);
  const seesCosts = role === 'owner' || role === 'manager' || role === 'office';
  const seesDriverPay = role === 'owner' || role === 'manager';
  const canEditRegister = role === 'owner' || role === 'manager' || role === 'dispatcher';
  return {
    role,
    seesRates,
    seesCosts,
    seesDriverPay,
    canEditRegister,
    canArchive: role === 'owner' || role === 'manager',
    canEditSettings: role === 'owner' || role === 'manager',
    canOwnerSwitches: role === 'owner',
    canConfirmRealData: role === 'owner',
    canManageReminders: role === 'owner' || role === 'manager',
    canImportShip: role === 'owner',
    canImportCsv: role === 'owner' || role === 'manager',
    canExportCompliance: role === 'owner' || role === 'manager' || role === 'office',
    canManageTrailers: role === 'owner' || role === 'manager' || role === 'dispatcher',
    readOnly: role === 'office' || role === 'viewer' || role === 'none',
  };
}

export function allowedOpsForRole(role: FleetRole): FleetOpName[] {
  if (role === 'owner') return [...FLEET_OPS];
  if (role === 'manager') return FLEET_OPS.filter((op) => op !== 'real_data.confirm');
  if (role === 'dispatcher') return [...WRITE_OPS];
  return [];
}

const COST_KEYS = ['cost_profiles', 'cost_entries', 'overhead_pools', 'cpk_targets', 'cpk'] as const;

function stripKeys(value: unknown, keys: Set<string>): unknown {
  if (Array.isArray(value)) return value.map((item) => stripKeys(item, keys));
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (keys.has(key)) continue;
    out[key] = stripKeys(child, keys);
  }
  return out;
}

function stripDriverPay(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => stripDriverPay(item));
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const standing = 'finance' in record && 'insurance' in record && 'tracker' in record && 'driver' in record;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    if (key === 'driver_cost_monthly_cents') continue;
    if (standing && key === 'driver') continue;
    out[key] = stripDriverPay(child);
  }
  return out;
}

export function viewForRole<T extends FleetBook & { cpk?: unknown }>(
  book: T,
  role: FleetRole,
  flags: { dispatcherSeesRates?: boolean } = {}
): Record<string, unknown> {
  const caps = capabilitiesFor(role, flags);
  if (role === 'none') {
    return {
      workspace: {
        display_name: book.workspace.display_name,
        real_data_enabled: book.workspace.real_data_enabled,
        depot_label: book.workspace.depot_label,
      },
    };
  }
  let view = stripKeys(book, new Set()) as Record<string, unknown>;
  if (!caps.seesRates) view = stripKeys(view, new Set(['price_cents'])) as Record<string, unknown>;
  if (!caps.seesCosts) {
    for (const key of COST_KEYS) delete view[key];
  }
  if (!caps.seesDriverPay) view = stripDriverPay(view) as Record<string, unknown>;
  if (!caps.canManageReminders) {
    view = stripKeys(view, new Set(['recipient_member_ids', 'reminder_log'])) as Record<string, unknown>;
    delete view.members;
    if (Array.isArray(view.import_runs)) {
      view.import_runs = (view.import_runs as Array<Record<string, unknown>>).map((run) => {
        const copy = { ...run };
        delete copy.created_by;
        return copy;
      });
    }
  }
  return view;
}
