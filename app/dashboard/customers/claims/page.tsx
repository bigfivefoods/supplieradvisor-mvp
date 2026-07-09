'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { CustomerRecord } from '@/lib/customers/types';
import { formatMoney, statusBadgeClass } from '@/lib/customers/documents';
import { CompanyRequired, CustomersHeader } from '@/components/customers/CustomersShell';

export default function ClaimsPage() {
  return (
    <CompanyRequired>
      <ClaimsInner />
    </CompanyRequired>
  );
}

function ClaimsInner() {
  const companyId = getSelectedCompanyId()!;
  const [claims, setClaims] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_id: '',
    title: '',
    claim_type: 'quality',
    priority: 'medium',
    amount_claimed: '',
    description: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cl, cu] = await Promise.all([
        fetch(`/api/customers/claims?companyId=${companyId}`).then((r) => r.json()),
        fetch(`/api/customers?companyId=${companyId}`).then((r) => r.json()),
      ]);
      setClaims(cl.claims || []);
      setCustomers(cu.customers || []);
      if (cl.warning) toast.message(cl.warning, { description: cl.hint });
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
      const res = await fetch('/api/customers/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          ...form,
          customer_id: form.customer_id ? Number(form.customer_id) : null,
          amount_claimed: Number(form.amount_claimed) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Claim logged');
      setShow(false);
      setForm({ customer_id: '', title: '', claim_type: 'quality', priority: 'medium', amount_claimed: '', description: '' });
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: number, status: string) => {
    const res = await fetch('/api/customers/claims', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      toast.success(`Status → ${status}`);
      void load();
    }
  };

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <CustomersHeader
        title="Claims"
        description="Log quality, delivery, damage, and pricing claims. Investigate, approve, and resolve with full history."
        action={
          <button type="button" onClick={() => setShow((v) => !v)} className="btn-primary !py-2.5 !px-5 text-sm">
            <Plus className="w-4 h-4" /> New claim
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
          <select className="input !p-3 !text-sm" value={form.claim_type} onChange={(e) => setForm({ ...form, claim_type: e.target.value })}>
            <option value="quality">Quality</option>
            <option value="short_delivery">Short delivery</option>
            <option value="damage">Damage</option>
            <option value="pricing">Pricing</option>
            <option value="other">Other</option>
          </select>
          <input type="number" className="input !p-3 !text-sm" placeholder="Amount claimed" value={form.amount_claimed} onChange={(e) => setForm({ ...form, amount_claimed: e.target.value })} />
          <textarea className="input !p-3 !text-sm sm:col-span-2 min-h-[70px]" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button type="button" disabled={saving} onClick={() => void create()} className="btn-primary sm:col-span-2 !py-3">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save claim'}
          </button>
        </div>
      )}

      <div className="bg-white border rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" /></div>
        ) : claims.length === 0 ? (
          <div className="p-16 text-center text-neutral-500 text-sm">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
            No claims yet
          </div>
        ) : (
          <ul className="divide-y">
            {claims.map((c) => (
              <li key={String(c.id)} className="px-5 py-4 text-sm flex flex-wrap justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-xs">{String(c.claim_number)}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadgeClass(String(c.status))}`}>{String(c.status)}</span>
                    <span className="text-[10px] capitalize text-neutral-500">{String(c.claim_type).replace(/_/g, ' ')}</span>
                  </div>
                  <div className="font-semibold mt-1">{String(c.title)}</div>
                  <div className="text-xs text-neutral-500">{String(c.customer_name || '—')}</div>
                </div>
                <div className="text-right space-y-1">
                  <div className="font-bold">{formatMoney(Number(c.amount_claimed || 0))}</div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {['investigating', 'approved', 'rejected', 'resolved', 'closed'].map((s) => (
                      <button key={s} type="button" onClick={() => void setStatus(Number(c.id), s)} className="text-[10px] px-2 py-0.5 rounded-full border hover:bg-neutral-50 capitalize">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
