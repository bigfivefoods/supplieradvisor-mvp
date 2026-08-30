import { getSupabaseServer } from '@/lib/supabase/server-client';
import { productFamily, roundMoney, sortRevisionsOldestLast } from './engine';
import type {
  CatalogueLineStatus,
  PartyCatalogueLine,
  PartyKind,
  PriceActor,
  PriceRevision,
} from './types';

const LINE_COLS =
  'id, profile_id, party_kind, supplier_id, customer_id, product_id, currency, uom, accepted_price, accepted_at, pending_price, pending_proposed_at, pending_proposed_by, status, metadata, created_at, updated_at';

function asRows(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r) => r && typeof r === 'object') as Record<string, unknown>[];
}

function asRow(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapLine(raw: Record<string, unknown>): PartyCatalogueLine {
  const kind = String(raw.party_kind || '') === 'customer' ? 'customer' : 'supplier';
  const pendingBy = String(raw.pending_proposed_by || '');
  return {
    id: Number(raw.id),
    profile_id: Number(raw.profile_id),
    party_kind: kind,
    supplier_id: num(raw.supplier_id),
    customer_id: num(raw.customer_id),
    product_id: Number(raw.product_id),
    currency: String(raw.currency || 'ZAR'),
    uom: raw.uom != null ? String(raw.uom) : null,
    accepted_price: roundMoney(Number(raw.accepted_price || 0)),
    accepted_at: raw.accepted_at != null ? String(raw.accepted_at) : null,
    pending_price: num(raw.pending_price),
    pending_proposed_at:
      raw.pending_proposed_at != null ? String(raw.pending_proposed_at) : null,
    pending_proposed_by:
      pendingBy === 'host' || pendingBy === 'party' ? pendingBy : null,
    status: String(raw.status || 'active') === 'paused' ? 'paused' : 'active',
  };
}

function mapRevision(raw: Record<string, unknown>): PriceRevision {
  const st = String(raw.status || 'proposed');
  const status: PriceRevision['status'] =
    st === 'accepted' || st === 'rejected' || st === 'superseded'
      ? st
      : 'proposed';
  return {
    id: Number(raw.id),
    line_id: Number(raw.line_id),
    old_price: num(raw.old_price),
    new_price: roundMoney(Number(raw.new_price || 0)),
    currency: String(raw.currency || 'ZAR'),
    proposed_by: String(raw.proposed_by) === 'party' ? 'party' : 'host',
    status,
    accepted_by: raw.accepted_by != null ? String(raw.accepted_by) : null,
    accepted_at: raw.accepted_at != null ? String(raw.accepted_at) : null,
    rejected_by: raw.rejected_by != null ? String(raw.rejected_by) : null,
    rejected_at: raw.rejected_at != null ? String(raw.rejected_at) : null,
    note: raw.note != null ? String(raw.note) : null,
    created_at: String(raw.created_at || ''),
  };
}

async function attachProducts(
  profileId: number,
  lines: PartyCatalogueLine[]
): Promise<PartyCatalogueLine[]> {
  if (!lines.length) return lines;
  const supabase = getSupabaseServer();
  const ids = [...new Set(lines.map((l) => l.product_id).filter((n) => n > 0))];
  const hit = await supabase
    .from('products')
    .select(
      'id, name, sku, product_type, uom, primary_image_url, short_description, long_description, lead_time_days, moq, specs_sheet_url, cost_price'
    )
    .eq('profile_id', profileId)
    .in('id', ids);
  const byId = new Map<number, Record<string, unknown>>();
  for (const row of asRows(hit.data)) {
    byId.set(Number(row.id), row);
  }
  return lines.map((line) => {
    const p = byId.get(line.product_id);
    const name = p?.name != null ? String(p.name) : line.product_name;
    const type = p?.product_type != null ? String(p.product_type) : line.product_type;
    const sku = p?.sku != null ? String(p.sku) : line.sku;
    return {
      ...line,
      product_name: name || `Product ${line.product_id}`,
      product_type: type || null,
      sku: sku || null,
      uom: line.uom || (p?.uom != null ? String(p.uom) : null),
      family: productFamily({ name, product_type: type, sku }),
      primary_image_url:
        p?.primary_image_url != null ? String(p.primary_image_url) : null,
      short_description:
        p?.short_description != null ? String(p.short_description) : null,
      long_description:
        p?.long_description != null ? String(p.long_description) : null,
      lead_time_days: num(p?.lead_time_days),
      moq: num(p?.moq ?? p?.min_order_qty),
      specs_sheet_url:
        p?.specs_sheet_url != null ? String(p.specs_sheet_url) : null,
    };
  });
}

async function attachSiteQty(
  profileId: number,
  partyKind: PartyKind,
  partyId: number,
  lines: PartyCatalogueLine[]
): Promise<PartyCatalogueLine[]> {
  if (!lines.length) return lines;
  const supabase = getSupabaseServer();
  const productIds = lines.map((l) => l.product_id);
  let warehouseIds: number[] = [];
  if (partyKind === 'supplier') {
    const { resolveSupplierDcs } = await import('@/lib/portals/supplier-dc-stock');
    const dcs = await resolveSupplierDcs({
      companyId: profileId,
      supplierId: partyId,
    });
    warehouseIds = dcs.map((d) => d.id);
  } else {
    const wh = await supabase
      .from('warehouses')
      .select('id, warehouse_type, owner_type, metadata')
      .eq('profile_id', profileId)
      .limit(200);
    warehouseIds = asRows(wh.data)
      .filter((w) => {
        const type = String(w.warehouse_type || '').toLowerCase();
        const owner = String(w.owner_type || '').toLowerCase();
        const meta =
          w.metadata && typeof w.metadata === 'object'
            ? (w.metadata as Record<string, unknown>)
            : {};
        return (
          (type === 'customer_site' || owner === 'customer') &&
          Number(meta.customer_id) === partyId
        );
      })
      .map((w) => Number(w.id))
      .filter((n) => n > 0);
  }
  if (!warehouseIds.length) return lines;
  const levels = await supabase
    .from('stock_levels')
    .select('product_id, qty_on_hand')
    .eq('profile_id', profileId)
    .in('warehouse_id', warehouseIds)
    .in('product_id', productIds);
  const qty = new Map<number, number>();
  for (const row of asRows(levels.data)) {
    const pid = Number(row.product_id);
    qty.set(pid, (qty.get(pid) || 0) + Number(row.qty_on_hand || 0));
  }
  return lines.map((l) => ({
    ...l,
    qty_on_hand: qty.has(l.product_id) ? qty.get(l.product_id)! : l.qty_on_hand ?? 0,
  }));
}

export async function loadPartyLines(opts: {
  profileId: number;
  partyKind: PartyKind;
  supplierId?: number | null;
  customerId?: number | null;
  withQty?: boolean;
}): Promise<PartyCatalogueLine[]> {
  const supabase = getSupabaseServer();
  let q = supabase
    .from('party_catalogue_lines')
    .select(LINE_COLS)
    .eq('profile_id', opts.profileId)
    .eq('party_kind', opts.partyKind)
    .order('id');
  if (opts.partyKind === 'supplier' && opts.supplierId) {
    q = q.eq('supplier_id', opts.supplierId);
  }
  if (opts.partyKind === 'customer' && opts.customerId) {
    q = q.eq('customer_id', opts.customerId);
  }
  const hit = await q;
  if (hit.error) {
    if (!/relation|does not exist/i.test(hit.error.message || '')) {
      console.warn('party_catalogue_lines', hit.error.message);
    }
    return [];
  }
  let lines = asRows(hit.data).map(mapLine);
  lines = await attachProducts(opts.profileId, lines);
  if (opts.withQty) {
    const partyId =
      opts.partyKind === 'supplier'
        ? Number(opts.supplierId)
        : Number(opts.customerId);
    if (Number.isFinite(partyId) && partyId > 0) {
      lines = await attachSiteQty(opts.profileId, opts.partyKind, partyId, lines);
    }
  }
  return lines;
}

export async function loadRevisions(lineId: number): Promise<PriceRevision[]> {
  const supabase = getSupabaseServer();
  const hit = await supabase
    .from('party_price_revisions')
    .select(
      'id, line_id, old_price, new_price, currency, proposed_by, status, accepted_by, accepted_at, rejected_by, rejected_at, note, created_at'
    )
    .eq('line_id', lineId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(200);
  if (hit.error) return [];
  return sortRevisionsOldestLast(asRows(hit.data).map(mapRevision));
}

export async function lookupAcceptedMap(opts: {
  profileId: number;
  partyKind: PartyKind;
  supplierId?: number | null;
  customerId?: number | null;
}): Promise<Record<number, number>> {
  const lines = await loadPartyLines({ ...opts, withQty: false });
  const out: Record<number, number> = {};
  for (const line of lines) {
    if (line.status !== 'active') continue;
    out[line.product_id] = line.accepted_price;
  }
  return out;
}

async function loadLineById(
  profileId: number,
  lineId: number
): Promise<PartyCatalogueLine | null> {
  const supabase = getSupabaseServer();
  const hit = await supabase
    .from('party_catalogue_lines')
    .select(LINE_COLS)
    .eq('id', lineId)
    .eq('profile_id', profileId)
    .maybeSingle();
  const row = asRow(hit.data);
  return row ? mapLine(row) : null;
}

async function supersedeOpenProposals(lineId: number): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase
    .from('party_price_revisions')
    .update({ status: 'superseded' })
    .eq('line_id', lineId)
    .eq('status', 'proposed');
}

export async function proposePrice(opts: {
  profileId: number;
  lineId: number;
  newPrice: number;
  actor: PriceActor;
  note?: string | null;
}): Promise<
  | { ok: true; line: PartyCatalogueLine }
  | { ok: false; error: string; status: number }
> {
  const line = await loadLineById(opts.profileId, opts.lineId);
  if (!line) return { ok: false, error: 'Catalogue line not found', status: 404 };
  const price = roundMoney(opts.newPrice);
  if (!(price >= 0)) return { ok: false, error: 'Price must be zero or more', status: 400 };
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  await supersedeOpenProposals(line.id);
  const ins = await supabase.from('party_price_revisions').insert({
    line_id: line.id,
    old_price: line.accepted_price,
    new_price: price,
    currency: line.currency,
    proposed_by: opts.actor,
    status: 'proposed',
    note: opts.note ? String(opts.note).slice(0, 500) : null,
  });
  if (ins.error) {
    return { ok: false, error: ins.error.message, status: 500 };
  }
  const upd = await supabase
    .from('party_catalogue_lines')
    .update({
      pending_price: price,
      pending_proposed_at: now,
      pending_proposed_by: opts.actor,
      updated_at: now,
    })
    .eq('id', line.id)
    .eq('profile_id', opts.profileId);
  if (upd.error) return { ok: false, error: upd.error.message, status: 500 };
  const next = await loadLineById(opts.profileId, line.id);
  return { ok: true, line: next || line };
}

async function syncAcceptedToMaster(line: PartyCatalogueLine): Promise<void> {
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  if (line.party_kind === 'supplier') {
    const prod = await supabase
      .from('products')
      .select('id, prices, base_currency, sell_price, cost_price')
      .eq('id', line.product_id)
      .eq('profile_id', line.profile_id)
      .maybeSingle();
    const row = asRow(prod.data);
    if (!row) return;
    const prices = Array.isArray(row.prices) ? [...(row.prices as unknown[])] : [];
    const ccy = String(line.currency || row.base_currency || 'ZAR').toUpperCase();
    let found = false;
    const nextPrices = prices.map((raw) => {
      const p =
        raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
      if (String(p.currency || '').toUpperCase() !== ccy) return p;
      found = true;
      return { ...p, cost_price: line.accepted_price };
    });
    if (!found) {
      nextPrices.unshift({
        currency: ccy,
        cost_price: line.accepted_price,
        sell_price: Number(row.sell_price || 0),
      });
    }
    await supabase
      .from('products')
      .update({
        cost_price: line.accepted_price,
        prices: nextPrices,
        updated_at: now,
      })
      .eq('id', line.product_id)
      .eq('profile_id', line.profile_id);
    return;
  }

  const cust = await supabase
    .from('customers')
    .select('id, linked_profile_id')
    .eq('id', line.customer_id)
    .eq('profile_id', line.profile_id)
    .maybeSingle();
  const buyer = num(asRow(cust.data)?.linked_profile_id);
  if (!buyer) return;
  const agr = await supabase
    .from('pricing_agreements')
    .select('id')
    .eq('seller_profile_id', line.profile_id)
    .eq('buyer_profile_id', buyer)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(8);
  const agreementIds = asRows(agr.data)
    .map((r) => Number(r.id))
    .filter((n) => n > 0);
  if (!agreementIds.length) return;
  await supabase
    .from('pricing_agreement_lines')
    .update({ list_price: line.accepted_price, updated_at: now })
    .in('agreement_id', agreementIds)
    .eq('seller_product_id', line.product_id);
}

export async function acceptPrice(opts: {
  profileId: number;
  lineId: number;
  actor: PriceActor;
  actorLabel?: string | null;
}): Promise<
  | { ok: true; line: PartyCatalogueLine }
  | { ok: false; error: string; status: number }
> {
  const line = await loadLineById(opts.profileId, opts.lineId);
  if (!line) return { ok: false, error: 'Catalogue line not found', status: 404 };
  if (line.pending_price == null || !line.pending_proposed_by) {
    return { ok: false, error: 'Nothing pending to accept', status: 400 };
  }
  if (opts.actor === line.pending_proposed_by) {
    return {
      ok: false,
      error: 'The other side must Accept this price',
      status: 403,
    };
  }
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const accepted = roundMoney(Number(line.pending_price));
  const open = await supabase
    .from('party_price_revisions')
    .select('id')
    .eq('line_id', line.id)
    .eq('status', 'proposed')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  const revId = num(asRow(open.data)?.id);
  if (revId) {
    await supabase
      .from('party_price_revisions')
      .update({
        status: 'accepted',
        accepted_by: opts.actorLabel || opts.actor,
        accepted_at: now,
      })
      .eq('id', revId);
  }
  const upd = await supabase
    .from('party_catalogue_lines')
    .update({
      accepted_price: accepted,
      accepted_at: now,
      pending_price: null,
      pending_proposed_at: null,
      pending_proposed_by: null,
      updated_at: now,
    })
    .eq('id', line.id)
    .eq('profile_id', opts.profileId);
  if (upd.error) return { ok: false, error: upd.error.message, status: 500 };
  const next = (await loadLineById(opts.profileId, line.id)) || {
    ...line,
    accepted_price: accepted,
    pending_price: null,
    pending_proposed_by: null,
  };
  await syncAcceptedToMaster(next);
  return { ok: true, line: next };
}

export async function rejectPrice(opts: {
  profileId: number;
  lineId: number;
  actor: PriceActor;
  actorLabel?: string | null;
  note?: string | null;
}): Promise<
  | { ok: true; line: PartyCatalogueLine }
  | { ok: false; error: string; status: number }
> {
  const line = await loadLineById(opts.profileId, opts.lineId);
  if (!line) return { ok: false, error: 'Catalogue line not found', status: 404 };
  if (line.pending_price == null || !line.pending_proposed_by) {
    return { ok: false, error: 'Nothing pending to reject', status: 400 };
  }
  if (opts.actor === line.pending_proposed_by) {
    return {
      ok: false,
      error: 'The other side must Reject this price',
      status: 403,
    };
  }
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const open = await supabase
    .from('party_price_revisions')
    .select('id')
    .eq('line_id', line.id)
    .eq('status', 'proposed')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  const revId = num(asRow(open.data)?.id);
  if (revId) {
    await supabase
      .from('party_price_revisions')
      .update({
        status: 'rejected',
        rejected_by: opts.actorLabel || opts.actor,
        rejected_at: now,
        note: opts.note ? String(opts.note).slice(0, 500) : null,
      })
      .eq('id', revId);
  }
  const upd = await supabase
    .from('party_catalogue_lines')
    .update({
      pending_price: null,
      pending_proposed_at: null,
      pending_proposed_by: null,
      updated_at: now,
    })
    .eq('id', line.id)
    .eq('profile_id', opts.profileId);
  if (upd.error) return { ok: false, error: upd.error.message, status: 500 };
  const next = await loadLineById(opts.profileId, line.id);
  return { ok: true, line: next || { ...line, pending_price: null } };
}

export async function addFromInventory(opts: {
  profileId: number;
  partyKind: PartyKind;
  supplierId?: number | null;
  customerId?: number | null;
  productIds: number[];
  actor: PriceActor;
}): Promise<
  | { ok: true; lines: PartyCatalogueLine[] }
  | { ok: false; error: string; status: number }
> {
  const ids = [...new Set(opts.productIds.map(Number).filter((n) => n > 0))];
  if (!ids.length) return { ok: false, error: 'Pick at least one product', status: 400 };
  if (opts.partyKind === 'supplier' && !(Number(opts.supplierId) > 0)) {
    return { ok: false, error: 'supplier_id required', status: 400 };
  }
  if (opts.partyKind === 'customer' && !(Number(opts.customerId) > 0)) {
    return { ok: false, error: 'customer_id required', status: 400 };
  }
  const supabase = getSupabaseServer();
  const products = await supabase
    .from('products')
    .select('id, name, uom, cost_price, sell_price, base_currency')
    .eq('profile_id', opts.profileId)
    .in('id', ids);
  const rows = asRows(products.data);
  if (!rows.length) return { ok: false, error: 'No matching products', status: 404 };
  const now = new Date().toISOString();
  const existing = await loadPartyLines({
    profileId: opts.profileId,
    partyKind: opts.partyKind,
    supplierId: opts.supplierId,
    customerId: opts.customerId,
  });
  const have = new Set(existing.map((l) => l.product_id));
  for (const p of rows) {
    const productId = Number(p.id);
    if (have.has(productId)) continue;
    const price =
      opts.partyKind === 'supplier'
        ? roundMoney(Number(p.cost_price || 0))
        : roundMoney(Number(p.sell_price || 0));
    const ins = await supabase
      .from('party_catalogue_lines')
      .insert({
        profile_id: opts.profileId,
        party_kind: opts.partyKind,
        supplier_id: opts.partyKind === 'supplier' ? opts.supplierId : null,
        customer_id: opts.partyKind === 'customer' ? opts.customerId : null,
        product_id: productId,
        currency: String(p.base_currency || 'ZAR'),
        uom: p.uom != null ? String(p.uom) : 'unit',
        accepted_price: price,
        accepted_at: now,
        status: 'active' as CatalogueLineStatus,
        updated_at: now,
      })
      .select('id')
      .maybeSingle();
    const lineId = num(asRow(ins.data)?.id);
    if (lineId) {
      await supabase.from('party_price_revisions').insert({
        line_id: lineId,
        old_price: null,
        new_price: price,
        currency: String(p.base_currency || 'ZAR'),
        proposed_by: opts.actor,
        status: 'accepted',
        accepted_by: opts.actor,
        accepted_at: now,
      });
    }
  }
  const lines = await loadPartyLines({
    profileId: opts.profileId,
    partyKind: opts.partyKind,
    supplierId: opts.supplierId,
    customerId: opts.customerId,
    withQty: true,
  });
  return { ok: true, lines };
}

/** Network Pricing save → catalogue. New lines seed accepted; price changes propose. */
export async function syncAgreementIntoCatalogue(opts: {
  profileId: number;
  buyerProfileId: number;
  lines: Array<{ seller_product_id?: number | null; list_price?: number | null; uom?: string | null; currency?: string | null }>;
}): Promise<void> {
  const supabase = getSupabaseServer();
  const cust = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', opts.profileId)
    .eq('linked_profile_id', opts.buyerProfileId)
    .maybeSingle();
  const customerId = num(asRow(cust.data)?.id);
  if (!customerId) return;
  const existing = await loadPartyLines({
    profileId: opts.profileId,
    partyKind: 'customer',
    customerId,
  });
  const byProduct = new Map(existing.map((l) => [l.product_id, l]));
  for (const raw of opts.lines) {
    const productId = Number(raw.seller_product_id);
    if (!Number.isFinite(productId) || productId <= 0) continue;
    const list = roundMoney(Number(raw.list_price || 0));
    const hit = byProduct.get(productId);
    if (!hit) {
      await addFromInventory({
        profileId: opts.profileId,
        partyKind: 'customer',
        customerId,
        productIds: [productId],
        actor: 'host',
      });
      const created = (await loadPartyLines({
        profileId: opts.profileId,
        partyKind: 'customer',
        customerId,
      })).find((l) => l.product_id === productId);
      if (created && created.accepted_price !== list) {
        await supabase
          .from('party_catalogue_lines')
          .update({ accepted_price: list, accepted_at: new Date().toISOString() })
          .eq('id', created.id);
      }
      continue;
    }
    if (roundMoney(hit.accepted_price) === list) continue;
    await proposePrice({
      profileId: opts.profileId,
      lineId: hit.id,
      newPrice: list,
      actor: 'host',
      note: 'Network Pricing',
    });
  }
}

export async function proposeFromProductMaster(opts: {
  profileId: number;
  productId: number;
  costPrice?: number | null;
  sellPrice?: number | null;
}): Promise<{ heldCost: boolean; customerProposals: number }> {
  let heldCost = false;
  let customerProposals = 0;
  if (opts.costPrice != null && Number.isFinite(Number(opts.costPrice))) {
    const suppliers = await loadPartyLines({
      profileId: opts.profileId,
      partyKind: 'supplier',
    });
    const hits = suppliers.filter((l) => l.product_id === opts.productId && l.status === 'active');
    if (hits.length) {
      heldCost = true;
      const next = roundMoney(Number(opts.costPrice));
      for (const line of hits) {
        if (roundMoney(line.accepted_price) === next) continue;
        await proposePrice({
          profileId: opts.profileId,
          lineId: line.id,
          newPrice: next,
          actor: 'host',
          note: 'Inventory cost',
        });
      }
    }
  }
  if (opts.sellPrice != null && Number.isFinite(Number(opts.sellPrice))) {
    const customers = await loadPartyLines({
      profileId: opts.profileId,
      partyKind: 'customer',
    });
    const hits = customers.filter((l) => l.product_id === opts.productId && l.status === 'active');
    const next = roundMoney(Number(opts.sellPrice));
    for (const line of hits) {
      if (roundMoney(line.accepted_price) === next) continue;
      const r = await proposePrice({
        profileId: opts.profileId,
        lineId: line.id,
        newPrice: next,
        actor: 'host',
        note: 'Inventory list price',
      });
      if (r.ok) customerProposals += 1;
    }
  }
  return { heldCost, customerProposals };
}

export async function saveSlaFields(opts: {
  profileId: number;
  productId: number;
  short_description?: string | null;
  long_description?: string | null;
  lead_time_days?: number | null;
  moq?: number | null;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const supabase = getSupabaseServer();
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (opts.short_description !== undefined) {
    updates.short_description = opts.short_description;
  }
  if (opts.long_description !== undefined) {
    updates.long_description = opts.long_description;
  }
  if (opts.lead_time_days !== undefined) {
    updates.lead_time_days = opts.lead_time_days;
  }
  if (opts.moq !== undefined) updates.moq = opts.moq;
  let { error } = await supabase
    .from('products')
    .update(updates as never)
    .eq('id', opts.productId)
    .eq('profile_id', opts.profileId);
  if (error && /column|does not exist/i.test(error.message || '')) {
    const soft = { ...updates };
    delete soft.long_description;
    delete soft.lead_time_days;
    delete soft.moq;
    const retry = await supabase
      .from('products')
      .update(soft as never)
      .eq('id', opts.productId)
      .eq('profile_id', opts.profileId);
    error = retry.error;
  }
  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true };
}

export function lineBelongsToViewer(
  line: PartyCatalogueLine,
  opts: { kind: PartyKind; supplierId?: number | null; customerId?: number | null }
): boolean {
  if (line.party_kind !== opts.kind) return false;
  if (opts.kind === 'supplier') return Number(line.supplier_id) === Number(opts.supplierId);
  return Number(line.customer_id) === Number(opts.customerId);
}
