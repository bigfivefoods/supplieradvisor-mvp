import { normalizeTeamRole, type TeamRole } from '@/lib/business/permissions';
import type { RecoverCapabilities, RecoverRole, StaffRole } from './types';

export type { RecoverRole };

export type StaffRoleInput = {
  role: StaffRole | string | null;
  status?: string | null;
} | null;

const ACTIVE_STAFF = new Set(['manager', 'collector', 'compliance', 'finance_view']);

function activeStaffRole(staffRow: StaffRoleInput): StaffRole | null {
  if (!staffRow) return null;
  if (staffRow.status && staffRow.status !== 'active') return null;
  const role = String(staffRow.role || '');
  return ACTIVE_STAFF.has(role) ? (role as StaffRole) : null;
}

/**
 * Company owner is always owner.
 * A sales role has no recovery permission, so it stays none.
 * An active module role on the staff row decides the desk.
 * Company admin with no staff row is a manager.
 * Company finance is finance. Member, viewer, and unassigned operations are viewers.
 */
export function resolveRecoverRole(
  companyRole: string | null | undefined,
  staffRow: StaffRoleInput
): RecoverRole {
  const company = normalizeTeamRole(companyRole);
  if (company === 'owner') return 'owner';
  if (company === 'sales' || company === 'sales_contractor') return 'none';

  const staff = activeStaffRole(staffRow);
  if (staff === 'collector') return 'agent';
  if (staff === 'finance_view') return 'finance';
  if (staff === 'compliance') return 'compliance';
  if (staff === 'manager') return 'manager';

  if (company === 'admin') return 'manager';
  if (company === 'finance') return 'finance';
  if (
    company === 'member' ||
    company === 'viewer' ||
    company === 'operations'
  ) {
    return 'viewer';
  }
  return 'none';
}

export function capabilitiesFor(role: RecoverRole): RecoverCapabilities {
  const closed: RecoverCapabilities = {
    canSeeAllQueues: false,
    canEditSettings: false,
    canSeeTrust: false,
    canManageStaff: false,
    canSetRealData: false,
  };
  if (role === 'owner') {
    return {
      canSeeAllQueues: true,
      canEditSettings: true,
      canSeeTrust: true,
      canManageStaff: true,
      canSetRealData: true,
    };
  }
  if (role === 'manager') {
    return {
      canSeeAllQueues: true,
      canEditSettings: true,
      canSeeTrust: true,
      canManageStaff: true,
      canSetRealData: false,
    };
  }
  if (role === 'finance') {
    return { ...closed, canSeeTrust: true };
  }
  return closed;
}

export function queueNavLabel(role: RecoverRole): string {
  if (role === 'owner' || role === 'manager') return 'All queues';
  if (role === 'agent') return 'My queue';
  return 'Queue';
}

export function recoverRoleLabel(role: RecoverRole): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'manager':
      return 'Manager';
    case 'agent':
      return 'Agent';
    case 'finance':
      return 'Finance';
    case 'compliance':
      return 'Compliance';
    case 'viewer':
      return 'Viewer';
    default:
      return 'No access';
  }
}

export function staffRoleLabel(role: StaffRole | string): string {
  switch (role) {
    case 'manager':
      return 'Manager';
    case 'collector':
      return 'Agent';
    case 'compliance':
      return 'Compliance';
    case 'finance_view':
      return 'Finance';
    default:
      return 'Staff';
  }
}

/** Setup and creditor pages are not part of an agent's queue. */
export function recoverSectionVisible(role: RecoverRole, section: string): boolean {
  if (role === 'none') return false;
  if (role === 'agent') return section === 'Overview' || section === 'Work';
  return true;
}

export function isCompanyOwner(role: string | null | undefined): boolean {
  return normalizeTeamRole(role) === 'owner';
}

export type { TeamRole };
