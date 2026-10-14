import { getSupabaseServer } from '@/lib/supabase/server-client';
import { emptyDesk, type DeskState } from './desk';
import { newIcsToken } from './public-feeds';
import {
  emptyTradeStore,
  newId,
  type ComplianceCert,
  type ComplianceKind,
  type JobRequest,
  type JobStatus,
  type JobUpdate,
  type MaterialOrder,
  type QuoteLine,
  type QuoteStatus,
  type ScheduleSlot,
  type TradeCustomer,
  type TradeInvoice,
  type TradeJob,
  type TradePayment,
  type TradeQuote,
  type TradegraphStore,
  type TradeKind,
  type InvoiceStatus,
} from './tradegraph';

type DbError = { code?: string; message?: string } | null;

export class TradeSchemaMissingError extends Error {
  constructor(migration = '20261014_tradegraph.sql') {
    super(`Apply supabase/migrations/${migration} before using TradeAdvisor®.`);
  }
}

export function isMissingTradeSchema(error: DbError): boolean {
  if (!error) return false;
  const message = String(error.message || '');
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /trade_workspaces|trade_portal_call/i.test(message)
  );
}

function isMissingIcsColumn(error: DbError): boolean {
  if (!error) return false;
  const message = String(error.message || '');
  return error.code === '42703' || error.code === 'PGRST204' || /ics_token/i.test(message);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown): string {
  return value == null ? '' : String(value);
}

export async function loadTradeStore(companyId: number): Promise<TradegraphStore | null> {
  const supabase = getSupabaseServer();
  const workspace = await supabase
    .from('trade_workspaces')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();
  if (isMissingTradeSchema(workspace.error)) throw new TradeSchemaMissingError();
  if (workspace.error) throw new Error(workspace.error.message);
  if (!workspace.data) return null;

  const [
    customers,
    quotes,
    quoteLines,
    jobs,
    jobLines,
    updates,
    invoices,
    payments,
    materials,
    materialLines,
    schedule,
    compliance,
    requests,
  ] = await Promise.all([
    supabase.from('trade_customers').select('*').eq('company_id', companyId),
    supabase.from('trade_quotes').select('*').eq('company_id', companyId),
    supabase.from('trade_quote_lines').select('*').eq('company_id', companyId),
    supabase.from('trade_jobs').select('*').eq('company_id', companyId),
    supabase.from('trade_job_lines').select('*').eq('company_id', companyId),
    supabase.from('trade_job_updates').select('*').eq('company_id', companyId),
    supabase.from('trade_invoices').select('*').eq('company_id', companyId),
    supabase.from('trade_payments').select('*').eq('company_id', companyId),
    supabase.from('trade_material_orders').select('*').eq('company_id', companyId),
    supabase.from('trade_material_lines').select('*').eq('company_id', companyId),
    supabase.from('trade_schedule').select('*').eq('company_id', companyId),
    supabase.from('trade_compliance').select('*').eq('company_id', companyId),
    supabase.from('trade_job_requests').select('*').eq('company_id', companyId),
  ]);
  for (const result of [
    customers,
    quotes,
    quoteLines,
    jobs,
    jobLines,
    updates,
    invoices,
    payments,
    materials,
    materialLines,
    schedule,
    compliance,
    requests,
  ]) {
    if (isMissingTradeSchema(result.error)) throw new TradeSchemaMissingError();
    if (result.error) throw new Error(result.error.message);
  }

  const linesByQuote = group(quoteLines.data || [], 'quote_id');
  const linesByJob = group(jobLines.data || [], 'job_id');
  const updatesByJob = group(updates.data || [], 'job_id');
  const linesByOrder = group(materialLines.data || [], 'order_id');
  const row = workspace.data as Record<string, unknown>;

  const store: TradegraphStore = {
    updated_at: text(row.updated_at) || new Date().toISOString(),
    settings: {
      brand_name: text(row.brand_name),
      trade: (text(row.trade) || 'handyman') as TradeKind,
      public_token: text(row.public_token),
      vat_rate: num(row.vat_rate) || 0.15,
      phone: text(row.phone),
      city: text(row.city),
      notify_email: text(row.notify_email),
    },
    customers: (customers.data || []).map(mapCustomer),
    quotes: (quotes.data || []).map((raw) => mapQuote(raw, linesByQuote)),
    jobs: (jobs.data || []).map((raw) => mapJob(raw, linesByJob, updatesByJob)),
    invoices: (invoices.data || []).map(mapInvoice),
    payments: (payments.data || []).map(mapPayment),
    materials: (materials.data || []).map((raw) => mapMaterial(raw, linesByOrder)),
    schedule: (schedule.data || []).map(mapSlot),
    compliance: (compliance.data || []).map(mapCert),
    requests: (requests.data || []).map(mapRequest),
  };
  return store;
}

