'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Plus,
  Target,
  Briefcase,
  LayoutGrid,
  Users,
  Mail,
  Copy,
  Check,
  Link2,
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
type FormMode = 'opportunity' | 'lead' | 'customer';

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
  const [formMode, setFormMode] = useState<FormMode>('opportunity');
  const [saving, setSaving] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [form, setForm] = useState({
    name: '',
    company_name: '',
    trading_name: '',
    legal_name: '',
    contact_name: '',
    email: '',
    phone: '',
    city: '',
    country: 'South Africa',
    status: 'new',
    stage: 'prospecting',
    amount: '',
    notes: '',
    invite_message: '',
    send_invite: true,
    also_create_opportunity: false,
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
    const stageMeta = OPPORTUNITY_STAGES.find((s) => s.value === stage);
    const prob = stageMeta?.probability ?? 10;
    setOpps((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              stage,
              probability: prob,
              weighted_amount: Math.round((Number(o.amount || 0) * prob) / 100),
            }
          : o
      )
    );
    const res = await fetch('/api/customers/opportunities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        id,
        stage,
        probability: prob,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Could not move deal');
      void load();
      return;
    }
    toast.success(`Moved to ${stageMeta?.label || stage.replace(/_/g, ' ')}`);
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
      // Optionally create CRM customer + invite from opportunity details
      let customerId: number | null = null;
      if (form.send_invite && form.email.trim() && form.email.includes('@')) {
        const trading =
          form.company_name.trim() || form.name.trim() || form.email.trim();
        const cRes = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            trading_name: trading,
            contact_name: form.name.trim() || null,
            email: form.email.trim().toLowerCase(),
            phone: form.phone || null,
            city: form.city || null,
            country: form.country || 'South Africa',
            notes: form.notes || null,
            source: 'sales_pipeline',
            sales_rep_user_id: privyUserId || null,
          }),
        });
        const cData = await cRes.json();
        if (cRes.ok && cData.customer?.id) {
          customerId = Number(cData.customer.id);
          await sendInvite(customerId, form.email, form.name);
        } else if (!cRes.ok) {
          toast.message('Opportunity will save without invite', {
            description: cData.error || 'Could not create customer record',
          });
        }
      }

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
          customer_id: customerId,
          stage: form.stage,
          amount: Number(form.amount) || 0,
          notes: form.notes || null,
          sales_rep_user_id: privyUserId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        customerId
          ? 'Opportunity added · customer created & invite sent'
          : 'Opportunity added to the map'
      );
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

  const sendInvite = async (
    customerId: number,
    email: string,
    contactName?: string
  ) => {
    if (!companyId || !privyUserId) return null;
    const res = await fetch('/api/customers/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        customerId,
        privyUserId,
        email: email.trim().toLowerCase(),
        contactName: contactName?.trim() || undefined,
        message: form.invite_message.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.message('Customer saved — invite not sent', {
        description: data.error || data.hint || 'Invite failed',
      });
      return null;
    }
    if (data.inviteLink) {
      setLastInviteLink(String(data.inviteLink));
    }
    if (data.warning) {
      toast.message('Invitation created', { description: data.warning });
    } else {
      toast.success(data.message || 'Invitation sent');
    }
    return data.inviteLink as string | undefined;
  };

  const saveCustomer = async () => {
    if (!companyId) return;
    const trading =
      form.trading_name.trim() ||
      form.company_name.trim() ||
      form.contact_name.trim();
    if (!trading) {
      toast.error('Customer / trading name is required');
      return;
    }
    if (form.send_invite) {
      if (!form.email.trim() || !form.email.includes('@')) {
        toast.error('A valid email is required to send an invitation');
        return;
      }
    }
    setSaving(true);
    setLastInviteLink(null);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          trading_name: trading,
          legal_name: form.legal_name.trim() || null,
          contact_name:
            form.contact_name.trim() || form.name.trim() || null,
          email: form.email.trim().toLowerCase() || null,
          phone: form.phone.trim() || null,
          city: form.city.trim() || null,
          country: form.country.trim() || 'South Africa',
          notes: form.notes.trim() || null,
          source: 'sales_pipeline',
          status: 'active',
          sales_rep_user_id: privyUserId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create customer');
      const customerId = Number(data.customer?.id);
      let inviteLink: string | undefined;

      if (form.send_invite && customerId && form.email.trim()) {
        inviteLink =
          (await sendInvite(
            customerId,
            form.email,
            form.contact_name || form.name
          )) || undefined;
      } else {
        toast.success('Customer added to your book');
      }

      if (form.also_create_opportunity && customerId) {
        await fetch('/api/customers/opportunities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            name:
              form.name.trim() ||
              `Deal · ${trading}`,
            contact_name:
              form.contact_name.trim() || form.name.trim() || null,
            company_name: trading,
            contact_email: form.email || null,
            contact_phone: form.phone || null,
            customer_id: customerId,
            stage: form.stage || 'prospecting',
            amount: Number(form.amount) || 0,
            notes: form.notes || null,
            sales_rep_user_id: privyUserId || null,
          }),
        });
      }

      if (!form.send_invite || !inviteLink) {
        setShowForm(false);
        resetForm();
      }
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setLastInviteLink(null);
    setLinkCopied(false);
    setForm({
      name: '',
      company_name: '',
      trading_name: '',
      legal_name: '',
      contact_name: '',
      email: '',
      phone: '',
      city: '',
      country: 'South Africa',
      status: 'new',
      stage: 'prospecting',
      amount: '',
      notes: '',
      invite_message: '',
      send_invite: true,
      also_create_opportunity: false,
    });
  };

  const openForm = (mode: FormMode) => {
    resetForm();
    setFormMode(mode);
    setShowForm(true);
    if (mode === 'lead') setTab('leads');
    if (mode === 'opportunity') setTab('map');
  };

  const copyLink = async () => {
    if (!lastInviteLink) return;
    await navigator.clipboard.writeText(lastInviteLink);
    setLinkCopied(true);
    toast.success('Invite link copied');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (!companyId) {
    return (
      <p className="text-center text-neutral-500 py-16">
        Select a company to open your pipeline.
      </p>
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
          <p className="text-sm text-neutral-600 mt-1 max-w-xl">
            Opportunity map (same stages as Customers → Leads) with{' '}
            <strong className="text-amber-900">commission you can earn</strong> on every deal —
            progressive 3.5%–5.5% scale.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openForm('customer')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#00b4d8] to-[#0077b6] text-white text-sm font-bold shadow-sm"
          >
            <Users className="w-4 h-4" />
            Add customer
          </button>
          <button
            type="button"
            onClick={() => openForm('opportunity')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-neutral-200 bg-white text-slate-700 text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            New opportunity
          </button>
          <button
            type="button"
            onClick={() => openForm('lead')}
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
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-slate-900">
              {formMode === 'customer'
                ? 'Add customer & invite to SupplierAdvisor'
                : formMode === 'opportunity'
                  ? 'Add opportunity'
                  : 'Capture lead'}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'customer' as const, label: 'Customer' },
                  { id: 'opportunity' as const, label: 'Opportunity' },
                  { id: 'lead' as const, label: 'Lead' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setFormMode(m.id);
                    setLastInviteLink(null);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                    formMode === m.id
                      ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {formMode === 'customer' ? (
            <>
              <p className="text-xs text-slate-500 leading-relaxed">
                Create a CRM customer on your book, then optionally email them an
                invitation link to join SupplierAdvisor as a buyer.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block text-xs font-bold text-slate-600 sm:col-span-2">
                  Trading / business name *
                  <input
                    className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                    placeholder="e.g. Soweto Business Access"
                    value={form.trading_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, trading_name: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  Legal name
                  <input
                    className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                    value={form.legal_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, legal_name: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  Contact person
                  <input
                    className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                    placeholder="Primary contact name"
                    value={form.contact_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, contact_name: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  Email {form.send_invite ? '*' : ''}
                  <input
                    type="email"
                    className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                    placeholder="buyer@company.co.za"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  Phone
                  <input
                    className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  City
                  <input
                    className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                    value={form.city}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, city: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  Country
                  <input
                    className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                    value={form.country}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, country: e.target.value }))
                    }
                  />
                </label>
              </div>
              <textarea
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm min-h-[64px]"
                placeholder="Notes (internal)"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />

              <div className="rounded-2xl border border-[#00b4d8]/25 bg-sky-50/50 p-4 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-slate-300 text-[#00b4d8]"
                    checked={form.send_invite}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        send_invite: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-[#00b4d8]" />
                      Send SupplierAdvisor invitation
                    </span>
                    <span className="block text-xs text-slate-600 mt-0.5">
                      Emails them a link to join the platform and connect as your
                      buyer. You can also copy the link after send.
                    </span>
                  </span>
                </label>
                {form.send_invite && (
                  <textarea
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[56px] bg-white"
                    placeholder="Optional personal message on the invite email"
                    value={form.invite_message}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        invite_message: e.target.value,
                      }))
                    }
                  />
                )}
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-slate-300 text-[#00b4d8]"
                    checked={form.also_create_opportunity}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        also_create_opportunity: e.target.checked,
                      }))
                    }
                  />
                  <span className="text-sm text-slate-800">
                    Also create a pipeline opportunity for this customer
                  </span>
                </label>
                {form.also_create_opportunity && (
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                      placeholder="Opportunity name"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                    />
                    <input
                      type="number"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                      placeholder="Deal amount (ZAR)"
                      value={form.amount}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, amount: e.target.value }))
                      }
                    />
                  </div>
                )}
              </div>

              {lastInviteLink && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" /> Invitation link ready
                  </div>
                  <input
                    readOnly
                    className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-mono"
                    value={lastInviteLink}
                  />
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-800"
                  >
                    {linkCopied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    Copy invite link
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  className="rounded-2xl bg-white border border-neutral-200 px-4 py-3 text-slate-800 text-sm"
                  placeholder={
                    formMode === 'opportunity'
                      ? 'Opportunity name *'
                      : 'Contact name *'
                  }
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
                <input
                  className="rounded-2xl bg-white border border-neutral-200 px-4 py-3 text-slate-800 text-sm"
                  placeholder="Company"
                  value={form.company_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, company_name: e.target.value }))
                  }
                />
                <input
                  className="rounded-2xl bg-white border border-neutral-200 px-4 py-3 text-slate-800 text-sm"
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
                <input
                  className="rounded-2xl bg-white border border-neutral-200 px-4 py-3 text-slate-800 text-sm"
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
                {formMode === 'opportunity' ? (
                  <>
                    <select
                      className="rounded-2xl bg-white border border-neutral-200 px-4 py-3 text-slate-800 text-sm"
                      value={form.stage}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, stage: e.target.value }))
                      }
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
                      onChange={(e) =>
                        setForm((f) => ({ ...f, amount: e.target.value }))
                      }
                    />
                    {Number(form.amount) > 0 && (
                      <div className="sm:col-span-2">
                        <CommissionBadge amount={Number(form.amount)} />
                      </div>
                    )}
                    <label className="sm:col-span-2 flex items-start gap-2.5 cursor-pointer rounded-2xl border border-sky-100 bg-sky-50/40 px-3 py-2.5">
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-slate-300 text-[#00b4d8]"
                        checked={form.send_invite}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            send_invite: e.target.checked,
                          }))
                        }
                      />
                      <span className="text-xs text-slate-700">
                        <strong className="text-slate-900">
                          Also add as CRM customer &amp; send invite
                        </strong>{' '}
                        when email is filled — creates the customer and emails a
                        join link to SupplierAdvisor.
                      </span>
                    </label>
                  </>
                ) : (
                  <select
                    className="rounded-2xl bg-white border border-neutral-200 px-4 py-3 text-slate-800 text-sm"
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value }))
                    }
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
              {lastInviteLink && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-bold text-emerald-800">
                    Invite link:
                  </span>
                  <code className="text-[11px] flex-1 min-w-0 truncate">
                    {lastInviteLink}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="text-xs font-bold text-emerald-800 inline-flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>
              )}
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="px-4 py-2.5 rounded-2xl border border-neutral-200 text-slate-700 text-sm font-semibold"
            >
              {lastInviteLink ? 'Done' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void (formMode === 'customer'
                  ? saveCustomer()
                  : formMode === 'opportunity'
                    ? saveOpp()
                    : saveLead())
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#00b4d8] to-[#0077b6] text-white text-sm font-bold disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : formMode === 'customer' ? (
                <>
                  <Users className="w-4 h-4" />
                  {form.send_invite
                    ? 'Save customer & send invite'
                    : 'Save customer'}
                </>
              ) : (
                'Save'
              )}
            </button>
            {formMode === 'customer' && (
              <Link
                href="/sales/customers"
                className="px-4 py-2.5 rounded-2xl border border-neutral-200 text-slate-600 text-sm font-semibold inline-flex items-center"
              >
                View all customers
              </Link>
            )}
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
