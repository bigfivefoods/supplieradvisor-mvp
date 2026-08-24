'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Gavel,
  Plus,
  Search,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import {
  RIAD_PRIORITIES,
  RIAD_STATUSES,
  RIAD_TYPES,
  priorityClass,
  statusClass,
  type RiadType,
} from '@/lib/containers/riad';
import {
  CUSTOMER_RIAD_CATEGORIES,
  isClosedLike,
  isOpenLike,
} from '@/lib/customers/riad';
import { SUPPLIER_RIAD_CATEGORIES } from '@/lib/suppliers/riad';
import type {
  PortalPersonPublic,
  PortalRiadView,
  TradePortalKind,
} from '@/lib/portals/trade-portal';
import { stripPortalTaskRiadMark } from '@/lib/portals/trade-portal';
import { portalPersonKey } from '@/lib/portals/trade-portal-people';
import { RiadMetricsBoard } from '@/components/riad/RiadMetricsBoard';

const emptyForm = {
  entry_type: 'risk' as RiadType,
  title: '',
  description: '',
  status: 'open',
  severity: 'medium',
  category: '',
  owner_name: '',
  due_date: '',
  mitigation_plan: '',
  notes: '',
};

function typeIcon(t: string) {
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
}

export function PortalRiadPanel({
  kind,
  items,
  busy,
  ownerName,
  people,
  hostName,
  accountLabel,
  onAct,
}: {
  kind: TradePortalKind;
  items: PortalRiadView[];
  busy: boolean;
  ownerName: string;
  people?: PortalPersonPublic[];
  hostName?: string;
  accountLabel?: string | null;
  onAct: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const categories =
    kind === 'supplier' ? SUPPLIER_RIAD_CATEGORIES : CUSTOMER_RIAD_CATEGORIES;
  const [tab, setTab] = useState<RiadType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState('open');
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    ...emptyForm,
    owner_name: ownerName,
  });
  const [detail, setDetail] = useState<PortalRiadView | null>(null);
  const [resolution, setResolution] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!detail) return;
    const next = items.find((i) => i.id === detail.id);
    if (next) setDetail(next);
    else setDetail(null);
  }, [items, detail?.id]);

  const summary = useMemo(() => {
    const norm = (s?: string | null) => String(s || 'open').toLowerCase();
    return {
      total: items.length,
      open: items.filter((i) => isOpenLike(i.status)).length,
      closed: items.filter((i) => isClosedLike(i.status)).length,
      inProgress: items.filter((i) => norm(i.status) === 'in_progress').length,
      onHold: items.filter((i) => norm(i.status) === 'on_hold').length,
      critical: items.filter(
        (i) =>
          isOpenLike(i.status) &&
          String(i.severity || '').toLowerCase() === 'critical'
      ).length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (tab !== 'all' && i.entry_type !== tab) return false;
      const st = String(i.status || 'open').toLowerCase();
      if (statusFilter === 'open' && !isOpenLike(i.status)) return false;
      if (statusFilter === 'closed' && !isClosedLike(i.status)) return false;
      if (statusFilter === 'critical') {
        if (
          !isOpenLike(i.status) ||
          String(i.severity || '').toLowerCase() !== 'critical'
        ) {
          return false;
        }
      } else if (
        statusFilter !== 'all' &&
        statusFilter !== 'open' &&
        statusFilter !== 'closed' &&
        st !== statusFilter
      ) {
        return false;
      }
      if (!needle) return true;
      return (
        i.title.toLowerCase().includes(needle) ||
        (i.description || '').toLowerCase().includes(needle) ||
        (i.category || '').toLowerCase().includes(needle) ||
        (i.owner_name || '').toLowerCase().includes(needle)
      );
    });
  }, [items, tab, statusFilter, q]);

  const submit = async () => {
    if (!form.title.trim()) return;
    await onAct({
      action: 'riad_add',
      entry_type: form.entry_type,
      title: form.title.trim(),
      description: form.description || undefined,
      status: form.status,
      severity: form.severity,
      category: form.category || undefined,
      owner_name: form.owner_name || ownerName || undefined,
      due_date: form.due_date || undefined,
      mitigation_plan: form.mitigation_plan || undefined,
      notes: form.notes || undefined,
    });
    setForm({ ...emptyForm, owner_name: ownerName, entry_type: form.entry_type });
    setShowForm(false);
  };

  const patch = async (id: number, extra: Record<string, unknown>) => {
    await onAct({ action: 'riad_update', id, ...extra });
    if (detail?.id === id) {
      setDetail((prev) => (prev ? { ...prev, ...extra, id } : prev));
    }
  };

  return (
    <div className="space-y-4">
      <RiadMetricsBoard
        universe={items}
        slice={filtered}
        summary={summary}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
      />

      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6] pt-1">
        Register
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Log RIAD
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          className="input w-full !py-2.5 !pl-10 !text-sm"
          placeholder="Search title, category, owner…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {showForm ? (
        <div className="rounded-[1.5rem] border border-white/70 bg-white p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black text-slate-900">Log new RIAD</p>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1.5 rounded-xl hover:bg-neutral-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
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
          <input
            className="input w-full !p-3 !text-sm"
            placeholder="Title *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            className="input w-full !p-3 !text-sm min-h-[80px]"
            placeholder="What happened / what needs attention"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid sm:grid-cols-2 gap-2">
            <select
              className="input !p-3 !text-sm"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="">Category…</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="input !p-3 !text-sm"
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
            >
              {RIAD_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {people && people.length > 0 ? (
              <select
                className="input !p-3 !text-sm"
                value={form.owner_name || ownerName || ''}
                onChange={(e) =>
                  setForm({ ...form, owner_name: e.target.value })
                }
              >
                {people.some((p) => p.name === (form.owner_name || ownerName)) ? null : (
                  <option value={form.owner_name || ownerName || ''}>
                    {form.owner_name || ownerName || 'Owner'}
                  </option>
                )}
                {people.filter((p) => p.side === 'host').length ? (
                  <optgroup label={hostName || 'Host team'}>
                    {people
                      .filter((p) => p.side === 'host')
                      .map((p) => (
                        <option key={portalPersonKey(p)} value={p.name}>
                          {p.name}
                          {p.you ? ' (you)' : ''}
                        </option>
                      ))}
                  </optgroup>
                ) : null}
                {people.filter((p) => p.side !== 'host').length ? (
                  <optgroup label={accountLabel || 'Portal people'}>
                    {people
                      .filter((p) => p.side !== 'host')
                      .map((p) => (
                        <option key={portalPersonKey(p)} value={p.name}>
                          {p.name}
                          {p.you ? ' (you)' : ''}
                        </option>
                      ))}
                  </optgroup>
                ) : null}
              </select>
            ) : (
              <input
                className="input !p-3 !text-sm"
                placeholder="Owner"
                value={form.owner_name}
                onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
              />
            )}
            <input
              type="date"
              className="input !p-3 !text-sm"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          {form.entry_type === 'risk' ? (
            <textarea
              className="input w-full !p-3 !text-sm min-h-[64px]"
              placeholder="Mitigation plan — how will this risk be reduced?"
              value={form.mitigation_plan}
              onChange={(e) =>
                setForm({ ...form, mitigation_plan: e.target.value })
              }
            />
          ) : null}
          <select
            className="input w-full !p-3 !text-sm"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {RIAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !form.title.trim()}
            onClick={() => void submit()}
            className="btn-primary w-full !py-2.5 text-sm"
          >
            Save entry
          </button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-[1.5rem] border border-white/70 bg-white/90 p-6 text-sm text-neutral-500">
          No RIAD entries in this filter. Log a risk, issue, action, or decision —
          it writes to the same register we run internally.
        </p>
      ) : (
        <ul className="rounded-[1.5rem] border border-white/70 bg-white/90 overflow-hidden divide-y divide-slate-100">
          {filtered.map((item) => {
            const Icon = typeIcon(item.entry_type);
            const closed = isClosedLike(item.status);
            const priority = item.severity || 'medium';
            return (
              <li key={item.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => {
                    setDetail(item);
                    setResolution(item.resolution || '');
                    setComment('');
                  }}
                  className="flex-1 text-left px-4 py-3.5 hover:bg-slate-50 flex gap-3 items-start min-w-0"
                >
                  <div className="mt-0.5 p-2 rounded-xl bg-neutral-100">
                    <Icon className="w-4 h-4 text-[#00b4d8]" />
                  </div>
                  <div className="min-w-0 flex-1">
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
                    <p
                      className={`font-semibold truncate ${
                        closed
                          ? 'text-neutral-500 line-through decoration-neutral-300'
                          : 'text-slate-900'
                      }`}
                    >
                      {item.title}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5 flex flex-wrap gap-x-2">
                      {item.related_task_id ? (
                        <span className="text-[#0077b6] font-semibold">
                          Task #{item.related_task_id}
                        </span>
                      ) : null}
                      {item.category ? <span>· {item.category}</span> : null}
                      {item.due_date ? <span>· due {item.due_date}</span> : null}
                      {item.owner_name ? <span>· {item.owner_name}</span> : null}
                    </p>
                  </div>
                </button>
                {!closed ? (
                  <div className="flex items-center pr-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void patch(item.id, {
                          status: 'closed',
                          resolution: 'Closed from portal',
                        })
                      }
                      className="text-xs font-semibold px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800"
                    >
                      Close
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {detail ? (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex justify-end"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500 font-semibold">
                  {detail.entry_type}
                </p>
                <h3 className="text-xl font-bold text-slate-900 mt-1">
                  {detail.title}
                </h3>
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
            {detail.description ? (
              <p className="text-sm text-neutral-700 mb-4 whitespace-pre-wrap">
                {detail.description}
              </p>
            ) : null}
            <dl className="space-y-2 text-sm mb-4">
              {detail.category ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Category</dt>
                  <dd className="font-medium">{detail.category}</dd>
                </div>
              ) : null}
              {detail.owner_name ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Owner</dt>
                  <dd className="font-medium">{detail.owner_name}</dd>
                </div>
              ) : null}
              {detail.due_date ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Due</dt>
                  <dd className="font-medium">{detail.due_date}</dd>
                </div>
              ) : null}
              {detail.created_by ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Logged by</dt>
                  <dd className="font-medium">{detail.created_by}</dd>
                </div>
              ) : null}
            </dl>
            {detail.mitigation_plan ? (
              <div className="mb-4 p-3 rounded-2xl bg-emerald-50 text-sm text-emerald-900">
                <div className="font-semibold mb-1">Mitigation</div>
                {detail.mitigation_plan}
              </div>
            ) : null}
            {detail.resolution ? (
              <div className="mb-4 p-3 rounded-2xl bg-neutral-50 text-sm text-slate-700 border">
                <div className="font-semibold mb-1 text-neutral-600">
                  Resolution / close note
                </div>
                {detail.resolution}
              </div>
            ) : null}
            {stripPortalTaskRiadMark(detail.notes) ? (
              <pre className="mb-4 text-[11px] text-neutral-500 whitespace-pre-wrap font-sans rounded-2xl bg-slate-50 p-3">
                {stripPortalTaskRiadMark(detail.notes)}
              </pre>
            ) : null}
            {detail.related_task_id ? (
              <p className="mb-4 text-xs font-semibold text-[#0077b6]">
                Linked to project task #{detail.related_task_id}
              </p>
            ) : null}

            <label className="text-xs font-medium text-neutral-500">Status</label>
            <select
              className="input w-full !p-3 !text-sm mt-1 mb-4"
              value={
                RIAD_STATUSES.some((s) => s.value === detail.status)
                  ? detail.status
                  : 'open'
              }
              disabled={busy}
              onChange={(e) => void patch(detail.id, { status: e.target.value })}
            >
              {RIAD_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <label className="text-xs font-medium text-neutral-500">Priority</label>
            <select
              className="input w-full !p-3 !text-sm mt-1 mb-4"
              value={detail.severity || 'medium'}
              disabled={busy}
              onChange={(e) => void patch(detail.id, { severity: e.target.value })}
            >
              {RIAD_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>

            {!isClosedLike(detail.status) ? (
              <div className="space-y-3 mb-6 p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40">
                <p className="font-semibold text-sm text-emerald-900">
                  Close this {detail.entry_type}
                </p>
                <textarea
                  className="input w-full !p-3 !text-sm min-h-[80px] bg-white"
                  placeholder="Resolution note (what was done, outcome…)"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void patch(detail.id, {
                      status: 'closed',
                      resolution: resolution || 'Closed',
                    })
                  }
                  className="btn-primary w-full !py-3 text-sm inline-flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> Close {detail.entry_type}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void patch(detail.id, {
                      status: 'resolved',
                      resolution: resolution || 'Resolved',
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
                .
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void patch(detail.id, { status: 'open' })}
                  className="mt-3 btn-secondary w-full !py-2 text-sm"
                >
                  Reopen
                </button>
              </div>
            )}

            <div className="flex gap-2 mb-6">
              <input
                className="input flex-1 !py-2 !px-2.5 !text-sm"
                placeholder="Add a comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button
                type="button"
                disabled={busy || !comment.trim()}
                onClick={() => {
                  const n = comment;
                  setComment('');
                  void onAct({
                    action: 'riad_comment',
                    id: detail.id,
                    notes: n,
                  });
                }}
                className="btn-secondary !py-2 !px-3 text-xs"
              >
                Comment
              </button>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!confirm('Delete this RIAD entry?')) return;
                void onAct({ action: 'riad_delete', id: detail.id });
                setDetail(null);
              }}
              className="w-full text-sm font-bold text-rose-700 inline-flex items-center justify-center gap-1.5 py-2"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