export function parseDesk(value: unknown): DeskState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyDesk();
  const raw = value as Partial<DeskState>;
  const blank = emptyDesk();
  return {
    ...blank,
    ...raw,
    price_book: Array.isArray(raw.price_book) ? raw.price_book : [],
    team: Array.isArray(raw.team) ? raw.team : [],
    sites: Array.isArray(raw.sites) ? raw.sites : [],
    templates: Array.isArray(raw.templates) ? raw.templates : [],
    programmes: Array.isArray(raw.programmes) ? raw.programmes : [],
    quote_meta: Array.isArray(raw.quote_meta) ? raw.quote_meta : [],
    variations: Array.isArray(raw.variations) ? raw.variations : [],
    invoice_meta: Array.isArray(raw.invoice_meta) ? raw.invoice_meta : [],
    messages: Array.isArray(raw.messages) ? raw.messages : [],
    documents: Array.isArray(raw.documents) ? raw.documents : [],
    bookings: Array.isArray(raw.bookings) ? raw.bookings : [],
    availability: Array.isArray(raw.availability) ? raw.availability : [],
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    reviews: Array.isArray(raw.reviews) ? raw.reviews : [],
    notices: Array.isArray(raw.notices) ? raw.notices : [],
    customer_links: Array.isArray(raw.customer_links) ? raw.customer_links : [],
    logo_data_url: typeof raw.logo_data_url === 'string' ? raw.logo_data_url : '',
    feed_replies: Array.isArray(raw.feed_replies) ? raw.feed_replies : [],
  };
}

export async function loadTradeBook(companyId: number): Promise<{
  store: TradegraphStore;
  desk: DeskState;
} | null> {
  const supabase = getSupabaseServer();
  const workspace = await supabase
    .from('trade_workspaces')
    .select('desk')
    .eq('company_id', companyId)
    .maybeSingle();
  const store = await loadTradeStore(companyId);
  if (!store) return null;
  if (workspace.error && /desk/i.test(workspace.error.message || '')) {
    return { store, desk: emptyDesk() };
  }
  return { store, desk: parseDesk(workspace.data?.desk) };
}

function group(rows: unknown[], key: string): Map<string, Record<string, unknown>[]> {
  const out = new Map<string, Record<string, unknown>[]>();
  for (const raw of rows) {
    const row = raw as Record<string, unknown>;
    const id = text(row[key]);
    const list = out.get(id) || [];
    list.push(row);
    out.set(id, list);
  }
  return out;
}

function mapLine(row: Record<string, unknown>): QuoteLine {
  return {
    id: text(row.id),
    description: text(row.description),
    qty: num(row.qty),
    unit_cents: num(row.unit_cents),
  };
}

function mapCustomer(raw: unknown): TradeCustomer {
  const row = raw as Record<string, unknown>;
  return {
    id: text(row.id),
    name: text(row.name),
    email: text(row.email),
    phone: text(row.phone),
    address: text(row.address),
    suburb: text(row.suburb),
    city: text(row.city),
  };
}

function mapQuote(
  raw: unknown,
  lines: Map<string, Record<string, unknown>[]>
): TradeQuote {
  const row = raw as Record<string, unknown>;
  const id = text(row.id);
  return {
    id,
    number: text(row.number),
    customer_id: text(row.customer_id),
    status: text(row.status) as QuoteStatus,
    title: text(row.title),
    lines: (lines.get(id) || []).map(mapLine),
    source_request_id: row.source_request_id ? text(row.source_request_id) : null,
    created_at: text(row.created_at),
  };
}

function mapUpdate(row: Record<string, unknown>): JobUpdate {
  return {
    id: text(row.id),
    at: text(row.at),
    note: text(row.note),
    progress_pct: num(row.progress_pct),
    photo_url: row.photo_url ? text(row.photo_url) : null,
    shared: Boolean(row.shared),
  };
}

function mapJob(
  raw: unknown,
  lines: Map<string, Record<string, unknown>[]>,
  updates: Map<string, Record<string, unknown>[]>
): TradeJob {
  const row = raw as Record<string, unknown>;
  const id = text(row.id);
  return {
    id,
    number: text(row.number),
    customer_id: text(row.customer_id),
    quote_id: row.quote_id ? text(row.quote_id) : null,
    title: text(row.title),
    status: text(row.status) as JobStatus,
    address: text(row.address),
    progress_pct: num(row.progress_pct),
    lines: (lines.get(id) || []).map(mapLine),
    updates: (updates.get(id) || []).map(mapUpdate),
  };
}

