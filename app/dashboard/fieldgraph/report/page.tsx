'use client';

/**
 * CropAdvisor® Reports — slice & dice
 * Period slicer + season / crop / farm / field / employment filters.
 * Tabs: Overview · Yield · Harvest · Fleet · Labour · Inputs · Regen
 */
import { useMemo, useState } from 'react';
import { Download, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import {
  FieldgraphWorkbench,
  LoadingBlock,
  useFieldgraph,
} from '@/components/agri/FieldgraphWorkbench';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import {
  buildFieldgraphReport,
  diceDimensionOptions,
  emptyDiceFilters,
  FIELDGRAPH_REPORTS,
  reportToCsv,
  type FieldgraphDiceFilters,
  type FieldgraphReportId,
} from '@/lib/agri/fieldgraph-reports';

function formatZar(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `R ${Number(n).toLocaleString('en-ZA', {
    maximumFractionDigits: 0,
  })}`;
}

function ChipMulti({
  label,
  options,
  selected,
  onChange,
  getLabel,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  getLabel?: (v: string) => string;
}) {
  if (!options.length) return null;
  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v));
    else onChange([...selected, v]);
  };
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
        {label}
        {selected.length ? (
          <button
            type="button"
            className="ml-2 text-emerald-700 dark:text-white normal-case font-bold"
            onClick={() => onChange([])}
          >
            clear
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold border transition-colors ${
                on
                  ? 'bg-emerald-800 text-white border-emerald-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
              }`}
            >
              {getLabel ? getLabel(opt) : opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FieldgraphReportPage() {
  const { store, loading, load } = useFieldgraph();
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('ytd', 3)
  );
  const [report, setReport] = useState<FieldgraphReportId>('overview');
  const [diceOpen, setDiceOpen] = useState(true);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [crops, setCrops] = useState<string[]>([]);
  const [farms, setFarms] = useState<string[]>([]);
  const [millGroups, setMillGroups] = useState<string[]>([]);
  const [fieldIds, setFieldIds] = useState<string[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<string[]>([]);

  const dims = useMemo(
    () => (store ? diceDimensionOptions(store) : null),
    [store]
  );

  const filters: FieldgraphDiceFilters = useMemo(
    () => ({
      ...emptyDiceFilters(period.from, period.to),
      seasons,
      crops,
      farms,
      millGroups,
      fieldIds,
      employmentTypes,
    }),
    [
      period.from,
      period.to,
      seasons,
      crops,
      farms,
      millGroups,
      fieldIds,
      employmentTypes,
    ]
  );

  const bundle = useMemo(() => {
    if (!store) return null;
    return buildFieldgraphReport(store, filters);
  }, [store, filters]);

  const activeDiceCount =
    seasons.length +
    crops.length +
    farms.length +
    millGroups.length +
    fieldIds.length +
    employmentTypes.length;

  const clearDice = () => {
    setSeasons([]);
    setCrops([]);
    setFarms([]);
    setMillGroups([]);
    setFieldIds([]);
    setEmploymentTypes([]);
  };

  const exportCsv = () => {
    if (!bundle) return;
    const csv = reportToCsv(report, bundle);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fieldgraph-${report}-${period.from}_${period.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded for current slice');
  };

  const k = bundle?.kpis || {};

  return (
    <FieldgraphWorkbench
      title="Reports"
      titleAccent="Slice & dice"
      description={`${period.label} · filter by season, crop, farm, mill group, field and employment type. Yield, harvest, fleet fuel, labour cost, inputs and regen on one desk.`}
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={exportCsv}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          <PeriodSlicer
            value={period}
            onChange={setPeriod}
            showTrailing
            className="mb-2"
            defaultOpen={false}
          />

          {/* Dimension dice */}
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setDiceOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <SlidersHorizontal className="w-4 h-4 text-emerald-700 dark:text-white shrink-0" />
                <div>
                  <div className="text-sm font-black text-slate-900">
                    Dimensions
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {activeDiceCount
                      ? `${activeDiceCount} filter${activeDiceCount === 1 ? '' : 's'} active`
                      : 'All seasons · crops · fields (no extra filters)'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {activeDiceCount > 0 ? (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      clearDice();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                        clearDice();
                      }
                    }}
                    className="text-[11px] font-bold text-emerald-700 dark:text-white px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/60"
                  >
                    Clear all
                  </span>
                ) : null}
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  {diceOpen ? 'Hide' : 'Show'}
                </span>
              </div>
            </button>
            {diceOpen && dims ? (
              <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-3">
                <ChipMulti
                  label="Season"
                  options={dims.seasons}
                  selected={seasons}
                  onChange={setSeasons}
                />
                <ChipMulti
                  label="Crop"
                  options={dims.crops}
                  selected={crops}
                  onChange={setCrops}
                />
                <ChipMulti
                  label="Farm"
                  options={dims.farms}
                  selected={farms}
                  onChange={setFarms}
                />
                <ChipMulti
                  label="Mill group"
                  options={dims.millGroups}
                  selected={millGroups}
                  onChange={setMillGroups}
                />
                <ChipMulti
                  label="Field"
                  options={dims.fields.map((f) => f.id)}
                  selected={fieldIds}
                  onChange={setFieldIds}
                  getLabel={(id) => {
                    const f = dims.fields.find((x) => x.id === id);
                    return f ? `${f.code} · ${f.name}` : id;
                  }}
                />
                <ChipMulti
                  label="Employment type (labour)"
                  options={dims.employmentTypes}
                  selected={employmentTypes}
                  onChange={setEmploymentTypes}
                  getLabel={(v) =>
                    v === 'temporary'
                      ? 'Temporary / seasonal'
                      : v.charAt(0).toUpperCase() + v.slice(1)
                  }
                />
                <p className="text-[11px] text-slate-500">
                  Period slicer filters dated ops (fleet, labour, inputs,
                  regen). Season / crop / field filters apply to estimates,
                  harvest and all field-linked rows.
                </p>
              </div>
            ) : null}
          </div>

          {/* Report tabs */}
          <div className="flex flex-wrap gap-1.5">
            {FIELDGRAPH_REPORTS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setReport(r.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                  report === r.id
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-neutral-200 bg-white text-neutral-600'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(
              [
                { label: 'Fields in slice', value: String(k.fields ?? '—') },
                { label: 'Hectares', value: String(k.hectares ?? '—') },
                {
                  label: 'Est. tonnes',
                  value: String(k.estimateTonnes ?? '—'),
                },
                {
                  label: 'Actual tonnes',
                  value: String(k.actualTonnes ?? '—'),
                },
                {
                  label: 'Harvest open',
                  value: String(k.harvestOpen ?? '—'),
                },
                {
                  label: 'Fleet fuel (L)',
                  value: String(k.fuelL ?? '—'),
                },
                {
                  label: 'Labour cost',
                  value: formatZar(k.labourCostZar as number),
                },
                {
                  label: 'Avg soil organic C',
                  value:
                    k.avgSoc != null ? `${k.avgSoc}%` : '—',
                },
              ] as Array<{ label: string; value: string }>
            ).map((tile) => (
              <div
                key={tile.label}
                className="rounded-2xl border border-emerald-200 bg-white dark:!border-emerald-400 dark:!bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40 px-4 py-3"
              >
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  {tile.label}
                </div>
                <div className="text-xl font-black tabular-nums">
                  {tile.value}
                </div>
              </div>
            ))}
          </div>

          {bundle && (report === 'overview' || report === 'yield') && (
            <>
              <ReportTable
                title="Yield by season"
                headers={['Season', 'Fields', 'Estimate t', 'Actual t']}
                rows={bundle.bySeason.map((r) => [
                  r.season,
                  r.fields,
                  r.estimate_t,
                  r.actual_t,
                ])}
              />
              <ReportTable
                title="Yield by crop"
                headers={['Crop', 'Fields', 'Ha', 'Estimate t', 'Actual t']}
                rows={bundle.byCrop.map((r) => [
                  r.crop,
                  r.fields,
                  r.hectares,
                  r.estimate_t,
                  r.actual_t,
                ])}
              />
              <ReportTable
                title="Field detail"
                headers={[
                  'Field',
                  'Crop',
                  'Ha',
                  'Est. t',
                  'Act. t',
                  'Quality',
                  'Labour R',
                  'Fuel L',
                ]}
                rows={bundle.byField.map((r) => [
                  `${r.code} · ${r.name}`,
                  r.crop,
                  r.hectares,
                  r.estimate_t,
                  r.actual_t,
                  r.quality_est ?? '—',
                  r.labour_cost,
                  r.fuel_l,
                ])}
              />
            </>
          )}

          {bundle && (report === 'overview' || report === 'harvest') && (
            <ReportTable
              title="Harvest plan (sliced)"
              headers={[
                '#',
                'Field',
                'Crop',
                'Season',
                't',
                'Start',
                'End',
                'Days',
                'Destination',
                'Status',
              ]}
              rows={bundle.harvest.map((r) => [
                r.sequence,
                r.field_code,
                r.crop,
                r.season,
                r.tonnes ?? '—',
                r.planned_date || '—',
                r.planned_end_date || '—',
                r.days ?? '—',
                r.destination,
                r.status,
              ])}
            />
          )}

          {bundle && (report === 'overview' || report === 'fleet') && (
            <>
              <ReportTable
                title="Fleet: fuel util & R/km by vehicle"
                headers={[
                  'Vehicle',
                  'Logs',
                  'Hours',
                  'Fuel L',
                  'Km',
                  'L/h',
                  'L/km',
                  'R/km',
                  'Fuel util %',
                  'Cost R',
                ]}
                rows={bundle.fleetByVehicle.map((r) => [
                  r.vehicle,
                  r.logs,
                  r.hours,
                  r.fuel_l,
                  r.km,
                  r.l_per_hour ?? '—',
                  r.l_per_km ?? '—',
                  r.cost_per_km ?? '—',
                  r.fuel_util_pct ?? '—',
                  r.cost_zar,
                ])}
              />
              <ReportTable
                title="Fleet activity (period)"
                headers={[
                  'Date',
                  'Vehicle',
                  'Field',
                  'Activity',
                  'Hours',
                  'Fuel L',
                  'Km',
                ]}
                rows={bundle.fleetLogs.map((r) => [
                  r.date,
                  r.vehicle,
                  r.field_code,
                  r.activity,
                  r.hours ?? '—',
                  r.fuel_l ?? '—',
                  r.km ?? '—',
                ])}
              />
            </>
          )}

          {bundle && (report === 'overview' || report === 'labour') && (
            <>
              <ReportTable
                title="Labour cost by employment type"
                headers={['Type', 'Logs', 'Hours', 'Cost']}
                rows={bundle.labourByType.map((r) => [
                  r.type,
                  r.logs,
                  r.hours,
                  formatZar(r.cost),
                ])}
              />
              <ReportTable
                title="Labour cost by gang"
                headers={['Gang', 'Logs', 'Hours', 'Cost']}
                rows={bundle.labourByGang.map((r) => [
                  r.gang,
                  r.logs,
                  r.hours,
                  formatZar(r.cost),
                ])}
              />
              <ReportTable
                title="Labour logs (period)"
                headers={[
                  'Date',
                  'Gang',
                  'Type',
                  'Field',
                  'Activity',
                  'HC',
                  'Hours',
                  'Rate',
                  'Cost',
                ]}
                rows={bundle.labourLogs.map((r) => [
                  r.date,
                  r.gang,
                  r.type,
                  r.field_code,
                  r.activity,
                  r.headcount ?? '—',
                  r.hours ?? '—',
                  r.rate_zar ?? '—',
                  formatZar(r.cost_zar),
                ])}
              />
            </>
          )}

          {bundle && (report === 'overview' || report === 'inputs') && (
            <>
              <ReportTable
                title="Inputs by category"
                headers={[
                  'Category',
                  'Lines',
                  'Qty',
                  'Cost',
                  'N kg/ha Σ',
                  'P kg/ha Σ',
                  'K kg/ha Σ',
                ]}
                rows={bundle.inputsByCategory.map((r) => [
                  r.category,
                  r.lines,
                  r.quantity,
                  formatZar(r.cost_zar),
                  r.n_kg,
                  r.p_kg,
                  r.k_kg,
                ])}
              />
              <ReportTable
                title="Applications (period)"
                headers={[
                  'Date',
                  'Field',
                  'Product',
                  'Category',
                  'Qty',
                  'Unit',
                  'Cost',
                ]}
                rows={bundle.applications.map((r) => [
                  r.date,
                  r.field_code,
                  r.product,
                  r.category,
                  r.quantity,
                  r.unit,
                  formatZar(r.cost_zar),
                ])}
              />
            </>
          )}

          {bundle && (report === 'overview' || report === 'regen') && (
            <>
              <div className="grid sm:grid-cols-3 gap-3">
                <KpiMini
                  label="Avg SOC %"
                  value={
                    bundle.regenAvg.soc != null
                      ? `${bundle.regenAvg.soc}%`
                      : '—'
                  }
                />
                <KpiMini
                  label="Avg moisture %"
                  value={
                    bundle.regenAvg.moisture != null
                      ? `${bundle.regenAvg.moisture}%`
                      : '—'
                  }
                />
                <KpiMini
                  label="Samples in slice"
                  value={String(bundle.regenAvg.samples)}
                />
              </div>
              <ReportTable
                title="Regen samples (period)"
                headers={[
                  'Date',
                  'Field',
                  'SOC %',
                  'Moisture %',
                  'Cover %',
                  'Water mm',
                ]}
                rows={bundle.regen.map((r) => [
                  r.date,
                  r.field_code,
                  r.soc ?? '—',
                  r.moisture ?? '—',
                  r.cover ?? '—',
                  r.water_mm ?? '—',
                ])}
              />
            </>
          )}
        </div>
      )}
    </FieldgraphWorkbench>
  );
}

function KpiMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3">
      <div className="text-[10px] font-black uppercase text-emerald-800 dark:text-white">
        {label}
      </div>
      <div className="text-xl font-black tabular-nums">{value}</div>
    </div>
  );
}

function ReportTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-500">
        {title}
        <span className="ml-2 normal-case font-semibold text-slate-400">
          ({rows.length})
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-sm text-slate-500 text-center">
          No rows for this slice — widen filters or load demo estate.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b text-[10px] font-bold uppercase text-slate-400">
                {headers.map((h) => (
                  <th key={h} className="px-3 py-2 text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-50">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-3 py-2 ${
                        j === 0 ? 'font-semibold' : 'tabular-nums'
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
