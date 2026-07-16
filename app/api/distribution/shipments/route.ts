import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  EVENT_PRESETS,
  nextShipmentNumber,
  progressForStatus,
  type ShipmentDirection,
} from '@/lib/distribution/types';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';
import { promptAfterShipmentDelivered } from '@/lib/ratings/create-prompt';

async function enrichShipments(
  supabase: ReturnType<typeof getSupabaseServer>,
  ships: Record<string, unknown>[]
) {
  const carrierIds = [
    ...new Set(ships.map((s) => Number(s.carrier_id)).filter(Boolean)),
  ];
  const vehicleIds = [
    ...new Set(ships.map((s) => Number(s.vehicle_id)).filter(Boolean)),
  ];
  const driverIds = [
    ...new Set(ships.map((s) => Number(s.driver_id)).filter(Boolean)),
  ];

  const [carriers, vehicles, drivers] = await Promise.all([
    carrierIds.length
      ? supabase.from('carriers').select('id, name, code').in('id', carrierIds)
      : Promise.resolve({ data: [] as { id: number; name: string; code?: string }[] }),
    vehicleIds.length
      ? supabase
          .from('distribution_vehicles')
          .select('id, code, name')
          .in('id', vehicleIds)
      : Promise.resolve({ data: [] as { id: number; code: string; name?: string }[] }),
    driverIds.length
      ? supabase
          .from('distribution_drivers')
          .select('id, code, full_name')
          .in('id', driverIds)
      : Promise.resolve({ data: [] as { id: number; code: string; full_name: string }[] }),
  ]);

  const cMap = Object.fromEntries((carriers.data || []).map((c) => [c.id, c]));
  const vMap = Object.fromEntries((vehicles.data || []).map((v) => [v.id, v]));
  const dMap = Object.fromEntries((drivers.data || []).map((d) => [d.id, d]));

  return ships.map((s) => ({
    ...s,
    carrier_name: s.carrier_id ? cMap[Number(s.carrier_id)]?.name : s.carrier,
    carrier_code: s.carrier_id ? cMap[Number(s.carrier_id)]?.code : null,
    vehicle_code: s.vehicle_id ? vMap[Number(s.vehicle_id)]?.code : null,
    driver_name: s.driver_id ? dMap[Number(s.driver_id)]?.full_name : null,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const direction = request.nextUrl.searchParams.get('direction');
    const status = request.nextUrl.searchParams.get('status');
    const id = request.nextUrl.searchParams.get('id');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    if (id) {
      const { data: ship, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('profile_id', companyId)
        .eq('id', Number(id))
        .maybeSingle();
      if (error) {
        return NextResponse.json({
          success: true,
          shipment: null,
          events: [],
          warning: error.message,
        });
      }
      const { data: events } = await supabase
        .from('distribution_shipment_events')
        .select('*')
        .eq('shipment_id', Number(id))
        .order('occurred_at', { ascending: false });
      const [enriched] = await enrichShipments(supabase, ship ? [ship] : []);
      return NextResponse.json({
        success: true,
        shipment: enriched || ship,
        events: events || [],
      });
    }

    let query = supabase
      .from('shipments')
      .select('*')
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false });

    if (direction === 'inbound' || direction === 'outbound') {
      query = query.eq('direction', direction);
    }
    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ success: true, shipments: [], warning: error.message });
    }

    const enriched = await enrichShipments(supabase, data || []);
    return NextResponse.json({ success: true, shipments: enriched });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();

    // Add tracking event
    if (body.action === 'event') {
      const shipmentId = Number(body.shipment_id || body.id);
      if (!Number.isFinite(shipmentId) || !body.label) {
        return NextResponse.json(
          { error: 'shipment_id and label required' },
          { status: 400 }
        );
      }
      const eventCode = body.event_code || 'note';
      const preset = EVENT_PRESETS.find((p) => p.code === eventCode);
      const label = body.label || preset?.label || 'Update';
      const occurred = body.occurred_at || new Date().toISOString();

      const { data: event, error } = await supabase
        .from('distribution_shipment_events')
        .insert({
          profile_id: companyId,
          shipment_id: shipmentId,
          event_code: eventCode,
          label,
          location: body.location || null,
          city: body.city || null,
          country: body.country || null,
          lat: body.lat != null ? Number(body.lat) : null,
          lng: body.lng != null ? Number(body.lng) : null,
          occurred_at: occurred,
          source: body.source || 'manual',
          notes: body.notes || null,
        })
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const nextStatus =
        body.status ||
        preset?.status ||
        (eventCode === 'delivered'
          ? 'delivered'
          : eventCode === 'exception'
            ? 'exception'
            : null);

      const shipUpdate: Record<string, unknown> = {
        last_event_at: occurred,
        last_event_label: label,
        updated_at: new Date().toISOString(),
      };
      if (nextStatus) {
        shipUpdate.status = nextStatus;
        shipUpdate.progress_pct = progressForStatus(nextStatus);
        if (nextStatus === 'delivered') {
          shipUpdate.delivered_at = occurred;
          shipUpdate.ata = occurred;
          shipUpdate.progress_pct = 100;
        }
        if (nextStatus === 'picked_up' || nextStatus === 'in_transit') {
          shipUpdate.shipped_at = body.shipped_at || occurred;
        }
      }

      const { data: shipment } = await supabase
        .from('shipments')
        .update(shipUpdate)
        .eq('id', shipmentId)
        .eq('profile_id', companyId)
        .select('*')
        .single();

      if (shipment && nextStatus === 'delivered') {
        void promptAfterShipmentDelivered({
          companyProfileId: companyId,
          shipment: shipment as Record<string, unknown>,
        }).catch(() => undefined);
      }

      return NextResponse.json({ success: true, event, shipment });
    }

    // Create shipment
    const direction = (body.direction || 'outbound') as ShipmentDirection;
    const { count } = await supabase
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId);

    const shipment_number =
      body.shipment_number || nextShipmentNumber((count || 0) + 1, direction);
    const status = body.status || 'planned';

    const origin =
      body.origin_name ||
      [body.origin_city, body.origin_country].filter(Boolean).join(', ') ||
      body.origin ||
      null;
    const destination =
      body.destination_name ||
      [body.destination_city, body.destination_country].filter(Boolean).join(', ') ||
      body.destination ||
      null;

    const payload = {
      profile_id: companyId,
      shipment_number,
      direction,
      status,
      mode: body.mode || 'road',
      service_level: body.service_level || 'standard',
      priority: Number(body.priority ?? 50),
      carrier_id: body.carrier_id ? Number(body.carrier_id) : null,
      carrier: body.carrier || null,
      vehicle_id: body.vehicle_id ? Number(body.vehicle_id) : null,
      driver_id: body.driver_id ? Number(body.driver_id) : null,
      tracking_number: body.tracking_number || null,
      origin,
      destination,
      origin_name: body.origin_name || origin,
      origin_city: body.origin_city || null,
      origin_country: body.origin_country || null,
      destination_name: body.destination_name || destination,
      destination_city: body.destination_city || null,
      destination_country: body.destination_country || null,
      incoterms: body.incoterms || null,
      eta: body.eta || null,
      weight_kg: body.weight_kg != null ? Number(body.weight_kg) : null,
      volume_cbm: body.volume_cbm != null ? Number(body.volume_cbm) : null,
      packages: body.packages != null ? Number(body.packages) : null,
      container_number: body.container_number || null,
      bol_number: body.bol_number || null,
      awb_number: body.awb_number || null,
      po_reference: body.po_reference || null,
      customer_ref: body.customer_ref || null,
      supplier_ref: body.supplier_ref || null,
      notes: body.notes || null,
      progress_pct: progressForStatus(status),
      reference_type: body.reference_type || null,
      reference_id: body.reference_id ? Number(body.reference_id) : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('shipments')
      .insert(payload)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Seed planned event
    await supabase.from('distribution_shipment_events').insert({
      profile_id: companyId,
      shipment_id: data.id,
      event_code: 'note',
      label: 'Shipment created',
      location: origin,
      occurred_at: new Date().toISOString(),
      source: 'system',
    });

    return NextResponse.json({ success: true, shipment: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const key of [
      'status',
      'mode',
      'service_level',
      'priority',
      'carrier_id',
      'carrier',
      'vehicle_id',
      'driver_id',
      'tracking_number',
      'origin',
      'destination',
      'origin_name',
      'origin_city',
      'origin_country',
      'destination_name',
      'destination_city',
      'destination_country',
      'incoterms',
      'eta',
      'shipped_at',
      'delivered_at',
      'ata',
      'weight_kg',
      'volume_cbm',
      'packages',
      'container_number',
      'bol_number',
      'awb_number',
      'po_reference',
      'customer_ref',
      'supplier_ref',
      'notes',
      'progress_pct',
    ]) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    if (body.status) {
      updates.progress_pct = body.progress_pct ?? progressForStatus(body.status);
      if (body.status === 'delivered' && !body.delivered_at) {
        updates.delivered_at = new Date().toISOString();
        updates.ata = new Date().toISOString();
      }
    }

    // Quick actions
    if (body.action === 'advance') {
      const chain = [
        'planned',
        'booked',
        'picked_up',
        'in_transit',
        'at_hub',
        'customs',
        'out_for_delivery',
        'delivered',
      ];
      const { data: cur } = await supabase
        .from('shipments')
        .select('status')
        .eq('id', id)
        .eq('profile_id', companyId)
        .maybeSingle();
      const idx = chain.indexOf(cur?.status || 'planned');
      const next = chain[Math.min(idx + 1, chain.length - 1)];
      updates.status = next;
      updates.progress_pct = progressForStatus(next);
      if (next === 'delivered') {
        updates.delivered_at = new Date().toISOString();
        updates.ata = new Date().toISOString();
      }
      if (['picked_up', 'in_transit'].includes(next)) {
        updates.shipped_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from('shipments')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (data && String(data.status || '').toLowerCase() === 'delivered') {
      void promptAfterShipmentDelivered({
        companyProfileId: companyId,
        shipment: data as Record<string, unknown>,
      }).catch(() => undefined);
    }

    return NextResponse.json({ success: true, shipment: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('shipments')
      .delete()
      .eq('id', id)
      .eq('profile_id', companyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
