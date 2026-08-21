/**
 * Period sales (revenue credits − debits) grouped by where they were booked.
 */
import { round2 } from '@/lib/accounting/server';

export type SalesOriginKind = 'invoice' | 'bank' | 'manual' | 'other';

export type SalesOriginBucket = {
  kind: SalesOriginKind;
  label: string;
  amount: number;
  count: number;
};

export type SalesOriginLine = {
  journalId: number;
  date: string;
  kind: SalesOriginKind;
  source: string;
  label: string;
  counterparty: string | null;
  accountCode: string;
  accountName: string;
  amount: number;
};

export type SalesOrigin = {
  total: number;
  buckets: SalesOriginBucket[];
  lines: SalesOriginLine[];
};

const KIND_ORDER: SalesOriginKind[] = ['invoice', 'bank', 'manual', 'other'];

export function salesOriginBucketLabel(kind: SalesOriginKind): string {
  if (kind === 'invoice') return 'Issued invoices';
  if (kind === 'bank') return 'Bank coded to sales';
  if (kind === 'manual') return 'Manual journals';
  return 'Other journals';
}

export function isLiveSalesJournal(je: Record<string, unknown>): boolean {
  const source = String(je.source || '').toLowerCase();
  if (source === 'year_end_close' || source === 'reversal') return false;
  if (asMeta(je.metadata).reversed_by_journal_id) return false;
  return true;
}

export function classifySalesSource(
  source: string | null | undefined
): SalesOriginKind {
  const s = String(source || '').toLowerCase();
  if (s === 'invoice_recognition') return 'invoice';
  if (s === 'bank_allocation') return 'bank';
  if (!s || s === 'manual' || s === 'journal' || s === 'user') return 'manual';
  return 'other';
}

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function invoiceRefFromJournal(opts: {
  memo?: string | null;
  metadata?: unknown;
}): string | null {
  const meta = asMeta(opts.metadata);
  const fromMeta = meta.invoice_number;
  if (fromMeta != null && String(fromMeta).trim()) {
    return String(fromMeta).trim();
  }
  const memo = String(opts.memo || '');
  const inv = memo.match(/\b(INV[-A-Z0-9]+)\b/i);
  if (inv?.[1]) return inv[1];
  const recognise = memo.match(/recognise\s+(?:ar|ap)\s+(\S+)/i);
  if (recognise?.[1]) return recognise[1];
  return null;
}

export function lineLabel(opts: {
  kind: SalesOriginKind;
  memo?: string | null;
  metadata?: unknown;
  accountName?: string;
}): string {
  const inv = invoiceRefFromJournal(opts);
  if (inv) return inv;
  const memo = String(opts.memo || '').trim();
  if (memo) return memo.slice(0, 80);
  if (opts.kind === 'bank') return 'Bank allocation';
  if (opts.kind === 'invoice') return 'Issued invoice';
  return opts.accountName || 'Sales';
}

export function emptySalesOrigin(): SalesOrigin {
  return {
    total: 0,
    buckets: KIND_ORDER.map((kind) => ({
      kind,
      label: salesOriginBucketLabel(kind),
      amount: 0,
      count: 0,
    })),
    lines: [],
  };
}

export function buildSalesOrigin(opts: {
  entries: Array<Record<string, unknown>>;
  lines: Array<{
    account_id: number;
    debit: number;
    credit: number;
    journal_entry_id?: number;
    memo?: string | null;
    counterparty?: string | null;
  }>;
  accounts: Array<{
    id: number;
    code: string;
    name: string;
    account_type: string;
    is_header?: boolean;
  }>;
}): SalesOrigin {
  const revenueIds = new Set<number>();
  const acctById = new Map<number, { code: string; name: string }>();
  for (const a of opts.accounts) {
    if (a.is_header) continue;
    const id = Number(a.id);
    if (!Number.isFinite(id)) continue;
    acctById.set(id, { code: String(a.code || ''), name: String(a.name || '') });
    const t = String(a.account_type || '').toLowerCase();
    if (t === 'revenue' || t === 'income' || t === 'sales') revenueIds.add(id);
  }

  const byId = new Map<number, Record<string, unknown>>();
  for (const e of opts.entries) {
    const id = Number(e.id);
    if (Number.isFinite(id)) byId.set(id, e);
  }

  const bucketMap = new Map<SalesOriginKind, { amount: number; count: number }>();
  for (const k of KIND_ORDER) bucketMap.set(k, { amount: 0, count: 0 });

  const lines: SalesOriginLine[] = [];
  for (const l of opts.lines) {
    const aid = Number(l.account_id);
    if (!revenueIds.has(aid)) continue;
    const jid = Number(l.journal_entry_id);
    const je = byId.get(jid);
    if (!je) continue;
    if (!isLiveSalesJournal(je)) continue;
    const amount = round2(Number(l.credit || 0) - Number(l.debit || 0));
    if (Math.abs(amount) < 0.005) continue;
    const source = String(je.source || 'manual');
    const kind = classifySalesSource(source);
    const acct = acctById.get(aid);
    const memo = l.memo != null ? String(l.memo) : je.memo != null ? String(je.memo) : null;
    lines.push({
      journalId: jid,
      date: String(je.entry_date || '').slice(0, 10),
      kind,
      source,
      label: lineLabel({
        kind,
        memo,
        metadata: je.metadata,
        accountName: acct?.name,
      }),
      counterparty: l.counterparty
        ? String(l.counterparty)
        : je.counterparty
          ? String(je.counterparty)
          : null,
      accountCode: acct?.code || '',
      accountName: acct?.name || 'Sales',
      amount,
    });
    const b = bucketMap.get(kind)!;
    b.amount = round2(b.amount + amount);
    b.count += 1;
  }

  lines.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return Math.abs(b.amount) - Math.abs(a.amount);
  });

  const buckets = KIND_ORDER.map((kind) => {
    const b = bucketMap.get(kind)!;
    return {
      kind,
      label: salesOriginBucketLabel(kind),
      amount: round2(b.amount),
      count: b.count,
    };
  });
  const total = round2(buckets.reduce((s, b) => s + b.amount, 0));

  return dropBankSalesAlreadyInvoiced({ total, buckets, lines });
}

