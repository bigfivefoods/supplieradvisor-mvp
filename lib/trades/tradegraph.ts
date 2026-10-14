/**
 * TradeAdvisor® domain — quotes, jobs, invoices, materials, schedule,
 * compliance, and the customer-facing view. Client-safe: no database,
 * no Privy, no pdfkit.
 *
 * Money is integer cents. VAT is exclusive (South Africa default 15%).
 */

import {
  TRADE_PHOTO_MAX_CHARS,
  TRADE_PHOTO_MAX_COUNT,
} from '@/lib/trades/photo-limits';

export const TRADE_MODULE_ID = 'tradegraph';
export const TRADE_PACK_ID = 'trades';
export const SA_VAT_RATE = 0.15;
/** Big Five Connect sandbox — the demo / control-plane company. */
export const TRADE_DEMO_COMPANY_ID = 5743;
export const DEMO_PUBLIC_TOKEN = 'demo';

export const TRADE_KINDS = [
  'electrician',
  'plumber',
  'builder',
  'painter',
  'hvac',
  'handyman',
  'other',
] as const;
export type TradeKind = (typeof TRADE_KINDS)[number];

export const QUOTE_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'declined',
  'expired',
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const JOB_STATUSES = [
  'enquiry',
  'quoted',
  'scheduled',
  'in_progress',
  'done',
  'invoiced',
  'paid',
  'cancelled',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const INVOICE_STATUSES = ['issued', 'part_paid', 'paid', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const COMPLIANCE_KINDS = ['coc', 'pirb', 'gas', 'other'] as const;
export type ComplianceKind = (typeof COMPLIANCE_KINDS)[number];

export type QuoteLine = {
  id: string;
  description: string;
  qty: number;
  unit_cents: number;
};

export type TradeCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  suburb: string;
  city: string;
};

export type TradeQuote = {
  id: string;
  number: string;
  customer_id: string;
  status: QuoteStatus;
  title: string;
  lines: QuoteLine[];
  source_request_id: string | null;
  created_at: string;
};

export type JobUpdate = {
  id: string;
  at: string;
  note: string;
  progress_pct: number;
  photo_url: string | null;
  shared: boolean;
};

export type TradeJob = {
  id: string;
  number: string;
  customer_id: string;
  quote_id: string | null;
  title: string;
  status: JobStatus;
  address: string;
  progress_pct: number;
  lines: QuoteLine[];
  updates: JobUpdate[];
};

export type TradeInvoice = {
  id: string;
  number: string;
  customer_id: string;
  job_id: string;
  status: InvoiceStatus;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
  issued_at: string;
};

export type TradePayment = {
  id: string;
  invoice_id: string;
  customer_id: string;
  amount_cents: number;
  paid_at: string;
  method: string;
};

export type MaterialLine = {
  id: string;
  description: string;
  qty: number;
  unit_cents: number;
};

export type MaterialOrder = {
  id: string;
  supplier_id: number | null;
  supplier_name: string;
  job_id: string | null;
  status: 'draft' | 'ordered' | 'received';
  lines: MaterialLine[];
  created_at: string;
};

export type ScheduleSlot = {
  id: string;
  job_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  address: string;
};

export type ComplianceCert = {
  id: string;
  kind: ComplianceKind;
  number: string;
  holder: string;
  expires_on: string;
  job_id: string | null;
};

export type JobRequest = {
  id: string;
  customer_id: string;
  description: string;
  address: string;
  preferred_dates: string;
  photo_urls: string[];
  status: 'new' | 'quoted' | 'declined';
  created_at: string;
};

export type TradeSettings = {
  brand_name: string;
  trade: TradeKind;
  public_token: string;
  vat_rate: number;
  phone: string;
  city: string;
  notify_email: string;
};

export type TradegraphStore = {
  updated_at: string;
  settings: TradeSettings;
  customers: TradeCustomer[];
  quotes: TradeQuote[];
  jobs: TradeJob[];
  invoices: TradeInvoice[];
  payments: TradePayment[];
  materials: MaterialOrder[];
  schedule: ScheduleSlot[];
  compliance: ComplianceCert[];
  requests: JobRequest[];
};

export type MoneyTotals = {
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
};

export type ComplianceAlert = {
  id: string;
  kind: ComplianceKind;
  number: string;
  holder: string;
  expires_on: string;
  days: number;
  level: 'overdue' | 'due';
};

export type CustomerPortal = {
  brand: TradeSettings;
  customer: TradeCustomer;
  jobs: TradeJob[];
  quotes: TradeQuote[];
  invoices: TradeInvoice[];
  payments: TradePayment[];
  requests: JobRequest[];
  invoiced_cents: number;
  paid_cents: number;
  balance_cents: number;
};

const PHOTO_MAX = TRADE_PHOTO_MAX_CHARS;
const MAX_PHOTOS = TRADE_PHOTO_MAX_COUNT;

export function newId(prefix: string): string {
  const raw =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${raw.replace(/-/g, '').slice(0, 12)}`;
}

export function formatZar(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(Number(cents) || 0));
  const rands = Math.floor(abs / 100);
  const rem = abs % 100;
  const grouped = rands.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}R${grouped}.${rem.toString().padStart(2, '0')}`;
}

export function quoteTotals(lines: QuoteLine[], vatRate = SA_VAT_RATE): MoneyTotals {
  const subtotal_cents = lines.reduce(
    (sum, line) => sum + Math.round(Number(line.qty) * Number(line.unit_cents)),
    0
  );
  const vat_cents = Math.round(subtotal_cents * vatRate);
  return {
    subtotal_cents,
    vat_cents,
    total_cents: subtotal_cents + vat_cents,
  };
}

export function materialOrderCents(order: MaterialOrder): number {
  return order.lines.reduce(
    (sum, line) => sum + Math.round(Number(line.qty) * Number(line.unit_cents)),
    0
  );
}

export function emptyTradeStore(now: string, token = ''): TradegraphStore {
  return {
    updated_at: now,
    settings: {
      brand_name: '',
      trade: 'handyman',
      public_token: token,
      vat_rate: SA_VAT_RATE,
      phone: '',
      city: '',
      notify_email: '',
    },
    customers: [],
    quotes: [],
    jobs: [],
    invoices: [],
    payments: [],
    materials: [],
    schedule: [],
    compliance: [],
    requests: [],
  };
}

export function shouldSeedDemoAccount(opts: {
  companyId: number;
  tradingName?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  if (opts.companyId === TRADE_DEMO_COMPANY_ID) return true;
  if (/\bdemo\b/i.test(String(opts.tradingName || ''))) return true;
  const meta = opts.metadata || {};
  return meta.demo === true || meta.tradegraph_demo === true;
}

function cloneLines(lines: QuoteLine[]): QuoteLine[] {
  return lines.map((line) => ({ ...line, id: newId('tl') }));
}

function nextNumber(prefix: string, existing: string[]): string {
  const nums = existing
    .map((value) => Number(String(value).replace(/\D/g, '')))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 1000) + 1;
  return `${prefix}-${next}`;
}

export function acceptQuote(
  store: TradegraphStore,
  quoteId: string,
  now: string
): TradegraphStore {
  const quote = store.quotes.find((row) => row.id === quoteId);
  if (!quote) throw new Error('Quote not found');
  if (quote.status === 'declined' || quote.status === 'expired') {
    throw new Error('This quote can no longer be accepted');
  }
  const existing = store.jobs.find((job) => job.quote_id === quote.id);
  if (quote.status === 'accepted' && existing) return store;
  const customer = store.customers.find((row) => row.id === quote.customer_id);
  const job: TradeJob = {
    id: newId('tj'),
    number: nextNumber('J', store.jobs.map((row) => row.number)),
    customer_id: quote.customer_id,
    quote_id: quote.id,
    title: quote.title,
    status: 'scheduled',
    address: customer?.address || '',
    progress_pct: 0,
    lines: cloneLines(quote.lines),
    updates: [],
  };
  return {
    ...store,
    updated_at: now,
    quotes: store.quotes.map((row) =>
      row.id === quote.id ? { ...row, status: 'accepted' } : row
    ),
    jobs: [...store.jobs, job],
  };
}

export function addJobUpdate(
  store: TradegraphStore,
  jobId: string,
  update: Omit<JobUpdate, 'id' | 'at'> & { at?: string },
  now: string
): TradegraphStore {
  const job = store.jobs.find((row) => row.id === jobId);
  if (!job) throw new Error('Job not found');
  const progress = Math.max(0, Math.min(100, Math.round(update.progress_pct)));
  const nextUpdate: JobUpdate = {
    id: newId('tu'),
    at: update.at || now,
    note: String(update.note || '').slice(0, 2000),
    progress_pct: progress,
    photo_url: update.photo_url ? String(update.photo_url).slice(0, PHOTO_MAX) : null,
    shared: Boolean(update.shared),
  };
  if (update.photo_url && String(update.photo_url).length > PHOTO_MAX) {
    throw new Error('Photo is too large');
  }
  let status = job.status;
  if (status !== 'cancelled' && status !== 'invoiced') {
    if (progress >= 100) status = 'done';
    else if (progress > 0) status = 'in_progress';
  }
  return {
    ...store,
    updated_at: now,
    jobs: store.jobs.map((row) =>
      row.id === job.id
        ? {
            ...row,
            status,
            progress_pct: progress,
            updates: [...row.updates, nextUpdate],
          }
        : row
    ),
  };
}

export function invoiceJob(
  store: TradegraphStore,
  jobId: string,
  now: string
): TradegraphStore {
  const job = store.jobs.find((row) => row.id === jobId);
  if (!job) throw new Error('Job not found');
  if (job.status === 'cancelled') throw new Error('Cancelled jobs are not invoiced');
  const open = store.invoices.find(
    (row) => row.job_id === job.id && row.status !== 'void'
  );
  if (open) return store;
  const totals = quoteTotals(job.lines, store.settings.vat_rate);
  const invoice: TradeInvoice = {
    id: newId('ti'),
    number: nextNumber('INV', store.invoices.map((row) => row.number)),
    customer_id: job.customer_id,
    job_id: job.id,
    status: 'issued',
    ...totals,
    issued_at: now,
  };
  return {
    ...store,
    updated_at: now,
    jobs: store.jobs.map((row) =>
      row.id === job.id ? { ...row, status: 'invoiced' } : row
    ),
    invoices: [...store.invoices, invoice],
  };
}

export function recordPayment(
  store: TradegraphStore,
  invoiceId: string,
  amountCents: number,
  method: string,
  now: string
): TradegraphStore {
  const invoice = store.invoices.find((row) => row.id === invoiceId);
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status === 'void') throw new Error('Void invoices cannot take payment');
  const amount = Math.round(amountCents);
  if (amount <= 0) throw new Error('Enter a payment amount');
  const paid = store.payments
    .filter((row) => row.invoice_id === invoice.id)
    .reduce((sum, row) => sum + row.amount_cents, 0);
  const remaining = invoice.total_cents - paid;
  if (amount > remaining) throw new Error('Payment is more than the balance');
  const payment: TradePayment = {
    id: newId('tp'),
    invoice_id: invoice.id,
    customer_id: invoice.customer_id,
    amount_cents: amount,
    paid_at: now,
    method: method || 'EFT',
  };
  const nextPaid = paid + amount;
  const status: InvoiceStatus =
    nextPaid >= invoice.total_cents ? 'paid' : 'part_paid';
  return {
    ...store,
    updated_at: now,
    payments: [...store.payments, payment],
    invoices: store.invoices.map((row) =>
      row.id === invoice.id ? { ...row, status } : row
    ),
  };
}

