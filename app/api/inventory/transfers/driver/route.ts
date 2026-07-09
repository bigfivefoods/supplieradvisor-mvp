import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { hashMovement } from '@/lib/inventory/hash';

/**
 * Public driver handoff API — no dashboard login required.
 * Driver scans QR → /t/{token} → pickup → GPS pings → deliver/receive.
 *
 * GET  ?token=xxx
 * POST { token, action: 'identify'|'pickup'|'ping'|'deliver', driverName?, driverPhone?, vehicleReg?, geo?, notes? }
 */

function appBase(request: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    request.nextUrl.origin ||
    'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
}

async function getStockQty(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  productId: number,
  warehouseId: number
) {
  const { data } = await supabase
    .from('stock_levels')
    .select('*')
    .eq('profile_id', companyId)
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId)
    .maybeSingle();
  return data;
}

async function setStockQty(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  productId: number,
  warehouseId: number,
  nextQty: number,
  now: string
) {
  const existing = await getStockQty(supabase, companyId, productId, warehouseId);
  if (existing) {
    await supabase
      .from('stock_levels')
      .update({ qty_on_hand: nextQty, updated_at: now })
      .eq('id', existing.id);
    return;
  }
  await supabase.from('stock_levels').insert({
    profile_id: companyId,
    product_id: productId,
    warehouse_id: warehouseId,
    qty_on_hand: nextQty,
    updated_at: now,
  });
}

async function logEvent(
  supabase: ReturnType<typeof getSupabaseServer>,
  opts: {
    transferId: number;
    profileId: number | null;
    eventType: string;
    actorName?: string | null;
    actorPhone?: string | null;
    lat?: number | null;
    lng?: number | null;
    accuracy?: number | null;
    notes?: string | null;
    payload?: Record<string, unknown>;
  }
) {
  await supabase.from('stock_transfer_events').insert({
    transfer_id: opts.transferId,
    profile_id: opts.profileId,
    event_type: opts.eventType,
    actor_name: opts.actorName || null,
    actor_phone: opts.actorPhone || null,
    lat: opts.lat ?? null,
    lng: opts.lng ?? null,
    accuracy_m: opts.accuracy ?? null,
    notes: opts.notes || null,
    payload: opts.payload || {},
  });
}

async function loadByToken(supabase: ReturnType<typeof getSupabaseServer>, token: string) {
  const clean = token.trim();
  // token or transfer_number
  let { data: order } = await supabase
    .from('stock_transfer_orders')
    .select('*')
    .eq('public_token', clean)
    .maybeSingle();

  if (!order) {
    const byNumber = await supabase
      .from('stock_transfer_orders')
      .select('*')
      .eq('transfer_number', clean.toUpperCase())
      .maybeSingle();
    order = byNumber.data;
  }

  return order;
}

