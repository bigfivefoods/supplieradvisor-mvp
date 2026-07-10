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
  CUSTOMER_RIAD_CATEGORIES,
  RIAD_PRIORITIES,
  RIAD_STATUSES,
  RIAD_TYPES,
  isClosedLike,
  priorityClass,
  statusClass,
  type CustomerRiadRecord,
  type RiadType,
} from '@/lib/customers/riad';
import type { CustomerRecord } from '@/lib/customers/types';

type Props = {
  companyId: number;
  customers?: CustomerRecord[];
  /** Optional fixed customer (e.g. from a profile deep-link) */
  fixedCustomerId?: number | null;
  compact?: boolean;
};

const emptyForm = {
  entry_type: 'risk' as RiadType,
  title: '',
  description: '',
  status: 'open',
  severity: 'medium',
  category: '',
  customer_id: '',
  owner_name: '',
  due_date: '',
  mitigation_plan: '',
  notes: '',
};

export default function CustomerRiadRegister({
  companyId,
  customers = [],
  fixedCustomerId = null,
  compact = false,
}: Props) {
  const [tab, setTab] = useState<RiadType | 'all'>('all');
  const [items, setItems] = useState<CustomerRiadRecord[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    closed: 0,
    inProgress: 0,
    onHold: 0,
    critical: 0,
    byStatus: {} as Record<string, number>,
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<CustomerRiadRecord | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [customerFilter, setCustomerFilter] = useState(
    fixedCustomerId ? String(fixedCustomerId) : 'all'
  );
  const [form, setForm] = useState({
    ...emptyForm,
    customer_id: fixedCustomerId ? String(fixedCustomerId) : '',
  });
  const [closing, setClosing] = useState(false);
  const [resolutionText, setResolutionText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      const cid = fixedCustomerId || (customerFilter !== 'all' ? Number(customerFilter) : null);
      if (cid) params.set('customerId', String(cid));
      if (tab !== 'all') params.set('type', tab);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/customers/riad?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const list = (data.items || data.entries || []) as CustomerRiadRecord[];
      setItems(
        list.map((e) => ({
          ...e,
          entry_type: e.entry_type || (e as { riad_type?: string }).riad_type || 'risk',
          severity: e.severity || (e as { priority?: string }).priority || 'medium',
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
          byStatus: {},
        }
      );
      if (data.warning) toast.message(data.warning, { description: data.hint });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, fixedCustomerId, customerFilter, tab, statusFilter]);

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
        i.customer_name?.toLowerCase().includes(needle) ||
        i.owner_name?.toLowerCase().includes(needle)
    );
  }, [items, q]);

  const openCreate = (type?: RiadType) => {
    setForm({
      ...emptyForm,
      entry_type: type || (tab !== 'all' ? tab : 'risk'),
      customer_id: fixedCustomerId
        ? String(fixedCustomerId)
        : customerFilter !== 'all'
          ? customerFilter
          : '',
    });
    setShowModal(true);
  };

  const submit = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        companyId,
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        entry_type: form.entry_type,
        title: form.title.trim(),
        description: form.description || null,
        status: form.status,
        severity: form.severity,
        priority: form.severity,
        owner_name: form.owner_name || null,
        due_date: form.due_date || null,
        category: form.category || null,
        mitigation_plan: form.mitigation_plan || null,
        notes: form.notes || null,
      };

      const res = await fetch('/api/customers/riad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Create failed');
      toast.success(
        `${form.entry_type.charAt(0).toUpperCase() + form.entry_type.slice(1)} logged`
      );
      setShowModal(false);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (
    item: CustomerRiadRecord,
    status: string,
    extras?: { resolution?: string }
  ) => {
    setClosing(true);
    try {
      const res = await fetch('/api/customers/riad', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          status,
          resolution:
            extras?.resolution ??
            (status === 'resolved' || status === 'closed'
              ? resolutionText || item.resolution || undefined
              : undefined),
          closed_at:
            status === 'closed' || status === 'resolved' ? new Date().toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Update failed');
        return;
      }
      toast.success(
        status === 'closed' || status === 'resolved'
          ? `${(item.entry_type || 'Item').charAt(0).toUpperCase()}${(item.entry_type || 'item').slice(1)} closed`
          : 'Status updated'
      );
      const next = data.item || data.entry;
      if (next) {
        setDetail({
          ...next,
          entry_type: next.entry_type || next.riad_type,
          severity: next.severity || next.priority,
          customer_name: next.customer_name || item.customer_name,
        });
      }
      setResolutionText('');
      void load();
    } finally {
      setClosing(false);
    }
  };

  const closeItem = async (item: CustomerRiadRecord) => {
    const note =
      resolutionText.trim() ||
      (typeof window !== 'undefined'
        ? window.prompt('Optional close note / resolution (or leave blank):') || ''
        : '');
    await updateStatus(item, 'closed', { resolution: note || 'Closed' });
  };

  const remove = async (item: CustomerRiadRecord) => {
    if (!confirm('Delete this RIAD entry?')) return;
    const res = await fetch(`/api/customers/riad?id=${item.id}`, { method: 'DELETE' });
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

  const statusChips: Array<{
    key: string;
    label: string;
    count: number;
    activeClass: string;
    idleClass: string;
  }> = [
    {
      key: 'all',
      label: 'All',
      count: summary.total,
      activeClass: 'bg-slate-900 text-white border-slate-900',
      idleClass: 'bg-white text-slate-700 border-neutral-200 hover:border-neutral-300',
    },
    {
      key: 'open',
      label: 'Open',
      count: summary.open,
      activeClass: 'bg-sky-600 text-white border-sky-600',
      idleClass: 'bg-sky-50 text-sky-900 border-sky-100 hover:border-sky-300',
    },
    {
      key: 'in_progress',
      label: 'In progress',
      count: summary.inProgress,
      activeClass: 'bg-indigo-600 text-white border-indigo-600',
      idleClass: 'bg-indigo-50 text-indigo-900 border-indigo-100 hover:border-indigo-300',
    },
    {
      key: 'on_hold',
      label: 'On hold',
      count: summary.onHold,
      activeClass: 'bg-amber-500 text-white border-amber-500',
      idleClass: 'bg-amber-50 text-amber-900 border-amber-100 hover:border-amber-300',
    },
    {
      key: 'closed',
      label: 'Closed',
      count: summary.closed,
      activeClass: 'bg-emerald-600 text-white border-emerald-600',
      idleClass: 'bg-emerald-50 text-emerald-900 border-emerald-100 hover:border-emerald-300',
    },
    {
      key: 'critical',
      label: 'Critical open',
      count: summary.critical,
      activeClass: 'bg-red-600 text-white border-red-600',
      idleClass: 'bg-red-50 text-red-900 border-red-100 hover:border-red-300',
    },
  ];

  const filterLabel =
    statusFilter === 'all'
      ? 'all items'
      : statusFilter === 'open'
        ? 'open items'
        : statusFilter === 'closed'
          ? 'closed items'
          : statusFilter === 'critical'
            ? 'critical open items'
            : statusFilter.replace('_', ' ');

  return (
    <div className={compact ? '' : ''}>
      <div className="mb-2 text-xs font-medium text-neutral-500 uppercase tracking-wide">
        Status overview · click to filter
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-6">
        {statusChips.map((chip) => {
          const active = statusFilter === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setStatusFilter(chip.key)}
              className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                active
                  ? chip.activeClass + ' shadow-md ring-2 ring-offset-1 ring-current/20'
                  : chip.idleClass
              }`}
            >
              <div className="text-[11px] font-medium opacity-90">{chip.label}</div>
              <div className="text-2xl font-black tracking-tight mt-0.5">{chip.count}</div>
            </button>
          );
        })}
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
            All types
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

      <div className="flex flex-col sm:flex-row gap-3 mb-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            className="input w-full !py-2.5 !pl-10 !text-sm"
            placeholder="Search title, customer, category…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Filter className="w-4 h-4 text-neutral-400" />
          <select
            className="input !py-2.5 !text-sm !w-auto min-w-[150px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="open">Open (bucket)</option>
            <option value="closed">Closed (bucket)</option>
            <option value="critical">Critical open</option>
            {RIAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} only
              </option>
            ))}
          </select>
          {!fixedCustomerId && customers.length > 0 && (
            <select
              className="input !py-2.5 !text-sm !w-auto min-w-[160px]"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            >
              <option value="all">All customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.trading_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <p className="text-xs text-neutral-500 mb-4">
        Showing <strong className="text-slate-700">{filtered.length}</strong> {filterLabel}
        {summary.total > 0 ? (
          <>
            {' '}
            · <span className="text-sky-700 font-medium">{summary.open} open</span>
            {' · '}
            <span className="text-emerald-700 font-medium">{summary.closed} closed</span>
          </>
        ) : null}
      </p>

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
              Log risks, issues, actions, and decisions for customer relationships.
            </p>
            <button
              type="button"
              onClick={() => openCreate()}
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              Log first entry
            </button>
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((item) => {
              const Icon = typeIcon(item.entry_type);
              const closed = isClosedLike(item.status);
              const priority = item.severity || 'medium';
              return (
                <li key={item.id} className="flex items-stretch gap-0">
                  <button
                    type="button"
                    onClick={() => {
                      setDetail(item);
                      setResolutionText(item.resolution || '');
                    }}
                    className="flex-1 text-left px-4 sm:px-6 py-4 hover:bg-neutral-50 transition-colors flex gap-3 items-start min-w-0"
                  >
                    <div className="mt-0.5 p-2 rounded-xl bg-neutral-100">
                      <Icon className="w-4 h-4 text-[#00b4d8]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                          {item.entry_type}
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full border capitalize ${priorityClass(priority)}`}
                        >
                          {priority}
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${statusClass(item.status)}`}
                        >
                          {(item.status || 'open').replace('_', ' ')}
                        </span>
                      </div>
                      <div
                        className={`font-semibold truncate ${closed ? 'text-neutral-500 line-through decoration-neutral-300' : 'text-slate-900'}`}
                      >
                        {item.title}
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5 flex flex-wrap gap-x-2">
                        <span>{item.customer_name || 'General (no customer)'}</span>
                        {item.category && <span>· {item.category}</span>}
                        {item.due_date && <span>· due {item.due_date}</span>}
                        {item.owner_name && <span>· {item.owner_name}</span>}
                      </div>
                    </div>
                    {priority === 'critical' && !closed && (
                      <div className="text-sm font-bold px-3 py-1 rounded-xl bg-red-600 text-white">
                        Critical
                      </div>
                    )}
                  </button>
                  {!closed && (
                    <div className="flex items-center pr-3 sm:pr-4">
                      <button
                        type="button"
                        disabled={closing}
                        onClick={(e) => {
                          e.stopPropagation();
                          void closeItem(item);
                        }}
                        className="text-xs font-semibold px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 whitespace-nowrap"
                        title="Close this RIAD item"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Create modal — same structure as container RIAD */}
      {showModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="min-h-full flex items-start sm:items-center justify-center p-3 sm:p-4 py-8">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border max-h-[min(92dvh,900px)] flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
                <h2 className="font-bold text-xl text-slate-900">Log new RIAD</h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-xl hover:bg-neutral-100"
                >
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
                        onClick={() => setForm({ ...form, entry_type: t.key })}
                        className={`py-2 rounded-xl text-xs font-semibold border ${
                          form.entry_type === t.key
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
                    placeholder="What happened / what needs attention for this customer relationship"
                  />
                </div>
                {!fixedCustomerId && (
                  <div>
                    <label className="text-xs font-medium">Customer</label>
                    <select
                      className="input mt-1 w-full !p-3 !text-sm"
                      value={form.customer_id}
                      onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                    >
                      <option value="">Company-wide (no specific customer)</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.trading_name}
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
                      {CUSTOMER_RIAD_CATEGORIES.map((c) => (
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
                      value={form.severity}
                      onChange={(e) => setForm({ ...form, severity: e.target.value })}
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

                {form.entry_type === 'risk' && (
                  <div>
                    <label className="text-xs font-medium">Mitigation plan</label>
                    <textarea
                      className="input mt-1 w-full !p-3 !text-sm min-h-[70px]"
                      value={form.mitigation_plan}
                      onChange={(e) => setForm({ ...form, mitigation_plan: e.target.value })}
                      placeholder="How will this customer risk be reduced or controlled?"
                    />
                  </div>
                )}

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
              </div>
              <div className="flex gap-3 p-5 border-t flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1 !py-3"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submit()}
                  className="btn-primary flex-1 !py-3"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save entry'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex justify-end"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-500 font-semibold">
                  {detail.entry_type}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-1">{detail.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="p-2 rounded-xl hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <span
                className={`text-xs px-2 py-1 rounded-full capitalize ${statusClass(detail.status)}`}
              >
                {(detail.status || '').replace('_', ' ')}
              </span>
              <span
                className={`text-xs px-2 py-1 rounded-full border capitalize ${priorityClass(detail.severity)}`}
              >
                {detail.severity || 'medium'}
              </span>
            </div>
            {detail.description && (
              <p className="text-sm text-neutral-700 mb-4 whitespace-pre-wrap">
                {detail.description}
              </p>
            )}
            <dl className="space-y-2 text-sm mb-6">
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-500">Customer</dt>
                <dd className="font-medium text-right">
                  {detail.customer_name || 'General (no customer)'}
                </dd>
              </div>
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
              {detail.created_by && (
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Logged by</dt>
                  <dd className="font-medium">{detail.created_by}</dd>
                </div>
              )}
              {detail.related_order_id != null && (
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Related order</dt>
                  <dd className="font-medium">#{detail.related_order_id}</dd>
                </div>
              )}
              {detail.related_claim_id != null && (
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Related claim</dt>
                  <dd className="font-medium">#{detail.related_claim_id}</dd>
                </div>
              )}
            </dl>
            {detail.mitigation_plan && (
              <div className="mb-4 p-3 rounded-2xl bg-emerald-50 text-sm text-emerald-900">
                <div className="font-semibold mb-1">Mitigation</div>
                {detail.mitigation_plan}
              </div>
            )}
            {detail.resolution && (
              <div className="mb-4 p-3 rounded-2xl bg-neutral-50 text-sm text-slate-700 border">
                <div className="font-semibold mb-1 text-neutral-600">Resolution / close note</div>
                {detail.resolution}
              </div>
            )}

            {!isClosedLike(detail.status) ? (
              <div className="space-y-3 mb-6 p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40">
                <div className="font-semibold text-sm text-emerald-900">
                  Close this {detail.entry_type || 'item'}
                </div>
                <textarea
                  className="input w-full !p-3 !text-sm min-h-[80px] bg-white"
                  placeholder="Resolution note (what was done, outcome…)"
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                />
                <button
                  type="button"
                  disabled={closing}
                  onClick={() =>
                    void updateStatus(detail, 'closed', {
                      resolution: resolutionText || 'Closed',
                    })
                  }
                  className="btn-primary w-full !py-3 text-sm"
                >
                  {closing ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Close {detail.entry_type || 'item'}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={closing}
                  onClick={() =>
                    void updateStatus(detail, 'resolved', {
                      resolution: resolutionText || 'Resolved',
                    })
                  }
                  className="btn-secondary w-full !py-2.5 text-sm"
                >
                  Mark resolved
                </button>
              </div>
            ) : (
              <div className="mb-6 p-4 rounded-2xl bg-neutral-100 text-sm text-neutral-700">
                This item is <strong className="capitalize">{detail.status}</strong>
                {detail.closed_at
                  ? ` · ${new Date(detail.closed_at).toLocaleString()}`
                  : ''}
                . You can reopen it below.
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-500">Update status</label>
              <select
                className="input w-full !p-3 !text-sm"
                value={
                  RIAD_STATUSES.some((s) => s.value === detail.status)
                    ? detail.status
                    : detail.status === 'active'
                      ? 'open'
                      : detail.status || 'open'
                }
                onChange={(e) => void updateStatus(detail, e.target.value)}
                disabled={closing}
              >
                {detail.status &&
                  !RIAD_STATUSES.some((s) => s.value === detail.status) &&
                  detail.status !== 'active' && (
                    <option value={detail.status}>{detail.status}</option>
                  )}
                {RIAD_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void remove(detail)}
              className="mt-6 text-red-600 text-sm inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> Delete entry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