export function requestToQuote(
  store: TradegraphStore,
  requestId: string,
  now: string
): TradegraphStore {
  const request = store.requests.find((row) => row.id === requestId);
  if (!request) throw new Error('Request not found');
  if (request.status === 'quoted') {
    const existing = store.quotes.find(
      (row) => row.source_request_id === request.id
    );
    if (existing) return store;
  }
  const quote: TradeQuote = {
    id: newId('tq'),
    number: nextNumber('Q', store.quotes.map((row) => row.number)),
    customer_id: request.customer_id,
    status: 'draft',
    title: request.description.slice(0, 80),
    lines: [
      {
        id: newId('tl'),
        description: request.description.slice(0, 240),
        qty: 1,
        unit_cents: 0,
      },
    ],
    source_request_id: request.id,
    created_at: now,
  };
  return {
    ...store,
    updated_at: now,
    quotes: [...store.quotes, quote],
    requests: store.requests.map((row) =>
      row.id === request.id ? { ...row, status: 'quoted' } : row
    ),
  };
}

export function createJobRequest(
  store: TradegraphStore,
  input: {
    customer_id: string;
    description: string;
    address: string;
    preferred_dates: string;
    photo_urls?: string[];
    now: string;
  }
): TradegraphStore {
  const description = String(input.description || '').trim();
  if (description.length < 8) throw new Error('Describe the job in a sentence');
  const photos = (input.photo_urls || []).slice(0, MAX_PHOTOS);
  for (const photo of photos) {
    if (String(photo).length > PHOTO_MAX) throw new Error('Photo is too large');
  }
  const request: JobRequest = {
    id: newId('tr'),
    customer_id: input.customer_id,
    description: description.slice(0, 4000),
    address: String(input.address || '').slice(0, 500),
    preferred_dates: String(input.preferred_dates || '').slice(0, 200),
    photo_urls: photos,
    status: 'new',
    created_at: input.now,
  };
  return {
    ...store,
    updated_at: input.now,
    requests: [request, ...store.requests],
  };
}