function mapInvoice(raw: unknown): TradeInvoice {
  const row = raw as Record<string, unknown>;
  return {
    id: text(row.id),
    number: text(row.number),
    customer_id: text(row.customer_id),
    job_id: text(row.job_id),
    status: text(row.status) as InvoiceStatus,
    subtotal_cents: num(row.subtotal_cents),
    vat_cents: num(row.vat_cents),
    total_cents: num(row.total_cents),
    issued_at: text(row.issued_at),
  };
}

function mapPayment(raw: unknown): TradePayment {
  const row = raw as Record<string, unknown>;
  return {
    id: text(row.id),
    invoice_id: text(row.invoice_id),
    customer_id: text(row.customer_id),
    amount_cents: num(row.amount_cents),
    paid_at: text(row.paid_at),
    method: text(row.method) || 'EFT',
  };
}

function mapMaterial(
  raw: unknown,
  lines: Map<string, Record<string, unknown>[]>
): MaterialOrder {
  const row = raw as Record<string, unknown>;
  const id = text(row.id);
  return {
    id,
    supplier_id: row.supplier_id == null ? null : num(row.supplier_id),
    supplier_name: text(row.supplier_name),
    job_id: row.job_id ? text(row.job_id) : null,
    status: (text(row.status) || 'draft') as MaterialOrder['status'],
    created_at: text(row.created_at),
    lines: (lines.get(id) || []).map(mapLine),
  };
}

function mapSlot(raw: unknown): ScheduleSlot {
  const row = raw as Record<string, unknown>;
  return {
    id: text(row.id),
    job_id: row.job_id ? text(row.job_id) : null,
    title: text(row.title),
    starts_at: text(row.starts_at),
    ends_at: text(row.ends_at),
    address: text(row.address),
  };
}

function mapCert(raw: unknown): ComplianceCert {
  const row = raw as Record<string, unknown>;
  return {
    id: text(row.id),
    kind: text(row.kind) as ComplianceKind,
    number: text(row.number),
    holder: text(row.holder),
    expires_on: text(row.expires_on).slice(0, 10),
    job_id: row.job_id ? text(row.job_id) : null,
  };
}

function mapRequest(raw: unknown): JobRequest {
  const row = raw as Record<string, unknown>;
  const photos = Array.isArray(row.photo_urls) ? row.photo_urls.map((item) => String(item)) : [];
  return {
    id: text(row.id),
    customer_id: text(row.customer_id),
    description: text(row.description),
    address: text(row.address),
    preferred_dates: text(row.preferred_dates),
    photo_urls: photos,
    status: (text(row.status) || 'new') as JobRequest['status'],
    created_at: text(row.created_at),
  };
}

