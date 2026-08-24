import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  productAssignedToCustomer,
  productVisibleOnCustomerPortal,
} from '@/lib/inventory/customer-brand';
import { isMissingRelation } from '@/lib/business/company-data';
import { productIdsOnCustomerChains } from '@/lib/orders/chain-setup';
import { otifefForLine, rollupOtifef } from '@/lib/portals/otifef-line';
import { dateEnvelope } from '@/lib/projects/waterfall';
import { enrichChainDoc } from '@/lib/orders/chain-path';
import type { OtifefMetrics } from '@/lib/suppliers/types';
import {
  parsePortalTaskRiadId,
  type PortalBatchLot,
  type PortalMessageView,
  type PortalRatingView,
  type PortalRiadView,
  type PortalProjectView,
  type PortalStockLine,
  type PublicDocRow,
  type TradePortalKind,
  type TradePortalRow,
  type TradePortalViewer,
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

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  return s.trim() ? s : null;
}

function bookStr(row: Record<string, unknown>, key: string): string {
  const direct = String(row[key] ?? '').trim();
  if (direct) return direct;
  const meta = asObject(row.metadata);
  const book = asObject(meta.book_profile);
  return String(book[key] ?? meta[key] ?? '').trim();
}

function mapPortalRiad(r: Record<string, unknown>): PortalRiadView {
  return {
    id: Number(r.id),
    entry_type: String(r.entry_type || r.riad_type || 'issue'),
    title: String(r.title || ''),
    description: strOrNull(r.description),
    status: String(r.status || 'open'),
    severity: strOrNull(r.severity) || strOrNull(r.priority) || 'medium',
    notes: strOrNull(r.notes),
    created_at: r.created_at != null ? String(r.created_at) : null,
    owner_name: strOrNull(r.owner_name),
    due_date: r.due_date != null ? String(r.due_date).slice(0, 10) : null,
    category: strOrNull(r.category),
    mitigation_plan: strOrNull(r.mitigation_plan),
    resolution: strOrNull(r.resolution),
    closed_at: r.closed_at != null ? String(r.closed_at) : null,
    created_by: strOrNull(r.created_by),
    updated_at: r.updated_at != null ? String(r.updated_at) : null,
    related_project_id:
      r.related_project_id != null && Number(r.related_project_id) > 0
        ? Number(r.related_project_id)
        : null,
    related_task_id:
      r.related_task_id != null && Number(r.related_task_id) > 0
        ? Number(r.related_task_id)
        : parsePortalTaskRiadId(strOrNull(r.notes)),
  };
}

export type BookProfile = {
  logo_url?: string;
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
  continent: string;
  country: string;
  province: string;
  city: string;
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
  /** Product sits on a saved order chain for this customer. */
  on_chain?: boolean;
};

export function isPortalFinishedGood(
  productType: string | null | undefined
): boolean {
  const t = String(productType || 'finished_good')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (
    t === 'raw_material' ||
    t === 'raw' ||
    t === 'wip' ||
    t === 'work_in_progress' ||
    t === 'packaging' ||
    t === 'component'
  ) {
    return false;
  }
  return (
    t === 'finished_good' ||
    t === 'fg' ||
    t === 'finished' ||
    t === 'finished_goods' ||
    t === ''
  );
}

/** Portal PO catalogue is order-chain SKUs only. */
export function portalPoCatalogue(
  items: PortalCatalogueItem[]
): PortalCatalogueItem[] {
  return items
    .filter((i) => i.on_chain)
    .sort((a, b) => {
      if (a.customer_brand && !b.customer_brand) return -1;
      if (!a.customer_brand && b.customer_brand) return 1;
      return a.name.localeCompare(b.name);
    });
}

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

function mapBatchLot(raw: Record<string, unknown>): PortalBatchLot | null {
  const batch_number = String(raw.batch_number || '').trim();
  if (!batch_number) return null;
  const meta = metaOf(raw);
  const expiry =
    raw.expiry_date != null
      ? String(raw.expiry_date).slice(0, 10)
      : meta.expiry_date != null
        ? String(meta.expiry_date).slice(0, 10)
        : null;
  const manufactured =
    raw.produced_at != null
      ? String(raw.produced_at).slice(0, 10)
      : meta.manufactured_date != null
        ? String(meta.manufactured_date).slice(0, 10)
        : null;
  return {
    batch_number,
    qty: raw.qty != null ? Number(raw.qty) : null,
    uom: raw.uom != null ? String(raw.uom) : null,
    manufactured_at: manufactured,
    expiry_date: expiry,
  };
}

