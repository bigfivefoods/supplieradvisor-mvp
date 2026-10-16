import { maskId } from './mask';
import type { RecoverCapabilities, RecoverRole } from './types';

export type AccountScope =
  | { kind: 'all' }
  | { kind: 'assigned'; staffId: string; teamId: string | null }
  | { kind: 'counts' }
  | { kind: 'none' };

/**
 * Same rows `recover_accounts_for_agent` returns: assigned to this staff
 * member, or placed on their team. A missing staff row matches nothing.
 */
export function accountInAgentScope(
  account: { assigned_to?: string | null; team_id?: string | null },
  staff: { id: string; teamId: string | null } | null
): boolean {
  if (!staff?.id) return false;
  if (account.assigned_to && account.assigned_to === staff.id) return true;
  if (staff.teamId && account.team_id && account.team_id === staff.teamId) return true;
  return false;
}

export function scopeAccountsFor(
  role: RecoverRole,
  staff: { id: string; team_id: string | null } | null
): AccountScope {
  if (role === 'owner' || role === 'manager' || role === 'finance' || role === 'compliance') {
    return { kind: 'all' };
  }
  if (role === 'agent') {
    if (!staff?.id) return { kind: 'none' };
    return { kind: 'assigned', staffId: staff.id, teamId: staff.team_id };
  }
  if (role === 'viewer') return { kind: 'counts' };
  return { kind: 'none' };
}

export type DebtorRecord = {
  id: string;
  display_name: string;
  id_last4?: string | null;
  id_number_enc?: string | null;
  id_hash?: string | null;
  id_number?: string | null;
  passport?: string | null;
  contacts?: unknown;
};

const STRIPPED = ['id_number', 'id_number_enc', 'id_hash', 'passport'] as const;

export function maskDebtor<T extends DebtorRecord>(
  debtor: T,
  caps: Pick<RecoverCapabilities, 'canSeeContacts' | 'canRevealId'>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...debtor, id_masked: maskId(debtor.id_last4) };
  for (const key of STRIPPED) delete out[key];
  if (!caps.canSeeContacts) delete out.contacts;
  delete out.canRevealId;
  return out;
}

export type AccountRecord = {
  id: string;
  ref: string;
  creditor_id?: string;
  creditor_name?: string;
  mandate_id?: string | null;
  debtor_id?: string;
  display_name?: string;
  id_last4?: string | null;
  id_number_enc?: string | null;
  id_hash?: string | null;
  balance_cents?: number;
  state?: string;
  assigned_to?: string | null;
  team_id?: string | null;
  flags?: unknown;
  contacts?: unknown;
  commission_model?: unknown;
  batch_id?: string | null;
  creditor_account_ref?: string;
  placed_at?: string;
  stage_key?: string;
  principal_cents?: number;
  interest_cents?: number;
  fees_cents?: number;
  costs_cents?: number;
  adjustment_cents?: number;
  original_cents?: number;
  notes?: unknown;
  events?: unknown;
  mandate_label?: string;
  assignee_name?: string;
};

export function serialiseAccount(
  account: AccountRecord,
  role: RecoverRole,
  caps: RecoverCapabilities
): Record<string, unknown> | null {
  if (role === 'viewer' || role === 'none' || !caps.canSeeAccountRows) return null;
  const masked = maskId(account.id_last4);
  if (role === 'agent') {
    return {
      id: account.id,
      ref: account.ref,
      creditor_name: account.creditor_name || '',
      display_name: account.display_name || '',
      id_masked: masked,
      balance_cents: account.balance_cents ?? 0,
      state: account.state || 'active',
      assigned_to: account.assigned_to || null,
      team_id: account.team_id || null,
      flags: account.flags || {},
      placed_at: account.placed_at || null,
      stage_key: account.stage_key || 'placed',
      creditor_account_ref: account.creditor_account_ref || '',
      contacts: caps.canSeeContacts ? account.contacts || [] : undefined,
      notes: account.notes || [],
      events: account.events || [],
      principal_cents: account.principal_cents ?? 0,
      interest_cents: account.interest_cents ?? 0,
      fees_cents: account.fees_cents ?? 0,
      costs_cents: account.costs_cents ?? 0,
      adjustment_cents: account.adjustment_cents ?? 0,
      original_cents: account.original_cents ?? 0,
      mandate_label: account.mandate_label || '',
      assignee_name: account.assignee_name || '',
    };
  }
  const out: Record<string, unknown> = { ...account, id_masked: masked };
  for (const key of STRIPPED) delete out[key];
  if (!caps.canSeeContacts) delete out.contacts;
  if (role === 'finance' || role === 'compliance') delete out.notes;
  return out;
}

export function serialiseCreditor(
  creditor: Record<string, unknown>,
  role: RecoverRole,
  caps: RecoverCapabilities
): Record<string, unknown> | null {
  if (role === 'none') return null;
  if (role === 'agent' || !caps.canSeeCreditorDetail) {
    return { id: creditor.id, name: creditor.name };
  }
  const out = { ...creditor };
  delete out.commission_model;
  return out;
}

export function serialiseMandate(
  mandate: Record<string, unknown>,
  role: RecoverRole
): Record<string, unknown> | null {
  if (role === 'agent' || role === 'none') return null;
  return { ...mandate };
}

export function auditPayload(fields: Record<string, string | number | boolean | null>): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'note_text' || key === 'id_number' || key === 'passport' || key === 'email' || key === 'phone') continue;
    out[key] = value;
  }
  return out;
}
