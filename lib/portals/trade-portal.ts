/**
 * Guest portals for customers and suppliers already on our books.
 * Personal token = that account's orders, OTIFEF, ratings, RIAD, messages.
 * Company token = brochure only.
 */
import { randomBytes } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getAppUrl } from '@/lib/resend';
import { formatMoney } from '@/lib/customers/types';
import { isMissingRelation } from '@/lib/business/company-data';
import { ALL_DOCUMENT_DB_COLUMNS } from '@/lib/business/documentFields';
import {
  filledPortalDocs,
  mergePortalDocSlots,
  portalSharedHostDocsFromMeta,
  type PortalDocSlot,
} from '@/lib/portals/portal-documents';
import { loadHostPurchaseOrders } from '@/lib/portals/host-purchase-orders';
import {
  mergePortalDocRows,
  poBelongsToSupplierViewer,
  poPdfUrlFromMeta,
} from '@/lib/portals/supplier-portal-party';

export type { PortalDocSlot } from '@/lib/portals/portal-documents';

export const TRADE_PORTAL_KINDS = ['customer', 'supplier'] as const;
export type TradePortalKind = (typeof TRADE_PORTAL_KINDS)[number];

export const DEFAULT_PORTAL_SECTIONS = {
  quotes: true,
  orders: true,
  invoices: true,
  documents: true,
  purchase_orders: true,
  catalog: false,
  ratings: true,
  riad: true,
  messages: true,
  stock: true,
  projects: true,
  commercial: true,
} as const;

export type PortalSections = {
  quotes?: boolean;
  orders?: boolean;
  invoices?: boolean;
  documents?: boolean;
  purchase_orders?: boolean;
  catalog?: boolean;
  ratings?: boolean;
  riad?: boolean;
  messages?: boolean;
  stock?: boolean;
  projects?: boolean;
  commercial?: boolean;
};

export type TradePortalRow = {
  id: number;
  profile_id: number;
  kind: TradePortalKind;
  public_token: string;
  title: string | null;
  welcome_message: string | null;
  sections: PortalSections;
  status: 'active' | 'paused';
  created_at?: string;
  updated_at?: string;
};

export type TradePortalViewer = {
  id: number;
  portal_id: number;
  profile_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  token: string;
  customer_id: number | null;
  supplier_id: number | null;
  status: 'active' | 'revoked';
  last_seen_at: string | null;
  invited_at?: string;
};

export type PublicDocRow = {
  id: number;
  kind: string;
  number: string;
  status: string;
  date: string | null;
  due: string | null;
  amount: number | null;
  paid: number | null;
  currency: string;
  title?: string | null;
  ordered?: number | null;
  delivered?: number | null;
  damaged?: number | null;
  attachment_url?: string | null;
  otifef?: {
    overall: number | null;
    onTime: number | null;
    inFull: number | null;
    errorFree: number | null;
    pending: boolean;
  } | null;
  production_status?: string | null;
  production_label?: string | null;
  chain_step?: number;
  completed_at?: string | null;
  confirmed_qty?: number | null;
  rated?: boolean;
  linked?: boolean;
  customer_po_number?: string | null;
  batches?: PortalBatchLot[];
  notes?: string | null;
  fulfilment_status?: string | null;
  messages?: PortalMessageView[];
  lines?: Array<{
    name: string;
    qty: number | null;
    uom: string | null;
    amount: number | null;
    product_id?: number | null;
  }>;
};

export type PortalBatchLot = {
  batch_number: string;
  qty: number | null;
  uom: string | null;
  manufactured_at: string | null;
  expiry_date: string | null;
};

export type PortalRatingView = {
  id: number;
  direction: 'host_rates_them' | 'they_rate_host';
  overall: number;
  quality?: number | null;
  delivery?: number | null;
  communication?: number | null;
  value?: number | null;
  payment?: number | null;
  reliability?: number | null;
  comment: string | null;
  created_at: string | null;
  author: string;
};

export type PortalRiadView = {
  id: number;
  entry_type: string;
  title: string;
  description: string | null;
  status: string;
  severity: string | null;
  notes: string | null;
  created_at: string | null;
  owner_name?: string | null;
  due_date?: string | null;
  category?: string | null;
  mitigation_plan?: string | null;
  resolution?: string | null;
  closed_at?: string | null;
  created_by?: string | null;
  updated_at?: string | null;
  related_project_id?: number | null;
  related_task_id?: number | null;
};

