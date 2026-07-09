'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Award, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { CustomerRecord } from '@/lib/customers/types';
import { LOYALTY_TIERS } from '@/lib/customers/documents';
import { CompanyRequired, CustomersHeader } from '@/components/customers/CustomersShell';

export default function LoyaltyPage() {
  return (
    <CompanyRequired>
      <LoyaltyInner />
    </CompanyRequired>
  );
}

function LoyaltyInner() {
  const companyId = getSelectedCompanyId()!;
  const [accounts, setAccounts] = useState<Array<Record<string, unknown>>>([]);
  const [transactions, setTransactions] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState('');
  const [points, setPoints] = useState('100');
  const [action, setAction] = useState<'enroll' | 'earn' | 'redeem' | 'adjust'>('enroll');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, c] = await Promise.all([
        fetch(`/api/customers/loyalty?companyId=${companyId}`).then((r) => r.json()),
        fetch(`/api/customers?companyId=${companyId}`).then((r) => r.json()),
      ]);
      setAccounts(l.accounts || []);
      setTransactions(l.transactions || []);
      setCustomers(c.customers || []);
      if (l.warning) toast.message(l.warning, { description: l.hint });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!customerId) {
      toast.error('Select a customer');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/customers/loyalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          customer_id: Number(customerId),
          action,
          points: Number(points) || 0,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(action === 'enroll' ? 'Enrolled' : 'Points updated');
      setNotes('');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <CustomersHeader
        title="Loyalty programme"
        description="Enrol customers, earn points on paid invoices, redeem rewards, and manage tiers (bronze → platinum)."
      />

      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        {LOYALTY_TIERS.map((t) => (
          <div key={t.value} className="rounded-2xl border bg-white p-4 text-center">
            <Award className="w-5 h-5 mx-auto text-[#00b4d8] mb-1" />
            <div className="font-bold capitalize">{t.label}</div>
            <div className="text-[11px] text-neutral-500">from {t.min.toLocaleString()} lifetime pts</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-white border rounded-3xl p-5 space-y-3 h-fit">
          <h2 className="font-bold flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#00b4d8]" /> Manage points
          </h2>
          <select className="input w-full !p-3 !text-sm" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Customer *</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.trading_name}</option>
            ))}
          </select>
          <select className="input w-full !p-3 !text-sm" value={action} onChange={(e) => setAction(e.target.value as typeof action)}>
            <option value="enroll">Enrol in programme</option>
            <option value="earn">Earn points</option>
            <option value="redeem">Redeem points</option>
            <option value="adjust">Adjust balance</option>
          </select>
          {action !== 'enroll' && (
            <input
              type="number"
              className="input w-full !p-3 !text-sm"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="Points"
            />
          )}
          <input
            className="input w-full !p-3 !text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
          />
          <button type="button" disabled={saving} onClick={() => void submit()} className="btn-primary w-full !py-3">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Apply'}
          </button>
          <p className="text-[11px] text-neutral-500">
            Paid invoices auto-earn 1 point per currency unit. Tiers update from lifetime earned points.
          </p>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white border rounded-3xl overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold text-sm">Accounts</div>
            {loading ? (
              <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" /></div>
            ) : accounts.length === 0 ? (
              <div className="p-10 text-center text-sm text-neutral-500">No loyalty accounts yet</div>
            ) : (
              <ul className="divide-y">
                {accounts.map((a) => (
                  <li key={String(a.id)} className="px-5 py-3 text-sm flex justify-between gap-3">
                    <div>
                      <div className="font-semibold">{String(a.customer_name)}</div>
                      <div className="text-xs text-neutral-500 capitalize">Tier {String(a.tier)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{Number(a.points_balance || 0).toLocaleString()}</div>
                      <div className="text-[10px] text-neutral-400">
                        life earned {Number(a.lifetime_earned || 0).toLocaleString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-white border rounded-3xl overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold text-sm">Recent transactions</div>
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-sm text-neutral-500">No transactions yet</div>
            ) : (
              <ul className="divide-y max-h-64 overflow-y-auto">
                {transactions.map((t) => (
                  <li key={String(t.id)} className="px-5 py-2 text-xs flex justify-between">
                    <div>
                      <span className="font-semibold capitalize">{String(t.txn_type)}</span>
                      {t.customer_name ? ` · ${String(t.customer_name)}` : ''}
                      {t.notes ? ` · ${String(t.notes)}` : ''}
                    </div>
                    <span className={Number(t.points) >= 0 ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                      {Number(t.points) > 0 ? '+' : ''}{Number(t.points)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