export async function saveTradeStore(
  companyId: number,
  store: TradegraphStore,
  desk?: DeskState
): Promise<void> {
  const supabase = getSupabaseServer();
  const token = store.settings.public_token || newId('tg');
  const workspaceRow: Record<string, unknown> = {
    company_id: companyId,
    brand_name: store.settings.brand_name,
    trade: store.settings.trade || 'handyman',
    public_token: token,
    vat_rate: store.settings.vat_rate || 0.15,
    phone: store.settings.phone || '',
    city: store.settings.city || '',
    notify_email: store.settings.notify_email || '',
    updated_at: new Date().toISOString(),
  };
  if (desk) workspaceRow.desk = desk;
  let workspace = await supabase.from('trade_workspaces').upsert(workspaceRow);
  if (
    desk &&
    workspace.error &&
    /desk|schema cache|column/i.test(workspace.error.message || '')
  ) {
    delete workspaceRow.desk;
    workspace = await supabase.from('trade_workspaces').upsert(workspaceRow);
    if (!workspace.error) {
      throw new TradeSchemaMissingError('20261015_tradegraph_desk.sql');
    }
  }
  if (isMissingTradeSchema(workspace.error)) throw new TradeSchemaMissingError();
  if (workspace.error) throw new Error(workspace.error.message);

  if (store.customers.length) {
    const upserted = await supabase.from('trade_customers').upsert(
      store.customers.map((row) => ({ ...row, company_id: companyId }))
    );
    if (upserted.error) throw new Error(upserted.error.message);
  }

  const clears = await Promise.all([
    supabase.from('trade_quotes').delete().eq('company_id', companyId),
    supabase.from('trade_jobs').delete().eq('company_id', companyId),
    supabase.from('trade_invoices').delete().eq('company_id', companyId),
    supabase.from('trade_job_requests').delete().eq('company_id', companyId),
    supabase.from('trade_material_orders').delete().eq('company_id', companyId),
    supabase.from('trade_schedule').delete().eq('company_id', companyId),
    supabase.from('trade_compliance').delete().eq('company_id', companyId),
  ]);
  for (const result of clears) {
    if (result.error) throw new Error(result.error.message);
  }

  const keep = store.customers.map((row) => row.id);
  const removeCustomers = keep.length
    ? await supabase
        .from('trade_customers')
        .delete()
        .eq('company_id', companyId)
        .not('id', 'in', `(${keep.join(',')})`)
    : await supabase.from('trade_customers').delete().eq('company_id', companyId);
  if (removeCustomers.error) throw new Error(removeCustomers.error.message);
  if (store.quotes.length) {
    const inserted = await supabase.from('trade_quotes').insert(
      store.quotes.map((row) => ({
        id: row.id,
        company_id: companyId,
        customer_id: row.customer_id,
        number: row.number,
        status: row.status,
        title: row.title,
        source_request_id: row.source_request_id,
        created_at: row.created_at,
      }))
    );
    if (inserted.error) throw new Error(inserted.error.message);
    const lines = store.quotes.flatMap((quote) =>
      quote.lines.map((line) => ({
        ...line,
        quote_id: quote.id,
        company_id: companyId,
        customer_id: quote.customer_id,
      }))
    );
    if (lines.length) {
      const lineInsert = await supabase.from('trade_quote_lines').insert(lines);
      if (lineInsert.error) throw new Error(lineInsert.error.message);
    }
  }
  if (store.jobs.length) {
    const inserted = await supabase.from('trade_jobs').insert(
      store.jobs.map((row) => ({
        id: row.id,
        company_id: companyId,
        customer_id: row.customer_id,
        quote_id: row.quote_id,
        number: row.number,
        title: row.title,
        status: row.status,
        address: row.address,
        progress_pct: row.progress_pct,
      }))
    );
    if (inserted.error) throw new Error(inserted.error.message);
    const lines = store.jobs.flatMap((job) =>
      job.lines.map((line) => ({
        ...line,
        job_id: job.id,
        company_id: companyId,
        customer_id: job.customer_id,
      }))
    );
    if (lines.length) {
      const lineInsert = await supabase.from('trade_job_lines').insert(lines);
      if (lineInsert.error) throw new Error(lineInsert.error.message);
    }
    const updates = store.jobs.flatMap((job) =>
      job.updates.map((update) => ({
        ...update,
        job_id: job.id,
        company_id: companyId,
        customer_id: job.customer_id,
      }))
    );
    if (updates.length) {
      const updateInsert = await supabase.from('trade_job_updates').insert(updates);
      if (updateInsert.error) throw new Error(updateInsert.error.message);
    }
  }
  if (store.invoices.length) {
    const inserted = await supabase.from('trade_invoices').insert(
      store.invoices.map((row) => ({ ...row, company_id: companyId }))
    );
    if (inserted.error) throw new Error(inserted.error.message);
  }
  if (store.payments.length) {
    const inserted = await supabase.from('trade_payments').insert(
      store.payments.map((row) => ({ ...row, company_id: companyId }))
    );
    if (inserted.error) throw new Error(inserted.error.message);
  }
  if (store.requests.length) {
    const inserted = await supabase.from('trade_job_requests').insert(
      store.requests.map((row) => ({
        ...row,
        company_id: companyId,
        photo_urls: row.photo_urls,
      }))
    );
    if (inserted.error) throw new Error(inserted.error.message);
  }
  if (store.materials.length) {
    const inserted = await supabase.from('trade_material_orders').insert(
      store.materials.map((row) => ({
        id: row.id,
        company_id: companyId,
        supplier_id: row.supplier_id,
        supplier_name: row.supplier_name,
        job_id: row.job_id,
        status: row.status,
        created_at: row.created_at,
      }))
    );
    if (inserted.error) throw new Error(inserted.error.message);
    const lines = store.materials.flatMap((order) =>
      order.lines.map((line) => ({
        ...line,
        order_id: order.id,
        company_id: companyId,
      }))
    );
    if (lines.length) {
      const lineInsert = await supabase.from('trade_material_lines').insert(lines);
      if (lineInsert.error) throw new Error(lineInsert.error.message);
    }
  }
  if (store.schedule.length) {
    const inserted = await supabase.from('trade_schedule').insert(
      store.schedule.map((row) => ({ ...row, company_id: companyId }))
    );
    if (inserted.error) throw new Error(inserted.error.message);
  }
  if (store.compliance.length) {
    const inserted = await supabase.from('trade_compliance').insert(
      store.compliance.map((row) => ({ ...row, company_id: companyId }))
    );
    if (inserted.error) throw new Error(inserted.error.message);
  }
}

