/**
 * Guest customer / supplier portals — people who have not joined the OS.
 * Company-level token = brochure. Viewer token = brochure + their own docs.
 */
import { randomBytes } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getAppUrl } from '@/lib/resend';
import { formatMoney } from '@/lib/customers/types';
import { isMissingRelation } from '@/lib/business/company-data';

export const TRADE_PORTAL_KINDS = ['customer', 'supplier'] as const;
export type TradePortalKind = (typeof TRADE_PORTAL_KINDS)[number];

export const DEFAULT_PORTAL_SECTIONS = {
  quotes: true,
  orders: true,
  invoices: true,
  documents: true,
  purchase_orders: true,
  catalog: false,
} as const;

export type PortalSections = {
  quotes?: boolean;
  orders?: boolean;
  invoices?: boolean;
  documents?: boolean;
  purchase_orders?: boolean;
  catalog?: boolean;
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

function mapViewer(row: Record<string, unknown>): TradePortalViewer {
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
    invited_at: row.invited_at != null ? String(row.invited_at) : undefined,
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
  const { data } = await supabase
    .from('profiles')
    .select(
      'id, trading_name, legal_name, logo_url, city, country, industry, verification_status, website, email, phone'
    )
    .eq('id', companyId)
    .maybeSingle();
  if (!data) return null;
  const name =
    String(data.trading_name || data.legal_name || '').trim() ||
    `Company #${companyId}`;
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'company';
  return {
    id: companyId,
    name,
    legal_name: data.legal_name != null ? String(data.legal_name) : null,
    logo_url: data.logo_url != null ? String(data.logo_url) : null,
    city: data.city != null ? String(data.city) : null,
    country: data.country != null ? String(data.country) : null,
    industry: data.industry != null ? String(data.industry) : null,
    verified: String(data.verification_status || '').toLowerCase() === 'verified',
    website: data.website != null ? String(data.website) : null,
    email: data.email != null ? String(data.email) : null,
    phone: data.phone != null ? String(data.phone) : null,
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

  if (sections.quotes !== false) {
    const { data } = await supabase
      .from('customer_quotes')
      .select(
        'id, quote_number, status, created_at, valid_until, total_amount, currency, customer_name'
      )
      .eq('profile_id', companyId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(40);
    for (const r of data || []) {
      quotes.push(
        moneyRow({
          id: Number(r.id),
          kind: 'quote',
          number: r.quote_number,
          status: r.status,
          date: r.created_at,
          due: r.valid_until,
          amount: r.total_amount,
          currency: r.currency,
        })
      );
    }
  }
  if (sections.orders !== false) {
    const { data } = await supabase
      .from('sales_orders')
      .select(
        'id, order_number, status, created_at, promised_date, total_amount, currency'
      )
      .eq('profile_id', companyId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(40);
    for (const r of data || []) {
      orders.push(
        moneyRow({
          id: Number(r.id),
          kind: 'order',
          number: r.order_number,
          status: r.status,
          date: r.created_at,
          due: r.promised_date,
          amount: r.total_amount,
          currency: r.currency,
        })
      );
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

  const { data } = await supabase
    .from('purchase_orders')
    .select(
      'id, po_number, order_number, status, created_at, total_amount, currency, supplier_id, supplier_profile_id'
    )
    .eq('buyer_profile_id', companyId)
    .order('created_at', { ascending: false })
    .limit(80);
  const linked =
    srm?.linked_profile_id != null ? Number(srm.linked_profile_id) : null;
  const rows = (data || []).filter((r) => {
    const sid = r.supplier_id != null ? Number(r.supplier_id) : null;
    const spid =
      r.supplier_profile_id != null ? Number(r.supplier_profile_id) : null;
    return sid === supplierId || (linked && spid === linked);
  });
  return rows.slice(0, 40).map((r) =>
    moneyRow({
      id: Number(r.id),
      kind: 'purchase_order',
      number: r.po_number || r.order_number,
      status: r.status,
      date: r.created_at,
      amount: r.total_amount,
      currency: r.currency,
    })
  );
}

async function loadSharedDocs(
  companyId: number,
  kind: TradePortalKind
): Promise<Array<{ name: string; url: string; category: string }>> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('profiles')
    .select(
      'registration_certificate_url, vat_certificate_url, bee_certificate_url, metadata'
    )
    .eq('id', companyId)
    .maybeSingle();
  const out: Array<{ name: string; url: string; category: string }> = [];
  const push = (name: string, url: unknown, category: string) => {
    const u = String(url || '').trim();
    if (u) out.push({ name, url: u, category });
  };
  if (data) {
    push('Company registration', data.registration_certificate_url, 'Legal');
    push('VAT certificate', data.vat_certificate_url, 'Financial');
    push('B-BBEE certificate', data.bee_certificate_url, 'Legal');
    const meta = asObject(data.metadata);
    const list = Array.isArray(meta.documents) ? meta.documents : [];
    for (const item of list) {
      const row = asObject(item);
      const url = String(row.url || '').trim();
      const name = String(row.name || 'Document').trim();
      if (url) out.push({ name, url, category: String(row.category || kind) });
    }
  }
  return out.slice(0, 24);
}

export type PublicPortalPayload = {
  kind: TradePortalKind;
  paused: boolean;
  brochure: boolean;
  host: PublicHost;
  welcome: string;
  title: string;
  viewer: { name: string; email: string | null; job_title: string | null } | null;
  accountLabel: string | null;
  quotes: PublicDocRow[];
  orders: PublicDocRow[];
  invoices: PublicDocRow[];
  purchase_orders: PublicDocRow[];
  documents: Array<{ name: string; url: string; category: string }>;
  joinPath: string;
  moneyHint: string | null;
};

export async function loadPublicPortal(
  token: string
): Promise<
  | { ok: true; payload: PublicPortalPayload }
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

  if (viewer && portal.kind === 'customer' && viewer.customer_id) {
    const pack = await loadCustomerDocs(
      portal.profile_id,
      viewer.customer_id,
      sections
    );
    quotes = pack.quotes;
    orders = pack.orders;
    invoices = pack.invoices;
    const { data: cust } = await supabase
      .from('customers')
      .select('trading_name')
      .eq('id', viewer.customer_id)
      .eq('profile_id', portal.profile_id)
      .maybeSingle();
    accountLabel = cust?.trading_name ? String(cust.trading_name) : null;
  }
  if (
    viewer &&
    portal.kind === 'supplier' &&
    viewer.supplier_id &&
    sections.purchase_orders !== false
  ) {
    purchase_orders = await loadSupplierPos(
      portal.profile_id,
      viewer.supplier_id
    );
    const { data: srm } = await supabase
      .from('srm_suppliers')
      .select('trading_name')
      .eq('id', viewer.supplier_id)
      .eq('profile_id', portal.profile_id)
      .maybeSingle();
    accountLabel = srm?.trading_name ? String(srm.trading_name) : null;
  }

  const documents =
    sections.documents !== false
      ? await loadSharedDocs(portal.profile_id, portal.kind)
      : [];

  if (viewer) void touchViewer(viewer.id);

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
      accountLabel,
      quotes,
      orders,
      invoices,
      purchase_orders,
      documents,
      joinPath,
      moneyHint,
    },
  };
}