export function statementFigures(
  invoices: TradeInvoice[],
  payments: TradePayment[]
): { invoiced_cents: number; paid_cents: number; balance_cents: number } {
  const live = invoices.filter((row) => row.status !== 'void');
  const invoiced_cents = live.reduce((sum, row) => sum + row.total_cents, 0);
  const ids = new Set(live.map((row) => row.id));
  const paid_cents = payments
    .filter((row) => ids.has(row.invoice_id))
    .reduce((sum, row) => sum + row.amount_cents, 0);
  return {
    invoiced_cents,
    paid_cents,
    balance_cents: invoiced_cents - paid_cents,
  };
}

export function customerPortalView(
  store: TradegraphStore,
  customerId: string
): CustomerPortal {
  const customer = store.customers.find((row) => row.id === customerId);
  if (!customer) throw new Error('Customer not found');
  const jobs = store.jobs
    .filter((row) => row.customer_id === customerId && row.status !== 'cancelled')
    .map((row) => ({
      ...row,
      updates: row.updates.filter((update) => update.shared),
    }));
  const quotes = store.quotes.filter(
    (row) => row.customer_id === customerId && row.status !== 'draft'
  );
  const invoices = store.invoices.filter(
    (row) => row.customer_id === customerId && row.status !== 'void'
  );
  const payments = store.payments.filter((row) => row.customer_id === customerId);
  const requests = store.requests.filter((row) => row.customer_id === customerId);
  return {
    brand: store.settings,
    customer,
    jobs,
    quotes,
    invoices,
    payments,
    requests,
    ...statementFigures(invoices, payments),
  };
}

