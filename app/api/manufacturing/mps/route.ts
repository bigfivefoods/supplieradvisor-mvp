import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { nextOrderNumber, weekStarts } from '@/lib/manufacturing/types';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const planId = request.nextUrl.searchParams.get('planId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    if (planId) {
      const { data: plan, error } = await supabase
        .from('manufacturing_mps_plans')
        .select('*')
        .eq('profile_id', companyId)
        .eq('id', Number(planId))
        .maybeSingle();
      if (error) {
        return NextResponse.json({ success: true, plan: null, lines: [], warning: error.message });
      }
      const { data: lines } = await supabase
        .from('manufacturing_mps_lines')
        .select('*')
        .eq('plan_id', Number(planId))
        .order('week_start')
        .order('product_id');

      const productIds = [
        ...new Set((lines || []).map((l) => l.product_id).filter(Boolean)),
      ];
      let pMap: Record<number, { name: string; sku: string | null }> = {};
      if (productIds.length) {
        const { data: products } = await supabase
          .from('products')
          .select('id, name, sku')
          .in('id', productIds);
        pMap = Object.fromEntries(
          (products || []).map((p) => [p.id, { name: p.name, sku: p.sku }])
        );
      }

      return NextResponse.json({
        success: true,
        plan,
        lines: (lines || []).map((l) => ({
          ...l,
          product_name: l.product_id ? pMap[l.product_id]?.name : null,
          product_sku: l.product_id ? pMap[l.product_id]?.sku : null,
        })),
      });
    }

    const { data, error } = await supabase
      .from('manufacturing_mps_plans')
      .select('*')
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: true, plans: [], warning: error.message });
    }

    return NextResponse.json({ success: true, plans: data || [] });
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

    const supabase = getSupabaseServer();

    // Create plan
    if (body.action === 'create_plan' || !body.plan_id) {
      const horizon = Number(body.horizon_weeks ?? 12);
      const start = body.start_date || new Date().toISOString().slice(0, 10);
      const name =
        body.name ||
        `MPS ${new Date().toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}`;

      const { data: plan, error } = await supabase
        .from('manufacturing_mps_plans')
        .insert({
          profile_id: companyId,
          name,
          horizon_weeks: horizon,
          start_date: start,
          status: body.status || 'draft',
          notes: body.notes || null,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      // seed empty lines for finished goods if requested
      if (body.seed_products !== false) {
        const { data: products } = await supabase
          .from('products')
          .select('id')
          .eq('profile_id', companyId)
          .in('product_type', ['finished_good', 'finished', 'fg', 'kit']);

        const weeks = weekStarts(new Date(start), horizon);
        const productList = (products || []).slice(0, 40); // cap
        const rows: Record<string, unknown>[] = [];
        for (const p of productList) {
          for (const w of weeks) {
            rows.push({
              plan_id: plan.id,
              profile_id: companyId,
              product_id: p.id,
              week_start: w,
              forecast_qty: 0,
              firm_qty: 0,
              demand_qty: 0,
              supply_qty: 0,
              available_qty: 0,
            });
          }
        }
        // chunk insert
        for (let i = 0; i < rows.length; i += 200) {
          await supabase.from('manufacturing_mps_lines').insert(rows.slice(i, i + 200));
        }
      }

      return NextResponse.json({ success: true, plan });
    }

    // Upsert line
    if (body.action === 'upsert_line') {
      const planId = Number(body.plan_id);
      const productId = Number(body.product_id);
      const weekStart = body.week_start;
      if (!planId || !productId || !weekStart) {
        return NextResponse.json(
          { error: 'plan_id, product_id, week_start required' },
          { status: 400 }
        );
      }

      const forecast = Number(body.forecast_qty ?? 0);
      const firm = Number(body.firm_qty ?? 0);
      const demand = Number(body.demand_qty ?? forecast + firm);
      const supply = Number(body.supply_qty ?? 0);
      const available = Number(body.available_qty ?? supply - demand);

      const { data: existing } = await supabase
        .from('manufacturing_mps_lines')
        .select('id')
        .eq('plan_id', planId)
        .eq('product_id', productId)
        .eq('week_start', weekStart)
        .maybeSingle();

      if (existing?.id) {
        const { data, error } = await supabase
          .from('manufacturing_mps_lines')
          .update({
            forecast_qty: forecast,
            firm_qty: firm,
            demand_qty: demand,
            supply_qty: supply,
            available_qty: available,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('*')
          .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ success: true, line: data });
      }

      const { data, error } = await supabase
        .from('manufacturing_mps_lines')
        .insert({
          plan_id: planId,
          profile_id: companyId,
          product_id: productId,
          week_start: weekStart,
          forecast_qty: forecast,
          firm_qty: firm,
          demand_qty: demand,
          supply_qty: supply,
          available_qty: available,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, line: data });
    }

    // Firm MPS → generate production orders
    if (body.action === 'firm_to_orders') {
      const planId = Number(body.plan_id);
      const { data: lines } = await supabase
        .from('manufacturing_mps_lines')
        .select('*')
        .eq('plan_id', planId)
        .eq('profile_id', companyId)
        .gt('firm_qty', 0);

      const { count } = await supabase
        .from('manufacturing_production_orders')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId);

      let seq = (count || 0) + 1;
      const created: unknown[] = [];
      for (const line of lines || []) {
        const { data: bom } = await supabase
          .from('manufacturing_boms')
          .select('id')
          .eq('profile_id', companyId)
          .eq('product_id', line.product_id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        const { data: order } = await supabase
          .from('manufacturing_production_orders')
          .insert({
            profile_id: companyId,
            order_number: nextOrderNumber('WO', seq++),
            product_id: line.product_id,
            bom_id: bom?.id || null,
            qty_planned: line.firm_qty,
            status: 'planned',
            priority: 40,
            scheduled_start: line.week_start,
            mps_line_id: line.id,
            notes: `Firms from MPS plan #${planId}`,
            updated_at: new Date().toISOString(),
          })
          .select('*')
          .single();
        if (order) created.push(order);
      }

      return NextResponse.json({ success: true, created: created.length, orders: created });
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
    const id = Number(body.id);
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of ['name', 'status', 'horizon_weeks', 'start_date', 'notes']) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    const { data, error } = await supabase
      .from('manufacturing_mps_plans')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, plan: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
