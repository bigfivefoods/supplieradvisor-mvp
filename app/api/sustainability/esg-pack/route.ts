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
 * Build a downloadable ESG / sustainability pack from live ops data.
 * POST optional: snapshot pack to esg_report_snapshots
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const privyUserId = sp.get('privyUserId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertCompanyMember(privyUserId, companyId);
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    const now = new Date();
    const periodEnd = now.toISOString().slice(0, 10);
    const periodStart = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);

    const [
      profileRes,
      shipsRes,
      suppliersRes,
      inspRes,
      haccpRes,
      connectionsRes,
      productsRes,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id, trading_name, legal_name, country, city, industry, verification_status, trust_score, primary_currency'
        )
        .eq('id', companyId)
        .maybeSingle(),
      supabase
        .from('shipments')
        .select('*')
        .eq('profile_id', companyId)
        .gte('created_at', periodStart)
        .limit(200),
      supabase
        .from('srm_suppliers')
        .select('id, trading_name, otifef_pct, trust_score, verified, status')
        .eq('profile_id', companyId)
        .limit(200),
      supabase
        .from('quality_inspections')
        .select('id, status, lot_number, defects_found, created_at')
        .eq('profile_id', companyId)
        .gte('created_at', periodStart)
        .limit(200),
      supabase
        .from('haccp_plans')
        .select('id, name, status, product_scope')
        .eq('profile_id', companyId)
        .limit(50),
      supabase
        .from('business_connections')
        .select('id, status')
        .or(`requester_profile_id.eq.${companyId},requestee_profile_id.eq.${companyId}`)
        .eq('status', 'accepted')
        .limit(500),
      supabase
        .from('products')
        .select('id, onchain_status')
        .eq('profile_id', companyId)
        .limit(500),
    ]);

    const profile = profileRes.data;
    const ships = shipsRes.data || [];
    let totalCo2 = 0;
    const byMode: Record<string, number> = {};
    for (const s of ships) {
      const est = estimateShipmentCo2e({
        mode: s.mode,
        distanceKm: s.distance_km != null ? Number(s.distance_km) : null,
        weightTonnes:
          s.weight_tonnes != null
            ? Number(s.weight_tonnes)
            : s.weight_kg != null
              ? Number(s.weight_kg) / 1000
              : null,
        originLat: s.origin_lat != null ? Number(s.origin_lat) : null,
        originLng: s.origin_lng != null ? Number(s.origin_lng) : null,
        destLat: s.dest_lat != null ? Number(s.dest_lat) : null,
        destLng: s.dest_lng != null ? Number(s.dest_lng) : null,
      });
      totalCo2 += est.kgCo2e;
      byMode[est.mode] = (byMode[est.mode] || 0) + est.kgCo2e;
    }

    const suppliers = suppliersRes.data || [];
    const otifefVals = suppliers
      .map((s) => Number(s.otifef_pct))
      .filter((n) => Number.isFinite(n));
    const avgOtifef = otifefVals.length
      ? otifefVals.reduce((a, b) => a + b, 0) / otifefVals.length
      : null;
    const verifiedSuppliers = suppliers.filter((s) => s.verified).length;

    const inspections = inspRes.data || [];
    const inspPassed = inspections.filter((i) => i.status === 'passed').length;
    const inspFailed = inspections.filter((i) => i.status === 'failed').length;
    const inspOpen = inspections.filter((i) => i.status === 'open').length;

    const products = productsRes.data || [];
    const minted = products.filter((p) => p.onchain_status === 'minted').length;

    const pack = {
      schema_version: '1.0',
      generated_at: now.toISOString(),
      period: { start: periodStart, end: periodEnd, days: 90 },
      company: {
        id: companyId,
        name: profile?.trading_name || profile?.legal_name || `Company ${companyId}`,
        country: profile?.country,
        city: profile?.city,
        industry: profile?.industry,
        verification_status: profile?.verification_status,
        trust_score: profile?.trust_score,
      },
      environment: {
        method: 'mode_factor_x_distance_x_weight',
        disclaimer:
          'Estimates only — not a certified GHG inventory. Factors are order-of-magnitude operational defaults.',
        factors_kg_per_tkm: MODE_FACTORS_KG_PER_TKM,
        total_kg_co2e: Math.round(totalCo2 * 100) / 100,
        total_label: formatCo2e(totalCo2),
        by_mode: byMode,
        shipment_count: ships.length,
      },
      social: {
        network_connections: connectionsRes.data?.length ?? 0,
        suppliers_total: suppliers.length,
        suppliers_verified: verifiedSuppliers,
        avg_otifef_pct: avgOtifef != null ? Math.round(avgOtifef * 10) / 10 : null,
        quality_inspections: {
          total: inspections.length,
          passed: inspPassed,
          failed: inspFailed,
          open: inspOpen,
          pass_rate:
            inspections.length > 0
              ? Math.round((inspPassed / inspections.length) * 1000) / 10
              : null,
        },
      },
      governance: {
        haccp_plans: (haccpRes.data || []).length,
        haccp_approved: (haccpRes.data || []).filter((p) => p.status === 'approved').length,
        products_onchain_minted: minted,
        products_total: products.length,
      },
      narrative: {
        headline: `${profile?.trading_name || 'Company'} — 90-day ESG operating pack`,
        bullets: [
          `Estimated logistics CO₂e: ${formatCo2e(totalCo2)} across ${ships.length} shipments`,
          `Supplier book: ${suppliers.length} (${verifiedSuppliers} verified)${
            avgOtifef != null ? `, avg OTIFEF ${avgOtifef.toFixed(1)}%` : ''
          }`,
          `Quality: ${inspPassed} passed / ${inspFailed} failed / ${inspOpen} open inspections`,
          `HACCP plans on file: ${(haccpRes.data || []).length}`,
        ],
      },
    };

    return NextResponse.json({
      success: true,
      pack,
      download_name: `esg-pack-${companyId}-${periodEnd}.json`,
    });
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
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });

    // Rebuild pack via internal GET logic — call same assembly by reusing GET
    const url = new URL(request.url);
    url.searchParams.set('companyId', String(companyId));
    url.searchParams.set('privyUserId', String(body.privyUserId || ''));
    const fakeReq = new NextRequest(url);
    const res = await GET(fakeReq);
    const json = await res.json();
    if (!json.success) return NextResponse.json(json, { status: 500 });

    const supabase = getSupabaseServer();
    const pack = json.pack;
    const { data, error } = await supabase
      .from('esg_report_snapshots')
      .insert({
        profile_id: companyId,
        period_start: pack.period?.start,
        period_end: pack.period?.end,
        pack,
        created_by: mem.userId,
      })
      .select('id, created_at')
      .single();

    if (error) {
      return NextResponse.json({
        success: true,
        pack,
        snapshot: null,
        warning: error.message,
      });
    }

    return NextResponse.json({ success: true, pack, snapshot: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
