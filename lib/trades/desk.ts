/**
 * TradeAdvisor® desk — jobs, quotes, Gantt (plan vs actual), variation
 * orders, invoices, and the Harbour Plumbing sample book.
 * Client-safe: no database, no Privy, no pdfkit.
 *
 * Money is integer cents. VAT is exclusive at the South African 15% rate.
 */
import {
  SA_VAT_RATE,
  acceptQuote,
  createJobRequest,
  newId,
  quoteTotals,
  recordPayment,
  type JobStatus,
  type MaterialOrder,
  type QuoteLine,
  type TradeCustomer,
  type TradeInvoice,
  type TradeJob,
  type TradegraphStore,
} from './tradegraph';

export const HARBOUR_NOW = '2026-10-14T08:00:00.000Z';
export const HARBOUR_TODAY = '2026-10-14';
export const TRADE_CYAN = '#00b4d8';

export const BOARD_COLUMNS = [
  'enquiry',
  'quoted',
  'scheduled',
  'in_progress',
  'done',
  'invoiced',
  'paid',
] as const;
export type BoardColumn = (typeof BOARD_COLUMNS)[number];

export type PriceKind = 'labour' | 'material' | 'callout';

export type PriceItem = {
  id: string;
  kind: PriceKind;
  name: string;
  unit: string;
  cost_cents: number;
  markup_pct: number;
  sku: string;
};

export type TeamMember = {
  id: string;
  name: string;
  role: 'owner' | 'technician';
  trade: string;
  email: string;
  phone: string;
  colour: string;
  portal_token: string;
  /** Core company member id when this person is on the team book. */
  member_user_id: string;
};

export type CustomerSite = {
  id: string;
  customer_id: string;
  label: string;
  address: string;
  suburb: string;
  city: string;
};

export type GanttKind = 'phase' | 'task' | 'milestone';

export type GanttTask = {
  id: string;
  name: string;
  kind: GanttKind;
  plan_start: string;
  plan_end: string;
  start: string;
  end: string;
  actual_start: string | null;
  actual_end: string | null;
  progress_pct: number;
  depends_on: string[];
  assignee_id: string | null;
  vo_id: string | null;
  vo_number: string | null;
};

export type Baseline = {
  id: string;
  locked_at: string;
  reason: string;
  tasks: Array<{ id: string; name: string; plan_start: string; plan_end: string }>;
};

export type CheckItem = { id: string; label: string; done: boolean };

export type JobPhoto = {
  id: string;
  phase: 'before' | 'after';
  url: string;
  caption: string;
  at: string;
};

export type TimeEntry = {
  id: string;
  member_id: string;
  minutes: number;
  note: string;
  at: string;
};

export type UsedMaterial = {
  id: string;
  description: string;
  qty: number;
  unit_cents: number;
  price_item_id: string | null;
};

export type Programme = {
  job_id: string;
  tasks: GanttTask[];
  baseline: Baseline | null;
  history: Baseline[];
  /** Original contract, ex VAT, locked when the quote is accepted. */
  contract_cents: number;
  notes: string;
  checklist: CheckItem[];
  photos: JobPhoto[];
  time_entries: TimeEntry[];
  assignees: string[];
  materials_used: UsedMaterial[];
};

export type QuoteOption = { id: string; name: string; line_ids: string[] };

export type Signature = {
  name: string;
  signed_at: string;
  mark: string;
};

export type QuoteMeta = {
  quote_id: string;
  markup_pct: number;
  deposit_pct: number;
  template_id: string | null;
  valid_until: string | null;
  options: QuoteOption[];
  signature: Signature | null;
  sent_at: string | null;
};

export type VariationStatus = 'draft' | 'sent' | 'approved' | 'declined';

export type VariationOrder = {
  id: string;
  number: string;
  job_id: string;
  title: string;
  scope: string;
  status: VariationStatus;
  cost_cents: number;
  days: number;
  photo_urls: string[];
  lines: QuoteLine[];
  signature: Signature | null;
  created_at: string;
};

export type InvoiceKind = 'deposit' | 'progress' | 'final' | 'variation';

export type InvoiceMeta = {
  invoice_id: string;
  kind: InvoiceKind;
  due_on: string;
  percent: number | null;
  vo_id: string | null;
  pay_reference: string;
  pay_url: string;
};

export type TradeMessage = {
  id: string;
  customer_id: string;
  job_id: string | null;
  from: 'desk' | 'customer';
  body: string;
  at: string;
};

export type TradeDocument = {
  id: string;
  customer_id: string;
  job_id: string | null;
  kind: 'coc' | 'warranty' | 'licence' | 'other';
  title: string;
  number: string;
};

export type BookingRequest = {
  id: string;
  customer_id: string;
  starts_at: string;
  ends_at: string;
  note: string;
  status: 'requested' | 'confirmed' | 'declined';
};

export type Availability = {
  id: string;
  member_id: string;
  weekday: number;
  start: string;
  end: string;
};

export type DeskTask = {
  id: string;
  title: string;
  due: string;
  assignee_id: string | null;
  job_id: string | null;
  done: boolean;
};

export type Review = {
  id: string;
  customer_id: string;
  job_id: string | null;
  score: number;
  comment: string;
};

export type Notice = { id: string; title: string; body: string; at: string };

export type QuoteTemplate = {
  id: string;
  name: string;
  title: string;
  lines: QuoteLine[];
  deposit_pct: number;
};

export type CustomerLink = {
  customer_id: string;
  connection_id: string | null;
};

export type DeskState = {
  price_book: PriceItem[];
  team: TeamMember[];
  sites: CustomerSite[];
  templates: QuoteTemplate[];
  programmes: Programme[];
  quote_meta: QuoteMeta[];
  variations: VariationOrder[];
  invoice_meta: InvoiceMeta[];
  messages: TradeMessage[];
  documents: TradeDocument[];
  bookings: BookingRequest[];
  availability: Availability[];
  tasks: DeskTask[];
  reviews: Review[];
  notices: Notice[];
  customer_links: CustomerLink[];
  logo_data_url: string;
};

export type Book = {
  store: TradegraphStore;
  desk: DeskState;
};

export type NoticeOut = {
  audience: 'customer' | 'desk';
  customer_id: string | null;
  title: string;
  body: string;
};

export type OpResult = { book: Book; notices: NoticeOut[] };

export function emptyDesk(): DeskState {
  return {
    price_book: [],
    team: [],
    sites: [],
    templates: [],
    programmes: [],
    quote_meta: [],
    variations: [],
    invoice_meta: [],
    messages: [],
    documents: [],
    bookings: [],
    availability: [],
    tasks: [],
    reviews: [],
    notices: [],
    customer_links: [],
    logo_data_url: '',
  };
}

