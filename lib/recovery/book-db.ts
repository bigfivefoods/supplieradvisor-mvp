import { getSupabaseServer } from '@/lib/supabase/server-client';
import { decryptId, encryptId } from './pii-crypto';
import { isMigrationPending, MigrationPendingError, readFeatureResult } from './recovergraph-db';
import { assembleBookStats, type BookStatsClient } from './book-stats';
import type { RecoverBookOp, RecoverBookStats } from './types';

const PERSONAL = new Set([
  'debtor.upsert',
  'contact_point.upsert',
  'contact_point.remove',
  'account.create',
]);

export function bookOpNeedsRealData(op: RecoverBookOp['op']): boolean {
  return PERSONAL.has(op);
}

export async function commitBook(
  companyId: number,
  actorId: string,
  op: RecoverBookOp
): Promise<Record<string, unknown>> {
  if (!('patch' in op)) throw new Error('unsupported');
  const supabase = getSupabaseServer();
  const result = await supabase.rpc('recover_book_commit', {
    p_company_id: companyId,
    p_actor_id: actorId,
    p_action: op.op,
    p_target: String(op.patch.id || op.patch.account_id || ''),
    p_patch: op.patch,
  });
  if (isMigrationPending(result.error)) throw new MigrationPendingError();
  if (result.error) throw new Error(calmSql(result.error.message));
  return (result.data || { ok: true }) as Record<string, unknown>;
}

export async function revealAccountId(input: {
  companyId: number;
  actorId: string;
  accountId: string;
  reason: string;
}): Promise<{ id_number: string }> {
  const supabase = getSupabaseServer();
  const committed = await supabase.rpc('recover_book_commit', {
    p_company_id: input.companyId,
    p_actor_id: input.actorId,
    p_action: 'account.reveal_id',
    p_target: input.accountId,
    p_patch: { id: input.accountId, reason: input.reason },
  });
  if (isMigrationPending(committed.error)) throw new MigrationPendingError();
  if (committed.error) throw new Error(calmSql(committed.error.message));
  const account = await supabase
    .from('recover_accounts')
    .select('debtor_id')
    .eq('company_id', input.companyId)
    .eq('id', input.accountId)
    .maybeSingle();
  if (account.error || !account.data) throw new Error('missing');
  const debtor = await supabase
    .from('recover_debtors')
    .select('id_number_enc')
    .eq('company_id', input.companyId)
    .eq('id', account.data.debtor_id)
    .maybeSingle();
  if (debtor.error || !debtor.data?.id_number_enc) throw new Error('pii_not_configured');
  const plain = decryptId(String(debtor.data.id_number_enc));
  if (!plain.ok) throw new Error(plain.code);
  return { id_number: plain.value };
}

export async function prepareDebtorPatch(patch: Record<string, unknown>): Promise<Record<string, unknown>> {
  const next = { ...patch };
  const plain = typeof next.id_plain === 'string' ? next.id_plain : '';
  delete next.id_plain;
  if (!plain) return next;
  const sealed = encryptId(plain);
  if (!sealed.ok) throw new Error(sealed.code);
  next.id_number_enc = sealed.enc;
  next.id_hash = sealed.hash;
  next.id_last4 = sealed.last4;
  next.id_key_version = sealed.version;
  return next;
}

