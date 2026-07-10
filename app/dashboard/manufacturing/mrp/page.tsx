'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers, Loader2, Play, RefreshCw } from 'lucide-react';
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

type Run = {
  id: number;
  run_number: string;
  status: string;
  horizon_days: number;
  started_at?: string;
  completed_at?: string | null;
  summary?: {
    products?: number;
    shortages?: number;
    make_suggestions?: number;
    buy_suggestions?: number;
    total_net_req?: number;
  } | null;
};

type Req = {
  id?: number;
  product_id: number;
  product_name?: string | null;
  product_sku?: string | null;
  product_type?: string | null;
  requirement_date?: string | null;
  gross_req: number;
  on_hand: number;
  scheduled_receipts: number;
  net_req: number;
  planned_order_qty: number;
  action: string;
  source?: string | null;
};

const ACTION_TONE: Record<string, string> = {
  none: 'bg-slate-100 text-slate-600 border-slate-200',
  make: 'bg-violet-50 text-violet-800 border-violet-200',
  buy: 'bg-amber-50 text-amber-900 border-amber-200',
  expedite: 'bg-rose-50 text-rose-800 border-rose-200',
};

export default function MrpPage() {
  return (
    <CompanyRequired>
      <MrpInner />
    </CompanyRequired>
  );
}

