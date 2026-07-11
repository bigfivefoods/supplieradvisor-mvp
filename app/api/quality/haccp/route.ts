import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';

/** HACCP plans, CCPs, monitoring logs */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const privyUserId = sp.get('privyUserId');
    const kind = sp.get('kind') || 'plans';
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertCompanyMember(privyUserId, companyId);
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();

    if (kind === 'logs') {
      const { data, error } = await supabase
        .from('haccp_monitoring_logs')
        .select('*')
        .eq('profile_id', companyId)
        .order('recorded_at', { ascending: false })
        .limit(200);
      if (error) {
        return NextResponse.json({
          success: true,
          logs: [],
          warning: error.message,
          migration: '20260711_haccp_esg_pm_suite.sql',
        });
      }
      return NextResponse.json({ success: true, logs: data || [] });
    }

    if (kind === 'ccps') {
      const planId = Number(sp.get('planId'));
      let q = supabase.from('haccp_ccps').select('*').eq('profile_id', companyId);
      if (Number.isFinite(planId) && planId > 0) q = q.eq('plan_id', planId);
      const { data, error } = await q.order('sort_order');
      if (error) {
        return NextResponse.json({ success: true, ccps: [], warning: error.message });
      }
      return NextResponse.json({ success: true, ccps: data || [] });
    }

    // plans + nested ccp counts
    const { data: plans, error } = await supabase
      .from('haccp_plans')
      .select('*')
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false });
    if (error) {
      return NextResponse.json({
        success: true,
        plans: [],
        warning: error.message,
        migration: '20260711_haccp_esg_pm_suite.sql',
      });
    }
    const ids = (plans || []).map((p) => p.id);
    let ccps: { plan_id: number; id: number }[] = [];
    if (ids.length) {
      const { data: c } = await supabase
        .from('haccp_ccps')
        .select('id, plan_id')
        .in('plan_id', ids);
      ccps = c || [];
    }
    const countMap = new Map<number, number>();
    for (const c of ccps) {
      countMap.set(c.plan_id, (countMap.get(c.plan_id) || 0) + 1);
    }
    return NextResponse.json({
      success: true,
      plans: (plans || []).map((p) => ({
        ...p,
        ccp_count: countMap.get(p.id) || 0,
      })),
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

    const supabase = getSupabaseServer();
    const action = body.action || 'plan';
    const now = new Date().toISOString();

    if (action === 'plan') {
      const { data, error } = await supabase
        .from('haccp_plans')
        .insert({
          profile_id: companyId,
          name: String(body.name || 'HACCP plan').trim(),
          product_scope: body.product_scope || null,
          process_step: body.process_step || null,
          status: body.status || 'draft',
          notes: body.notes || null,
          created_by: mem.userId,
          updated_at: now,
        })
        .select('*')
        .single();
      if (error) {
        return NextResponse.json(
          { error: error.message, migration: '20260711_haccp_esg_pm_suite.sql' },
          { status: 503 }
        );
      }
      return NextResponse.json({ success: true, plan: data }, { status: 201 });
    }

    if (action === 'ccp') {
      const planId = Number(body.plan_id);
      if (!Number.isFinite(planId)) {
        return NextResponse.json({ error: 'plan_id required' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('haccp_ccps')
        .insert({
          profile_id: companyId,
          plan_id: planId,
          code: String(body.code || 'CCP-1').trim(),
          name: String(body.name || 'Critical control point').trim(),
          hazard: body.hazard || null,
          control_measure: body.control_measure || null,
          critical_limit: body.critical_limit || null,
          monitoring_method: body.monitoring_method || null,
          corrective_action: body.corrective_action || null,
          frequency: body.frequency || null,
          sort_order: Number(body.sort_order) || 0,
          updated_at: now,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, ccp: data }, { status: 201 });
    }

    if (action === 'log') {
      const { data, error } = await supabase
        .from('haccp_monitoring_logs')
        .insert({
          profile_id: companyId,
          plan_id: body.plan_id != null ? Number(body.plan_id) : null,
          ccp_id: body.ccp_id != null ? Number(body.ccp_id) : null,
          lot_number: body.lot_number || null,
          measured_value: body.measured_value != null ? String(body.measured_value) : null,
          within_limit:
            body.within_limit === true || body.within_limit === false
              ? body.within_limit
              : body.result === 'ok',
          result: body.result || (body.within_limit === false ? 'breach' : 'ok'),
          operator_name: body.operator_name || null,
          notes: body.notes || null,
          recorded_at: body.recorded_at || now,
          created_by: mem.userId,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, log: data }, { status: 201 });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
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
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    const id = Number(body.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const entity = body.entity || 'plan';
    const table =
      entity === 'ccp' ? 'haccp_ccps' : entity === 'log' ? 'haccp_monitoring_logs' : 'haccp_plans';
    const allowed = [
      'name',
      'status',
      'notes',
      'product_scope',
      'process_step',
      'approved_by',
      'hazard',
      'control_measure',
      'critical_limit',
      'monitoring_method',
      'corrective_action',
      'frequency',
      'active',
      'result',
      'within_limit',
      'measured_value',
    ];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (body[k] !== undefined) updates[k] = body[k];
    }
    if (body.status === 'approved') {
      updates.approved_at = new Date().toISOString();
      updates.approved_by = mem.userId;
    }
    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, row: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
