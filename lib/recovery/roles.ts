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
 * A manager staff row only opens the manager desk when the company role can write recovery.
 * Member, viewer, and finance stay in the desk their company permission can actually use.
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
  if (staff === 'manager') {
    if (company === 'admin' || company === 'operations') return 'manager';
    if (company === 'finance') return 'finance';
    return 'viewer';
  }

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

const BOOK_CLOSED = {
  canEditBooks: false,
  canSeeContacts: false,
  canSeeAccountRows: false,
  canAddNote: false,
  canMutateAccounts: false,
  canRevealId: false,
  canImport: false,
  canClearDemo: false,
  canSeeCreditorDetail: false,
};

export function capabilitiesFor(role: RecoverRole): RecoverCapabilities {
  const closed: RecoverCapabilities = {
    canSeeAllQueues: false,
    canEditSettings: false,
    canSeeTrust: false,
    canManageStaff: false,
    canSetRealData: false,
    ...BOOK_CLOSED,
  };
  if (role === 'owner') {
    return {
      canSeeAllQueues: true,
      canEditSettings: true,
      canSeeTrust: true,
      canManageStaff: true,
      canSetRealData: true,
      canEditBooks: true,
      canSeeContacts: true,
      canSeeAccountRows: true,
      canAddNote: true,
      canMutateAccounts: true,
      canRevealId: true,
      canImport: true,
      canClearDemo: true,
      canSeeCreditorDetail: true,
    };
  }
  if (role === 'manager') {
    return {
      canSeeAllQueues: true,
      canEditSettings: true,
      canSeeTrust: true,
      canManageStaff: true,
      canSetRealData: false,
      canEditBooks: true,
      canSeeContacts: true,
      canSeeAccountRows: true,
      canAddNote: true,
      canMutateAccounts: true,
      canRevealId: true,
      canImport: true,
      canClearDemo: false,
      canSeeCreditorDetail: true,
    };
  }
  if (role === 'agent') {
    return {
      ...closed,
      canSeeContacts: true,
      canSeeAccountRows: true,
      canAddNote: true,
    };
  }
  if (role === 'finance' || role === 'compliance') {
    return {
      ...closed,
      canSeeTrust: role === 'finance',
      canSeeAccountRows: true,
      canSeeCreditorDetail: true,
    };
  }
  if (role === 'viewer') {
    return { ...closed, canSeeCreditorDetail: true };
  }
  return closed;
}

const OWNER_OPS = [
  'creditor.upsert',
  'creditor.archive',
  'mandate.upsert',
  'mandate.set_status',
  'debtor.upsert',
  'contact_point.upsert',
  'contact_point.remove',
  'account.create',
  'account.assign',
  'account.set_flag',
  'account.clear_flag',
  'account.add_note',
  'account.recall',
  'account.adjust',
  'debtor.merge',
  'account.reveal_id',
  'import.dry_run',
  'import.commit',
  'import.rollback',
  'import.load_demo',
  'import.clear_demo',
] as const;

export function allowedBookOps(role: RecoverRole): ReadonlySet<string> {
  if (role === 'owner') return new Set(OWNER_OPS);
  if (role === 'manager') return new Set(OWNER_OPS.filter((op) => op !== 'import.clear_demo'));
  if (role === 'agent') return new Set(['account.add_note']);
  return new Set();
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
