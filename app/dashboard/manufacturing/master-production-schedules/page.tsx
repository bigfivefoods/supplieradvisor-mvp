'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarRange, Loader2, Plus, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  EmptyMission,
  ManufacturingHeader,
  ManufacturingPage,
  SchemaHint,
  StatusPill,
  TelemetryCard,
} from '@/components/manufacturing/ManufacturingShell';

type Plan = {
  id: number;
  name: string;
  horizon_weeks: number;
  start_date: string;
  status: string;
  notes?: string | null;
};

type Line = {
  id: number;
  product_id: number;
  product_name?: string | null;
  product_sku?: string | null;
  week_start: string;
  forecast_qty: number;
  firm_qty: number;
  demand_qty: number;
  supply_qty: number;
  available_qty: number;
};

export default function MpsPage() {
  return (
    <CompanyRequired>
      <MpsInner />
    </CompanyRequired>
  );
}

function MpsInner() {
  const companyId = getSelectedCompanyId();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [warning, setWarning] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [loadingLines, setLoadingLines] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadPlans = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/manufacturing/mps?companyId=${companyId}`);
      const data = await res.json();
      setPlans(data.plans || []);
      setWarning(data.warning);
      if (!selectedId && data.plans?.[0]) {
        setSelectedId(data.plans[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedId]);

  const loadPlan = useCallback(async () => {
    if (!companyId || !selectedId) {
      setLines([]);
      setPlan(null);
      return;
    }
    setLoadingLines(true);
    try {
      const res = await fetch(
        `/api/manufacturing/mps?companyId=${companyId}&planId=${selectedId}`
      );
      const data = await res.json();
      setPlan(data.plan || null);
      setLines(data.lines || []);
    } finally {
      setLoadingLines(false);
    }
  }, [companyId, selectedId]);

  useEffect(() => {
    void loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  const weeks = useMemo(() => {
    const set = new Set(lines.map((l) => l.week_start));
    return [...set].sort();
  }, [lines]);

  const products = useMemo(() => {
    const map = new Map<number, { name: string; sku?: string | null }>();
    for (const l of lines) {
      if (!map.has(l.product_id)) {
        map.set(l.product_id, {
          name: l.product_name || `Product #${l.product_id}`,
          sku: l.product_sku,
        });
      }
    }
    return [...map.entries()];
  }, [lines]);

  const lineMap = useMemo(() => {
    const m = new Map<string, Line>();
    for (const l of lines) {
      m.set(`${l.product_id}|${l.week_start}`, l);
    }
    return m;
  }, [lines]);

  const createPlan = async () => {
    if (!companyId) return;
    setCreating(true);
    try {
      const res = await fetch('/api/manufacturing/mps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'create_plan',
          name: `MPS ${new Date().toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}`,
          horizon_weeks: 12,
          seed_products: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      toast.success('MPS plan created — seeded from finished goods');
      setSelectedId(data.plan?.id);
      await loadPlans();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setCreating(false);
    }
  };

  const updateCell = async (
    productId: number,
    weekStart: string,
    field: 'forecast_qty' | 'firm_qty',
    value: number
  ) => {
    if (!companyId || !selectedId) return;
    const existing = lineMap.get(`${productId}|${weekStart}`);
    const forecast = field === 'forecast_qty' ? value : Number(existing?.forecast_qty || 0);
    const firm = field === 'firm_qty' ? value : Number(existing?.firm_qty || 0);

    setSaving(true);
    try {
      const res = await fetch('/api/manufacturing/mps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'upsert_line',
          plan_id: selectedId,
          product_id: productId,
          week_start: weekStart,
          forecast_qty: forecast,
          firm_qty: firm,
          demand_qty: forecast + firm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      // optimistic local update
      setLines((prev) => {
        const key = `${productId}|${weekStart}`;
        const idx = prev.findIndex((l) => `${l.product_id}|${l.week_start}` === key);
        const next = {
          ...(existing || {
            id: data.line?.id,
            product_id: productId,
            week_start: weekStart,
            product_name: products.find(([id]) => id === productId)?.[1].name,
          }),
          forecast_qty: forecast,
          firm_qty: firm,
          demand_qty: forecast + firm,
          supply_qty: existing?.supply_qty || 0,
          available_qty: existing?.available_qty || 0,
        } as Line;
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = next;
          return copy;
        }
        return [...prev, next];
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const activatePlan = async () => {
    if (!companyId || !selectedId) return;
    const res = await fetch('/api/manufacturing/mps', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, id: selectedId, status: 'active' }),
    });
    if (!res.ok) {
      toast.error('Activate failed');
      return;
    }
    toast.success('MPS active — demand feeds MRP');
    void loadPlans();
    void loadPlan();
  };

  const firmToOrders = async () => {
    if (!companyId || !selectedId) return;
    if (!confirm('Create work orders from all firm quantities in this plan?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/manufacturing/mps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'firm_to_orders',
          plan_id: selectedId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Firm failed');
      toast.success(`Created ${data.created || 0} work orders`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const totalFirm = lines.reduce((s, l) => s + Number(l.firm_qty || 0), 0);
  const totalForecast = lines.reduce((s, l) => s + Number(l.forecast_qty || 0), 0);

  return (
    <ManufacturingPage>
      <ManufacturingHeader
        title="Master"
        titleAccent="schedule"
        description="Time-phased demand horizon — forecast vs firm. Activate to feed MRP. Firm buckets push straight to work orders."
        action={
          <button
            type="button"
            disabled={creating}
            onClick={() => void createPlan()}
            className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            New MPS plan
          </button>
        }
      />

      <SchemaHint message={warning} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <TelemetryCard label="Plans" value={plans.length} accent="slate" />
        <TelemetryCard
          label="Horizon"
          value={plan ? `${plan.horizon_weeks}w` : '—'}
          accent="cyan"
        />
        <TelemetryCard label="Forecast Σ" value={totalForecast} accent="violet" />
        <TelemetryCard label="Firm Σ" value={totalFirm} sub="ready to release" accent="emerald" />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : plans.length === 0 ? (
        <EmptyMission
          title="No master production schedule"
          body="Create a 12-week horizon seeded from finished goods. Enter forecast and firm demand, activate the plan, then run MRP."
          action={
            <button
              type="button"
              onClick={() => void createPlan()}
              className="btn-primary !py-2.5 !px-6 text-sm"
            >
              <Plus className="w-4 h-4 inline mr-1" /> Create MPS
            </button>
          }
        />
      ) : (
        <div className="grid lg:grid-cols-[240px_1fr] gap-4">
          <div className="space-y-2">
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left rounded-2xl border px-3.5 py-3 transition-all ${
                  selectedId === p.id
                    ? 'border-[#00b4d8] bg-sky-50 shadow-sm'
                    : 'border-neutral-200 bg-white hover:border-neutral-300'
                }`}
              >
                <div className="font-bold text-sm text-slate-800 truncate">{p.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <StatusPill
                    label={p.status}
                    className={
                      p.status === 'active'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }
                  />
                  <span className="text-[10px] text-neutral-400 font-mono">
                    {p.horizon_weeks}w
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            {plan && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 bg-slate-50/50">
                <div className="flex items-center gap-2 min-w-0">
                  <CalendarRange className="w-4 h-4 text-[#00b4d8] shrink-0" />
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 truncate">{plan.name}</div>
                    <div className="text-[11px] text-neutral-500">
                      From {plan.start_date} · {plan.horizon_weeks} weeks
                      {saving && ' · saving…'}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {plan.status !== 'active' && (
                    <button
                      type="button"
                      onClick={() => void activatePlan()}
                      className="btn-secondary !py-2 !px-4 text-xs"
                    >
                      Activate plan
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={saving || totalFirm <= 0}
                    onClick={() => void firmToOrders()}
                    className="btn-primary !py-2 !px-4 text-xs inline-flex items-center gap-1.5"
                  >
                    <Rocket className="w-3.5 h-3.5" /> Firm → work orders
                  </button>
                </div>
              </div>
            )}

            {loadingLines ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
              </div>
            ) : products.length === 0 ? (
              <div className="p-10 text-center text-sm text-neutral-500">
                No product rows. Create finished goods in Inventory, then create a new MPS plan to
                seed the grid.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-xs w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-white">
                      <th className="sticky left-0 bg-white z-10 px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-neutral-400 min-w-[160px]">
                        Product
                      </th>
                      {weeks.map((w) => (
                        <th
                          key={w}
                          className="px-2 py-2.5 text-center text-[10px] font-black uppercase tracking-wider text-neutral-400 min-w-[100px]"
                        >
                          {new Date(w + 'T12:00:00').toLocaleDateString('en-ZA', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(([pid, meta]) => (
                      <tr key={pid} className="border-b border-neutral-50 hover:bg-sky-50/30">
                        <td className="sticky left-0 bg-white z-10 px-3 py-2 font-semibold text-slate-800 border-r border-neutral-50">
                          <div className="truncate max-w-[150px]">{meta.name}</div>
                          {meta.sku && (
                            <div className="font-mono text-[10px] text-neutral-400">{meta.sku}</div>
                          )}
                        </td>
                        {weeks.map((w) => {
                          const cell = lineMap.get(`${pid}|${w}`);
                          return (
                            <td key={w} className="px-1.5 py-1.5 align-top">
                              <div className="space-y-1">
                                <input
                                  type="number"
                                  title="Forecast"
                                  className="w-full rounded-lg border border-neutral-200 px-1.5 py-1 text-center tabular-nums bg-slate-50/80"
                                  placeholder="F"
                                  defaultValue={cell?.forecast_qty || ''}
                                  onBlur={(e) => {
                                    const v = Number(e.target.value || 0);
                                    if (v !== Number(cell?.forecast_qty || 0)) {
                                      void updateCell(pid, w, 'forecast_qty', v);
                                    }
                                  }}
                                />
                                <input
                                  type="number"
                                  title="Firm"
                                  className="w-full rounded-lg border border-emerald-200 px-1.5 py-1 text-center tabular-nums bg-emerald-50/50 font-semibold text-emerald-900"
                                  placeholder="Firm"
                                  defaultValue={cell?.firm_qty || ''}
                                  onBlur={(e) => {
                                    const v = Number(e.target.value || 0);
                                    if (v !== Number(cell?.firm_qty || 0)) {
                                      void updateCell(pid, w, 'firm_qty', v);
                                    }
                                  }}
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2 text-[10px] text-neutral-400 border-t border-neutral-50">
                  Grey = forecast · Green = firm (commits to production). Tab out of a cell to save.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ManufacturingPage>
  );
}
