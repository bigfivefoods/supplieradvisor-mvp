'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Plus,
  CheckCircle2,
  RotateCcw,
  X,
  Landmark,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  formatMoney,
  statusClass,
  type BankAccount,
  type BankTransaction,
} from '@/lib/accounting/types';
import {
  AccountingHeader,
  AccountingPage,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel, SectionLabel } from '@/components/relationship/RelationshipChrome';

export default function BankReconciliationPage() {
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
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [showTxn, setShowTxn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accForm, setAccForm] = useState({
    name: '',
    bank_name: '',
    account_number: '',
    account_type: 'current',
    currency: 'ZAR',
    opening_balance: '0',
    provider: 'manual',
  });
  const [txnForm, setTxnForm] = useState({
    bank_account_id: '',
    txn_date: new Date().toISOString().slice(0, 10),
    description: '',
    reference: '',
    amount: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        include: 'transactions',
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      if (selectedAccount) params.set('accountId', String(selectedAccount));
      const res = await fetch(`/api/accounting/bank?${params}`);
      const data = await res.json();
      setAccounts(data.accounts || []);
      setTransactions(data.transactions || []);
      if (data.warning) toast.message(data.warning, { description: data.hint });
    } catch {
      setAccounts([]);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, selectedAccount]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'account',
          ...accForm,
          opening_balance: Number(accForm.opening_balance || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Bank account created');
      setShowAccount(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function createTxn(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'transaction',
          bank_account_id: Number(txnForm.bank_account_id || selectedAccount),
          txn_date: txnForm.txn_date,
          description: txnForm.description,
          reference: txnForm.reference || null,
          amount: Number(txnForm.amount),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Transaction added');
      setShowTxn(false);
      setTxnForm({
        bank_account_id: '',
        txn_date: new Date().toISOString().slice(0, 10),
        description: '',
        reference: '',
        amount: '',
      });
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function reconcile(id: number, action: 'reconcile' | 'unreconcile') {
    try {
      const res = await fetch('/api/accounting/bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, action, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(action === 'reconcile' ? 'Reconciled' : 'Unreconciled');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  const totalBalance = accounts
    .filter((a) => a.status !== 'closed')
    .reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const unrec = accounts.reduce((s, a) => s + Number(a.unreconciled_count || 0), 0);

  const filteredTxn = selectedAccount
    ? transactions.filter((t) => t.bank_account_id === selectedAccount)
    : transactions;

  return (
    <AccountingPage>
      <AccountingHeader
        title="Bank &"
        titleAccent="reconciliation"
        description="Bank accounts, YOCO/crypto wallets, statement lines, and match-clear reconciliation."
        action={
          <>
            <button
              type="button"
              onClick={() => setShowAccount(true)}
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              <Plus className="w-4 h-4" /> Account
            </button>
            <button
              type="button"
              onClick={() => {
                setTxnForm((f) => ({
                  ...f,
                  bank_account_id: selectedAccount ? String(selectedAccount) : accounts[0] ? String(accounts[0].id) : '',
                }));
                setShowTxn(true);
              }}
              className="btn-primary !py-2.5 !px-5 text-sm"
              disabled={accounts.length === 0}
            >
              <Plus className="w-4 h-4" /> Transaction
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/70">
            Total bank balance
          </div>
          <div className="text-2xl font-black tabular-nums text-emerald-950">
            {formatMoney(totalBalance)}
          </div>
        </div>
        <div className="rounded-3xl border border-amber-100 bg-amber-50/40 p-5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-800/70">
            Unreconciled
          </div>
          <div className="text-2xl font-black tabular-nums text-amber-950">{unrec}</div>
        </div>
      </div>

      <SectionLabel>Accounts</SectionLabel>
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
        </div>
      ) : accounts.length === 0 ? (
        <Panel className="mb-8">
          <div className="px-6 py-12 text-center text-sm text-neutral-500">
            No bank accounts yet. Add your operating account to start reconciling.
          </div>
        </Panel>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() =>
                setSelectedAccount(selectedAccount === a.id ? null : a.id)
              }
              className={`text-left rounded-3xl border p-5 transition-all ${
                selectedAccount === a.id
                  ? 'border-[#00b4d8] shadow-md bg-white'
                  : 'border-neutral-200 bg-white hover:border-[#00b4d8]/50'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center">
                  <Landmark className="w-5 h-5 text-[#00b4d8]" />
                </div>
                {(a.unreconciled_count || 0) > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-100">
                    {a.unreconciled_count} open
                  </span>
                )}
              </div>
              <div className="font-bold text-slate-900">{a.name}</div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {a.bank_name || a.provider || a.account_type}
                {a.account_number ? ` · ··${String(a.account_number).slice(-4)}` : ''}
              </div>
              <div className="text-xl font-black tabular-nums mt-3 text-slate-900">
                {formatMoney(a.current_balance, a.currency || 'ZAR')}
              </div>
            </button>
          ))}
        </div>
      )}

      <SectionLabel>
        Transactions{selectedAccount ? ' (filtered)' : ''}
      </SectionLabel>
      <Panel>
        {filteredTxn.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-neutral-500">
            No bank transactions yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filteredTxn.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50/80">
                    <td className="px-4 py-3 tabular-nums text-neutral-500">{t.txn_date}</td>
                    <td className="px-4 py-3 text-slate-800">{t.description || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-500">
                      {t.reference || '—'}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold tabular-nums ${
                        Number(t.amount) >= 0 ? 'text-emerald-700' : 'text-slate-800'
                      }`}
                    >
                      {formatMoney(t.amount, t.currency || 'ZAR')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusClass(t.status)}`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.status === 'unreconciled' ? (
                        <button
                          type="button"
                          title="Reconcile"
                          onClick={() => void reconcile(t.id, 'reconcile')}
                          className="p-1.5 rounded-lg border border-neutral-200 hover:border-emerald-300 text-neutral-500 hover:text-emerald-700"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          title="Unreconcile"
                          onClick={() => void reconcile(t.id, 'unreconcile')}
                          className="p-1.5 rounded-lg border border-neutral-200 hover:border-amber-300 text-neutral-500 hover:text-amber-700"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showAccount && (
        <Modal title="New bank account" onClose={() => setShowAccount(false)}>
          <form onSubmit={createAccount} className="space-y-3">
            <Field label="Name" required>
              <input
                required
                value={accForm.name}
                onChange={(e) => setAccForm({ ...accForm, name: e.target.value })}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                placeholder="Operating account"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank">
                <input
                  value={accForm.bank_name}
                  onChange={(e) => setAccForm({ ...accForm, bank_name: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Account number">
                <input
                  value={accForm.account_number}
                  onChange={(e) => setAccForm({ ...accForm, account_number: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select
                  value={accForm.account_type}
                  onChange={(e) => setAccForm({ ...accForm, account_type: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="current">Current</option>
                  <option value="savings">Savings</option>
                  <option value="credit">Credit</option>
                  <option value="crypto">Crypto wallet</option>
                  <option value="gateway">Payment gateway</option>
                </select>
              </Field>
              <Field label="Opening balance">
                <input
                  type="number"
                  step="0.01"
                  value={accForm.opening_balance}
                  onChange={(e) => setAccForm({ ...accForm, opening_balance: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </Field>
            </div>
            <Field label="Provider">
              <select
                value={accForm.provider}
                onChange={(e) => setAccForm({ ...accForm, provider: e.target.value })}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm bg-white"
              >
                <option value="manual">Manual</option>
                <option value="yoco">YOCO</option>
                <option value="stripe">Stripe</option>
                <option value="crypto">Crypto</option>
              </select>
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary !py-2 !px-4 text-sm" onClick={() => setShowAccount(false)}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary !py-2 !px-4 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showTxn && (
        <Modal title="Add bank transaction" onClose={() => setShowTxn(false)}>
          <form onSubmit={createTxn} className="space-y-3">
            <Field label="Account" required>
              <select
                required
                value={txnForm.bank_account_id}
                onChange={(e) => setTxnForm({ ...txnForm, bank_account_id: e.target.value })}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm bg-white"
              >
                <option value="">Select…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={txnForm.txn_date}
                onChange={(e) => setTxnForm({ ...txnForm, txn_date: e.target.value })}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Description">
              <input
                value={txnForm.description}
                onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Amount (+in / −out)" required>
              <input
                required
                type="number"
                step="0.01"
                value={txnForm.amount}
                onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                placeholder="e.g. 1500 or -250"
              />
            </Field>
            <Field label="Reference">
              <input
                value={txnForm.reference}
                onChange={(e) => setTxnForm({ ...txnForm, reference: e.target.value })}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary !py-2 !px-4 text-sm" onClick={() => setShowTxn(false)}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary !py-2 !px-4 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AccountingPage>
  );
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold text-neutral-600">
      {label}
      {required && <span className="text-red-500"> *</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}
