'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Wrench,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

type Item = {
  id: number;
  title: string;
  description?: string | null;
  area?: string | null;
  priority?: string;
  status?: string;
  reported_by?: string | null;
  assigned_to?: string | null;
  cost_estimate?: number | null;
  due_date?: string | null;
  notes?: string | null;
  linked_riad_id?: number | null;
  created_at?: string;
};

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

function priorityClass(p?: string | null) {
  const s = String(p || 'medium').toLowerCase();
  if (s === 'critical') return 'bg-rose-100 text-rose-900 border-rose-200';
  if (s === 'high') return 'bg-orange-100 text-orange-900 border-orange-200';
  if (s === 'low') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-amber-100 text-amber-900 border-amber-200';
}

export default function SchoolMaintenancePage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    done: 0,
    critical: 0,
  });
  const [statusFilter, setStatusFilter] = useState('open');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    area: 'kitchen',
    priority: 'medium',
    reported_by: '',
    assigned_to: '',
    due_date: '',
    cost_estimate: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      // open filter = not done/cancelled
      if (statusFilter === 'open') {
        params.delete('status');
      }
      const res = await fetch(`/api/schools/maintenance?${params}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      let list = (data.items || []) as Item[];
      if (statusFilter === 'open') {
        list = list.filter(
          (i) => !['done', 'cancelled'].includes(String(i.status || ''))
        );
      }
      setItems(list);
      setSummary(
        data.summary || {
          total: 0,
          open: 0,
          inProgress: 0,
          done: 0,
          critical: 0,
        }
      );
      setAreas(data.areas || []);
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

  const save = async () => {
    if (!form.title.trim()) return toast.error('Title required');
    setSaving(true);
    try {
      const res = await fetch('/api/schools/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          ...form,
          cost_estimate: form.cost_estimate
            ? Number(form.cost_estimate)
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(
        data.item?.linked_riad_id
          ? 'Logged + linked to RIAD (high priority)'
          : 'Maintenance item logged'
      );
      setShowModal(false);
      setForm({
        title: '',
        description: '',
        area: 'kitchen',
        priority: 'medium',
        reported_by: '',
        assigned_to: '',
        due_date: '',
        cost_estimate: '',
      });
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: number, status: string) => {
    try {
      const res = await fetch('/api/schools/maintenance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(status === 'done' ? 'Marked done' : `Status → ${status}`);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of items) {
      const a = it.area || 'other';
      if (!map.has(a)) map.set(a, []);
      map.get(a)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Maintenance"
        titleAccent="Fix"
        description="Kitchen, classrooms, ablutions, water & safety. Log once — high/critical items auto-link to the school RIAD log."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2.5 !px-3 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Log issue
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {[
          { label: 'Open', value: summary.open },
          { label: 'In progress', value: summary.inProgress },
          { label: 'Done', value: summary.done },
          { label: 'Critical', value: summary.critical },
          { label: 'All', value: summary.total },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {k.label}
            </p>
            <p className="text-xl font-black tabular-nums text-slate-900">
              {k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[
          { v: 'open', l: 'Active' },
          { v: 'all', l: 'All' },
          { v: 'in_progress', l: 'In progress' },
          { v: 'done', l: 'Done' },
        ].map((f) => (
          <button
            key={f.v}
            type="button"
            onClick={() => setStatusFilter(f.v)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap ${
              statusFilter === f.v
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="font-bold">No open maintenance items</p>
          <p className="text-sm text-slate-500 mt-1">
            Log leaks, broken stoves, missing taps — keep the campus safe for
            children.
          </p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="btn-primary !py-2 !px-4 text-sm mt-4 inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> First item
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([area, list]) => (
            <div key={area}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5 capitalize">
                <Wrench className="w-3 h-3" /> {area}
              </h3>
              <ul className="space-y-2">
                {list.map((it) => (
                  <li
                    key={it.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-1.5 mb-1">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${priorityClass(it.priority)}`}
                          >
                            {it.priority}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-slate-200 text-slate-600 capitalize">
                            {(it.status || 'open').replace('_', ' ')}
                          </span>
                          {it.linked_riad_id ? (
                            <span className="text-[10px] font-bold text-[#0077b6]">
                              RIAD #{it.linked_riad_id}
                            </span>
                          ) : null}
                        </div>
                        <p className="font-bold text-slate-900 text-sm">
                          {it.title}
                        </p>
                        {it.description ? (
                          <p className="text-xs text-slate-500 mt-1">
                            {it.description}
                          </p>
                        ) : null}
                        <p className="text-[11px] text-slate-400 mt-2">
                          {[
                            it.assigned_to && `→ ${it.assigned_to}`,
                            it.due_date && `Due ${it.due_date}`,
                            it.cost_estimate != null &&
                              `~R${Number(it.cost_estimate).toLocaleString()}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {it.status !== 'in_progress' &&
                        it.status !== 'done' ? (
                          <button
                            type="button"
                            onClick={() => void setStatus(it.id, 'in_progress')}
                            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-sky-200 text-sky-800 bg-sky-50"
                          >
                            Start
                          </button>
                        ) : null}
                        {it.status !== 'done' ? (
                          <button
                            type="button"
                            onClick={() => void setStatus(it.id, 'done')}
                            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-800 bg-emerald-50"
                          >
                            Done
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <h3 className="font-black">Log maintenance</h3>
              <button type="button" onClick={() => setShowModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <label className="text-xs block">
                <span className="label">What needs fixing?</span>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. Kitchen sink tap dripping"
                  autoFocus
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  <span className="label">Area</span>
                  <select
                    className="input"
                    value={form.area}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, area: e.target.value }))
                    }
                  >
                    {(areas.length
                      ? areas
                      : [
                          'kitchen',
                          'classroom',
                          'ablution',
                          'grounds',
                          'water',
                          'other',
                        ]
                    ).map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  <span className="label">Priority</span>
                  <select
                    className="input"
                    value={form.priority}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, priority: e.target.value }))
                    }
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="text-xs block">
                <span className="label">Details</span>
                <textarea
                  className="input min-h-[70px]"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  <span className="label">Assigned to</span>
                  <input
                    className="input"
                    value={form.assigned_to}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, assigned_to: e.target.value }))
                    }
                  />
                </label>
                <label className="text-xs">
                  <span className="label">Due</span>
                  <input
                    type="date"
                    className="input"
                    value={form.due_date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, due_date: e.target.value }))
                    }
                  />
                </label>
              </div>
              <p className="text-[11px] text-slate-500">
                High / critical items are automatically added to the school RIAD
                log.
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="btn-primary w-full !py-3 text-sm inline-flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        .label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #94a3b8;
          margin-bottom: 0.25rem;
        }
      `}</style>
    </SchoolsPage>
  );
}
