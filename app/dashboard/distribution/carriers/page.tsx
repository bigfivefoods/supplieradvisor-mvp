'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Star, Trash2, Truck, X } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  DistributionHeader,
  DistributionPage,
  EmptyMission,
  SchemaHint,
  StatusPill,
  TelemetryCard,
} from '@/components/distribution/DistributionShell';

type Carrier = {
  id: number;
  name: string;
  code?: string | null;
  carrier_type?: string | null;
  modes?: string[] | null;
  service_level?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  coverage_regions?: string | null;
  status?: string | null;
  is_active?: boolean;
  rating?: number | null;
  otif_pct?: number | null;
  shipment_total?: number;
  shipment_active?: number;
};

export default function CarriersPage() {
  return (
    <CompanyRequired>
      <CarriersInner />
    </CompanyRequired>
  );
}

function CarriersInner() {
  const companyId = getSelectedCompanyId();
  const [items, setItems] = useState<Carrier[]>([]);
  const [warning, setWarning] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    carrier_type: '3pl',
    mode: 'road',
    service_level: 'standard',
    contact_email: '',
    contact_phone: '',
    coverage_regions: '',
  });

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/distribution/carriers?companyId=${companyId}`);
      const data = await res.json();
      setItems(data.carriers || []);
      setWarning(data.warning);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!companyId || !form.name) {
      toast.error('Name required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/distribution/carriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          ...form,
          modes: [form.mode],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Carrier onboarded');
      setShowForm(false);
      setForm({
        name: '',
        code: '',
        carrier_type: '3pl',
        mode: 'road',
        service_level: 'standard',
        contact_email: '',
        contact_phone: '',
        coverage_regions: '',
      });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: Carrier) => {
    if (!companyId) return;
    const next = c.status === 'active' ? 'suspended' : 'active';
    const res = await fetch('/api/distribution/carriers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        id: c.id,
        status: next,
        is_active: next === 'active',
      }),
    });
    if (!res.ok) {
      toast.error('Update failed');
      return;
    }
    void load();
  };

  const remove = async (id: number) => {
    if (!companyId || !confirm('Remove this carrier?')) return;
    const res = await fetch(
      `/api/distribution/carriers?companyId=${companyId}&id=${id}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      toast.error('Delete failed');
      return;
    }
    toast.success('Removed');
    void load();
  };

  const active = items.filter((c) => c.is_active !== false && c.status !== 'suspended').length;

  return (
    <DistributionPage>
      <DistributionHeader
        title="Carrier"
        titleAccent="network"
        description="3PLs, ocean lines, air freighters, and last-mile partners — one roster for local and global lanes."
        action={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add carrier
          </button>
        }
      />

      <SchemaHint message={warning} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <TelemetryCard label="Carriers" value={items.length} accent="violet" icon={Truck} />
        <TelemetryCard label="Active" value={active} accent="emerald" />
        <TelemetryCard
          label="Active moves"
          value={items.reduce((s, c) => s + (c.shipment_active || 0), 0)}
          accent="cyan"
        />
        <TelemetryCard
          label="Lifetime jobs"
          value={items.reduce((s, c) => s + (c.shipment_total || 0), 0)}
          accent="slate"
        />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : items.length === 0 ? (
        <EmptyMission
          title="No carriers yet"
          body="Onboard partners for road, ocean, air, and last mile. Assign them on shipments for OTIF-ready execution."
          action={
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="btn-primary !py-2.5 !px-6 text-sm"
            >
              <Plus className="w-4 h-4 inline mr-1" /> Add first carrier
            </button>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((c) => (
            <div
              key={c.id}
              className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-[#00b4d8]/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-50 to-white border border-violet-100 flex items-center justify-center text-violet-600">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    {c.code && (
                      <div className="font-mono text-[10px] font-bold text-[#00b4d8]">{c.code}</div>
                    )}
                    <div className="font-bold text-slate-800">{c.name}</div>
                  </div>
                </div>
                <StatusPill
                  label={c.status === 'suspended' ? 'suspended' : 'active'}
                  className={
                    c.status === 'suspended'
                      ? 'bg-neutral-100 text-neutral-500 border-neutral-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }
                  pulse={c.status !== 'suspended'}
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-100">
                  {c.carrier_type || '3pl'}
                </span>
                {(c.modes || []).map((m) => (
                  <span
                    key={m}
                    className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-100"
                  >
                    {m}
                  </span>
                ))}
                {c.service_level && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-100">
                    {c.service_level}
                  </span>
                )}
              </div>
              {c.coverage_regions && (
                <p className="text-xs text-neutral-500 mb-3">{c.coverage_regions}</p>
              )}
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div className="rounded-xl bg-slate-50 py-2">
                  <div className="text-lg font-black tabular-nums text-slate-800">
                    {c.shipment_active || 0}
                  </div>
                  <div className="text-[9px] font-bold uppercase text-neutral-400">live</div>
                </div>
                <div className="rounded-xl bg-slate-50 py-2">
                  <div className="text-lg font-black tabular-nums text-slate-800 flex items-center justify-center gap-0.5">
                    {c.rating != null ? (
                      <>
                        {c.rating}
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      </>
                    ) : (
                      '—'
                    )}
                  </div>
                  <div className="text-[9px] font-bold uppercase text-neutral-400">rating</div>
                </div>
                <div className="rounded-xl bg-slate-50 py-2">
                  <div className="text-lg font-black tabular-nums text-slate-800">
                    {c.otif_pct != null ? `${c.otif_pct}%` : '—'}
                  </div>
                  <div className="text-[9px] font-bold uppercase text-neutral-400">otif</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void toggle(c)}
                  className="text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full border border-neutral-200 hover:border-[#00b4d8]"
                >
                  {c.status === 'suspended' ? 'Activate' : 'Suspend'}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(c.id)}
                  className="ml-auto text-neutral-400 hover:text-rose-600 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/30 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <h3 className="font-black text-slate-800">Onboard carrier</h3>
              <button type="button" onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <input
                className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                placeholder="Legal / trading name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-mono uppercase"
                  placeholder="CODE"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                />
                <select
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  value={form.carrier_type}
                  onChange={(e) => setForm((f) => ({ ...f, carrier_type: e.target.value }))}
                >
                  <option value="3pl">3PL</option>
                  <option value="courier">Courier</option>
                  <option value="ocean">Ocean</option>
                  <option value="air">Air</option>
                  <option value="rail">Rail</option>
                  <option value="last_mile">Last mile</option>
                  <option value="own_fleet">Own fleet</option>
                </select>
                <select
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  value={form.mode}
                  onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
                >
                  <option value="road">Road</option>
                  <option value="rail">Rail</option>
                  <option value="ocean">Ocean</option>
                  <option value="air">Air</option>
                  <option value="multimodal">Multimodal</option>
                </select>
                <select
                  className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                  value={form.service_level}
                  onChange={(e) => setForm((f) => ({ ...f, service_level: e.target.value }))}
                >
                  <option value="standard">Standard</option>
                  <option value="express">Express</option>
                  <option value="economy">Economy</option>
                  <option value="reefer">Reefer</option>
                </select>
              </div>
              <input
                className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                placeholder="Coverage regions"
                value={form.coverage_regions}
                onChange={(e) => setForm((f) => ({ ...f, coverage_regions: e.target.value }))}
              />
              <input
                className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
                placeholder="Email"
                value={form.contact_email}
                onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary !py-2.5 !px-5 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void create()}
                  className="btn-primary !py-2.5 !px-6 text-sm inline-flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Save carrier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DistributionPage>
  );
}
