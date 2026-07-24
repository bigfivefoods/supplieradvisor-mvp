'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { Info, Leaf, Loader2, Plus, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  GHG_SCOPES,
  EMISSION_CATEGORIES,
  DATA_QUALITY,
  DEFAULT_FACTORS,
  defaultFactorFor,
  MIGRATION_HINT,
  formatKgCo2e,
  categoryLabel,
} from '@/lib/sustainability/types';

type Entry = {
  id: number;
  scope: string;
  category: string;
  category_label?: string;
  activity_label?: string | null;
  activity_amount?: number | null;
  activity_unit?: string | null;
  emission_factor?: number | null;
  amount_kgco2e: number;
  period_start?: string | null;
  period_end?: string | null;
  facility_name?: string | null;
  data_quality?: string | null;
  notes?: string | null;
};

type Summary = {
  by_scope: Record<string, number>;
  total_kg: number;
  total_label: string;
  logistics_kg: number;
  logistics_label: string;
  logistics_shipments: number;
  combined_label: string;
  entry_count: number;
};

export default function GhgInventoryPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState('all');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    scope: '1',
    category: 'stationary_combustion',
    activity_label: '',
    activity_amount: '',
    activity_unit: 'litres',
    emission_factor: '',
    amount_kgco2e: '',
    period_start: '',
    period_end: '',
    facility_name: '',
    data_quality: 'calculated',
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
      if (scopeFilter !== 'all') p.set('scope', scopeFilter);
      const res = await fetch(`/api/sustainability/inventory?${p}`);
      const json = await res.json();
      setEntries(json.entries || []);
      setSummary(json.summary || null);
      setWarning(json.warning || json.hint || null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, scopeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const cats = useMemo(
    () => EMISSION_CATEGORIES[form.scope] || EMISSION_CATEGORIES['3'],
    [form.scope]
  );

  useEffect(() => {
    // When scope changes, reset category to first of that scope
    const list = EMISSION_CATEGORIES[form.scope] || [];
    if (list.length && !list.some((c) => c.value === form.category)) {
      setForm((f) => ({ ...f, category: list[0].value }));
    }
  }, [form.scope, form.category]);

  const applyDefaultFactor = () => {
    const d = defaultFactorFor(form.category);
    if (!d) {
      toast.message('No default factor for this category — enter manually');
      return;
    }
    setForm((f) => ({
      ...f,
      emission_factor: String(d.factor),
      activity_unit: d.unit,
      data_quality: 'calculated',
    }));
    toast.success(`Applied ${d.source}`);
  };

  const create = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/sustainability/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          scope: form.scope,
          category: form.category,
          activity_label: form.activity_label || null,
          activity_amount: form.activity_amount
            ? Number(form.activity_amount)
            : null,
          activity_unit: form.activity_unit || null,
          emission_factor: form.emission_factor
            ? Number(form.emission_factor)
            : null,
          amount_kgco2e: form.amount_kgco2e
            ? Number(form.amount_kgco2e)
            : undefined,
          period_start: form.period_start || null,
          period_end: form.period_end || null,
          facility_name: form.facility_name || null,
          data_quality: form.data_quality,
          notes: form.notes || null,
          factor_source: defaultFactorFor(form.category)?.source || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.hint || 'Failed');
      toast.success('Emission line added');
      setShow(false);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    const res = await fetch('/api/sustainability/inventory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, privyUserId, id }),
    });
    if (!res.ok) {
      const j = await res.json();
      toast.error(j.error || 'Delete failed');
      return;
    }
    toast.success('Removed');
    await load();
  };

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/sustainability"
        backLabel="Sustainability"
        eyebrow="GHG Protocol · Inventory"
        title="Carbon"
        titleAccent="ledger"
        description="Structured Scope 1, 2, and 3 emissions with activity data and factors. Logistics estimates from shipments sit alongside — clearly labelled."
        action={
          <button
            type="button"
            onClick={() => setShow(true)}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add emission
          </button>
        }
      />

      <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-sky-900 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Default factors are order-of-magnitude for ops awareness. Replace with
          local grid / fuel factors for disclosure. Not a certified inventory.
        </span>
      </div>

      {warning && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {warning}
          <span className="mt-1 block font-mono text-xs">{MIGRATION_HINT}</span>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 lg:grid-cols-5 gap-2">
        {GHG_SCOPES.map((sc) => (
          <Panel key={sc.value} className="p-3">
            <div className="text-[10px] font-bold uppercase text-neutral-400">
              {sc.label}
            </div>
            <div className="text-lg font-black text-slate-900 sa-metric-value-sm">
              {formatKgCo2e(summary?.by_scope?.[sc.value] || 0)}
            </div>
            <p className="text-[10px] text-neutral-500 mt-0.5 line-clamp-2">
              {sc.desc}
            </p>
          </Panel>
        ))}
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">
            Inventory total
          </div>
          <div className="text-lg font-black text-emerald-700">
            {summary?.total_label || '—'}
          </div>
        </Panel>
        <Panel className="p-3 col-span-2 lg:col-span-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-neutral-400">
            <Truck className="w-3 h-3" /> Logistics est.
          </div>
          <div className="text-lg font-black text-[#00b4d8]">
            {summary?.logistics_label || '—'}
          </div>
          <p className="text-[10px] text-neutral-500">
            {summary?.logistics_shipments ?? 0} shipments ·{' '}
            <Link href="/dashboard/sustainability/reports" className="text-[#00b4d8]">
              pack
            </Link>
          </p>
        </Panel>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 items-center">
        <select
          className="input !py-1.5 !text-xs w-auto"
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
        >
          <option value="all">All scopes</option>
          {GHG_SCOPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-500">
          Combined (inventory + logistics):{' '}
          <strong>{summary?.combined_label || '—'}</strong>
        </span>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : entries.length === 0 ? (
        <Panel className="p-10 text-center">
          <Leaf className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-800">No inventory lines yet</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">
            Log Scope 1 fuel, Scope 2 electricity, and Scope 3 value-chain
            categories. Logistics CO₂e still estimates from shipments automatically.
          </p>
          <button
            type="button"
            onClick={() => setShow(true)}
            className="btn-primary !py-2 !px-4 text-sm mt-4"
          >
            Add first emission
          </button>
        </Panel>
      ) : (
        <ul className="bg-white border rounded-3xl divide-y overflow-hidden">
          {entries.map((e) => {
            const sc = GHG_SCOPES.find((s) => s.value === e.scope);
            return (
              <li
                key={e.id}
                className="px-4 py-3 flex flex-wrap justify-between gap-3 items-start"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${sc?.color || ''}`}
                    >
                      Scope {e.scope}
                    </span>
                    <span className="text-[10px] font-semibold text-neutral-500">
                      {e.data_quality || 'estimated'}
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-slate-900">
                    {e.category_label || categoryLabel(e.category)}
                    {e.activity_label ? ` · ${e.activity_label}` : ''}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {e.activity_amount != null && (
                      <span>
                        {e.activity_amount} {e.activity_unit}
                        {e.emission_factor != null && ` × ${e.emission_factor}`}
                        {' · '}
                      </span>
                    )}
                    {e.facility_name && <span>{e.facility_name} · </span>}
                    {(e.period_start || e.period_end) && (
                      <span>
                        {e.period_start || '?'} → {e.period_end || '?'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-emerald-700 text-sm">
                    {formatKgCo2e(Number(e.amount_kgco2e) || 0)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void remove(e.id)}
                    className="text-neutral-400 hover:text-rose-600"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg">Add emission line</h3>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="input"
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
              >
                {GHG_SCOPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {cats.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              className="input"
              placeholder="Activity label (e.g. Site diesel, HQ grid)"
              value={form.activity_label}
              onChange={(e) =>
                setForm({ ...form, activity_label: e.target.value })
              }
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                className="input"
                type="number"
                placeholder="Amount"
                value={form.activity_amount}
                onChange={(e) =>
                  setForm({ ...form, activity_amount: e.target.value })
                }
              />
              <input
                className="input"
                placeholder="Unit"
                value={form.activity_unit}
                onChange={(e) =>
                  setForm({ ...form, activity_unit: e.target.value })
                }
              />
              <input
                className="input"
                type="number"
                step="any"
                placeholder="Factor"
                value={form.emission_factor}
                onChange={(e) =>
                  setForm({ ...form, emission_factor: e.target.value })
                }
              />
            </div>
            <button
              type="button"
              onClick={applyDefaultFactor}
              className="text-xs font-semibold text-[#00b4d8]"
            >
              Apply default factor for category
            </button>
            <input
              className="input"
              type="number"
              step="any"
              placeholder="Or enter kg CO₂e directly"
              value={form.amount_kgco2e}
              onChange={(e) =>
                setForm({ ...form, amount_kgco2e: e.target.value })
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                type="date"
                value={form.period_start}
                onChange={(e) =>
                  setForm({ ...form, period_start: e.target.value })
                }
              />
              <input
                className="input"
                type="date"
                value={form.period_end}
                onChange={(e) =>
                  setForm({ ...form, period_end: e.target.value })
                }
              />
            </div>
            <input
              className="input"
              placeholder="Facility / site"
              value={form.facility_name}
              onChange={(e) =>
                setForm({ ...form, facility_name: e.target.value })
              }
            />
            <select
              className="input"
              value={form.data_quality}
              onChange={(e) =>
                setForm({ ...form, data_quality: e.target.value })
              }
            >
              {DATA_QUALITY.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <textarea
              className="input min-h-[56px]"
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
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
                disabled={saving}
                className="btn-primary !py-2 !px-4 text-sm"
                onClick={() => void create()}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <details className="mt-6 text-xs text-neutral-500">
        <summary className="cursor-pointer font-semibold">Default factors</summary>
        <ul className="mt-2 space-y-1">
          {DEFAULT_FACTORS.map((f) => (
            <li key={f.category}>
              {categoryLabel(f.category)}: {f.factor} {f.factor_unit} — {f.source}
            </li>
          ))}
        </ul>
      </details>
    </RelationshipPage>
  );
}
