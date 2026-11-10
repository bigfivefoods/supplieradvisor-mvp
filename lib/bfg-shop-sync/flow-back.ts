/**
 * Hook + outbox adapter for the flow-back (see callback.ts).
 * afterArPaymentRecorded is called from recordArPayment, the single place
 * every CRM payment goes through. It does nothing unless the sync is enabled,
 * a callback URL is configured, and the invoice came from the shop.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { readSyncConfig } from './config';
import {
  buildPaymentRecordedBody,
  drainCallbacks,
  shouldFlowBack,
  type CallbackOutbox,
  type OutboxRow,
  type RecordedPayment,
} from './callback';
import type { Row } from './ports';

const LEASE_MS = 120_000;

export function createCallbackOutbox(profileId: number): CallbackOutbox {
  const sb = () => getSupabaseServer();
  return {
    async claimDue(limit, nowMs) {
      const nowIso = new Date(nowMs).toISOString();
      const { data } = await sb()
        .from('bfg_shop_sync_callbacks')
        .select('id, profile_id, idempotency_key, body, attempts, next_attempt_at')
        .eq('profile_id', profileId)
        .eq('status', 'pending')
        .lte('next_attempt_at', nowIso)
        .order('next_attempt_at', { ascending: true })
        .limit(limit);
      const claimed: OutboxRow[] = [];
      for (const r of (data || []) as Row[]) {
        // Lease: compare-and-set next_attempt_at so only one drain sends the row.
        const { data: won } = await sb()
          .from('bfg_shop_sync_callbacks')
          .update({ next_attempt_at: new Date(nowMs + LEASE_MS).toISOString() })
          .eq('id', Number(r.id))
          .eq('status', 'pending')
          .eq('next_attempt_at', r.next_attempt_at as string)
          .select('id');
        if (won && won.length) {
          claimed.push({
            id: Number(r.id),
            profile_id: Number(r.profile_id),
            idempotency_key: String(r.idempotency_key),
            body: String(r.body),
            attempts: Number(r.attempts || 0),
          });
        }
      }
      return claimed;
    },
    async markDone(id, attempts) {
      await sb()
        .from('bfg_shop_sync_callbacks')
        .update({ status: 'done', attempts, last_error: null, updated_at: new Date().toISOString() })
        .eq('id', id);
    },
    async markRetry(id, attempts, nextMs, code) {
      await sb()
        .from('bfg_shop_sync_callbacks')
        .update({
          attempts,
          next_attempt_at: new Date(nextMs).toISOString(),
          last_error: code,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    },
    async markDead(id, attempts, code) {
      await sb()
        .from('bfg_shop_sync_callbacks')
        .update({ status: 'dead', attempts, last_error: code, updated_at: new Date().toISOString() })
        .eq('id', id);
    },
  };
}

/** Drain due flow-back rows (used by the cron route and right after an enqueue). */
export async function drainFlowBack(limit = 10): Promise<{
  skipped?: 'disabled' | 'no_callback_url';
  delivered?: number;
  retried?: number;
  dead?: number;
}> {
  const cfg = readSyncConfig();
  if (cfg.state !== 'ok') return { skipped: 'disabled' };
  if (!cfg.callbackUrl) return { skipped: 'no_callback_url' };
  return drainCallbacks({
    outbox: createCallbackOutbox(cfg.profileId),
    url: cfg.callbackUrl,
    secret: cfg.secret,
    nowMs: Date.now(),
    limit,
    onDead: async (row, code) => {
      // Admin alert, ids and code only.
      await getSupabaseServer().from('notifications').insert({
        profile_id: cfg.profileId,
        type: 'bfg_shop_sync_alert',
        title: 'Shop payment notice could not be delivered',
        body: `${row.idempotency_key}: ${code}`,
        metadata: { code, key: row.idempotency_key, profile_id: cfg.profileId },
        read: false,
      });
    },
  });
}

/**
 * Called after recordArPayment inserted a ledger row. Never throws.
 * Skips payments created by the sync itself (created_by = 'bfg_shop_sync').
 */
export async function afterArPaymentRecorded(payment: RecordedPayment): Promise<void> {
  try {
    const cfg = readSyncConfig();
    if (cfg.state !== 'ok' || !cfg.callbackUrl) return;
    if (payment.profile_id !== cfg.profileId || !payment.id) return;
    const sb = getSupabaseServer();
    const { data: invoice } = await sb
      .from('customer_invoices')
      .select('id, profile_id, invoice_number, total_amount, metadata')
      .eq('id', payment.invoice_id)
      .eq('profile_id', cfg.profileId)
      .maybeSingle();
    if (!shouldFlowBack(invoice as Row | null, payment, cfg.profileId)) return;

    const { data: sums } = await sb
      .from('customer_invoice_payments')
      .select('amount')
      .eq('profile_id', cfg.profileId)
      .eq('invoice_id', payment.invoice_id);
    const paidTotalCents = ((sums || []) as Row[]).reduce(
      (s, r) => s + Math.round(Number(r.amount || 0) * 100),
      0
    );
    const { key, body } = buildPaymentRecordedBody({
      profileId: cfg.profileId,
      invoice: invoice as Row,
      payment,
      paidTotalCents,
      sentAt: new Date().toISOString(),
    });
    const { error } = await sb.from('bfg_shop_sync_callbacks').insert({
      profile_id: cfg.profileId,
      idempotency_key: key,
      body: JSON.stringify(body),
      status: 'pending',
      attempts: 0,
      next_attempt_at: new Date().toISOString(),
    });
    if (error && !/duplicate key|unique/i.test(error.message || '')) {
      console.warn('[bfg-shop-sync] flow-back enqueue failed');
      return;
    }
    // First delivery attempt after the response; the cron route retries the rest.
    const task = async () => {
      await drainFlowBack(5);
    };
    try {
      const { scheduleWithAfter } = await import('@/lib/business/schedule-after');
      scheduleWithAfter(task);
    } catch {
      void task().catch(() => undefined);
    }
  } catch {
    console.warn('[bfg-shop-sync] flow-back hook failed');
  }
}
