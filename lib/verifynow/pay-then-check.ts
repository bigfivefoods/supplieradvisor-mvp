/**
 * Pay-then-verify rules for company-profile VerifyNow checks.
 * One Paystack reference pays for one check. A delivered result is not run again.
 * A technical failure can be retried on the same reference or refunded.
 */
import { customerPriceFor, type PricedCheck } from '@/lib/verifynow/prices';

export const FIELD_CHECK_IDS = [
  'cipc_company_match',
  'cipc_director_search',
  'said_verification',
  'bank_account',
  'aml_pep',
  'supplier_bundle',
] as const;

export type FieldCheckRefId = (typeof FIELD_CHECK_IDS)[number];

const CONSUMED = new Set([
  'match',
  'mismatch',
  'verified',
  'clear',
  'review',
  'failed',
  'pending',
]);

const REF_RE = new RegExp(`^sa-vn-(${FIELD_CHECK_IDS.join('|')})-(\\d+)-(\\d+)$`);

export type ParsedFieldCheckRef = {
  check: FieldCheckRefId;
  companyId: number;
  nonce: string;
};

export type StoredPayment = {
  status?: string | null;
  paystack_reference?: string | null;
  payment_status?: string | null;
  idempotency_key?: string | null;
  provider_attempted?: boolean | null;
};

export type PaidDecision =
  | { action: 'replay' }
  | { action: 'retry' | 'run'; idempotencyKey: string }
  | { action: 'refund' }
  | { action: 'reject'; httpStatus: number; error: string };

export function buildFieldCheckReference(
  check: FieldCheckRefId,
  companyId: number,
  nowMs: number
): string {
  return `sa-vn-${check}-${companyId}-${nowMs}`;
}

export function parseFieldCheckReference(reference: string): ParsedFieldCheckRef | null {
  const match = REF_RE.exec(String(reference || '').trim());
  if (!match) return null;
  const companyId = Number(match[2]);
  if (!Number.isFinite(companyId) || companyId <= 0) return null;
  return {
    check: match[1] as FieldCheckRefId,
    companyId,
    nonce: match[3],
  };
}

export function isFieldCheckCharge(data: { reference?: unknown }): boolean {
  return parseFieldCheckReference(String(data.reference || '')) != null;
}

export function chargeMatchesPrice(paidCents: number, expectedCents: number): boolean {
  return Number.isFinite(paidCents) && paidCents >= expectedCents && expectedCents > 0;
}

export function paymentAlreadyConsumed(summary: StoredPayment | null | undefined, reference: string): boolean {
  if (!summary) return false;
  if (summary.paystack_reference !== reference) return false;
  if (summary.payment_status === 'refunded') return false;
  return CONSUMED.has(String(summary.status || ''));
}

export function canRetryPayment(summary: StoredPayment | null | undefined, reference: string): boolean {
  if (!reference) return false;
  if (!summary) return true;
  if (summary.paystack_reference !== reference) return false;
  if (summary.payment_status === 'refunded') return false;
  return summary.status === 'error';
}

export function canRefundPayment(summary: StoredPayment | null | undefined, reference: string): boolean {
  if (!reference) return false;
  if (!summary) return true;
  if (summary.paystack_reference !== reference) return false;
  if (summary.payment_status === 'refunded') return false;
  return summary.status === 'error';
}

export function readChargeMeta(data: Record<string, unknown>): Record<string, string> {
  const metaRaw = data.metadata;
  const meta =
    metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)
      ? (metaRaw as Record<string, unknown>)
      : {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (key === 'custom_fields') continue;
    if (value == null || typeof value === 'object') continue;
    out[key] = String(value);
  }
  const fields = meta.custom_fields;
  if (Array.isArray(fields)) {
    for (const field of fields) {
      if (!field || typeof field !== 'object') continue;
      const row = field as Record<string, unknown>;
      const key = String(row.variable_name || '');
      if (!key) continue;
      out[key] = String(row.value ?? '');
    }
  }
  return out;
}

export function decidePaidCheck(opts: {
  intent: 'run' | 'refund';
  reference: string;
  companyId: number;
  check: PricedCheck;
  asyncBank: boolean;
  paidAmountCents: number | null;
  existing?: StoredPayment | null;
  freshIdempotencyKey: string;
}): PaidDecision {
  const parsed = parseFieldCheckReference(opts.reference);
  if (!opts.reference || !parsed) {
    const price = customerPriceFor(opts.check, opts.asyncBank);
    return {
      action: 'reject',
      httpStatus: 402,
      error: `Payment is required before this check. Pay ${price.zar} (VAT inclusive) with Paystack, then the check runs.`,
    };
  }
  if (parsed.companyId !== opts.companyId || parsed.check !== opts.check) {
    return {
      action: 'reject',
      httpStatus: 400,
      error: 'This Paystack reference is for a different check.',
    };
  }

  const existing = opts.existing || null;
  if (opts.intent === 'refund') {
    if (existing?.payment_status === 'refunded' && existing.paystack_reference === opts.reference) {
      return { action: 'reject', httpStatus: 409, error: 'This payment was already refunded.' };
    }
    if (!canRefundPayment(existing, opts.reference)) {
      return {
        action: 'reject',
        httpStatus: 409,
        error: 'A completed check is not refunded. Refunds are only for a check that never delivered a result.',
      };
    }
    return { action: 'refund' };
  }

  if (existing?.payment_status === 'refunded' && existing.paystack_reference === opts.reference) {
    return {
      action: 'reject',
      httpStatus: 409,
      error: 'This payment was refunded, so the check cannot run on it.',
    };
  }
  if (paymentAlreadyConsumed(existing, opts.reference)) {
    return { action: 'replay' };
  }

  const expected = customerPriceFor(opts.check, opts.asyncBank).cents;
  if (opts.paidAmountCents == null || !chargeMatchesPrice(opts.paidAmountCents, expected)) {
    return {
      action: 'reject',
      httpStatus: 402,
      error: `Paid amount does not match the ${customerPriceFor(opts.check, opts.asyncBank).zar} price for this check.`,
    };
  }

  if (existing?.paystack_reference === opts.reference && existing.status === 'error') {
    if (
      existing.provider_attempted &&
      existing.idempotency_key &&
      existing.idempotency_key !== opts.freshIdempotencyKey
    ) {
      return {
        action: 'reject',
        httpStatus: 409,
        error:
          'The profile details changed after this payment. Refund it, or restore the details that were paid for, then retry.',
      };
    }
    return {
      action: 'retry',
      idempotencyKey: existing.provider_attempted
        ? String(existing.idempotency_key || opts.freshIdempotencyKey)
        : opts.freshIdempotencyKey,
    };
  }

  return { action: 'run', idempotencyKey: opts.freshIdempotencyKey };
}

/** Same payment replays a delivered component and retries a failed one with the same key. */
export function decideComponent(opts: {
  existing?: StoredPayment | null;
  reference: string;
  freshIdempotencyKey: string;
}): 'replay' | 'retry' | 'run' | 'blocked' {
  const existing = opts.existing;
  if (!existing || existing.paystack_reference !== opts.reference) return 'run';
  if (existing.payment_status === 'refunded') return 'blocked';
  if (CONSUMED.has(String(existing.status || ''))) return 'replay';
  if (existing.status !== 'error') return 'run';
  if (
    existing.provider_attempted &&
    existing.idempotency_key &&
    existing.idempotency_key !== opts.freshIdempotencyKey
  ) {
    return 'blocked';
  }
  return 'retry';
}
