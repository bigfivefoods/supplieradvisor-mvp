'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import {
  Loader2,
  Plus,
  ShieldCheck,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  INSPECTION_STATUSES,
  INSPECTION_TYPES,
  inspectionStatusClass,
  type QualityInspection,
} from '@/lib/quality/types';
import Link from 'next/link';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import { RoleDeniedBanner } from '@/components/chrome/RoleGuard';

export default function QualityInspectionsPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const { canOpsWrite, roleLabel } = useCompanyRole();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<QualityInspection[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    inspection_type: 'incoming',
    lot_number: '',
    inspector_name: '',
    notes: '',
    defects_found: '0',
    status: 'open',
  });

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        privyUserId: privyUserId || '',
      });
      if (filter !== 'all') params.set('status', filter);
      const res = await fetch(`/api/quality/inspections?${params}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to load');
        return;
      }
      setItems(json.inspections || []);
      setWarning(json.warning || null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!companyId || !privyUserId) {
      toast.error('Sign in and select a company');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/quality/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          inspection_type: form.inspection_type,
          lot_number: form.lot_number || null,
          inspector_name: form.inspector_name || null,
          notes: form.notes || null,
          defects_found: Number(form.defects_found) || 0,
          status: form.status,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to create');
        return;
      }
      toast.success('Inspection created');
      setShowForm(false);
      setForm({
        inspection_type: 'incoming',
        lot_number: '',
        inspector_name: '',
        notes: '',
        defects_found: '0',
        status: 'open',
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: number, status: string) => {
    if (!companyId || !privyUserId) return;
    const res = await fetch('/api/quality/inspections', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, privyUserId, id, status }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Update failed');
      return;
    }
    toast.success(`Marked ${status}`);
    await load();
  };

  const open = items.filter((i) => i.status === 'open').length;
  const failed = items.filter((i) => i.status === 'failed').length;
  const passed = items.filter((i) => i.status === 'passed').length;

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/quality"
        backLabel="Quality"
        eyebrow="QA release gate"
        title="Inspections"
        titleAccent="Live"
        description="Incoming and in-process checks with lot numbers. Pass releases the lot; fail holds it for investigation."
        action={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            disabled={!canOpsWrite}
            title={!canOpsWrite ? 'Operations write access required' : undefined}
            className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> New inspection
          </button>
        }
      />

      {/* Demo callout — ship blocks while open/failed */}
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-start gap-2 text-sm text-amber-950">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <p>
            <strong>Ship block demo:</strong> create an inspection with status{' '}
            <code className="text-[11px] bg-white/80 px-1 rounded">open</code> or{' '}
            <code className="text-[11px] bg-white/80 px-1 rounded">failed</code>{' '}
            on a lot, then try Inventory → Transfers → Ship with that lot. Expect{' '}
            <code className="text-[11px] bg-white/80 px-1 rounded">QA_HOLD</code>{' '}
            (HTTP 409) until you pass/release.
          </p>
        </div>
        <Link
          href="/dashboard/inventory/stock-transfers"
          className="shrink-0 text-xs font-bold text-amber-900 underline underline-offset-2"
        >
          Open transfers →
        </Link>
      </div>

      {/* Guided food-safety path */}
      <div className="mb-6 rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-sky-50/80 to-cyan-50 p-4 sm:p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400 mb-2">
          Release path
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {[
            { n: 1, label: 'Receive', href: '/dashboard/inventory/scan' },
            { n: 2, label: 'Inspect', href: '/dashboard/quality/inspections' },
            { n: 3, label: 'Hold / clear', href: '/dashboard/quality/inspections' },
            { n: 4, label: 'Ship', href: '/dashboard/inventory/stock-transfers' },
            { n: 5, label: 'Recall pack', href: '/dashboard/quality/regulatory-reports' },
          ].map((s, i, arr) => (
            <span key={s.n} className="inline-flex items-center gap-2">
              <Link
                href={s.href}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#00b4d8]/30 bg-white px-3 py-1.5 text-[#0077b6] hover:border-[#00b4d8] hover:shadow-sm"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#00b4d8]/10 text-[10px] font-black text-[#00b4d8]">
                  {s.n}
                </span>
                {s.label}
              </Link>
              {i < arr.length - 1 && <span className="text-neutral-300">→</span>}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-neutral-500 leading-relaxed max-w-2xl">
          Open or failed inspections put the lot on hold. Ship is blocked until you pass &amp;
          release — or an owner/admin overrides (audited).
        </p>
      </div>

      {warning && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {warning}
        </div>
      )}

      {!canOpsWrite && (
        <RoleDeniedBanner
          className="mb-4"
          message={`Your role (${roleLabel || 'viewer'}) cannot create or update inspections. Ask operations or an admin.`}
        />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Open holds', n: open, icon: AlertTriangle, c: 'text-amber-600' },
          { label: 'Passed', n: passed, icon: CheckCircle2, c: 'text-emerald-600' },
          { label: 'Failed', n: failed, icon: XCircle, c: 'text-red-600' },
          { label: 'Total', n: items.length, icon: ShieldCheck, c: 'text-[#00b4d8]' },
        ].map((k) => (
          <div key={k.label} className="bg-white border rounded-2xl p-4">
            <k.icon className={`w-4 h-4 ${k.c} mb-2`} />
            <div className="text-2xl font-black tracking-tight">{k.n}</div>
            <div className="text-[11px] text-neutral-500">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {['all', ...INSPECTION_STATUSES].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
              filter === s
                ? 'bg-[#00b4d8] text-white border-[#00b4d8]'
                : 'bg-white border-neutral-200 text-neutral-600'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center text-sm text-neutral-500">
            No inspections yet. Create one when goods arrive or before ship.
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((row) => (
              <li key={row.id} className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-bold">#{row.id}</span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${inspectionStatusClass(row.status)}`}
                    >
                      {row.status}
                    </span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                      {row.inspection_type}
                    </span>
                  </div>
                  <div className="text-sm text-neutral-600">
                    {row.lot_number ? (
                      <span className="font-mono text-xs bg-sky-50 text-sky-800 px-1.5 py-0.5 rounded">
                        Lot {row.lot_number}
                      </span>
                    ) : (
                      'No lot'
                    )}
                    {row.product_name ? ` · ${row.product_name}` : ''}
                    {row.inspector_name ? ` · ${row.inspector_name}` : ''}
                    {row.defects_found ? ` · defects ${row.defects_found}` : ''}
                  </div>
                  {row.notes && (
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{row.notes}</p>
                  )}
                </div>
                {row.status === 'open' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!canOpsWrite}
                      onClick={() => void setStatus(row.id, 'passed')}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-600 text-white disabled:opacity-50"
                    >
                      Pass & release
                    </button>
                    <button
                      type="button"
                      disabled={!canOpsWrite}
                      onClick={() => void setStatus(row.id, 'failed')}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-red-100 text-red-800 disabled:opacity-50"
                    >
                      Fail / hold
                    </button>
                    <button
                      type="button"
                      disabled={!canOpsWrite}
                      onClick={() => void setStatus(row.id, 'conditional')}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 disabled:opacity-50"
                    >
                      Conditional
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">New inspection</h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-neutral-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Type</label>
                <select
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={form.inspection_type}
                  onChange={(e) => setForm({ ...form, inspection_type: e.target.value })}
                >
                  {INSPECTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Lot number</label>
                <input
                  className="input mt-1 w-full !p-3 !text-sm font-mono"
                  placeholder="LOT-2026-…"
                  value={form.lot_number}
                  onChange={(e) => setForm({ ...form, lot_number: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Inspector</label>
                <input
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={form.inspector_name}
                  onChange={(e) => setForm({ ...form, inspector_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Defects found</label>
                <input
                  type="number"
                  min={0}
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={form.defects_found}
                  onChange={(e) => setForm({ ...form, defects_found: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Initial status</label>
                <select
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {INSPECTION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Notes</label>
                <textarea
                  className="input mt-1 w-full !p-3 !text-sm min-h-[80px]"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void create()}
                className="btn-primary w-full !py-3"
              >
                {saving ? 'Saving…' : 'Create inspection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </RelationshipPage>
  );
}
