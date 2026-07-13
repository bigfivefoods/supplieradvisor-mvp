import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getCompanyMembership } from '@/lib/business/access';
import {
  aggregateSalesByContainer,
  computeContainerImpact,
  DEFAULT_IMPACT_SETTINGS,
  normalizeSettings,
  sumImpact,
  type ImpactSettings,
} from '@/lib/containers/impact';
import {
  aggregateStockByContainer,
  emptyStock,
  type InventoryLine,
} from '@/lib/containers/stock';

/**
 * GET ?companyId=&from=&to= — food security & jobs impact by container
 * PATCH — update company impact assumptions
 */
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

    const to = sp.get('to') || new Date().toISOString().slice(0, 10);
    const fromDefault = new Date();
    fromDefault.setFullYear(fromDefault.getFullYear() - 1);
    const from = sp.get('from') || fromDefault.toISOString().slice(0, 10);

    const supabase = getSupabaseServer();

    const baseSelect =
      'id, container_code, name, status, city, province, country, latitude, longitude, contractor_id, assigned_contractor, is_active';
    const impactSelect = `${baseSelect}, impact_jobs_direct, impact_jobs_support, impact_people_per_sale, impact_avg_meal_price, impact_notes`;

    let containers: Array<Record<string, unknown>> = [];
    {
      const withImpact = await supabase
        .from('containers')
        .select(impactSelect)
        .eq('profile_id', companyId)
        .order('name', { ascending: true });

      if (
        withImpact.error &&
        /does not exist|schema cache|column/i.test(withImpact.error.message)
      ) {
        const base = await supabase
          .from('containers')
          .select(baseSelect)
          .eq('profile_id', companyId)
          .order('name', { ascending: true });
        if (base.error) {
          return NextResponse.json(
            { error: base.error.message },
            { status: 500 }
          );
        }
        containers = (base.data || []) as Array<Record<string, unknown>>;
      } else if (withImpact.error) {
        return NextResponse.json(
          { error: withImpact.error.message },
          { status: 500 }
        );
      } else {
        containers = (withImpact.data || []) as Array<Record<string, unknown>>;
      }
    }

    const [salesRes, settingsRes, invRes] = await Promise.all([
      supabase
        .from('container_sales')
        .select('id, container_id, gross_amount, net_amount, sale_date, items')
        .eq('profile_id', companyId)
        .gte('sale_date', from)
        .lte('sale_date', to)
        .limit(10000),
      supabase
        .from('container_impact_settings')
        .select('*')
        .eq('profile_id', companyId)
        .maybeSingle(),
      supabase
        .from('container_inventory')
        .select(
          'container_id, product_name, sku, qty_on_hand, unit, reorder_level, unit_cost'
        )
        .eq('profile_id', companyId)
        .limit(20000),
    ]);

    const settings = normalizeSettings(
      settingsRes.data as Partial<ImpactSettings> | null
    );
    const settingsMissing = Boolean(
      settingsRes.error &&
        /does not exist|schema cache/i.test(settingsRes.error.message)
    );
    const salesMissing = Boolean(
      salesRes.error &&
        /does not exist|schema cache/i.test(salesRes.error.message)
    );
    const inventoryMissing = Boolean(
      invRes.error &&
        /does not exist|schema cache/i.test(invRes.error.message)
    );
    const salesByContainer = salesMissing
      ? new Map()
      : aggregateSalesByContainer(
          (salesRes.data || []) as Array<Record<string, unknown>>
        );

    const stockByContainer = inventoryMissing
      ? new Map()
      : aggregateStockByContainer((invRes.data || []) as InventoryLine[]);

    const rows = containers.map((c) => {
      const base = computeContainerImpact(
        c as Parameters<typeof computeContainerImpact>[0],
        salesByContainer.get(Number(c.id)),
        settings
      );
      const stock =
        stockByContainer.get(Number(c.id)) || emptyStock(Number(c.id));
      return {
        ...base,
        stock_qty: stock.total_qty,
        stock_skus: stock.sku_count,
        stock_low: stock.low_stock_count,
        stock_value: stock.stock_value,
        stock_top: stock.top_lines,
      };
    });

    const totals = sumImpact(rows);

    // Area rollups for map story
    const byCity = new Map<
      string,
      {
        city: string;
        jobs: number;
        people_fed: number;
        containers: number;
        sales: number;
        stock_qty: number;
      }
    >();
    for (const r of rows) {
      const city = r.city || 'Unknown';
      if (!byCity.has(city)) {
        byCity.set(city, {
          city,
          jobs: 0,
          people_fed: 0,
          containers: 0,
          sales: 0,
          stock_qty: 0,
        });
      }
      const m = byCity.get(city)!;
      m.jobs += r.jobs_total;
      m.people_fed += r.people_fed;
      m.containers += 1;
      m.sales += r.sales_revenue;
      m.stock_qty += r.stock_qty || 0;
    }

    return NextResponse.json({
      success: true,
      period: { from, to },
      settings,
      settingsMissing,
      salesMissing,
      inventoryMissing,
      stockLiveAt: new Date().toISOString(),
      totals,
      rows: rows.sort(
        (a, b) =>
          b.people_fed - a.people_fed ||
          b.jobs_total - a.jobs_total ||
          (b.stock_qty || 0) - (a.stock_qty || 0)
      ),
      byCity: Array.from(byCity.values())
        .map((c) => ({
          ...c,
          jobs: Math.round(c.jobs * 10) / 10,
          sales: Math.round(c.sales * 100) / 100,
          stock_qty: Math.round(c.stock_qty * 10) / 10,
        }))
        .sort((a, b) => b.people_fed - a.people_fed),
      methodology: settings.methodology_notes,
      warnings: [
        salesMissing
          ? 'No container_sales data yet — people-fed uses sales when logged by operators.'
          : salesRes.error?.message || null,
        inventoryMissing
          ? 'No container_inventory table yet — run 20260709_container_ops.sql for live stock.'
          : invRes.error?.message || null,
        settingsMissing
          ? 'Using default impact assumptions — run 20260713_container_impact.sql to customise.'
          : settingsRes.error?.message || null,
      ].filter(Boolean),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/** PATCH company impact settings */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request) || body.privyUserId,
    });
    if (!gate.ok) return gate.response;

    const mem = await getCompanyMembership(gate.userId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!['owner', 'admin', 'operations'].includes(mem.role)) {
      return NextResponse.json(
        { error: 'Only owners, admins, or operations can edit impact settings' },
        { status: 403 }
      );
    }

    const settings = normalizeSettings({
      ...DEFAULT_IMPACT_SETTINGS,
      jobs_direct_default: body.jobs_direct_default,
      jobs_support_default: body.jobs_support_default,
      avg_meal_price_zar: body.avg_meal_price_zar,
      people_per_meal: body.people_per_meal,
      people_per_sale_txn: body.people_per_sale_txn,
      people_method: body.people_method,
      methodology_notes: body.methodology_notes,
    });

    const supabase = getSupabaseServer();
    const row = {
      profile_id: companyId,
      ...settings,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from('container_impact_settings')
      .select('id')
      .eq('profile_id', companyId)
      .maybeSingle();

    let data;
    let error;
    if (existing?.id) {
      const res = await supabase
        .from('container_impact_settings')
        .update(row)
        .eq('profile_id', companyId)
        .select('*')
        .single();
      data = res.data;
      error = res.error;
    } else {
      const res = await supabase
        .from('container_impact_settings')
        .insert({ ...row, created_at: new Date().toISOString() })
        .select('*')
        .single();
      data = res.data;
      error = res.error;
    }

    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json(
          {
            error: error.message,
            hint: 'Run supabase/migrations/20260713_container_impact.sql',
            code: 'MIGRATION_REQUIRED',
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      settings: normalizeSettings(data as Partial<ImpactSettings>),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