async function loadBatchLots(
  companyId: number,
  orderIds: number[]
): Promise<Map<number, PortalBatchLot[]>> {
  const out = new Map<number, PortalBatchLot[]>();
  const ids = [...new Set(orderIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (!ids.length) return out;
  const supabase = getSupabaseServer();
  const hit = await supabase
    .from('order_batches')
    .select('order_id, batch_number, qty, uom, produced_at, expiry_date, metadata')
    .eq('company_id', companyId)
    .in('order_id', ids)
    .limit(400);
  let rows: Record<string, unknown>[] = (hit.data ||
    []) as unknown as Record<string, unknown>[];
  if (hit.error) {
    const retry = await supabase
      .from('order_batches')
      .select('order_id, batch_number, qty, uom, produced_at, metadata')
      .eq('company_id', companyId)
      .in('order_id', ids)
      .limit(400);
    rows = (retry.data || []) as unknown as Record<string, unknown>[];
  }
  for (const raw of rows) {
    const r = asObject(raw);
    const lot = mapBatchLot(r);
    const oid = Number(r.order_id);
    if (!lot || !oid) continue;
    const list = out.get(oid) || [];
    list.push(lot);
    out.set(oid, list);
  }
  return out;
}

function poToDoc(r: Record<string, unknown>, otifefInput: Parameters<typeof otifefForLine>[0]): PublicDocRow {
  const ot = otifefForLine(otifefInput);
  const meta = metaOf(r);
  const production_status =
    r.production_status != null ? String(r.production_status) : null;
  return enrichChainDoc(
    {
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
      production_status,
      completed_at:
        r.actual_completion_date != null
          ? String(r.actual_completion_date).slice(0, 10)
          : r.actual_delivery_date != null
            ? String(r.actual_delivery_date).slice(0, 10)
            : null,
      confirmed_qty:
        r.confirmed_qty != null ? Number(r.confirmed_qty) : null,
      linked: true,
      customer_po_number: meta.source_customer_po_number
        ? String(meta.source_customer_po_number)
        : meta.customer_po_number
          ? String(meta.customer_po_number)
          : null,
    },
    'supplier'
  );
}

async function loadHostCatalogue(
  companyId: number,
  customerId?: number | null
): Promise<PortalCatalogueItem[]> {
  if (customerId == null || customerId <= 0) return [];
  const supabase = getSupabaseServer();
  const setups = await supabase
    .from('order_chain_setups')
    .select('product_ids, customer_id, status')
    .eq('profile_id', companyId)
    .eq('status', 'active')
    .limit(200);
  if (setups.error) {
    if (!isMissingRelation(setups.error)) {
      console.warn('portal catalogue chains', setups.error.message);
    }
    return [];
  }
  const chainIds = productIdsOnCustomerChains(setups.data || [], customerId);
  if (!chainIds.size) return [];

  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, sku, product_type, uom, status, is_sellable, sell_price, cost_price, base_currency, short_description, primary_image_url, metadata'
    )
    .eq('profile_id', companyId)
    .in('id', [...chainIds])
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
    if (!productVisibleOnCustomerPortal(meta, customerId)) continue;
    const branded = productAssignedToCustomer(meta, customerId);
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
      on_chain: true,
    });
  }
  return portalPoCatalogue(out);
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
    const cols =
      'linked_profile_id, trading_name, legal_name, contact_name, job_title, email, phone, website, vat_number, registration_number, billing_address, continent, province, region, city, country, payment_terms, industry';
    const softCols =
      'linked_profile_id, trading_name, legal_name, contact_name, job_title, email, phone, website, vat_number, registration_number, billing_address, region, city, country, payment_terms, industry';
    let hit = await supabase
      .from('customers')
      .select(`${cols}, logo_url`)
      .eq('id', opts.viewer.customer_id)
      .eq('profile_id', companyId)
      .maybeSingle();
    if (hit.error) {
      hit = await supabase
        .from('customers')
        .select(cols)
        .eq('id', opts.viewer.customer_id)
        .eq('profile_id', companyId)
        .maybeSingle();
    }
    if (hit.error) {
      hit = await supabase
        .from('customers')
        .select(`${softCols}, logo_url`)
        .eq('id', opts.viewer.customer_id)
        .eq('profile_id', companyId)
        .maybeSingle();
    }
    if (hit.error) {
      hit = await supabase
        .from('customers')
        .select(softCols)
        .eq('id', opts.viewer.customer_id)
        .eq('profile_id', companyId)
        .maybeSingle();
    }
    const data = hit.data;
    if (data?.linked_profile_id) linkedProfileId = Number(data.linked_profile_id);
    if (data) {
      bookProfile = {
        logo_url: String((data as { logo_url?: string | null }).logo_url || ''),
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
        continent: String(
          (data as { continent?: string | null }).continent || ''
        ),
        country: String(data.country || ''),
        province: String(
          (data as { province?: string | null }).province ||
            (data as { region?: string | null }).region ||
            ''
        ),
        city: String(data.city || ''),
        payment_terms: String(data.payment_terms || ''),
        industry: String(data.industry || ''),
      };
    }
  }
  if (kind === 'supplier' && opts.viewer.supplier_id) {
    const cols =
      'linked_profile_id, trading_name, legal_name, contact_name, job_title, email, phone, website, vat_number, registration_number, address, continent, province, region, city, country, payment_terms, industry, metadata';
    const softCols =
      'linked_profile_id, trading_name, legal_name, contact_name, job_title, email, phone, website, address, city, country, industry, metadata';
    let hit = await supabase
      .from('srm_suppliers')
      .select(`${cols}, logo_url`)
      .eq('id', opts.viewer.supplier_id)
      .eq('profile_id', companyId)
      .maybeSingle();
    if (hit.error) {
      hit = await supabase
        .from('srm_suppliers')
        .select(cols)
        .eq('id', opts.viewer.supplier_id)
        .eq('profile_id', companyId)
        .maybeSingle();
    }
    if (hit.error) {
      hit = await supabase
        .from('srm_suppliers')
        .select(`${softCols}, logo_url`)
        .eq('id', opts.viewer.supplier_id)
        .eq('profile_id', companyId)
        .maybeSingle();
    }
    if (hit.error) {
      hit = await supabase
        .from('srm_suppliers')
        .select(softCols)
        .eq('id', opts.viewer.supplier_id)
        .eq('profile_id', companyId)
        .maybeSingle();
    }
    const data = hit.data as Record<string, unknown> | null;
    if (data?.linked_profile_id) linkedProfileId = Number(data.linked_profile_id);
    if (data) {
      bookProfile = {
        logo_url: String(data.logo_url || ''),
        trading_name: bookStr(data, 'trading_name'),
        legal_name: bookStr(data, 'legal_name'),
        contact_name: bookStr(data, 'contact_name'),
        job_title: bookStr(data, 'job_title'),
        email: bookStr(data, 'email'),
        phone: bookStr(data, 'phone'),
        website: bookStr(data, 'website'),
        vat_number: bookStr(data, 'vat_number'),
        registration_number: bookStr(data, 'registration_number'),
        address: bookStr(data, 'address'),
        continent: bookStr(data, 'continent'),
        country: bookStr(data, 'country'),
        province: bookStr(data, 'province') || bookStr(data, 'region'),
        city: bookStr(data, 'city'),
        payment_terms: bookStr(data, 'payment_terms'),
        industry: bookStr(data, 'industry'),
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
    const poHit = await supabase
      .from('purchase_orders')
      .select(
        'id, po_number, order_number, status, created_at, promised_date, actual_delivery_date, actual_completion_date, order_quantity, delivered_quantity, damaged_quantity, total_amount, currency, supplier_id, supplier_profile_id, items, metadata, production_status, confirmed_qty'
      )
      .eq('buyer_profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(80);
    let poRows: Record<string, unknown>[] = (poHit.data ||
      []) as unknown as Record<string, unknown>[];
    if (poHit.error) {
      const retry = await supabase
        .from('purchase_orders')
        .select(
          'id, po_number, order_number, status, created_at, promised_date, actual_delivery_date, order_quantity, delivered_quantity, damaged_quantity, total_amount, currency, supplier_id, supplier_profile_id, items, metadata'
        )
        .eq('buyer_profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(80);
      poRows = (retry.data || []) as unknown as Record<string, unknown>[];
    }
    for (const raw of poRows) {
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
    const batchMap = await loadBatchLots(
      companyId,
      pos.map((p) => p.id)
    );
    for (const p of pos) {
      p.batches = batchMap.get(p.id) || [];
    }
  }

  if (kind === 'customer' && opts.viewer.customer_id) {
    const { data } = await supabase
      .from('purchase_orders')
      .select(
        'id, po_number, order_number, status, created_at, promised_date, actual_delivery_date, actual_completion_date, order_quantity, delivered_quantity, damaged_quantity, total_amount, currency, seller_customer_id, buyer_profile_id, items, metadata, production_status, confirmed_qty'
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
    const ordersHit = await supabase
      .from('sales_orders')
      .select(
        'id, order_number, status, created_at, promised_date, shipped_date, total_amount, currency, items, production_status, confirmed_qty, actual_completion_date, metadata'
      )
      .eq('profile_id', companyId)
      .eq('customer_id', opts.viewer.customer_id)
      .order('created_at', { ascending: false })
      .limit(40);
    let orders: Record<string, unknown>[] = (ordersHit.data ||
      []) as unknown as Record<string, unknown>[];
    if (ordersHit.error) {
      const retry = await supabase
        .from('sales_orders')
        .select(
          'id, order_number, status, created_at, promised_date, shipped_date, total_amount, currency, items, metadata'
        )
        .eq('profile_id', companyId)
        .eq('customer_id', opts.viewer.customer_id)
        .order('created_at', { ascending: false })
        .limit(40);
      orders = (retry.data || []) as unknown as Record<string, unknown>[];
    }
    const soIds = (orders || []).map((o) => Number(o.id)).filter((id) => id > 0);
    const prodBySo = new Map<
      number,
      {
        status: string | null;
        completed: string | null;
        qty: number | null;
        linked: boolean;
        poIds: number[];
      }
    >();
    if (soIds.length) {
      const { data: links } = await supabase
        .from('order_links')
        .select('source_order_id, target_order_id')
        .eq('company_id', companyId)
        .eq('source_order_type', 'sales_order')
        .eq('target_order_type', 'purchase_order')
        .eq('status', 'active')
        .in('source_order_id', soIds);
      const poIds = (links || [])
        .map((l) => Number(l.target_order_id))
        .filter((id) => id > 0);
      const poProd = new Map<number, Record<string, unknown>>();
      if (poIds.length) {
        const { data: posRows } = await supabase
          .from('purchase_orders')
          .select('id, production_status, confirmed_qty, actual_completion_date, status')
          .in('id', poIds);
        for (const p of posRows || []) poProd.set(Number(p.id), asObject(p));
      }
      for (const l of links || []) {
        const sid = Number(l.source_order_id);
        const po = poProd.get(Number(l.target_order_id));
        if (!sid) continue;
        const prev = prodBySo.get(sid);
        const poId = Number(l.target_order_id);
        prodBySo.set(sid, {
          status: po?.production_status != null ? String(po.production_status) : prev?.status || null,
          completed:
            po?.actual_completion_date != null
              ? String(po.actual_completion_date).slice(0, 10)
              : prev?.completed || null,
          qty: po?.confirmed_qty != null ? Number(po.confirmed_qty) : prev?.qty ?? null,
          linked: true,
          poIds: [...(prev?.poIds || []), ...(Number.isFinite(poId) && poId > 0 ? [poId] : [])],
        });
      }
    }
    const batchMap = await loadBatchLots(
      companyId,
      [...prodBySo.values()].flatMap((v) => v.poIds)
    );
    for (const raw of orders || []) {
      const r = asObject(raw);
      const items = Array.isArray(r.items) ? r.items : [];
      const qty = items.reduce(
        (n, it) => n + Number(asObject(it).qty || asObject(it).quantity || 0),
        0
      );
      const linked = prodBySo.get(Number(r.id));
      const production_status =
        (r.production_status != null ? String(r.production_status) : null) ||
        linked?.status ||
        null;
      const completed_at =
        r.actual_completion_date != null
          ? String(r.actual_completion_date).slice(0, 10)
          : r.shipped_date != null
            ? String(r.shipped_date).slice(0, 10)
            : linked?.completed || null;
      const ot = otifefForLine({
        promised_date: r.promised_date as string | null,
        actual_date: completed_at,
        ordered: qty || 1,
        delivered: completed_at ? qty || 1 : 0,
        damaged: 0,
      });
      const meta = metaOf(r);
      pos.push(
        enrichChainDoc(
          {
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
            delivered: completed_at ? qty || null : null,
            otifef: {
              overall: ot.overall,
              onTime: ot.onTime,
              inFull: ot.inFull,
              errorFree: ot.errorFree,
              pending: ot.pending,
            },
            production_status,
            completed_at,
            confirmed_qty:
              r.confirmed_qty != null
                ? Number(r.confirmed_qty)
                : linked?.qty ?? null,
            linked: !!linked?.linked,
            customer_po_number: meta.customer_po_number
              ? String(meta.customer_po_number)
              : null,
            batches: (linked?.poIds || []).flatMap(
              (id) => batchMap.get(id) || []
            ),
          },
          'customer'
        )
      );
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
      .select('*')
      .eq('profile_id', companyId)
      .eq('customer_id', opts.viewer.customer_id)
      .order('created_at', { ascending: false })
      .limit(80);
    for (const r of data || []) {
      riad.push(mapPortalRiad(asObject(r)));
    }
  }
  if (kind === 'supplier' && opts.viewer.supplier_id) {
    const { data } = await supabase
      .from('supplier_riad')
      .select('*')
      .eq('profile_id', companyId)
      .eq('supplier_id', opts.viewer.supplier_id)
      .order('created_at', { ascending: false })
      .limit(80);
    for (const r of data || []) {
      riad.push(mapPortalRiad(asObject(r)));
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
    const taskSelect =
      'id, project_id, title, column_key, status, start_date, due_date, phase_key, assignee, metadata, description';
    const first = await supabase
      .from('pm_tasks')
      .select(`${taskSelect}, parent_task_id`)
      .eq('profile_id', companyId)
      .in('project_id', projIds)
      .order('sort_order', { ascending: true });
    let trows: Array<Record<string, unknown>> = (first.data || []) as Array<
      Record<string, unknown>
    >;
    if (first.error) {
      const retry = await supabase
        .from('pm_tasks')
        .select(taskSelect)
        .eq('profile_id', companyId)
        .in('project_id', projIds)
        .order('sort_order', { ascending: true });
      trows = ((retry.data || []) as Array<Record<string, unknown>>).map((r) => ({
        ...r,
        parent_task_id: null,
      }));
    }
    for (const t of trows) {
      const pid = Number(t.project_id);
      const list = taskByProject.get(pid) || [];
      const meta = metaOf(asObject(t));
      const assigneeViewer = Number(meta.assignee_viewer_id);
      const assigneeMember = Number(meta.assignee_member_id);
      const parentFromMeta = Number(meta.parent_task_id);
      const parentCol =
        t.parent_task_id != null ? Number(t.parent_task_id) : parentFromMeta;
      list.push({
        id: Number(t.id),
        title: String(t.title || ''),
        column_key: String(t.column_key || t.status || 'todo'),
        start_date: t.start_date != null ? String(t.start_date).slice(0, 10) : null,
        due_date: t.due_date != null ? String(t.due_date).slice(0, 10) : null,
        phase_key: t.phase_key != null ? String(t.phase_key) : null,
        assignee: t.assignee != null ? String(t.assignee) : null,
        assignee_viewer_id:
          Number.isFinite(assigneeViewer) && assigneeViewer > 0
            ? assigneeViewer
            : null,
        assignee_member_id:
          Number.isFinite(assigneeMember) && assigneeMember > 0
            ? assigneeMember
            : null,
        description: t.description != null ? String(t.description) : null,
        parent_task_id:
          Number.isFinite(parentCol) && parentCol > 0 ? parentCol : null,
      });
      taskByProject.set(pid, list);
    }
  }
  for (const p of projRows || []) {
    const tasks = taskByProject.get(Number(p.id)) || [];
    const env = dateEnvelope(
      tasks.map((t) => ({ start: t.start_date, end: t.due_date }))
    );
    projects.push({
      id: Number(p.id),
      name: String(p.name || `Project #${p.id}`),
      status: String(p.status || 'planning'),
      health: p.health != null ? String(p.health) : null,
      start_date:
        env?.start ||
        (p.start_date != null ? String(p.start_date).slice(0, 10) : null),
      target_date:
        env?.end ||
        (p.target_date != null ? String(p.target_date).slice(0, 10) : null),
      description: p.description != null ? String(p.description) : null,
      tasks,
    });
  }

  // Customer portal PO catalogue is order-chain SKUs for this customer only.
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
