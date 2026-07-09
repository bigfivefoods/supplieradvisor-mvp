'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Filter,
  Loader2,
  Plus,
  Scale,
  Search,
  Target,
  Trash2,
  X,
  Gavel,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CONTAINER_RIAD_CATEGORIES,
  RIAD_PRIORITIES,
  RIAD_STATUSES,
  RIAD_TYPES,
  computeRpn,
  priorityClass,
  rpnBand,
  statusClass,
  type RiadRecord,
  type RiadType,
} from '@/lib/containers/riad';
import type { ContainerRecord } from '@/lib/containers/types';

type Mode = 'business' | 'contractor';

type Props = {
  mode: Mode;
  companyId?: number | null;
  /** Contractor: fixed to one container */
  fixedContainerId?: number | null;
  containers?: ContainerRecord[];
  privyUserId?: string | null;
  email?: string | null;
  actorName?: string | null;
  compact?: boolean;
};

const emptyForm = {
  riad_type: 'risk' as RiadType,
  title: '',
  description: '',
  status: 'open',
  priority: 'medium',
  category: '',
  stakeholder_type: 'internal',
  container_id: '',
  owner_name: '',
  severity: 3,
  likelihood: 3,
  time_horizon: 3,
  mitigation_plan: '',
  due_date: '',
  logged_date: new Date().toISOString().slice(0, 10),
  notes: '',
};

