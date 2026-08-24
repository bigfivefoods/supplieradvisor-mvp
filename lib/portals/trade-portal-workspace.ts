import { getSupabaseServer } from '@/lib/supabase/server-client';
import { productAssignedToCustomer } from '@/lib/inventory/customer-brand';
import { otifefForLine, rollupOtifef } from '@/lib/portals/otifef-line';
import type { OtifefMetrics } from '@/lib/suppliers/types';
import type {
  PortalMessageView,
  PortalRatingView,
  PortalRiadView,
  PortalProjectView,
  PortalStockLine,
  PublicDocRow,
  TradePortalKind,
  TradePortalRow,
  TradePortalViewer,
} from '@/lib/portals/trade-portal';

function asObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function metaOf(row: Record<string, unknown>): Record<string, unknown> {
  return asObject(row.metadata);
}

export type BookProfile = {
  trading_name: string;
  legal_name: string;
  contact_name: string;
  job_title: string;
  email: string;
  phone: string;
  website: string;
  vat_number: string;
  registration_number: string;
  address: string;
  city: string;
  country: string;
  payment_terms: string;
  industry: string;
};

export const BOOK_PROFILE_REQUIRED: Array<{ key: keyof BookProfile; label: string }> = [
  { key: 'trading_name', label: 'Trading name' },
  { key: 'contact_name', label: 'Contact name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
];

export function bookProfileGaps(p: BookProfile | null): string[] {
  if (!p) return BOOK_PROFILE_REQUIRED.map((f) => f.label);
  return BOOK_PROFILE_REQUIRED.filter((f) => !String(p[f.key] || '').trim()).map(
    (f) => f.label
  );
}

/** Sellable line from host inventory — shown on customer portal Raise PO. */
export type PortalCatalogueItem = {
  id: number;
  name: string;
  sku: string | null;
  product_type: string | null;
  uom: string | null;
  unit_price: number;
  currency: string;
  short_description: string | null;
  primary_image_url: string | null;
  customer_brand?: boolean;
};

export type PortalWorkspace = {
  onBooks: boolean;
  linkedProfileId: number | null;
  bookProfile: BookProfile | null;
  profileGaps: string[];
  otifef: OtifefMetrics;
  ratings: PortalRatingView[];
  riad: PortalRiadView[];
  messages: PortalMessageView[];
  stock: PortalStockLine[];
  purchase_orders: PublicDocRow[];
  inbound_pos: PublicDocRow[];
  projects: PortalProjectView[];
  /** Host sellable products (customer portal only) for PO product picker */
  catalogue: PortalCatalogueItem[];
};

function poToDoc(r: Record<string, unknown>, otifefInput: Parameters<typeof otifefForLine>[0]): PublicDocRow {
  const ot = otifefForLine(otifefInput);
  const meta = metaOf(r);
  return {
    id: Number(r.id),
    kind: 'purchase_order',
    number: String(r.po_number || r.order_number || `#${r.id}`),
    status: String(r.status || 'draft'),
    date: r.created_at != null ? String(r.created_at).slice(0, 10) : null,
    due: r.promised_date != null ? String(r.promised_date).slice(0, 10) : null,
    amount: r.total_amount != null ? Number(r.total_amount) : null,
    paid: null,
    currency: String(r.currency || 'ZAR'),
    ordered: otifefInput.ordered ?? null,
    delivered: otifefInput.delivered ?? null,
    damaged: otifefInput.damaged ?? null,
    attachment_url:
      meta.attachment_url != null ? String(meta.attachment_url) : null,
    otifef: {
      overall: ot.overall,
      onTime: ot.onTime,
      inFull: ot.inFull,
      errorFree: ot.errorFree,
      pending: ot.pending,
    },
  };
}

async function loadHostCatalogue(
  companyId: number,
  customerId?: number | null
): Promise<PortalCatalogueItem[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, sku, product_type, uom, status, is_sellable, sell_price, cost_price, base_currency, short_description, primary_image_url, metadata'
    )
    .eq('profile_id', companyId)
    .order('name');
  if (error) {
    if (!/relation|does not exist/i.test(error.message)) {
      console.warn('portal catalogue products', error.message);
    }
    return [];
  }
  const out: PortalCatalogueItem[] = [];
  for (const raw of data || []) {
    const st = String(raw.status || 'active').toLowerCase();
    if (st === 'archived' || st === 'inactive' || st === 'deleted') continue;
    if (raw.is_sellable === false) continue;
    const type = String(raw.product_type || 'finished_good').toLowerCase();
    if (type === 'wip' || type === 'work_in_progress') continue;
    const meta = asObject(raw.metadata);
    const branded =
      customerId != null && productAssignedToCustomer(meta, customerId);
    const unit =
      Number(raw.sell_price) > 0
        ? Number(raw.sell_price)
        : Number(raw.cost_price) || 0;
    out.push({
      id: Number(raw.id),
      name: String(raw.name || 'Product'),
      sku: raw.sku != null ? String(raw.sku) : null,
      product_type: type,
      uom: raw.uom != null ? String(raw.uom) : 'ea',
      unit_price: unit,
      currency: String(raw.base_currency || 'ZAR').toUpperCase(),
      short_description:
        raw.short_description != null ? String(raw.short_description) : null,
      primary_image_url:
        raw.primary_image_url != null ? String(raw.primary_image_url) : null,
      customer_brand: branded,
    });
  }
  out.sort((a, b) => {
    if (!!a.customer_brand !== !!b.customer_brand) {
      return a.customer_brand ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  const branded = out.filter((p) => p.customer_brand);
  return branded.length ? branded : out;
}

export async function loadPortalWorkspace(opts: {
  portal: TradePortalRow;
  viewer: TradePortalViewer;
}): Promise<PortalWorkspace> {
  const supabase = getSupabaseServer();
  const companyId = opts.portal.profile_id;
  const kind: TradePortalKind = opts.portal.kind;
  const empty: PortalWorkspace = {
    onBooks: false,
    linkedProfileId: null,
    bookProfile: null,
    profileGaps: bookProfileGaps(null),
    otifef: {
      overall: 0,
      onTime: 0,
      inFull: 0,
      errorFree: 0,
      totalPOs: 0,
      supplierCount: 0,
    },
    ratings: [],
    riad: [],
    messages: [],
    stock: [],
    purchase_orders: [],
    inbound_pos: [],
    projects: [],
    catalogue: [],
  };

  let linkedProfileId: number | null = null;
  let bookProfile: BookProfile | null = null;
  if (kind === 'customer' && opts.viewer.customer_id) {
    const { data } = await supabase
      .from('customers')
      .select(
        'linked_profile_id, trading_name, legal_name, contact_name, job_title, email, phone, website, vat_number, registration_number, billing_address, city, country, payment_terms, industry'
      )
      .eq('id', opts.viewer.customer_id)
      .eq('profile_id', companyId)
      .maybeSingle();
    if (data?.linked_profile_id) linkedProfileId = Number(data.linked_profile_id);
    if (data) {
      bookProfile = {
        trading_name: String(data.trading_name || ''),
        legal_name: String(data.legal_name || ''),
        contact_name: String(data.contact_name || ''),
        job_title: String(data.job_title || ''),
        email: String(data.email || ''),
        phone: String(data.phone || ''),
        website: String(data.website || ''),
        vat_number: String(data.vat_number || ''),
        registration_number: String(data.registration_number || ''),
        address: String(data.billing_address || ''),
        city: String(data.city || ''),
        country: String(data.country || ''),
        payment_terms: String(data.payment_terms || ''),
        industry: String(data.industry || ''),
      };
    }
  }
  if (kind === 'supplier' && opts.viewer.supplier_id) {
    const { data } = await supabase
      .from('srm_suppliers')
      .select(
        'linked_profile_id, trading_name, legal_name, contact_name, job_title, email, phone, website, vat_number, registration_number, address, city, country, payment_terms, industry'
      )
      .eq('id', opts.viewer.supplier_id)
      .eq('profile_id', companyId)
      .maybeSingle();
    if (data?.linked_profile_id) linkedProfileId = Number(data.linked_profile_id);
    if (data) {
      bookProfile = {
        trading_name: String(data.trading_name || ''),
        legal_name: String(data.legal_name || ''),
        contact_name: String(data.contact_name || ''),
        job_title: String(data.job_title || ''),
        email: String(data.email || ''),
        phone: String(data.phone || ''),
        website: String(data.website || ''),
        vat_number: String((data as { vat_number?: string }).vat_number || ''),
        registration_number: String(
          (data as { registration_number?: string }).registration_number || ''
        ),
        address: String(data.address || ''),
        city: String(data.city || ''),
        country: String(data.country || ''),
        payment_terms: String(
          (data as { payment_terms?: string }).payment_terms || ''
        ),
        industry: String(data.industry || ''),
      };
    }
  }

  const pos: PublicDocRow[] = [];
  const inbound: PublicDocRow[] = [];
  const stock: PortalStockLine[] = [];

  if (kind === 'supplier' && opts.viewer.supplier_id) {
    const { data: srm } = await supabase
      .from('srm_suppliers')
      .select('id, linked_profile_id')
      .eq('id', opts.viewer.supplier_id)
      .eq('profile_id', companyId)
      .maybeSingle();
    const linked = srm?.linked_profile_id != null ? Number(srm.linked_profile_id) : null;
    const { data } = await supabase
      .from('purchase_orders')
      .select(
        'id, po_number, order_number, status, created_at, promised_date, actual_delivery_date, order_quantity, delivered_quantity, damaged_quantity, total_amount, currency, supplier_id, supplier_profile_id, items, metadata'
      )
      .eq('buyer_profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(80);
    for (const raw of data || []) {
      const r = asObject(raw);
      const sid = r.supplier_id != null ? Number(r.supplier_id) : null;
      const spid = r.supplier_profile_id != null ? Number(r.supplier_profile_id) : null;
      if (sid !== opts.viewer.supplier_id && !(linked && spid === linked)) continue;
      pos.push(
        poToDoc(r, {
          promised_date: r.promised_date as string | null,
          actual_date: r.actual_delivery_date as string | null,
          ordered: r.order_quantity as number | null,
          delivered: r.delivered_quantity as number | null,
          damaged: r.damaged_quantity as number | null,
        })
      );
      const items = Array.isArray(r.items) ? r.items : [];
      for (const item of items) {
        const it = asObject(item);
        stock.push({
          product_id: it.product_id != null ? Number(it.product_id) : null,
          sku: it.sku != null ? String(it.sku) : null,
          name: String(it.name || it.sku || 'Item'),
          qty_on_hand:
            it.stock_on_hand != null ? Number(it.stock_on_hand) : null,
          po_id: Number(r.id),
        });
      }
    }
  }

  if (kind === 'customer' && opts.viewer.customer_id) {
    const { data } = await supabase
      .from('purchase_orders')
      .select(
        'id, po_number, order_number, status, created_at, promised_date, actual_delivery_date, order_quantity, delivered_quantity, damaged_quantity, total_amount, currency, seller_customer_id, buyer_profile_id, items, metadata'
      )
      .eq('supplier_profile_id', companyId)
      .eq('seller_customer_id', opts.viewer.customer_id)
      .order('created_at', { ascending: false })
      .limit(80);
    for (const raw of data || []) {
      const r = asObject(raw);
      inbound.push(
        poToDoc(r, {
          promised_date: r.promised_date as string | null,
          actual_date: r.actual_delivery_date as string | null,
          ordered: r.order_quantity as number | null,
          delivered: r.delivered_quantity as number | null,
          damaged: r.damaged_quantity as number | null,
        })
      );
    }
    const { data: orders } = await supabase
      .from('sales_orders')
      .select(
        'id, order_number, status, created_at, promised_date, shipped_date, total_amount, currency, items'
      )
      .eq('profile_id', companyId)
      .eq('customer_id', opts.viewer.customer_id)
      .order('created_at', { ascending: false })
      .limit(40);
    for (const raw of orders || []) {
      const r = asObject(raw);
      const items = Array.isArray(r.items) ? r.items : [];
      const qty = items.reduce(
        (n, it) => n + Number(asObject(it).qty || asObject(it).quantity || 0),
        0
      );
      const ot = otifefForLine({
        promised_date: r.promised_date as string | null,
        actual_date: r.shipped_date as string | null,
        ordered: qty || 1,
        delivered: r.shipped_date ? qty || 1 : 0,
        damaged: 0,
      });
      pos.push({
        id: Number(r.id),
        kind: 'order',
        number: String(r.order_number || `#${r.id}`),
        status: String(r.status || ''),
        date: r.created_at != null ? String(r.created_at).slice(0, 10) : null,
        due: r.promised_date != null ? String(r.promised_date).slice(0, 10) : null,
        amount: r.total_amount != null ? Number(r.total_amount) : null,
        paid: null,
        currency: String(r.currency || 'ZAR'),
        ordered: qty || null,
        delivered: r.shipped_date ? qty || null : null,
        otifef: {
          overall: ot.overall,
          onTime: ot.onTime,
          inFull: ot.inFull,
          errorFree: ot.errorFree,
          pending: ot.pending,
        },
      });
    }
  }

  const otLines = [...pos, ...inbound]
    .map((d) => d.otifef)
    .filter(Boolean)
    .map((o) => ({
      overall: o!.overall,
      onTime: o!.onTime,
      inFull: o!.inFull,
      errorFree: o!.errorFree,
      onTimeFlag: o!.onTime == null ? null : o!.onTime === 100,
      pending: o!.pending,
    }));
  const otifef = rollupOtifef(otLines);

  const ratings: PortalRatingView[] = [];
  if (linkedProfileId) {
    const { data: rows } = await supabase
      .from('company_ratings')
      .select('*')
      .eq('status', 'published')
      .or(
        `and(rater_profile_id.eq.${companyId},ratee_profile_id.eq.${linkedProfileId}),and(rater_profile_id.eq.${linkedProfileId},ratee_profile_id.eq.${companyId})`
      )
      .order('created_at', { ascending: false })
      .limit(40);
    for (const raw of rows || []) {
      const r = asObject(raw);
      const rater = Number(r.rater_profile_id);
      const theyRate = rater === linkedProfileId;
      ratings.push({
        id: Number(r.id),
        direction: theyRate ? 'they_rate_host' : 'host_rates_them',
        overall: Number(r.overall || 0),
        quality: r.quality != null ? Number(r.quality) : null,
        delivery: r.delivery != null ? Number(r.delivery) : null,
        communication: r.communication != null ? Number(r.communication) : null,
        value: r.value != null ? Number(r.value) : null,
        payment: r.payment != null ? Number(r.payment) : null,
        reliability: r.reliability != null ? Number(r.reliability) : null,
        comment: r.comment != null ? String(r.comment) : null,
        created_at: r.created_at != null ? String(r.created_at) : null,
        author: theyRate ? opts.viewer.name : 'Us',
      });
    }
  }
  const { data: guestRates } = await supabase
    .from('invoice_feedback')
    .select('id, rating, notes, body, created_at, metadata')
    .eq('profile_id', companyId)
    .eq('feedback_type', 'portal_rate')
    .limit(40);
  for (const raw of guestRates || []) {
    const r = asObject(raw);
    const meta = asObject(r.metadata);
    if (Number(meta.viewer_id) !== opts.viewer.id) continue;
    ratings.push({
      id: Number(r.id),
      direction: 'they_rate_host',
      overall: Number(r.rating || meta.overall || 0),
      quality: meta.quality != null ? Number(meta.quality) : null,
      delivery: meta.delivery != null ? Number(meta.delivery) : null,
      communication: meta.communication != null ? Number(meta.communication) : null,
      value: meta.value != null ? Number(meta.value) : null,
      payment: meta.payment != null ? Number(meta.payment) : null,
      reliability: meta.reliability != null ? Number(meta.reliability) : null,
      comment: r.body != null ? String(r.body) : r.notes != null ? String(r.notes) : null,
      created_at: r.created_at != null ? String(r.created_at) : null,
      author: opts.viewer.name,
    });
  }

  const riad: PortalRiadView[] = [];
  if (kind === 'customer' && opts.viewer.customer_id) {
    const { data } = await supabase
      .from('customer_riad')
      .select('id, entry_type, title, description, status, severity, notes, created_at')
      .eq('profile_id', companyId)
      .eq('customer_id', opts.viewer.customer_id)
      .order('created_at', { ascending: false })
      .limit(80);
    for (const r of data || []) {
      riad.push({
        id: Number(r.id),
        entry_type: String(r.entry_type || 'issue'),
        title: String(r.title || ''),
        description: r.description != null ? String(r.description) : null,
        status: String(r.status || 'open'),
        severity: r.severity != null ? String(r.severity) : null,
        notes: r.notes != null ? String(r.notes) : null,
        created_at: r.created_at != null ? String(r.created_at) : null,
      });
    }
  }
  if (kind === 'supplier' && opts.viewer.supplier_id) {
    const { data } = await supabase
      .from('supplier_riad')
      .select('id, entry_type, title, description, status, severity, notes, created_at')
      .eq('profile_id', companyId)
      .eq('supplier_id', opts.viewer.supplier_id)
      .order('created_at', { ascending: false })
      .limit(80);
    for (const r of data || []) {
      riad.push({
        id: Number(r.id),
        entry_type: String(r.entry_type || 'issue'),
        title: String(r.title || ''),
        description: r.description != null ? String(r.description) : null,
        status: String(r.status || 'open'),
        severity: r.severity != null ? String(r.severity) : null,
        notes: r.notes != null ? String(r.notes) : null,
        created_at: r.created_at != null ? String(r.created_at) : null,
      });
    }
  }

  const messages: PortalMessageView[] = [];
  const { data: msgs } = await supabase
    .from('trade_portal_messages')
    .select('id, author, body, created_at')
    .eq('viewer_id', opts.viewer.id)
    .eq('profile_id', companyId)
    .order('created_at', { ascending: true })
    .limit(200);
  for (const r of msgs || []) {
    messages.push({
      id: Number(r.id),
      author: r.author === 'host' ? 'host' : 'guest',
      body: String(r.body || ''),
      created_at: String(r.created_at || ''),
    });
  }

  const projects: PortalProjectView[] = [];
  let projQ = supabase
    .from('pm_projects')
    .select(
      'id, name, description, status, health, start_date, target_date, customer_id, supplier_id'
    )
    .eq('profile_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(80);
  if (kind === 'customer' && opts.viewer.customer_id) {
    projQ = projQ.eq('customer_id', opts.viewer.customer_id);
  } else if (kind === 'supplier' && opts.viewer.supplier_id) {
    projQ = projQ.eq('supplier_id', opts.viewer.supplier_id);
  } else {
    projQ = projQ.eq('id', -1);
  }
  const { data: projRows } = await projQ;
  const projIds = (projRows || []).map((p) => Number(p.id));
  const taskByProject = new Map<number, PortalProjectView['tasks']>();
  if (projIds.length) {
    const { data: trows } = await supabase
      .from('pm_tasks')
      .select('id, project_id, title, column_key, status, start_date, due_date, phase_key')
      .eq('profile_id', companyId)
      .in('project_id', projIds)
      .order('sort_order', { ascending: true });
    for (const t of trows || []) {
      const pid = Number(t.project_id);
      const list = taskByProject.get(pid) || [];
      list.push({
        id: Number(t.id),
        title: String(t.title || ''),
        column_key: String(t.column_key || t.status || 'todo'),
        start_date: t.start_date != null ? String(t.start_date).slice(0, 10) : null,
        due_date: t.due_date != null ? String(t.due_date).slice(0, 10) : null,
        phase_key: t.phase_key != null ? String(t.phase_key) : null,
      });
      taskByProject.set(pid, list);
    }
  }
  for (const p of projRows || []) {
    projects.push({
      id: Number(p.id),
      name: String(p.name || `Project #${p.id}`),
      status: String(p.status || 'planning'),
      health: p.health != null ? String(p.health) : null,
      start_date: p.start_date != null ? String(p.start_date).slice(0, 10) : null,
      target_date: p.target_date != null ? String(p.target_date).slice(0, 10) : null,
      description: p.description != null ? String(p.description) : null,
      tasks: taskByProject.get(Number(p.id)) || [],
    });
  }

  // Customer portal: branded SKUs when tagged, else host sellable catalogue
  const catalogue =
    kind === 'customer'
      ? await loadHostCatalogue(companyId, opts.viewer.customer_id)
      : [];

  return {
    onBooks: true,
    linkedProfileId,
    bookProfile,
    profileGaps: bookProfileGaps(bookProfile),
    otifef,
    ratings,
    riad,
    messages,
    stock,
    purchase_orders: pos.filter((p) => p.kind === 'purchase_order' || p.kind === 'order'),
    inbound_pos: inbound,
    projects,
    catalogue,
  };
}
