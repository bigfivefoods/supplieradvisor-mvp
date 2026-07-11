import { createHash } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { round2 } from '@/lib/accounting/server';
import type { CanonicalTxn, IngestResult, BankProviderId } from './types';

export function providerTxnId(provider: BankProviderId | string, parts: unknown[]): string {
  const h = createHash('sha256');
  h.update(String(provider));
  for (const p of parts) {
    h.update('|');
    h.update(String(p ?? ''));
  }
  return h.digest('hex').slice(0, 40);
}

export function fromParsedLine(
  provider: 'csv' | 'pdf',
  line: {
    txn_date: string;
    description: string;
    reference: string | null;
    amount: number;
    balance_after: number | null;
    counterparty_name: string | null;
    external_id: string;
    raw: Record<string, unknown> | Record<string, string>;
  }
): CanonicalTxn {
  return {
    provider,
    provider_txn_id: line.external_id,
    booked_at: line.txn_date,
    amount: line.amount,
    currency: 'ZAR',
    description: line.description,
    reference: line.reference,
    counterparty: line.counterparty_name,
    balance_after: line.balance_after,
    raw: line.raw as Record<string, unknown>,
  };
}

type IngestParams = {
  companyId: number;
  bankAccountId: number;
  txns: CanonicalTxn[];
  currency?: string;
  connectionId?: number | null;
  syncRunId?: number | null;
  importBatchId?: number | null;
  sourceLabel?: string;
  privyUserId?: string | null;
  /** When true, only report counts */
  dryRun?: boolean;
};

/**
 * Idempotent upsert of canonical bank lines into bank_transactions.
 * Dedupes on provider_txn_id (preferred) or external_id / legacy hash.
 */