export function portalTaskRiadMark(taskId: number): string {
  return `[[portal_task:${taskId}]]`;
}

export function parsePortalTaskRiadId(notes: string | null | undefined): number | null {
  const m = String(notes || '').match(/\[\[portal_task:(\d+)\]\]/);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function stripPortalTaskRiadMark(notes: string | null | undefined): string {
  return String(notes || '')
    .replace(/\[\[portal_task:\d+\]\]\s*/g, '')
    .trim();
}

export type PortalMessageView = {
  id: number;
  author: 'host' | 'guest';
  body: string;
  created_at: string;
  purchase_order_id?: number | null;
};

export type PortalStockLine = {
  product_id: number | null;
  sku: string | null;
  name: string;
  qty_on_hand: number | null;
  qty_reserved?: number | null;
  qty_available?: number | null;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  product_type?: string | null;
  primary_image_url?: string | null;
  lot_number?: string | null;
  expiry_date?: string | null;
  po_id: number | null;
};

export type PortalProjectTask = {
  id: number;
  title: string;
  column_key: string;
  start_date: string | null;
  due_date: string | null;
  phase_key: string | null;
  assignee?: string | null;
  assignee_viewer_id?: number | null;
  assignee_member_id?: number | null;
  description?: string | null;
  parent_task_id?: number | null;
};

export type PortalProjectView = {
  id: number;
  name: string;
  status: string;
  health: string | null;
  start_date: string | null;
  target_date: string | null;
  description: string | null;
  tasks: PortalProjectTask[];
};

export type PublicHost = {
  id: number;
  name: string;
  legal_name: string | null;
  logo_url: string | null;
  city: string | null;
  country: string | null;
  industry: string | null;
  verified: boolean;
  website: string | null;
  email: string | null;
  phone: string | null;
  public_path: string;
};

export type PortalPersonPublic = {
  id: number;
  name: string;
  email: string | null;
  job_title: string | null;
  last_seen_at: string | null;
  you: boolean;
  /** Host company team vs guest portal members */
  side?: 'host' | 'guest';
};

export function isTradePortalKind(v: unknown): v is TradePortalKind {
  return v === 'customer' || v === 'supplier';
}

export function newPortalToken(kind: 'portal' | 'viewer'): string {
  const prefix = kind === 'portal' ? 'tp' : 'tv';
  return `${prefix}_${randomBytes(18).toString('hex')}`;
}

export function portalPublicPath(token: string): string {
  return `/portal/${encodeURIComponent(token)}`;
}

export function portalPublicUrl(token: string): string {
  return `${getAppUrl()}${portalPublicPath(token)}`;
}

export function normalizeSections(raw: unknown): PortalSections {
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out: PortalSections = { ...DEFAULT_PORTAL_SECTIONS };
  for (const key of Object.keys(DEFAULT_PORTAL_SECTIONS) as Array<
    keyof PortalSections
  >) {
    if (typeof src[key] === 'boolean') out[key] = src[key] as boolean;
  }
  return out;
}

export function migrationHint(): string {
  return 'Run supabase/migrations/20260822_trade_portals.sql in the Supabase SQL editor.';
}

function asObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function mapPortal(row: Record<string, unknown>): TradePortalRow {
  return {
    id: Number(row.id),
    profile_id: Number(row.profile_id),
    kind: row.kind === 'supplier' ? 'supplier' : 'customer',
    public_token: String(row.public_token || ''),
    title: row.title != null ? String(row.title) : null,
    welcome_message:
      row.welcome_message != null ? String(row.welcome_message) : null,
    sections: normalizeSections(row.sections),
    status: row.status === 'paused' ? 'paused' : 'active',
    created_at: row.created_at != null ? String(row.created_at) : undefined,
    updated_at: row.updated_at != null ? String(row.updated_at) : undefined,
  };
}

export function mapViewer(row: Record<string, unknown>): TradePortalViewer {
  return {
    id: Number(row.id),
    portal_id: Number(row.portal_id),
    profile_id: Number(row.profile_id),
    name: String(row.name || 'Guest'),
    email: row.email != null ? String(row.email) : null,
    phone: row.phone != null ? String(row.phone) : null,
    job_title: row.job_title != null ? String(row.job_title) : null,
    token: String(row.token || ''),
    customer_id:
      row.customer_id != null && Number.isFinite(Number(row.customer_id))
        ? Number(row.customer_id)
        : null,
    supplier_id:
      row.supplier_id != null && Number.isFinite(Number(row.supplier_id))
        ? Number(row.supplier_id)
        : null,
    status: row.status === 'revoked' ? 'revoked' : 'active',
    last_seen_at:
      row.last_seen_at != null ? String(row.last_seen_at) : null,
    invited_at:
      row.invited_at != null
        ? String(row.invited_at)
        : row.created_at != null
          ? String(row.created_at)
          : undefined,
  };
}

export async function ensureTradePortal(opts: {
  companyId: number;
  kind: TradePortalKind;
}): Promise<
  | { ok: true; portal: TradePortalRow }
  | { ok: false; error: string; missingTable?: boolean }
> {
  const supabase = getSupabaseServer();
  const { data: existing, error } = await supabase
    .from('trade_portals')
    .select('*')
    .eq('profile_id', opts.companyId)
    .eq('kind', opts.kind)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: isMissingRelation(error) ? migrationHint() : error.message,
      missingTable: isMissingRelation(error),
    };
  }
  if (existing) return { ok: true, portal: mapPortal(asObject(existing)) };

  const insert = await supabase
    .from('trade_portals')
    .insert({
      profile_id: opts.companyId,
      kind: opts.kind,
      public_token: newPortalToken('portal'),
      title:
        opts.kind === 'customer' ? 'Customer portal' : 'Supplier portal',
      welcome_message: '',
      sections: DEFAULT_PORTAL_SECTIONS,
      status: 'active',
    })
    .select('*')
    .single();

  if (insert.error) {
    if (insert.error.code === '23505') {
      const again = await supabase
        .from('trade_portals')
        .select('*')
        .eq('profile_id', opts.companyId)
        .eq('kind', opts.kind)
        .maybeSingle();
      if (again.data) return { ok: true, portal: mapPortal(asObject(again.data)) };
    }
    return {
      ok: false,
      error: isMissingRelation(insert.error)
        ? migrationHint()
        : insert.error.message,
      missingTable: isMissingRelation(insert.error),
    };
  }
  return { ok: true, portal: mapPortal(asObject(insert.data)) };
}