export function addDays(isoDay: string, days: number): string {
  const t = Date.parse(`${isoDay.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(t)) return isoDay.slice(0, 10);
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

export function daysBetween(fromDay: string, toDay: string): number {
  const a = Date.parse(`${fromDay.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${toDay.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function sellCents(item: PriceItem): number {
  const cost = Math.max(0, Math.round(item.cost_cents));
  const mark = Number(item.markup_pct) || 0;
  return Math.round(cost * (1 + mark / 100));
}

export function lineFromPrice(item: PriceItem, qty = 1): QuoteLine {
  return {
    id: newId('tl'),
    description: item.name,
    qty,
    unit_cents: sellCents(item),
  };
}

export function programmeFor(desk: DeskState, jobId: string): Programme | null {
  return desk.programmes.find((row) => row.job_id === jobId) || null;
}

export function forecastEnd(task: GanttTask): string {
  return (task.actual_end || task.end).slice(0, 10);
}

/** Positive means the forecast or actual finish is later than the locked plan. */
export function varianceDays(task: GanttTask): number {
  return daysBetween(task.plan_end, forecastEnd(task));
}

export function taskIsDelayed(task: GanttTask, today = HARBOUR_TODAY): boolean {
  if (task.progress_pct >= 100 && task.actual_end) {
    return varianceDays(task) > 0;
  }
  return task.plan_end < today && task.progress_pct < 100 || varianceDays(task) > 0;
}

export type GanttRead = {
  tasks: GanttTask[];
  current: GanttTask | null;
  upcoming: GanttTask[];
  delays: GanttTask[];
  project_plan_end: string;
  project_forecast_end: string;
  variance_days: number;
};

export function readGantt(tasks: GanttTask[], today = HARBOUR_TODAY): GanttRead {
  const ordered = [...tasks].sort((a, b) => a.plan_start.localeCompare(b.plan_start));
  const current =
    ordered.find((task) => task.progress_pct < 100 && task.kind !== 'milestone') ||
    ordered.find((task) => task.progress_pct < 100) ||
    null;
  const upcoming = ordered.filter(
    (task) => task.kind === 'milestone' && task.progress_pct < 100 && task.plan_start >= today
  );
  const delays = ordered.filter((task) => varianceDays(task) > 0);
  const planEnd = ordered.reduce((max, task) => (task.plan_end > max ? task.plan_end : max), '');
  const forecast = ordered.reduce(
    (max, task) => (forecastEnd(task) > max ? forecastEnd(task) : max),
    ''
  );
  return {
    tasks: ordered,
    current,
    upcoming,
    delays,
    project_plan_end: planEnd,
    project_forecast_end: forecast,
    variance_days: planEnd && forecast ? daysBetween(planEnd, forecast) : 0,
  };
}

function mustJob(book: Book, jobId: string): TradeJob {
  const job = book.store.jobs.find((row) => row.id === jobId);
  if (!job) throw new Error('Job not found');
  return job;
}

function mustProgramme(book: Book, jobId: string): Programme {
  const programme = programmeFor(book.desk, jobId);
  if (!programme) throw new Error('This job has no programme yet');
  return programme;
}

export function standardProgramme(
  jobId: string,
  startDay: string,
  assigneeId: string | null,
  contractCents: number
): Programme {
  const d = (n: number) => addDays(startDay, n);
  const task = (
    name: string,
    kind: GanttKind,
    from: number,
    to: number,
    depends: string[]
  ): GanttTask => {
    const id = newId('gt');
    const start = d(from);
    const end = d(to);
    return {
      id,
      name,
      kind,
      plan_start: start,
      plan_end: end,
      start,
      end,
      actual_start: null,
      actual_end: null,
      progress_pct: 0,
      depends_on: depends,
      assignee_id: assigneeId,
      vo_id: null,
      vo_number: null,
    };
  };
  const attend = task('Attend and isolate', 'task', 0, 0, []);
  const strip = task('Strip and prepare', 'task', 1, 1, [attend.id]);
  const fit = task('Fit and test', 'task', 2, 3, [strip.id]);
  const coc = task('Compliance certificate', 'milestone', 4, 4, [fit.id]);
  const hand = task('Handover', 'milestone', 4, 4, [coc.id]);
  const tasks = [attend, strip, fit, coc, hand];
  return {
    job_id: jobId,
    tasks,
    baseline: null,
    history: [],
    contract_cents: contractCents,
    notes: '',
    checklist: [
      { id: newId('ck'), label: 'Water isolated and tagged', done: false },
      { id: newId('ck'), label: 'Photos before work', done: false },
      { id: newId('ck'), label: 'Customer walked through the finish', done: false },
    ],
    photos: [],
    time_entries: [],
    assignees: assigneeId ? [assigneeId] : [],
    materials_used: [],
  };
}

export function lockBaseline(programme: Programme, now: string, reason: string): Programme {
  const snapshot: Baseline = {
    id: newId('bl'),
    locked_at: now,
    reason,
    tasks: programme.tasks.map((task) => ({
      id: task.id,
      name: task.name,
      plan_start: task.start,
      plan_end: task.end,
    })),
  };
  return {
    ...programme,
    baseline: snapshot,
    tasks: programme.tasks.map((task) => ({
      ...task,
      plan_start: task.start,
      plan_end: task.end,
    })),
  };
}

export function rebaseline(programme: Programme, now: string, reason: string): Programme {
  const why = reason.trim();
  if (why.length < 3) throw new Error('Say why you are re-baselining');
  if (!programme.baseline) return lockBaseline(programme, now, why);
  const history = [...programme.history, programme.baseline];
  const locked = lockBaseline(programme, now, why);
  return { ...locked, history };
}

function cascade(tasks: GanttTask[], movedId: string): GanttTask[] {
  const next = tasks.map((task) => ({ ...task, depends_on: [...task.depends_on] }));
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const pred = next.find((task) => task.id === id);
    if (!pred) return;
    for (const task of next) {
      if (!task.depends_on.includes(id)) continue;
      const minStart = addDays(pred.end, pred.kind === 'milestone' ? 0 : 1);
      if (task.start < minStart) {
        const delta = daysBetween(task.start, minStart);
        task.start = addDays(task.start, delta);
        task.end = addDays(task.end, delta);
        walk(task.id);
      }
    }
  };
  walk(movedId);
  return next;
}

export function shiftTask(programme: Programme, taskId: string, days: number): Programme {
  if (!days) return programme;
  const tasks = programme.tasks.map((task) => ({ ...task }));
  const task = tasks.find((row) => row.id === taskId);
  if (!task) throw new Error('Task not found');
  task.start = addDays(task.start, days);
  task.end = addDays(task.end, days);
  return { ...programme, tasks: cascade(tasks, taskId) };
}

export function setTaskProgress(
  programme: Programme,
  taskId: string,
  progress: number,
  actual: { actual_start?: string | null; actual_end?: string | null } = {}
): Programme {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return {
    ...programme,
    tasks: programme.tasks.map((task) => {
      if (task.id !== taskId) return task;
      const actual_end =
        actual.actual_end !== undefined
          ? actual.actual_end
          : pct >= 100
            ? task.actual_end || task.end
            : task.actual_end;
      return {
        ...task,
        progress_pct: pct,
        actual_start:
          actual.actual_start !== undefined ? actual.actual_start : task.actual_start || task.start,
        actual_end,
      };
    }),
  };
}

export type VoRegister = {
  original_cents: number;
  approved_cents: number;
  revised_cents: number;
  vat_cents: number;
  revised_incl_cents: number;
  orders: VariationOrder[];
};

export function voRegister(book: Book, jobId: string, vatRate = SA_VAT_RATE): VoRegister {
  const programme = programmeFor(book.desk, jobId);
  const orders = book.desk.variations.filter((row) => row.job_id === jobId);
  const original = programme?.contract_cents || 0;
  const approved = orders
    .filter((row) => row.status === 'approved')
    .reduce((sum, row) => sum + row.cost_cents, 0);
  const revised = original + approved;
  const vat = Math.round(revised * vatRate);
  return {
    original_cents: original,
    approved_cents: approved,
    revised_cents: revised,
    vat_cents: vat,
    revised_incl_cents: revised + vat,
    orders,
  };
}

function replaceProgramme(book: Book, programme: Programme): Book {
  const exists = book.desk.programmes.some((row) => row.job_id === programme.job_id);
  return {
    store: book.store,
    desk: {
      ...book.desk,
      programmes: exists
        ? book.desk.programmes.map((row) => (row.job_id === programme.job_id ? programme : row))
        : [...book.desk.programmes, programme],
    },
  };
}

export function createEnquiryJob(
  book: Book,
  input: {
    customer_id: string;
    title: string;
    address?: string;
    notes?: string;
    now: string;
    request_id?: string | null;
  }
): OpResult {
  const customer = book.store.customers.find((row) => row.id === input.customer_id);
  if (!customer) throw new Error('Choose a customer');
  const title = input.title.trim();
  if (title.length < 3) throw new Error('Give the job a short title');
  const job: TradeJob = {
    id: newId('tj'),
    number: nextNum('J', book.store.jobs.map((row) => row.number)),
    customer_id: customer.id,
    quote_id: null,
    title,
    status: 'enquiry',
    address: (input.address || customer.address || '').trim(),
    progress_pct: 0,
    lines: [],
    updates: input.notes
      ? [
          {
            id: newId('tu'),
            at: input.now,
            note: input.notes.trim(),
            progress_pct: 0,
            photo_url: null,
            shared: false,
          },
        ]
      : [],
  };
  const programme = standardProgramme(job.id, input.now.slice(0, 10), book.desk.team[1]?.id || null, 0);
  const store: TradegraphStore = {
    ...book.store,
    updated_at: input.now,
    jobs: [job, ...book.store.jobs],
    requests: input.request_id
      ? book.store.requests.map((row) =>
          row.id === input.request_id ? { ...row, status: 'quoted' as const } : row
        )
      : book.store.requests,
  };
  return {
    book: replaceProgramme({ store, desk: book.desk }, programme),
    notices: [
      {
        audience: 'desk',
        customer_id: customer.id,
        title: 'New job',
        body: `${job.number} ${job.title} is on the board as an enquiry.`,
      },
    ],
  };
}

function nextNum(prefix: string, existing: string[]): string {
  const nums = existing
    .map((value) => Number(String(value).replace(/\D/g, '')))
    .filter((n) => Number.isFinite(n));
  return `${prefix}-${(nums.length ? Math.max(...nums) : 1000) + 1}`;
}

export function buildQuote(
  book: Book,
  input: {
    customer_id: string;
    title: string;
    lines: QuoteLine[];
    markup_pct?: number;
    deposit_pct?: number;
    template_id?: string | null;
    options?: QuoteOption[];
    now: string;
    job_id?: string | null;
  }
): OpResult {
  if (!input.lines.length) throw new Error('Add at least one line from the price book');
  const customer = book.store.customers.find((row) => row.id === input.customer_id);
  if (!customer) throw new Error('Choose a customer');
  const quote = {
    id: newId('tq'),
    number: nextNum('Q', book.store.quotes.map((row) => row.number)),
    customer_id: customer.id,
    status: 'draft' as const,
    title: input.title.trim() || 'Quote',
    lines: input.lines.map((line) => ({ ...line, id: line.id || newId('tl') })),
    source_request_id: null,
    created_at: input.now,
  };
  const meta: QuoteMeta = {
    quote_id: quote.id,
    markup_pct: Number(input.markup_pct) || 0,
    deposit_pct: Math.max(0, Math.min(100, Number(input.deposit_pct) || 0)),
    template_id: input.template_id || null,
    valid_until: addDays(input.now.slice(0, 10), 14),
    options: input.options || [],
    signature: null,
    sent_at: null,
  };
  let jobs = book.store.jobs;
  if (input.job_id) {
    jobs = jobs.map((job) =>
      job.id === input.job_id ? { ...job, status: job.status === 'enquiry' ? 'quoted' : job.status, quote_id: quote.id } : job
    );
  }
  return {
    book: {
      store: { ...book.store, updated_at: input.now, quotes: [quote, ...book.store.quotes], jobs },
      desk: { ...book.desk, quote_meta: [...book.desk.quote_meta, meta] },
    },
    notices: [],
  };
}

export function sendQuote(book: Book, quoteId: string, now: string): OpResult {
  const quote = book.store.quotes.find((row) => row.id === quoteId);
  if (!quote) throw new Error('Quote not found');
  if (!quote.lines.length) throw new Error('Add line items before sending');
  const store: TradegraphStore = {
    ...book.store,
    updated_at: now,
    quotes: book.store.quotes.map((row) =>
      row.id === quoteId ? { ...row, status: row.status === 'draft' ? 'sent' : row.status } : row
    ),
  };
  const desk: DeskState = {
    ...book.desk,
    quote_meta: book.desk.quote_meta.map((row) =>
      row.quote_id === quoteId ? { ...row, sent_at: row.sent_at || now } : row
    ),
  };
  const money = quoteTotals(quote.lines, store.settings.vat_rate);
  return {
    book: { store, desk },
    notices: [
      {
        audience: 'customer',
        customer_id: quote.customer_id,
        title: `Quote ${quote.number}`,
        body: `${quote.title} is ready to accept. ${money.total_cents} cents incl VAT.`,
      },
    ],
  };
}

export function signAndAcceptQuote(
  book: Book,
  quoteId: string,
  signature: { name: string; mark: string },
  now: string
): OpResult {
  const name = signature.name.trim();
  if (name.length < 2) throw new Error('Sign with your name');
  const quote = book.store.quotes.find((row) => row.id === quoteId);
  if (!quote) throw new Error('Quote not found');
  if (quote.status === 'declined' || quote.status === 'expired') {
    throw new Error('This quote can no longer be accepted');
  }
  const signed: Signature = { name, signed_at: now, mark: signature.mark || name };
  const linked = book.store.jobs.find((row) => row.quote_id === quoteId);
  let store = acceptQuote(book.store, quoteId, now);
  store = { ...store, updated_at: now };
  let job = store.jobs.find((row) => row.quote_id === quoteId && row.id !== linked?.id) || store.jobs.find((row) => row.quote_id === quoteId);
  if (!job) throw new Error('Job was not opened');
  if (linked && job.id !== linked.id) {
    const lines = job.lines;
    store = {
      ...store,
      jobs: store.jobs
        .filter((row) => row.id !== job!.id)
        .map((row) =>
          row.id === linked.id
            ? {
                ...row,
                status: 'scheduled' as const,
                lines,
                title: row.title.trim() && row.title.trim() !== 'Quote' ? row.title : quote.title,
                address: row.address || store.customers.find((c) => c.id === quote.customer_id)?.address || '',
              }
            : row
        ),
    };
    job = store.jobs.find((row) => row.id === linked.id)!;
  }
  const totals = quoteTotals(quote.lines, store.settings.vat_rate);
  const meta = book.desk.quote_meta.find((row) => row.quote_id === quoteId);
  const assignee = book.desk.team.find((row) => row.role === 'technician')?.id || null;
  let programme =
    programmeFor(book.desk, job.id) ||
    standardProgramme(job.id, now.slice(0, 10), assignee, totals.subtotal_cents);
  programme = {
    ...programme,
    contract_cents: totals.subtotal_cents,
    assignees: assignee ? Array.from(new Set([...programme.assignees, assignee])) : programme.assignees,
  };
  programme = lockBaseline(programme, now, 'Locked when the quote was accepted');
  let next = replaceProgramme(
    {
      store,
      desk: {
        ...book.desk,
        quote_meta: book.desk.quote_meta.map((row) =>
          row.quote_id === quoteId ? { ...row, signature: signed } : row
        ),
      },
    },
    programme
  );
  const deposit = meta?.deposit_pct || 0;
  const notices: NoticeOut[] = [
    {
      audience: 'desk',
      customer_id: quote.customer_id,
      title: 'Quote accepted',
      body: `${quote.number} signed by ${name}. ${job.number} is scheduled and the plan is locked.`,
    },
    {
      audience: 'customer',
      customer_id: quote.customer_id,
      title: 'Job opened',
      body: `${job.title} is on the programme. We will write if the plan moves.`,
    },
  ];
  if (deposit > 0) {
    const invoiced = raiseInvoice(next, {
      job_id: job.id,
      kind: 'deposit',
      percent: deposit,
      now,
    });
    next = invoiced.book;
    notices.push(...invoiced.notices);
  }
  const slotStart = `${addDays(now.slice(0, 10), 1)}T07:00:00.000Z`;
  const slotEnd = `${addDays(now.slice(0, 10), 1)}T11:00:00.000Z`;
  next = {
    ...next,
    store: {
      ...next.store,
      schedule: [
        ...next.store.schedule,
        {
          id: newId('ts'),
          job_id: job.id,
          title: job.title,
          starts_at: slotStart,
          ends_at: slotEnd,
          address: job.address,
        },
      ],
    },
  };
  return { book: next, notices };
}

/** Owner one-click: accept the quote, open the job, and invoice the balance. */
export function convertQuote(book: Book, quoteId: string, name: string, now: string): OpResult {
  const signed = signAndAcceptQuote(book, quoteId, { name, mark: name }, now);
  const job = signed.book.store.jobs.find((row) => row.quote_id === quoteId);
  if (!job) return signed;
  const invoiced = raiseInvoice(signed.book, { job_id: job.id, kind: 'final', now });
  return { book: invoiced.book, notices: [...signed.notices, ...invoiced.notices] };
}

export function raiseInvoice(
  book: Book,
  input: { job_id: string; kind: InvoiceKind; percent?: number | null; now: string; vo_id?: string | null }
): OpResult {
  const job = mustJob(book, input.job_id);
  if (job.status === 'cancelled') throw new Error('Cancelled jobs are not invoiced');
  const register = voRegister(book, job.id, book.store.settings.vat_rate);
  const base = register.revised_incl_cents || quoteTotals(job.lines, book.store.settings.vat_rate).total_cents;
  const percent = input.percent == null ? (input.kind === 'final' ? 100 : input.kind === 'deposit' ? 30 : 50) : input.percent;
  const already = book.store.invoices
    .filter((row) => row.job_id === job.id && row.status !== 'void')
    .reduce((sum, row) => sum + row.total_cents, 0);
  let total = input.kind === 'final' ? Math.max(0, base - already) : Math.round(base * (percent / 100));
  if (input.kind === 'variation' && input.vo_id) {
    const vo = book.desk.variations.find((row) => row.id === input.vo_id);
    if (!vo || vo.status !== 'approved') throw new Error('Approve the variation before invoicing it');
    const net = quoteTotals(vo.lines.length ? vo.lines : [{ id: 'x', description: vo.title, qty: 1, unit_cents: vo.cost_cents }], book.store.settings.vat_rate);
    total = net.total_cents;
  }
  if (total <= 0) throw new Error('Nothing left to invoice');
  const vatRate = book.store.settings.vat_rate || SA_VAT_RATE;
  const subtotal = Math.round(total / (1 + vatRate));
  const vat = total - subtotal;
  const invoice: TradeInvoice = {
    id: newId('ti'),
    number: nextNum('INV', book.store.invoices.map((row) => row.number)),
    customer_id: job.customer_id,
    job_id: job.id,
    status: 'issued',
    subtotal_cents: subtotal,
    vat_cents: vat,
    total_cents: total,
    issued_at: input.now,
  };
  const meta: InvoiceMeta = {
    invoice_id: invoice.id,
    kind: input.kind,
    due_on: addDays(input.now.slice(0, 10), 7),
    percent,
    vo_id: input.vo_id || null,
    pay_reference: '',
    pay_url: '',
  };
  let status: JobStatus = job.status;
  if (input.kind !== 'deposit' && status !== 'paid') {
    status = 'invoiced';
  }
  return {
    book: {
      store: {
        ...book.store,
        updated_at: input.now,
        invoices: [...book.store.invoices, invoice],
        jobs: book.store.jobs.map((row) => (row.id === job.id ? { ...row, status } : row)),
      },
      desk: { ...book.desk, invoice_meta: [...book.desk.invoice_meta, meta] },
    },
    notices: [
      {
        audience: 'customer',
        customer_id: job.customer_id,
        title: `Invoice ${invoice.number}`,
        body: `A ${input.kind} invoice is ready.`,
      },
    ],
  };
}

export function issuePayLink(
  book: Book,
  invoiceId: string,
  urlFor: (invoiceId: string, reference: string) => string
): OpResult {
  const invoice = book.store.invoices.find((row) => row.id === invoiceId);
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status === 'void' || invoice.status === 'paid') {
    throw new Error('This invoice is not open for payment');
  }
  const reference = `tg_${invoice.number.replace(/\W/g, '')}`;
  const pay_url = urlFor(invoice.id, reference);
  const existing = book.desk.invoice_meta.find((row) => row.invoice_id === invoiceId);
  const meta: InvoiceMeta = existing
    ? { ...existing, pay_reference: reference, pay_url }
    : {
        invoice_id: invoiceId,
        kind: 'final',
        due_on: addDays(invoice.issued_at.slice(0, 10), 7),
        percent: null,
        vo_id: null,
        pay_reference: reference,
        pay_url,
      };
  return {
    book: {
      store: book.store,
      desk: {
        ...book.desk,
        invoice_meta: existing
          ? book.desk.invoice_meta.map((row) => (row.invoice_id === invoiceId ? meta : row))
          : [...book.desk.invoice_meta, meta],
      },
    },
    notices: [
      {
        audience: 'customer',
        customer_id: invoice.customer_id,
        title: 'Pay link',
        body: `Pay ${invoice.number} with Paystack. Reference ${reference}.`,
      },
    ],
  };
}

export function createVariation(
  book: Book,
  input: {
    job_id: string;
    title: string;
    scope: string;
    cost_cents: number;
    days: number;
    lines?: QuoteLine[];
    photo_urls?: string[];
    now: string;
  }
): OpResult {
  mustJob(book, input.job_id);
  const title = input.title.trim();
  if (title.length < 3) throw new Error('Name the variation');
  if (!input.scope.trim()) throw new Error('Describe the scope change');
  const n = book.desk.variations.filter((row) => row.job_id === input.job_id).length + 1;
  const number = `VO-${String(n).padStart(3, '0')}`;
  const lines = input.lines?.length
    ? input.lines
    : [{ id: newId('tl'), description: title, qty: 1, unit_cents: Math.max(0, Math.round(input.cost_cents)) }];
  const vo: VariationOrder = {
    id: newId('tv'),
    number,
    job_id: input.job_id,
    title,
    scope: input.scope.trim(),
    status: 'draft',
    cost_cents: lines.reduce((sum, line) => sum + Math.round(line.qty * line.unit_cents), 0),
    days: Math.max(0, Math.round(input.days)),
    photo_urls: input.photo_urls || [],
    lines,
    signature: null,
    created_at: input.now,
  };
  return {
    book: { store: { ...book.store, updated_at: input.now }, desk: { ...book.desk, variations: [...book.desk.variations, vo] } },
    notices: [],
  };
}

export function sendVariation(book: Book, voId: string, now: string): OpResult {
  const vo = book.desk.variations.find((row) => row.id === voId);
  if (!vo) throw new Error('Variation not found');
  const job = mustJob(book, vo.job_id);
  return {
    book: {
      store: { ...book.store, updated_at: now },
      desk: {
        ...book.desk,
        variations: book.desk.variations.map((row) =>
          row.id === voId ? { ...row, status: 'sent' } : row
        ),
      },
    },
    notices: [
      {
        audience: 'customer',
        customer_id: job.customer_id,
        title: `${vo.number} to approve`,
        body: `${vo.title}. ${vo.days} day${vo.days === 1 ? '' : 's'} and a cost change are waiting for your signature.`,
      },
    ],
  };
}

export function approveVariation(
  book: Book,
  voId: string,
  signature: { name: string; mark: string },
  now: string
): OpResult {
  const name = signature.name.trim();
  if (name.length < 2) throw new Error('Sign with your name');
  const vo = book.desk.variations.find((row) => row.id === voId);
  if (!vo) throw new Error('Variation not found');
  if (vo.status === 'declined') throw new Error('This variation was declined');
  if (vo.status === 'approved') return { book, notices: [] };
  const job = mustJob(book, vo.job_id);
  const programme = mustProgramme(book, vo.job_id);
  const signed: Signature = { name, signed_at: now, mark: signature.mark || name };
  const lastWork = [...programme.tasks].reverse().find((task) => task.name !== 'Handover') || programme.tasks[programme.tasks.length - 1];
  const start = addDays(lastWork ? lastWork.end : now.slice(0, 10), 1);
  const end = addDays(start, Math.max(0, vo.days - 1));
  const voTask: GanttTask = {
    id: newId('gt'),
    name: vo.title,
    kind: 'task',
    plan_start: start,
    plan_end: end,
    start,
    end,
    actual_start: null,
    actual_end: null,
    progress_pct: 0,
    depends_on: lastWork ? [lastWork.id] : [],
    assignee_id: programme.assignees[0] || null,
    vo_id: vo.id,
    vo_number: vo.number,
  };
  const tasks = programme.tasks.map((task) => {
    if (task.name !== 'Handover' && task.kind !== 'milestone') return task;
    if (task.name !== 'Handover') return task;
    return {
      ...task,
      plan_end: addDays(task.plan_end, vo.days),
      end: addDays(task.end, vo.days),
      start: addDays(task.start, vo.days),
      plan_start: addDays(task.plan_start, vo.days),
    };
  });
  const handover = tasks.find((task) => task.name === 'Handover');
  const insertAt = handover ? tasks.findIndex((task) => task.id === handover.id) : tasks.length;
  tasks.splice(insertAt, 0, voTask);
  const nextProgramme: Programme = { ...programme, tasks: cascade(tasks, voTask.id) };
  const lines = vo.lines.map((line) => ({ ...line, id: newId('tl') }));
  const store: TradegraphStore = {
    ...book.store,
    updated_at: now,
    jobs: book.store.jobs.map((row) =>
      row.id === job.id ? { ...row, lines: [...row.lines, ...lines] } : row
    ),
  };
  const desk: DeskState = {
    ...book.desk,
    variations: book.desk.variations.map((row) =>
      row.id === vo.id ? { ...row, status: 'approved', signature: signed } : row
    ),
    programmes: book.desk.programmes.map((row) => (row.job_id === job.id ? nextProgramme : row)),
  };
  return {
    book: { store, desk },
    notices: [
      {
        audience: 'customer',
        customer_id: job.customer_id,
        title: `${vo.number} approved`,
        body: `${vo.title} is on the programme. The plan end moved by ${vo.days} day${vo.days === 1 ? '' : 's'}.`,
      },
      {
        audience: 'desk',
        customer_id: job.customer_id,
        title: `${vo.number} signed`,
        body: `${name} approved ${vo.title}.`,
      },
    ],
  };
}

export function declineVariation(book: Book, voId: string, now: string): OpResult {
  const vo = book.desk.variations.find((row) => row.id === voId);
  if (!vo) throw new Error('Variation not found');
  const job = mustJob(book, vo.job_id);
  return {
    book: {
      store: { ...book.store, updated_at: now },
      desk: {
        ...book.desk,
        variations: book.desk.variations.map((row) =>
          row.id === voId ? { ...row, status: 'declined' } : row
        ),
      },
    },
    notices: [
      {
        audience: 'desk',
        customer_id: job.customer_id,
        title: `${vo.number} declined`,
        body: `${vo.title} was not accepted. The plan is unchanged.`,
      },
    ],
  };
}

export type BoardCard = {
  id: string;
  column: BoardColumn;
  kind: 'job' | 'quote' | 'request';
  title: string;
  subtitle: string;
  money: string;
  ref_id: string;
};

export function boardCards(book: Book): BoardCard[] {
  const cards: BoardCard[] = [];
  for (const request of book.store.requests) {
    if (request.status !== 'new') continue;
    const customer = book.store.customers.find((row) => row.id === request.customer_id);
    cards.push({
      id: `req-${request.id}`,
      column: 'enquiry',
      kind: 'request',
      title: request.description.slice(0, 80),
      subtitle: customer?.name || 'Customer',
      money: '',
      ref_id: request.id,
    });
  }
  for (const quote of book.store.quotes) {
    if (quote.status !== 'draft' && quote.status !== 'sent') continue;
    if (book.store.jobs.some((job) => job.quote_id === quote.id)) continue;
    const customer = book.store.customers.find((row) => row.id === quote.customer_id);
    const money = quoteTotals(quote.lines, book.store.settings.vat_rate);
    cards.push({
      id: `quo-${quote.id}`,
      column: 'quoted',
      kind: 'quote',
      title: `${quote.number} · ${quote.title}`,
      subtitle: customer?.name || '',
      money: String(money.total_cents),
      ref_id: quote.id,
    });
  }
  for (const job of book.store.jobs) {
    if (job.status === 'cancelled') continue;
    const customer = book.store.customers.find((row) => row.id === job.customer_id);
    let column: BoardColumn = job.status === 'enquiry' || job.status === 'quoted' ? job.status : 'scheduled';
    if (job.status === 'scheduled') column = 'scheduled';
    if (job.status === 'in_progress') column = 'in_progress';
    if (job.status === 'done') column = 'done';
    if (job.status === 'invoiced' || job.status === 'paid') {
      const invoices = book.store.invoices.filter((row) => row.job_id === job.id && row.status !== 'void');
      const owing = invoices.reduce((sum, row) => sum + row.total_cents, 0);
      const paid = book.store.payments
        .filter((row) => invoices.some((invoice) => invoice.id === row.invoice_id))
        .reduce((sum, row) => sum + row.amount_cents, 0);
      column = invoices.length && paid >= owing ? 'paid' : 'invoiced';
    }
    cards.push({
      id: `job-${job.id}`,
      column,
      kind: 'job',
      title: `${job.number} · ${job.title}`,
      subtitle: customer?.name || '',
      money: '',
      ref_id: job.id,
    });
  }
  return cards;
}

export type TradeReport = {
  revenue_cents: number;
  outstanding_cents: number;
  win_rate: number;
  decided: number;
  won: number;
  jobs: Array<{
    id: string;
    number: string;
    title: string;
    revenue_cents: number;
    cost_cents: number;
    profit_cents: number;
  }>;
};

export function tradeReport(book: Book): TradeReport {
  const live = book.store.invoices.filter((row) => row.status !== 'void');
  const revenue = book.store.payments.reduce((sum, row) => sum + row.amount_cents, 0);
  const outstanding = live.reduce((sum, row) => sum + row.total_cents, 0) - revenue;
  const decided = book.store.quotes.filter((row) => row.status === 'accepted' || row.status === 'declined');
  const won = decided.filter((row) => row.status === 'accepted').length;
  const labour = book.desk.price_book.find((row) => row.kind === 'labour');
  const hour = labour ? sellCents(labour) : 65_000;
  const jobs = book.store.jobs.map((job) => {
    const invoices = live.filter((row) => row.job_id === job.id);
    const revenue_cents = book.store.payments
      .filter((row) => invoices.some((invoice) => invoice.id === row.invoice_id))
      .reduce((sum, row) => sum + row.amount_cents, 0);
    const programme = programmeFor(book.desk, job.id);
    const materials = (programme?.materials_used || []).reduce(
      (sum, row) => sum + Math.round(row.qty * row.unit_cents),
      0
    );
    const orders = book.store.materials
      .filter((row) => row.job_id === job.id)
      .reduce(
        (sum, row) =>
          sum + row.lines.reduce((inner, line) => inner + Math.round(line.qty * line.unit_cents), 0),
        0
      );
    const minutes = (programme?.time_entries || []).reduce((sum, row) => sum + row.minutes, 0);
    const cost_cents = materials + orders + Math.round((minutes / 60) * hour);
    return {
      id: job.id,
      number: job.number,
      title: job.title,
      revenue_cents,
      cost_cents,
      profit_cents: revenue_cents - cost_cents,
    };
  });
  return {
    revenue_cents: revenue,
    outstanding_cents: outstanding,
    win_rate: decided.length ? won / decided.length : 0,
    decided: decided.length,
    won,
    jobs,
  };
}

export function overdueInvoices(book: Book, today = HARBOUR_TODAY) {
  return book.store.invoices
    .filter((row) => row.status === 'issued' || row.status === 'part_paid')
    .map((invoice) => {
      const meta = book.desk.invoice_meta.find((row) => row.invoice_id === invoice.id);
      const due = meta?.due_on || addDays(invoice.issued_at.slice(0, 10), 7);
      const paid = book.store.payments
        .filter((row) => row.invoice_id === invoice.id)
        .reduce((sum, row) => sum + row.amount_cents, 0);
      return { invoice, due, balance_cents: invoice.total_cents - paid, days: daysBetween(due, today) };
    })
    .filter((row) => row.days > 0 && row.balance_cents > 0);
}

export function slotsForRange(book: Book, startDay: string, endDay: string) {
  return book.store.schedule.filter((slot) => {
    const day = slot.starts_at.slice(0, 10);
    return day >= startDay && day <= endDay;
  });
}

export function buildTradeIcs(book: Book): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SupplierAdvisor//TradeAdvisor//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(book.store.settings.brand_name || 'TradeAdvisor')}`,
  ];
  for (const slot of book.store.schedule) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${slot.id}@supplieradvisor.tradegraph`,
      `DTSTAMP:${icsStamp(slot.starts_at)}`,
      `DTSTART:${icsStamp(slot.starts_at)}`,
      `DTEND:${icsStamp(slot.ends_at)}`,
      `SUMMARY:${escapeIcs(slot.title)}`,
      `LOCATION:${escapeIcs(slot.address)}`,
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function icsStamp(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('Z', 'Z');
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export type CustomerPack = {
  brand: TradegraphStore['settings'];
  customer: TradeCustomer;
  jobs: TradeJob[];
  quotes: Book['store']['quotes'];
  invoices: TradeInvoice[];
  payments: Book['store']['payments'];
  requests: Book['store']['requests'];
  programmes: Programme[];
  variations: VariationOrder[];
  invoice_meta: InvoiceMeta[];
  messages: TradeMessage[];
  documents: TradeDocument[];
  bookings: BookingRequest[];
  sites: CustomerSite[];
  schedule: Book['store']['schedule'];
  balance_cents: number;
};

export function customerPack(book: Book, customerId: string): CustomerPack {
  const customer = book.store.customers.find((row) => row.id === customerId);
  if (!customer) throw new Error('Customer not found');
  const jobs = book.store.jobs.filter(
    (row) => row.customer_id === customerId && row.status !== 'cancelled' && row.status !== 'enquiry'
  );
  const jobIds = new Set(jobs.map((row) => row.id));
  const quotes = book.store.quotes.filter(
    (row) => row.customer_id === customerId && row.status !== 'draft'
  );
  const invoices = book.store.invoices.filter(
    (row) => row.customer_id === customerId && row.status !== 'void'
  );
  const invoiceIds = new Set(invoices.map((row) => row.id));
  const payments = book.store.payments.filter((row) => row.customer_id === customerId);
  const invoiced = invoices.reduce((sum, row) => sum + row.total_cents, 0);
  const paid = payments
    .filter((row) => invoiceIds.has(row.invoice_id))
    .reduce((sum, row) => sum + row.amount_cents, 0);
  return {
    brand: { ...book.store.settings, notify_email: '' },
    customer,
    jobs: jobs.map((job) => ({
      ...job,
      updates: job.updates.filter((update) => update.shared),
    })),
    quotes,
    invoices,
    payments,
    requests: book.store.requests.filter((row) => row.customer_id === customerId),
    programmes: book.desk.programmes
      .filter((row) => jobIds.has(row.job_id))
      .map((row) => ({ ...row, notes: '' })),
    variations: book.desk.variations.filter((row) => jobIds.has(row.job_id) && row.status !== 'draft'),
    invoice_meta: book.desk.invoice_meta.filter((row) => invoiceIds.has(row.invoice_id)),
    messages: book.desk.messages.filter((row) => row.customer_id === customerId),
    documents: book.desk.documents.filter((row) => row.customer_id === customerId),
    bookings: book.desk.bookings.filter((row) => row.customer_id === customerId),
    sites: book.desk.sites.filter((row) => row.customer_id === customerId),
    schedule: book.store.schedule.filter((row) => row.job_id && jobIds.has(row.job_id)),
    balance_cents: invoiced - paid,
  };
}

export function jobsForMember(book: Book, memberId: string): TradeJob[] {
  const ids = new Set(
    book.desk.programmes.filter((row) => row.assignees.includes(memberId)).map((row) => row.job_id)
  );
  return book.store.jobs.filter((job) => ids.has(job.id) && job.status !== 'cancelled');
}

export type TradeOp =
  | { type: 'create_job'; customer_id: string; title: string; address?: string; notes?: string; request_id?: string | null }
  | { type: 'set_status'; job_id: string; status: JobStatus }
  | { type: 'add_checklist'; job_id: string; label: string }
  | { type: 'toggle_checklist'; job_id: string; item_id: string }
  | { type: 'add_photo'; job_id: string; phase: 'before' | 'after'; url: string; caption: string }
  | { type: 'add_time'; job_id: string; member_id: string; minutes: number; note: string }
  | { type: 'add_material_used'; job_id: string; description: string; qty: number; unit_cents: number }
  | { type: 'assign'; job_id: string; member_id: string }
  | { type: 'add_note'; job_id: string; note: string; shared: boolean }
  | {
      type: 'create_quote';
      customer_id: string;
      title: string;
      lines: QuoteLine[];
      markup_pct?: number;
      deposit_pct?: number;
      template_id?: string | null;
      job_id?: string | null;
      options?: QuoteOption[];
    }
  | { type: 'send_quote'; quote_id: string }
  | { type: 'convert_quote'; quote_id: string; name: string }
  | { type: 'sign_quote'; quote_id: string; name: string; mark: string }
  | { type: 'shift_task'; job_id: string; task_id: string; days: number }
  | {
      type: 'set_progress';
      job_id: string;
      task_id: string;
      progress_pct: number;
      actual_start?: string | null;
      actual_end?: string | null;
    }
  | { type: 'rebaseline'; job_id: string; reason: string }
  | {
      type: 'create_vo';
      job_id: string;
      title: string;
      scope: string;
      cost_cents: number;
      days: number;
      photo_urls?: string[];
    }
  | { type: 'send_vo'; vo_id: string }
  | { type: 'approve_vo'; vo_id: string; name: string; mark: string }
  | { type: 'decline_vo'; vo_id: string }
  | { type: 'create_invoice'; job_id: string; kind: InvoiceKind; percent?: number }
  | { type: 'pay_link'; invoice_id: string; url?: string }
  | { type: 'record_payment'; invoice_id: string; amount_cents: number; method: string }
  | { type: 'reschedule'; slot_id: string; starts_at: string; ends_at: string }
  | { type: 'book_slot'; customer_id: string; starts_at: string; ends_at: string; note: string }
  | { type: 'confirm_booking'; booking_id: string }
  | { type: 'message'; customer_id: string; from: 'desk' | 'customer'; body: string; job_id?: string | null }
  | { type: 'save_customer'; customer: TradeCustomer }
  | { type: 'add_site'; customer_id: string; label: string; address: string; suburb: string; city: string }
  | { type: 'order_materials'; supplier_name: string; supplier_id?: number | null; job_id?: string | null; lines: QuoteLine[] }
  | { type: 'save_task'; title: string; due: string; assignee_id?: string | null; job_id?: string | null }
  | { type: 'toggle_task'; task_id: string }
  | { type: 'add_review'; customer_id: string; score: number; comment: string; job_id?: string | null }
  | { type: 'add_notice'; title: string; body: string }
  | { type: 'link_customer'; customer_id: string; connection_id: string }
  | { type: 'save_brand'; brand_name: string; phone: string; city: string }
  | { type: 'arrive'; job_id: string; member_id: string }
  | { type: 'request_job'; customer_id: string; description: string; address: string; preferred_dates: string };

export function applyTradeOp(book: Book, op: TradeOp, now: string): OpResult {
  switch (op.type) {
    case 'create_job':
      return createEnquiryJob(book, { ...op, now });
    case 'set_status': {
      mustJob(book, op.job_id);
      return {
        book: {
          ...book,
          store: {
            ...book.store,
            updated_at: now,
            jobs: book.store.jobs.map((job) =>
              job.id === op.job_id ? { ...job, status: op.status } : job
            ),
          },
        },
        notices: [],
      };
    }
    case 'add_checklist': {
      const programme = mustProgramme(book, op.job_id);
      return {
        book: replaceProgramme(book, {
          ...programme,
          checklist: [...programme.checklist, { id: newId('ck'), label: op.label.trim(), done: false }],
        }),
        notices: [],
      };
    }
    case 'toggle_checklist': {
      const programme = mustProgramme(book, op.job_id);
      return {
        book: replaceProgramme(book, {
          ...programme,
          checklist: programme.checklist.map((item) =>
            item.id === op.item_id ? { ...item, done: !item.done } : item
          ),
        }),
        notices: [],
      };
    }
    case 'add_photo': {
      const programme = mustProgramme(book, op.job_id);
      if (!op.url) throw new Error('Choose a photo');
      return {
        book: replaceProgramme(book, {
          ...programme,
          photos: [
            ...programme.photos,
            { id: newId('ph'), phase: op.phase, url: op.url, caption: op.caption, at: now },
          ],
        }),
        notices: [],
      };
    }
    case 'add_time': {
      const programme = mustProgramme(book, op.job_id);
      if (op.minutes <= 0) throw new Error('Enter the minutes you worked');
      return {
        book: replaceProgramme(book, {
          ...programme,
          time_entries: [
            ...programme.time_entries,
            { id: newId('te'), member_id: op.member_id, minutes: Math.round(op.minutes), note: op.note, at: now },
          ],
        }),
        notices: [],
      };
    }
    case 'add_material_used': {
      const programme = mustProgramme(book, op.job_id);
      return {
        book: replaceProgramme(book, {
          ...programme,
          materials_used: [
            ...programme.materials_used,
            {
              id: newId('mu'),
              description: op.description,
              qty: op.qty,
              unit_cents: op.unit_cents,
              price_item_id: null,
            },
          ],
        }),
        notices: [],
      };
    }
    case 'assign': {
      const programme = mustProgramme(book, op.job_id);
      if (!book.desk.team.some((row) => row.id === op.member_id)) throw new Error('Team member not found');
      return {
        book: replaceProgramme(book, {
          ...programme,
          assignees: Array.from(new Set([...programme.assignees, op.member_id])),
        }),
        notices: [],
      };
    }
    case 'add_note': {
      const job = mustJob(book, op.job_id);
      const update = {
        id: newId('tu'),
        at: now,
        note: op.note.trim(),
        progress_pct: job.progress_pct,
        photo_url: null,
        shared: op.shared,
      };
      if (!update.note) throw new Error('Write a note');
      return {
        book: {
          ...book,
          store: {
            ...book.store,
            updated_at: now,
            jobs: book.store.jobs.map((row) =>
              row.id === job.id ? { ...row, updates: [...row.updates, update] } : row
            ),
          },
        },
        notices: op.shared
          ? [
              {
                audience: 'customer',
                customer_id: job.customer_id,
                title: 'Job update',
                body: update.note,
              },
            ]
          : [],
      };
    }
    case 'create_quote':
      return buildQuote(book, { ...op, now });
    case 'send_quote':
      return sendQuote(book, op.quote_id, now);
    case 'convert_quote':
      return convertQuote(book, op.quote_id, op.name, now);
    case 'sign_quote':
      return signAndAcceptQuote(book, op.quote_id, { name: op.name, mark: op.mark }, now);
    case 'shift_task': {
      const programme = shiftTask(mustProgramme(book, op.job_id), op.task_id, op.days);
      const job = mustJob(book, op.job_id);
      const task = programme.tasks.find((row) => row.id === op.task_id);
      return {
        book: replaceProgramme({ ...book, store: { ...book.store, updated_at: now } }, programme),
        notices: [
          {
            audience: 'customer',
            customer_id: job.customer_id,
            title: 'Plan updated',
            body: task
              ? `${task.name} moved. Forecast finish ${forecastEnd(task)}.`
              : 'The programme moved.',
          },
        ],
      };
    }
    case 'set_progress': {
      let programme = setTaskProgress(mustProgramme(book, op.job_id), op.task_id, op.progress_pct, op);
      const avg = programme.tasks.length
        ? Math.round(programme.tasks.reduce((sum, task) => sum + task.progress_pct, 0) / programme.tasks.length)
        : 0;
      const job = mustJob(book, op.job_id);
      return {
        book: replaceProgramme(
          {
            ...book,
            store: {
              ...book.store,
              updated_at: now,
              jobs: book.store.jobs.map((row) =>
                row.id === job.id
                  ? {
                      ...row,
                      progress_pct: avg,
                      status:
                        row.status === 'enquiry' || row.status === 'quoted' || row.status === 'cancelled'
                          ? row.status
                          : avg >= 100
                            ? 'done'
                            : avg > 0
                              ? 'in_progress'
                              : row.status,
                    }
                  : row
              ),
            },
          },
          programme
        ),
        notices: [],
      };
    }
    case 'rebaseline': {
      const programme = rebaseline(mustProgramme(book, op.job_id), now, op.reason);
      const job = mustJob(book, op.job_id);
      return {
        book: replaceProgramme({ ...book, store: { ...book.store, updated_at: now } }, programme),
        notices: [
          {
            audience: 'customer',
            customer_id: job.customer_id,
            title: 'Plan re-baselined',
            body: op.reason,
          },
        ],
      };
    }
    case 'create_vo':
      return createVariation(book, { ...op, now });
    case 'send_vo':
      return sendVariation(book, op.vo_id, now);
    case 'approve_vo':
      return approveVariation(book, op.vo_id, { name: op.name, mark: op.mark }, now);
    case 'decline_vo':
      return declineVariation(book, op.vo_id, now);
    case 'create_invoice':
      return raiseInvoice(book, { ...op, now });
    case 'pay_link':
      return issuePayLink(book, op.invoice_id, (id, reference) => op.url || `/preview/tradegraph/pay?invoice=${encodeURIComponent(id)}&ref=${encodeURIComponent(reference)}`);
    case 'record_payment': {
      const store = recordPayment(book.store, op.invoice_id, op.amount_cents, op.method, now);
      const invoice = store.invoices.find((row) => row.id === op.invoice_id);
      let jobs = store.jobs;
      if (invoice) {
        const siblings = store.invoices.filter((row) => row.job_id === invoice.job_id && row.status !== 'void');
        const owing = siblings.reduce((sum, row) => sum + row.total_cents, 0);
        const paid = store.payments
          .filter((row) => siblings.some((item) => item.id === row.invoice_id))
          .reduce((sum, row) => sum + row.amount_cents, 0);
        if (paid >= owing) {
          jobs = jobs.map((job) => (job.id === invoice.job_id ? { ...job, status: 'paid' } : job));
        }
      }
      return {
        book: { store: { ...store, jobs, updated_at: now }, desk: book.desk },
        notices: invoice
          ? [
              {
                audience: 'customer',
                customer_id: invoice.customer_id,
                title: 'Payment recorded',
                body: `${op.method} received.`,
              },
            ]
          : [],
      };
    }
    case 'reschedule': {
      return {
        book: {
          ...book,
          store: {
            ...book.store,
            updated_at: now,
            schedule: book.store.schedule.map((slot) =>
              slot.id === op.slot_id ? { ...slot, starts_at: op.starts_at, ends_at: op.ends_at } : slot
            ),
          },
        },
        notices: [],
      };
    }
    case 'book_slot': {
      const booking: BookingRequest = {
        id: newId('bk'),
        customer_id: op.customer_id,
        starts_at: op.starts_at,
        ends_at: op.ends_at,
        note: op.note,
        status: 'requested',
      };
      return {
        book: {
          store: { ...book.store, updated_at: now },
          desk: { ...book.desk, bookings: [booking, ...book.desk.bookings] },
        },
        notices: [
          {
            audience: 'desk',
            customer_id: op.customer_id,
            title: 'Booking request',
            body: op.note || 'A customer asked for a slot.',
          },
        ],
      };
    }
    case 'confirm_booking': {
      const booking = book.desk.bookings.find((row) => row.id === op.booking_id);
      if (!booking) throw new Error('Booking not found');
      return {
        book: {
          store: {
            ...book.store,
            updated_at: now,
            schedule: [
              ...book.store.schedule,
              {
                id: newId('ts'),
                job_id: null,
                title: booking.note || 'Customer booking',
                starts_at: booking.starts_at,
                ends_at: booking.ends_at,
                address: '',
              },
            ],
          },
          desk: {
            ...book.desk,
            bookings: book.desk.bookings.map((row) =>
              row.id === booking.id ? { ...row, status: 'confirmed' } : row
            ),
          },
        },
        notices: [
          {
            audience: 'customer',
            customer_id: booking.customer_id,
            title: 'Visit confirmed',
            body: `We will be there ${booking.starts_at.slice(0, 16).replace('T', ' ')}.`,
          },
        ],
      };
    }
    case 'message': {
      const body = op.body.trim();
      if (body.length < 1) throw new Error('Write a message');
      return {
        book: {
          store: { ...book.store, updated_at: now },
          desk: {
            ...book.desk,
            messages: [
              ...book.desk.messages,
              {
                id: newId('mg'),
                customer_id: op.customer_id,
                job_id: op.job_id || null,
                from: op.from,
                body,
                at: now,
              },
            ],
          },
        },
        notices: [
          {
            audience: op.from === 'customer' ? 'desk' : 'customer',
            customer_id: op.customer_id,
            title: 'New message',
            body,
          },
        ],
      };
    }
    case 'save_customer': {
      const customer = { ...op.customer, name: op.customer.name.trim() };
      if (!customer.name) throw new Error('Customer name is required');
      if (!customer.id) customer.id = newId('tc');
      const exists = book.store.customers.some((row) => row.id === customer.id);
      return {
        book: {
          store: {
            ...book.store,
            updated_at: now,
            customers: exists
              ? book.store.customers.map((row) => (row.id === customer.id ? customer : row))
              : [...book.store.customers, customer],
          },
          desk: book.desk,
        },
        notices: [],
      };
    }
    case 'add_site': {
      return {
        book: {
          store: book.store,
          desk: {
            ...book.desk,
            sites: [
              ...book.desk.sites,
              {
                id: newId('st'),
                customer_id: op.customer_id,
                label: op.label,
                address: op.address,
                suburb: op.suburb,
                city: op.city,
              },
            ],
          },
        },
        notices: [],
      };
    }
    case 'order_materials': {
      const order: MaterialOrder = {
        id: newId('tm'),
        supplier_id: op.supplier_id ?? null,
        supplier_name: op.supplier_name,
        job_id: op.job_id || null,
        status: 'ordered',
        created_at: now,
        lines: op.lines.map((line) => ({ ...line, id: line.id || newId('tl') })),
      };
      return {
        book: {
          store: { ...book.store, updated_at: now, materials: [order, ...book.store.materials] },
          desk: book.desk,
        },
        notices: [],
      };
    }
    case 'save_task': {
      return {
        book: {
          store: book.store,
          desk: {
            ...book.desk,
            tasks: [
              {
                id: newId('dk'),
                title: op.title,
                due: op.due,
                assignee_id: op.assignee_id || null,
                job_id: op.job_id || null,
                done: false,
              },
              ...book.desk.tasks,
            ],
          },
        },
        notices: [],
      };
    }
    case 'toggle_task': {
      return {
        book: {
          ...book,
          desk: {
            ...book.desk,
            tasks: book.desk.tasks.map((task) =>
              task.id === op.task_id ? { ...task, done: !task.done } : task
            ),
          },
        },
        notices: [],
      };
    }
    case 'add_review': {
      return {
        book: {
          store: book.store,
          desk: {
            ...book.desk,
            reviews: [
              {
                id: newId('rv'),
                customer_id: op.customer_id,
                job_id: op.job_id || null,
                score: Math.max(1, Math.min(5, op.score)),
                comment: op.comment,
              },
              ...book.desk.reviews,
            ],
          },
        },
        notices: [],
      };
    }
    case 'add_notice': {
      return {
        book: {
          store: book.store,
          desk: {
            ...book.desk,
            notices: [{ id: newId('nt'), title: op.title, body: op.body, at: now }, ...book.desk.notices],
          },
        },
        notices: [],
      };
    }
    case 'link_customer': {
      const others = book.desk.customer_links.filter((row) => row.customer_id !== op.customer_id);
      return {
        book: {
          store: book.store,
          desk: {
            ...book.desk,
            customer_links: [...others, { customer_id: op.customer_id, connection_id: op.connection_id }],
          },
        },
        notices: [],
      };
    }
    case 'save_brand': {
      const brand_name = op.brand_name.trim();
      if (brand_name.length < 2) throw new Error('The business needs a name');
      return {
        book: {
          store: {
            ...book.store,
            updated_at: now,
            settings: {
              ...book.store.settings,
              brand_name,
              phone: op.phone.trim(),
              city: op.city.trim() || book.store.settings.city,
            },
          },
          desk: book.desk,
        },
        notices: [],
      };
    }
    case 'request_job': {
      const store = createJobRequest(book.store, { ...op, now });
      return {
        book: { store, desk: book.desk },
        notices: [
          {
            audience: 'desk',
            customer_id: op.customer_id,
            title: 'New job request',
            body: op.description,
          },
        ],
      };
    }
    case 'arrive': {
      const programme = mustProgramme(book, op.job_id);
      const job = mustJob(book, op.job_id);
      return {
        book: replaceProgramme(
          {
            ...book,
            store: {
              ...book.store,
              updated_at: now,
              jobs: book.store.jobs.map((row) =>
                row.id === job.id && (row.status === 'scheduled' || row.status === 'quoted')
                  ? { ...row, status: 'in_progress' }
                  : row
              ),
            },
          },
          {
            ...programme,
            time_entries: [
              ...programme.time_entries,
              { id: newId('te'), member_id: op.member_id, minutes: 1, note: 'Arrived on site', at: now },
            ],
          }
        ),
        notices: [
          {
            audience: 'customer',
            customer_id: job.customer_id,
            title: 'On site',
            body: `${job.number} has arrived at ${job.address}.`,
          },
        ],
      };
    }
    default:
      return { book, notices: [] };
  }
}

