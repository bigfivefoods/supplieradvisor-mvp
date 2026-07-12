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
import {
  INCIDENT_TYPES,
  SEVERITIES,
  INCIDENT_STATUSES,
  type SheqIncident,
} from '@/lib/sheq/types';

export default function SheqIncidentsPage() {
  const companyId = getSelectedCompanyId();
  const { canOpsWrite, canWriteModule } = useCompanyRole();
  const canWrite = canWriteModule('sheq') || canOpsWrite;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<SheqIncident[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState({
    title: '',
    incident_type: 'near_miss',
    severity: 'medium',
    location: '',
    description: '',
    immediate_action: '',
  });

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/sheq/incidents?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setItems(data.incidents || []);
      if (data.warning) toast.message(data.warning);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, statusFilter]);

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
      const res = await fetch('/api/sheq/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      toast.success(`Incident ${data.incident?.public_ref || ''} logged`);
      setForm({
        title: '',
        incident_type: 'near_miss',
        severity: 'medium',
        location: '',
        description: '',
        immediate_action: '',
      });
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: number, status: string) => {
    if (!companyId) return;
    try {
      const res = await fetch('/api/sheq/incidents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      toast.success('Updated');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/sheq"
        backLabel="SHEQ overview"
        eyebrow="ISO 45001"
        title="Incidents"
        titleAccent="OH&S"
        description="Near-misses, injuries, and investigations — foundation of your OH&S management system."
      />

      {canWrite && (
        <Panel className="p-5 mb-6">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#00b4d8]" />
            Report incident
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
              placeholder="Title (what happened)"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.incident_type}
              onChange={(e) =>
                setForm((f) => ({ ...f, incident_type: e.target.value }))
              }
            >
              {INCIDENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.severity}
              onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
              placeholder="Location / site"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            />
            <textarea
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2 min-h-[72px]"
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
            <textarea
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2 min-h-[56px]"
              placeholder="Immediate action taken"
              value={form.immediate_action}
              onChange={(e) =>
                setForm((f) => ({ ...f, immediate_action: e.target.value }))
              }
            />
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void create()}
            className="mt-3 btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Log incident
          </button>
        </Panel>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {['all', ...INCIDENT_STATUSES].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
              statusFilter === s
                ? 'bg-[#00b4d8] text-white'
                : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : items.length === 0 ? (
        <Panel className="p-8 text-center text-slate-500 text-sm">
          No incidents recorded yet.
        </Panel>
      ) : (
        <div className="space-y-3">
          {items.map((inc) => (
            <Panel key={inc.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {inc.public_ref || `INC-${inc.id}`}
                  </div>
                  <h3 className="font-bold text-slate-900">{inc.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 capitalize">
                    {String(inc.incident_type).replace(/_/g, ' ')} · {inc.severity} ·{' '}
                    {inc.location || 'No location'}
                  </p>
                  {inc.description && (
                    <p className="text-sm text-slate-600 mt-2">{inc.description}</p>
                  )}
                </div>
                {canWrite && (
                  <select
                    className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs"
                    value={inc.status}
                    onChange={(e) => void setStatus(inc.id, e.target.value)}
                  >
                    {INCIDENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </RelationshipPage>
  );
}
