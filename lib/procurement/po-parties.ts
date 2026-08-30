/**
 * Load buyer/supplier blocks for PO PDF + email.
 * Never selects profiles.phone (that column is not on live profiles).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  formatPurchaseOrderNumber,
  srmIdFromPo,
} from '@/lib/procurement/po-email';
import type {
  PoPdfInput,
  PoPdfLot,
  PoPdfParty,
} from '@/lib/procurement/po-document-pdf';
import { normalizePoItems } from '@/lib/procurement/types';
import { batchLineIndex } from '@/lib/portals/supplier-portal-party';

export const SAFE_PROFILE_COLUMNS =
  'trading_name, legal_name, email, contact_email, contact_phone, contact_number, vat_number, registration_number, address, street, city, country, website, logo_url';

export const SRM_SUPPLIER_COLUMNS =
  'id, trading_name, legal_name, email, phone, contact_name, website, vat_number, registration_number, address, billing_address, city, country, logo_url, linked_profile_id';

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

function missingCol(message: string): string | null {
  const m =
    /column\s+(?:[\w]+\.)?(\w+)\s+does not exist/i.exec(message) ||
    /Could not find the ['"](\w+)['"] column/i.exec(message);
  return m?.[1] || null;
}

async function selectById(
  table: string,
  cols: string,
  filters: Record<string, string | number>
): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseServer();
  let list = cols
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  for (let i = 0; i < 8; i++) {
    let q = supabase.from(table).select(list.join(', '));
    for (const [k, v] of Object.entries(filters)) {
      q = q.eq(k, v);
    }
    const { data, error } = await q.maybeSingle();
    if (!error && data && typeof data === 'object' && !Array.isArray(data)) {
      return data as unknown as Record<string, unknown>;
    }
    const miss = missingCol(error?.message || '');
    if (miss && list.includes(miss)) {
      list = list.filter((c) => c !== miss);
      continue;
    }
    return null;
  }
  return null;
}

export function displayPhone(row: Record<string, unknown> | null | undefined): string | null {
  if (!row) return null;
  const a = String(row.contact_phone || '').trim();
  const b = String(row.contact_number || '').trim();
  const c = String(row.phone || '').trim();
  return a || b || c || null;
}

export function displayName(row: Record<string, unknown> | null | undefined): string {
  if (!row) return '';
  return (
    String(row.trading_name || '').trim() ||
    String(row.legal_name || '').trim() ||
    ''
  );
}

export function rowToPdfParty(
  row: Record<string, unknown> | null | undefined,
  fallbackName: string
): PoPdfParty {
  const r = row || {};
  const name = displayName(r) || fallbackName;
  const legal = String(r.legal_name || '').trim();
  const street = String(r.street || '').trim();
  const addr = String(r.address || r.billing_address || '').trim();
  return {
    name,
    legal_name: legal && legal !== name ? legal : legal || null,
    email: String(r.email || r.contact_email || '').trim() || null,
    phone: displayPhone(r),
    contact_name: String(r.contact_name || '').trim() || null,
    website: String(r.website || '').trim() || null,
    vat_number: String(r.vat_number || '').trim() || null,
    registration_number: String(r.registration_number || '').trim() || null,
    address: addr || street || null,
    city: String(r.city || '').trim() || null,
    country: String(r.country || '').trim() || null,
    logo_url: String(r.logo_url || '').trim() || null,
  };
}

export async function loadBuyerParty(companyId: number): Promise<PoPdfParty> {
  const row = await selectById('profiles', SAFE_PROFILE_COLUMNS, { id: companyId });
  return rowToPdfParty(row, 'Buyer');
}

/**
 * Resolve SRM book row: metadata.srm_supplier_id, else supplier_id if it is
 * an srm_suppliers.id for this company, else linked_profile_id match.
 */