const ACCOUNT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLACED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export async function listBookAccounts(input: {
  companyId: number;
  limit: number;
  after: string | null;
  afterId: string | null;
  state: string | null;
  creditorId: string | null;
  batchId: string | null;
  assigned: 'yes' | 'no' | null;
  search: string | null;
  accountId?: string | null;
}) {
  const supabase = getSupabaseServer();
  const needle = String(input.search || '').replace(/[%_\\,()]/g, '').trim().slice(0, 80);
  let debtorMatch: string[] = [];
  if (needle) {
    const found = await supabase
      .from('recover_debtors')
      .select('id')
      .eq('company_id', input.companyId)
      .eq('status', 'active')
      .ilike('display_name', `%${needle}%`)
      .limit(100);
    const pendingSearch = readFeatureResult(found.error, 'accounts');
    if (!pendingSearch.ready) return pendingSearch;
    debtorMatch = ((found.data || []) as { id?: string }[])
      .map((row) => String(row.id || ''))
      .filter((id) => ACCOUNT_UUID.test(id));
  }
  let query = supabase
    .from('recover_accounts')
    .select(
      'id, ref, creditor_id, mandate_id, debtor_id, creditor_account_ref, balance_cents, state, assigned_to, team_id, placed_at, flags, stage_key, principal_cents, interest_cents, fees_cents, costs_cents, adjustment_cents, original_cents, batch_id'
    )
    .eq('company_id', input.companyId)
    .order('placed_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(input.limit);
  if (input.after && input.afterId && PLACED_AT.test(input.after) && ACCOUNT_UUID.test(input.afterId)) {
    query = query.or(`placed_at.lt."${input.after}",and(placed_at.eq."${input.after}",id.lt.${input.afterId})`);
  }
  if (needle) {
    const parts = [`ref.ilike.%${needle}%`, `creditor_account_ref.ilike.%${needle}%`];
    if (debtorMatch.length) parts.push(`debtor_id.in.(${debtorMatch.join(',')})`);
    query = query.or(parts.join(','));
  }
  if (input.state) query = query.eq('state', input.state);
  if (input.creditorId) query = query.eq('creditor_id', input.creditorId);
  if (input.batchId) query = query.eq('batch_id', input.batchId);
  if (input.assigned === 'yes') query = query.not('assigned_to', 'is', null);
  if (input.assigned === 'no') query = query.is('assigned_to', null);
  if (input.accountId && ACCOUNT_UUID.test(input.accountId)) query = query.eq('id', input.accountId);
  const result = await query;
  const pending = readFeatureResult(result.error, 'accounts');
  if (!pending.ready) return pending;
  if (result.error) throw new Error('accounts');
  const rows = (result.data || []) as Record<string, unknown>[];
  const debtorIds = [...new Set(rows.map((row) => String(row.debtor_id || '')).filter(Boolean))];
  const names = new Map<string, { display_name?: string; id_last4?: string | null }>();
  if (debtorIds.length) {
    const debtors = await supabase
      .from('recover_debtors')
      .select('id, display_name, id_last4')
      .eq('company_id', input.companyId)
      .in('id', debtorIds);
    const debtorPending = readFeatureResult(debtors.error, 'accounts');
    if (!debtorPending.ready) return debtorPending;
    for (const debtor of debtors.data || []) {
      names.set(String(debtor.id), { display_name: debtor.display_name, id_last4: debtor.id_last4 });
    }
  }
  const contacts = await loadDebtorContacts(input.companyId, debtorIds);
  if (contacts === 'pending') return { ready: false as const, reason: 'migration_pending' as const, feature: 'accounts' as const };
  const labels = await loadAccountLabels(input.companyId, rows);
  if (labels === 'pending') return { ready: false as const, reason: 'migration_pending' as const, feature: 'accounts' as const };
  return {
    ready: true as const,
    rows: rows.map((row) => {
      const debtor = names.get(String(row.debtor_id || ''));
      const debtorId = String(row.debtor_id || '');
      return {
        ...row,
        display_name: debtor?.display_name || '',
        id_last4: debtor?.id_last4 || null,
        contacts: contacts.get(debtorId) || [],
        creditor_name: labels.creditors.get(String(row.creditor_id || '')) || '',
        mandate_label: labels.mandates.get(String(row.mandate_id || '')) || '',
        assignee_name: labels.staff.get(String(row.assigned_to || '')) || '',
      };
    }),
  };
}

export async function listDuplicateDebtors(companyId: number) {
  const supabase = getSupabaseServer();
  const result = await supabase.rpc('recover_list_duplicate_debtors', { p_company_id: companyId });
  const pending = readFeatureResult(result.error, 'accounts');
  if (!pending.ready) return pending;
  if (result.error) throw new Error('duplicates');
  return ((result.data || []) as {
    match?: string;
    left_id?: string;
    left_name?: string;
    left_last4?: string | null;
    right_id?: string;
    right_name?: string;
    right_last4?: string | null;
  }[])
    .map((row) => ({
      name: String(row.right_name || ''),
      match: row.match === 'identity' ? 'identity' : 'contact',
      debtors: [
        {
          id: String(row.left_id || ''),
          display_name: String(row.left_name || ''),
          id_last4: row.left_last4 ? String(row.left_last4) : null,
        },
        {
          id: String(row.right_id || ''),
          display_name: String(row.right_name || ''),
          id_last4: row.right_last4 ? String(row.right_last4) : null,
        },
      ],
    }))
    .filter((row) => row.debtors[0].id && row.debtors[1].id);
}

const EVENT_LABEL: Record<string, string> = {
  import: 'Imported',
  assign: 'Assigned',
  flag: 'Flag recorded',
  note: 'Note',
  recall: 'Recalled',
  adjust: 'Adjustment',
  merge: 'Debtor merge',
  view_sensitive: 'Identity viewed',
};

export async function loadAccountEvents(companyId: number, accountId: string, includeNotes: boolean) {
  const supabase = getSupabaseServer();
  const result = await supabase
    .from('recover_account_events')
    .select('id, type, at, note_text')
    .eq('company_id', companyId)
    .eq('account_id', accountId)
    .order('at', { ascending: false })
    .limit(100);
  const pending = readFeatureResult(result.error, 'accounts');
  if (!pending.ready) return pending;
  if (result.error) return [];
  return ((result.data || []) as { id?: string; type?: string; at?: string; note_text?: string | null }[]).map((row, index) => ({
    id: String(row.id || index),
    type: String(row.type || ''),
    at: row.at ? String(row.at) : '',
    label: EVENT_LABEL[String(row.type || '')] || 'Recorded',
    note: includeNotes && row.type === 'note' ? String(row.note_text || '') : '',
  }));
}

const CONTACT_CHUNK = 50;
const CONTACT_PAGE = 500;

export async function loadDebtorContacts(companyId: number, debtorIds: string[]) {
  const grouped = new Map<string, { kind: string; value: string; quality: string; do_not_contact: boolean; s129_delivery_method: string | null }[]>();
  const ids = [...new Set(debtorIds.map((id) => String(id || '')).filter(Boolean))];
  if (!ids.length) return grouped;
  const supabase = getSupabaseServer();
  for (let offset = 0; offset < ids.length; offset += CONTACT_CHUNK) {
    const slice = ids.slice(offset, offset + CONTACT_CHUNK);
    let from = 0;
    for (let page = 0; page < 40; page += 1) {
      const result = await supabase
        .from('recover_contact_points')
        .select('id, debtor_id, kind, value, quality, do_not_contact, s129_delivery_method')
        .eq('company_id', companyId)
        .in('debtor_id', slice)
        .order('id', { ascending: true })
        .range(from, from + CONTACT_PAGE - 1);
      const pending = readFeatureResult(result.error, 'accounts');
      if (!pending.ready) return 'pending' as const;
      if (result.error) throw new Error('contacts');
      const rows = result.data || [];
      for (const row of rows) {
        const id = String(row.debtor_id || '');
        const list = grouped.get(id) || [];
        list.push({
          kind: String(row.kind || ''),
          value: String(row.value || ''),
          quality: String(row.quality || 'unknown'),
          do_not_contact: Boolean(row.do_not_contact),
          s129_delivery_method: row.s129_delivery_method ? String(row.s129_delivery_method) : null,
        });
        grouped.set(id, list);
      }
      if (rows.length < CONTACT_PAGE) break;
      if (page === 39) throw new Error('contacts');
      from += CONTACT_PAGE;
    }
  }
  return grouped;
}

export async function listCompanyCustomers(companyId: number) {
  const supabase = getSupabaseServer();
  const result = await supabase
    .from('customers')
    .select('id, trading_name')
    .eq('profile_id', companyId)
    .order('trading_name', { ascending: true })
    .limit(100);
  if (result.error) return [];
  return ((result.data || []) as { id?: number; trading_name?: string }[])
    .map((row) => ({ id: Number(row.id), trading_name: String(row.trading_name || '').slice(0, 120) }))
    .filter((row) => Number.isInteger(row.id) && row.id > 0 && row.trading_name);
}

export async function customerInCompany(companyId: number, customerId: number): Promise<boolean> {
  const supabase = getSupabaseServer();
  const result = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', companyId)
    .eq('id', customerId)
    .maybeSingle();
  return Boolean(result.data?.id);
}

function supabaseBookStatsClient(companyId: number): BookStatsClient {
  const supabase = getSupabaseServer();
  return {
    async count(filter) {
      let query = supabase.from('recover_accounts').select('id', { count: 'exact', head: true }).eq('company_id', companyId);
      if (filter === 'assigned') query = query.not('assigned_to', 'is', null);
      if (filter === 'unassigned') query = query.is('assigned_to', null).eq('state', 'active');
      if (filter === 'arrangement' || filter === 'paid' || filter === 'recalled' || filter === 'closed') {
        query = query.eq('state', filter);
      }
      const result = await query;
      return { count: result.count, error: result.error };
    },
    async balance() {
      const result = await supabase
        .from('recover_accounts')
        .select('balance_cents, state')
        .eq('company_id', companyId)
        .limit(2000);
      return {
        data: (result.data || null) as { balance_cents?: number | null; state?: string | null }[] | null,
        error: result.error,
      };
    },
  };
}

/**
 * Exact head-counts for the book. No migration.
 * `placedBalanceCents` stays a sum of the first 2,000 rows. The flow does not show it.
 */
export async function loadBookStats(companyId: number, client?: BookStatsClient): Promise<RecoverBookStats | null> {
  const source = client || supabaseBookStatsClient(companyId);
  return assembleBookStats(source);
}

const STAFF_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Exact count of accounts the agent read would return: assigned to this
 * active staff row, or placed on that row's team. Company is always filtered.
 * Null when the table is not ready or the count query fails.
 */
export async function countAccountsForAgent(companyId: number, staffId: string): Promise<number | null> {
  if (!STAFF_UUID.test(staffId)) return 0;
  const supabase = getSupabaseServer();
  const staff = await supabase
    .from('recover_staff')
    .select('id, team_id, status')
    .eq('company_id', companyId)
    .eq('id', staffId)
    .maybeSingle();
  if (isMigrationPending(staff.error) || staff.error) return null;
  const teamId = staff.data?.status === 'active' && staff.data.team_id ? String(staff.data.team_id) : null;
  if (!staff.data || staff.data.status !== 'active') return 0;
  let query = supabase.from('recover_accounts').select('id', { count: 'exact', head: true }).eq('company_id', companyId);
  if (teamId && STAFF_UUID.test(teamId)) {
    query = query.or(`assigned_to.eq.${staffId},team_id.eq.${teamId}`);
  } else {
    query = query.eq('assigned_to', staffId);
  }
  const result = await query;
  if (isMigrationPending(result.error) || result.error) return null;
  if (result.count == null) return null;
  return result.count;
}

/** @deprecated Use countAccountsForAgent. Kept so callers share the agent-read scope. */
export async function countAssignedToStaff(companyId: number, staffId: string): Promise<number | null> {
  return countAccountsForAgent(companyId, staffId);
}

async function loadAccountLabels(companyId: number, rows: Record<string, unknown>[]) {
  const supabase = getSupabaseServer();
  const creditors = new Map<string, string>();
  const mandates = new Map<string, string>();
  const staff = new Map<string, string>();
  const creditorIds = [...new Set(rows.map((row) => String(row.creditor_id || '')).filter(Boolean))];
  const mandateIds = [...new Set(rows.map((row) => String(row.mandate_id || '')).filter(Boolean))];
  const staffIds = [...new Set(rows.map((row) => String(row.assigned_to || '')).filter(Boolean))];
  if (creditorIds.length) {
    const found = await supabase.from('recover_creditors').select('id, name').eq('company_id', companyId).in('id', creditorIds);
    if (isMigrationPending(found.error)) return 'pending' as const;
    for (const row of found.data || []) creditors.set(String(row.id), String(row.name || ''));
  }
  if (mandateIds.length) {
    const found = await supabase
      .from('recover_mandates')
      .select('id, product_type, agreement_reference')
      .eq('company_id', companyId)
      .in('id', mandateIds);
    if (isMigrationPending(found.error)) return 'pending' as const;
    for (const row of found.data || []) {
      const product = String(row.product_type || '');
      const reference = String(row.agreement_reference || '').trim();
      mandates.set(String(row.id), reference ? `${product} · ${reference}` : product);
    }
  }
  if (staffIds.length) {
    const found = await supabase.from('recover_staff').select('id, email').eq('company_id', companyId).in('id', staffIds);
    if (isMigrationPending(found.error)) return 'pending' as const;
    for (const row of found.data || []) staff.set(String(row.id), String(row.email || ''));
  }
  return { creditors, mandates, staff };
}

export async function demoRowsExist(companyId: number): Promise<boolean | 'pending'> {
  const supabase = getSupabaseServer();
  const result = await supabase.rpc('recover_demo_rows_exist', { p_company_id: companyId });
  if (isMigrationPending(result.error)) return 'pending';
  if (result.error) throw new Error('workspace');
  return Boolean(result.data);
}

export async function setAssignmentBlock(input: {
  companyId: number;
  actorId: string;
  enabled: boolean;
}): Promise<void> {
  const supabase = getSupabaseServer();
  const result = await supabase.rpc('recover_set_assignment_block', {
    p_company_id: input.companyId,
    p_actor_id: input.actorId,
    p_enabled: input.enabled,
  });
  if (isMigrationPending(result.error)) throw new MigrationPendingError();
  if (result.error) throw new Error(calmSql(result.error.message));
}

export async function setStaffExpiry(input: {
  companyId: number;
  actorId: string;
  staffId: string;
  expiresOn: string | null;
}): Promise<void> {
  const supabase = getSupabaseServer();
  const result = await supabase.rpc('recover_set_staff_expiry', {
    p_company_id: input.companyId,
    p_actor_id: input.actorId,
    p_staff_id: input.staffId,
    p_expires: input.expiresOn,
  });
  if (isMigrationPending(result.error)) throw new MigrationPendingError();
  if (result.error) throw new Error(calmSql(result.error.message));
}

export async function bulkAssignAccounts(input: {
  companyId: number;
  actorId: string;
  ids: string[];
  staffId: string | null;
  teamId: string | null;
}): Promise<Record<string, unknown>> {
  const supabase = getSupabaseServer();
  const result = await supabase.rpc('recover_bulk_assign', {
    p_company_id: input.companyId,
    p_actor_id: input.actorId,
    p_ids: input.ids,
    p_staff_id: input.staffId,
    p_team_id: input.teamId,
    p_as_of: null,
  });
  if (isMigrationPending(result.error)) throw new MigrationPendingError();
  if (result.error) throw new Error(calmSql(result.error.message));
  return (result.data || { ok: true }) as Record<string, unknown>;
}

export async function listBookBatches(companyId: number) {
  const supabase = getSupabaseServer();
  const result = await supabase
    .from('recover_batches')
    .select('id, creditor_id, file_name, status, row_stats, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(100);
  const pending = readFeatureResult(result.error, 'import');
  if (!pending.ready) return pending;
  if (result.error) throw new Error('batches');
  const names = new Map<string, string>();
  const creditors = await supabase.from('recover_creditors').select('id, name').eq('company_id', companyId);
  const creditorPending = readFeatureResult(creditors.error, 'import');
  if (!creditorPending.ready) return creditorPending;
  if (!creditors.error) {
    for (const row of creditors.data || []) names.set(String(row.id), String(row.name || ''));
  }
  return {
    ready: true as const,
    batches: ((result.data || []) as Record<string, unknown>[]).map((row) => {
      const stats = row.row_stats && typeof row.row_stats === 'object' ? (row.row_stats as Record<string, unknown>) : {};
      return {
        id: String(row.id),
        creditor_id: String(row.creditor_id || ''),
        creditor_name: names.get(String(row.creditor_id || '')) || '',
        file_name: String(row.file_name || ''),
        status: String(row.status || ''),
        created: Number(stats.created || 0),
        skipped: Number(stats.skipped || 0),
        created_at: row.created_at ? String(row.created_at) : '',
      };
    }),
  };
}

export async function findStaffId(companyId: number, staffId: string, email: string): Promise<string | 'pending' | null> {
  const supabase = getSupabaseServer();
  let query = supabase.from('recover_staff').select('id').eq('company_id', companyId).limit(1);
  query = staffId ? query.eq('id', staffId) : query.eq('email', email);
  const result = await query.maybeSingle();
  const pending = readFeatureResult(result.error, 'book');
  if (!pending.ready) return 'pending';
  if (result.error || !result.data?.id) return null;
  return String(result.data.id);
}

function calmSql(message: string | undefined): string {
  const text = String(message || '');
  if (text.includes('Clear the demo book first')) return 'Clear the demo book first';
  if (text.includes('registration_missing')) return 'registration_missing';
  if (text.includes('registration_expired')) return 'registration_expired';
  if (text.includes('conflict') || text.includes('40001')) return 'conflict';
  if (text.includes('throttled')) return 'throttled';
  if (text.includes('plaintext_id')) return 'plaintext_id';
  if (text.includes('already_imported')) return 'already_imported';
  if (/\bname\b/.test(text)) return 'name';
  if (text.includes('uq_recover_creditors_name')) return 'duplicate_creditor';
  if (text.includes('uq_recover_creditors_customer')) return 'duplicate_customer';
  if (text.includes('note_scope')) return 'note_scope';
  if (text.includes('mandate_locked')) return 'mandate_locked';
  if (text.includes('collector')) return 'collector';
  if (/\bbalance\b/.test(text)) return 'balance';
  if (/\breason\b/.test(text)) return 'reason';
  if (text.includes('creditor')) return 'creditor';
  if (text.includes('cap')) return 'cap';
  return 'closed';
}
