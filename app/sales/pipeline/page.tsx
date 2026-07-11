'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Plus,
  Target,
  Briefcase,
  LayoutGrid,
  List,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  formatMoney,
  LEAD_STATUSES,
  OPPORTUNITY_STAGES,
  type LeadRecord,
  type OpportunityRecord,
} from '@/lib/customers/types';
import CommissionBadge from '@/components/sales/CommissionBadge';
import OpportunityPipelineBoard from '@/components/sales/OpportunityPipelineBoard';
import {
  calculateCommission,
  DEFAULT_COMMISSION_TIERS,
  formatZarPrecise,
  type CommissionTier,
} from '@/lib/sales-contractor/commission';

type Tab = 'map' | 'leads' | 'list';

/**
 * Sales portal pipeline — same opportunity map as Customers → Leads pipeline,
 * with commission-to-earn on every opportunity card.
 */
export default function SalesPipelinePage() {
  const companyId = getSelectedCompanyId();
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [tab, setTab] = useState<Tab>('map');
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [opps, setOpps] = useState<OpportunityRecord[]>([]);
  const [tiers, setTiers] = useState<CommissionTier[]>(DEFAULT_COMMISSION_TIERS);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    status: 'new',
    stage: 'prospecting',
    amount: '',
    notes: '',
  });

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [lRes, oRes, cRes] = await Promise.all([
        fetch(`/api/customers/leads?companyId=${companyId}`),
        fetch(`/api/customers/opportunities?companyId=${companyId}`),
        privyUserId
          ? fetch(
              `/api/sales/commission/preview?companyId=${companyId}&privyUserId=${encodeURIComponent(
                privyUserId
              )}&amount=100000`
            )
          : Promise.resolve(null),
      ]);
      const lData = await lRes.json();
      const oData = await oRes.json();
      setLeads(lData.leads || []);
      setOpps(oData.opportunities || []);
      if (cRes) {
        const cData = await cRes.json();
        if (cRes.ok && Array.isArray(cData.tiers) && cData.tiers.length) {
          setTiers(cData.tiers);
        }
      }
    } catch {
      toast.error('Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const moveOpp = async (id: number, stage: string) => {
    if (!companyId) return;
    const res = await fetch('/api/customers/opportunities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, privyUserId, id, stage }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Could not move deal');
      return;
    }
    toast.success(`Moved to ${stage.replace(/_/g, ' ')}`);
    void load();
  };

  const deleteOpp = async (id: number) => {
    if (!confirm('Delete this opportunity?')) return;
    const res = await fetch(`/api/customers/opportunities?id=${id}&companyId=${companyId}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error((data as { error?: string }).error || 'Delete failed');
      return;
    }
    toast.success('Opportunity removed');
    void load();
  };

  const saveLead = async () => {
    if (!form.name.trim() || !companyId) {
      toast.error('Name required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/customers/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          name: form.name,
          company_name: form.company_name || null,
          email: form.email || null,
          phone: form.phone || null,
          status: form.status,
          notes: form.notes || null,
          sales_rep_user_id: privyUserId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Lead captured');
      setShowForm(false);
      resetForm();
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const saveOpp = async () => {
    if (!form.name.trim() || !companyId) {
      toast.error('Opportunity name required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/customers/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          name: form.name,
          contact_name: form.name.trim(),
          company_name: form.company_name || null,
          contact_email: form.email || null,
          contact_phone: form.phone || null,
          stage: form.stage,
          amount: Number(form.amount) || 0,
          notes: form.notes || null,
          sales_rep_user_id: privyUserId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Opportunity added to the map');
      setShowForm(false);
      resetForm();
      setTab('map');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () =>
    setForm({
      name: '',
      company_name: '',
      email: '',
      phone: '',
      status: 'new',
      stage: 'prospecting',
      amount: '',
      notes: '',
    });

  if (!companyId) {
    return (
      <p className="text-center text-neutral-500 py-16">
        Select a company to open your pipeline.
      </p>
    );
  }

  const formIsOpp = tab === 'map' || tab === 'list';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Target className="w-7 h-7 text-amber-600" />
            Pipeline
          </h1>
          <p className="text-sm text-neutral-600 mt-1 max-w-xl">
            Opportunity map (same stages as Customers → Leads) with{' '}
            <strong className="text-amber-900">commission you can earn</strong> on every deal —
            progressive 3.5%–5.5% scale.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setTab('map');
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#00b4d8] to-[#0077b6] text-white text-sm font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New opportunity
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('leads');
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-neutral-200 bg-white text-slate-700 text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            New lead
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'map' as const, label: 'Opportunity map', icon: LayoutGrid },
            { id: 'list' as const, label: 'Deal list', icon: Briefcase },
            { id: 'leads' as const, label: 'Leads', icon: Target },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setShowForm(false);
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-semibold transition-colors ${
              tab === t.id
                ? 'bg-[#00b4d8] text-white'
                : 'bg-slate-50 text-neutral-600 border border-neutral-200 hover:bg-slate-100'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 space-y-3">
          <h2 className="font-bold text-slate-900">
            {formIsOpp ? 'Add opportunity' : 'Capture lead'}
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              className="rounded-2xl bg-white border border-neutral-200 px-4 py-3 text-slate-800 text-sm"
              placeholder={formIsOpp ? 'Opportunity name *' : 'Contact name *'}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className="rounded-2xl bg-white border border-neutral-200 px-4 py-3 text-slate-800 text-sm"
              placeholder="Company"
              value={form.company_name}
              onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
            />
            <input
              className="rounded-2xl bg-white border border-neutral-200 px-4 py-3 text-slate-800 text-sm"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <input
              className="rounded-2xl bg-white border border-neutral-200 px-4 py-3 text-slate-800 text-sm"
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            {formIsOpp ? (
              <>
                <select
                  className="rounded-2xl bg-white border border-neutral-200 px-4 py-3 text-slate-800 text-sm"
                  value={form.stage}
                  onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
                >
                  {OPPORTUNITY_STAGES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="rounded-2xl bg-white border border-neutral-200 px-4 py-3 text-slate-800 text-sm"
                  placeholder="Deal amount (ZAR)"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
                {Number(form.amount) > 0 && (
                  <div className="sm:col-span-2">
                    <CommissionBadge amount={Number(form.amount)} />
                    <p className="text-[11px] text-neutral-500 mt-1.5">
                      Preview uses your agreement tiers when available; otherwise the default
                      progressive scale.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <select
                className="rounded-2xl bg-white border border-neutral-200 px-4 py-3 text-slate-800 text-sm"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <textarea
            className="w-full rounded-2xl bg-white border border-neutral-200 px-4 py-3 text-slate-800 text-sm min-h-[72px]"
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 rounded-2xl border border-neutral-200 text-slate-700 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void (formIsOpp ? saveOpp() : saveLead())}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#00b4d8] to-[#0077b6] text-white text-sm font-bold disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : tab === 'map' ? (
        <OpportunityPipelineBoard
          opportunities={opps}
          showCommission
          commissionTiers={tiers}
          onMove={moveOpp}
          onDelete={deleteOpp}
          onCreate={() => {
            setShowForm(true);
          }}
        />
      ) : tab === 'leads' ? (
        <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden">
          {leads.length === 0 ? (
            <p className="p-12 text-center text-neutral-500 text-sm">
              No leads yet — capture your first.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {leads.map((l) => (
                <li
                  key={l.id}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{l.name}</div>
                    <div className="text-xs text-neutral-500">
                      {l.company_name || '—'} · {l.email || l.phone || 'No contact'}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 w-fit">
                    {l.status || 'new'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden">
          {opps.length === 0 ? (
            <p className="p-12 text-center text-neutral-500 text-sm">No opportunities yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {opps.map((o) => {
                const amount = Number(
                  (o as { amount?: number }).amount ||
                    (o as { opportunity_size?: number }).opportunity_size ||
                    0
                );
                const comm =
                  amount > 0 ? calculateCommission(amount, { tiers }) : null;
                return (
                  <li
                    key={o.id}
                    className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{o.name}</div>
                      <div className="text-xs text-neutral-500">
                        {o.company_name || '—'} · {o.stage || 'prospecting'}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="font-bold text-slate-900">{formatMoney(amount)}</div>
                      {comm && (
                        <div className="text-xs font-bold text-amber-900">
                          Earn {formatZarPrecise(comm.commissionAmount)}
                          <span className="font-semibold text-amber-800/80">
                            {' '}
                            · ~{comm.effectiveRatePct.toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="px-5 py-3 border-t bg-slate-50 text-[11px] text-neutral-500">
            Prefer the visual board?{' '}
            <button
              type="button"
              className="text-[#0077b6] font-semibold underline"
              onClick={() => setTab('map')}
            >
              Open opportunity map
            </button>
            {' · '}
            <Link href="/sales/earnings" className="text-[#0077b6] font-semibold underline">
              Full earnings
            </Link>
          </div>
        </div>
      )}

      <p className="text-[11px] text-neutral-400 text-center">
        Map stages match{' '}
        <Link href="/dashboard/customers/leads?tab=pipeline" className="text-[#0077b6] underline">
          Customers → Leads → Opportunity pipeline
        </Link>
        . Company owns all CRM data; commission is calculated for your contractor agreement.
      </p>
    </div>
  );
}
