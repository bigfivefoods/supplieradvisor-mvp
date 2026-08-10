'use client';

/**
 * Key management reports — multi-quarry, fleet KPIs, product balance, cost.
 */
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  LoadingBlock,
  QuarrygraphWorkbench,
  useQuarrygraph,
} from '@/components/quarry/QuarrygraphWorkbench';
import { DataTable, StatRow } from '@/components/quarry/SimpleEntityForm';

const TABS = [
  'overview',
  'by_quarry',
  'vehicles',
  'production',
  'dispatch',
  'cost',
  'quality',
  'compliance',
] as const;

export default function QuarryReportPage() {
  const { store, loading, summary, analysis } = useQuarrygraph();
  const [tab, setTab] = useState<(typeof TABS)[number]>('overview');
  const [quarryFilter, setQuarryFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');

  const byQuarry =
    (analysis?.byQuarry as Array<{
      quarry_id: string;
      code: string;
      name: string;
      sites: number;
      reserves_t: number;
      plant_t: number;
      dispatch_t: number;
      stock_t: number;
      blast_t: number;
      fuel_l: number;
      fleet_hours: number;
      labour_zar: number;
      vehicles: number;
      cost_per_t: number | null;
    }>) || [];

  const byProduct =
    (analysis?.productBalance as Array<{
      product: string;
      grade: string;
      plant_t: number;
      dispatch_t: number;
      stock_t: number;
      gap_plant_vs_dispatch: number;
    }>) ||
    (analysis?.byProduct as Array<{
      product: string;
      grade: string;
      plant_t: number;
      dispatch_t: number;
      stock_t: number;
      gap_plant_vs_dispatch?: number;
    }>) ||
    [];

  const metrics =
    (analysis?.vehicleMetrics as Array<{
      code: string;
      vehicle: string;
      type: string;
      status: string;
      quarry: string;
      hours: number;
      util_pct: number | null;
      fuel_l: number;
      km: number;
      l_per_hour: number | null;
      l_per_km: number | null;
      fuel_util_pct: number | null;
      cost_per_km: number | null;
      tonnes_moved: number;
      t_per_hour: number | null;
      l_per_tonne: number | null;
      cost_zar: number;
      cost_per_t: number | null;
    }>) || [];

  const fleetByType =
    (analysis?.fleetByType as Array<{
      type: string;
      vehicles: number;
      hours: number;
      fuel_l: number;
      tonnes: number;
    }>) || [];

  const labour =
    (analysis?.labourCost as {
      totalCost: number;
      byEmployment: Array<{ type: string; cost: number; hours: number }>;
    }) || null;

  const siteIdsForQuarry = useMemo(() => {
    if (!store || !quarryFilter) return null;
    return new Set(
      store.sites.filter((s) => s.quarry_id === quarryFilter).map((s) => s.id)
    );
  }, [store, quarryFilter]);

  const filteredDispatches = useMemo(() => {
    if (!store) return [];
    return store.dispatches.filter((d) => {
      if (siteFilter && d.site_id !== siteFilter) return false;
      if (productFilter && d.product_id !== productFilter) return false;
      if (siteIdsForQuarry && d.site_id && !siteIdsForQuarry.has(d.site_id))
        return false;
      return true;
    });
  }, [store, siteFilter, productFilter, siteIdsForQuarry]);

  const exportCsv = () => {
    if (!store) return;
    const lines: string[] = [];
    if (tab === 'by_quarry') {
      lines.push(
        'code,name,sites,reserves_t,plant_t,dispatch_t,stock_t,fuel_l,labour_zar,cost_per_t'
      );
      for (const r of byQuarry) {
        lines.push(
          [r.code, r.name, r.sites, r.reserves_t, r.plant_t, r.dispatch_t, r.stock_t, r.fuel_l, r.labour_zar, r.cost_per_t].join(',')
        );
      }
    } else if (tab === 'vehicles') {
      lines.push(
        'code,vehicle,type,status,quarry,hours,util_pct,fuel_l,l_per_h,tonnes,t_per_h,l_per_t,cost,cost_per_t'
      );
      for (const m of metrics) {
        lines.push(
          [m.code, m.vehicle, m.type, m.status, m.quarry, m.hours, m.util_pct, m.fuel_l, m.l_per_hour, m.tonnes_moved, m.t_per_hour, m.l_per_tonne, m.cost_zar, m.cost_per_t].join(',')
        );
      }
    } else {
      lines.push('metric,value');
      for (const [k, v] of Object.entries(summary || {})) {
        lines.push(`${k},${v}`);
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quarrygraph-${tab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  return (
    <QuarrygraphWorkbench
      title="Key reports"
      titleAccent="management pack"
      description="Multi-quarry roll-up, vehicle KPIs (fuel util L/h · L/km, cost R/km, R/t), plant vs dispatch balance, labour and compliance — filter and export CSV."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 justify-between">
            <div className="flex flex-wrap gap-2">
              <select
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold bg-white"
                value={quarryFilter}
                onChange={(e) => {
                  setQuarryFilter(e.target.value);
                  setSiteFilter('');
                }}
              >
                <option value="">All quarries</option>
                {(store.quarries || []).map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.code} · {q.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold bg-white"
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
              >
                <option value="">All pits</option>
                {store.sites
                  .filter(
                    (s) => !quarryFilter || s.quarry_id === quarryFilter
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}
                    </option>
                  ))}
              </select>
              <select
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold bg-white"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
              >
                <option value="">All products</option>
                {store.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={exportCsv}
              className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['overview', 'Overview'],
                ['by_quarry', 'By quarry'],
                ['vehicles', 'Vehicle KPIs'],
                ['production', 'Plant vs stock'],
                ['dispatch', 'Dispatch'],
                ['cost', 'Cost'],
                ['quality', 'Quality'],
                ['compliance', 'Compliance'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                  tab === id
                    ? 'border-amber-800 bg-amber-800 text-white'
                    : 'border-neutral-200 bg-white text-neutral-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <StatRow tone="qg-office"
            items={[
              { label: 'Quarries', value: Number(summary?.quarryCount) || 0 },
              { label: 'Pits', value: Number(summary?.siteCount) || 0 },
              {
                label: 'Reserves t',
                value: Number(summary?.reserveTonnes) || 0,
              },
              {
                label: 'Stock t',
                value: Number(summary?.stockpileTonnes) || 0,
              },
              {
                label: 'Dispatched t',
                value: Number(summary?.dispatchedTonnes) || 0,
              },
              {
                label: 'Plant out t',
                value: Number(summary?.plantOutputTonnes) || 0,
              },
              {
                label: 'Fleet R',
                value: Number(summary?.fleetCostZar) || 0,
              },
              {
                label: 'Labour R',
                value: Number(summary?.labourCostZar) || 0,
              },
              {
                label: 'R / t dispatched',
                value:
                  summary?.costPerDispatchT != null
                    ? String(summary.costPerDispatchT)
                    : '—',
              },
              {
                label: 't/h · L/t',
                value: `${summary?.tPerHour ?? '—'} · ${summary?.lPerTonne ?? '—'}`,
              },
            ]}
          />

          {(tab === 'overview' || tab === 'by_quarry') && (
            <DataTable tone="qg-office"
              headers={[
                'Quarry',
                'Pits',
                'Vehicles',
                'Reserves t',
                'Blast t',
                'Plant t',
                'Dispatch t',
                'Stock t',
                'Fuel L',
                'Hours',
                'Labour R',
                'R/t',
              ]}
              rows={byQuarry.map((r, i) => ({
                id: String(i),
                cells: [
                  `${r.code} · ${r.name}`,
                  r.sites,
                  r.vehicles,
                  r.reserves_t,
                  r.blast_t,
                  r.plant_t,
                  r.dispatch_t,
                  r.stock_t,
                  r.fuel_l,
                  r.fleet_hours,
                  r.labour_zar,
                  r.cost_per_t ?? '—',
                ],
              }))}
            />
          )}

          {(tab === 'overview' || tab === 'vehicles') && (
            <>
              <DataTable tone="qg-office"
                headers={[
                  'Code',
                  'Vehicle',
                  'Quarry',
                  'Hours',
                  'Fuel L',
                  'Km',
                  'L/h',
                  'L/km',
                  'Fuel util %',
                  'R/km',
                  'Cost R',
                  't',
                  'R/t',
                ]}
                rows={metrics.map((m, i) => ({
                  id: String(i),
                  cells: [
                    m.code,
                    m.vehicle,
                    m.quarry,
                    m.hours,
                    m.fuel_l,
                    m.km,
                    m.l_per_hour ?? '—',
                    m.l_per_km ?? '—',
                    m.fuel_util_pct ?? '—',
                    m.cost_per_km ?? '—',
                    m.cost_zar,
                    m.tonnes_moved,
                    m.cost_per_t ?? '—',
                  ],
                }))}
              />
              <DataTable tone="qg-office"
                headers={['Type', 'Units', 'Hours', 'Fuel L', 'Tonnes']}
                rows={fleetByType.map((r, i) => ({
                  id: `t${i}`,
                  cells: [r.type, r.vehicles, r.hours, r.fuel_l, r.tonnes],
                }))}
              />
            </>
          )}

          {(tab === 'overview' || tab === 'production') && (
            <DataTable tone="qg-office"
              headers={[
                'Product',
                'Grade',
                'Plant t',
                'Dispatch t',
                'Stock t',
                'Plant − dispatch',
              ]}
              rows={byProduct.map((r, i) => ({
                id: String(i),
                cells: [
                  r.product,
                  r.grade,
                  r.plant_t,
                  r.dispatch_t,
                  r.stock_t,
                  r.gap_plant_vs_dispatch ??
                    Math.round((r.plant_t - r.dispatch_t) * 10) / 10,
                ],
              }))}
            />
          )}

          {(tab === 'overview' || tab === 'dispatch') && (
            <DataTable tone="qg-office"
              headers={[
                'Date',
                'Ticket',
                'Customer',
                'Net t',
                'Destination',
                'Status',
              ]}
              rows={filteredDispatches.map((d) => ({
                id: d.id,
                cells: [
                  d.date,
                  d.ticket_no || '—',
                  d.customer || '—',
                  d.net_tonnes,
                  d.destination || '—',
                  d.status,
                ],
              }))}
            />
          )}

          {(tab === 'overview' || tab === 'cost') && (
            <>
              <DataTable tone="qg-office"
                headers={['Employment type', 'Hours', 'Cost R']}
                rows={(labour?.byEmployment || []).map((r, i) => ({
                  id: String(i),
                  cells: [r.type, r.hours, r.cost],
                }))}
              />
              <p className="text-sm text-slate-600">
                Combined labour + fleet cost per dispatched tonne:{' '}
                <strong>
                  {summary?.costPerDispatchT != null
                    ? `R ${summary.costPerDispatchT}`
                    : '—'}
                </strong>
              </p>
            </>
          )}

          {(tab === 'overview' || tab === 'quality') && (
            <DataTable tone="qg-office"
              headers={['Date', 'Test', 'Result', 'P/F', 'Sample']}
              rows={store.quality_tests
                .filter((q) => {
                  if (siteFilter && q.site_id !== siteFilter) return false;
                  if (
                    siteIdsForQuarry &&
                    q.site_id &&
                    !siteIdsForQuarry.has(q.site_id)
                  )
                    return false;
                  if (productFilter && q.product_id !== productFilter)
                    return false;
                  return true;
                })
                .map((q) => ({
                  id: q.id,
                  cells: [
                    q.date,
                    q.test_type,
                    q.result != null ? `${q.result} ${q.unit || ''}` : '—',
                    q.pass_fail || '—',
                    q.sample_ref || '—',
                  ],
                }))}
            />
          )}

          {(tab === 'overview' || tab === 'compliance') && (
            <DataTable tone="qg-office"
              headers={['Type', 'Ref', 'Expires', 'Status']}
              rows={store.permits.map((p) => ({
                id: p.id,
                cells: [p.type, p.ref_no, p.expires_at || '—', p.status],
              }))}
            />
          )}
        </div>
      )}
    </QuarrygraphWorkbench>
  );
}
