'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Workflow } from 'lucide-react';
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

type WorkCenter = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  capacity_hours_per_day?: number;
  efficiency_pct?: number;
  cost_per_hour?: number;
  status: string;
  wip_orders?: number;
};

export default function WorkCentersPage() {
  return (
    <CompanyRequired>
      <WorkCentersInner />
    </CompanyRequired>
  );
}

function WorkCentersInner() {
  const companyId = getSelectedCompanyId();
  const [items, setItems] = useState<WorkCenter[]>([]);
  const [warning, setWarning] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    capacity_hours_per_day: '8',
    efficiency_pct: '100',
    status: 'active',
  });

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/manufacturing/work-centers?companyId=${companyId}`);
      const data = await res.json();
      setItems(data.workCenters || []);
      setWarning(data.warning);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!companyId || !form.code || !form.name) {
      toast.error('Code and name required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/manufacturing/work-centers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          code: form.code,
          name: form.name,
          capacity_hours_per_day: Number(form.capacity_hours_per_day),
          efficiency_pct: Number(form.efficiency_pct),
          status: form.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Work cell online');
      setShowForm(false);
      setForm({ code: '', name: '', capacity_hours_per_day: '8', efficiency_pct: '100', status: 'active' });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: number, status: string) => {
    if (!companyId) return;
    const res = await fetch('/api/manufacturing/work-centers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, id, status }),
    });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || 'Update failed');
      return;
    }
    void load();
  };

  const remove = async (id: number) => {
    if (!companyId || !confirm('Decommission this work cell?')) return;
    const res = await fetch(
      `/api/manufacturing/work-centers?companyId=${companyId}&id=${id}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      toast.error('Delete failed');
      return;
    }
    toast.success('Cell removed');
    void load();
  };

  const active = items.filter((i) => i.status === 'active').length;
  const wip = items.reduce((s, i) => s + (i.wip_orders || 0), 0);

  return (
    <ManufacturingPage>
      <ManufacturingHeader
        title="Work"
        titleAccent="cells"
        description="Production cells, lines, and stations — capacity hours, efficiency, and live WIP load."
        action={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New cell
          </button>
        }
      />

      <SchemaHint message={warning} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <TelemetryCard label="Cells" value={items.length} accent="slate" />
        <TelemetryCard label="Online" value={active} accent="emerald" />
        <TelemetryCard label="WIP load" value={wip} sub="open orders assigned" accent="amber" />
        <TelemetryCard
          label="Capacity"
          value={`${items.reduce((s, i) => s + Number(i.capacity_hours_per_day || 0), 0)}h`}
          sub="hours / day nominal"
          accent="cyan"
        />
      </div>

      {showForm && (
        <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-white to-sky-50/50 p-5 mb-6 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-mono uppercase"
            placeholder="CODE"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          />
          <input
            className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm sm:col-span-1 lg:col-span-2"
            placeholder="Cell name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
            placeholder="Hours/day"
            value={form.capacity_hours_per_day}
            onChange={(e) => setForm((f) => ({ ...f, capacity_hours_per_day: e.target.value }))}
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void create()}
            className="btn-primary !py-2.5 text-sm inline-flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Commission'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : items.length === 0 ? (
        <EmptyMission
          title="No work cells yet"
          body="Define lines and stations so work orders have a physical home — capacity and WIP tracking start here."
          action={
            <button type="button" onClick={() => setShowForm(true)} className="btn-primary !py-2.5 !px-6 text-sm">
              <Plus className="w-4 h-4 inline mr-1" /> Commission first cell
            </button>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((wc) => (
            <div
              key={wc.id}
              className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-[#00b4d8]/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-50 to-sky-100 border border-cyan-100 text-[#0077b6] flex items-center justify-center">
                    <Workflow className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-mono text-xs font-bold text-[#00b4d8]">{wc.code}</div>
                    <div className="font-bold text-slate-800">{wc.name}</div>
                  </div>
                </div>
                <StatusPill
                  label={wc.status}
                  className={
                    wc.status === 'active'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : wc.status === 'maintenance'
                        ? 'bg-amber-50 text-amber-900 border-amber-200'
                        : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                  }
                  pulse={wc.status === 'active'}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div className="rounded-xl bg-slate-50 py-2">
                  <div className="text-lg font-black tabular-nums text-slate-800">
                    {wc.capacity_hours_per_day ?? 8}
                  </div>
                  <div className="text-[9px] font-bold uppercase text-neutral-400">hrs/day</div>
                </div>
                <div className="rounded-xl bg-slate-50 py-2">
                  <div className="text-lg font-black tabular-nums text-slate-800">
                    {wc.efficiency_pct ?? 100}%
                  </div>
                  <div className="text-[9px] font-bold uppercase text-neutral-400">eff</div>
                </div>
                <div className="rounded-xl bg-slate-50 py-2">
                  <div className="text-lg font-black tabular-nums text-slate-800">
                    {wc.wip_orders || 0}
                  </div>
                  <div className="text-[9px] font-bold uppercase text-neutral-400">wip</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['active', 'maintenance', 'offline'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => void setStatus(wc.id, st)}
                    className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${
                      wc.status === st
                        ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                        : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                    }`}
                  >
                    {st}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void remove(wc.id)}
                  className="ml-auto text-neutral-400 hover:text-rose-600 p-1"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ManufacturingPage>
  );
}
