import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  computeTransferEta,
  resolvePoint,
  speedFromTrail,
  type LatLng,
} from '@/lib/inventory/eta';

/**
 * GET ?companyId= — live open transfers with GPS position + ETA to destination
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const asOf = new Date().toISOString();

    const { data: orders, error } = await supabase
      .from('stock_transfer_orders')
      .select('*')
      .eq('profile_id', companyId)
      .in('status', ['draft', 'shipped', 'in_transit', 'partially_received'])
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({
        success: true,
        asOf,
        moving: [],
        upcoming: [],
        summary: { moving: 0, upcoming: 0, delayed: 0 },
        warning: error.message,
        hint: 'Run 20260709_transfer_orders_and_driver_COMPLETE.sql',
      });
    }

    const list = orders || [];
    const whIds = [
      ...new Set(
        list
          .flatMap((o) => [o.from_warehouse_id, o.to_warehouse_id])
          .filter(Boolean)
          .map(Number)
      ),
    ];

    const { data: warehouses } = whIds.length
      ? await supabase
          .from('warehouses')
          .select('id, name, city, country, lat, lng, address, owner_type, partner_name')
          .in('id', whIds)
      : { data: [] as Record<string, unknown>[] };

    const wMap = Object.fromEntries((warehouses || []).map((w) => [w.id, w]));

    const transferIds = list.map((o) => o.id);
    let lineMap: Record<number, Record<string, unknown>[]> = {};
    let eventMap: Record<number, Array<Record<string, unknown>>> = {};

    if (transferIds.length) {
      const [{ data: lines }, { data: events }] = await Promise.all([
        supabase
          .from('stock_transfer_lines')
          .select('id, transfer_id, product_name, sku, qty_requested, qty_shipped, qty_received')
          .in('transfer_id', transferIds),
        supabase
          .from('stock_transfer_events')
          .select('id, transfer_id, event_type, lat, lng, created_at, actor_name, notes')
          .in('transfer_id', transferIds)
          .order('created_at', { ascending: true })
          .limit(2000),
      ]);
      for (const l of lines || []) {
        const tid = Number(l.transfer_id);
        if (!lineMap[tid]) lineMap[tid] = [];
        lineMap[tid].push(l);
      }
      for (const e of events || []) {
        const tid = Number(e.transfer_id);
        if (!eventMap[tid]) eventMap[tid] = [];
        eventMap[tid].push(e);
      }
    }

    const appBase = (
      process.env.NEXT_PUBLIC_APP_URL ||
      request.nextUrl.origin ||
      'https://www.supplieradvisor.com'
    ).replace(/\/$/, '');

    const enriched = list.map((o) => {
      const fromWh = o.from_warehouse_id ? wMap[o.from_warehouse_id] : null;
      const toWh = o.to_warehouse_id ? wMap[o.to_warehouse_id] : null;

      const origin = resolvePoint({
        lat: fromWh?.lat,
        lng: fromWh?.lng,
        city: fromWh?.city,
        country: fromWh?.country,
      });
      // Prefer pickup scan as origin if available
      const originGps: LatLng | null =
        o.pickup_lat != null && o.pickup_lng != null
          ? { lat: Number(o.pickup_lat), lng: Number(o.pickup_lng) }
          : origin;

      const dest = resolvePoint({
        lat: toWh?.lat,
        lng: toWh?.lng,
        city: toWh?.city,
        country: toWh?.country,
      });

      const current: LatLng | null =
        o.last_lat != null && o.last_lng != null
          ? { lat: Number(o.last_lat), lng: Number(o.last_lng) }
          : o.pickup_lat != null && o.pickup_lng != null
            ? { lat: Number(o.pickup_lat), lng: Number(o.pickup_lng) }
            : null;

      const trail = eventMap[o.id] || [];
      const gpsTrail = trail.filter(
        (e) =>
          e.lat != null &&
          e.lng != null &&
          ['location_ping', 'pickup_scan', 'en_route', 'dropoff_scan'].includes(
            String(e.event_type)
          )
      );
      const measuredSpeed = speedFromTrail(gpsTrail as Array<{ lat?: number; lng?: number; created_at?: string }>);

      const eta = computeTransferEta({
        current,
        dest,
        origin: originGps,
        speedKmh: measuredSpeed,
        expectedReceiveDate: o.expected_receive_date,
        shippedAt: o.shipped_at || o.pickup_scanned_at,
      });

      // Delayed if past expected receive and still open
      let delayed = false;
      if (o.expected_receive_date && ['in_transit', 'shipped', 'partially_received'].includes(String(o.status))) {
        const exp = new Date(o.expected_receive_date);
        if (String(o.expected_receive_date).length <= 10) exp.setHours(23, 59, 0, 0);
        delayed = exp.getTime() < Date.now();
      }

      const lines = lineMap[o.id] || [];
      const units = lines.reduce((s, l) => s + Number(l.qty_shipped || l.qty_requested || 0), 0);

      const isMoving = ['in_transit', 'shipped', 'partially_received'].includes(String(o.status));

      return {
        id: o.id,
        transfer_number: o.transfer_number,
        status: o.status,
        public_token: o.public_token,
        driver_url: o.public_token ? `${appBase}/t/${o.public_token}` : null,
        driver_name: o.driver_name,
        driver_phone: o.driver_phone,
        vehicle_reg: o.vehicle_reg,
        carrier: o.carrier,
        tracking_ref: o.tracking_ref,
        from_warehouse_id: o.from_warehouse_id,
        to_warehouse_id: o.to_warehouse_id,
        from_warehouse_name: o.from_warehouse_name || fromWh?.name || null,
        to_warehouse_name: o.to_warehouse_name || toWh?.name || null,
        from_city: fromWh?.city || null,
        to_city: toWh?.city || null,
        expected_receive_date: o.expected_receive_date,
        shipped_at: o.shipped_at,
        pickup_scanned_at: o.pickup_scanned_at,
        last_location_at: o.last_location_at,
        last_lat: o.last_lat,
        last_lng: o.last_lng,
        units,
        line_count: lines.length,
        lines: lines.slice(0, 8),
        is_moving: isMoving,
        delayed,
        eta,
        trail: gpsTrail.slice(-30).map((e) => ({
          lat: Number(e.lat),
          lng: Number(e.lng),
          at: e.created_at,
          type: e.event_type,
        })),
        updated_at: o.updated_at,
        created_at: o.created_at,
      };
    });

    const moving = enriched
      .filter((t) => t.is_moving)
      .sort((a, b) => {
        // soonest ETA first
        const am = a.eta.eta_minutes ?? 999999;
        const bm = b.eta.eta_minutes ?? 999999;
        return am - bm;
      });
    const upcoming = enriched.filter((t) => t.status === 'draft');
    const delayed = moving.filter((t) => t.delayed).length;

    return NextResponse.json({
      success: true,
      asOf,
      moving,
      upcoming,
      all: enriched,
      summary: {
        moving: moving.length,
        upcoming: upcoming.length,
        delayed,
        withGps: moving.filter((t) => t.last_lat != null).length,
        withEta: moving.filter((t) => t.eta.eta_at != null).length,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
