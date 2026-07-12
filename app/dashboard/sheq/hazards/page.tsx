'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import { HAZARD_STATUSES, riskBand, type SheqHazard } from '@/lib/sheq/types';

export default function SheqHazardsPage() {
  const companyId = getSelectedCompanyId();
  const { canOpsWrite, canWriteModule } = useCompanyRole();
  const canWrite = canWriteModule('sheq') || canOpsWrite;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<SheqHazard[]>([]);
  const [form, setForm] = useState({
    title: '',
    category: 'general',
    location: '',
    description: '',
    likelihood: 3,
    severity: 3,
    controls: '',
  });

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sheq/hazards?companyId=${companyId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setItems(data.hazards || []);
      if (data.warning) toast.message(data.warning);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!companyId || !form.title.trim()) {
      toast.error('Title required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/sheq/hazards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      toast.success(`Hazard logged (score ${data.hazard?.risk_score})`);
      setForm({
        title: '',
        category: 'general',
        location: '',
        description: '',
        likelihood: 3,
        severity: 3,
        controls: '',
      });
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const scorePreview = form.likelihood * form.severity;

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/sheq"
        backLabel="SHEQ overview"
        eyebrow="ISO 45001 · HIRARC"
        title="Hazards & risks"
        titleAccent="Assess"
        description="Identify hazards, score likelihood × severity (1–5), record controls, track residual risk."
      />

      {canWrite && (
        <Panel className="p-5 mb-6">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#00b4d8]" />
            Add hazard
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
              placeholder="Hazard title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Category (e.g. mechanical, chemical)"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            />
            <label className="text-xs text-slate-600">
              Likelihood (1–5)
              <input
                type="range"
                min={1}
                max={5}
                value={form.likelihood}
                onChange={(e) =>
                  setForm((f) => ({ ...f, likelihood: Number(e.target.value) }))
                }
                className="w-full"
              />
              <span className="font-bold">{form.likelihood}</span>
            </label>
            <label className="text-xs text-slate-600">
              Severity (1–5)
              <input
                type="range"
                min={1}
                max={5}
                value={form.severity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, severity: Number(e.target.value) }))
                }
                className="w-full"
              />
              <span className="font-bold">{form.severity}</span>
            </label>
            <div className="sm:col-span-2 text-sm">
              Risk score:{' '}
              <strong className="capitalize">
                {scorePreview} ({riskBand(scorePreview)})
              </strong>
            </div>
            <textarea
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2 min-h-[56px]"
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
            <textarea
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2 min-h-[56px]"
              placeholder="Existing controls"
              value={form.controls}
              onChange={(e) => setForm((f) => ({ ...f, controls: e.target.value }))}
            />
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void create()}
            className="mt-3 btn-primary !py-2.5 !px-4 text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Save hazard
          </button>
        </Panel>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : items.length === 0 ? (
        <Panel className="p-8 text-center text-slate-500 text-sm">
          No hazards registered yet.
        </Panel>
      ) : (
        <div className="space-y-3">
          {items.map((h) => {
            const band = riskBand(Number(h.risk_score || 0));
            return (
              <Panel key={h.id} className="p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900">{h.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {h.category} · {h.location || '—'} · {h.status}
                    </p>
                    {h.controls && (
                      <p className="text-sm text-slate-600 mt-2">
                        Controls: {h.controls}
                      </p>
                    )}
                  </div>
                  <div
                    className={`rounded-2xl px-3 py-2 text-center text-xs font-black uppercase ${
                      band === 'critical' || band === 'high'
                        ? 'bg-rose-100 text-rose-800'
                        : band === 'medium'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    <div className="text-lg">{h.risk_score}</div>
                    <div>{band}</div>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </RelationshipPage>
  );
}
