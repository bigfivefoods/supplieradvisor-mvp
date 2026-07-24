'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Droplets, Loader2, Plus, Trash2, Zap, Recycle } from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  RESOURCE_TYPES,
  RESOURCE_CATEGORIES,
  MIGRATION_HINT,
} from '@/lib/sustainability/types';

type Resource = {
  id: number;
  resource_type: string;
  category: string;
  amount: number;
  unit: string;
  period_start?: string | null;
  period_end?: string | null;
  facility_name?: string | null;
  notes?: string | null;
};

export default function WaterWasteEnergyPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [rows, setRows] = useState<Resource[]>([]);
  const [kpis, setKpis] = useState<{
    diversion_pct?: number | null;
    renewable_pct?: number | null;
    water_withdrawal?: number;
    waste_landfill?: number;
    energy_kwh?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [tab, setTab] = useState('water');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    resource_type: 'water',
    category: 'withdrawal',
    amount: '',
    unit: 'm3',
    period_start: '',
    period_end: '',
    facility_name: '',
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
      const res = await fetch(`/api/sustainability/resources?${p}`);
      const json = await res.json();
      setRows(json.resources || []);
      setKpis(json.kpis || null);
      setWarning(json.warning || json.hint || null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const cats = RESOURCE_CATEGORIES[form.resource_type] || [];
  const filtered = useMemo(
    () => rows.filter((r) => r.resource_type === tab),
    [rows, tab]
  );

  const openCreate = (type: string) => {
    const list = RESOURCE_CATEGORIES[type] || [];
    setForm({
      resource_type: type,
      category: list[0]?.value || '',
      amount: '',
      unit: list[0]?.unit || 'm3',
      period_start: '',
      period_end: '',
      facility_name: '',
      notes: '',
    });
    setShow(true);
  };

  const create = async () => {
    if (!form.amount) {
      toast.error('Amount required');
      return;
    }
    const res = await fetch('/api/sustainability/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        ...form,
        amount: Number(form.amount),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || json.hint || 'Failed');
      return;
    }
    toast.success('Resource metric logged');
    setShow(false);
    await load();
  };

  const remove = async (id: number) => {
    const res = await fetch('/api/sustainability/resources', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, privyUserId, id }),
    });
    if (!res.ok) {
      toast.error('Delete failed');
      return;
    }
    await load();
  };

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/sustainability"
        backLabel="Sustainability"
        eyebrow="Resource stewardship"
        title="Water · waste"
        titleAccent="· energy"
        description="Operational metrics for water withdrawal, waste streams, and energy mix — diversion rate and renewable share calculated live."
        action={
          <button
            type="button"
            onClick={() => openCreate(tab)}
            className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Log metric
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
          <Droplets className="w-4 h-4 text-sky-600 mb-1" />
          <div className="text-[10px] font-bold uppercase text-neutral-400">
            Water withdrawal
          </div>
          <div className="text-xl font-black">
            {kpis?.water_withdrawal ?? 0}{' '}
            <span className="text-xs font-medium text-neutral-400">m³</span>
          </div>
        </Panel>
        <Panel className="p-3">
          <Recycle className="w-4 h-4 text-emerald-600 mb-1" />
          <div className="text-[10px] font-bold uppercase text-neutral-400">
            Diversion rate
          </div>
          <div className="text-xl font-black text-emerald-700">
            {kpis?.diversion_pct != null ? `${kpis.diversion_pct}%` : '—'}
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">
            Landfill
          </div>
          <div className="text-xl font-black">
            {kpis?.waste_landfill ?? 0}{' '}
            <span className="text-xs font-medium text-neutral-400">t</span>
          </div>
        </Panel>
        <Panel className="p-3">
          <Zap className="w-4 h-4 text-amber-500 mb-1" />
          <div className="text-[10px] font-bold uppercase text-neutral-400">
            Renewable share
          </div>
          <div className="text-xl font-black text-amber-700">
            {kpis?.renewable_pct != null ? `${kpis.renewable_pct}%` : '—'}
          </div>
        </Panel>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {RESOURCE_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
              tab === t.value
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-slate-600 border-neutral-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : filtered.length === 0 ? (
        <Panel className="p-10 text-center text-sm text-neutral-500">
          No {tab} metrics yet.
          <button
            type="button"
            onClick={() => openCreate(tab)}
            className="block mx-auto mt-3 btn-primary !py-2 !px-4 text-sm"
          >
            Log first entry
          </button>
        </Panel>
      ) : (
        <ul className="bg-white border rounded-3xl divide-y">
          {filtered.map((r) => {
            const catLabel =
              RESOURCE_CATEGORIES[r.resource_type]?.find(
                (c) => c.value === r.category
              )?.label || r.category;
            return (
              <li
                key={r.id}
                className="px-4 py-3 flex justify-between gap-3 items-center"
              >
                <div>
                  <div className="font-semibold text-sm">{catLabel}</div>
                  <div className="text-[11px] text-neutral-500">
                    {r.facility_name && `${r.facility_name} · `}
                    {r.period_start || '?'} → {r.period_end || '?'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-900">
                    {r.amount} {r.unit}
                  </span>
                  <button
                    type="button"
                    onClick={() => void remove(r.id)}
                    className="text-neutral-400 hover:text-rose-600"
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
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl space-y-3">
            <h3 className="font-bold text-lg">Log resource metric</h3>
            <select
              className="input"
              value={form.resource_type}
              onChange={(e) => {
                const t = e.target.value;
                const list = RESOURCE_CATEGORIES[t] || [];
                setForm({
                  ...form,
                  resource_type: t,
                  category: list[0]?.value || '',
                  unit: list[0]?.unit || form.unit,
                });
              }}
            >
              {RESOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={form.category}
              onChange={(e) => {
                const cat = e.target.value;
                const meta = cats.find((c) => c.value === cat);
                setForm({
                  ...form,
                  category: cat,
                  unit: meta?.unit || form.unit,
                });
              }}
            >
              {cats.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                type="number"
                placeholder="Amount *"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
              <input
                className="input"
                placeholder="Unit"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </div>
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
              placeholder="Facility"
              value={form.facility_name}
              onChange={(e) =>
                setForm({ ...form, facility_name: e.target.value })
              }
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
                className="btn-primary !py-2 !px-4 text-sm"
                onClick={() => void create()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </RelationshipPage>
  );
}
