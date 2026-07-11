import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { hashMovement } from '@/lib/inventory/hash';
import { hasQaHold, qaHoldErrorPayload } from '@/lib/quality/holds';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

function newPublicToken() {
  return randomBytes(16).toString('hex');
}

function driverUrlFor(token: string | null | undefined, request?: NextRequest) {
  if (!token) return null;
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    request?.nextUrl.origin ||
    'https://www.supplieradvisor.com'
  ).replace(/\/$/, '');
  return `${base}/t/${token}`;
}

type LineInput = {
  product_id: number;
  qty_requested?: number;
  qty_shipped?: number;
  qty_received?: number;
  lot_number?: string | null;
  notes?: string | null;
  product_name?: string | null;
  sku?: string | null;
  uom?: string | null;
};

function transferNumber() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TRF-${y}${m}${day}-${rand}`;
}

async function loadWarehouses(
  supabase: ReturnType<typeof getSupabaseServer>,
  ids: number[]
) {
  const map: Record<
    number,
    {
      id: number;
      name: string;
      lat?: number | null;
      lng?: number | null;
      address?: string | null;
      city?: string | null;
      country?: string | null;
    }
  > = {};
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return map;
  const { data } = await supabase
    .from('warehouses')
    .select('id, name, lat, lng, address, city, country')
    .in('id', unique);
  for (const w of data || []) map[w.id] = w;
  return map;
}

function physicalEndpoint(w?: {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  name?: string;
} | null) {
  const lat = w?.lat != null ? Number(w.lat) : null;
  const lng = w?.lng != null ? Number(w.lng) : null;
  const has =
    lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  const address = [w?.address, w?.city, w?.country].filter(Boolean).join(', ') || null;
  return {
    lat: has ? lat : null,
    lng: has ? lng : null,
    address,
    name: w?.name || null,
  };
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
    return existing.id as number;
  }
  const { data } = await supabase
    .from('stock_levels')
    .insert({
      profile_id: companyId,
      product_id: productId,
      warehouse_id: warehouseId,
      qty_on_hand: nextQty,
      updated_at: now,
    })
    .select('id')
    .single();
  return data?.id as number | undefined;
}

async function enrichOrder(
  supabase: ReturnType<typeof getSupabaseServer>,
  order: Record<string, unknown>
) {
  const { data: lines } = await supabase
    .from('stock_transfer_lines')
    .select('*')
    .eq('transfer_id', order.id)
    .order('id');
  return { ...order, lines: lines || [] };
}

/** GET transfer orders (optional status filter) */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const status = request.nextUrl.searchParams.get('status');
    const id = request.nextUrl.searchParams.get('id');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();

    if (id) {
      const { data, error } = await supabase
        .from('stock_transfer_orders')
        .select('*')
        .eq('id', Number(id))
        .eq('profile_id', companyId)
        .maybeSingle();
      if (error) {
        return NextResponse.json({
          success: true,
          transfers: [],
          warning: error.message,
          hint: 'Run 20260709_warehouses_and_transfer_orders.sql',
        });
      }
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const transfer = {
        ...(await enrichOrder(supabase, data)),
        driver_url: driverUrlFor(data.public_token, request),
      };
      return NextResponse.json({ success: true, transfer, transfers: [transfer] });
    }

    let q = supabase
      .from('stock_transfer_orders')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (status && status !== 'all') q = q.eq('status', status);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({
        success: true,
        transfers: [],
        warning: error.message,
        hint: 'Run 20260709_warehouses_and_transfer_orders.sql',
      });
    }

    const orders = data || [];
    const ids = orders.map((o) => o.id);
    let lineMap: Record<number, Record<string, unknown>[]> = {};
    if (ids.length) {
      const { data: lines } = await supabase
        .from('stock_transfer_lines')
        .select('*')
        .in('transfer_id', ids);
      for (const l of lines || []) {
        const tid = Number(l.transfer_id);
        if (!lineMap[tid]) lineMap[tid] = [];
        lineMap[tid].push(l);
      }
    }

    const transfers = orders.map((o) => ({
      ...o,
      lines: lineMap[o.id] || [],
      driver_url: driverUrlFor(o.public_token, request),
    }));

    return NextResponse.json({ success: true, transfers });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * POST create transfer order (draft) or action on existing:
 * { companyId, action?: 'create' | 'ship' | 'receive' | 'cancel', id?, fromWarehouseId, toWarehouseId, lines?, ... }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const action = body.action || (body.id ? body.nextAction : 'create') || 'create';
    const supabase = getSupabaseServer();
    const now = new Date().toISOString();

    // ── CREATE DRAFT ────────────────────────────────────────────────────────
    if (action === 'create') {
      const fromId = Number(body.fromWarehouseId ?? body.from_warehouse_id);
      const toId = Number(body.toWarehouseId ?? body.to_warehouse_id);
      const lines = (body.lines || []) as LineInput[];

      if (!Number.isFinite(fromId) || !Number.isFinite(toId)) {
        return NextResponse.json(
          { error: 'fromWarehouseId and toWarehouseId required' },
          { status: 400 }
        );
      }
      if (fromId === toId) {
        return NextResponse.json({ error: 'Source and destination must differ' }, { status: 400 });
      }
      if (!lines.length) {
        return NextResponse.json({ error: 'At least one line required' }, { status: 400 });
      }

      const whMap = await loadWarehouses(supabase, [fromId, toId]);
      const fromEp = physicalEndpoint(whMap[fromId]);
      const toEp = physicalEndpoint(whMap[toId]);
      const productIds = lines.map((l) => Number(l.product_id)).filter(Boolean);
      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku, uom')
        .in('id', productIds);
      const pMap = Object.fromEntries((products || []).map((p) => [p.id, p]));

      const number = body.transfer_number || transferNumber();
      const publicToken = body.public_token || newPublicToken();
      const onchainHash = hashMovement({
        profileId: companyId,
        productId: productIds[0] || 0,
        movementType: 'transfer_create',
        quantity: lines.reduce((s, l) => s + Number(l.qty_requested || 0), 0),
        at: now,
        reference: number,
      });

      let { data: order, error } = await supabase
        .from('stock_transfer_orders')
        .insert({
          profile_id: companyId,
          transfer_number: number,
          public_token: publicToken,
          status: 'draft',
          from_warehouse_id: fromId,
          to_warehouse_id: toId,
          from_warehouse_name: fromEp.name || whMap[fromId]?.name || null,
          to_warehouse_name: toEp.name || whMap[toId]?.name || null,
          // Physical collection → destination (for live ETA / map)
          from_lat: fromEp.lat,
          from_lng: fromEp.lng,
          to_lat: toEp.lat,
          to_lng: toEp.lng,
          from_address: fromEp.address,
          to_address: toEp.address,
          expected_ship_date: body.expected_ship_date || null,
          expected_receive_date: body.expected_receive_date || null,
          carrier: body.carrier || null,
          tracking_ref: body.tracking_ref || null,
          driver_name: body.driver_name || body.driverName || null,
          driver_phone: body.driver_phone || body.driverPhone || null,
          vehicle_reg: body.vehicle_reg || body.vehicleReg || null,
          notes: body.notes || null,
          created_by: body.created_by || null,
          onchain_hash: onchainHash,
          updated_at: now,
        })
        .select('*')
        .single();

      // Soft-retry without optional columns if migration not run yet
      if (error && /column|schema cache|does not exist/i.test(error.message)) {
        const retry = await supabase
          .from('stock_transfer_orders')
          .insert({
            profile_id: companyId,
            transfer_number: number,
            status: 'draft',
            from_warehouse_id: fromId,
            to_warehouse_id: toId,
            from_warehouse_name: fromEp.name || whMap[fromId]?.name || null,
            to_warehouse_name: toEp.name || whMap[toId]?.name || null,
            expected_ship_date: body.expected_ship_date || null,
            expected_receive_date: body.expected_receive_date || null,
            carrier: body.carrier || null,
            tracking_ref: body.tracking_ref || null,
            notes: body.notes || null,
            created_by: body.created_by || null,
            onchain_hash: onchainHash,
            updated_at: now,
          })
          .select('*')
          .single();
        order = retry.data;
        error = retry.error;
      }

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
            hint: 'Run 20260709_warehouses_and_transfer_orders.sql and 20260709_transfer_driver_tracking.sql',
          },
          { status: 500 }
        );
      }

      // Log created event (ignore if events table missing)
      await supabase.from('stock_transfer_events').insert({
        transfer_id: order.id,
        profile_id: companyId,
        event_type: 'created',
        notes: `Draft ${number}`,
        payload: { transfer_number: number },
      });

      const lineRows = lines.map((l) => {
        const pid = Number(l.product_id);
        const p = pMap[pid];
        return {
          transfer_id: order.id,
          profile_id: companyId,
          product_id: pid,
          product_name: l.product_name || p?.name || null,
          sku: l.sku || p?.sku || null,
          uom: l.uom || p?.uom || 'unit',
          qty_requested: Math.abs(Number(l.qty_requested || 0)),
          qty_shipped: 0,
          qty_received: 0,
          lot_number: l.lot_number || null,
          notes: l.notes || null,
          updated_at: now,
        };
      });

      const { data: insertedLines, error: lineErr } = await supabase
        .from('stock_transfer_lines')
        .insert(lineRows)
        .select('*');

      if (lineErr) {
        return NextResponse.json({ error: lineErr.message }, { status: 500 });
      }

      const token = order.public_token || publicToken;
      return NextResponse.json({
        success: true,
        transfer: {
          ...order,
          public_token: token,
          lines: insertedLines || [],
          driver_url: driverUrlFor(token, request),
        },
      });
    }

    // ── ACTIONS ON EXISTING ORDER ───────────────────────────────────────────
    const orderId = Number(body.id);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ error: 'id required for this action' }, { status: 400 });
    }

    const { data: order, error: oErr } = await supabase
      .from('stock_transfer_orders')
      .select('*')
      .eq('id', orderId)
      .eq('profile_id', companyId)
      .maybeSingle();

    if (oErr || !order) {
      return NextResponse.json({ error: oErr?.message || 'Transfer not found' }, { status: 404 });
    }

    const { data: lines } = await supabase
      .from('stock_transfer_lines')
      .select('*')
      .eq('transfer_id', orderId);

    // ── SHIP ────────────────────────────────────────────────────────────────
    if (action === 'ship') {
      if (!['draft', 'shipped'].includes(String(order.status))) {
        return NextResponse.json(
          { error: `Cannot ship from status "${order.status}"` },
          { status: 409 }
        );
      }
      if (order.status === 'shipped' || order.status === 'in_transit') {
        return NextResponse.json({ error: 'Already shipped' }, { status: 409 });
      }

      const fromId = Number(order.from_warehouse_id);
      const shipLines = (body.lines as LineInput[] | undefined) || lines || [];

      // QA release gate — block ship when lots have open/failed inspections
      if (!body.overrideQaHold) {
        const lotNums = shipLines.map(
          (l) =>
            l.lot_number ||
            (lines || []).find((x) => x.id === (l as { id?: number }).id)?.lot_number
        );
        const qa = await hasQaHold(companyId, lotNums);
        if (qa.blocked) {
          const lots = [...new Set(qa.holds.map((h) => h.lot_number))];
          void import('@/lib/notifications/email-alerts').then(
            ({ notifyShipBlockedByQa }) =>
              notifyShipBlockedByQa({
                profileId: companyId,
                lots,
                transferId: order?.id ?? null,
              })
          );
          void import('@/lib/audit/log').then(({ auditLog }) =>
            auditLog({
              companyId,
              action: 'qa.hold.ship_blocked',
              entityType: 'transfer_order',
              entityId: order?.id,
              summary: `Ship blocked by QA hold on lot(s) ${lots.join(', ')}`,
              metadata: { holds: qa.holds },
            })
          );
          return NextResponse.json(qaHoldErrorPayload(qa.holds), { status: 409 });
        }
      }

      for (const l of shipLines) {
        const lineId = (l as { id?: number }).id;
        const existing = (lines || []).find((x) => x.id === lineId) || l;
        const productId = Number(existing.product_id || l.product_id);
        const qty = Math.abs(
          Number(
            l.qty_shipped != null
              ? l.qty_shipped
              : existing.qty_requested || l.qty_requested || 0
          )
        );
        if (!productId || qty <= 0) continue;

        const stock = await getStockQty(supabase, companyId, productId, fromId);
        const onHand = Number(stock?.qty_on_hand || 0);
        if (onHand + 0.0001 < qty && !body.allowNegative) {
          return NextResponse.json(
            {
              error: `Insufficient stock for product #${productId} at source (have ${onHand}, need ${qty})`,
              product_id: productId,
              available: onHand,
              needed: qty,
            },
            { status: 409 }
          );
        }

        await setStockQty(supabase, companyId, productId, fromId, onHand - qty, now);

        if (lineId) {
          await supabase
            .from('stock_transfer_lines')
            .update({ qty_shipped: qty, updated_at: now })
            .eq('id', lineId);
        }

        const shipHash = hashMovement({
          profileId: companyId,
          productId,
          movementType: 'transfer_ship',
          quantity: qty,
          at: now,
          reference: order.transfer_number,
        });

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
          notes: body.ship_notes || `Shipped ${order.transfer_number}`,
          lot_number: (existing as { lot_number?: string }).lot_number || null,
          onchain_hash: shipHash,
          created_at: now,
        });
      }

      const shipHash = hashMovement({
        profileId: companyId,
        productId: order.id,
        movementType: 'transfer_ship_header',
        quantity: (lines || []).length,
        at: now,
        reference: order.transfer_number,
      });

      // Re-snapshot physical collection/destination from warehouse GPS if not set
      const whSnap = await loadWarehouses(supabase, [
        Number(order.from_warehouse_id),
        Number(order.to_warehouse_id),
      ]);
      const fromSnap = physicalEndpoint(whSnap[Number(order.from_warehouse_id)]);
      const toSnap = physicalEndpoint(whSnap[Number(order.to_warehouse_id)]);

      const { data: updated, error: uErr } = await supabase
        .from('stock_transfer_orders')
        .update({
          status: 'in_transit',
          shipped_at: now,
          carrier: body.carrier !== undefined ? body.carrier : order.carrier,
          tracking_ref: body.tracking_ref !== undefined ? body.tracking_ref : order.tracking_ref,
          ship_notes: body.ship_notes || order.ship_notes,
          onchain_hash: shipHash,
          from_lat: order.from_lat ?? fromSnap.lat,
          from_lng: order.from_lng ?? fromSnap.lng,
          to_lat: order.to_lat ?? toSnap.lat,
          to_lng: order.to_lng ?? toSnap.lng,
          from_address: order.from_address || fromSnap.address,
          to_address: order.to_address || toSnap.address,
          updated_at: now,
        })
        .eq('id', orderId)
        .select('*')
        .single();

      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
      const transfer = await enrichOrder(supabase, updated);
      return NextResponse.json({ success: true, transfer, action: 'ship' });
    }

    // ── RECEIVE ─────────────────────────────────────────────────────────────
    if (action === 'receive') {
      if (!['in_transit', 'shipped', 'partially_received'].includes(String(order.status))) {
        return NextResponse.json(
          { error: `Cannot receive from status "${order.status}" — ship first` },
          { status: 409 }
        );
      }

      const toId = Number(order.to_warehouse_id);
      const receiveInputs = (body.lines as LineInput[] | undefined) || [];

      for (const existing of lines || []) {
        const override = receiveInputs.find(
          (r) => Number((r as { id?: number }).id) === existing.id || Number(r.product_id) === existing.product_id
        );
        const already = Number(existing.qty_received || 0);
        const shipped = Number(existing.qty_shipped || existing.qty_requested || 0);
        const remaining = Math.max(0, shipped - already);
        const qty =
          override?.qty_received != null
            ? Math.abs(Number(override.qty_received))
            : remaining;
        if (qty <= 0) continue;

        const productId = Number(existing.product_id);
        const stock = await getStockQty(supabase, companyId, productId, toId);
        const onHand = Number(stock?.qty_on_hand || 0);
        await setStockQty(supabase, companyId, productId, toId, onHand + qty, now);

        const newReceived = already + qty;
        await supabase
          .from('stock_transfer_lines')
          .update({ qty_received: newReceived, updated_at: now })
          .eq('id', existing.id);

        const recvHash = hashMovement({
          profileId: companyId,
          productId,
          movementType: 'transfer_receive',
          quantity: qty,
          at: now,
          reference: order.transfer_number,
        });

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
          notes: body.receive_notes || `Received ${order.transfer_number}`,
          lot_number: existing.lot_number || null,
          onchain_hash: recvHash,
          created_at: now,
        });
      }

      const { data: refreshedLines } = await supabase
        .from('stock_transfer_lines')
        .select('*')
        .eq('transfer_id', orderId);

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

      const { data: updated, error: uErr } = await supabase
        .from('stock_transfer_orders')
        .update({
          status: nextStatus,
          received_at: fullyReceived ? now : order.received_at || (anyReceived ? now : null),
          receive_notes: body.receive_notes || order.receive_notes,
          updated_at: now,
        })
        .eq('id', orderId)
        .select('*')
        .single();

      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
      const transfer = await enrichOrder(supabase, updated);
      return NextResponse.json({ success: true, transfer, action: 'receive' });
    }

    // ── CANCEL ──────────────────────────────────────────────────────────────
    if (action === 'cancel') {
      if (['received', 'cancelled'].includes(String(order.status))) {
        return NextResponse.json(
          { error: `Cannot cancel status "${order.status}"` },
          { status: 409 }
        );
      }

      // If already shipped, restock source with unreceived shipped qty
      if (['in_transit', 'shipped', 'partially_received'].includes(String(order.status))) {
        const fromId = Number(order.from_warehouse_id);
        for (const l of lines || []) {
          const shipped = Number(l.qty_shipped || 0);
          const received = Number(l.qty_received || 0);
          const restock = Math.max(0, shipped - received);
          if (restock <= 0) continue;
          const productId = Number(l.product_id);
          const stock = await getStockQty(supabase, companyId, productId, fromId);
          const onHand = Number(stock?.qty_on_hand || 0);
          await setStockQty(supabase, companyId, productId, fromId, onHand + restock, now);

          await supabase.from('stock_movements').insert({
            profile_id: companyId,
            product_id: productId,
            warehouse_id: fromId,
            movement_type: 'transfer_cancel',
            quantity: restock,
            reference_type: 'stock_transfer_order',
            reference_id: String(order.id),
            notes: `Cancel restock ${order.transfer_number}`,
            onchain_hash: hashMovement({
              profileId: companyId,
              productId,
              movementType: 'transfer_cancel',
              quantity: restock,
              at: now,
              reference: order.transfer_number,
            }),
            created_at: now,
          });
        }
      }

      const { data: updated, error: uErr } = await supabase
        .from('stock_transfer_orders')
        .update({
          status: 'cancelled',
          cancelled_at: now,
          notes: body.notes || order.notes,
          updated_at: now,
        })
        .eq('id', orderId)
        .select('*')
        .single();

      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
      const transfer = await enrichOrder(supabase, updated);
      return NextResponse.json({ success: true, transfer, action: 'cancel' });
    }

    return NextResponse.json(
      { error: `Unknown action "${action}". Use create | ship | receive | cancel` },
      { status: 400 }
    );
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
