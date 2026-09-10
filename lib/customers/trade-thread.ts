/**
 * Golden thread: storefront enquiry → quotation → accept + PO → deposit → processing.
 * Stored on customer_quotes.metadata.thread (no extra table).
 */

export const TRADE_THREAD_STAGES = [
  'enquiry',
  'quoted',
  'accepted',
  'deposit',
  'processing',
  'fulfilled',
] as const;

export type TradeThreadStage = (typeof TRADE_THREAD_STAGES)[number];

export type TradeThread = {
  stage: TradeThreadStage;
  source?: string | null;
  enquiry_number?: string | null;
  enquiry_at?: string | null;
  quoted_at?: string | null;
  accepted_at?: string | null;
  po_number?: string | null;
  deposit_percent?: number;
  deposit_invoice_id?: number | null;
  deposit_amount?: number | null;
  deposit_paid_at?: string | null;
  order_id?: number | null;
};

export const DEFAULT_DEPOSIT_PERCENT = 50;

export const THREAD_STEP_LABELS: { stage: TradeThreadStage; label: string; hint: string }[] =
  [
    {
      stage: 'enquiry',
      label: 'Enquiry',
      hint: 'Customer asked to order — not a commercial quotation yet',
    },
    {
      stage: 'quoted',
      label: 'Quotation',
      hint: 'Seller issued a quote on the portal and by email',
    },
    {
      stage: 'accepted',
      label: 'Accepted',
      hint: 'Customer approved the quote and gave a PO number',
    },
    {
      stage: 'deposit',
      label: 'Deposit',
      hint: 'Deposit invoice paid before production starts',
    },
    {
      stage: 'processing',
      label: 'Processing',
      hint: 'Sales order is in the house — fulfilment can start',
    },
    {
      stage: 'fulfilled',
      label: 'Fulfilled',
      hint: 'Order complete',
    },
  ];

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

export function stageFromStatus(status?: string | null): TradeThreadStage | null {
  const s = String(status || '').toLowerCase();
  if (s === 'enquiry') return 'enquiry';
  if (s === 'sent' || s === 'quoted' || s === 'issued') return 'quoted';
  if (s === 'accepted') return 'accepted';
  if (s === 'deposit_due' || s === 'deposit') return 'deposit';
  if (s === 'deposit_paid' || s === 'processing') return 'processing';
  if (s === 'converted' || s === 'fulfilled') return 'fulfilled';
  return null;
}

export function statusForStage(stage: TradeThreadStage): string {
  switch (stage) {
    case 'enquiry':
      return 'enquiry';
    case 'quoted':
      return 'sent';
    case 'accepted':
      return 'accepted';
    case 'deposit':
      return 'deposit_due';
    case 'processing':
      return 'deposit_paid';
    case 'fulfilled':
      return 'converted';
    default:
      return 'enquiry';
  }
}

export function parseTradeThread(
  metadata: unknown,
  status?: unknown
): TradeThread {
  const meta = asMeta(metadata);
  const raw =
    meta.thread && typeof meta.thread === 'object' && !Array.isArray(meta.thread)
      ? (meta.thread as Record<string, unknown>)
      : {};
  const fromStatus = stageFromStatus(status);
  const stageRaw = String(raw.stage || '');
  const stage = (TRADE_THREAD_STAGES as readonly string[]).includes(stageRaw)
    ? (stageRaw as TradeThreadStage)
    : fromStatus || 'enquiry';
  const pct = Number(raw.deposit_percent);
  return {
    stage,
    source: raw.source != null ? String(raw.source) : null,
    enquiry_number: raw.enquiry_number != null ? String(raw.enquiry_number) : null,
    enquiry_at: raw.enquiry_at != null ? String(raw.enquiry_at) : null,
    quoted_at: raw.quoted_at != null ? String(raw.quoted_at) : null,
    accepted_at: raw.accepted_at != null ? String(raw.accepted_at) : null,
    po_number: raw.po_number != null ? String(raw.po_number).trim() : null,
    deposit_percent:
      Number.isFinite(pct) && pct > 0 && pct <= 100
        ? pct
        : DEFAULT_DEPOSIT_PERCENT,
    deposit_invoice_id:
      raw.deposit_invoice_id != null ? Number(raw.deposit_invoice_id) : null,
    deposit_amount:
      raw.deposit_amount != null ? Number(raw.deposit_amount) : null,
    deposit_paid_at:
      raw.deposit_paid_at != null ? String(raw.deposit_paid_at) : null,
    order_id: raw.order_id != null ? Number(raw.order_id) : null,
  };
}

export function writeTradeThread(
  metadata: unknown,
  thread: TradeThread
): Record<string, unknown> {
  const meta = asMeta(metadata);
  meta.thread = { ...thread };
  return meta;
}

export function isStorefrontThread(thread: TradeThread): boolean {
  return String(thread.source || '') === 'storefront';
}

export function canIssueQuote(thread: TradeThread, status?: string | null): boolean {
  const s = String(status || '').toLowerCase();
  if (s === 'converted') return false;
  return thread.stage === 'enquiry' || s === 'enquiry' || s === 'draft';
}

export function canAcceptQuote(thread: TradeThread, status?: string | null): boolean {
  const s = String(status || '').toLowerCase();
  return thread.stage === 'quoted' || s === 'sent' || s === 'quoted';
}

export function canPayDeposit(thread: TradeThread): boolean {
  return (
    (thread.stage === 'accepted' || thread.stage === 'deposit') &&
    !thread.deposit_paid_at
  );
}

export function canStartProcessing(thread: TradeThread, status?: string | null): boolean {
  if (!isStorefrontThread(thread) && !thread.enquiry_at) {
    const s = String(status || '').toLowerCase();
    return s !== 'converted' && s !== 'enquiry';
  }
  return (
    thread.stage === 'processing' ||
    thread.stage === 'deposit' && Boolean(thread.deposit_paid_at) ||
    Boolean(thread.deposit_paid_at)
  );
}

export function depositAmountFromTotal(
  total: number,
  percent = DEFAULT_DEPOSIT_PERCENT
): number {
  const t = Math.max(0, Number(total) || 0);
  const p = Math.min(100, Math.max(1, Number(percent) || DEFAULT_DEPOSIT_PERCENT));
  return Math.round(t * (p / 100) * 100) / 100;
}

export function threadStepIndex(stage: TradeThreadStage): number {
  const i = TRADE_THREAD_STAGES.indexOf(stage);
  return i < 0 ? 0 : i;
}

export function newStorefrontEnquiryThread(opts: {
  enquiryNumber: string;
  now: string;
  depositPercent?: number;
}): TradeThread {
  return {
    stage: 'enquiry',
    source: 'storefront',
    enquiry_number: opts.enquiryNumber,
    enquiry_at: opts.now,
    deposit_percent: opts.depositPercent ?? DEFAULT_DEPOSIT_PERCENT,
  };
}
