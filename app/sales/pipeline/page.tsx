'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Target, Briefcase } from 'lucide-react';
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

type Tab = 'leads' | 'opportunities';

export default function SalesPipelinePage() {
  const companyId = getSelectedCompanyId();
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [tab, setTab] = useState<Tab>('leads');
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [opps, setOpps] = useState<OpportunityRecord[]>([]);
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
      const [lRes, oRes] = await Promise.all([
        fetch(`/api/customers/leads?companyId=${companyId}`),
        fetch(`/api/customers/opportunities?companyId=${companyId}`),
      ]);
      const lData = await lRes.json();
      const oData = await oRes.json();
      setLeads(lData.leads || []);
      setOpps(oData.opportunities || []);
    } catch {
      toast.error('Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

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
      toast.success('Opportunity added');
      setShowForm(false);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (!companyId) {
    return (
      <p className="text-center text-neutral-500 py-16">Select a company to open your pipeline.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Target className="w-7 h-7 text-amber-600" />
            Pipeline
          </h1>
          <p className="text-sm text-neutral-600 mt-1">
            Leads &amp; opportunities · saved under your company · sales portal only
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#00b4d8] to-[#0077b6] text-white text-sm font-bold shadow-sm"
        >
          <Plus className="w-4 h-4" />
          {tab === 'leads' ? 'New lead' : 'New opportunity'}
        </button>
      </div>

      <div className="flex gap-2">
        {(
          [
            { id: 'leads' as const, label: 'Leads', icon: Target },
            { id: 'opportunities' as const, label: 'Opportunities', icon: Briefcase },
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
            {tab === 'leads' ? 'Capture lead' : 'Add opportunity'}
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              className="rounded-2xl bg-white border border-neutral-200 px-4 py-3 text-slate-800 text-sm"
              placeholder={tab === 'leads' ? 'Contact name *' : 'Opportunity name *'}
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
            {tab === 'opportunities' && (
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
                  </div>
                )}
              </>
            )}
            {tab === 'leads' && (
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
              onClick={() => void (tab === 'leads' ? saveLead() : saveOpp())}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#00b4d8] to-[#0077b6] text-white text-sm font-bold disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : tab === 'leads' ? (
          leads.length === 0 ? (
            <p className="p-12 text-center text-neutral-500 text-sm">No leads yet — capture your first.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {leads.map((l) => (
                <li key={l.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
          )
        ) : opps.length === 0 ? (
          <p className="p-12 text-center text-neutral-500 text-sm">No opportunities yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {opps.map((o) => {
              const amount = Number(
                (o as { amount?: number; opportunity_size?: number }).amount ||
                  (o as { opportunity_size?: number }).opportunity_size ||
                  0
              );
              return (
                <li
                  key={o.id}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{o.name}</div>
                    <div className="text-xs text-neutral-500">
                      {o.company_name || '—'} · {o.stage || 'prospecting'}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="font-bold text-slate-900">{formatMoney(amount)}</div>
                    {amount > 0 && <CommissionBadge amount={amount} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
