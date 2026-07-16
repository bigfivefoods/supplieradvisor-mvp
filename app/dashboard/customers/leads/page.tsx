'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Loader2,
  Plus,
  Target,
  Download,
  Search,
  X,
  Pencil,
  Trash2,
  UserPlus,
  Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  OPPORTUNITY_STAGES,
  OPPORTUNITY_TYPES,
  PRIORITIES,
  formatMoney,
  leadStatusClass,
  opportunityStageClass,
  priorityClass,
  stageProbability,
  type LeadRecord,
  type OpportunityRecord,
  type CustomerRecord,
} from '@/lib/customers/types';
import { CompanyRequired, CustomersHeader } from '@/components/customers/CustomersShell';
import OpportunityPipelineBoard from '@/components/sales/OpportunityPipelineBoard';
import TeamDealsReport from '@/components/sales/TeamDealsReport';
import GeoSelectFields, { type GeoValue } from '@/components/geo/GeoSelectFields';

type Tab = 'leads' | 'pipeline' | 'team';

const emptyLead = () => ({
  name: '',
  company_name: '',
  email: '',
  phone: '',
  job_title: '',
  website: '',
  status: 'new',
  source: '',
  source_detail: '',
  industry: '',
  city: '',
  region: '',
  country: '',
  address: '',
  value_estimate: '',
  currency: 'ZAR',
  score: '50',
  priority: 'medium',
  owner_name: '',
  next_action: '',
  next_action_date: '',
  product_interest: '',
  notes: '',
});

const emptyOpp = () => ({
  name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  company_name: '',
  stage: 'prospecting',
  amount: '',
  currency: 'ZAR',
  probability: '10',
  expected_close_date: '',
  opportunity_type: 'new_business',
  product_interest: '',
  location: '',
  description: '',
  next_step: '',
  next_step_date: '',
  owner_name: '',
  competitor: '',
  lost_reason: '',
  source: '',
  priority: 'medium',
  lead_id: '',
  customer_id: '',
});

export default function LeadsOpportunitiesPage() {
  return (
    <CompanyRequired>
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        }
      >
        <LeadsInner />
      </Suspense>
    </CompanyRequired>
  );
}

