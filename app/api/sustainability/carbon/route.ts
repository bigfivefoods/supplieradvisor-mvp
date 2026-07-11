import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import {
  estimateShipmentCo2e,
  formatCo2e,
  MODE_FACTORS_KG_PER_TKM,
} from '@/lib/sustainability/carbon';

/**
 * GET ?companyId=&privyUserId=
 * Estimate CO2e from recent shipments (ops awareness, not formal GHG inventory).
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const privyUserId = sp.get('privyUserId');
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertCompanyMember(privyUserId, companyId);
      if (!mem.ok) {
        return NextResponse.json({ error: mem.error }, { status: mem.status });
      }
    }

    const supabase = getSupabaseServer();
    const { data: ships, error } = await supabase
      .from('shipments')
      .select(
        'id, shipment_number, mode, status, direction, origin_lat, origin_lng, dest_lat, dest_lng, destination_lat, destination_lng, weight_tonnes, weight_kg, distance_km, created_at, delivered_at'
      )
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({
        success: true,
        total_kg_co2e: 0,
        shipments: [],
        by_mode: {},
        factors: MODE_FACTORS_KG_PER_TKM,
        warning: error.message,
        note: 'Estimates only — not for regulatory disclosure',
      });
    }

    const byMode: Record<string, number> = {};
    let total = 0;
    const rows = (ships || []).map((s) => {
      const weightTonnes =
        s.weight_tonnes != null
          ? Number(s.weight_tonnes)
          : s.weight_kg != null
            ? Number(s.weight_kg) / 1000
            : null;
      const est = estimateShipmentCo2e({
        mode: s.mode,
        distanceKm: s.distance_km != null ? Number(s.distance_km) : null,
        weightTonnes,
        originLat: s.origin_lat != null ? Number(s.origin_lat) : null,
        originLng: s.origin_lng != null ? Number(s.origin_lng) : null,
        destLat:
          s.dest_lat != null
            ? Number(s.dest_lat)
            : s.destination_lat != null
              ? Number(s.destination_lat)
              : null,
        destLng:
          s.dest_lng != null
            ? Number(s.dest_lng)
            : s.destination_lng != null
              ? Number(s.destination_lng)
              : null,
      });
      total += est.kgCo2e;
      byMode[est.mode] = (byMode[est.mode] || 0) + est.kgCo2e;
      return {
        id: s.id,
        shipment_number: s.shipment_number,
        status: s.status,
        direction: s.direction,
        ...est,
        label: formatCo2e(est.kgCo2e),
      };
    });

    return NextResponse.json({
      success: true,
      total_kg_co2e: Math.round(total * 100) / 100,
      total_label: formatCo2e(total),
      shipment_count: rows.length,
      by_mode: byMode,
      factors: MODE_FACTORS_KG_PER_TKM,
      shipments: rows,
      note: 'Order-of-magnitude estimates from mode × distance × weight. Not a certified GHG inventory.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