export async function listViewers(opts: {
  companyId: number;
  portalId: number;
}): Promise<
  | { ok: true; viewers: TradePortalViewer[] }
  | { ok: false; error: string; missingTable?: boolean }
> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('trade_portal_viewers')
    .select('*')
    .eq('profile_id', opts.companyId)
    .eq('portal_id', opts.portalId)
    .order('created_at', { ascending: false })
    .limit(400);
  if (error) {
    return {
      ok: false,
      error: isMissingRelation(error) ? migrationHint() : error.message,
      missingTable: isMissingRelation(error),
    };
  }
  return {
    ok: true,
    viewers: (data || []).map((r) => mapViewer(asObject(r))),
  };
}

export async function touchViewer(viewerId: number): Promise<void> {
  try {
    const supabase = getSupabaseServer();
    await supabase
      .from('trade_portal_viewers')
      .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', viewerId);
  } catch {
    /* soft */
  }
}

function portalQuoteLines(
  raw: unknown
): PublicDocRow['lines'] {
  if (!Array.isArray(raw)) return [];
  const out: NonNullable<PublicDocRow['lines']> = [];
  for (const item of raw.slice(0, 40)) {
    const row = asObject(item);
    const name = String(row.name || row.description || row.sku || '').trim();
    if (!name) continue;
    const qtyRaw = row.quantity ?? row.qty;
    const amtRaw = row.line_total ?? row.amount;
    out.push({
      name: name.slice(0, 160),
      qty: qtyRaw != null && Number.isFinite(Number(qtyRaw)) ? Number(qtyRaw) : null,
      uom: row.uom != null ? String(row.uom).slice(0, 24) : null,
      amount:
        amtRaw != null && Number.isFinite(Number(amtRaw)) ? Number(amtRaw) : null,
    });
  }
  return out;
}

