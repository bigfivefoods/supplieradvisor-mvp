import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { MIGRATION_HINT, targetProgressPct } from '@/lib/sustainability/types';

async function currentMetricValue(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  metric: string
): Promise<number | null> {
  if (metric.startsWith('ghg') || metric === 'ghg_total') {
    const { data } = await supabase
      .from('esg_emissions')
      .select('scope, amount_kgco2e')
      .eq('profile_id', companyId);
    let s1 = 0,
      s2 = 0,
      s3 = 0;
    for (const e of data || []) {
      const kg = Number(e.amount_kgco2e) || 0;
      if (e.scope === '1') s1 += kg;
      else if (e.scope === '2') s2 += kg;
      else s3 += kg;
    }
    const tonnes = (kg: number) => kg / 1000;
    if (metric === 'ghg_scope1') return tonnes(s1);
    if (metric === 'ghg_scope2') return tonnes(s2);
    if (metric === 'ghg_scope3') return tonnes(s3);
    return tonnes(s1 + s2 + s3);
  }
  if (metric === 'water' || metric === 'waste' || metric === 'energy') {
    const type = metric === 'water' ? 'water' : metric === 'waste' ? 'waste' : 'energy';
    const { data } = await supabase
      .from('esg_resources')
      .select('amount, category, resource_type')
      .eq('profile_id', companyId)
      .eq('resource_type', type);
    let sum = 0;
    for (const r of data || []) {
      if (metric === 'water' && r.category === 'withdrawal') sum += Number(r.amount) || 0;
      else if (metric === 'waste' && r.category === 'landfill') sum += Number(r.amount) || 0;
      else if (metric === 'energy' && ['electricity', 'fuel', 'gas'].includes(String(r.category)))
        sum += Number(r.amount) || 0;
    }
    if (metric === 'energy') return Math.round((sum / 1000) * 100) / 100; // kWh → MWh
    return Math.round(sum * 100) / 100;
  }
  if (metric === 'renewable_pct') {
    const { data } = await supabase
      .from('esg_resources')
      .select('amount, category')
      .eq('profile_id', companyId)
      .eq('resource_type', 'energy');
    let elec = 0,
      ren = 0;
    for (const r of data || []) {
      if (r.category === 'electricity') elec += Number(r.amount) || 0;
      if (r.category === 'renewable') ren += Number(r.amount) || 0;
    }
    const total = elec + ren;
    if (total <= 0) return null;
    return Math.round((ren / total) * 1000) / 10;
  }
  return null;
}

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
    const { data, error } = await supabase
      .from('esg_targets')
      .select('*')
      .eq('profile_id', companyId)
      .order('target_year', { ascending: true });

    if (error) {
      return NextResponse.json({
        success: true,
        targets: [],
        warning: error.message,
        hint: MIGRATION_HINT,
      });
    }

    const targets = [];
    for (const t of data || []) {
      const current = await currentMetricValue(supabase, companyId, String(t.metric));
      const progress = targetProgressPct({
        baseline: t.baseline_value != null ? Number(t.baseline_value) : null,
        target: t.target_value != null ? Number(t.target_value) : null,
        current,
      });
      targets.push({ ...t, current_value: current, progress_pct: progress });
    }

    return NextResponse.json({
      success: true,
      targets,
      summary: {
        total: targets.length,
        active: targets.filter((t) => t.status === 'active').length,
        achieved: targets.filter((t) => t.status === 'achieved').length,
      },
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
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!String(body.name || '').trim()) {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }

    let reduction_pct = body.reduction_pct != null ? Number(body.reduction_pct) : null;
    if (
      reduction_pct == null &&
      body.baseline_value != null &&
      body.target_value != null &&
      Number(body.baseline_value) !== 0
    ) {
      reduction_pct =
        Math.round(
          ((Number(body.baseline_value) - Number(body.target_value)) /
            Number(body.baseline_value)) *
            1000
        ) / 10;
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('esg_targets')
      .insert({
        profile_id: companyId,
        name: String(body.name).trim(),
        metric: body.metric || 'ghg_total',
        unit: body.unit || 'tCO2e',
        baseline_year: body.baseline_year != null ? Number(body.baseline_year) : null,
        baseline_value:
          body.baseline_value != null ? Number(body.baseline_value) : null,
        target_year: body.target_year != null ? Number(body.target_year) : null,
        target_value: body.target_value != null ? Number(body.target_value) : null,
        reduction_pct,
        pathway: body.pathway || 'absolute',
        status: body.status || 'active',
        framework: body.framework || 'internal',
        notes: body.notes || null,
        created_by: mem.userId,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: MIGRATION_HINT },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: true, target: data }, { status: 201 });
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
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of [
      'name',
      'metric',
      'unit',
      'baseline_year',
      'baseline_value',
      'target_year',
      'target_value',
      'reduction_pct',
      'pathway',
      'status',
      'framework',
      'notes',
      'metadata',
    ]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('esg_targets')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, target: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
