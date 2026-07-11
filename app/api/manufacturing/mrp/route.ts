import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { nextOrderNumber } from '@/lib/manufacturing/types';
import {
  aggregateDemand,
  explodeBom,
  netRequirements,
  type DemandInput,
} from '@/lib/manufacturing/mrp';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const runId = request.nextUrl.searchParams.get('runId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    if (runId) {
      const { data: run, error } = await supabase
        .from('manufacturing_mrp_runs')
        .select('*')
        .eq('profile_id', companyId)
        .eq('id', Number(runId))
        .maybeSingle();
      if (error) {
        return NextResponse.json({
          success: true,
          run: null,
          requirements: [],
          warning: error.message,
        });
      }

      const { data: reqs } = await supabase
        .from('manufacturing_mrp_requirements')
        .select('*')
        .eq('run_id', Number(runId))
        .order('net_req', { ascending: false });

      const productIds = [
        ...new Set((reqs || []).map((r) => r.product_id).filter(Boolean)),
      ];
      let pMap: Record<number, { name: string; sku: string | null; product_type: string | null }> =
        {};
      if (productIds.length) {
        const { data: products } = await supabase
          .from('products')
          .select('id, name, sku, product_type')
          .in('id', productIds);
        pMap = Object.fromEntries(
          (products || []).map((p) => [
            p.id,
            { name: p.name, sku: p.sku, product_type: p.product_type },
          ])
        );
      }

      return NextResponse.json({
        success: true,
        run,
        requirements: (reqs || []).map((r) => ({
          ...r,
          product_name: r.product_id ? pMap[r.product_id]?.name : null,
          product_sku: r.product_id ? pMap[r.product_id]?.sku : null,
          product_type: r.product_id ? pMap[r.product_id]?.product_type : null,
        })),
      });
    }

    const { data, error } = await supabase
      .from('manufacturing_mrp_runs')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ success: true, runs: [], warning: error.message });
    }

    return NextResponse.json({ success: true, runs: data || [] });
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

    const horizonDays = Number(body.horizon_days ?? 90);
    const supabase = getSupabaseServer();

    const { count } = await supabase
      .from('manufacturing_mrp_runs')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId);

    const run_number = nextOrderNumber('MRP', (count || 0) + 1);

    const { data: run, error: runErr } = await supabase
      .from('manufacturing_mrp_runs')
      .insert({
        profile_id: companyId,
        run_number,
        status: 'running',
        horizon_days: horizonDays,
        started_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (runErr || !run) {
      return NextResponse.json(
        { error: runErr?.message || 'Failed to create MRP run' },
        { status: 400 }
      );
    }

    try {
      // 1) Independent demand: MPS firm + production order planned qty (finished goods)
      const demands: DemandInput[] = [];

      const { data: mpsPlans } = await supabase
        .from('manufacturing_mps_plans')
        .select('id')
        .eq('profile_id', companyId)
        .in('status', ['active', 'frozen']);

      const planIds = (mpsPlans || []).map((p) => p.id);
      if (planIds.length) {
        const { data: mpsLines } = await supabase
          .from('manufacturing_mps_lines')
          .select('product_id, firm_qty, demand_qty, week_start')
          .in('plan_id', planIds);
        for (const l of mpsLines || []) {
          const qty = Number(l.firm_qty || 0) || Number(l.demand_qty || 0);
          if (qty > 0 && l.product_id) {
            demands.push({
              product_id: Number(l.product_id),
              qty,
              date: l.week_start,
              source: 'mps',
            });
          }
        }
      }

      const { data: openOrders } = await supabase
        .from('manufacturing_production_orders')
        .select('product_id, qty_planned, qty_completed, scheduled_start, status')
        .eq('profile_id', companyId)
        .in('status', ['planned', 'released', 'in_progress', 'hold']);

      for (const o of openOrders || []) {
        const remaining = Math.max(0, Number(o.qty_planned || 0) - Number(o.qty_completed || 0));
        if (remaining > 0 && o.product_id) {
          demands.push({
            product_id: Number(o.product_id),
            qty: remaining,
            date: o.scheduled_start
              ? String(o.scheduled_start).slice(0, 10)
              : new Date().toISOString().slice(0, 10),
            source: 'production_order',
          });
        }
      }

      // 2) Active BOMs + lines
      const { data: boms } = await supabase
        .from('manufacturing_boms')
        .select('id, product_id')
        .eq('profile_id', companyId)
        .eq('status', 'active');

      const bomByProduct = new Map<number, number>();
      for (const b of boms || []) {
        if (b.product_id) bomByProduct.set(Number(b.product_id), Number(b.id));
      }

      const bomIds = (boms || []).map((b) => b.id);
      const { data: bomLines } =
        bomIds.length > 0
          ? await supabase
              .from('manufacturing_bom_lines')
              .select('bom_id, component_product_id, qty_per, scrap_pct')
              .in('bom_id', bomIds)
          : { data: [] as { bom_id: number; component_product_id: number; qty_per: number; scrap_pct: number }[] };

      const linesByBom = new Map<number, typeof bomLines>();
      for (const l of bomLines || []) {
        const arr = linesByBom.get(l.bom_id) || [];
        arr.push(l);
        linesByBom.set(l.bom_id, arr);
      }

      // 3) Explode parent demand → component gross
      const parentAgg = aggregateDemand(demands);
      const componentDemands: DemandInput[] = [];

      for (const [productId, d] of parentAgg) {
        const bomId = bomByProduct.get(productId);
        if (!bomId) continue;
        const lines = linesByBom.get(bomId) || [];
        const exploded = explodeBom(
          d.qty,
          lines.map((l) => ({
            component_product_id: Number(l.component_product_id),
            qty_per: Number(l.qty_per),
            scrap_pct: Number(l.scrap_pct || 0),
          }))
        );
        for (const e of exploded) {
          componentDemands.push({
            product_id: e.product_id,
            qty: e.gross,
            date: d.date || undefined,
            source: 'bom_explosion',
          });
        }
      }

      // All products with demand (parents + components)
      const allDemand = aggregateDemand([
        ...[...parentAgg.entries()].map(([product_id, d]) => ({
          product_id,
          qty: d.qty,
          date: d.date || undefined,
          source: d.source,
        })),
        ...componentDemands,
      ]);

      // 4) On-hand stock
      const productIds = [...allDemand.keys()];
      const onHand: Record<number, number> = {};
      if (productIds.length) {
        const { data: levels } = await supabase
          .from('stock_levels')
          .select('product_id, qty_on_hand')
          .eq('profile_id', companyId)
          .in('product_id', productIds);
        for (const l of levels || []) {
          const pid = Number(l.product_id);
          onHand[pid] = (onHand[pid] || 0) + Number(l.qty_on_hand || 0);
        }
      }

      // Scheduled receipts: open production orders remaining as supply for FG
      const scheduled: Record<number, number> = {};
      for (const o of openOrders || []) {
        if (!o.product_id) continue;
        const rem = Math.max(0, Number(o.qty_planned || 0) - Number(o.qty_completed || 0));
        // Only count released+ as receipt (planned is demand-side already)
        if (['released', 'in_progress'].includes(o.status)) {
          scheduled[o.product_id] = (scheduled[o.product_id] || 0) + rem;
        }
      }

      const results = [];
      for (const [productId, d] of allDemand) {
        const hasBom = bomByProduct.has(productId);
        results.push(
          netRequirements(
            productId,
            d.qty,
            onHand[productId] || 0,
            scheduled[productId] || 0,
            hasBom,
            d.source,
            d.date
          )
        );
      }

      // Sort: shortages first
      results.sort((a, b) => b.net_req - a.net_req);

      if (results.length) {
        const rows = results.map((r) => ({
          run_id: run.id,
          profile_id: companyId,
          product_id: r.product_id,
          requirement_date: r.requirement_date,
          gross_req: r.gross_req,
          on_hand: r.on_hand,
          scheduled_receipts: r.scheduled_receipts,
          net_req: r.net_req,
          planned_order_qty: r.planned_order_qty,
          action: r.action,
          source: r.source,
          priority: r.net_req > 0 ? 20 : 80,
        }));
        for (let i = 0; i < rows.length; i += 200) {
          await supabase.from('manufacturing_mrp_requirements').insert(rows.slice(i, i + 200));
        }
      }

      const shortages = results.filter((r) => r.net_req > 0).length;
      const make = results.filter((r) => r.action === 'make').length;
      const buy = results.filter((r) => r.action === 'buy' || r.action === 'expedite').length;

      const summary = {
        products: results.length,
        shortages,
        make_suggestions: make,
        buy_suggestions: buy,
        total_net_req: results.reduce((s, r) => s + r.net_req, 0),
        demand_sources: demands.length,
      };

      const { data: completed } = await supabase
        .from('manufacturing_mrp_runs')
        .update({
          status: 'complete',
          completed_at: new Date().toISOString(),
          summary,
        })
        .eq('id', run.id)
        .select('*')
        .single();

      return NextResponse.json({
        success: true,
        run: completed,
        requirements: results,
        summary,
      });
    } catch (inner: unknown) {
      await supabase
        .from('manufacturing_mrp_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          summary: {
            error: inner instanceof Error ? inner.message : 'MRP failed',
          },
        })
        .eq('id', run.id);
      throw inner;
    }
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
