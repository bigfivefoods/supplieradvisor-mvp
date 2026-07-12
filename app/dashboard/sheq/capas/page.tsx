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
import { CAPA_STATUSES, SEVERITIES, type SheqCapa } from '@/lib/sheq/types';

export default function SheqCapasPage() {
  const companyId = getSelectedCompanyId();
  const { canOpsWrite, canWriteModule } = useCompanyRole();
  const canWrite = canWriteModule('sheq') || canOpsWrite;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<SheqCapa[]>([]);
  const [form, setForm] = useState({
    title: '',
    ncr_id: '',
    priority: 'medium',
    owner_name: '',
    root_cause: '',
    corrective_action: '',
    preventive_action: '',
    due_date: '',
  });

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sheq/capas?companyId=${companyId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setItems(data.capas || []);
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
      const res = await fetch('/api/sheq/capas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          title: form.title,
          priority: form.priority,
          owner_name: form.owner_name || null,
          root_cause: form.root_cause || null,
          corrective_action: form.corrective_action || null,
          preventive_action: form.preventive_action || null,
          due_date: form.due_date || null,
          ncr_id: form.ncr_id ? Number(form.ncr_id) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      toast.success(`CAPA ${data.capa?.public_ref || ''} created`);
      setForm({
        title: '',
        ncr_id: '',
        priority: 'medium',
        owner_name: '',
        root_cause: '',
        corrective_action: '',
        preventive_action: '',
        due_date: '',
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
      const res = await fetch('/api/sheq/capas', {
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
        eyebrow="Corrective & preventive"
        title="CAPA"
        titleAccent="Close the loop"
        description="Root cause, corrective action, preventive action, and effectiveness verification."
      />

      {canWrite && (
        <Panel className="p-5 mb-6">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#00b4d8]" />
            New CAPA
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Link NCR id (optional)"
              value={form.ncr_id}
              onChange={(e) => setForm((f) => ({ ...f, ncr_id: e.target.value }))}
            />
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s} priority
                </option>
              ))}
            </select>
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Owner"
              value={form.owner_name}
              onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))}
            />
            <input
              type="date"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            />
            <textarea
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2 min-h-[48px]"
              placeholder="Root cause"
              value={form.root_cause}
              onChange={(e) => setForm((f) => ({ ...f, root_cause: e.target.value }))}
            />
            <textarea
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2 min-h-[48px]"
              placeholder="Corrective action"
              value={form.corrective_action}
              onChange={(e) =>
                setForm((f) => ({ ...f, corrective_action: e.target.value }))
              }
            />
            <textarea
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2 min-h-[48px]"
              placeholder="Preventive action"
              value={form.preventive_action}
              onChange={(e) =>
                setForm((f) => ({ ...f, preventive_action: e.target.value }))
              }
            />
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void create()}
            className="mt-3 btn-primary !py-2.5 !px-4 text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Create CAPA
          </button>
        </Panel>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : items.length === 0 ? (
        <Panel className="p-8 text-center text-slate-500 text-sm">
          No CAPAs yet. Failed inspections create draft CAPAs automatically.
        </Panel>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <Panel key={c.id} className="p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-mono text-slate-500">
                    {c.public_ref || `CAPA-${c.id}`}
                    {c.ncr_id ? ` · NCR #${c.ncr_id}` : ''}
                  </div>
                  <h3 className="font-bold text-slate-900">{c.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 capitalize">
                    {c.priority || 'medium'} · {c.owner_name || 'Unassigned'}
                    {c.due_date ? ` · due ${c.due_date}` : ''}
                  </p>
                  {c.root_cause && (
                    <p className="text-sm text-slate-600 mt-2">
                      <strong>Root cause:</strong> {c.root_cause}
                    </p>
                  )}
                  {c.corrective_action && (
                    <p className="text-sm text-slate-600">
                      <strong>Corrective:</strong> {c.corrective_action}
                    </p>
                  )}
                </div>
                {canWrite && (
                  <select
                    className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs h-fit"
                    value={c.status}
                    onChange={(e) => void setStatus(c.id, e.target.value)}
                  >
                    {CAPA_STATUSES.map((s) => (
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
