'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { CustomerRecord } from '@/lib/customers/types';
import { formatMoney, statusBadgeClass } from '@/lib/customers/documents';
import { CompanyRequired, CustomersHeader } from '@/components/customers/CustomersShell';

export default function ContractsPage() {
  return (
    <CompanyRequired>
      <ContractsInner />
    </CompanyRequired>
  );
}

function ContractsInner() {
  const companyId = getSelectedCompanyId()!;
  const [contracts, setContracts] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_id: '',
    title: '',
    contract_type: 'supply',
    status: 'draft',
    start_date: '',
    end_date: '',
    value: '',
    payment_terms: 'Net 30',
    sla_summary: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ct, cu] = await Promise.all([
        fetch(`/api/customers/contracts?companyId=${companyId}`).then((r) => r.json()),
        fetch(`/api/customers?companyId=${companyId}`).then((r) => r.json()),
      ]);
      setContracts(ct.contracts || []);
      setCustomers(cu.customers || []);
      if (ct.warning) toast.message(ct.warning, { description: ct.hint });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

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
      const res = await fetch('/api/customers/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          ...form,
          customer_id: form.customer_id ? Number(form.customer_id) : null,
          value: Number(form.value) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Contract saved');
      setShow(false);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const activate = async (id: number) => {
    const res = await fetch('/api/customers/contracts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'active' }),
    });
    if (res.ok) {
      toast.success('Contract activated');
      void load();
    }
  };

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <CustomersHeader
        title="Contracts"
        description="Commercial agreements, SLAs, renewals, and contract values linked to customers."
        action={
          <button type="button" onClick={() => setShow((v) => !v)} className="btn-primary !py-2.5 !px-5 text-sm">
            <Plus className="w-4 h-4" /> New contract
          </button>
        }
      />

      {show && (
        <div className="bg-white border rounded-3xl p-5 mb-6 grid sm:grid-cols-2 gap-3">
          <select className="input !p-3 !text-sm" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
            <option value="">Customer</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.trading_name}</option>)}
          </select>
          <input className="input !p-3 !text-sm" placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <select className="input !p-3 !text-sm" value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value })}>
            <option value="supply">Supply</option>
            <option value="service">Service</option>
            <option value="framework">Framework</option>
            <option value="nda">NDA</option>
          </select>
          <input type="number" className="input !p-3 !text-sm" placeholder="Contract value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          <input type="date" className="input !p-3 !text-sm" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <input type="date" className="input !p-3 !text-sm" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          <input className="input !p-3 !text-sm sm:col-span-2" placeholder="Payment terms" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
          <textarea className="input !p-3 !text-sm sm:col-span-2 min-h-[60px]" placeholder="SLA summary" value={form.sla_summary} onChange={(e) => setForm({ ...form, sla_summary: e.target.value })} />
          <button type="button" disabled={saving} onClick={() => void create()} className="btn-primary sm:col-span-2 !py-3">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save contract'}
          </button>
        </div>
      )}

      <div className="bg-white border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" /></div>
        ) : contracts.length === 0 ? (
          <div className="p-16 text-center text-neutral-500 text-sm">
            <FileText className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
            No contracts yet
          </div>
        ) : (
          <ul className="divide-y">
            {contracts.map((c) => (
              <li key={String(c.id)} className="px-5 py-4 text-sm flex flex-wrap justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold">{String(c.contract_number)}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadgeClass(String(c.status))}`}>{String(c.status)}</span>
                  </div>
                  <div className="font-semibold mt-1">{String(c.title)}</div>
                  <div className="text-xs text-neutral-500">
                    {String(c.customer_name || '—')} · {String(c.start_date || '—')} → {String(c.end_date || '—')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{formatMoney(Number(c.value || 0))}</div>
                  {c.status === 'draft' && (
                    <button type="button" onClick={() => void activate(Number(c.id))} className="text-xs font-semibold text-[#0077b6] mt-1">
                      Activate
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