export async function loadSrmSupplierForPo(opts: {
  companyId: number;
  po: Record<string, unknown>;
}): Promise<Record<string, unknown> | null> {
  const po = opts.po;
  const hinted = srmIdFromPo({
    supplier_id: po.supplier_id,
    metadata: po.metadata,
  });
  if (hinted) {
    const byId = await selectById('srm_suppliers', SRM_SUPPLIER_COLUMNS, {
      id: hinted,
      profile_id: opts.companyId,
    });
    if (byId) return byId;
  }
  const profileId = Number(po.supplier_profile_id || po.supplier_id || 0);
  if (profileId > 0) {
    const byLink = await selectById('srm_suppliers', SRM_SUPPLIER_COLUMNS, {
      profile_id: opts.companyId,
      linked_profile_id: profileId,
    });
    if (byLink) return byLink;
  }
  const name = String(po.supplier_name || '').trim();
  if (name) {
    const byName = await selectById('srm_suppliers', SRM_SUPPLIER_COLUMNS, {
      profile_id: opts.companyId,
      trading_name: name,
    });
    if (byName) return byName;
  }
  return null;
}

function fillBlanks(
  base: Record<string, unknown>,
  extra: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    const cur = out[k];
    const empty =
      cur == null || (typeof cur === 'string' && !String(cur).trim());
    if (empty && v != null && String(v).trim()) out[k] = v;
  }
  return out;
}

export async function loadSupplierParty(opts: {
  companyId: number;
  po: Record<string, unknown>;
}): Promise<{ srm: Record<string, unknown> | null; party: PoPdfParty }> {
  let srm = await loadSrmSupplierForPo(opts);
  const linked = Number(srm?.linked_profile_id || 0);
  if (linked > 0) {
    const prof = await selectById('profiles', SAFE_PROFILE_COLUMNS, { id: linked });
    if (prof) srm = fillBlanks(srm || {}, prof);
  }
  const fallback = String(opts.po.supplier_name || 'Supplier');
  if (!srm) {
    const profileId = Number(
      opts.po.supplier_profile_id || opts.po.supplier_id || 0
    );
    if (profileId > 0) {
      const prof = await selectById('profiles', SAFE_PROFILE_COLUMNS, {
        id: profileId,
      });
      if (prof) return { srm: null, party: rowToPdfParty(prof, fallback) };
    }
  }
  return { srm, party: rowToPdfParty(srm, fallback) };
}