export async function ingestCanonicalTxns(params: IngestParams): Promise<IngestResult> {
  const {
    companyId,
    bankAccountId,
    txns,
    currency = 'ZAR',
    connectionId = null,
    syncRunId = null,
    importBatchId = null,
    dryRun = false,
  } = params;

  const result: IngestResult = {
    fetched: txns.length,
    inserted: 0,
    duplicates: 0,
    errors: 0,
    batch_id: importBatchId,
    sync_run_id: syncRunId,
  };

  if (!txns.length) return result;

  const supabase = getSupabaseServer();

  // Load existing provider_txn_id + external_id for this account
  const providerIds = txns.map((t) => t.provider_txn_id).filter(Boolean);
  const existing = new Set<string>();

  for (let i = 0; i < providerIds.length; i += 100) {
    const chunk = providerIds.slice(i, i + 100);
    const { data: byProvider } = await supabase
      .from('bank_transactions')
      .select('provider_txn_id, external_id')
      .eq('profile_id', companyId)
      .eq('bank_account_id', bankAccountId)
      .in('provider_txn_id', chunk);
    for (const r of byProvider || []) {
      if (r.provider_txn_id) existing.add(String(r.provider_txn_id));
      if (r.external_id) existing.add(String(r.external_id));
    }
    const { data: byExternal } = await supabase
      .from('bank_transactions')
      .select('external_id, provider_txn_id')
      .eq('profile_id', companyId)
      .eq('bank_account_id', bankAccountId)
      .in('external_id', chunk);
    for (const r of byExternal || []) {
      if (r.external_id) existing.add(String(r.external_id));
      if (r.provider_txn_id) existing.add(String(r.provider_txn_id));
    }
  }

  const toInsert = txns.filter(
    (t) => !existing.has(t.provider_txn_id)
  );
  result.duplicates = txns.length - toInsert.length;

  if (dryRun || !toInsert.length) {
    return result;
  }

  const rows = toInsert.map((t) => ({
    profile_id: companyId,
    bank_account_id: bankAccountId,
    txn_date: t.booked_at,
    tx_date: `${t.booked_at}T12:00:00.000Z`,
    description: (t.description || 'Bank transaction').slice(0, 500),
    reference: t.reference ? String(t.reference).slice(0, 200) : null,
    amount: round2(t.amount),
    currency: t.currency || currency || 'ZAR',
    status: 'unreconciled',
    allocation_status: 'unallocated',
    balance_after: t.balance_after != null ? round2(t.balance_after) : null,
    counterparty_name: t.counterparty ? String(t.counterparty).slice(0, 200) : null,
    external_id: t.provider_txn_id,
    provider: t.provider,
    provider_txn_id: t.provider_txn_id,
    bank_provider: t.provider,
    bank_connection_id: connectionId,
    sync_run_id: syncRunId,
    import_batch_id: importBatchId,
    metadata: {
      import_raw: t.raw || null,
      source: t.provider,
    },
  }));

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { data: inserted, error: insErr } = await supabase
      .from('bank_transactions')
      .insert(chunk)
      .select('id');
    if (insErr) {
      // Retry without optional columns if migration not applied
      if (
        insErr.message?.includes('provider_txn_id') ||
        insErr.message?.includes('bank_connection_id') ||
        insErr.message?.includes('column')
      ) {
        const fallback = chunk.map((r) => ({
          profile_id: r.profile_id,
          bank_account_id: r.bank_account_id,
          txn_date: r.txn_date,
          tx_date: r.tx_date,
          description: r.description,
          reference: r.reference,
          amount: r.amount,
          currency: r.currency,
          status: r.status,
          allocation_status: r.allocation_status,
          balance_after: r.balance_after,
          counterparty_name: r.counterparty_name,
          external_id: r.external_id,
          bank_provider: r.bank_provider,
          import_batch_id: r.import_batch_id,
          metadata: {
            ...(r.metadata as object),
            provider: r.provider,
            provider_txn_id: r.provider_txn_id,
            bank_connection_id: r.bank_connection_id,
          },
        }));
        const { data: ins2, error: err2 } = await supabase
          .from('bank_transactions')
          .insert(fallback)
          .select('id');
        if (err2) {
          result.errors += chunk.length;
          result.error_message = err2.message;
          continue;
        }
        result.inserted += ins2?.length || fallback.length;
      } else {
        result.errors += chunk.length;
        result.error_message = insErr.message;
      }
      continue;
    }
    result.inserted += inserted?.length || chunk.length;
  }

  // Update bank account balance / last sync
  const withBal = [...toInsert]
    .filter((l) => l.balance_after != null)
    .sort((a, b) => a.booked_at.localeCompare(b.booked_at));

  const { data: bank } = await supabase
    .from('bank_accounts')
    .select('id, current_balance')
    .eq('id', bankAccountId)
    .eq('profile_id', companyId)
    .maybeSingle();

  if (bank) {
    const patch: Record<string, unknown> = {
      last_import_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (connectionId) {
      patch.connection_id = connectionId;
      patch.last_sync_at = new Date().toISOString();
      patch.feed_provider = toInsert[0]?.provider || null;
    }
    if (withBal.length > 0) {
      patch.current_balance = round2(Number(withBal[withBal.length - 1].balance_after));
    } else if (toInsert.length) {
      const delta = toInsert.reduce((s, l) => s + l.amount, 0);
      patch.current_balance = round2(Number(bank.current_balance || 0) + delta);
    }
    await supabase.from('bank_accounts').update(patch).eq('id', bankAccountId);
  }

  return result;
}

export async function startSyncRun(params: {
  companyId: number;
  connectionId?: number | null;
  bankAccountId?: number | null;
  provider: string;
  trigger: string;
}): Promise<number | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('bank_sync_runs')
    .insert({
      profile_id: params.companyId,
      connection_id: params.connectionId || null,
      bank_account_id: params.bankAccountId || null,
      provider: params.provider,
      trigger: params.trigger,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id as number;
}

export async function finishSyncRun(
  runId: number | null,
  result: IngestResult & { status?: string }
): Promise<void> {
  if (!runId) return;
  const supabase = getSupabaseServer();
  await supabase
    .from('bank_sync_runs')
    .update({
      status:
        result.status ||
        (result.errors > 0 && result.inserted === 0
          ? 'error'
          : result.errors > 0
            ? 'partial'
            : 'success'),
      finished_at: new Date().toISOString(),
      fetched: result.fetched,
      inserted: result.inserted,
      duplicates: result.duplicates,
      errors: result.errors,
      error_message: result.error_message || null,
    })
    .eq('id', runId);
}
