/**
 * Inventory metrics pack for the report page and one-pager PDF.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import type {
  InventoryLocationLine,
  InventoryLotAlert,
  InventoryMovementPulse,
  InventoryReportLine,
  InventoryReportPack,
} from '@/lib/inventory/report-types';

export type { InventoryReportPack } from '@/lib/inventory/report-types';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function buildInventoryReportPack(opts: {
  profileId: number;
}): Promise<InventoryReportPack> {
  const supabase = getSupabaseServer();
  const asOf = new Date().toISOString();
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();

  let companyName = `Company #${opts.profileId}`;
  {
    const { data: profile } = await supabase
      .from('profiles')
      .select('trading_name, legal_name')
      .eq('id', opts.profileId)
      .maybeSingle();
    companyName = profile?.trading_name || profile?.legal_name || companyName;
  }

  const [
    productsRes,
    warehousesRes,
    levelsRes,
    openTransfers,
    containerInv,
    lotsRes,
    serialsRes,
    movements,
  ] = await Promise.all([
    supabase
      .from('products')
      .select(
        'id, name, sku, uom, product_type, category, status, reorder_level, cost_price, sell_price, base_currency, onchain_status'
      )
      .eq('profile_id', opts.profileId),
    supabase
      .from('warehouses')
      .select('id, name, code, owner_type, city, status')
      .eq('profile_id', opts.profileId)
      .order('name'),
    supabase
      .from('stock_levels')
      .select('id, product_id, warehouse_id, qty_on_hand, qty_reserved, reorder_level')
      .eq('profile_id', opts.profileId)
      .limit(5000),
    supabase
      .from('stock_transfer_orders')
      .select('id, status, to_warehouse_id')
      .eq('profile_id', opts.profileId)
      .in('status', ['shipped', 'in_transit', 'partially_received']),
    supabase
      .from('container_inventory')
      .select('id, qty_on_hand, reorder_level')
      .eq('profile_id', opts.profileId),
    supabase
      .from('inventory_lots')
      .select('id, lot_number, product_id, expiry_date, qty_on_hand, status')
      .eq('profile_id', opts.profileId)
      .limit(1000),
    supabase
      .from('inventory_serials')
      .select('id')
      .eq('profile_id', opts.profileId)
      .limit(1000),
    supabase
      .from('stock_movements')
      .select('movement_type, quantity, created_at')
      .eq('profile_id', opts.profileId)
      .gte('created_at', since30)
      .limit(2000),
  ]);

  const products = productsRes.data || [];
  const warehouses = warehousesRes.data || [];
  const levels = levelsRes.data || [];
  const pMap = new Map(products.map((p) => [Number(p.id), p]));
  const wMap = new Map(warehouses.map((w) => [Number(w.id), w]));

  const currency =
    products.find((p) => p.base_currency)?.base_currency || 'ZAR';

  let inTransitUnits = 0;
  let inTransitLines = 0;
  const transitByProduct: Record<number, number> = {};
  const transitByToWh: Record<number, number> = {};
  const openIds = (openTransfers.data || []).map((t) => Number(t.id));
  if (openIds.length) {
    const { data: tLines } = await supabase
      .from('stock_transfer_lines')
      .select('transfer_id, product_id, qty_shipped, qty_received, qty_requested')
      .in('transfer_id', openIds);
    const tMap = Object.fromEntries(
      (openTransfers.data || []).map((t) => [Number(t.id), t])
    );
    for (const line of tLines || []) {
      const shipped = Number(line.qty_shipped || line.qty_requested || 0);
      const received = Number(line.qty_received || 0);
      const open = Math.max(0, shipped - received);
      if (open <= 0) continue;
      inTransitUnits += open;
      inTransitLines += 1;
      const pid = Number(line.product_id);
      transitByProduct[pid] = (transitByProduct[pid] || 0) + open;
      const toWh = Number(tMap[Number(line.transfer_id)]?.to_warehouse_id);
      if (toWh) transitByToWh[toWh] = (transitByToWh[toWh] || 0) + open;
    }
  }

  type ProdAgg = InventoryReportLine;
  const prodAgg = new Map<number, ProdAgg>();
  const locAgg = new Map<
    string,
    InventoryLocationLine & { skuSet: Set<number> }
  >();

  for (const raw of levels) {
    const pid = Number(raw.product_id);
    const qty = Number(raw.qty_on_hand || 0);
    const reserved = Number(raw.qty_reserved || 0);
    const p = pMap.get(pid);
    const reorder =
      raw.reorder_level != null
        ? Number(raw.reorder_level)
        : Number(p?.reorder_level || 0);
    const isLow = qty <= reorder;
    const cost = Number(p?.cost_price || 0);
    const sell = Number(p?.sell_price || 0);
    const whId = raw.warehouse_id != null ? Number(raw.warehouse_id) : null;
    const locKey = whId != null ? String(whId) : 'unassigned';
    const w = whId != null ? wMap.get(whId) : null;

    if (!prodAgg.has(pid)) {
      prodAgg.set(pid, {
        id: pid,
        name: p?.name || `Product #${pid}`,
        sku: p?.sku || null,
        uom: p?.uom || null,
        product_type: p?.product_type || null,
        qty: 0,
        reserved: 0,
        available: 0,
        reorder_level: Number(p?.reorder_level || 0),
        is_low: false,
        cost_price: cost,
        sell_price: sell,
        value_cost: 0,
        value_sell: 0,
        locations: 0,
        in_transit: transitByProduct[pid] || 0,
      });
    }
    const pa = prodAgg.get(pid)!;
    pa.qty += qty;
    pa.reserved += reserved;
    pa.available += qty - reserved;
    pa.value_cost += qty * cost;
    pa.value_sell += qty * sell;
    pa.locations += 1;
    if (isLow) pa.is_low = true;

    if (!locAgg.has(locKey)) {
      locAgg.set(locKey, {
        warehouse_id: whId,
        name: w?.name || 'Unassigned / default',
        code: w?.code || null,
        owner_type: w?.owner_type || 'own',
        city: w?.city || null,
        units: 0,
        reserved: 0,
        available: 0,
        skus: 0,
        low_stock: 0,
        in_transit_inbound: whId ? transitByToWh[whId] || 0 : 0,
        skuSet: new Set(),
      });
    }
    const la = locAgg.get(locKey)!;
    la.units += qty;
    la.reserved += reserved;
    la.available += qty - reserved;
    if (isLow) la.low_stock += 1;
    if (pid) la.skuSet.add(pid);
  }

  for (const w of warehouses) {
    const key = String(w.id);
    if (!locAgg.has(key)) {
      locAgg.set(key, {
        warehouse_id: Number(w.id),
        name: w.name,
        code: w.code,
        owner_type: w.owner_type || 'own',
        city: w.city,
        units: 0,
        reserved: 0,
        available: 0,
        skus: 0,
        low_stock: 0,
        in_transit_inbound: transitByToWh[Number(w.id)] || 0,
        skuSet: new Set(),
      });
    }
  }

  const skuRows = [...prodAgg.values()].map((p) => {
    p.qty = round2(p.qty);
    p.reserved = round2(p.reserved);
    p.available = round2(p.available);
    p.value_cost = round2(p.value_cost);
    p.value_sell = round2(p.value_sell);
    if (p.qty <= p.reorder_level) p.is_low = true;
    return p;
  });

  const locations: InventoryLocationLine[] = [...locAgg.values()]
    .map(({ skuSet, ...rest }) => ({
      ...rest,
      units: round2(rest.units),
      reserved: round2(rest.reserved),
      available: round2(rest.available),
      skus: skuSet.size,
    }))
    .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name));

  const containerUnits = (containerInv.data || []).reduce(
    (s, r) => s + Number(r.qty_on_hand || 0),
    0
  );

  const unitsOnHand = round2(skuRows.reduce((s, p) => s + p.qty, 0));
  const unitsReserved = round2(skuRows.reduce((s, p) => s + p.reserved, 0));
  const valueAtCost = round2(skuRows.reduce((s, p) => s + p.value_cost, 0));
  const valueAtSell = round2(skuRows.reduce((s, p) => s + p.value_sell, 0));

  const typeKeys = [
    { key: 'raw_material', label: 'Raw materials' },
    { key: 'finished_good', label: 'Finished goods' },
    { key: 'other', label: 'Other' },
  ];
  const typeMix = typeKeys.map((t) => {
    const rows = skuRows.filter((p) =>
      t.key === 'other'
        ? p.product_type !== 'raw_material' && p.product_type !== 'finished_good'
        : p.product_type === t.key
    );
    return {
      key: t.key,
      label: t.label,
      units: round2(rows.reduce((s, p) => s + p.qty, 0)),
      value_cost: round2(rows.reduce((s, p) => s + p.value_cost, 0)),
    };
  });

  const ownerMix = [
    { key: 'own', label: 'Own sites' },
    { key: 'supplier', label: 'Supplier' },
    { key: 'customer', label: 'Customer' },
    { key: 'unassigned', label: 'Unassigned' },
  ].map((o) => ({
    key: o.key,
    label: o.label,
    units: round2(
      locations
        .filter((l) =>
          o.key === 'unassigned'
            ? l.warehouse_id == null
            : (l.owner_type || 'own') === o.key && l.warehouse_id != null
        )
        .reduce((s, l) => s + l.units, 0)
    ),
  }));

  const movements30d: InventoryMovementPulse = {
    receive: 0,
    issue: 0,
    transfer: 0,
    adjustment: 0,
    count: 0,
    other: 0,
    total: 0,
  };
  for (const m of movements.data || []) {
    const qty = Math.abs(Number(m.quantity || 0));
    const t = String(m.movement_type || '').toLowerCase();
    if (t.includes('receive') || t === 'in' || t === 'receipt') {
      movements30d.receive += qty;
    } else if (t.includes('issue') || t === 'out' || t === 'sale') {
      movements30d.issue += qty;
    } else if (t.includes('transfer')) {
      movements30d.transfer += qty;
    } else if (t.includes('count')) {
      movements30d.count += qty;
    } else if (t.includes('adjust')) {
      movements30d.adjustment += qty;
    } else {
      movements30d.other += qty;
    }
    movements30d.total += qty;
  }
  for (const k of Object.keys(movements30d) as Array<keyof InventoryMovementPulse>) {
    movements30d[k] = round2(movements30d[k]);
  }
  const issues30d = movements30d.issue;
  const coverDays =
    issues30d > 0.005 ? round2(unitsOnHand / (issues30d / 30)) : null;

  const pName = (id: number | null | undefined) =>
    id ? pMap.get(Number(id))?.name || `Product #${id}` : null;

  const expiringLots: InventoryLotAlert[] = [];
  let lotsExpiring30 = 0;
  let lotsExpired = 0;
  for (const lot of lotsRes.data || []) {
    if (!lot.expiry_date) continue;
    const days = Math.floor(
      (new Date(String(lot.expiry_date)).getTime() - Date.now()) / 86400000
    );
    if (days < 0) lotsExpired += 1;
    else if (days <= 30) lotsExpiring30 += 1;
    if (days <= 30) {
      expiringLots.push({
        id: Number(lot.id),
        lot_number: String(lot.lot_number || ''),
        product_name: pName(lot.product_id),
        expiry_date: String(lot.expiry_date).slice(0, 10),
        qty_on_hand: Number(lot.qty_on_hand || 0),
        days,
        expired: days < 0,
      });
    }
  }
  expiringLots.sort((a, b) => a.days - b.days);

  const topSkus = [...skuRows]
    .sort((a, b) => b.value_cost - a.value_cost || b.qty - a.qty)
    .slice(0, 12);
  const lowStock = skuRows
    .filter((p) => p.is_low)
    .sort((a, b) => a.qty - b.qty)
    .slice(0, 15);

  const outOfStockSkus = skuRows.filter((p) => p.qty <= 0.005).length;

  return {
    companyName,
    currency: String(currency || 'ZAR'),
    asOf,
    summary: {
      products: products.length,
      productsActive: products.filter((p) => p.status === 'active').length,
      rawMaterials: products.filter((p) => p.product_type === 'raw_material')
        .length,
      finishedGoods: products.filter((p) => p.product_type === 'finished_good')
        .length,
      warehouses: warehouses.length,
      locationsWithStock: locations.filter((l) => l.units > 0 || l.skus > 0)
        .length,
      stockLines: levels.length,
      skusWithStock: skuRows.filter((p) => p.qty > 0.005).length,
      unitsOnHand,
      unitsReserved,
      unitsAvailable: round2(unitsOnHand - unitsReserved),
      unitsInTransit: round2(inTransitUnits),
      inTransitLines,
      containerUnits: round2(containerUnits),
      networkUnits: round2(unitsOnHand + containerUnits + inTransitUnits),
      valueAtCost,
      valueAtSell,
      lowStockSkus: skuRows.filter((p) => p.is_low).length,
      outOfStockSkus,
      coverDays,
      issues30d,
      lots: (lotsRes.data || []).length,
      lotsExpiring30,
      lotsExpired,
      serials: (serialsRes.data || []).length,
      onchainReady: products.filter((p) =>
        ['hashed', 'anchored', 'minted'].includes(String(p.onchain_status || ''))
      ).length,
      openTransfers: (openTransfers.data || []).length,
    },
    typeMix,
    ownerMix,
    locations: locations.slice(0, 20),
    topSkus,
    lowStock,
    expiringLots: expiringLots.slice(0, 12),
    movements30d,
  };
}

export function inventoryReportFilename(pack: InventoryReportPack): string {
  const slug = pack.companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const day = pack.asOf.slice(0, 10);
  return `inventory-report-${slug || 'company'}-${day}.pdf`;
}