function LeadsInner() {
  const companyId = getSelectedCompanyId()!;
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(
    searchParams.get('tab') === 'pipeline' ? 'pipeline' : 'leads'
  );
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [opps, setOpps] = useState<OpportunityRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [leadModal, setLeadModal] = useState(false);
  const [oppModal, setOppModal] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadRecord | null>(null);
  const [editingOpp, setEditingOpp] = useState<OpportunityRecord | null>(null);
  const [leadForm, setLeadForm] = useState(emptyLead());
  const [oppForm, setOppForm] = useState(emptyOpp());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (q) params.set('q', q);
      const [l, o, c] = await Promise.all([
        fetch(`/api/customers/leads?${params}`).then((r) => r.json()),
        fetch(`/api/customers/opportunities?${params}`).then((r) => r.json()),
        fetch(`/api/customers?companyId=${companyId}`).then((r) => r.json()),
      ]);
      setLeads(l.leads || []);
      setOpps(o.opportunities || []);
      setCustomers(c.customers || []);
      if (l.warning || o.warning) {
        toast.message(l.warning || o.warning, {
          description: l.hint || o.hint || 'Run 20260709_crm_leads_opportunities.sql',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (searchParams.get('tab') === 'pipeline') setTab('pipeline');
    else if (searchParams.get('tab') === 'leads') setTab('leads');
  }, [searchParams]);

  const filteredLeads = useMemo(() => {
    let rows = leads;
    if (statusFilter !== 'all') rows = rows.filter((l) => l.status === statusFilter);
    return rows;
  }, [leads, statusFilter]);

  const pipelineStats = useMemo(() => {
    const open = opps.filter((o) => !['closed_won', 'closed_lost'].includes(String(o.stage)));
    const value = open.reduce((s, o) => s + Number(o.amount || 0), 0);
    const weighted = open.reduce((s, o) => s + Number(o.weighted_amount || 0), 0);
    const won = opps
      .filter((o) => o.stage === 'closed_won')
      .reduce((s, o) => s + Number(o.amount || 0), 0);
    return { open: open.length, value, weighted, won };
  }, [opps]);

  const openLeadCreate = () => {
    setEditingLead(null);
    setLeadForm(emptyLead());
    setLeadModal(true);
  };

  const openLeadEdit = (l: LeadRecord) => {
    setEditingLead(l);
    setLeadForm({
      name: l.name || '',
      company_name: l.company_name || '',
      email: l.email || '',
      phone: l.phone || '',
      job_title: l.job_title || '',
      website: l.website || '',
      status: l.status || 'new',
      source: l.source || '',
      source_detail: l.source_detail || '',
      industry: l.industry || '',
      city: l.city || '',
      region: l.region || '',
      country: l.country || '',
      address: l.address || '',
      value_estimate: String(l.value_estimate ?? ''),
      currency: l.currency || 'ZAR',
      score: String(l.score ?? 50),
      priority: l.priority || 'medium',
      owner_name: l.owner_name || '',
      next_action: l.next_action || '',
      next_action_date: l.next_action_date || '',
      product_interest: l.product_interest || '',
      notes: l.notes || '',
    });
    setLeadModal(true);
  };

  const saveLead = async () => {
    if (!leadForm.name.trim()) {
      toast.error('Lead name required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        companyId,
        ...leadForm,
        value_estimate: Number(leadForm.value_estimate) || 0,
        score: Number(leadForm.score) || 0,
      };
      const res = await fetch('/api/customers/leads', {
        method: editingLead ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingLead ? { id: editingLead.id, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed');
      toast.success(editingLead ? 'Lead updated' : 'Lead captured');
      setLeadModal(false);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteLead = async (id: number) => {
    if (!confirm('Delete this lead?')) return;
    const res = await fetch(`/api/customers/leads?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Deleted');
      void load();
    }
  };

  const convertLeadToOpp = (l: LeadRecord) => {
    setEditingOpp(null);
    setOppForm({
      ...emptyOpp(),
      name: l.company_name ? `${l.company_name} — ${l.product_interest || 'Opportunity'}` : `${l.name} opportunity`,
      contact_name: l.name,
      contact_email: l.email || '',
      contact_phone: l.phone || '',
      company_name: l.company_name || '',
      amount: String(l.value_estimate ?? ''),
      currency: l.currency || 'ZAR',
      source: l.source || '',
      product_interest: l.product_interest || '',
      location: [l.city, l.region, l.country].filter(Boolean).join(', '),
      description: l.notes || '',
      owner_name: l.owner_name || '',
      priority: l.priority || 'medium',
      lead_id: String(l.id),
      stage: 'qualification',
      probability: '20',
    });
    setTab('pipeline');
    setOppModal(true);
  };

  const openOppCreate = () => {
    setEditingOpp(null);
    setOppForm(emptyOpp());
    setOppModal(true);
  };

  const openOppEdit = (o: OpportunityRecord) => {
    setEditingOpp(o);
    setOppForm({
      name: o.name || '',
      contact_name: o.contact_name || '',
      contact_email: o.contact_email || '',
      contact_phone: o.contact_phone || '',
      company_name: o.company_name || '',
      stage: o.stage || 'prospecting',
      amount: String(o.amount ?? ''),
      currency: o.currency || 'ZAR',
      probability: String(o.probability ?? stageProbability(o.stage)),
      expected_close_date: o.expected_close_date || '',
      opportunity_type: o.opportunity_type || 'new_business',
      product_interest: o.product_interest || '',
      location: o.location || '',
      description: o.description || o.notes || '',
      next_step: o.next_step || '',
      next_step_date: o.next_step_date || '',
      owner_name: o.owner_name || '',
      competitor: o.competitor || '',
      lost_reason: o.lost_reason || '',
      source: o.source || '',
      priority: o.priority || 'medium',
      lead_id: o.lead_id ? String(o.lead_id) : '',
      customer_id: o.customer_id ? String(o.customer_id) : '',
    });
    setOppModal(true);
  };

  const saveOpp = async () => {
    if (!oppForm.name.trim() && !oppForm.contact_name.trim()) {
      toast.error('Opportunity name or contact required');
      return;
    }
    setSaving(true);
    try {
      // Empty date strings break Postgres date columns — send null instead
      const emptyToNull = (v: string) => (v && String(v).trim() ? String(v).trim() : null);
      const payload = {
        companyId,
        ...oppForm,
        amount: Number(oppForm.amount) || 0,
        probability: Number(oppForm.probability) || stageProbability(oppForm.stage),
        lead_id: oppForm.lead_id ? Number(oppForm.lead_id) : null,
        customer_id: oppForm.customer_id ? Number(oppForm.customer_id) : null,
        expected_close_date: emptyToNull(oppForm.expected_close_date),
        next_step_date: emptyToNull(oppForm.next_step_date),
      };
      const res = await fetch('/api/customers/opportunities', {
        method: editingOpp ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingOpp ? { id: editingOpp.id, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed');

      // Mark lead converted if linked
      if (!editingOpp && oppForm.lead_id) {
        await fetch('/api/customers/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: Number(oppForm.lead_id),
            status: 'converted',
            converted_opportunity_id: data.opportunity?.id,
            converted_at: new Date().toISOString(),
          }),
        });
      }

      toast.success(editingOpp ? 'Opportunity updated' : 'Opportunity created');
      setOppModal(false);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const moveStage = async (id: number, stage: string) => {
    // Optimistic UI so drag feels instant
    setOpps((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              stage,
              probability: stageProbability(stage),
              weighted_amount: Math.round(
                (Number(o.amount || 0) * stageProbability(stage)) / 100
              ),
            }
          : o
      )
    );
    const res = await fetch('/api/customers/opportunities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        id,
        stage,
        probability: stageProbability(stage),
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error || 'Failed to move deal');
      void load();
      return;
    }
    const label =
      OPPORTUNITY_STAGES.find((s) => s.value === stage)?.label || stage.replace(/_/g, ' ');
    toast.success(`Moved to ${label}`);
    void load();
  };

  const deleteOpp = async (id: number) => {
    if (!confirm('Delete this opportunity?')) return;
    const res = await fetch(`/api/customers/opportunities?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Deleted');
      void load();
    }
  };

  const exportCSV = () => {
    if (tab === 'leads') {
      const header =
        'Name,Company,Email,Phone,Status,Source,Value,Priority,City,Industry,Next action,Next date\n';
      const rows = filteredLeads
        .map((l) =>
          [
            l.name,
            l.company_name,
            l.email,
            l.phone,
            l.status,
            l.source,
            l.value_estimate,
            l.priority,
            l.city,
            l.industry,
            l.next_action,
            l.next_action_date,
          ]
            .map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\n');
      downloadCsv('leads-export.csv', header + rows);
    } else {
      const header =
        'Name,Company,Contact,Phone,Stage,Amount,Probability,Weighted,Close date,Type,Owner\n';
      const rows = opps
        .map((o) =>
          [
            o.name,
            o.company_name,
            o.contact_name,
            o.contact_phone,
            o.stage,
            o.amount,
            o.probability,
            o.weighted_amount,
            o.expected_close_date,
            o.opportunity_type,
            o.owner_name,
          ]
            .map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\n');
      downloadCsv('opportunities-export.csv', header + rows);
    }
  };

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <CustomersHeader
        title="Leads & opportunities"
        description="Capture every prospect with full detail, qualify leads, and run a complete sales pipeline through to closed-won."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportCSV} className="btn-secondary !py-2.5 !px-4 text-sm">
              <Download className="w-4 h-4" /> Export
            </button>
            {tab === 'leads' ? (
              <button type="button" onClick={openLeadCreate} className="btn-primary !py-2.5 !px-4 text-sm">
                <Plus className="w-4 h-4" /> New lead
              </button>
            ) : (
              <button type="button" onClick={openOppCreate} className="btn-primary !py-2.5 !px-4 text-sm">
                <Plus className="w-4 h-4" /> New opportunity
              </button>
            )}
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MiniKpi label="Open leads" value={String(leads.filter((l) => !['converted', 'unqualified', 'recycled'].includes(String(l.status))).length)} />
        <MiniKpi label="Open deals" value={String(pipelineStats.open)} />
        <MiniKpi label="Pipeline" value={formatMoney(pipelineStats.value)} />
        <MiniKpi label="Weighted" value={formatMoney(pipelineStats.weighted)} />
      </div>

      {/* Tabs */}
      <div className="flex rounded-2xl border bg-white p-1 gap-1 mb-4 w-fit">
        <button
          type="button"
          onClick={() => setTab('leads')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${
            tab === 'leads' ? 'bg-[#00b4d8] text-white' : 'text-neutral-600'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" /> Leads
        </button>
        <button
          type="button"
          onClick={() => setTab('pipeline')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${
            tab === 'pipeline' ? 'bg-[#00b4d8] text-white' : 'text-neutral-600'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" /> Opportunity pipeline
        </button>
        <button
          type="button"
          onClick={() => setTab('team')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${
            tab === 'team' ? 'bg-[#00b4d8] text-white' : 'text-neutral-600'
          }`}
        >
          <Target className="w-3.5 h-3.5" /> Team forecast
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            className="input w-full !pl-9 !py-2.5 !text-sm"
            placeholder={tab === 'leads' ? 'Search leads…' : 'Search opportunities…'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {tab === 'leads' && (
          <select
            className="input !py-2.5 !px-3 !text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="p-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : tab === 'leads' ? (
        <LeadsTable
          leads={filteredLeads}
          onEdit={openLeadEdit}
          onDelete={deleteLead}
          onConvert={convertLeadToOpp}
          onCreate={openLeadCreate}
        />
      ) : tab === 'team' ? (
        <TeamDealsReport opportunities={opps} members={[]} />
      ) : (
        <OpportunityPipelineBoard
          opportunities={opps}
          onEdit={openOppEdit}
          onMove={moveStage}
          onDelete={deleteOpp}
          onCreate={openOppCreate}
        />
      )}

      {/* Lead modal */}
      {leadModal && (
        <Modal title={editingLead ? 'Edit lead' : 'Capture lead'} onClose={() => setLeadModal(false)}>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Contact name *" value={leadForm.name} onChange={(v) => setLeadForm({ ...leadForm, name: v })} />
              <Input label="Company" value={leadForm.company_name} onChange={(v) => setLeadForm({ ...leadForm, company_name: v })} />
              <Input label="Email" value={leadForm.email} onChange={(v) => setLeadForm({ ...leadForm, email: v })} type="email" />
              <Input label="Phone" value={leadForm.phone} onChange={(v) => setLeadForm({ ...leadForm, phone: v })} />
              <Input label="Job title" value={leadForm.job_title} onChange={(v) => setLeadForm({ ...leadForm, job_title: v })} />
              <Input label="Website" value={leadForm.website} onChange={(v) => setLeadForm({ ...leadForm, website: v })} />
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Select
                label="Status"
                value={leadForm.status}
                onChange={(v) => setLeadForm({ ...leadForm, status: v })}
                options={LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
              />
              <Select
                label="Source"
                value={leadForm.source}
                onChange={(v) => setLeadForm({ ...leadForm, source: v })}
                options={[{ value: '', label: '—' }, ...LEAD_SOURCES.map((s) => ({ value: s, label: s }))]}
              />
              <Select
                label="Priority"
                value={leadForm.priority}
                onChange={(v) => setLeadForm({ ...leadForm, priority: v })}
                options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
              />
            </div>
            <Input label="Source detail" value={leadForm.source_detail} onChange={(v) => setLeadForm({ ...leadForm, source_detail: v })} />
            <Input label="Industry" value={leadForm.industry} onChange={(v) => setLeadForm({ ...leadForm, industry: v })} />
            <GeoSelectFields
              compact
              countryRequired={false}
              value={{
                continent: '',
                country: leadForm.country || '',
                province: '',
                city: leadForm.city || '',
              }}
              onChange={(g: GeoValue) =>
                setLeadForm((f) => ({
                  ...f,
                  country: g.country,
                  city: g.city,
                }))
              }
            />
            <Input label="Address" value={leadForm.address} onChange={(v) => setLeadForm({ ...leadForm, address: v })} />
            <div className="grid sm:grid-cols-3 gap-3">
              <Input label="Est. value" value={leadForm.value_estimate} onChange={(v) => setLeadForm({ ...leadForm, value_estimate: v })} type="number" />
              <Input label="Score (0–100)" value={leadForm.score} onChange={(v) => setLeadForm({ ...leadForm, score: v })} type="number" />
              <Input label="Owner" value={leadForm.owner_name} onChange={(v) => setLeadForm({ ...leadForm, owner_name: v })} />
            </div>
            <Input label="Product / interest" value={leadForm.product_interest} onChange={(v) => setLeadForm({ ...leadForm, product_interest: v })} />
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Next action" value={leadForm.next_action} onChange={(v) => setLeadForm({ ...leadForm, next_action: v })} />
              <Input label="Next action date" value={leadForm.next_action_date} onChange={(v) => setLeadForm({ ...leadForm, next_action_date: v })} type="date" />
            </div>
            <TextArea label="Notes" value={leadForm.notes} onChange={(v) => setLeadForm({ ...leadForm, notes: v })} />
          </div>
          <div className="flex gap-2 mt-4">
            <button type="button" className="btn-secondary flex-1 !py-3" onClick={() => setLeadModal(false)}>Cancel</button>
            <button type="button" disabled={saving} className="btn-primary flex-1 !py-3" onClick={() => void saveLead()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save lead'}
            </button>
          </div>
        </Modal>
      )}

      {/* Opportunity modal */}
      {oppModal && (
        <Modal title={editingOpp ? 'Edit opportunity' : 'New opportunity'} onClose={() => setOppModal(false)}>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <Input label="Opportunity name *" value={oppForm.name} onChange={(v) => setOppForm({ ...oppForm, name: v })} />
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Contact name" value={oppForm.contact_name} onChange={(v) => setOppForm({ ...oppForm, contact_name: v })} />
              <Input label="Company" value={oppForm.company_name} onChange={(v) => setOppForm({ ...oppForm, company_name: v })} />
              <Input label="Email" value={oppForm.contact_email} onChange={(v) => setOppForm({ ...oppForm, contact_email: v })} type="email" />
              <Input label="Phone" value={oppForm.contact_phone} onChange={(v) => setOppForm({ ...oppForm, contact_phone: v })} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Select
                label="Stage"
                value={oppForm.stage}
                onChange={(v) =>
                  setOppForm({
                    ...oppForm,
                    stage: v,
                    probability: String(stageProbability(v)),
                  })
                }
                options={OPPORTUNITY_STAGES.map((s) => ({ value: s.value, label: s.label }))}
              />
              <Select
                label="Type"
                value={oppForm.opportunity_type}
                onChange={(v) => setOppForm({ ...oppForm, opportunity_type: v })}
                options={OPPORTUNITY_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Input label="Amount" value={oppForm.amount} onChange={(v) => setOppForm({ ...oppForm, amount: v })} type="number" />
              <Input label="Probability %" value={oppForm.probability} onChange={(v) => setOppForm({ ...oppForm, probability: v })} type="number" />
              <Input label="Expected close" value={oppForm.expected_close_date} onChange={(v) => setOppForm({ ...oppForm, expected_close_date: v })} type="date" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Product / interest" value={oppForm.product_interest} onChange={(v) => setOppForm({ ...oppForm, product_interest: v })} />
              <Input label="Location" value={oppForm.location} onChange={(v) => setOppForm({ ...oppForm, location: v })} />
              <Input label="Owner" value={oppForm.owner_name} onChange={(v) => setOppForm({ ...oppForm, owner_name: v })} />
              <Select
                label="Priority"
                value={oppForm.priority}
                onChange={(v) => setOppForm({ ...oppForm, priority: v })}
                options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Next step" value={oppForm.next_step} onChange={(v) => setOppForm({ ...oppForm, next_step: v })} />
              <Input label="Next step date" value={oppForm.next_step_date} onChange={(v) => setOppForm({ ...oppForm, next_step_date: v })} type="date" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Select
                label="Link customer"
                value={oppForm.customer_id}
                onChange={(v) => setOppForm({ ...oppForm, customer_id: v })}
                options={[
                  { value: '', label: '— None —' },
                  ...customers.map((c) => ({ value: String(c.id), label: c.trading_name })),
                ]}
              />
              <Select
                label="Source lead"
                value={oppForm.lead_id}
                onChange={(v) => setOppForm({ ...oppForm, lead_id: v })}
                options={[
                  { value: '', label: '— None —' },
                  ...leads.map((l) => ({
                    value: String(l.id),
                    label: `${l.name}${l.company_name ? ` · ${l.company_name}` : ''}`,
                  })),
                ]}
              />
            </div>
            <Input label="Competitor" value={oppForm.competitor} onChange={(v) => setOppForm({ ...oppForm, competitor: v })} />
            {oppForm.stage === 'closed_lost' && (
              <Input label="Lost reason" value={oppForm.lost_reason} onChange={(v) => setOppForm({ ...oppForm, lost_reason: v })} />
            )}
            <TextArea label="Description / notes" value={oppForm.description} onChange={(v) => setOppForm({ ...oppForm, description: v })} />
          </div>
          <div className="flex gap-2 mt-4">
            <button type="button" className="btn-secondary flex-1 !py-3" onClick={() => setOppModal(false)}>Cancel</button>
            <button type="button" disabled={saving} className="btn-primary flex-1 !py-3" onClick={() => void saveOpp()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save opportunity'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function LeadsTable({
  leads,
  onEdit,
  onDelete,
  onConvert,
  onCreate,
}: {
  leads: LeadRecord[];
  onEdit: (l: LeadRecord) => void;
  onDelete: (id: number) => void;
  onConvert: (l: LeadRecord) => void;
  onCreate: () => void;
}) {
  if (!leads.length) {
    return (
      <div className="bg-white border rounded-3xl p-16 text-center text-neutral-500">
        <Target className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
        <p className="mb-4">No leads yet. Capture your first prospect with full detail.</p>
        <button type="button" onClick={onCreate} className="btn-primary !py-2.5 !px-5 text-sm">
          New lead
        </button>
      </div>
    );
  }
  return (
    <div className="bg-white border rounded-3xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Lead</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold">Source</th>
              <th className="px-3 py-3 font-semibold text-right">Value</th>
              <th className="px-3 py-3 font-semibold">Score</th>
              <th className="px-3 py-3 font-semibold">Next action</th>
              <th className="px-3 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {leads.map((l) => (
              <tr key={l.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <div className="font-semibold">{l.name}</div>
                  <div className="text-xs text-neutral-500">
                    {[l.company_name, l.email, l.phone].filter(Boolean).join(' · ') || '—'}
                  </div>
                  {l.product_interest && (
                    <div className="text-[11px] text-neutral-400 mt-0.5">{l.product_interest}</div>
                  )}
                </td>
                <td className="px-3 py-3">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${leadStatusClass(l.status)}`}>
                    {(l.status || 'new').replace(/_/g, ' ')}
                  </span>
                  {l.priority && l.priority !== 'medium' && (
                    <div className={`mt-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full inline-block ${priorityClass(l.priority)}`}>
                      {l.priority}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-xs">{l.source || '—'}</td>
                <td className="px-3 py-3 text-right font-semibold">
                  {formatMoney(l.value_estimate, l.currency || 'ZAR')}
                </td>
                <td className="px-3 py-3">
                  <div className="w-14 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                    <div
                      className="h-full bg-[#00b4d8]"
                      style={{ width: `${Math.min(100, Number(l.score || 0))}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">{l.score ?? 0}</div>
                </td>
                <td className="px-3 py-3 text-xs">
                  <div>{l.next_action || '—'}</div>
                  {l.next_action_date && (
                    <div className="text-neutral-400">{l.next_action_date}</div>
                  )}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  {l.status !== 'converted' && (
                    <button
                      type="button"
                      onClick={() => onConvert(l)}
                      className="text-[11px] font-semibold text-[#0077b6] mr-2 hover:underline"
                      title="Convert to opportunity"
                    >
                      → Opportunity
                    </button>
                  )}
                  <button type="button" onClick={() => onEdit(l)} className="p-1.5 rounded-lg hover:bg-neutral-100">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => onDelete(l.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Pipeline board lives in components/sales/OpportunityPipelineBoard (shared with /sales/pipeline) */

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-neutral-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-neutral-500">{label}</label>
      <input
        type={type}
        className="input mt-1 w-full !p-2.5 !text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-neutral-500">{label}</label>
      <textarea
        className="input mt-1 w-full !p-2.5 !text-sm min-h-[80px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs font-medium text-neutral-500">{label}</label>
      <select
        className="input mt-1 w-full !p-2.5 !text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-3">
      <div className="text-[10px] text-neutral-500 uppercase font-semibold">{label}</div>
      <div className="text-lg font-black tracking-tight text-slate-900">{value}</div>
    </div>
  );
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
