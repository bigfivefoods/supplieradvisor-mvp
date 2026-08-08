/**
 * Company billing ledger — payment history on profiles.metadata.billing_ledger
 * Used for receipts, renewals UI, and ops.
 */

export type BillingLedgerKind =
  | 'core'
  | 'packs'
  | 'core_plus_packs'
  | 'renewal'
  | 'refund';

export type BillingLedgerEntry = {
  id: string;
  at: string;
  kind: BillingLedgerKind;
  /** Paystack reference */
  ref: string;
  amountZar: number;
  amountCents: number;
  currency: string;
  termId?: string | null;
  months?: number | null;
  packIds?: string[];
  channel?: string | null;
  invoiceNumber: string;
  planCode?: string | null;
  note?: string | null;
};

const MAX_LEDGER = 100;

export function readBillingLedger(
  meta: Record<string, unknown> | null | undefined
): BillingLedgerEntry[] {
  if (!meta || !Array.isArray(meta.billing_ledger)) return [];
  return (meta.billing_ledger as BillingLedgerEntry[]).filter(
    (e) => e && e.ref
  );
}

export function nextInvoiceNumber(
  existing: BillingLedgerEntry[],
  companyId: number,
  d = new Date()
): string {
  const day = d.toISOString().slice(0, 10).replace(/-/g, '');
  const seq =
    existing.filter((e) => e.invoiceNumber?.includes(day)).length + 1;
  return `SA-${companyId}-${day}-${seq}`;
}

export function appendBillingLedger(
  meta: Record<string, unknown>,
  entry: Omit<BillingLedgerEntry, 'id' | 'invoiceNumber'> & {
    id?: string;
    invoiceNumber?: string;
  },
  companyId: number
): { meta: Record<string, unknown>; entry: BillingLedgerEntry } {
  const ledger = readBillingLedger(meta);
  // Idempotent by ref
  const existing = ledger.find((e) => e.ref === entry.ref);
  if (existing) {
    return { meta, entry: existing };
  }
  const full: BillingLedgerEntry = {
    id: entry.id || `bl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: entry.at || new Date().toISOString(),
    kind: entry.kind,
    ref: entry.ref,
    amountZar: entry.amountZar,
    amountCents: entry.amountCents,
    currency: entry.currency || 'ZAR',
    termId: entry.termId ?? null,
    months: entry.months ?? null,
    packIds: entry.packIds || [],
    channel: entry.channel ?? null,
    invoiceNumber:
      entry.invoiceNumber || nextInvoiceNumber(ledger, companyId),
    planCode: entry.planCode ?? null,
    note: entry.note ?? null,
  };
  const next = [full, ...ledger].slice(0, MAX_LEDGER);
  return {
    meta: { ...meta, billing_ledger: next },
    entry: full,
  };
}

export function findLedgerEntry(
  meta: Record<string, unknown> | null | undefined,
  refOrInvoice: string
): BillingLedgerEntry | null {
  const ledger = readBillingLedger(meta);
  const q = String(refOrInvoice || '').trim();
  return (
    ledger.find((e) => e.ref === q || e.invoiceNumber === q || e.id === q) ||
    null
  );
}
