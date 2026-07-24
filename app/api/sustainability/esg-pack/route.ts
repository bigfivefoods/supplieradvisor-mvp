import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import {
  estimateShipmentCo2e,
  formatCo2e,
  MODE_FACTORS_KG_PER_TKM,
} from '@/lib/sustainability/carbon';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

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

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

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
      emissionsRes,
      targetsRes,
      resourcesRes,
      certsRes,
      initiativesRes,
      materialityRes,
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
      supabase
        .from('esg_emissions')
        .select('scope, category, amount_kgco2e')
        .eq('profile_id', companyId)
        .limit(500),
      supabase
        .from('esg_targets')
        .select('id, name, metric, status, baseline_value, target_value, target_year, reduction_pct')
        .eq('profile_id', companyId)
        .limit(50),
      supabase
        .from('esg_resources')
        .select('resource_type, category, amount, unit')
        .eq('profile_id', companyId)
        .limit(300),
      supabase
        .from('sustainability_certificates')
        .select('id, name, standard, status, expires_at, certificate_type')
        .eq('profile_id', companyId)
        .limit(100),
      supabase
        .from('esg_initiatives')
        .select('id, title, pillar, status, progress, sdg_goal')
        .eq('profile_id', companyId)
        .limit(100),
      supabase
        .from('esg_materiality')
        .select('topic, pillar, impact_score, financial_score, priority')
        .eq('profile_id', companyId)
        .limit(50),
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

    // Structured inventory (GHG Protocol)
    const invByScope = { '1': 0, '2': 0, '3': 0 };
    for (const e of emissionsRes.data || []) {
      const sc = String(e.scope || '3') as '1' | '2' | '3';
      if (sc in invByScope) invByScope[sc] += Number(e.amount_kgco2e) || 0;
    }
    const invTotal = invByScope['1'] + invByScope['2'] + invByScope['3'];

    let waterWithdraw = 0,
      landfill = 0,
      recycledWaste = 0,
      energyKwh = 0,
      renewableKwh = 0;
    for (const r of resourcesRes.data || []) {
      const amt = Number(r.amount) || 0;
      if (r.resource_type === 'water' && r.category === 'withdrawal') waterWithdraw += amt;
      if (r.resource_type === 'waste' && r.category === 'landfill') landfill += amt;
      if (r.resource_type === 'waste' && r.category === 'recycled_waste') recycledWaste += amt;
      if (r.resource_type === 'energy') {
        if (r.category === 'renewable') renewableKwh += amt;
        else energyKwh += amt;
      }
    }
    const wasteSum = landfill + recycledWaste;
    const diversionPct =
      wasteSum > 0 ? Math.round((recycledWaste / wasteSum) * 1000) / 10 : null;
    const renewablePct =
      energyKwh + renewableKwh > 0
        ? Math.round((renewableKwh / (energyKwh + renewableKwh)) * 1000) / 10
        : null;

    const targets = targetsRes.data || [];
    const certs = certsRes.data || [];
    const initiatives = initiativesRes.data || [];
    const materiality = materialityRes.data || [];

    const pack = {
      schema_version: '2.0',
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
        method: 'mode_factor_x_distance_x_weight + structured_inventory',
        disclaimer:
          'Estimates and operational inventory — not a certified GHG inventory or audit opinion. Factors are order-of-magnitude defaults unless overridden.',
        factors_kg_per_tkm: MODE_FACTORS_KG_PER_TKM,
        logistics_kg_co2e: Math.round(totalCo2 * 100) / 100,
        logistics_label: formatCo2e(totalCo2),
        by_mode: byMode,
        shipment_count: ships.length,
        inventory: {
          by_scope_kg: invByScope,
          total_kg: Math.round(invTotal * 100) / 100,
          total_label: formatCo2e(invTotal),
          combined_with_logistics_kg: Math.round((invTotal + totalCo2) * 100) / 100,
          combined_label: formatCo2e(invTotal + totalCo2),
          entry_count: (emissionsRes.data || []).length,
        },
        // Back-compat for UI expecting total_label
        total_kg_co2e: Math.round((invTotal + totalCo2) * 100) / 100,
        total_label: formatCo2e(invTotal + totalCo2),
        resources: {
          water_withdrawal_m3: waterWithdraw,
          waste_landfill_t: landfill,
          waste_recycled_t: recycledWaste,
          diversion_pct: diversionPct,
          energy_kwh: energyKwh + renewableKwh,
          renewable_pct: renewablePct,
        },
        targets: targets.map((t) => ({
          name: t.name,
          metric: t.metric,
          status: t.status,
          reduction_pct: t.reduction_pct,
          target_year: t.target_year,
        })),
        certificates: {
          total: certs.length,
          active: certs.filter((c) => c.status === 'active').length,
          items: certs.slice(0, 20).map((c) => ({
            name: c.name,
            standard: c.standard,
            expires_at: c.expires_at,
          })),
        },
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
        initiatives: initiatives.filter((i) => i.pillar === 'social').length,
      },
      governance: {
        haccp_plans: (haccpRes.data || []).length,
        haccp_approved: (haccpRes.data || []).filter((p) => p.status === 'approved').length,
        products_onchain_minted: minted,
        products_total: products.length,
        materiality_topics: materiality.length,
        materiality_critical: materiality.filter((t) => t.priority === 'critical').length,
        initiatives_total: initiatives.length,
        initiatives_in_progress: initiatives.filter((i) => i.status === 'in_progress').length,
      },
      materiality: materiality.map((t) => ({
        topic: t.topic,
        pillar: t.pillar,
        impact: t.impact_score,
        financial: t.financial_score,
        priority: t.priority,
      })),
      initiatives: initiatives.slice(0, 30).map((i) => ({
        title: i.title,
        pillar: i.pillar,
        status: i.status,
        progress: i.progress,
        sdg_goal: i.sdg_goal,
      })),
      narrative: {
        headline: `${profile?.trading_name || 'Company'} — ESG operating pack`,
        bullets: [
          `GHG inventory: ${formatCo2e(invTotal)} recorded · logistics estimate ${formatCo2e(totalCo2)} (${ships.length} shipments)`,
          `Resources: water withdrawal ${waterWithdraw} m³ · landfill ${landfill} t · diversion ${diversionPct ?? '—'}% · renewable ${renewablePct ?? '—'}%`,
          `Targets: ${targets.length} · Certificates: ${certs.length} · Initiatives: ${initiatives.length}`,
          `Supplier book: ${suppliers.length} (${verifiedSuppliers} verified)${
            avgOtifef != null ? `, avg OTIFEF ${avgOtifef.toFixed(1)}%` : ''
          }`,
          `Quality: ${inspPassed} passed / ${inspFailed} failed · HACCP plans: ${(haccpRes.data || []).length}`,
          `Materiality topics scored: ${materiality.length} (${materiality.filter((t) => t.priority === 'critical').length} critical)`,
        ],
      },
      frameworks_note:
        'Aligned conceptually with GHG Protocol scopes, double-materiality lite, and operational ESG disclosure. Not a formal GRI/ISSB/CSRD filing.',
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
