import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { formatCo2e } from '@/lib/sustainability/carbon';
import { MIGRATION_HINT, daysUntil } from '@/lib/sustainability/types';

/** Hub telemetry: one round-trip for sustainability overview. */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const [
      emissionsRes,
      targetsRes,
      resourcesRes,
      certsRes,
      initiativesRes,
      materialityRes,
    ] = await Promise.all([
      supabase
        .from('esg_emissions')
        .select('scope, amount_kgco2e')
        .eq('profile_id', companyId),
      supabase
        .from('esg_targets')
        .select('id, status')
        .eq('profile_id', companyId),
      supabase
        .from('esg_resources')
        .select('resource_type, category, amount')
        .eq('profile_id', companyId),
      supabase
        .from('sustainability_certificates')
        .select('id, status, expires_at')
        .eq('profile_id', companyId),
      supabase
        .from('esg_initiatives')
        .select('id, status, progress')
        .eq('profile_id', companyId),
      supabase
        .from('esg_materiality')
        .select('id, priority')
        .eq('profile_id', companyId),
    ]);

    const warnings: string[] = [];
    for (const r of [
      emissionsRes,
      targetsRes,
      resourcesRes,
      certsRes,
      initiativesRes,
      materialityRes,
    ]) {
      if (r.error) warnings.push(r.error.message);
    }

    const byScope = { '1': 0, '2': 0, '3': 0 };
    for (const e of emissionsRes.data || []) {
      const sc = String(e.scope || '3') as '1' | '2' | '3';
      if (sc in byScope) byScope[sc] += Number(e.amount_kgco2e) || 0;
    }
    const totalKg = byScope['1'] + byScope['2'] + byScope['3'];

    let water = 0,
      landfill = 0,
      recycled = 0,
      energy = 0,
      renewable = 0;
    for (const r of resourcesRes.data || []) {
      const amt = Number(r.amount) || 0;
      if (r.resource_type === 'water' && r.category === 'withdrawal') water += amt;
      if (r.resource_type === 'waste' && r.category === 'landfill') landfill += amt;
      if (r.resource_type === 'waste' && r.category === 'recycled_waste') recycled += amt;
      if (r.resource_type === 'energy') {
        if (r.category === 'renewable') renewable += amt;
        else energy += amt;
      }
    }
    const wasteTotal = landfill + recycled;
    const diversion =
      wasteTotal > 0 ? Math.round((recycled / wasteTotal) * 1000) / 10 : null;
    const renewable_pct =
      energy + renewable > 0
        ? Math.round((renewable / (energy + renewable)) * 1000) / 10
        : null;

    const certs = certsRes.data || [];
    const expiring = certs.filter((c) => {
      const d = daysUntil(c.expires_at);
      return d != null && d >= 0 && d <= 90;
    }).length;

    const initiatives = initiativesRes.data || [];
    const targets = targetsRes.data || [];
    const topics = materialityRes.data || [];

    return NextResponse.json({
      success: true,
      inventory: {
        by_scope: byScope,
        total_kg: Math.round(totalKg * 100) / 100,
        total_label: formatCo2e(totalKg),
        entry_count: (emissionsRes.data || []).length,
      },
      targets: {
        total: targets.length,
        active: targets.filter((t) => t.status === 'active').length,
      },
      resources: {
        water_withdrawal: water,
        landfill,
        diversion_pct: diversion,
        renewable_pct,
      },
      certificates: {
        total: certs.length,
        expiring_soon: expiring,
      },
      initiatives: {
        total: initiatives.length,
        in_progress: initiatives.filter((i) => i.status === 'in_progress').length,
        completed: initiatives.filter((i) => i.status === 'completed').length,
      },
      materiality: {
        total: topics.length,
        critical: topics.filter((t) => t.priority === 'critical').length,
      },
      warning: warnings.length ? warnings[0] : null,
      hint: warnings.length ? MIGRATION_HINT : undefined,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
