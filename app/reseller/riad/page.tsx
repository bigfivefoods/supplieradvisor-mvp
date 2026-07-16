'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  AlertTriangle,
  Plus,
  X,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId, extractEmailFromPrivyUser } from '@/lib/auth/identity';
import {
  RESELLER_RIAD_CATEGORIES,
  RIAD_PRIORITIES,
  RIAD_STATUSES,
  RIAD_TYPES,
  computeRpn,
  isOpenStatus,
  priorityClass,
  rpnBand,
  statusClass,
  type ResellerRiadRecord,
  type RiadType,
} from '@/lib/containers/reseller-riad';
import {
  clearOfflineDraft,
  isBrowserOnline,
  loadOfflineDraft,
  saveOfflineDraft,
} from '@/lib/pwa/offline-draft';

type ProductOption = {
  key: string;
  product_id: number | null;
  product_name: string;
  sku?: string | null;
};

const emptyForm = {
  riad_type: 'issue' as RiadType,
  title: '',
  description: '',
  priority: 'medium',
  category: '',
  product_key: '',
  severity: 3,
  likelihood: 3,
  time_horizon: 3,
  mitigation_plan: '',
  notes: '',
};

export default function ResellerRiadPage() {
  const { user } = usePrivy();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resellerId, setResellerId] = useState<number | null>(null);
  const [actorName, setActorName] = useState('');
  const [items, setItems] = useState<ResellerRiadRecord[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    closed: 0,
    critical: 0,
  });
  const [statusFilter, setStatusFilter] = useState('open');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [detail, setDetail] = useState<ResellerRiadRecord | null>(null);
  const [resolution, setResolution] = useState('');
  const [offlinePending, setOfflinePending] = useState(false);
  const [online, setOnline] = useState(true);

  const draftKey = 'reseller_riad_form';

  const authBody = useCallback(() => {
    if (!user) return null;
    return {
      privyUserId: getCanonicalUserId(user.id),
      email: extractEmailFromPrivyUser(user),
    };
  }, [user]);

  useEffect(() => {
    setOnline(isBrowserOnline());
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const draft = loadOfflineDraft<typeof emptyForm>(draftKey);
    if (draft?.value) {
      setForm({ ...emptyForm, ...draft.value });
      setOfflinePending(true);
      setShowModal(true);
      toast.message('Restored offline RIAD draft', {
        description: 'Review and submit when you are back online.',
      });
    }
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const body = authBody()!;
      const sessionRes = await fetch('/api/reseller/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const session = await sessionRes.json();
      const r = session.resellers?.[0];
      setResellerId(r?.id ?? null);
      setActorName(r?.full_name || body.email || '');
      const opts: ProductOption[] = (session.productOptions || []).map(
        (p: ProductOption) => ({
          key: p.key,
          product_id: p.product_id,
          product_name: p.product_name,
          sku: p.sku,
        })
      );
      setProducts(opts);

      const fbRes = await fetch('/api/reseller/riad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          resellerId: r?.id,
          list: true,
        }),
      });
      const data = await fbRes.json();
      if (data.migration_required) {
        toast.message('RIAD migration pending on server');
      }
      if (!fbRes.ok) throw new Error(data.error || 'Failed to load');
      let list: ResellerRiadRecord[] = data.items || [];
      setSummary(
        data.summary || { total: 0, open: 0, closed: 0, critical: 0 }
      );
      if (statusFilter === 'open') {
        list = list.filter((i) => isOpenStatus(i.status));
      } else if (statusFilter === 'closed') {
        list = list.filter((i) =>
          ['closed', 'resolved'].includes(
            String(i.status || '').toLowerCase()
          )
        );
      } else if (statusFilter === 'critical') {
        list = list.filter(
          (i) =>
            isOpenStatus(i.status) &&
            (String(i.priority).toLowerCase() === 'critical' ||
              (i.rpn != null && Number(i.rpn) >= 75))
        );
      }
      setItems(list);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user, authBody, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const rpn = computeRpn(form.severity, form.likelihood, form.time_horizon);

  const submit = async () => {
    if (!user || !resellerId) return;
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    // Offline: persist draft locally until network returns
    if (!isBrowserOnline()) {
      saveOfflineDraft(draftKey, form);
      setOfflinePending(true);
      toast.message('Saved offline', {
        description: 'RIAD draft stored on this device. Submit when online.',
      });
      return;
    }
    const prod = products.find((p) => p.key === form.product_key);
    setSaving(true);
    try {
      const res = await fetch('/api/reseller/riad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authBody(),
          resellerId,
          riad_type: form.riad_type,
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          category: form.category || null,
          product_id: prod?.product_id ?? null,
          product_name: prod?.product_name ?? null,
          sku: prod?.sku ?? null,
          severity: form.riad_type === 'risk' ? form.severity : null,
          likelihood: form.riad_type === 'risk' ? form.likelihood : null,
          time_horizon: form.riad_type === 'risk' ? form.time_horizon : null,
          mitigation_plan: form.mitigation_plan.trim() || null,
          notes: form.notes.trim() || null,
          created_by_name: actorName,
          owner_name: actorName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      toast.success(data.message || 'RIAD logged');
      clearOfflineDraft(draftKey);
      setOfflinePending(false);
      setShowModal(false);
      setForm(emptyForm);
      void load();
    } catch (e: unknown) {
      // Network blip: keep a local draft so field users don't lose the report
      if (!isBrowserOnline() || (e instanceof TypeError)) {
        saveOfflineDraft(draftKey, form);
        setOfflinePending(true);
        toast.message('Saved offline draft', {
          description: 'Could not reach the server. Try Submit again when online.',
        });
        setSaving(false);
        return;
      }
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (
    item: ResellerRiadRecord,
    status: string,
    resText?: string
  ) => {
    if (!user || !resellerId) return;
    try {
      const res = await fetch('/api/reseller/riad', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authBody(),
          resellerId,
          id: item.id,
          status,
          resolution: resText ?? item.resolution,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        status === 'closed' || status === 'resolved'
          ? 'Marked resolved'
          : `Status → ${status}`
      );
      setDetail(null);
      setResolution('');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  if (loading && !items.length) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (!resellerId) {
    return (
      <p className="text-sm text-slate-500">
        No reseller profile linked. Open your invite link first.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 mb-1 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            RIAD log
          </h1>
          <p className="text-sm text-slate-500">
            Log risks, issues, actions and decisions from the field. Your network
            operator sees these so problems get fixed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm);
            setShowModal(true);
          }}
          className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" /> Log
        </button>
      </div>

      {(!online || offlinePending) && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            online
              ? 'border-amber-200 bg-amber-50 text-amber-950'
              : 'border-slate-300 bg-slate-100 text-slate-800'
          }`}
        >
          {!online ? (
            <strong>Offline</strong>
          ) : (
            <strong>Offline draft ready</strong>
          )}
          {' — '}
          {!online
            ? 'You can still fill a RIAD form; it will be saved on this device until you reconnect.'
            : 'You have a local RIAD draft. Open Log and Submit to sync it to the network.'}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi label="Total" value={String(summary.total)} />
        <Kpi label="Open" value={String(summary.open)} tone="sky" />
        <Kpi label="Critical" value={String(summary.critical)} tone="rose" />
        <Kpi label="Closed" value={String(summary.closed)} tone="emerald" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[
          { v: 'open', l: 'Open' },
          { v: 'critical', l: 'Critical' },
          { v: 'closed', l: 'Closed' },
          { v: 'all', l: 'All' },
        ].map((f) => (
          <button
            key={f.v}
            type="button"
            onClick={() => setStatusFilter(f.v)}
            className={`rounded-full border px-3 py-1 text-xs font-bold ${
              statusFilter === f.v
                ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-4">
            No RIAD entries yet. Log stock problems, quality issues, pricing
            pushback, or safety risks.
          </p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Log first entry
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const typeMeta = RIAD_TYPES.find((t) => t.key === item.riad_type);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setDetail(item);
                    setResolution(item.resolution || '');
                  }}
                  className="w-full text-left rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:border-cyan-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {typeMeta?.label || item.riad_type}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${priorityClass(item.priority)}`}
                        >
                          {item.priority}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusClass(item.status)}`}
                        >
                          {item.status}
                        </span>
                        {item.rpn != null && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rpnBand(Number(item.rpn)).className}`}
                          >
                            RPN {item.rpn}
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-slate-900 truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {item.product_name ? `${item.product_name} · ` : ''}
                        {item.category ? `${item.category} · ` : ''}
                        {item.created_at
                          ? new Date(item.created_at).toLocaleString('en-ZA')
                          : ''}
                      </div>
                    </div>
                  </div>
                  {item.description && (
                    <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
              <h3 className="font-bold text-slate-900">Log RIAD entry</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Type
                </label>
                <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                  {RIAD_TYPES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, riad_type: t.key }))
                      }
                      className={`rounded-xl border py-2 text-xs font-bold ${
                        form.riad_type === t.key
                          ? 'border-[#00b4d8] bg-sky-50 text-[#0077b6]'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-xs font-semibold text-slate-600">
                Title *
                <input
                  className="mt-1 input w-full !p-2.5 !text-sm"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="Short description of the problem"
                  maxLength={300}
                />
              </label>

              <label className="block text-xs font-semibold text-slate-600">
                Details
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[88px]"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="What happened? Who is affected? What do you need?"
                  maxLength={4000}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-slate-600">
                  Priority
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
                <label className="block text-xs font-semibold text-slate-600">
                  Category
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                  >
                    <option value="">Select…</option>
                    {RESELLER_RIAD_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {products.length > 0 && (
                <label className="block text-xs font-semibold text-slate-600">
                  Related product
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={form.product_key}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, product_key: e.target.value }))
                    }
                  >
                    <option value="">None / general</option>
                    {products.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.product_name}
                        {p.sku ? ` · ${p.sku}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {form.riad_type === 'risk' && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-3 space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-rose-700">
                    Risk score (RPN {rpn})
                  </div>
                  {(
                    [
                      ['severity', 'Severity'],
                      ['likelihood', 'Likelihood'],
                      ['time_horizon', 'Time horizon'],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-700"
                    >
                      {label}
                      <input
                        type="range"
                        min={1}
                        max={5}
                        value={form[key]}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            [key]: Number(e.target.value),
                          }))
                        }
                        className="flex-1 max-w-[160px]"
                      />
                      <span className="tabular-nums w-4">{form[key]}</span>
                    </label>
                  ))}
                </div>
              )}

              <label className="block text-xs font-semibold text-slate-600">
                Proposed action / mitigation
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[64px]"
                  value={form.mitigation_plan}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      mitigation_plan: e.target.value,
                    }))
                  }
                  placeholder="What should happen next?"
                />
              </label>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="btn-secondary !py-2.5 !px-4 text-sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submit()}
                  className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Save entry'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
              <h3 className="font-bold text-slate-900 pr-4">{detail.title}</h3>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${priorityClass(detail.priority)}`}
                >
                  {detail.priority}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusClass(detail.status)}`}
                >
                  {detail.status}
                </span>
                <span className="text-[10px] font-bold uppercase text-slate-400 px-2 py-0.5">
                  {detail.riad_type}
                </span>
              </div>
              {detail.description && (
                <p className="text-slate-700 whitespace-pre-wrap">
                  {detail.description}
                </p>
              )}
              {detail.product_name && (
                <p className="text-xs text-slate-500">
                  Product: <strong>{detail.product_name}</strong>
                </p>
              )}
              {detail.mitigation_plan && (
                <div>
                  <div className="text-[10px] font-black uppercase text-slate-400 mb-1">
                    Mitigation
                  </div>
                  <p className="text-slate-700">{detail.mitigation_plan}</p>
                </div>
              )}
              {isOpenStatus(detail.status) && (
                <div className="space-y-2 pt-2 border-t">
                  <label className="block text-xs font-semibold text-slate-600">
                    Resolution notes
                    <textarea
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[64px]"
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      placeholder="How was this fixed?"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void updateStatus(detail, 'in_progress')
                      }
                      className="btn-secondary !py-2 !px-3 text-xs"
                    >
                      In progress
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void updateStatus(detail, 'resolved', resolution)
                      }
                      className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                    </button>
                    <select
                      className="rounded-xl border border-slate-200 px-2 py-2 text-xs"
                      value={detail.status}
                      onChange={(e) =>
                        void updateStatus(detail, e.target.value)
                      }
                    >
                      {RIAD_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              {detail.resolution && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-emerald-900 text-xs">
                  <strong>Resolution:</strong> {detail.resolution}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'sky' | 'rose' | 'emerald';
}) {
  const tones = {
    neutral: 'border-slate-200 bg-white',
    sky: 'border-sky-100 bg-sky-50/50',
    rose: 'border-rose-100 bg-rose-50/50',
    emerald: 'border-emerald-100 bg-emerald-50/50',
  };
  return (
    <div className={`rounded-2xl border p-3 ${tones[tone]}`}>
      <div className="text-[10px] font-bold uppercase text-slate-400">{label}</div>
      <div className="text-lg font-black tabular-nums text-slate-900">{value}</div>
    </div>
  );
}
