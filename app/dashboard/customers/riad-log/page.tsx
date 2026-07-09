'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, AlertTriangle, Target, CheckCircle, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { CustomerRecord } from '@/lib/customers/types';
import { statusBadgeClass } from '@/lib/customers/documents';
import { CompanyRequired, CustomersHeader } from '@/components/customers/CustomersShell';

const TYPES = [
  { value: 'risk', label: 'Risk', icon: AlertTriangle },
  { value: 'issue', label: 'Issue', icon: AlertTriangle },
  { value: 'action', label: 'Action', icon: Target },
  { value: 'decision', label: 'Decision', icon: Scale },
] as const;

export default function CustomerRiadPage() {
  return (
    <CompanyRequired>
      <RiadInner />
    </CompanyRequired>
  );
}

function RiadInner() {
  const companyId = getSelectedCompanyId()!;
  const [entries, setEntries] = useState<Array<Record<string, unknown>>>([]);
  const [counts, setCounts] = useState({ risk: 0, issue: 0, action: 0, decision: 0, open: 0 });
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_id: '',
    entry_type: 'risk',
    title: '',
    description: '',
    severity: 'medium',
    owner_name: '',
    due_date: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (filter !== 'all') params.set('type', filter);
      const [r, c] = await Promise.all([
        fetch(`/api/customers/riad?${params}`).then((x) => x.json()),
        fetch(`/api/customers?companyId=${companyId}`).then((x) => x.json()),
      ]);
      setEntries(r.entries || []);
      setCounts(r.counts || counts);
      setCustomers(c.customers || []);
      if (r.warning) toast.message(r.warning, { description: r.hint });
    } finally {
      setLoading(false);
    }
  }, [companyId, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!form.title.trim()) {
      toast.error('Title required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/customers/riad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          ...form,
          customer_id: form.customer_id ? Number(form.customer_id) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('RIAD entry logged');
      setShow(false);
      setForm({ customer_id: '', entry_type: 'risk', title: '', description: '', severity: 'medium', owner_name: '', due_date: '' });
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const close = async (id: number) => {
    const res = await fetch('/api/customers/riad', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'closed' }),
    });
    if (res.ok) {
      toast.success('Closed');
      void load();
    }
  };

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <CustomersHeader
        title="Customer RIAD log"
        description="Risks, Issues, Actions, and Decisions for customer relationships — company-scoped on Supabase."
        action={
          <button type="button" onClick={() => setShow((v) => !v)} className="btn-primary !py-2.5 !px-5 text-sm">
            <Plus className="w-4 h-4" /> New entry
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setFilter(filter === t.value ? 'all' : t.value)}
            className={`rounded-2xl border p-4 text-left ${filter === t.value ? 'border-[#00b4d8] bg-[#00b4d8]/5' : 'bg-white'}`}
          >
            <t.icon className="w-4 h-4 text-[#00b4d8] mb-1" />
            <div className="text-2xl font-black">{counts[t.value] ?? 0}</div>
            <div className="text-xs text-neutral-500">Open {t.label.toLowerCase()}s</div>
          </button>
        ))}
        <div className="rounded-2xl border bg-white p-4">
          <CheckCircle className="w-4 h-4 text-emerald-600 mb-1" />
          <div className="text-2xl font-black">{counts.open}</div>
          <div className="text-xs text-neutral-500">Total open</div>
        </div>
      </div>

      {show && (
        <div className="bg-white border rounded-3xl p-5 mb-6 grid sm:grid-cols-2 gap-3">
          <select className="input !p-3 !text-sm" value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value })}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="input !p-3 !text-sm" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
            <option value="">Customer (optional)</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.trading_name}</option>)}
          </select>
          <input className="input !p-3 !text-sm sm:col-span-2" placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="input !p-3 !text-sm sm:col-span-2 min-h-[70px]" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="input !p-3 !text-sm" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <input type="date" className="input !p-3 !text-sm" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          <input className="input !p-3 !text-sm sm:col-span-2" placeholder="Owner" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
          <button type="button" disabled={saving} onClick={() => void create()} className="btn-primary sm:col-span-2 !py-3">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save entry'}
          </button>
        </div>
      )}

      <div className="bg-white border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" /></div>
        ) : entries.length === 0 ? (
          <div className="p-16 text-center text-neutral-500 text-sm">No RIAD entries yet</div>
        ) : (
          <ul className="divide-y">
            {entries.map((e) => (
              <li key={String(e.id)} className="px-5 py-4 text-sm flex flex-wrap justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100">{String(e.entry_type)}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadgeClass(String(e.status))}`}>{String(e.status)}</span>
                    <span className="text-[10px] capitalize text-neutral-500">{String(e.severity)}</span>
                  </div>
                  <div className="font-semibold mt-1">{String(e.title)}</div>
                  <div className="text-xs text-neutral-500">
                    {String(e.customer_name || 'General')}
                    {e.due_date ? ` · due ${String(e.due_date)}` : ''}
                    {e.owner_name ? ` · ${String(e.owner_name)}` : ''}
                  </div>
                  {!!e.description && (
                    <p className="text-xs text-neutral-600 mt-1 max-w-xl">{String(e.description)}</p>
                  )}
                </div>
                {e.status !== 'closed' && (
                  <button type="button" onClick={() => void close(Number(e.id))} className="btn-secondary !py-1.5 !px-3 text-xs h-fit">
                    Close
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