export function complianceReminders(
  certs: ComplianceCert[],
  todayIso: string,
  withinDays = 30
): ComplianceAlert[] {
  const today = Date.parse(`${todayIso.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(today)) return [];
  const alerts: ComplianceAlert[] = [];
  for (const cert of certs) {
    const exp = Date.parse(`${cert.expires_on.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(exp)) continue;
    const days = Math.round((exp - today) / 86_400_000);
    if (days < 0) {
      alerts.push({ ...cert, days, level: 'overdue' });
    } else if (days <= withinDays) {
      alerts.push({ ...cert, days, level: 'due' });
    }
  }
  return alerts.sort((a, b) => a.days - b.days);
}

export function summariseTradegraph(store: TradegraphStore, todayIso: string) {
  const openQuotes = store.quotes.filter((row) =>
    row.status === 'draft' || row.status === 'sent'
  );
  const activeJobs = store.jobs.filter(
    (row) => row.status === 'scheduled' || row.status === 'in_progress'
  );
  const figures = statementFigures(store.invoices, store.payments);
  return {
    customers: store.customers.length,
    open_quotes: openQuotes.length,
    active_jobs: activeJobs.length,
    new_requests: store.requests.filter((row) => row.status === 'new').length,
    balance_cents: figures.balance_cents,
    compliance_alerts: complianceReminders(store.compliance, todayIso).length,
    materials_open: store.materials.filter((row) => row.status !== 'received').length,
  };
}

