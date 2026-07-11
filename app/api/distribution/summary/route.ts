import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    const [shipRes, carRes, vehRes, drvRes, xferRes] = await Promise.all([
      supabase
        .from('shipments')
        .select('id, direction, status, mode, eta, delivered_at, progress_pct')
        .eq('profile_id', companyId),
      supabase.from('carriers').select('id, is_active, status').eq('profile_id', companyId),
      supabase.from('distribution_vehicles').select('id, status').eq('profile_id', companyId),
      supabase.from('distribution_drivers').select('id, status').eq('profile_id', companyId),
      supabase
        .from('stock_transfer_orders')
        .select('id, status')
        .eq('profile_id', companyId)
        .in('status', ['in_transit', 'shipped', 'dispatched', 'en_route']),
    ]);

    const warning =
      shipRes.error?.message ||
      carRes.error?.message ||
      vehRes.error?.message ||
      null;

    const ships = shipRes.data || [];
    const inbound = ships.filter((s) => s.direction === 'inbound');
    const outbound = ships.filter((s) => s.direction === 'outbound');
    const activeStatuses = [
      'booked',
      'picked_up',
      'in_transit',
      'at_hub',
      'customs',
      'out_for_delivery',
    ];
    const inMotion = ships.filter((s) => activeStatuses.includes(s.status));
    const exceptions = ships.filter((s) => s.status === 'exception');
    const delivered = ships.filter((s) => s.status === 'delivered');
    const planned = ships.filter((s) => s.status === 'planned' || s.status === 'booked');

    const carriers = carRes.data || [];
    const activeCarriers = carriers.filter(
      (c) => c.is_active !== false && (c.status == null || c.status === 'active')
    );

    const vehicles = vehRes.data || [];
    const drivers = drvRes.data || [];

    // On-time proxy: delivered with eta met (if we had ata) — count delivered / (delivered+exception)
    const otifDenom = delivered.length + exceptions.length;
    const otifPct =
      otifDenom > 0 ? Math.round((delivered.length / otifDenom) * 1000) / 10 : 100;

    const modeMix: Record<string, number> = {};
    for (const s of ships) {
      const m = s.mode || 'road';
      modeMix[m] = (modeMix[m] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      warning: warning || undefined,
      summary: {
        shipments: ships.length,
        inbound: inbound.length,
        outbound: outbound.length,
        inMotion: inMotion.length,
        planned: planned.length,
        exceptions: exceptions.length,
        delivered: delivered.length,
        carriers: carriers.length,
        carriersActive: activeCarriers.length,
        vehicles: vehicles.length,
        vehiclesAvailable: vehicles.filter((v) => v.status === 'available').length,
        drivers: drivers.length,
        driversAvailable: drivers.filter((d) => d.status === 'available').length,
        inventoryTransfersLive: (xferRes.data || []).length,
        otifPct,
        modeMix,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