function publicTransferView(order: Record<string, unknown>, lines: unknown[], events: unknown[], base: string) {
  const token = String(order.public_token || '');
  return {
    id: order.id,
    transfer_number: order.transfer_number,
    status: order.status,
    from_warehouse_name: order.from_warehouse_name,
    to_warehouse_name: order.to_warehouse_name,
    carrier: order.carrier,
    tracking_ref: order.tracking_ref,
    driver_name: order.driver_name,
    driver_phone: order.driver_phone,
    vehicle_reg: order.vehicle_reg,
    expected_ship_date: order.expected_ship_date,
    expected_receive_date: order.expected_receive_date,
    shipped_at: order.shipped_at,
    received_at: order.received_at,
    pickup_scanned_at: order.pickup_scanned_at,
    dropoff_scanned_at: order.dropoff_scanned_at,
    last_lat: order.last_lat,
    last_lng: order.last_lng,
    last_location_at: order.last_location_at,
    notes: order.notes,
    lines: (lines as Array<Record<string, unknown>>).map((l) => ({
      id: l.id,
      product_name: l.product_name,
      sku: l.sku,
      uom: l.uom,
      qty_requested: l.qty_requested,
      qty_shipped: l.qty_shipped,
      qty_received: l.qty_received,
      lot_number: l.lot_number,
    })),
    events: events,
    driver_url: token ? `${base}/t/${token}` : null,
    public_token: token || null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const order = await loadByToken(supabase, token);
    if (!order) {
      return NextResponse.json(
        {
          error: 'Transfer not found',
          hint: 'Scan the QR on the transfer slip or enter the TRF-… number',
        },
        { status: 404 }
      );
    }

    const [{ data: lines }, { data: events }] = await Promise.all([
      supabase
        .from('stock_transfer_lines')
        .select('id, product_name, sku, uom, qty_requested, qty_shipped, qty_received, lot_number')
        .eq('transfer_id', order.id)
        .order('id'),
      supabase
        .from('stock_transfer_events')
        .select('id, event_type, actor_name, lat, lng, notes, created_at')
        .eq('transfer_id', order.id)
        .order('created_at', { ascending: false })
        .limit(40),
    ]);

    return NextResponse.json({
      success: true,
      transfer: publicTransferView(order, lines || [], events || [], appBase(request)),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body.token || '').trim();
    const action = String(body.action || '').toLowerCase();
    if (!token || !action) {
      return NextResponse.json({ error: 'token and action required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const order = await loadByToken(supabase, token);
    if (!order) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    const companyId = Number(order.profile_id);
    const now = new Date().toISOString();
    const driverName = body.driverName || body.driver_name || order.driver_name || null;
    const driverPhone = body.driverPhone || body.driver_phone || order.driver_phone || null;
    const vehicleReg = body.vehicleReg || body.vehicle_reg || order.vehicle_reg || null;
    const geo = body.geo || {};
    const lat = geo.lat != null ? Number(geo.lat) : body.lat != null ? Number(body.lat) : null;
    const lng = geo.lng != null ? Number(geo.lng) : body.lng != null ? Number(body.lng) : null;
    const accuracy = geo.accuracy != null ? Number(geo.accuracy) : null;

    const { data: lines } = await supabase
      .from('stock_transfer_lines')
      .select('*')
      .eq('transfer_id', order.id);

    // ── IDENTIFY / assign driver ────────────────────────────────────────────
    if (action === 'identify' || action === 'assign') {
      if (!driverName && !driverPhone) {
        return NextResponse.json({ error: 'Driver name or phone required' }, { status: 400 });
      }
      const { data: updated, error } = await supabase
        .from('stock_transfer_orders')
        .update({
          driver_name: driverName,
          driver_phone: driverPhone,
          vehicle_reg: vehicleReg,
          updated_at: now,
        })
        .eq('id', order.id)
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await logEvent(supabase, {
        transferId: order.id,
        profileId: companyId,
        eventType: 'assigned',
        actorName: driverName,
        actorPhone: driverPhone,
        lat,
        lng,
        accuracy,
        notes: body.notes || 'Driver identified',
        payload: { vehicle_reg: vehicleReg },
      });

      return NextResponse.json({
        success: true,
        action: 'identify',
        transfer: publicTransferView(updated, lines || [], [], appBase(request)),
      });
    }

    // ── PICKUP (ship from source) ───────────────────────────────────────────
    if (action === 'pickup' || action === 'ship') {
      if (!['draft', 'shipped'].includes(String(order.status))) {
        if (['in_transit', 'partially_received', 'received'].includes(String(order.status))) {
          return NextResponse.json({
            success: true,
            action: 'pickup',
            already: true,
            message: 'Already picked up',
            transfer: publicTransferView(order, lines || [], [], appBase(request)),
          });
        }
        return NextResponse.json(
          { error: `Cannot pickup from status "${order.status}"` },
          { status: 409 }
        );
      }

      if (order.status === 'draft') {
        const fromId = Number(order.from_warehouse_id);
        for (const l of lines || []) {
          const productId = Number(l.product_id);
          const qty = Math.abs(Number(l.qty_requested || 0));
          if (!productId || qty <= 0) continue;

          const stock = await getStockQty(supabase, companyId, productId, fromId);
          const onHand = Number(stock?.qty_on_hand || 0);
          if (onHand + 0.0001 < qty && !body.allowNegative) {
            return NextResponse.json(
              {
                error: `Insufficient stock for ${l.product_name || productId} (have ${onHand}, need ${qty})`,
              },
              { status: 409 }
            );
          }
          await setStockQty(supabase, companyId, productId, fromId, onHand - qty, now);
          await supabase
            .from('stock_transfer_lines')
            .update({ qty_shipped: qty, updated_at: now })
            .eq('id', l.id);

          await supabase.from('stock_movements').insert({
            profile_id: companyId,
            product_id: productId,
            warehouse_id: fromId,
            from_warehouse_id: fromId,
            to_warehouse_id: order.to_warehouse_id,
            movement_type: 'transfer_ship',
            quantity: -qty,
            reference_type: 'stock_transfer_order',
            reference_id: String(order.id),
            notes: `Driver pickup ${order.transfer_number}`,
            lot_number: l.lot_number || null,
            created_by: driverName || driverPhone || 'driver',
            onchain_hash: hashMovement({
              profileId: companyId,
              productId,
              movementType: 'transfer_ship_driver',
              quantity: qty,
              at: now,
              reference: order.transfer_number,
            }),
            created_at: now,
          });
        }
      }

      const { data: updated, error } = await supabase
        .from('stock_transfer_orders')
        .update({
          status: 'in_transit',
          shipped_at: order.shipped_at || now,
          pickup_scanned_at: now,
          pickup_lat: lat,
          pickup_lng: lng,
          last_lat: lat,
          last_lng: lng,
          last_location_at: lat != null ? now : order.last_location_at,
          driver_name: driverName || order.driver_name,
          driver_phone: driverPhone || order.driver_phone,
          vehicle_reg: vehicleReg || order.vehicle_reg,
          ship_notes: body.notes || order.ship_notes,
          updated_at: now,
        })
        .eq('id', order.id)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await logEvent(supabase, {
        transferId: order.id,
        profileId: companyId,
        eventType: 'pickup_scan',
        actorName: driverName,
        actorPhone: driverPhone,
        lat,
        lng,
        accuracy,
        notes: body.notes || 'Driver scanned pickup',
      });
      await logEvent(supabase, {
        transferId: order.id,
        profileId: companyId,
        eventType: 'en_route',
        actorName: driverName,
        actorPhone: driverPhone,
        lat,
        lng,
        accuracy,
        notes: 'In transit to destination',
      });

      const { data: refreshedLines } = await supabase
        .from('stock_transfer_lines')
        .select('*')
        .eq('transfer_id', order.id);

      return NextResponse.json({
        success: true,
        action: 'pickup',
        transfer: publicTransferView(updated, refreshedLines || [], [], appBase(request)),
      });
    }

    // ── GPS PING while en route ─────────────────────────────────────────────
    if (action === 'ping' || action === 'location') {
      if (lat == null || lng == null) {
        return NextResponse.json({ error: 'geo lat/lng required for ping' }, { status: 400 });
      }
      if (!['in_transit', 'shipped', 'partially_received'].includes(String(order.status))) {
        return NextResponse.json(
          { error: 'Location pings only while transfer is in transit' },
          { status: 409 }
        );
      }

      await supabase
        .from('stock_transfer_orders')
        .update({
          last_lat: lat,
          last_lng: lng,
          last_location_at: now,
          driver_name: driverName || order.driver_name,
          driver_phone: driverPhone || order.driver_phone,
          updated_at: now,
        })
        .eq('id', order.id);

      await logEvent(supabase, {
        transferId: order.id,
        profileId: companyId,
        eventType: 'location_ping',
        actorName: driverName,
        actorPhone: driverPhone,
        lat,
        lng,
        accuracy,
        notes: body.notes || null,
      });

      return NextResponse.json({ success: true, action: 'ping', at: now, lat, lng });
    }

    // ── DELIVER / RECEIVE at destination ────────────────────────────────────
    if (action === 'deliver' || action === 'receive' || action === 'dropoff') {
      if (!['in_transit', 'shipped', 'partially_received'].includes(String(order.status))) {
        if (order.status === 'received') {
          return NextResponse.json({
            success: true,
            action: 'deliver',
            already: true,
            message: 'Already fully received',
            transfer: publicTransferView(order, lines || [], [], appBase(request)),
          });
        }
        if (order.status === 'draft') {
          return NextResponse.json(
            { error: 'Transfer not picked up yet — scan pickup first' },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { error: `Cannot deliver from status "${order.status}"` },
          { status: 409 }
        );
      }

      const toId = Number(order.to_warehouse_id);
      const receiveInputs = (body.lines as Array<{ id?: number; product_id?: number; qty_received?: number }> | undefined) || [];

      for (const existing of lines || []) {
        const override = receiveInputs.find(
          (r) => Number(r.id) === existing.id || Number(r.product_id) === existing.product_id
        );
        const already = Number(existing.qty_received || 0);
        const shipped = Number(existing.qty_shipped || existing.qty_requested || 0);
        const remaining = Math.max(0, shipped - already);
        const qty =
          override?.qty_received != null ? Math.abs(Number(override.qty_received)) : remaining;
        if (qty <= 0) continue;

        const productId = Number(existing.product_id);
        const stock = await getStockQty(supabase, companyId, productId, toId);
        const onHand = Number(stock?.qty_on_hand || 0);
        await setStockQty(supabase, companyId, productId, toId, onHand + qty, now);

        await supabase
          .from('stock_transfer_lines')
          .update({ qty_received: already + qty, updated_at: now })
          .eq('id', existing.id);

        await supabase.from('stock_movements').insert({
          profile_id: companyId,
          product_id: productId,
          warehouse_id: toId,
          from_warehouse_id: order.from_warehouse_id,
          to_warehouse_id: toId,
          movement_type: 'transfer_receive',
          quantity: qty,
          reference_type: 'stock_transfer_order',
          reference_id: String(order.id),
          notes: `Driver deliver ${order.transfer_number}`,
          lot_number: existing.lot_number || null,
          created_by: driverName || driverPhone || 'driver',
          onchain_hash: hashMovement({
            profileId: companyId,
            productId,
            movementType: 'transfer_receive_driver',
            quantity: qty,
            at: now,
            reference: order.transfer_number,
          }),
          created_at: now,
        });
      }

      const { data: refreshedLines } = await supabase
        .from('stock_transfer_lines')
        .select('*')
        .eq('transfer_id', order.id);

      let fullyReceived = true;
      let anyReceived = false;
      for (const l of refreshedLines || []) {
        const shipped = Number(l.qty_shipped || l.qty_requested || 0);
        const received = Number(l.qty_received || 0);
        if (received > 0) anyReceived = true;
        if (received + 0.0001 < shipped) fullyReceived = false;
      }

      const nextStatus = fullyReceived
        ? 'received'
        : anyReceived
          ? 'partially_received'
          : order.status;

      const { data: updated, error } = await supabase
        .from('stock_transfer_orders')
        .update({
          status: nextStatus,
          received_at: fullyReceived ? now : order.received_at || (anyReceived ? now : null),
          dropoff_scanned_at: now,
          dropoff_lat: lat,
          dropoff_lng: lng,
          last_lat: lat ?? order.last_lat,
          last_lng: lng ?? order.last_lng,
          last_location_at: lat != null ? now : order.last_location_at,
          driver_name: driverName || order.driver_name,
          driver_phone: driverPhone || order.driver_phone,
          receive_notes: body.notes || order.receive_notes,
          updated_at: now,
        })
        .eq('id', order.id)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await logEvent(supabase, {
        transferId: order.id,
        profileId: companyId,
        eventType: fullyReceived ? 'received' : 'dropoff_scan',
        actorName: driverName,
        actorPhone: driverPhone,
        lat,
        lng,
        accuracy,
        notes: body.notes || (fullyReceived ? 'Fully received at destination' : 'Partial delivery'),
      });

      return NextResponse.json({
        success: true,
        action: 'deliver',
        transfer: publicTransferView(updated, refreshedLines || [], [], appBase(request)),
      });
    }

    return NextResponse.json(
      {
        error: `Unknown action "${action}"`,
        allowed: ['identify', 'pickup', 'ping', 'deliver'],
      },
      { status: 400 }
    );
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
