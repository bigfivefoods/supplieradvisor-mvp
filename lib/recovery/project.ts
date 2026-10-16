import { capabilitiesFor } from './roles';
import type {
  RecoverBookStats,
  RecoverCreditor,
  RecoverDeskPayload,
  RecoverMandate,
  RecoverRole,
  RecoverStaff,
  RecoverWorkspace,
} from './types';

export type RecoverLoad = {
  ready: boolean;
  reason?: 'migration_pending';
  workspace: RecoverWorkspace | null;
  creditors: RecoverCreditor[];
  mandates: RecoverMandate[];
  staff: RecoverStaff[];
  self: RecoverStaff | null;
  book?: RecoverBookStats | null;
};

/**
 * Book figures each role may receive.
 * Owner and manager receive every field.
 * Finance and compliance keep the balance, because the command page already
 * prints it for them. They also receive the count fields.
 * Viewer keeps placed, imported, and the balance (the placed card already
 * prints it) and zeros assigned and unassigned, matching the previous
 * projection. Arrangement, paid, recalled, and closed are omitted.
 * Agent receives only their own assignedCount, plus imported. Balance is 0
 * and is not a workspace total. placedCount is that same assigned count so
 * older cards cannot show the whole book.
 */
export function projectBookStats(
  role: RecoverRole,
  stats: RecoverBookStats | null | undefined
): RecoverBookStats | null {
  if (!stats || role === 'none') return null;
  if (role === 'owner' || role === 'manager') return { ...stats };
  if (role === 'finance' || role === 'compliance') {
    return {
      placedCount: stats.placedCount,
      placedBalanceCents: stats.placedBalanceCents,
      assignedCount: stats.assignedCount,
      unassignedCount: stats.unassignedCount,
      imported: stats.imported,
      arrangementCount: stats.arrangementCount,
      paidCount: stats.paidCount,
      recalledCount: stats.recalledCount,
      closedCount: stats.closedCount,
    };
  }
  if (role === 'viewer') {
    return {
      placedCount: stats.placedCount,
      placedBalanceCents: stats.placedBalanceCents,
      assignedCount: 0,
      unassignedCount: 0,
      imported: stats.imported,
    };
  }
  if (role === 'agent') {
    return {
      placedCount: stats.assignedCount,
      placedBalanceCents: 0,
      assignedCount: stats.assignedCount,
      unassignedCount: 0,
      imported: stats.imported,
    };
  }
  return null;
}

function publicWorkspace(workspace: RecoverWorkspace | null, role: RecoverRole): RecoverWorkspace | null {
  if (!workspace) return null;
  if (role !== 'agent') return workspace;
  return {
    id: workspace.id,
    company_id: workspace.company_id,
    display_name: workspace.display_name,
    operator_type: workspace.operator_type,
    programme_types: ['recovery'],
    cfdc_registration_no: '',
    cfdc_expiry: null,
    vat_registered: false,
    vat_rate_bps: null,
    real_data_enabled: workspace.real_data_enabled,
    real_data_confirmed_by: null,
    real_data_confirmed_at: null,
    trust_mode: workspace.trust_mode,
  };
}

/**
 * API projection. Agents receive their own row only, no colleague list,
 * no creditor or mandate rows, and no trust configuration.
 */
export function projectDesk(role: RecoverRole, load: RecoverLoad): RecoverDeskPayload {
  const capabilities = capabilitiesFor(role);
  const agent = role === 'agent';
  return {
    ready: load.ready,
    reason: load.reason,
    workspace: publicWorkspace(load.workspace, role),
    role,
    capabilities,
    counts: agent
      ? { creditors: null, mandates: null, staff: null }
      : {
          creditors: load.creditors.length,
          mandates: load.mandates.length,
          staff: load.staff.length,
        },
    creditors: agent || role === 'none' ? [] : load.creditors,
    mandates: agent || role === 'none' ? [] : load.mandates,
    staff: agent || role === 'none' ? [] : load.staff,
    self: load.self,
    book: projectBookStats(role, load.book),
  };
}

/**
 * Drops trust configuration unless the caller may see recovery_trust.
 * Pass the company-role check. Desk capabilities alone are not enough:
 * an operations user with a manager staff row must still not receive trust_mode.
 */
export function deskResponseBody(
  payload: RecoverDeskPayload,
  canSeeTrust = payload.capabilities.canSeeTrust
): RecoverDeskPayload {
  if (canSeeTrust || !payload.workspace) return payload;
  const workspace = { ...payload.workspace };
  delete (workspace as Partial<typeof workspace>).trust_mode;
  return { ...payload, workspace };
}