function MrpInner() {
  const companyId = getSelectedCompanyId();
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [requirements, setRequirements] = useState<Req[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [warning, setWarning] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<'all' | 'shortages'>('shortages');

  const loadRuns = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/manufacturing/mrp?companyId=${companyId}`);
      const data = await res.json();
      setRuns(data.runs || []);
      setWarning(data.warning);
      if (!selectedId && data.runs?.[0]) setSelectedId(data.runs[0].id);
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedId]);

  const loadRun = useCallback(async () => {
    if (!companyId || !selectedId) {
      setRequirements([]);
      setRun(null);
      return;
    }
    const res = await fetch(
      `/api/manufacturing/mrp?companyId=${companyId}&runId=${selectedId}`
    );
    const data = await res.json();
    setRun(data.run || null);
    setRequirements(data.requirements || []);
  }, [companyId, selectedId]);

  useEffect(() => {
    void loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    void loadRun();
  }, [loadRun]);

  const runMrp = async () => {
    if (!companyId) return;
    setRunning(true);
    try {
      const res = await fetch('/api/manufacturing/mrp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, horizon_days: 90 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'MRP failed');
      toast.success(
        `MRP complete — ${data.summary?.shortages ?? 0} shortages, ${data.summary?.products ?? 0} SKUs`
      );
      setSelectedId(data.run?.id);
      await loadRuns();
      if (data.run?.id) {
        setRun(data.run);
        setRequirements(data.requirements || []);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'MRP failed');
    } finally {
      setRunning(false);
    }
  };

  const visible = useMemo(() => {
    if (filter === 'shortages') return requirements.filter((r) => Number(r.net_req) > 0);
    return requirements;
  }, [requirements, filter]);

  const summary = run?.summary;

  return (
    <ManufacturingPage>
      <ManufacturingHeader
        title="Material"
        titleAccent="requirements"
        description="Classic MRP netting — independent demand from MPS & work orders, BOM explosion, on-hand & scheduled receipts, make/buy actions."
        action={
          <button
            type="button"
            disabled={running}
            onClick={() => void runMrp()}
            className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2 shadow-md shadow-cyan-500/15"
          >
            {running ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Run MRP now
          </button>
        }
      />

      <SchemaHint message={warning} />

      {/* Explainer — light */}
      <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-sky-50/80 to-cyan-50 p-5 sm:p-6 mb-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white border border-cyan-100 flex items-center justify-center shrink-0 shadow-sm">
            <Layers className="w-5 h-5 text-[#00b4d8]" />
          </div>
          <div>
            <h3 className="font-black text-lg text-slate-800 mb-1">How this engine works</h3>
            <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Pull independent demand from active MPS firm/forecast + open work orders</li>
              <li>Explode finished goods through active BOMs (qty × scrap factor)</li>
              <li>Net gross requirements against on-hand stock and released receipts</li>
              <li>Emit make (has BOM) or buy/expedite actions for shortages</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <TelemetryCard
          label="Last run SKUs"
          value={summary?.products ?? requirements.length}
          accent="slate"
        />
        <TelemetryCard
          label="Shortages"
          value={summary?.shortages ?? visible.filter((r) => r.net_req > 0).length}
          accent="rose"
        />
        <TelemetryCard
          label="Make"
          value={summary?.make_suggestions ?? requirements.filter((r) => r.action === 'make').length}
          accent="violet"
        />
        <TelemetryCard
          label="Buy / expedite"
          value={
            summary?.buy_suggestions ??
            requirements.filter((r) => r.action === 'buy' || r.action === 'expedite').length
          }
          accent="amber"
        />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : runs.length === 0 && !running ? (
        <EmptyMission
          title="No MRP runs yet"
          body="Activate an MPS plan, define BOMs, then run material requirements planning to see net shortages and make/buy suggestions against live inventory."
          action={
            <button
              type="button"
              onClick={() => void runMrp()}
              className="btn-primary !py-2.5 !px-6 text-sm inline-flex items-center gap-2"
            >
              <Play className="w-4 h-4" /> Run first MRP
            </button>
          }
        />
      ) : (
        <div className="grid lg:grid-cols-[220px_1fr] gap-4">
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-1 mb-1">
              Run history
            </div>
            {runs.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={`w-full text-left rounded-2xl border px-3 py-2.5 transition-all ${
                  selectedId === r.id
                    ? 'border-[#00b4d8] bg-sky-50'
                    : 'border-neutral-200 bg-white hover:border-neutral-300'
                }`}
              >
                <div className="font-mono text-xs font-bold text-[#0077b6]">{r.run_number}</div>
                <div className="flex items-center gap-2 mt-1">
                  <StatusPill
                    label={r.status}
                    className={
                      r.status === 'complete'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : r.status === 'failed'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-amber-50 text-amber-900 border-amber-200'
                    }
                  />
                </div>
                <div className="text-[10px] text-neutral-400 mt-1">
                  {r.completed_at
                    ? new Date(r.completed_at).toLocaleString()
                    : r.started_at
                      ? new Date(r.started_at).toLocaleString()
                      : '—'}
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 bg-slate-50/50">
              <div>
                <div className="font-bold text-slate-800 font-mono">
                  {run?.run_number || '—'}
                </div>
                <div className="text-[11px] text-neutral-500">
                  Horizon {run?.horizon_days ?? 90} days · {requirements.length} requirement lines
                </div>
              </div>
              <div className="flex gap-1.5">
                {(['shortages', 'all'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border ${
                      filter === f
                        ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                        : 'border-neutral-200 bg-white text-neutral-600'
                    }`}
                  >
                    {f}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void loadRun()}
                  className="p-1.5 rounded-full border border-neutral-200 text-neutral-500 hover:bg-white"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {visible.length === 0 ? (
              <div className="p-12 text-center text-sm text-neutral-500">
                {filter === 'shortages'
                  ? 'No shortages on this run — materials cover demand.'
                  : 'No requirement lines.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 text-left text-[10px] font-black uppercase tracking-wider text-neutral-400">
                      <th className="px-4 py-3">Product</th>
                      <th className="px-3 py-3 text-right">Gross</th>
                      <th className="px-3 py-3 text-right">On hand</th>
                      <th className="px-3 py-3 text-right">Receipts</th>
                      <th className="px-3 py-3 text-right">Net</th>
                      <th className="px-3 py-3 text-right">Planned</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-3 py-3">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r, i) => (
                      <tr
                        key={r.id || `${r.product_id}-${i}`}
                        className={`border-b border-neutral-50 ${
                          Number(r.net_req) > 0 ? 'bg-rose-50/20' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-slate-800">
                            {r.product_name || `Product #${r.product_id}`}
                          </div>
                          {r.product_sku && (
                            <div className="text-[11px] font-mono text-neutral-400">
                              {r.product_sku}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.gross_req}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-neutral-600">
                          {r.on_hand}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-neutral-600">
                          {r.scheduled_receipts}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-black text-slate-900">
                          {r.net_req}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[#0077b6]">
                          {r.planned_order_qty}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusPill
                            label={r.action}
                            className={ACTION_TONE[r.action] || ACTION_TONE.none}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-neutral-400 font-mono max-w-[120px] truncate">
                          {r.source || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </ManufacturingPage>
  );
}