type IcsRead = { missing: true } | { missing: false; token: string | null };

async function readIcsToken(companyId: number): Promise<IcsRead> {
  const supabase = getSupabaseServer();
  const found = await supabase
    .from('trade_workspaces')
    .select('ics_token')
    .eq('company_id', companyId)
    .maybeSingle();
  if (isMissingIcsColumn(found.error)) return { missing: true };
  if (found.error) throw new Error(found.error.message);
  const token = text((found.data as { ics_token?: unknown } | null)?.ics_token);
  return { missing: false, token: token || null };
}

/** Mint a token only when the column exists and the row does not have one yet. */
export async function ensureIcsToken(companyId: number): Promise<string | null> {
  const existing = await readIcsToken(companyId);
  if (existing.missing) return null;
  if (existing.token) return existing.token;
  const supabase = getSupabaseServer();
  const minted = newIcsToken();
  const updated = await supabase
    .from('trade_workspaces')
    .update({ ics_token: minted })
    .eq('company_id', companyId)
    .is('ics_token', null)
    .select('ics_token')
    .maybeSingle();
  if (isMissingIcsColumn(updated.error)) return null;
  if (updated.error) throw new Error(updated.error.message);
  const saved = text((updated.data as { ics_token?: unknown } | null)?.ics_token);
  if (saved) return saved;
  const again = await readIcsToken(companyId);
  return again.missing ? null : again.token;
}

export async function rotateIcsToken(companyId: number): Promise<string | null> {
  const supabase = getSupabaseServer();
  const minted = newIcsToken();
  const updated = await supabase
    .from('trade_workspaces')
    .update({ ics_token: minted })
    .eq('company_id', companyId)
    .select('ics_token')
    .maybeSingle();
  if (isMissingIcsColumn(updated.error)) return null;
  if (updated.error) throw new Error(updated.error.message);
  const saved = text((updated.data as { ics_token?: unknown } | null)?.ics_token);
  return saved || null;
}

export async function companyIdByPublicToken(publicToken: string): Promise<number | null> {
  if (!publicToken) return null;
  const supabase = getSupabaseServer();
  const found = await supabase
    .from('trade_workspaces')
    .select('company_id')
    .eq('public_token', publicToken)
    .maybeSingle();
  if (isMissingTradeSchema(found.error)) throw new TradeSchemaMissingError();
  if (found.error) throw new Error(found.error.message);
  if (!found.data?.company_id) return null;
  return Number(found.data.company_id);
}

export async function workspaceByIcsToken(icsToken: string): Promise<{ companyId: number } | null> {
  if (!/^[A-Za-z0-9_-]{32,80}$/.test(icsToken)) return null;
  const supabase = getSupabaseServer();
  const found = await supabase
    .from('trade_workspaces')
    .select('company_id')
    .eq('ics_token', icsToken)
    .maybeSingle();
  if (isMissingIcsColumn(found.error)) return null;
  if (isMissingTradeSchema(found.error)) throw new TradeSchemaMissingError();
  if (found.error) throw new Error(found.error.message);
  if (!found.data?.company_id) return null;
  return { companyId: Number(found.data.company_id) };
}

export async function workspaceByToken(publicToken: string): Promise<{
  companyId: number;
  store: TradegraphStore;
} | null> {
  const supabase = getSupabaseServer();
  const found = await supabase
    .from('trade_workspaces')
    .select('company_id')
    .eq('public_token', publicToken)
    .maybeSingle();
  if (isMissingTradeSchema(found.error)) throw new TradeSchemaMissingError();
  if (found.error) throw new Error(found.error.message);
  if (!found.data?.company_id) return null;
  const companyId = Number(found.data.company_id);
  const store = await loadTradeStore(companyId);
  if (!store) return null;
  return { companyId, store };
}

export function blankWorkspace(now: string): TradegraphStore {
  return emptyTradeStore(now, newId('tg'));
}
