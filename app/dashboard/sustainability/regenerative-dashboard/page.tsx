'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, Plus, Target, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  TARGET_METRICS,
  MIGRATION_HINT,
  statusBadge,
} from '@/lib/sustainability/types';

type TargetRow = {
  id: number;
  name: string;
  metric: string;
  unit?: string | null;
  baseline_year?: number | null;
  baseline_value?: number | null;
  target_year?: number | null;
  target_value?: number | null;
  reduction_pct?: number | null;
  pathway?: string | null;
  status?: string;
  framework?: string | null;
  current_value?: number | null;
  progress_pct?: number | null;
};

export default function RegenerativeDashboardPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [summaryHub, setSummaryHub] = useState<{
    inventory?: { total_label?: string };
    resources?: {
      diversion_pct?: number | null;
      renewable_pct?: number | null;
      water_withdrawal?: number;
    };
    initiatives?: { in_progress?: number; total?: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    name: '',
    metric: 'ghg_total',
    unit: 'tCO2e',
    baseline_year: String(new Date().getFullYear() - 1),
    baseline_value: '',
    target_year: String(new Date().getFullYear() + 5),
    target_value: '',
    reduction_pct: '',
    framework: 'internal',
    notes: '',
  });

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const p = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) p.set('privyUserId', privyUserId);
      const [tRes, sRes] = await Promise.all([
        fetch(`/api/sustainability/targets?${p}`),
        fetch(`/api/sustainability/summary?${p}`),
      ]);
      const tJson = await tRes.json();
      const sJson = await sRes.json();
      setTargets(tJson.targets || []);
      setWarning(tJson.warning || tJson.hint || null);
      setSummaryHub(sJson);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    const res = await fetch('/api/sustainability/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        name: form.name,
        metric: form.metric,
        unit: form.unit,
        baseline_year: form.baseline_year ? Number(form.baseline_year) : null,
        baseline_value: form.baseline_value
          ? Number(form.baseline_value)
          : null,
        target_year: form.target_year ? Number(form.target_year) : null,
        target_value: form.target_value ? Number(form.target_value) : null,
        reduction_pct: form.reduction_pct ? Number(form.reduction_pct) : null,
        framework: form.framework,
        notes: form.notes || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || json.hint || 'Failed');
      return;
    }
    toast.success('Target created');
    setShow(false);
    await load();
  };

  const setStatus = async (id: number, status: string) => {
    await fetch('/api/sustainability/targets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, privyUserId, id, status }),
    });
    await load();
  };

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/sustainability"
        backLabel="Sustainability"
        eyebrow="Net-zero pathway · Regenerative KPIs"
        title="Targets"
        titleAccent="& trajectory"
        description="Set baseline→horizon reduction targets. Progress uses live inventory and resource data. Pair with initiatives and SDG projects."
        action={
          <button
            type="button"
            onClick={() => setShow(true)}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> New target
          </button>
        }
      />

      {warning && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {warning}
          <span className="mt-1 block font-mono text-xs">{MIGRATION_HINT}</span>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">
            GHG inventory
          </div>
          <div className="text-lg font-black text-emerald-700">
            {summaryHub?.inventory?.total_label || '—'}
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">
            Diversion
          </div>
          <div className="text-lg font-black">
            {summaryHub?.resources?.diversion_pct != null
              ? `${summaryHub.resources.diversion_pct}%`
              : '—'}
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">
            Renewable
          </div>
          <div className="text-lg font-black">
            {summaryHub?.resources?.renewable_pct != null
              ? `${summaryHub.resources.renewable_pct}%`
              : '—'}
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">
            Initiatives live
          </div>
          <div className="text-lg font-black text-violet-700">
            {summaryHub?.initiatives?.in_progress ?? 0}
            <span className="text-xs font-medium text-neutral-400">
              /{summaryHub?.initiatives?.total ?? 0}
            </span>
          </div>
        </Panel>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : targets.length === 0 ? (
        <Panel className="p-10 text-center">
          <Target className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="font-semibold">No reduction targets yet</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">
            Example: 42% absolute Scope 1+2 cut by 2030 vs 2024 baseline (SBTi-style
            internal pathway).
          </p>
          <button
            type="button"
            onClick={() => setShow(true)}
            className="btn-primary !py-2 !px-4 text-sm mt-4"
          >
            Set first target
          </button>
        </Panel>
      ) : (
        <div className="space-y-3">
          {targets.map((t) => {
            const pct = t.progress_pct ?? 0;
            return (
              <Panel key={t.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadge(t.status)}`}
                      >
                        {t.status}
                      </span>
                      {t.framework && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-neutral-50 text-neutral-600 border-neutral-200">
                          {t.framework}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900">{t.name}</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {TARGET_METRICS.find((m) => m.value === t.metric)?.label ||
                        t.metric}
                      {t.reduction_pct != null && (
                        <span className="text-emerald-700 font-semibold">
                          {' '}
                          · −{t.reduction_pct}%
                        </span>
                      )}
                      {t.baseline_year && t.target_year && (
                        <span>
                          {' '}
                          · {t.baseline_year} → {t.target_year}
                        </span>
                      )}
                    </p>
                  </div>
                  <TrendingDown className="w-5 h-5 text-emerald-500 shrink-0" />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl bg-neutral-50 border px-3 py-2">
                    <div className="text-neutral-400 font-semibold uppercase text-[10px]">
                      Baseline
                    </div>
                    <div className="font-black">
                      {t.baseline_value ?? '—'} {t.unit}
                    </div>
                  </div>
                  <div className="rounded-xl bg-neutral-50 border px-3 py-2">
                    <div className="text-neutral-400 font-semibold uppercase text-[10px]">
                      Current
                    </div>
                    <div className="font-black text-[#00b4d8]">
                      {t.current_value != null ? t.current_value : '—'} {t.unit}
                    </div>
                  </div>
                  <div className="rounded-xl bg-neutral-50 border px-3 py-2">
                    <div className="text-neutral-400 font-semibold uppercase text-[10px]">
                      Target
                    </div>
                    <div className="font-black text-emerald-700">
                      {t.target_value ?? '—'} {t.unit}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] font-bold text-neutral-500 mb-1">
                    <span>Progress to target</span>
                    <span>{t.progress_pct != null ? `${pct}%` : '—'}</span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => void setStatus(t.id, 'achieved')}
                      className="text-xs font-semibold text-emerald-700"
                    >
                      Mark achieved
                    </button>
                  )}
                  <Link
                    href="/dashboard/sustainability/initiatives"
                    className="text-xs font-semibold text-[#00b4d8]"
                  >
                    Link initiatives →
                  </Link>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg">New reduction target</h3>
            <input
              className="input"
              placeholder="Name * (e.g. Net-zero 2035 pathway)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className="input"
              value={form.metric}
              onChange={(e) => {
                const m = TARGET_METRICS.find((x) => x.value === e.target.value);
                setForm({
                  ...form,
                  metric: e.target.value,
                  unit: m?.unit || form.unit,
                });
              }}
            >
              {TARGET_METRICS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                type="number"
                placeholder="Baseline year"
                value={form.baseline_year}
                onChange={(e) =>
                  setForm({ ...form, baseline_year: e.target.value })
                }
              />
              <input
                className="input"
                type="number"
                placeholder="Baseline value"
                value={form.baseline_value}
                onChange={(e) =>
                  setForm({ ...form, baseline_value: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                type="number"
                placeholder="Target year"
                value={form.target_year}
                onChange={(e) =>
                  setForm({ ...form, target_year: e.target.value })
                }
              />
              <input
                className="input"
                type="number"
                placeholder="Target value"
                value={form.target_value}
                onChange={(e) =>
                  setForm({ ...form, target_value: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                type="number"
                placeholder="Reduction % (optional)"
                value={form.reduction_pct}
                onChange={(e) =>
                  setForm({ ...form, reduction_pct: e.target.value })
                }
              />
              <select
                className="input"
                value={form.framework}
                onChange={(e) =>
                  setForm({ ...form, framework: e.target.value })
                }
              >
                {['internal', 'SBTi', 'NetZero', 'CSRD', 'other'].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary !py-2 !px-4 text-sm"
                onClick={() => setShow(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary !py-2 !px-4 text-sm"
                onClick={() => void create()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </RelationshipPage>
  );
}