function moneyRow(opts: {
  id: number;
  kind: string;
  number: unknown;
  status: unknown;
  date: unknown;
  due?: unknown;
  amount: unknown;
  paid?: unknown;
  currency: unknown;
  title?: unknown;
}): PublicDocRow {
  return {
    id: opts.id,
    kind: opts.kind,
    number: String(opts.number || `#${opts.id}`),
    status: String(opts.status || 'open'),
    date: opts.date != null ? String(opts.date).slice(0, 10) : null,
    due: opts.due != null ? String(opts.due).slice(0, 10) : null,
    amount: opts.amount != null ? Number(opts.amount) : null,
    paid: opts.paid != null ? Number(opts.paid) : null,
    currency: String(opts.currency || 'ZAR'),
    title: opts.title != null ? String(opts.title) : null,
  };
}

async function loadHost(companyId: number): Promise<PublicHost | null> {
  const supabase = getSupabaseServer();
  const selects = [
    'id, trading_name, legal_name, logo_url, city, country, industry, verification_status, website, email, contact_number',
    'id, trading_name, legal_name, logo_url, city, country, verification_status, website, email',
    'id, trading_name, legal_name, logo_url',
  ];
  let data: Record<string, unknown> | null = null;
  for (const sel of selects) {
    const r = await supabase
      .from('profiles')
      .select(sel)
      .eq('id', companyId)
      .maybeSingle();
    if (r.data && typeof r.data === 'object') {
      data = r.data as unknown as Record<string, unknown>;
      break;
    }
  }
  if (!data) {
    return {
      id: companyId,
      name: `Company #${companyId}`,
      legal_name: null,
      logo_url: null,
      city: null,
      country: null,
      industry: null,
      verified: false,
      website: null,
      email: null,
      phone: null,
      public_path: `/c/company-${companyId}`,
    };
  }
  const name =
    String(data.trading_name || data.legal_name || '').trim() ||
    `Company #${companyId}`;
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'company';
  const phoneRaw = data.contact_number ?? data.phone;
  return {
    id: companyId,
    name,
    legal_name: data.legal_name != null ? String(data.legal_name) : null,
    logo_url: data.logo_url != null ? String(data.logo_url) : null,
    city: data.city != null ? String(data.city) : null,
    country: data.country != null ? String(data.country) : null,
    industry: data.industry != null ? String(data.industry) : null,
    verified:
      String(data.verification_status || '').toLowerCase() === 'verified',
    website: data.website != null ? String(data.website) : null,
    email: data.email != null ? String(data.email) : null,
    phone: phoneRaw != null ? String(phoneRaw) : null,
    public_path: `/c/${slug}-${companyId}`,
  };
}