export function customerAppPath(publicToken: string): string {
  return `/customer/tradegraph/${encodeURIComponent(publicToken)}`;
}

export function joinPath(publicToken: string): string {
  return `/join/tradegraph/${encodeURIComponent(publicToken)}`;
}

export function isPublicTradeToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{2,80}$/.test(value);
}

/** Stable Cape Town sample book for the demo account and the public preview. */
export function seedDemoTradegraph(now: string, publicToken?: string): TradegraphStore {
  const day = now.slice(0, 10);
  const soon = shiftDate(day, 18);
  const overdue = shiftDate(day, -9);
  const later = shiftDate(day, 400);
  const slotStart = `${shiftDate(day, 1)}T07:00:00.000Z`;
  const slotEnd = `${shiftDate(day, 1)}T10:00:00.000Z`;
  const thandi: TradeCustomer = {
    id: 'tc_demo_thandi',
    name: 'Thandi Nkosi',
    email: 'thandi@example.com',
    phone: '082 555 0142',
    address: '14 Balfour Road',
    suburb: 'Rondebosch',
    city: 'Cape Town',
  };
  const sipho: TradeCustomer = {
    id: 'tc_demo_sipho',
    name: 'Sipho Dlamini',
    email: 'sipho@example.com',
    phone: '083 555 0198',
    address: '8 Voortrekker Road',
    suburb: 'Bellville',
    city: 'Cape Town',
  };
  const boardLines: QuoteLine[] = [
    {
      id: 'tl_demo_labour',
      description: 'Labour — DB board replacement',
      qty: 1,
      unit_cents: 240_000,
    },
    {
      id: 'tl_demo_board',
      description: 'Board, breakers and glands',
      qty: 1,
      unit_cents: 315_000,
    },
  ];
  const quote: TradeQuote = {
    id: 'tq_demo_board',
    number: 'Q-1042',
    customer_id: thandi.id,
    status: 'accepted',
    title: 'DB board replacement',
    lines: boardLines,
    source_request_id: null,
    created_at: now,
  };
  const geyser: TradeQuote = {
    id: 'tq_demo_geyser',
    number: 'Q-1048',
    customer_id: sipho.id,
    status: 'sent',
    title: 'Geyser isolator and leak repair',
    lines: [
      {
        id: 'tl_demo_geyser',
        description: 'Isolator, drip tray and labour',
        qty: 1,
        unit_cents: 185_000,
      },
    ],
    source_request_id: null,
    created_at: now,
  };
  const totals = quoteTotals(boardLines, SA_VAT_RATE);
  const job: TradeJob = {
    id: 'tj_demo_board',
    number: 'J-1008',
    customer_id: thandi.id,
    quote_id: quote.id,
    title: quote.title,
    status: 'in_progress',
    address: `${thandi.address}, ${thandi.suburb}`,
    progress_pct: 60,
    lines: boardLines,
    updates: [
      {
        id: 'tu_demo_board',
        at: now,
        note: 'Board is mounted. Waiting on the municipality seal before the cover goes on.',
        progress_pct: 60,
        photo_url: '/sa-icon-192.png',
        shared: true,
      },
      {
        id: 'tu_demo_private',
        at: now,
        note: 'Old breakers are cracked — do not put this note on the customer app.',
        progress_pct: 60,
        photo_url: null,
        shared: false,
      },
    ],
  };
  return {
    updated_at: now,
    settings: {
      brand_name: 'Harbour Trades',
      trade: 'electrician',
      public_token: publicToken || 'tg_demo_harbour',
      vat_rate: SA_VAT_RATE,
      phone: '021 555 0170',
      city: 'Cape Town',
      notify_email: 'desk@example.com',
    },
    customers: [thandi, sipho],
    quotes: [quote, geyser],
    jobs: [job],
    invoices: [
      {
        id: 'ti_demo_board',
        number: 'INV-220',
        customer_id: thandi.id,
        job_id: job.id,
        status: 'part_paid',
        ...totals,
        issued_at: now,
      },
    ],
    payments: [
      {
        id: 'tp_demo_eft',
        invoice_id: 'ti_demo_board',
        customer_id: thandi.id,
        amount_cents: 200_000,
        paid_at: now,
        method: 'EFT',
      },
    ],
    materials: [
      {
        id: 'tm_demo_cable',
        supplier_id: null,
        supplier_name: 'Voltex Cape Town',
        job_id: job.id,
        status: 'ordered',
        created_at: now,
        lines: [
          {
            id: 'tl_demo_cable',
            description: '2.5mm twin and earth',
            qty: 20,
            unit_cents: 1_850,
          },
        ],
      },
    ],
    schedule: [
      {
        id: 'ts_demo_thandi',
        job_id: job.id,
        title: 'Seal and cover — Thandi Nkosi',
        starts_at: slotStart,
        ends_at: slotEnd,
        address: `${thandi.address}, ${thandi.suburb}`,
      },
    ],
    compliance: [
      {
        id: 'tx_demo_coc',
        kind: 'coc',
        number: 'COC-2026-118',
        holder: 'Harbour Trades',
        expires_on: soon,
        job_id: job.id,
      },
      {
        id: 'tx_demo_pirb',
        kind: 'pirb',
        number: 'PIRB-4481',
        holder: 'A. Jacobs',
        expires_on: overdue,
        job_id: null,
      },
      {
        id: 'tx_demo_gas',
        kind: 'gas',
        number: 'GAS-77',
        holder: 'Harbour Trades',
        expires_on: later,
        job_id: null,
      },
    ],
    requests: [
      {
        id: 'tr_demo_light',
        customer_id: thandi.id,
        description: 'Outside light trips the breaker at night after rain.',
        address: `${thandi.address}, ${thandi.suburb}`,
        preferred_dates: 'Next Wednesday morning',
        photo_urls: [],
        status: 'new',
        created_at: now,
      },
    ],
  };
}

