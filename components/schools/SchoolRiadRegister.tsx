'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Gavel,
  Loader2,
  Plus,
  Search,
  Target,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  SCHOOL_RIAD_CATEGORIES,
  SCHOOL_RIAD_TYPES,
  RIAD_PRIORITIES,
  RIAD_STATUSES,
  isClosedLike,
  priorityClass,
  statusClass,
  type SchoolRiadRecord,
} from '@/lib/schools/riad';

type Props = { companyId: number };

const emptyForm = {
  entry_type: 'risk',
  title: '',
  description: '',
  status: 'open',
  priority: 'medium',
  category: '',
  owner_name: '',
  due_date: '',
  mitigation_plan: '',
  notes: '',
};

const typeIcon = {
  risk: AlertTriangle,
  issue: ClipboardList,
  action: Target,
  decision: Gavel,
} as const;

export default function SchoolRiadRegister({ companyId }: Props) {
  const [tab, setTab] = useState<string>('all');
  const [items, setItems] = useState<SchoolRiadRecord[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    closed: 0,
    inProgress: 0,
    onHold: 0,
    critical: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<SchoolRiadRecord | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [form, setForm] = useState(emptyForm);
  const [resolutionText, setResolutionText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (tab !== 'all') params.set('type', tab);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/schools/riad?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const list = (data.items || []) as SchoolRiadRecord[];
      setItems(
        list.map((e) => ({
          ...e,
          entry_type: e.entry_type || e.riad_type || 'risk',
          priority: e.priority || e.severity || 'medium',
        }))
      );
      setSummary(
        data.summary || {
          total: 0,
          open: 0,
          closed: 0,
          inProgress: 0,
          onHold: 0,
          critical: 0,
        }
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, tab, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (i) =>
        i.title?.toLowerCase().includes(needle) ||
        i.description?.toLowerCase().includes(needle) ||
        i.category?.toLowerCase().includes(needle) ||
        i.owner_name?.toLowerCase().includes(needle)
    );
  }, [items, q]);

  const openCreate = (type?: string) => {
    setForm({
      ...emptyForm,
      entry_type: type || (tab !== 'all' ? tab : 'risk'),
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error('Title required');
    setSaving(true);
    try {
      const res = await fetch('/api/schools/riad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('Logged');
      setShowModal(false);
      setForm(emptyForm);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const patch = async (id: number, body: Record<string, unknown>) => {
    const res = await fetch('/api/schools/riad', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, id, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Update failed');
    return data.item as SchoolRiadRecord;
  };

  const closeItem = async () => {
    if (!detail) return;
    try {
      await patch(detail.id, {
        status: 'resolved',
        resolution: resolutionText || 'Resolved',
      });
      toast.success('Closed');
      setDetail(null);
      setResolutionText('');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const setInProgress = async (item: SchoolRiadRecord) => {
    try {
      await patch(item.id, { status: 'in_progress' });
      toast.success('Marked in progress');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: 'Open', value: summary.open, color: 'text-amber-700' },
          { label: 'In progress', value: summary.inProgress, color: 'text-sky-700' },
          { label: 'On hold', value: summary.onHold, color: 'text-violet-700' },
          { label: 'Closed', value: summary.closed, color: 'text-emerald-700' },
          { label: 'Critical', value: summary.critical, color: 'text-rose-700' },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {k.label}
            </p>
            <p className={`text-xl font-black tabular-nums ${k.color}`}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap ${
              tab === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            All
          </button>
          {SCHOOL_RIAD_TYPES.map((t) => {
            const Icon = typeIcon[t.value as keyof typeof typeIcon] || ClipboardList;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg inline-flex items-center gap-1 whitespace-nowrap ${
                  tab === t.value ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                <Icon className="w-3 h-3" />
                {t.label}
              </button>
            );
          })}
        </div>
        <select
          className="input !w-auto !py-1.5 text-xs"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="open">Open-ish</option>
          <option value="all">Any status</option>
          {RIAD_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[140px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !pl-8 text-xs"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Log item
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="font-bold text-slate-800">Nothing open here</p>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Log risks, kitchen issues, decisions, and actions so the whole school
            team stays aligned.
          </p>
          <button
            type="button"
            onClick={() => openCreate('issue')}
            className="btn-primary !py-2 !px-4 text-sm mt-4 inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> First entry
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => {
            const t = String(item.entry_type || item.riad_type || 'risk');
            const Icon = typeIcon[t as keyof typeof typeIcon] || ClipboardList;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setDetail(item);
                    setResolutionText('');
                  }}
                  className="w-full text-left rounded-2xl border border-slate-200 bg-white p-4 hover:border-[#00b4d8]/50 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-[#0077b6]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {t}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${priorityClass(item.priority || item.severity)}`}
                        >
                          {item.priority || item.severity || 'medium'}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${statusClass(item.status)}`}
                        >
                          {item.status || 'open'}
                        </span>
                        {item.category ? (
                          <span className="text-[10px] text-slate-500">
                            {item.category}
                          </span>
                        ) : null}
                      </div>
                      <p className="font-bold text-slate-900 text-sm leading-snug">
                        {item.title}
                      </p>
                      {item.description ? (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-slate-400">
                        {item.owner_name ? <span>Owner: {item.owner_name}</span> : null}
                        {item.due_date ? <span>Due {item.due_date}</span> : null}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <h3 className="font-black text-slate-900">Log RIAD item</h3>
              <button type="button" onClick={() => setShowModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  <span className="label">Type</span>
                  <select
                    className="input"
                    value={form.entry_type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, entry_type: e.target.value }))
                    }
                  >
                    {SCHOOL_RIAD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
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
                    {RIAD_PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="text-xs block">
                <span className="label">Title</span>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. Gas stove flame irregular"
                />
              </label>
              <label className="text-xs block">
                <span className="label">Category</span>
                <select
                  className="input"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                >
                  <option value="">Select…</option>
                  {SCHOOL_RIAD_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs block">
                <span className="label">Description</span>
                <textarea
                  className="input min-h-[80px]"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  <span className="label">Owner</span>
                  <input
                    className="input"
                    value={form.owner_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, owner_name: e.target.value }))
                    }
                    placeholder="Principal / teacher"
                  />
                </label>
                <label className="text-xs">
                  <span className="label">Due date</span>
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
              <label className="text-xs block">
                <span className="label">Mitigation / plan</span>
                <textarea
                  className="input min-h-[60px]"
                  value={form.mitigation_plan}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, mitigation_plan: e.target.value }))
                  }
                />
              </label>
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
                Save entry
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <h3 className="font-black text-slate-900 capitalize">
                {detail.entry_type || detail.riad_type}
              </h3>
              <button type="button" onClick={() => setDetail(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-lg font-black text-slate-900">{detail.title}</p>
              {detail.description ? (
                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                  {detail.description}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-md border font-bold ${priorityClass(detail.priority || detail.severity)}`}>
                  {detail.priority || detail.severity}
                </span>
                <span className={`px-2 py-0.5 rounded-md border font-bold ${statusClass(detail.status)}`}>
                  {detail.status}
                </span>
                {detail.category ? (
                  <span className="px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                    {detail.category}
                  </span>
                ) : null}
              </div>
              {!isClosedLike(detail.status) ? (
                <div className="space-y-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => void setInProgress(detail)}
                    className="btn-secondary w-full !py-2.5 text-sm"
                  >
                    Mark in progress
                  </button>
                  <label className="text-xs block">
                    <span className="label">Resolution notes</span>
                    <textarea
                      className="input min-h-[60px]"
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="What was done?"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void closeItem()}
                    className="btn-primary w-full !py-2.5 text-sm"
                  >
                    Close / resolve
                  </button>
                </div>
              ) : detail.resolution ? (
                <p className="text-sm text-emerald-800 bg-emerald-50 rounded-xl p-3">
                  {detail.resolution}
                </p>
              ) : null}
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
    </div>
  );
}
