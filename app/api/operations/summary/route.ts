import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';

/**
 * GET ?companyId=
 * End-to-end operations control-tower metrics (procure → make → move → fulfill).
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    const [
      buyerPos,
      sellerPos,
      mfgOrders,
      mfgBoms,
      mfgWc,
      ships,
      transfers,
      stock,
      warehouses,
      products,
      containers,
      carriers,
      quality,
      srmSuppliers,
      customers,
    ] = await Promise.all([
      supabase
        .from('purchase_orders')
        .select('id, status, total, currency, created_at, po_number')
        .eq('buyer_profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('purchase_orders')
        .select('id, status, total, currency, created_at, po_number')
        .or(`supplier_profile_id.eq.${companyId},supplier_id.eq.${companyId}`)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('manufacturing_production_orders')
        .select('id, status, qty_planned, qty_completed, order_number, priority')
        .eq('profile_id', companyId),
      supabase
        .from('manufacturing_boms')
        .select('id, status')
        .eq('profile_id', companyId),
      supabase
        .from('manufacturing_work_centers')
        .select('id, status')
        .eq('profile_id', companyId),
      supabase
        .from('shipments')
        .select('id, direction, status, mode, eta, shipment_number, progress_pct')
        .eq('profile_id', companyId),
      supabase
        .from('stock_transfer_orders')
        .select('id, status')
        .eq('profile_id', companyId)
        .limit(200),
      supabase
        .from('stock_levels')
        .select('qty_on_hand, product_id')
        .eq('profile_id', companyId),
      supabase.from('warehouses').select('id, status').eq('profile_id', companyId),
      supabase
        .from('products')
        .select('id, product_type, is_active')
        .eq('profile_id', companyId),
      supabase
        .from('containers')
        .select('id, status')
        .eq('profile_id', companyId)
        .limit(100),
      supabase.from('carriers').select('id, is_active, status').eq('profile_id', companyId),
      supabase
        .from('quality_inspections')
        .select('id, status')
        .eq('profile_id', companyId)
        .limit(100),
      supabase
        .from('srm_suppliers')
        .select('id, status')
        .eq('profile_id', companyId)
        .limit(200),
      supabase
        .from('customers')
        .select('id, status')
        .eq('profile_id', companyId)
        .limit(200),
    ]);

    const warnings = [
      buyerPos.error?.message,
      mfgOrders.error?.message,
      ships.error?.message,
      stock.error?.message,
    ].filter(Boolean);

    const buy = buyerPos.data || [];
    const sell = sellerPos.data || [];
    const openBuyer = buy.filter((p) =>
      ['sent', 'accepted', 'funded', 'in_transit', 'partial', 'open', 'confirmed'].includes(
        String(p.status)
      )
    );
    const openSeller = sell.filter((p) =>
      ['sent', 'accepted', 'funded', 'in_transit', 'partial', 'open', 'confirmed'].includes(
        String(p.status)
      )
    );

    const wos = mfgOrders.data || [];
    const woInFlight = wos.filter((o) =>
      ['released', 'in_progress', 'hold'].includes(String(o.status))
    );
    const woHold = wos.filter((o) => o.status === 'hold');

    const shipments = ships.data || [];
    const inbound = shipments.filter((s) => s.direction === 'inbound');
    const outbound = shipments.filter((s) => s.direction === 'outbound');
    const shipMotion = shipments.filter((s) =>
      [
        'booked',
        'picked_up',
        'in_transit',
        'at_hub',
        'customs',
        'out_for_delivery',
      ].includes(String(s.status))
    );
    const shipExceptions = shipments.filter((s) => s.status === 'exception');

    const xfers = transfers.data || [];
    const xferLive = xfers.filter((t) =>
      ['in_transit', 'shipped', 'dispatched', 'en_route', 'picked_up'].includes(String(t.status))
    );

    const levels = stock.data || [];
    const unitsOnHand = levels.reduce((s, r) => s + Number(r.qty_on_hand || 0), 0);
    const skusWithStock = new Set(
      levels.filter((l) => Number(l.qty_on_hand) > 0).map((l) => l.product_id)
    ).size;

    const prods = products.data || [];
    const raw = prods.filter((p) =>
      String(p.product_type || '').toLowerCase().includes('raw')
    ).length;
    const fg = prods.filter((p) =>
      /finish|fg|kit/.test(String(p.product_type || '').toLowerCase())
    ).length;

    const inspections = quality.data || [];
    const openQi = inspections.filter((q) =>
      ['open', 'pending', 'in_progress'].includes(String(q.status))
    ).length;

    const exceptions =
      shipExceptions.length +
      woHold.length +
      openQi;

    // Recent activity blend
    const recent: {
      id: string;
      domain: string;
      title: string;
      status: string;
      href: string;
    }[] = [];

    for (const p of buy.slice(0, 4)) {
      recent.push({
        id: `po-b-${p.id}`,
        domain: 'procure',
        title: p.po_number || `PO #${p.id}`,
        status: String(p.status),
        href: '/dashboard/suppliers/po',
      });
    }
    for (const o of woInFlight.slice(0, 3)) {
      recent.push({
        id: `wo-${o.id}`,
        domain: 'make',
        title: o.order_number || `WO #${o.id}`,
        status: String(o.status),
        href: '/dashboard/manufacturing/production-orders',
      });
    }
    for (const s of shipMotion.slice(0, 4)) {
      recent.push({
        id: `sh-${s.id}`,
        domain: s.direction === 'inbound' ? 'inbound' : 'outbound',
        title: s.shipment_number || `Ship #${s.id}`,
        status: String(s.status),
        href:
          s.direction === 'inbound'
            ? '/dashboard/distribution/inbound'
            : '/dashboard/distribution/outbound',
      });
    }
    for (const p of sell.slice(0, 3)) {
      recent.push({
        id: `po-s-${p.id}`,
        domain: 'fulfill',
        title: p.po_number || `Customer PO #${p.id}`,
        status: String(p.status),
        href: '/dashboard/customers/orders',
      });
    }

    // Throughput score proxy 0–100
    const throughput =
      Math.min(
        100,
        Math.round(
          (openBuyer.length * 8 +
            woInFlight.length * 12 +
            shipMotion.length * 10 +
            openSeller.length * 8 +
            (unitsOnHand > 0 ? 15 : 0) +
            (prods.length > 0 ? 10 : 0)) /
            1.2
        )
      ) || 0;

    return NextResponse.json({
      success: true,
      warning: warnings[0] || undefined,
      summary: {
        // Procure
        supplierPos: buy.length,
        supplierPosOpen: openBuyer.length,
        suppliers: (srmSuppliers.data || []).length,
        // Inbound / move in
        inboundShipments: inbound.length,
        inboundInMotion: inbound.filter((s) =>
          ['picked_up', 'in_transit', 'at_hub', 'customs', 'out_for_delivery'].includes(
            String(s.status)
          )
        ).length,
        // Inventory
        warehouses: (warehouses.data || []).length,
        products: prods.length,
        rawMaterials: raw,
        finishedGoods: fg,
        unitsOnHand: Math.round(unitsOnHand * 100) / 100,
        skusWithStock,
        transfersLive: xferLive.length,
        // Make
        workOrders: wos.length,
        workOrdersInFlight: woInFlight.length,
        workOrdersHold: woHold.length,
        bomsActive: (mfgBoms.data || []).filter((b) => b.status === 'active').length,
        workCells: (mfgWc.data || []).length,
        // Outbound
        outboundShipments: outbound.length,
        outboundInMotion: outbound.filter((s) =>
          ['picked_up', 'in_transit', 'at_hub', 'customs', 'out_for_delivery'].includes(
            String(s.status)
          )
        ).length,
        carriersActive: (carriers.data || []).filter(
          (c) => c.is_active !== false && c.status !== 'suspended'
        ).length,
        // Fulfill
        customerPos: sell.length,
        customerPosOpen: openSeller.length,
        customers: (customers.data || []).length,
        // Cross-cutting
        containers: (containers.data || []).length,
        qualityOpen: openQi,
        exceptions,
        shipmentsInMotion: shipMotion.length,
        throughput,
        recent: recent.slice(0, 12),
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