function shiftDate(isoDay: string, days: number): string {
  const t = Date.parse(`${isoDay}T00:00:00Z`);
  const next = new Date(t + days * 86_400_000);
  return next.toISOString().slice(0, 10);
}

/** Second filter after RLS. Drops any row that is not this customer's. */
export function portalFromRows(raw: {
  brand?: Partial<TradeSettings> | null;
  customer?: Partial<TradeCustomer> | null;
  jobs?: TradeJob[] | null;
  quotes?: TradeQuote[] | null;
  invoices?: TradeInvoice[] | null;
  payments?: TradePayment[] | null;
  requests?: JobRequest[] | null;
}): CustomerPortal {
  const customerId = String(raw.customer?.id || '');
  const now = new Date().toISOString();
  const store = emptyTradeStore(now, raw.brand?.public_token || '');
  store.settings = {
    ...store.settings,
    ...raw.brand,
    notify_email: '',
    trade: raw.brand?.trade || store.settings.trade,
    vat_rate: Number(raw.brand?.vat_rate || store.settings.vat_rate),
  };
  store.customers = [
    {
      id: customerId,
      name: String(raw.customer?.name || ''),
      email: String(raw.customer?.email || ''),
      phone: String(raw.customer?.phone || ''),
      address: String(raw.customer?.address || ''),
      suburb: String(raw.customer?.suburb || ''),
      city: String(raw.customer?.city || ''),
    },
  ];
  store.jobs = (raw.jobs || []).map((job) => ({
    ...job,
    lines: job.lines || [],
    updates: job.updates || [],
  }));
  store.quotes = raw.quotes || [];
  store.invoices = raw.invoices || [];
  store.payments = raw.payments || [];
  store.requests = raw.requests || [];
  return customerPortalView(store, customerId);
}

export function complianceLabel(kind: ComplianceKind): string {
  if (kind === 'coc') return 'Electrical CoC';
  if (kind === 'pirb') return 'PIRB certificate';
  if (kind === 'gas') return 'Gas CoC';
  return 'Other certificate';
}
