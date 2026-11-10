/**
 * Flow-back: SupplierAdvisor® -> shop, payments only (contract v1.0, section 7).
 *
 * When a payment is recorded in SupplierAdvisor® against an invoice with
 * metadata.origin = 'bfg_shop' that did NOT come from the shop's own order.paid
 * (payment.created_by = 'bfg_shop_sync' is the loop guard), the shop is told with
 * invoice.payment_recorded, signed with the direction-specific prefix
 * "bfg-sa-callback.v1.". Delivery is persisted (outbox) and retried with
 * exponential backoff, 8 attempts, then dead.
 */
import { CONTRACT_VERSION, SHOP_ORIGIN, SYNC_ACTOR } from './config';
import { asMeta } from './mapping';
import { randsToCents } from './money';
import type { Row } from './ports';
import { CALLBACK_SIGNING_PREFIX, signBfgPayload } from './signature';

export const CALLBACK_EVENT = 'invoice.payment_recorded';
export const MAX_CALLBACK_ATTEMPTS = 8;
export const CALLBACK_TIMEOUT_MS = 10_000;
/** 1 min, 5 min, 30 min, 2 h, 6 h, then 6 h. */
const BACKOFF_MS = [60_000, 300_000, 1_800_000, 7_200_000, 21_600_000];

export function callbackBackoffMs(attemptsMade: number): number {
  const i = Math.max(1, attemptsMade) - 1;
  return BACKOFF_MS[Math.min(i, BACKOFF_MS.length - 1)];
}

export type RecordedPayment = {
  id?: number | null;
  profile_id: number;
  invoice_id: number;
  amount: number;
  paid_at: string;
  method?: string | null;
  reference?: string | null;
  created_by?: string | null;
};

/** True only for an invoice the sync created, and a payment the sync did not create. */
export function shouldFlowBack(
  invoice: Row | null,
  payment: RecordedPayment,
  profileId: number
): boolean {
  if (!invoice) return false;
  if (payment.created_by === SYNC_ACTOR) return false; // loop guard
  if (payment.profile_id !== profileId) return false;
  const meta = asMeta(invoice.metadata);
  return meta.origin === SHOP_ORIGIN && typeof meta.shop_order_ref === 'string' && meta.shop_order_ref !== '';
}

export function buildPaymentRecordedBody(args: {
  profileId: number;
  invoice: Row;
  payment: RecordedPayment;
  paidTotalCents: number;
  sentAt: string;
}): { key: string; body: Row } {
  const { invoice, payment } = args;
  const meta = asMeta(invoice.metadata);
  const totalCents = randsToCents(invoice.total_amount as number);
  const key = `${CALLBACK_EVENT}:${Number(invoice.id)}:${Number(payment.id)}`;
  return {
    key,
    body: {
      contract_version: CONTRACT_VERSION,
      event: CALLBACK_EVENT,
      idempotency_key: key,
      profile_id: args.profileId,
      sent_at: args.sentAt,
      data: {
        shop_order_reference: String(meta.shop_order_ref),
        sa_invoice_id: Number(invoice.id),
        sa_invoice_number: String(invoice.invoice_number || ''),
        sa_payment_id: Number(payment.id),
        payment_reference: payment.reference || null,
        method: payment.method || 'manual',
        paid_at: new Date(payment.paid_at).toISOString(),
        amount_cents: randsToCents(payment.amount),
        amount_paid_total_cents: args.paidTotalCents,
        invoice_total_cents: totalCents,
        invoice_status: args.paidTotalCents >= totalCents ? 'paid' : 'partial',
      },
    },
  };
}

export type SendOutcome =
  | { ok: true; status: number }
  | { ok: false; retryable: boolean; status: number | null; code: string };

/** POST the stored body, freshly signed with the current timestamp. */
export async function sendCallback(args: {
  url: string;
  secret: string;
  key: string;
  bodyJson: string;
  nowMs: number;
  fetchImpl?: typeof fetch;
}): Promise<SendOutcome> {
  const ts = String(Math.floor(args.nowMs / 1000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALLBACK_TIMEOUT_MS);
  try {
    const res = await (args.fetchImpl ?? fetch)(args.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'supplieradvisor-bfg-sync/1.0',
        'x-bfg-timestamp': ts,
        'x-bfg-signature': signBfgPayload(CALLBACK_SIGNING_PREFIX, args.secret, ts, args.bodyJson),
        'x-bfg-idempotency-key': args.key,
        'x-bfg-event': CALLBACK_EVENT,
      },
      body: args.bodyJson,
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (res.ok) return { ok: true, status: res.status };
    let code = `http_${res.status}`;
    let retryable = [408, 425, 429, 500, 502, 503, 504].includes(res.status);
    try {
      const j = (await res.json()) as { error?: { code?: string; retryable?: boolean } };
      if (j?.error?.code) code = String(j.error.code).slice(0, 60);
      if (j?.error?.retryable === true) retryable = true;
    } catch {
      /* non-JSON error bodies are treated as transient when 5xx */
    }
    return { ok: false, retryable, status: res.status, code };
  } catch {
    return { ok: false, retryable: true, status: null, code: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

export type OutboxRow = {
  id: number;
  profile_id: number;
  idempotency_key: string;
  body: string;
  attempts: number;
};

export interface CallbackOutbox {
  /** Claim up to `limit` due rows (lease them so two drains do not double-send). */
  claimDue(limit: number, nowMs: number): Promise<OutboxRow[]>;
  markDone(id: number, attempts: number): Promise<void>;
  markRetry(id: number, attempts: number, nextAttemptAtMs: number, code: string): Promise<void>;
  markDead(id: number, attempts: number, code: string): Promise<void>;
}

/** Deliver due rows. Permanent errors and the 8th failure go to "dead". */
export async function drainCallbacks(args: {
  outbox: CallbackOutbox;
  url: string;
  secret: string;
  nowMs: number;
  limit?: number;
  fetchImpl?: typeof fetch;
  onDead?: (row: OutboxRow, code: string) => Promise<void>;
}): Promise<{ delivered: number; retried: number; dead: number }> {
  const rows = await args.outbox.claimDue(args.limit ?? 10, args.nowMs);
  let delivered = 0;
  let retried = 0;
  let dead = 0;
  for (const row of rows) {
    const attempts = row.attempts + 1;
    const out = await sendCallback({
      url: args.url,
      secret: args.secret,
      key: row.idempotency_key,
      bodyJson: row.body,
      nowMs: args.nowMs,
      fetchImpl: args.fetchImpl,
    });
    if (out.ok) {
      await args.outbox.markDone(row.id, attempts);
      delivered += 1;
    } else if (out.retryable && attempts < MAX_CALLBACK_ATTEMPTS) {
      await args.outbox.markRetry(row.id, attempts, args.nowMs + callbackBackoffMs(attempts), out.code);
      retried += 1;
    } else {
      await args.outbox.markDead(row.id, attempts, out.code);
      dead += 1;
      if (args.onDead) await args.onDead(row, out.code).catch(() => undefined);
    }
  }
  return { delivered, retried, dead };
}
