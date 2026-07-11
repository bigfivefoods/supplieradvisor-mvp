import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { hashMovement } from '@/lib/inventory/hash';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/** GET live stock — levels + totals + by location + by product */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const warehouseIdFilter = request.nextUrl.searchParams.get('warehouseId');
    const productIdFilter = request.nextUrl.searchParams.get('productId');
    const productType = request.nextUrl.searchParams.get('productType');
    const q = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
    const includeZero = request.nextUrl.searchParams.get('includeZero') === '1';

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const supabase = getSupabaseServer();
    const asOf = new Date().toISOString();

    // All company warehouses (for empty-location cards + labels)
    const { data: allWarehouses } = await supabase
      .from('warehouses')
      .select('id, name, code, owner_type, partner_name, city, warehouse_type, status, is_default')
      .eq('profile_id', companyId)
      .order('name');

    let levelsQuery = supabase
      .from('stock_levels')
      .select('*')
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false });

    if (warehouseIdFilter === 'none') {
      levelsQuery = levelsQuery.is('warehouse_id', null);
    } else if (warehouseIdFilter && warehouseIdFilter !== 'all') {
      levelsQuery = levelsQuery.eq('warehouse_id', Number(warehouseIdFilter));
    }
    if (productIdFilter) {
      levelsQuery = levelsQuery.eq('product_id', Number(productIdFilter));
    }

    const { data, error } = await levelsQuery;

    if (error) {
      return NextResponse.json({
        success: true,
        levels: [],
        byLocation: [],
        byProduct: [],
        summary: emptySummary(asOf),
        warehouses: allWarehouses || [],
        warning: error.message,
      });
    }

    let levelsRaw = data || [];
    if (!includeZero) {
      levelsRaw = levelsRaw.filter((l) => Number(l.qty_on_hand || 0) !== 0);
    }

    const productIds = [...new Set(levelsRaw.map((d) => d.product_id).filter(Boolean))];
    // Also load all products for complete catalogue view when includeZero/all requested
    const [{ data: products }, { data: allProducts }] = await Promise.all([
      productIds.length
        ? supabase
            .from('products')
            .select(
              'id, name, sku, uom, public_id, product_type, category, status, reorder_level, cost_price, sell_price, base_currency, primary_image_url'
            )
            .in('id', productIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      supabase
        .from('products')
        .select('id, name, sku, uom, product_type, category, status, reorder_level')
        .eq('profile_id', companyId)
        .eq('status', 'active'),
    ]);

    const whList = allWarehouses || [];
    const pMap = Object.fromEntries((products || []).map((p) => [p.id, p]));
    const wMap = Object.fromEntries(whList.map((w) => [w.id, w]));

    let levels = levelsRaw.map((l) => {
      const product = pMap[l.product_id] || null;
      const warehouse = l.warehouse_id ? wMap[l.warehouse_id] || null : null;
      const qty = Number(l.qty_on_hand || 0);
      const reserved = Number(l.qty_reserved || 0);
      const reorder =
        l.reorder_level != null
          ? Number(l.reorder_level)
          : Number((product as { reorder_level?: number } | null)?.reorder_level || 0);
      return {
        ...l,
        qty_on_hand: qty,
        qty_reserved: reserved,
        qty_available: qty - reserved,
        reorder_level: reorder,
        is_low: qty <= reorder,
        product,
        warehouse,
        location_key: l.warehouse_id != null ? String(l.warehouse_id) : 'unassigned',
        location_name: warehouse
          ? (warehouse as { name: string }).name
          : 'Unassigned / default',
      };
    });

    // Filters that need joined product data
    if (productType && productType !== 'all') {
      levels = levels.filter(
        (l) => (l.product as { product_type?: string } | null)?.product_type === productType
      );
    }
    if (q) {
      levels = levels.filter((l) => {
        const p = l.product as { name?: string; sku?: string; category?: string } | null;
        const w = l.warehouse as { name?: string; partner_name?: string; code?: string } | null;
        const hay = [
          p?.name,
          p?.sku,
          p?.category,
          w?.name,
          w?.partner_name,
          w?.code,
          l.lot_number,
          l.bin_location,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    // In-transit from open transfer orders
    let inTransitUnits = 0;
    let inTransitLines = 0;
    const { data: openTransfers } = await supabase
      .from('stock_transfer_orders')
      .select('id, status, transfer_number, from_warehouse_id, to_warehouse_id, from_warehouse_name, to_warehouse_name')
      .eq('profile_id', companyId)
      .in('status', ['shipped', 'in_transit', 'partially_received']);

    const openIds = (openTransfers || []).map((t) => t.id);
    let transitByProduct: Record<number, number> = {};
    let transitByToWh: Record<number, number> = {};
    if (openIds.length) {
      const { data: tLines } = await supabase
        .from('stock_transfer_lines')
        .select('transfer_id, product_id, qty_shipped, qty_received, qty_requested')
        .in('transfer_id', openIds);
      const tMap = Object.fromEntries((openTransfers || []).map((t) => [t.id, t]));
      for (const line of tLines || []) {
        const shipped = Number(line.qty_shipped || line.qty_requested || 0);
        const received = Number(line.qty_received || 0);
        const open = Math.max(0, shipped - received);
        if (open <= 0) continue;
        inTransitUnits += open;
        inTransitLines += 1;
        const pid = Number(line.product_id);
        transitByProduct[pid] = (transitByProduct[pid] || 0) + open;
        const toWh = Number(tMap[line.transfer_id]?.to_warehouse_id);
        if (toWh) transitByToWh[toWh] = (transitByToWh[toWh] || 0) + open;
      }
    }

    // Container inventory (outlets)
    const { data: containerInv } = await supabase
      .from('container_inventory')
      .select('id, container_id, product_name, sku, qty_on_hand, reorder_level, unit')
      .eq('profile_id', companyId);

    const { data: containers } = await supabase
      .from('containers')
      .select('id, name, container_code, city, status')
      .eq('profile_id', companyId);

    const cMap = Object.fromEntries((containers || []).map((c) => [c.id, c]));
    const containerLines = (containerInv || [])
      .filter((c) => includeZero || Number(c.qty_on_hand || 0) !== 0)
      .map((c) => {
        const ctr = cMap[c.container_id];
        const qty = Number(c.qty_on_hand || 0);
        const reorder = Number(c.reorder_level || 0);
        return {
          id: `c-${c.id}`,
          source: 'container' as const,
          container_id: c.container_id,
          product_name: c.product_name,
          sku: c.sku,
          qty_on_hand: qty,
          reorder_level: reorder,
          is_low: qty <= reorder,
          uom: c.unit || 'unit',
          location_name: ctr
            ? `${ctr.name}${ctr.container_code ? ` (${ctr.container_code})` : ''}`
            : `Container #${c.container_id}`,
          city: ctr?.city || null,
        };
      });

    const containerUnits = containerLines.reduce((s, l) => s + l.qty_on_hand, 0);

    // ── By location ─────────────────────────────────────────────────────────
    type LocAgg = {
      warehouse_id: number | null;
      location_key: string;
      name: string;
      code?: string | null;
      owner_type?: string | null;
      partner_name?: string | null;
      city?: string | null;
      warehouse_type?: string | null;
      lines: number;
      units: number;
      reserved: number;
      available: number;
      low_stock: number;
      skus: number;
      in_transit_inbound: number;
    };

    const locMap: Record<string, LocAgg & { productIds: Set<number> }> = {};

    for (const l of levels) {
      const key = l.location_key;
      if (!locMap[key]) {
        const w = l.warehouse as {
          id?: number;
          name?: string;
          code?: string;
          owner_type?: string;
          partner_name?: string;
          city?: string;
          warehouse_type?: string;
        } | null;
        locMap[key] = {
          warehouse_id: l.warehouse_id ?? null,
          location_key: key,
          name: l.location_name,
          code: w?.code || null,
          owner_type: w?.owner_type || (key === 'unassigned' ? 'own' : 'own'),
          partner_name: w?.partner_name || null,
          city: w?.city || null,
          warehouse_type: w?.warehouse_type || null,
          lines: 0,
          units: 0,
          reserved: 0,
          available: 0,
          low_stock: 0,
          skus: 0,
          in_transit_inbound: 0,
          productIds: new Set(),
        };
      }
      const agg = locMap[key];
      agg.lines += 1;
      agg.units += Number(l.qty_on_hand);
      agg.reserved += Number(l.qty_reserved || 0);
      agg.available += Number(l.qty_available || 0);
      if (l.is_low) agg.low_stock += 1;
      if (l.product_id) agg.productIds.add(Number(l.product_id));
    }

    // Include warehouses with zero stock so network is visible
    for (const w of whList) {
      const key = String(w.id);
      if (!locMap[key]) {
        locMap[key] = {
          warehouse_id: w.id,
          location_key: key,
          name: w.name,
          code: w.code,
          owner_type: w.owner_type || 'own',
          partner_name: w.partner_name,
          city: w.city,
          warehouse_type: w.warehouse_type,
          lines: 0,
          units: 0,
          reserved: 0,
          available: 0,
          low_stock: 0,
          skus: 0,
          in_transit_inbound: transitByToWh[w.id] || 0,
          productIds: new Set(),
        };
      } else {
        locMap[key].in_transit_inbound = transitByToWh[w.id] || 0;
      }
    }

    const byLocation = Object.values(locMap)
      .map(({ productIds, ...rest }) => ({
        ...rest,
        skus: productIds.size,
      }))
      .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name));

    // ── By product (network total) ──────────────────────────────────────────
    type ProdAgg = {
      product_id: number;
      name: string;
      sku?: string | null;
      uom?: string | null;
      product_type?: string | null;
      category?: string | null;
      status?: string | null;
      total_on_hand: number;
      total_reserved: number;
      total_available: number;
      locations: number;
      low_locations: number;
      reorder_level: number;
      is_low: boolean;
      in_transit: number;
      by_location: Array<{
        warehouse_id: number | null;
        location_name: string;
        qty_on_hand: number;
        lot_number?: string | null;
      }>;
    };

    const prodMap: Record<number, ProdAgg> = {};
    for (const l of levels) {
      const pid = Number(l.product_id);
      if (!pid) continue;
      const p = l.product as {
        name?: string;
        sku?: string;
        uom?: string;
        product_type?: string;
        category?: string;
        status?: string;
        reorder_level?: number;
      } | null;
      if (!prodMap[pid]) {
        prodMap[pid] = {
          product_id: pid,
          name: p?.name || `Product #${pid}`,
          sku: p?.sku,
          uom: p?.uom,
          product_type: p?.product_type,
          category: p?.category,
          status: p?.status,
          total_on_hand: 0,
          total_reserved: 0,
          total_available: 0,
          locations: 0,
          low_locations: 0,
          reorder_level: Number(p?.reorder_level || 0),
          is_low: false,
          in_transit: transitByProduct[pid] || 0,
          by_location: [],
        };
      }
      const agg = prodMap[pid];
      agg.total_on_hand += Number(l.qty_on_hand);
      agg.total_reserved += Number(l.qty_reserved || 0);
      agg.total_available += Number(l.qty_available || 0);
      agg.locations += 1;
      if (l.is_low) agg.low_locations += 1;
      agg.by_location.push({
        warehouse_id: l.warehouse_id ?? null,
        location_name: l.location_name,
        qty_on_hand: Number(l.qty_on_hand),
        lot_number: l.lot_number,
      });
    }
    for (const agg of Object.values(prodMap)) {
      // Product is low if total across network is at/below product reorder
      agg.is_low =
        agg.total_on_hand <= agg.reorder_level || agg.low_locations > 0;
    }

    const byProduct = Object.values(prodMap).sort(
      (a, b) => b.total_on_hand - a.total_on_hand || a.name.localeCompare(b.name)
    );

    const totalUnits = levels.reduce((s, l) => s + Number(l.qty_on_hand), 0);
    const totalReserved = levels.reduce((s, l) => s + Number(l.qty_reserved || 0), 0);
    const lowLines = levels.filter((l) => l.is_low).length;
    const locationsWithStock = byLocation.filter((l) => l.units > 0 || l.lines > 0).length;

    const typeBreakdown = {
      raw_material: byProduct
        .filter((p) => p.product_type === 'raw_material')
        .reduce((s, p) => s + p.total_on_hand, 0),
      finished_good: byProduct
        .filter((p) => p.product_type === 'finished_good')
        .reduce((s, p) => s + p.total_on_hand, 0),
      other: byProduct
        .filter((p) => p.product_type !== 'raw_material' && p.product_type !== 'finished_good')
        .reduce((s, p) => s + p.total_on_hand, 0),
    };

    const ownerBreakdown = {
      own: byLocation
        .filter((l) => (l.owner_type || 'own') === 'own')
        .reduce((s, l) => s + l.units, 0),
      supplier: byLocation
        .filter((l) => l.owner_type === 'supplier')
        .reduce((s, l) => s + l.units, 0),
      customer: byLocation
        .filter((l) => l.owner_type === 'customer')
        .reduce((s, l) => s + l.units, 0),
      unassigned: byLocation
        .filter((l) => l.location_key === 'unassigned')
        .reduce((s, l) => s + l.units, 0),
    };

    return NextResponse.json({
      success: true,
      asOf,
      levels,
      byLocation,
      byProduct,
      containerLines,
      openTransfers: openTransfers || [],
      warehouses: whList,
      products: allProducts || [],
      summary: {
        asOf,
        stockLines: levels.length,
        totalUnits,
        totalReserved,
        totalAvailable: totalUnits - totalReserved,
        lowStockLines: lowLines,
        skusWithStock: byProduct.length,
        locations: whList.length,
        locationsWithStock,
        inTransitUnits,
        inTransitLines,
        containerUnits,
        containerLines: containerLines.length,
        networkUnits: totalUnits + containerUnits + inTransitUnits,
        typeBreakdown,
        ownerBreakdown,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

function emptySummary(asOf: string) {
  return {
    asOf,
    stockLines: 0,
    totalUnits: 0,
    totalReserved: 0,
    totalAvailable: 0,
    lowStockLines: 0,
    skusWithStock: 0,
    locations: 0,
    locationsWithStock: 0,
    inTransitUnits: 0,
    inTransitLines: 0,
    containerUnits: 0,
    containerLines: 0,
    networkUnits: 0,
    typeBreakdown: { raw_material: 0, finished_good: 0, other: 0 },
    ownerBreakdown: { own: 0, supplier: 0, customer: 0, unassigned: 0 },
  };
}

/**
 * POST movement — receive | issue | transfer | adjustment | count
 * Body: { companyId, productId, warehouseId, quantity, movement_type, notes?, toWarehouseId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const productId = Number(body.productId);
    const warehouseId = Number(body.warehouseId);
    const qty = Number(body.quantity);
    const type = body.movement_type || body.action || 'adjustment';

    if (!Number.isFinite(companyId) || !Number.isFinite(productId) || !Number.isFinite(qty)) {
      return NextResponse.json(
        { error: 'companyId, productId, and quantity required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const onchainHash = hashMovement({
      profileId: companyId,
      productId,
      movementType: type,
      quantity: qty,
      at: now,
      reference: body.reference_id,
    });

    let levelId: number | null = null;
    let currentQty = 0;

    if (Number.isFinite(warehouseId)) {
      const { data: existing } = await supabase
        .from('stock_levels')
        .select('*')
        .eq('profile_id', companyId)
        .eq('product_id', productId)
        .eq('warehouse_id', warehouseId)
        .maybeSingle();

      if (existing) {
        levelId = existing.id;
        currentQty = Number(existing.qty_on_hand || 0);
      }
    } else {
      const { data: existing } = await supabase
        .from('stock_levels')
        .select('*')
        .eq('profile_id', companyId)
        .eq('product_id', productId)
        .is('warehouse_id', null)
        .maybeSingle();
      if (existing) {
        levelId = existing.id;
        currentQty = Number(existing.qty_on_hand || 0);
      }
    }

    let nextQty = currentQty;
    if (type === 'receive' || type === 'return') nextQty = currentQty + Math.abs(qty);
    else if (type === 'issue' || type === 'sale') nextQty = currentQty - Math.abs(qty);
    else if (type === 'count' || type === 'adjustment')
      nextQty = body.absolute ? qty : currentQty + qty;
    else if (type === 'transfer') nextQty = currentQty - Math.abs(qty);
    else nextQty = currentQty + qty;

    if (levelId) {
      await supabase
        .from('stock_levels')
        .update({ qty_on_hand: nextQty, updated_at: now })
        .eq('id', levelId);
    } else {
      const { data: created } = await supabase
        .from('stock_levels')
        .insert({
          profile_id: companyId,
          product_id: productId,
          warehouse_id: Number.isFinite(warehouseId) ? warehouseId : null,
          qty_on_hand: nextQty,
          reorder_level: body.reorder_level != null ? Number(body.reorder_level) : 0,
          updated_at: now,
        })
        .select('id')
        .single();
      levelId = created?.id ?? null;
    }

    if (type === 'transfer' && body.toWarehouseId) {
      const toId = Number(body.toWarehouseId);
      const { data: dest } = await supabase
        .from('stock_levels')
        .select('*')
        .eq('profile_id', companyId)
        .eq('product_id', productId)
        .eq('warehouse_id', toId)
        .maybeSingle();
      if (dest) {
        await supabase
          .from('stock_levels')
          .update({
            qty_on_hand: Number(dest.qty_on_hand || 0) + Math.abs(qty),
            updated_at: now,
          })
          .eq('id', dest.id);
      } else {
        await supabase.from('stock_levels').insert({
          profile_id: companyId,
          product_id: productId,
          warehouse_id: toId,
          qty_on_hand: Math.abs(qty),
          updated_at: now,
        });
      }
    }

    const { data: movement, error } = await supabase
      .from('stock_movements')
      .insert({
        profile_id: companyId,
        product_id: productId,
        warehouse_id: Number.isFinite(warehouseId) ? warehouseId : null,
        from_warehouse_id: type === 'transfer' ? warehouseId : null,
        to_warehouse_id: type === 'transfer' ? Number(body.toWarehouseId) || null : null,
        movement_type: type,
        quantity: qty,
        unit_cost: body.unit_cost != null ? Number(body.unit_cost) : 0,
        reference_type: body.reference_type || null,
        reference_id: body.reference_id || null,
        notes: body.notes || null,
        created_by: body.created_by || null,
        onchain_hash: onchainHash,
        lot_number: body.lot_number || null,
        created_at: now,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      movement,
      qty_on_hand: nextQty,
      onchain_hash: onchainHash,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
