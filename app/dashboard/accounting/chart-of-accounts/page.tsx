'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Plus,
  Search,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  ACCOUNT_TYPES,
  accountTypeLabel,
  formatMoney,
  type CoaAccount,
} from '@/lib/accounting/types';
import {
  AccountingHeader,
  AccountingPage,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

export default function ChartOfAccountsPage() {
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
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    account_type: 'expense',
    subtype: '',
    description: '',
    is_header: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (q) params.set('q', q);
      const res = await fetch(`/api/accounting/chart-of-accounts?${params}`);
      const data = await res.json();
      setAccounts(data.accounts || []);
      if (data.warning) toast.message(data.warning, { description: data.hint });
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, typeFilter, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  async function seedDefaults() {
    setSeeding(true);
    try {
      const res = await fetch('/api/accounting/chart-of-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, seed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Seed failed');
      if (data.seeded > 0) toast.success(`Seeded ${data.seeded} accounts`);
      else toast.message(data.warning || 'Chart already has accounts');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/chart-of-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          ...form,
          normal_balance: ACCOUNT_TYPES.find((t) => t.value === form.account_type)?.normal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Account created');
      setShowModal(false);
      setForm({ code: '', name: '', account_type: 'expense', subtype: '', description: '', is_header: false });
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(acc: CoaAccount) {
    try {
      const res = await fetch('/api/accounting/chart-of-accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          id: acc.id,
          is_active: acc.is_active === false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <AccountingPage>
      <AccountingHeader
        title="Chart of"
        titleAccent="Accounts"
        description="Manage your flexible GL structure — assets, liabilities, equity, revenue, and expenses with live balances from posted journals."
        action={
          <>
            <button
              type="button"
              onClick={() => void seedDefaults()}
              disabled={seeding}
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              {seeding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Seed defaults
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              <Plus className="w-4 h-4" /> Add account
            </button>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code or name…"
            className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-neutral-200 text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-2xl border border-neutral-200 px-3 py-2.5 text-sm bg-white"
        >
          <option value="all">All types</option>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm text-neutral-500 mb-4">
              No accounts yet. Seed a full starter chart or add your first account.
            </p>
            <button
              type="button"
              onClick={() => void seedDefaults()}
              disabled={seeding}
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              <Sparkles className="w-4 h-4" /> Seed default CoA
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold text-right">Balance</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {accounts.map((a) => (
                  <tr
                    key={a.id}
                    className={`hover:bg-neutral-50/80 ${a.is_header ? 'bg-slate-50/80' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                      {a.code}
                    </td>
                    <td className="px-4 py-3">
                      <span className={a.is_header ? 'font-bold text-slate-900' : 'text-slate-800'}>
                        {a.name}
                      </span>
                      {a.is_system && (
                        <span className="ml-2 text-[9px] uppercase font-bold tracking-wider text-neutral-400">
                          system
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {accountTypeLabel(String(a.account_type))}
                      {a.subtype ? (
                        <span className="text-neutral-400"> · {a.subtype}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {a.is_header ? '—' : formatMoney(a.balance || 0, a.currency || 'ZAR')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          a.is_active === false
                            ? 'bg-neutral-50 text-neutral-500 border-neutral-100'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-100'
                        }`}
                      >
                        {a.is_active === false ? 'inactive' : 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void toggleActive(a)}
                        className="text-neutral-400 hover:text-[#00b4d8]"
                        title="Toggle active"
                      >
                        {a.is_active === false ? (
                          <ToggleLeft className="w-5 h-5" />
                        ) : (
                          <ToggleRight className="w-5 h-5 text-[#00b4d8]" />
                        )}
                      </button>
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
              <h3 className="font-bold">New account</h3>
              <button type="button" onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-neutral-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={createAccount}
              className="p-5 space-y-3"
            >
              <label className="block text-xs font-semibold text-neutral-600">
                Code
                <input
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  placeholder="6100"
                />
              </label>
              <label className="block text-xs font-semibold text-neutral-600">
                Name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-neutral-600">
                Type
                <select
                  value={form.account_type}
                  onChange={(e) => setForm({ ...form, account_type: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm bg-white"
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-neutral-600">
                Subtype
                <input
                  value={form.subtype}
                  onChange={(e) => setForm({ ...form, subtype: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  placeholder="optional"
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                <input
                  type="checkbox"
                  checked={form.is_header}
                  onChange={(e) => setForm({ ...form, is_header: e.target.checked })}
                />
                Header account (no posting)
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary !py-2 !px-4 text-sm" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary !py-2 !px-4 text-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AccountingPage>
  );
}