async function loadCustomerDocs(
  companyId: number,
  customerId: number,
  sections: PortalSections
): Promise<{ quotes: PublicDocRow[]; orders: PublicDocRow[]; invoices: PublicDocRow[] }> {
  const supabase = getSupabaseServer();
  const quotes: PublicDocRow[] = [];
  const orders: PublicDocRow[] = [];
  const invoices: PublicDocRow[] = [];

  {
    const qHit = await supabase
      .from('customer_quotes')
      .select(
        'id, quote_number, status, created_at, valid_until, total_amount, currency, notes, items'
      )
      .eq('profile_id', companyId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(80);
    let quoteRows: Record<string, unknown>[] = (qHit.data ||
      []) as unknown as Record<string, unknown>[];
    if (qHit.error) {
      const retry = await supabase
        .from('customer_quotes')
        .select(
          'id, quote_number, status, created_at, valid_until, total_amount, currency'
        )
        .eq('profile_id', companyId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(80);
      quoteRows = (retry.data || []) as unknown as Record<string, unknown>[];
    }
    for (const raw of quoteRows) {
      const r = asObject(raw);
      quotes.push({
        ...moneyRow({
          id: Number(r.id),
          kind: 'quote',
          number: r.quote_number,
          status: r.status || 'draft',
          date: r.created_at,
          due: r.valid_until,
          amount: r.total_amount,
          currency: r.currency,
        }),
        notes: r.notes != null ? String(r.notes).slice(0, 400) : null,
        lines: portalQuoteLines(r.items),
      });
    }
  }
  if (sections.orders !== false) {
    const soHit = await supabase
      .from('sales_orders')
      .select(
        'id, order_number, status, created_at, promised_date, total_amount, currency, production_status, shipped_date, metadata'
      )
      .eq('profile_id', companyId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(40);
    let soRows: Record<string, unknown>[] = (soHit.data ||
      []) as unknown as Record<string, unknown>[];
    if (soHit.error) {
      const retry = await supabase
        .from('sales_orders')
        .select(
          'id, order_number, status, created_at, promised_date, total_amount, currency'
        )
        .eq('profile_id', companyId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(40);
      soRows = (retry.data || []) as unknown as Record<string, unknown>[];
    }
    for (const raw of soRows) {
      const r = asObject(raw);
      const row = moneyRow({
        id: Number(r.id),
        kind: 'order',
        number: r.order_number,
        status: r.status,
        date: r.created_at,
        due: r.promised_date,
        amount: r.total_amount,
        currency: r.currency,
      });
      const prod =
        (r as { production_status?: string | null }).production_status || null;
      const meta = asObject((r as { metadata?: unknown }).metadata);
      orders.push({
        ...row,
        production_status: prod,
        completed_at: (r as { shipped_date?: string | null }).shipped_date
          ? String((r as { shipped_date?: string | null }).shipped_date).slice(0, 10)
          : null,
        customer_po_number: meta.customer_po_number
          ? String(meta.customer_po_number)
          : null,
      });
    }
  }
  if (sections.invoices !== false) {
    const { data } = await supabase
      .from('customer_invoices')
      .select(
        'id, invoice_number, status, issue_date, due_date, total_amount, amount_paid, currency'
      )
      .eq('profile_id', companyId)
      .eq('customer_id', customerId)
      .order('issue_date', { ascending: false })
      .limit(40);
    for (const r of data || []) {
      invoices.push(
        moneyRow({
          id: Number(r.id),
          kind: 'invoice',
          number: r.invoice_number,
          status: r.status,
          date: r.issue_date,
          due: r.due_date,
          amount: r.total_amount,
          paid: r.amount_paid,
          currency: r.currency,
        })
      );
    }
  }
  return { quotes, orders, invoices };
}

async function loadSupplierPos(
  companyId: number,
  supplierId: number
): Promise<PublicDocRow[]> {
  const supabase = getSupabaseServer();
  const { data: srm } = await supabase
    .from('srm_suppliers')
    .select('id, linked_profile_id, trading_name')
    .eq('id', supplierId)
    .eq('profile_id', companyId)
    .maybeSingle();

  const data = await loadHostPurchaseOrders({ companyId, limit: 80 });
  const linked =
    srm?.linked_profile_id != null ? Number(srm.linked_profile_id) : null;
  const rows = data.filter((r) =>
    poBelongsToSupplierViewer(r, {
      supplierId,
      linkedProfileId: linked,
    })
  );
  return rows.slice(0, 40).map((r) => ({
    ...moneyRow({
      id: Number(r.id),
      kind: 'purchase_order',
      number: r.po_number || r.order_number,
      status: r.status,
      date: r.created_at,
      amount: r.total_amount,
      currency: r.currency,
    }),
    attachment_url: poPdfUrlFromMeta(r.metadata),
  }));
}

const PROFILE_DOC_SELECT = `${ALL_DOCUMENT_DB_COLUMNS.filter(
  (c) => c !== 'logo_url'
).join(', ')}, metadata`;

const PROFILE_DOC_SELECT_FALLBACK =
  'registration_certificate_url, registration_document_url, vat_certificate_url, vat_document_url, bee_certificate_url, bank_confirmation_url, import_license_url, import_document_url, export_license_url, export_document_url, tax_document_url, metadata';

async function loadProfileDocRow(
  companyId: number
): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseServer();
  const hit = await supabase
    .from('profiles')
    .select(PROFILE_DOC_SELECT)
    .eq('id', companyId)
    .maybeSingle();
  if (!hit.error && hit.data) return asObject(hit.data);
  const retry = await supabase
    .from('profiles')
    .select(PROFILE_DOC_SELECT_FALLBACK)
    .eq('id', companyId)
    .maybeSingle();
  return retry.data ? asObject(retry.data) : null;
}

async function loadSharedDocs(companyId: number): Promise<PortalDocSlot[]> {
  const row = await loadProfileDocRow(companyId);
  return mergePortalDocSlots({ profileRow: row });
}

async function loadAccountDocs(opts: {
  companyId: number;
  kind: TradePortalKind;
  customerId?: number | null;
  supplierId?: number | null;
}): Promise<PortalDocSlot[]> {
  const supabase = getSupabaseServer();
  let metadata: unknown = null;
  let linked: number | null = null;
  if (opts.kind === 'customer' && opts.customerId) {
    const hit = await supabase
      .from('customers')
      .select('metadata, linked_profile_id')
      .eq('id', opts.customerId)
      .eq('profile_id', opts.companyId)
      .maybeSingle();
    let row: Record<string, unknown> | null =
      !hit.error && hit.data ? asObject(hit.data) : null;
    if (hit.error) {
      const retry = await supabase
        .from('customers')
        .select('linked_profile_id')
        .eq('id', opts.customerId)
        .eq('profile_id', opts.companyId)
        .maybeSingle();
      row = retry.data ? asObject(retry.data) : null;
    }
    if (row) {
      metadata = row.metadata;
      if (row.linked_profile_id) linked = Number(row.linked_profile_id);
    }
  } else if (opts.kind === 'supplier' && opts.supplierId) {
    const hit = await supabase
      .from('srm_suppliers')
      .select('metadata, linked_profile_id')
      .eq('id', opts.supplierId)
      .eq('profile_id', opts.companyId)
      .maybeSingle();
    let row: Record<string, unknown> | null =
      !hit.error && hit.data ? asObject(hit.data) : null;
    if (hit.error) {
      const retry = await supabase
        .from('srm_suppliers')
        .select('linked_profile_id')
        .eq('id', opts.supplierId)
        .eq('profile_id', opts.companyId)
        .maybeSingle();
      row = retry.data ? asObject(retry.data) : null;
    }
    if (row) {
      metadata = row.metadata;
      if (row.linked_profile_id) linked = Number(row.linked_profile_id);
    }
  }
  let linkedRow: Record<string, unknown> | null = null;
  if (linked && linked > 0 && linked !== opts.companyId) {
    linkedRow = await loadProfileDocRow(linked);
  }
  return mergePortalDocSlots({ profileRow: linkedRow, metadata });
}

export type PublicPortalPayload = {
  kind: TradePortalKind;
  paused: boolean;
  brochure: boolean;
  host: PublicHost;
  welcome: string;
  title: string;
  viewer: { name: string; email: string | null; job_title: string | null } | null;
  /** Logged-in host company member, or the guest on this token. */
  actor?: { role: 'host' | 'guest'; name: string; email: string | null };
  accountLabel: string | null;
  /** Customer/supplier book logo (falls back to linked platform logo). */
  accountLogo?: string | null;
  quotes: PublicDocRow[];
  orders: PublicDocRow[];
  invoices: PublicDocRow[];
  purchase_orders: PublicDocRow[];
  documents: Array<{ name: string; url: string; category: string }>;
  /** Host company (e.g. Big Five Foods) required + extra docs */
  hostDocuments?: PortalDocSlot[];
  /** Party ticks for host pack. Null = all published URLs (Brief 20). */
  hostDocShare?: Record<string, boolean> | null;
  /** Customer/supplier book + linked company required + extra docs */
  accountDocuments?: PortalDocSlot[];
  joinPath: string;
  moneyHint: string | null;
  kpis: {
    quotes: number;
    orders: number;
    invoices_open: number;
    due: number | null;
    currency: string;
    people: number;
  };
  people: PortalPersonPublic[];
  workspace?: import('@/lib/portals/trade-portal-workspace').PortalWorkspace | null;
};

export async function loadPublicPortal(
  token: string,
  opts?: { touchViewer?: boolean }
): Promise<
  | { ok: true; payload: PublicPortalPayload; viewerId: number | null }
  | { ok: false; error: string; status: number }
> {
  const tok = String(token || '').trim();
  if (tok.length < 12) {
    return { ok: false, error: 'Invalid portal link', status: 404 };
  }
  const supabase = getSupabaseServer();

  const viewerHit = await supabase
    .from('trade_portal_viewers')
    .select('*')
    .eq('token', tok)
    .maybeSingle();
  if (viewerHit.error && isMissingRelation(viewerHit.error)) {
    return { ok: false, error: migrationHint(), status: 503 };
  }

  let portalRow: Record<string, unknown> | null = null;
  let viewer: TradePortalViewer | null = null;

  if (viewerHit.data) {
    const v = mapViewer(asObject(viewerHit.data));
    if (v.status !== 'active') {
      return { ok: false, error: 'This access link was revoked', status: 403 };
    }
    viewer = v;
    const p = await supabase
      .from('trade_portals')
      .select('*')
      .eq('id', v.portal_id)
      .maybeSingle();
    portalRow = p.data ? asObject(p.data) : null;
  } else {
    const p = await supabase
      .from('trade_portals')
      .select('*')
      .eq('public_token', tok)
      .maybeSingle();
    portalRow = p.data ? asObject(p.data) : null;
  }

  if (!portalRow) {
    return { ok: false, error: 'Portal not found', status: 404 };
  }
  const portal = mapPortal(portalRow);
  if (portal.status === 'paused') {
    return { ok: false, error: 'This portal is paused', status: 403 };
  }

  const host = await loadHost(portal.profile_id);
  if (!host) {
    return { ok: false, error: 'Company not found', status: 404 };
  }

  const sections = portal.sections;
  const brochure = !viewer;
  let quotes: PublicDocRow[] = [];
  let orders: PublicDocRow[] = [];
  let invoices: PublicDocRow[] = [];
  let purchase_orders: PublicDocRow[] = [];
  let accountLabel: string | null = null;
  let accountLogo: string | null = null;
  let partyMeta: unknown = null;

  if (viewer && portal.kind === 'customer' && viewer.customer_id) {
    const pack = await loadCustomerDocs(
      portal.profile_id,
      viewer.customer_id,
      sections
    );
    quotes = pack.quotes;
    orders = pack.orders;
    invoices = pack.invoices;
    const custWide = await supabase
      .from('customers')
      .select('trading_name, logo_url, linked_profile_id, metadata')
      .eq('id', viewer.customer_id)
      .eq('profile_id', portal.profile_id)
      .maybeSingle();
    let custRow: Record<string, unknown> | null =
      !custWide.error && custWide.data
        ? (custWide.data as unknown as Record<string, unknown>)
        : null;
    if (custWide.error) {
      const retry = await supabase
        .from('customers')
        .select('trading_name, linked_profile_id')
        .eq('id', viewer.customer_id)
        .eq('profile_id', portal.profile_id)
        .maybeSingle();
      custRow = retry.data
        ? (retry.data as unknown as Record<string, unknown>)
        : null;
    }
    partyMeta = custRow?.metadata ?? null;
    accountLabel = custRow?.trading_name
      ? String(custRow.trading_name)
      : null;
    accountLogo = custRow?.logo_url ? String(custRow.logo_url) : null;
    if (!accountLogo && custRow?.linked_profile_id) {
      const { data: lp } = await supabase
        .from('profiles')
        .select('logo_url')
        .eq('id', Number(custRow.linked_profile_id))
        .maybeSingle();
      if (lp?.logo_url) accountLogo = String(lp.logo_url);
    }
  }
  if (viewer && portal.kind === 'supplier' && viewer.supplier_id) {
    if (sections.purchase_orders !== false) {
      purchase_orders = await loadSupplierPos(
        portal.profile_id,
        viewer.supplier_id
      );
    }
    const srmWide = await supabase
      .from('srm_suppliers')
      .select('trading_name, logo_url, linked_profile_id, metadata')
      .eq('id', viewer.supplier_id)
      .eq('profile_id', portal.profile_id)
      .maybeSingle();
    let srmRow: Record<string, unknown> | null =
      !srmWide.error && srmWide.data
        ? (srmWide.data as unknown as Record<string, unknown>)
        : null;
    if (srmWide.error) {
      const retry = await supabase
        .from('srm_suppliers')
        .select('trading_name, linked_profile_id')
        .eq('id', viewer.supplier_id)
        .eq('profile_id', portal.profile_id)
        .maybeSingle();
      srmRow = retry.data
        ? (retry.data as unknown as Record<string, unknown>)
        : null;
    }
    partyMeta = srmRow?.metadata ?? partyMeta;
    accountLabel = srmRow?.trading_name
      ? String(srmRow.trading_name)
      : accountLabel;
    accountLogo = srmRow?.logo_url ? String(srmRow.logo_url) : accountLogo;
    if (!accountLogo && srmRow?.linked_profile_id) {
      const { data: lp } = await supabase
        .from('profiles')
        .select('logo_url')
        .eq('id', Number(srmRow.linked_profile_id))
        .maybeSingle();
      if (lp?.logo_url) accountLogo = String(lp.logo_url);
    }
  }

  const hostSlots =
    sections.documents !== false
      ? await loadSharedDocs(portal.profile_id)
      : [];
  const documents = filledPortalDocs(hostSlots);
  let accountDocuments: PortalDocSlot[] = [];
  if (viewer && (viewer.customer_id || viewer.supplier_id)) {
    try {
      accountDocuments = await loadAccountDocs({
        companyId: portal.profile_id,
        kind: portal.kind,
        customerId: viewer.customer_id,
        supplierId: viewer.supplier_id,
      });
    } catch {
      accountDocuments = [];
    }
  }

  if (viewer && opts?.touchViewer !== false) void touchViewer(viewer.id);

  let people: PortalPersonPublic[] = [];
  if (viewer && (viewer.customer_id || viewer.supplier_id)) {
    try {
      const {
        listAccountPeople,
        listHostTeam,
        mergePortalPeople,
        publicPeopleView,
      } = await import('@/lib/portals/trade-portal-people');
      const listed = await listAccountPeople({
        companyId: portal.profile_id,
        portalId: portal.id,
        customerId: viewer.customer_id,
        supplierId: viewer.supplier_id,
      });
      const guests = listed.ok
        ? publicPeopleView(listed.people, viewer.id)
        : [];
      const hostTeam = await listHostTeam(portal.profile_id);
      people = mergePortalPeople(hostTeam, guests);
    } catch {
      people = [];
    }
  }

  let workspace = null;
  if (viewer && (viewer.customer_id || viewer.supplier_id)) {
    try {
      const { loadPortalWorkspace } = await import(
        '@/lib/portals/trade-portal-workspace'
      );
      workspace = await loadPortalWorkspace({ portal, viewer });
      if (portal.kind === 'supplier') {
        purchase_orders = mergePortalDocRows(
          workspace.purchase_orders,
          purchase_orders
        );
      }
    } catch {
      workspace = null;
    }
  }

  const openInvoices = invoices.filter((i) => {
    const st = i.status.toLowerCase();
    return st !== 'paid' && st !== 'void' && st !== 'cancelled';
  });
  const due = openInvoices.reduce(
    (n, i) => n + Math.max(0, Number(i.amount || 0) - Number(i.paid || 0)),
    0
  );
  const moneyHint =
    portal.kind === 'customer' && openInvoices.length
      ? `${openInvoices.length} open invoice${openInvoices.length === 1 ? '' : 's'} · ${formatMoney(due, openInvoices[0]?.currency || 'ZAR')}`
      : portal.kind === 'supplier' && purchase_orders.length
        ? `${purchase_orders.length} purchase order${purchase_orders.length === 1 ? '' : 's'}`
        : null;

  const joinPath =
    portal.kind === 'customer'
      ? `/login?from=customer-portal`
      : `/login?from=supplier-portal`;

  return {
    ok: true,
    viewerId: viewer ? viewer.id : null,
    payload: {
      kind: portal.kind,
      paused: false,
      brochure,
      host,
      welcome: String(portal.welcome_message || '').trim(),
      title:
        String(portal.title || '').trim() ||
        (portal.kind === 'customer' ? 'Customer portal' : 'Supplier portal'),
      viewer: viewer
        ? {
            name: viewer.name,
            email: viewer.email,
            job_title: viewer.job_title,
          }
        : null,
      actor: viewer
        ? {
            role: 'guest',
            name: viewer.name,
            email: viewer.email,
          }
        : { role: 'guest', name: 'Guest', email: null },
      accountLabel,
      accountLogo,
      quotes,
      orders,
      invoices,
      purchase_orders,
      documents,
      hostDocuments: hostSlots,
      hostDocShare: portalSharedHostDocsFromMeta(partyMeta),
      accountDocuments,
      joinPath,
      moneyHint,
      kpis: {
        quotes: quotes.length,
        orders: portal.kind === 'customer' ? orders.length : purchase_orders.length,
        invoices_open: openInvoices.length,
        due: portal.kind === 'customer' && openInvoices.length ? due : null,
        currency: openInvoices[0]?.currency || 'ZAR',
        people: people.length,
      },
      people,
      workspace,
    },
  };
}