export function supplierEmailFrom(opts: {
  bodyTo?: unknown;
  srm?: Record<string, unknown> | null;
  po?: Record<string, unknown>;
}): string | null {
  const meta = asMeta(opts.po?.metadata);
  const raw = [
    opts.bodyTo,
    opts.srm?.email,
    meta.supplier_email,
    opts.po?.supplier_email,
  ];
  for (const v of raw) {
    const s = String(v || '').toLowerCase().trim();
    if (s.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s;
  }
  return null;
}

/** Resolved srm_suppliers.id for AP / cost — never a raw profiles id. */
export async function srmPartyIdForAp(opts: {
  companyId: number;
  po: Record<string, unknown>;
}): Promise<number | null> {
  const srm = await loadSrmSupplierForPo(opts);
  const id = Number(srm?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function loadPoLotsForPdf(
  companyId: number,
  poId: number,
  items: Array<{ item_name?: string | null; sku?: string | null }>
): Promise<PoPdfLot[]> {
  if (!Number.isFinite(poId) || poId <= 0) return [];
  const supabase = getSupabaseServer();
  const hit = await supabase
    .from('order_batches')
    .select(
      'batch_number, qty, uom, produced_at, expiry_date, order_line_index, metadata'
    )
    .eq('company_id', companyId)
    .eq('order_id', poId)
    .limit(200);
  let rows: Record<string, unknown>[] = (hit.data ||
    []) as unknown as Record<string, unknown>[];
  if (hit.error) {
    const retry = await supabase
      .from('order_batches')
      .select('batch_number, qty, uom, produced_at, metadata')
      .eq('company_id', companyId)
      .eq('order_id', poId)
      .limit(200);
    rows = (retry.data || []) as unknown as Record<string, unknown>[];
  }
  const out: PoPdfLot[] = [];
  for (const raw of rows) {
    const batch_number = String(raw.batch_number || '').trim();
    if (!batch_number) continue;
    const meta =
      raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : {};
    const idx = batchLineIndex(raw);
    const line = items[idx];
    out.push({
      batch_number,
      qty: raw.qty != null ? Number(raw.qty) : null,
      uom: raw.uom != null ? String(raw.uom) : null,
      manufactured_at:
        String(raw.produced_at || meta.manufactured_date || '').slice(0, 10) ||
        null,
      expiry_date:
        String(raw.expiry_date || meta.expiry_date || '').slice(0, 10) || null,
      best_before: String(meta.best_before || '').slice(0, 10) || null,
      item_name: line?.item_name || line?.sku || null,
    });
  }
  return out;
}

export async function assemblePurchaseOrderPdfInput(opts: {
  companyId: number;
  po: Record<string, unknown>;
  toOverride?: unknown;
}): Promise<{
  input: PoPdfInput;
  to: string | null;
  srm: Record<string, unknown> | null;
  buyer: PoPdfParty;
  supplier: PoPdfParty;
}> {
  const { srm, party: supplierParty } = await loadSupplierParty(opts);
  const buyer = await loadBuyerParty(opts.companyId);
  const to = supplierEmailFrom({
    bodyTo: opts.toOverride,
    srm,
    po: opts.po,
  });
  const number = formatPurchaseOrderNumber({
    id: Number(opts.po.id),
    po_number:
      opts.po.po_number != null ? String(opts.po.po_number) : null,
    order_number:
      opts.po.order_number != null ? String(opts.po.order_number) : null,
  });
  const currency = String(opts.po.currency || 'ZAR').toUpperCase();
  const normalized = normalizePoItems(opts.po.items || []);
  let items = 'items' in normalized ? normalized.items : [];
  let total =
    Number(opts.po.total_amount) ||
    ('total' in normalized ? normalized.total : 0);
  try {
    const { isOpenUnreceivedPo, priceSupplierPoItems } = await import(
      '@/lib/commercial/po-price'
    );
    if (isOpenUnreceivedPo(opts.po) && items.length) {
      const priced = await priceSupplierPoItems({
        profileId: opts.companyId,
        supplierId: srmIdFromPo({
          supplier_id: opts.po.supplier_id,
          metadata: opts.po.metadata,
        }),
        items,
      });
      if (priced.ok) {
        items = priced.items;
        total = priced.total;
        const supabase = getSupabaseServer();
        const patch: Record<string, unknown> = {
          items: priced.items,
          total_amount: priced.total,
          subtotal: priced.total,
          updated_at: new Date().toISOString(),
        };
        const upd = await supabase
          .from('purchase_orders')
          .update(patch as never)
          .eq('id', Number(opts.po.id))
          .eq('buyer_profile_id', opts.companyId);
        if (upd.error && /column|schema cache/i.test(upd.error.message || '')) {
          delete patch.subtotal;
          await supabase
            .from('purchase_orders')
            .update(patch as never)
            .eq('id', Number(opts.po.id))
            .eq('buyer_profile_id', opts.companyId);
        }
      }
    }
  } catch {
    /* keep stored totals if catalogue is unavailable */
  }
  const supplier: PoPdfParty = {
    ...supplierParty,
    email: to || supplierParty.email || null,
    legal_name: supplierParty.legal_name || null,
    vat_number: supplierParty.vat_number || null,
  };
  const meta = asMeta(opts.po.metadata);
  const requested = meta.requested_promised_date
    ? String(meta.requested_promised_date).slice(0, 10)
    : null;
  const promised = opts.po.promised_date
    ? String(opts.po.promised_date).slice(0, 10)
    : null;
  const actual = opts.po.actual_delivery_date
    ? String(opts.po.actual_delivery_date).slice(0, 10)
    : null;
  const lots = await loadPoLotsForPdf(
    opts.companyId,
    Number(opts.po.id),
    items
  );
  return {
    input: {
      number,
      status: opts.po.status != null ? String(opts.po.status) : null,
      issuedAt: String(opts.po.created_at || '').slice(0, 10) || null,
      promisedDate: promised,
      requestedDate: requested && requested !== promised ? requested : null,
      actualDeliveryDate: actual,
      paymentTerms: opts.po.payment_terms
        ? String(opts.po.payment_terms)
        : null,
      currency,
      notes: opts.po.description ? String(opts.po.description) : null,
      items,
      lots,
      totalAmount: total,
      buyer,
      supplier,
    },
    to,
    srm,
    buyer,
    supplier,
  };
}