/** Bank coded to income for an invoice that is already recognised is not a second sale. */
export function dropBankSalesAlreadyInvoiced(origin: SalesOrigin): SalesOrigin {
  const invoiceRefs = new Set(
    origin.lines
      .filter((l) => l.kind === 'invoice')
      .map((l) => l.label.trim().toUpperCase())
      .filter((s) => s.startsWith('INV'))
  );
  if (!invoiceRefs.size) return origin;
  const lines = origin.lines.filter((l) => {
    if (l.kind !== 'bank') return true;
    const label = l.label.trim().toUpperCase();
    if (invoiceRefs.has(label)) return false;
    for (const ref of invoiceRefs) {
      if (label.includes(ref)) return false;
    }
    return true;
  });
  if (lines.length === origin.lines.length) return origin;
  const bucketMap = new Map<SalesOriginKind, { amount: number; count: number }>();
  for (const k of KIND_ORDER) bucketMap.set(k, { amount: 0, count: 0 });
  for (const l of lines) {
    const b = bucketMap.get(l.kind)!;
    b.amount = round2(b.amount + l.amount);
    b.count += 1;
  }
  const buckets = KIND_ORDER.map((kind) => {
    const b = bucketMap.get(kind)!;
    return {
      kind,
      label: salesOriginBucketLabel(kind),
      amount: round2(b.amount),
      count: b.count,
    };
  });
  return {
    total: round2(buckets.reduce((s, b) => s + b.amount, 0)),
    buckets,
    lines,
  };
}

export type AccountPosting = {
  journalId: number;
  date: string;
  documentNumber: string | null;
  memo: string | null;
  source: string;
  counterparty: string | null;
  amount: number;
};

/** Signed postings for one P&L account (revenue = credit−debit, expense/cogs = debit−credit). */
export function collectAccountPostings(opts: {
  accountId: number;
  polarity: 'revenue' | 'expense';
  entries: Array<Record<string, unknown>>;
  lines: Array<{
    account_id: number;
    debit: number;
    credit: number;
    journal_entry_id?: number;
    memo?: string | null;
    counterparty?: string | null;
  }>;
}): AccountPosting[] {
  const byId = new Map<number, Record<string, unknown>>();
  for (const e of opts.entries) {
    const id = Number(e.id);
    if (Number.isFinite(id)) byId.set(id, e);
  }
  const out: AccountPosting[] = [];
  for (const l of opts.lines) {
    if (Number(l.account_id) !== opts.accountId) continue;
    const jid = Number(l.journal_entry_id);
    const je = byId.get(jid);
    if (!je) continue;
    if (!isLiveSalesJournal(je)) continue;
    const raw = round2(Number(l.credit || 0) - Number(l.debit || 0));
    const amount = opts.polarity === 'revenue' ? raw : round2(-raw);
    if (Math.abs(amount) < 0.005) continue;
    const memo = l.memo != null ? String(l.memo) : je.memo != null ? String(je.memo) : null;
    out.push({
      journalId: jid,
      date: String(je.entry_date || '').slice(0, 10),
      documentNumber:
        je.entry_number != null ? String(je.entry_number) : null,
      memo,
      source: String(je.source || 'manual'),
      counterparty: l.counterparty
        ? String(l.counterparty)
        : je.counterparty
          ? String(je.counterparty)
          : null,
      amount,
    });
  }
  out.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  return out;
}
