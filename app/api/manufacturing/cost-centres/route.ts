import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  monthlyDepreciation,
  type CostRollupRow,
} from '@/lib/manufacturing/cost-structure';

/**
 * GET ?companyId=&from=&to=
 * Cost centre rollup: BU + work centre + station + asset period costs.
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
    fromDefault.setDate(1);
    const from = sp.get('from') || fromDefault.toISOString().slice(0, 10);

    const supabase = getSupabaseServer();
    const [
      bus,
      wcs,
      stations,
      assets,
      entries,
      allocs,
    ] = await Promise.all([
      supabase
        .from('manufacturing_business_units')
        .select('*')
        .eq('profile_id', companyId),
      supabase
        .from('manufacturing_work_centers')
        .select('*')
        .eq('profile_id', companyId),
      supabase
        .from('manufacturing_work_stations')
        .select('*')
        .eq('profile_id', companyId),
      supabase
        .from('manufacturing_assets')
        .select('*')
        .eq('profile_id', companyId),
      supabase
        .from('manufacturing_cost_entries')
        .select('*')
        .eq('profile_id', companyId)
        .gte('entry_date', from)
        .lte('entry_date', to),
      supabase
        .from('manufacturing_asset_allocations')
        .select('*')
        .eq('profile_id', companyId),
    ]);

    const schemaMissing =
      bus.error ||
      stations.error ||
      assets.error ||
      entries.error ||
      allocs.error;

    if (schemaMissing && bus.error) {
      return NextResponse.json({
        success: true,
        from,
        to,
        businessUnits: [],
        workCenters: [],
        workStations: [],
        assets: [],
        totals: { directExpenses: 0, assetMonthly: 0 },
        warning: bus.error.message,
        hint: 'Run supabase/migrations/20260720_manufacturing_cost_structure.sql',
      });
    }

    const entryList = entries.data || [];
    const assetList = assets.data || [];
    const allocList = allocs.data || [];
    const today = to;

    const activeAlloc = (assetId: number) =>
      allocList.filter((a) => {
        if (Number(a.asset_id) !== assetId) return false;
        const fr = a.effective_from ? String(a.effective_from) : '0000-01-01';
        const toD = a.effective_to ? String(a.effective_to) : '9999-12-31';
        return fr <= today && toD >= today;
      });

    function directSum(filter: (e: Record<string, unknown>) => boolean) {
      let sum = 0;
      let n = 0;
      for (const e of entryList) {
        if (filter(e as Record<string, unknown>)) {
          sum += Number(e.amount || 0);
          n += 1;
        }
      }
      return { sum, n };
    }

    function assetCostsFor(
      filterAlloc: (a: Record<string, unknown>) => boolean
    ) {
      let allocatedExpenses = 0;
      let monthlyRunning = 0;
      let monthlyDep = 0;
      for (const asset of assetList) {
        const allocsFor = activeAlloc(Number(asset.id)).filter((a) =>
          filterAlloc(a as Record<string, unknown>)
        );
        if (!allocsFor.length) continue;
        const pct =
          allocsFor.reduce(
            (s, a) => s + Number(a.allocation_pct || 100),
            0
          ) / 100;
        const share = Math.min(pct, 2); // cap multi-use
        const dep = monthlyDepreciation({
          purchaseCost: Number(asset.purchase_cost || 0),
          residualValue: Number(asset.residual_value || 0),
          usefulLifeMonths: Number(asset.useful_life_months || 60),
          method: asset.depreciation_method,
        });
        monthlyDep += dep * share;
        monthlyRunning += Number(asset.monthly_running_cost || 0) * share;
        // Direct expenses on this asset
        const { sum } = directSum(
          (e) => Number(e.asset_id) === Number(asset.id)
        );
        allocatedExpenses += sum * Math.min(share, 1);
      }
      return { allocatedExpenses, monthlyRunning, monthlyDep };
    }

    const buRows: CostRollupRow[] = (bus.data || []).map((bu) => {
      const { sum, n } = directSum(
        (e) => Number(e.business_unit_id) === Number(bu.id)
      );
      const ac = assetCostsFor(
        (a) => Number(a.business_unit_id) === Number(bu.id)
      );
      const total =
        sum + ac.allocatedExpenses + ac.monthlyRunning + ac.monthlyDep;
      return {
        objectType: 'business_unit' as const,
        objectId: Number(bu.id),
        code: String(bu.cost_centre_code || bu.code),
        name: String(bu.name),
        currency: String(bu.currency || 'ZAR'),
        directExpenses: Math.round(sum * 100) / 100,
        assetAllocatedExpenses: Math.round(ac.allocatedExpenses * 100) / 100,
        assetMonthlyRunning: Math.round(ac.monthlyRunning * 100) / 100,
        assetMonthlyDepreciation: Math.round(ac.monthlyDep * 100) / 100,
        workCenterHourlyCost: 0,
        totalCost: Math.round(total * 100) / 100,
        entryCount: n,
        budgetMonthly: Number(bu.budget_monthly || 0),
        status: bu.status,
      };
    });

    const wcRows: CostRollupRow[] = (wcs.data || []).map((wc) => {
      const { sum, n } = directSum(
        (e) => Number(e.work_center_id) === Number(wc.id)
      );
      const ac = assetCostsFor(
        (a) => Number(a.work_center_id) === Number(wc.id)
      );
      const hourly = Number(wc.cost_per_hour || 0);
      const total =
        sum + ac.allocatedExpenses + ac.monthlyRunning + ac.monthlyDep;
      return {
        objectType: 'work_center' as const,
        objectId: Number(wc.id),
        code: String(wc.code),
        name: String(wc.name),
        currency: 'ZAR',
        directExpenses: Math.round(sum * 100) / 100,
        assetAllocatedExpenses: Math.round(ac.allocatedExpenses * 100) / 100,
        assetMonthlyRunning: Math.round(ac.monthlyRunning * 100) / 100,
        assetMonthlyDepreciation: Math.round(ac.monthlyDep * 100) / 100,
        workCenterHourlyCost: hourly,
        totalCost: Math.round(total * 100) / 100,
        entryCount: n,
        businessUnitId: wc.business_unit_id
          ? Number(wc.business_unit_id)
          : null,
        costPerHour: hourly,
        capacityHoursPerDay: Number(wc.capacity_hours_per_day || 0),
        status: wc.status,
      };
    });

    const stRows: CostRollupRow[] = (stations.data || []).map((st) => {
      const { sum, n } = directSum(
        (e) => Number(e.work_station_id) === Number(st.id)
      );
      const ac = assetCostsFor(
        (a) => Number(a.work_station_id) === Number(st.id)
      );
      const total =
        sum + ac.allocatedExpenses + ac.monthlyRunning + ac.monthlyDep;
      return {
        objectType: 'work_station' as const,
        objectId: Number(st.id),
        code: String(st.code),
        name: String(st.name),
        currency: 'ZAR',
        directExpenses: Math.round(sum * 100) / 100,
        assetAllocatedExpenses: Math.round(ac.allocatedExpenses * 100) / 100,
        assetMonthlyRunning: Math.round(ac.monthlyRunning * 100) / 100,
        assetMonthlyDepreciation: Math.round(ac.monthlyDep * 100) / 100,
        workCenterHourlyCost: Number(st.cost_per_hour || 0),
        totalCost: Math.round(total * 100) / 100,
        entryCount: n,
        workCenterId: st.work_center_id ? Number(st.work_center_id) : null,
        businessUnitId: st.business_unit_id
          ? Number(st.business_unit_id)
          : null,
        status: st.status,
      };
    });

    const assetRows = assetList.map((a) => {
      const { sum, n } = directSum((e) => Number(e.asset_id) === Number(a.id));
      const dep = monthlyDepreciation({
        purchaseCost: Number(a.purchase_cost || 0),
        residualValue: Number(a.residual_value || 0),
        usefulLifeMonths: Number(a.useful_life_months || 60),
        method: a.depreciation_method,
      });
      const run = Number(a.monthly_running_cost || 0);
      const total = sum + dep + run;
      return {
        objectType: 'asset' as const,
        objectId: Number(a.id),
        code: String(a.code),
        name: String(a.name),
        currency: String(a.currency || 'ZAR'),
        directExpenses: Math.round(sum * 100) / 100,
        assetAllocatedExpenses: 0,
        assetMonthlyRunning: run,
        assetMonthlyDepreciation: dep,
        workCenterHourlyCost: 0,
        totalCost: Math.round(total * 100) / 100,
        entryCount: n,
        assetType: a.asset_type,
        status: a.status,
        allocations: activeAlloc(Number(a.id)),
      };
    });

    const totalDirect = entryList.reduce(
      (s, e) => s + Number(e.amount || 0),
      0
    );
    const totalAssetMonthly = assetList.reduce((s, a) => {
      const dep = monthlyDepreciation({
        purchaseCost: Number(a.purchase_cost || 0),
        residualValue: Number(a.residual_value || 0),
        usefulLifeMonths: Number(a.useful_life_months || 60),
        method: a.depreciation_method,
      });
      return s + dep + Number(a.monthly_running_cost || 0);
    }, 0);

    return NextResponse.json({
      success: true,
      from,
      to,
      businessUnits: buRows,
      workCenters: wcRows,
      workStations: stRows,
      assets: assetRows,
      totals: {
        directExpenses: Math.round(totalDirect * 100) / 100,
        assetMonthly: Math.round(totalAssetMonthly * 100) / 100,
        periodEntries: entryList.length,
        businessUnitCount: buRows.length,
        workCenterCount: wcRows.length,
        workStationCount: stRows.length,
        assetCount: assetRows.length,
      },
      warning: schemaMissing
        ? String(
            stations.error?.message ||
              assets.error?.message ||
              entries.error?.message ||
              ''
          )
        : undefined,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