export default function ContainerRiadRegister({
  mode,
  companyId,
  fixedContainerId,
  containers = [],
  privyUserId,
  email,
  actorName,
  compact = false,
}: Props) {
  const [tab, setTab] = useState<RiadType | 'all'>('all');
  const [items, setItems] = useState<RiadRecord[]>([]);
  const [summary, setSummary] = useState({ total: 0, open: 0, critical: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<RiadRecord | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [containerFilter, setContainerFilter] = useState(
    fixedContainerId ? String(fixedContainerId) : 'all'
  );
  const [form, setForm] = useState({
    ...emptyForm,
    container_id: fixedContainerId ? String(fixedContainerId) : '',
    owner_name: actorName || '',
  });

  const rpn = computeRpn(form.severity, form.likelihood, form.time_horizon);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (mode === 'business' && companyId) params.set('companyId', String(companyId));
      if (mode === 'contractor' && privyUserId) {
        params.set('privyUserId', privyUserId);
        if (email) params.set('email', email);
      }
      const cid = fixedContainerId || (containerFilter !== 'all' ? Number(containerFilter) : null);
      if (cid) params.set('containerId', String(cid));
      if (tab !== 'all') params.set('type', tab);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/containers/riad?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setItems(data.items || []);
      setSummary(data.summary || { total: 0, open: 0, critical: 0 });
      if (data.warning) toast.message(data.warning, { description: data.hint });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [
    mode,
    companyId,
    privyUserId,
    email,
    fixedContainerId,
    containerFilter,
    tab,
    statusFilter,
  ]);

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
        i.container_name?.toLowerCase().includes(needle) ||
        i.container_code?.toLowerCase().includes(needle)
    );
  }, [items, q]);

  const openCreate = (type?: RiadType) => {
    setForm({
      ...emptyForm,
      riad_type: type || (tab !== 'all' ? tab : 'risk'),
      container_id: fixedContainerId
        ? String(fixedContainerId)
        : containerFilter !== 'all'
          ? containerFilter
          : '',
      owner_name: actorName || '',
      logged_date: new Date().toISOString().slice(0, 10),
    });
    setShowModal(true);
  };

  const submit = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (mode === 'business' && !companyId) {
      toast.error('Select a company first');
      return;
    }
    if (mode === 'contractor' && !fixedContainerId) {
      toast.error('No container allocated');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        companyId: companyId || undefined,
        containerId: form.container_id ? Number(form.container_id) : fixedContainerId || null,
        riad_type: form.riad_type,
        title: form.title.trim(),
        description: form.description || null,
        status: form.status,
        priority: form.priority,
        category: form.category || null,
        owner_name: form.owner_name || actorName || null,
        severity: form.riad_type === 'risk' ? form.severity : null,
        likelihood: form.riad_type === 'risk' ? form.likelihood : null,
        time_horizon: form.riad_type === 'risk' ? form.time_horizon : null,
        rpn: form.riad_type === 'risk' ? rpn : null,
        mitigation_plan: form.mitigation_plan || null,
        due_date: form.due_date || null,
        logged_date: form.logged_date || null,
        notes: form.notes || null,
        created_by_name: actorName || null,
        source: mode,
      };
      if (mode === 'contractor') {
        body.privyUserId = privyUserId;
        body.email = email;
        body.containerId = fixedContainerId;
      }

      const res = await fetch('/api/containers/riad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Create failed');
      toast.success(`${form.riad_type.charAt(0).toUpperCase() + form.riad_type.slice(1)} logged`);
      setShowModal(false);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (item: RiadRecord, status: string) => {
    const res = await fetch('/api/containers/riad', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id,
        status,
        containerId: item.container_id || fixedContainerId,
        privyUserId: mode === 'contractor' ? privyUserId : undefined,
        email: mode === 'contractor' ? email : undefined,
        resolution: status === 'resolved' || status === 'closed' ? item.resolution : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Update failed');
      return;
    }
    toast.success('Status updated');
    setDetail(data.item);
    void load();
  };

  const remove = async (item: RiadRecord) => {
    if (mode === 'contractor') {
      toast.error('Only company admins can delete RIAD entries');
      return;
    }
    if (!confirm('Delete this RIAD entry?')) return;
    const res = await fetch(`/api/containers/riad?id=${item.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error || 'Delete failed');
      return;
    }
    toast.success('Deleted');
    setDetail(null);
    void load();
  };

  const typeIcon = (t: string) => {
    switch (t) {
      case 'risk':
        return Target;
      case 'issue':
        return AlertTriangle;
      case 'action':
        return CheckCircle2;
      case 'decision':
        return Gavel;
      default:
        return ClipboardList;
    }
  };

  return (
    <div className={compact ? '' : 'px-2 md:px-4 max-w-screen-2xl mx-auto'}>
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl border bg-white px-4 py-3">
          <div className="text-xs text-neutral-500">Total</div>
          <div className="text-2xl font-black text-slate-900">{summary.total}</div>
        </div>
        <div className="rounded-2xl border bg-sky-50 border-sky-100 px-4 py-3">
          <div className="text-xs text-sky-700">Open / active</div>
          <div className="text-2xl font-black text-sky-900">{summary.open}</div>
        </div>
        <div className="rounded-2xl border bg-red-50 border-red-100 px-4 py-3">
          <div className="text-xs text-red-700">Critical</div>
          <div className="text-2xl font-black text-red-900">{summary.critical}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-1 p-1 bg-neutral-100 rounded-2xl">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`px-3 py-2 rounded-xl text-sm font-medium ${
              tab === 'all' ? 'bg-white shadow text-slate-900' : 'text-neutral-600'
            }`}
          >
            All
          </button>
          {RIAD_TYPES.map((t) => {
            const Icon = typeIcon(t.key);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-3 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-1.5 ${
                  tab === t.key ? 'bg-white shadow text-slate-900' : 'text-neutral-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.plural}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => openCreate()} className="btn-primary !py-2.5 !px-5 text-sm">
          <Plus className="w-4 h-4" /> Log RIAD
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            className="input w-full !py-2.5 !pl-10 !text-sm"
            placeholder="Search title, outlet, category…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-2 items-center">
          <Filter className="w-4 h-4 text-neutral-400" />
          <select
            className="input !py-2.5 !text-sm !w-auto min-w-[140px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            {RIAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {mode === 'business' && !fixedContainerId && containers.length > 0 && (
            <select
              className="input !py-2.5 !text-sm !w-auto min-w-[160px]"
              value={containerFilter}
              onChange={(e) => setContainerFilter(e.target.value)}
            >
              <option value="all">All containers</option>
              {containers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Scale className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-600 font-medium mb-1">No RIAD entries yet</p>
            <p className="text-sm text-neutral-500 mb-4">
              Log risks, issues, actions, and decisions for container operations.
            </p>
            <button type="button" onClick={() => openCreate()} className="btn-primary !py-2.5 !px-5 text-sm">
              Log first entry
            </button>
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((item) => {
              const Icon = typeIcon(item.riad_type);
              const band = item.rpn != null ? rpnBand(Number(item.rpn)) : null;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(item)}
                    className="w-full text-left px-4 sm:px-6 py-4 hover:bg-neutral-50 transition-colors flex gap-3 items-start"
                  >
                    <div className="mt-0.5 p-2 rounded-xl bg-neutral-100">
                      <Icon className="w-4 h-4 text-[#00b4d8]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                          {item.riad_type}
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full border capitalize ${priorityClass(item.priority)}`}
                        >
                          {item.priority || 'medium'}
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${statusClass(item.status)}`}
                        >
                          {(item.status || 'open').replace('_', ' ')}
                        </span>
                        {item.source === 'contractor' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00b4d8]/10 text-[#0077b6]">
                            contractor
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-slate-900 truncate">{item.title}</div>
                      <div className="text-xs text-neutral-500 mt-0.5 flex flex-wrap gap-x-2">
                        {item.container_name && (
                          <span>
                            {item.container_name}
                            {item.container_code ? ` · ${item.container_code}` : ''}
                          </span>
                        )}
                        {item.category && <span>· {item.category}</span>}
                        {item.due_date && <span>· due {item.due_date}</span>}
                      </div>
                    </div>
                    {band && item.riad_type === 'risk' && (
                      <div className={`text-sm font-bold px-3 py-1 rounded-xl ${band.className}`}>
                        {item.rpn}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="min-h-full flex items-start sm:items-center justify-center p-3 sm:p-4 py-8">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border max-h-[min(92dvh,900px)] flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
                <h2 className="font-bold text-xl text-slate-900">Log new RIAD</h2>
                <button type="button" onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-neutral-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto p-5 space-y-4 flex-1 min-h-0">
                <div>
                  <label className="text-xs font-medium">Type</label>
                  <div className="grid grid-cols-4 gap-2 mt-1">
                    {RIAD_TYPES.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setForm({ ...form, riad_type: t.key })}
                        className={`py-2 rounded-xl text-xs font-semibold border ${
                          form.riad_type === t.key
                            ? 'border-[#00b4d8] bg-[#00b4d8]/10 text-[#0077b6]'
                            : 'border-neutral-200'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium">Title *</label>
                  <input
                    className="input mt-1 w-full !p-3 !text-sm"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Short, clear title"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Description</label>
                  <textarea
                    className="input mt-1 w-full !p-3 !text-sm min-h-[80px]"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What happened / what needs attention"
                  />
                </div>
                {mode === 'business' && !fixedContainerId && (
                  <div>
                    <label className="text-xs font-medium">Container</label>
                    <select
                      className="input mt-1 w-full !p-3 !text-sm"
                      value={form.container_id}
                      onChange={(e) => setForm({ ...form, container_id: e.target.value })}
                    >
                      <option value="">Company-wide (no specific outlet)</option>
                      {containers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.container_code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Category</label>
                    <select
                      className="input mt-1 w-full !p-3 !text-sm"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    >
                      <option value="">Select…</option>
                      {CONTAINER_RIAD_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Priority</label>
                    <select
                      className="input mt-1 w-full !p-3 !text-sm"
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    >
                      {RIAD_PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Owner</label>
                    <input
                      className="input mt-1 w-full !p-3 !text-sm"
                      value={form.owner_name}
                      onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                      placeholder="Who owns this"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Due date</label>
                    <input
                      type="date"
                      className="input mt-1 w-full !p-3 !text-sm"
                      value={form.due_date}
                      onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    />
                  </div>
                </div>

                {form.riad_type === 'risk' && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs font-medium">Severity</label>
                        <select
                          className="input mt-1 w-full !p-2 !text-sm"
                          value={form.severity}
                          onChange={(e) => setForm({ ...form, severity: Number(e.target.value) })}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium">Likelihood</label>
                        <select
                          className="input mt-1 w-full !p-2 !text-sm"
                          value={form.likelihood}
                          onChange={(e) => setForm({ ...form, likelihood: Number(e.target.value) })}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium">Time horizon</label>
                        <select
                          className="input mt-1 w-full !p-2 !text-sm"
                          value={form.time_horizon}
                          onChange={(e) =>
                            setForm({ ...form, time_horizon: Number(e.target.value) })
                          }
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-900 text-white p-4 flex justify-between items-center">
                      <div>
                        <div className="text-xs text-neutral-400">Risk Priority Number</div>
                        <div className="text-4xl font-black tracking-tighter">{rpn}</div>
                      </div>
                      <span className={`px-4 py-2 rounded-xl text-sm font-bold ${rpnBand(rpn).className}`}>
                        {rpnBand(rpn).label}
                      </span>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Mitigation plan</label>
                      <textarea
                        className="input mt-1 w-full !p-3 !text-sm min-h-[70px]"
                        value={form.mitigation_plan}
                        onChange={(e) => setForm({ ...form, mitigation_plan: e.target.value })}
                        placeholder="How will this risk be reduced or controlled?"
                      />
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Status</label>
                    <select
                      className="input mt-1 w-full !p-3 !text-sm"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                    >
                      {RIAD_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Logged date</label>
                    <input
                      type="date"
                      className="input mt-1 w-full !p-3 !text-sm"
                      value={form.logged_date}
                      onChange={(e) => setForm({ ...form, logged_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 p-5 border-t flex-shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 !py-3">
                  Cancel
                </button>
                <button type="button" disabled={saving} onClick={() => void submit()} className="btn-primary flex-1 !py-3">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save entry'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex justify-end" onClick={() => setDetail(null)}>
          <div
            className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-500 font-semibold">
                  {detail.riad_type}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-1">{detail.title}</h3>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="p-2 rounded-xl hover:bg-neutral-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusClass(detail.status)}`}>
                {(detail.status || '').replace('_', ' ')}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full border capitalize ${priorityClass(detail.priority)}`}>
                {detail.priority}
              </span>
              {detail.rpn != null && (
                <span className={`text-xs px-2 py-1 rounded-full font-bold ${rpnBand(Number(detail.rpn)).className}`}>
                  RPN {detail.rpn}
                </span>
              )}
            </div>
            {detail.description && (
              <p className="text-sm text-neutral-700 mb-4 whitespace-pre-wrap">{detail.description}</p>
            )}
            <dl className="space-y-2 text-sm mb-6">
              {detail.container_name && (
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Outlet</dt>
                  <dd className="font-medium text-right">{detail.container_name}</dd>
                </div>
              )}
              {detail.category && (
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Category</dt>
                  <dd className="font-medium">{detail.category}</dd>
                </div>
              )}
              {detail.owner_name && (
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Owner</dt>
                  <dd className="font-medium">{detail.owner_name}</dd>
                </div>
              )}
              {detail.due_date && (
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Due</dt>
                  <dd className="font-medium">{detail.due_date}</dd>
                </div>
              )}
              {detail.created_by_name && (
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Logged by</dt>
                  <dd className="font-medium">{detail.created_by_name}</dd>
                </div>
              )}
              {detail.source && (
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Source</dt>
                  <dd className="font-medium capitalize">{detail.source}</dd>
                </div>
              )}
            </dl>
            {detail.mitigation_plan && (
              <div className="mb-4 p-3 rounded-2xl bg-emerald-50 text-sm text-emerald-900">
                <div className="font-semibold mb-1">Mitigation</div>
                {detail.mitigation_plan}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-500">Update status</label>
              <select
                className="input w-full !p-3 !text-sm"
                value={detail.status}
                onChange={(e) => void updateStatus(detail, e.target.value)}
              >
                {RIAD_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            {mode === 'business' && (
              <button
                type="button"
                onClick={() => void remove(detail)}
                className="mt-6 text-red-600 text-sm inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" /> Delete entry
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
