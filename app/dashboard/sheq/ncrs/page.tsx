'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
  NCR_DOMAINS,
  NCR_STATUSES,
  SEVERITIES,
  type SheqNcr,
} from '@/lib/sheq/types';

export default function SheqNcrsPage() {
  const companyId = getSelectedCompanyId();
  const { canOpsWrite, canWriteModule } = useCompanyRole();
  const canWrite = canWriteModule('sheq') || canOpsWrite;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<SheqNcr[]>([]);
  const [form, setForm] = useState({
    title: '',
    domain: 'quality',
    severity: 'medium',
    lot_number: '',
    description: '',
    containment: '',
  });

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sheq/ncrs?companyId=${companyId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setItems(data.ncrs || []);
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
      const res = await fetch('/api/sheq/ncrs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, source: 'manual', ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      toast.success(`NCR ${data.ncr?.public_ref || ''} raised`);
      setForm({
        title: '',
        domain: 'quality',
        severity: 'medium',
        lot_number: '',
        description: '',
        containment: '',
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
      const res = await fetch('/api/sheq/ncrs', {
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
        eyebrow="ISO 9001-style"
        title="Nonconformances"
        titleAccent="NCR"
        description="Register product, process, or safety nonconformances. Failed QA inspections auto-create NCR records."
      />

      {canWrite && (
        <Panel className="p-5 mb-6">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#00b4d8]" />
            Raise NCR
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form.domain}
              onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
            >
              {NCR_DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d.replace(/_/g, ' ')}
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
              placeholder="Lot number (optional)"
              value={form.lot_number}
              onChange={(e) => setForm((f) => ({ ...f, lot_number: e.target.value }))}
            />
            <textarea
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2 min-h-[64px]"
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
            <textarea
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2 min-h-[48px]"
              placeholder="Immediate containment"
              value={form.containment}
              onChange={(e) =>
                setForm((f) => ({ ...f, containment: e.target.value }))
              }
            />
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void create()}
            className="mt-3 btn-primary !py-2.5 !px-4 text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Raise NCR
          </button>
        </Panel>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : items.length === 0 ? (
        <Panel className="p-8 text-center text-slate-500 text-sm">
          No NCRs yet. Fail a QA inspection to auto-raise one, or create manually.
        </Panel>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <Panel key={n.id} className="p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {n.public_ref || `NCR-${n.id}`} · {n.source}
                  </div>
                  <h3 className="font-bold text-slate-900">{n.title}</h3>
                  <p className="text-xs text-slate-500 capitalize mt-0.5">
                    {n.domain.replace(/_/g, ' ')} · {n.severity}
                    {n.lot_number ? ` · Lot ${n.lot_number}` : ''}
                    {n.inspection_id ? ` · Insp #${n.inspection_id}` : ''}
                  </p>
                  {n.description && (
                    <p className="text-sm text-slate-600 mt-2">{n.description}</p>
                  )}
                  {n.capa_id && (
                    <Link
                      href="/dashboard/sheq/capas"
                      className="text-xs font-semibold text-[#00b4d8] mt-2 inline-block"
                    >
                      Linked CAPA #{n.capa_id} →
                    </Link>
                  )}
                </div>
                {canWrite && (
                  <select
                    className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs h-fit"
                    value={n.status}
                    onChange={(e) => void setStatus(n.id, e.target.value)}
                  >
                    {NCR_STATUSES.map((s) => (
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
