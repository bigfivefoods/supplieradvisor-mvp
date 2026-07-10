'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { formatMoney, statusClass, type PaymentRecord } from '@/lib/accounting/types';
import {
  AccountingHeader,
  AccountingPage,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

export default function PaymentsPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dir, setDir] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: '',
    direction: 'inbound',
    method: 'eft',
    reference: '',
    counterparty_name: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      if (dir !== 'all') params.set('direction', dir);
      const res = await fetch(`/api/accounting/payments?${params}`);
      const data = await res.json();
      setPayments(data.payments || []);
      if (data.warning) toast.message(data.warning);
    } catch {
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, dir]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPayment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          amount: Number(form.amount),
          direction: form.direction,
          method: form.method,
          reference: form.reference || null,
          counterparty_name: form.counterparty_name || null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Payment recorded');
      setShowModal(false);
      setForm({ amount: '', direction: 'inbound', method: 'eft', reference: '', counterparty_name: '', notes: '' });
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  const inflow = payments
    .filter((p) => p.direction === 'inbound')
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const outflow = payments
    .filter((p) => p.direction === 'outbound')
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <AccountingPage>
      <AccountingHeader
        title="Payments"
        titleAccent="& treasury"
        description="Record inbound receipts and outbound supplier payments. Link to invoices from AR/AP for automatic balance updates."
        action={
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="btn-primary !py-2.5 !px-5 text-sm"
          >
            <Plus className="w-4 h-4" /> Record payment
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-3xl border border-neutral-200 bg-white p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Inflow</div>
          <div className="text-xl font-black tabular-nums text-emerald-800">{formatMoney(inflow)}</div>
        </div>
        <div className="rounded-3xl border border-neutral-200 bg-white p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Outflow</div>
          <div className="text-xl font-black tabular-nums text-slate-800">{formatMoney(outflow)}</div>
        </div>
        <div className="rounded-3xl border border-neutral-200 bg-white p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Net</div>
          <div className="text-xl font-black tabular-nums text-[#0077b6]">{formatMoney(inflow - outflow)}</div>
        </div>
      </div>

      <div className="mb-4">
        <select
          value={dir}
          onChange={(e) => setDir(e.target.value)}
          className="rounded-2xl border border-neutral-200 px-3 py-2.5 text-sm bg-white"
        >
          <option value="all">All directions</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
      </div>

      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
          </div>
        ) : payments.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-neutral-500">
            No payments recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Direction</th>
                  <th className="px-4 py-3 font-semibold">Counterparty</th>
                  <th className="px-4 py-3 font-semibold">Method</th>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold">Invoice</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50/80">
                    <td className="px-4 py-3 text-neutral-500 tabular-nums">
                      {(p.paid_at || p.created_at || '').slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          p.direction === 'inbound'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                            : 'bg-slate-50 text-slate-700 border-slate-100'
                        }`}
                      >
                        {p.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {p.counterparty_name || (p.invoice as { counterparty_name?: string } | null)?.counterparty_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{p.method || '—'}</td>
                    <td className="px-4 py-3 text-neutral-500 font-mono text-xs">{p.reference || '—'}</td>
                    <td className="px-4 py-3 text-neutral-500">
                      {(p.invoice as { invoice_number?: string } | null)?.invoice_number ||
                        (p.invoice_id ? `#${p.invoice_id}` : '—')}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatMoney(p.amount, p.currency || 'ZAR')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusClass(String(p.status || 'completed'))}`}
                      >
                        {p.status || 'completed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold">Record payment</h3>
              <button type="button" onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-neutral-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={createPayment} className="p-5 space-y-3">
              <label className="block text-xs font-semibold text-neutral-600">
                Amount
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-neutral-600">
                Direction
                <select
                  value={form.direction}
                  onChange={(e) => setForm({ ...form, direction: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="inbound">Inbound (receipt)</option>
                  <option value="outbound">Outbound (payment)</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-neutral-600">
                Counterparty
                <input
                  value={form.counterparty_name}
                  onChange={(e) => setForm({ ...form, counterparty_name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-neutral-600">
                  Method
                  <select
                    value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm bg-white"
                  >
                    <option value="eft">EFT</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="yoco">YOCO</option>
                    <option value="stripe">Stripe</option>
                    <option value="crypto">Crypto</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-neutral-600">
                  Reference
                  <input
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary !py-2 !px-4 text-sm" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary !py-2 !px-4 text-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AccountingPage>
  );
}
