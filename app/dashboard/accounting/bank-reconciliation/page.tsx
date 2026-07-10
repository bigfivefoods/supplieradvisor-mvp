'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Plus,
  CheckCircle2,
  RotateCcw,
  X,
  Landmark,
  Upload,
  Tags,
  FileSpreadsheet,
  Ban,
  Link2,
  Download,
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
  type CoaAccount,
  type AccountingInvoice,
} from '@/lib/accounting/types';
import { UNIVERSAL_CSV_TEMPLATE } from '@/lib/accounting/csv';
import {
  AccountingHeader,
  AccountingPage,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel, SectionLabel } from '@/components/relationship/RelationshipChrome';

type Pulse = {
  unallocated: number;
  allocated: number;
  matched_invoice: number;
  excluded: number;
  unallocatedIn: number;
  unallocatedOut: number;
};

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
  const [coa, setCoa] = useState<CoaAccount[]>([]);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [allocFilter, setAllocFilter] = useState('unallocated');

  const [showAccount, setShowAccount] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAllocate, setShowAllocate] = useState<BankTransaction | null>(null);
  const [showMatch, setShowMatch] = useState<BankTransaction | null>(null);
  const [invoices, setInvoices] = useState<AccountingInvoice[]>([]);
  const [saving, setSaving] = useState(false);

  const [accForm, setAccForm] = useState({
    name: '',
    bank_name: 'FNB',
    account_number: '',
    account_type: 'current',
    currency: 'ZAR',
    opening_balance: '0',
    provider: 'manual',
    gl_account_id: '',
  });

  const [importForm, setImportForm] = useState({
    bank_account_id: '',
    format: 'auto',
    csv: '',
    filename: '',
  });
  const [importPreview, setImportPreview] = useState<Record<string, unknown> | null>(null);

  const [allocForm, setAllocForm] = useState({
    gl_account_id: '',
    memo: '',
    tax_amount: '',
  });
  const [matchInvoiceId, setMatchInvoiceId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkGl, setBulkGl] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        include: 'transactions',
        limit: '500',
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      if (selectedAccount) params.set('accountId', String(selectedAccount));
      if (allocFilter !== 'all') params.set('allocation_status', allocFilter);

      const coaParams = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) coaParams.set('privyUserId', privyUserId);

      const [bankRes, coaRes] = await Promise.all([
        fetch(`/api/accounting/bank?${params}`),
        fetch(`/api/accounting/chart-of-accounts?${coaParams}`),
      ]);
      const bankData = await bankRes.json();
      const coaData = await coaRes.json();
      setAccounts(bankData.accounts || []);
      setTransactions(bankData.transactions || []);
      setPulse(bankData.pulse || null);
      setCoa((coaData.accounts || []).filter((a: CoaAccount) => !a.is_header && a.is_active !== false));
      if (bankData.warning) toast.message(bankData.warning, { description: bankData.hint });
    } catch {
      setAccounts([]);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, selectedAccount, allocFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const coaById = useMemo(() => {
    const m: Record<number, CoaAccount> = {};
    for (const a of coa) m[a.id] = a;
    return m;
  }, [coa]);

  const plAccounts = useMemo(
    () =>
      coa.filter((a) =>
        ['revenue', 'expense', 'cogs', 'asset', 'liability', 'equity'].includes(
          String(a.account_type)
        )
      ),
    [coa]
  );

  const incomeExpenseAccounts = useMemo(
    () => coa.filter((a) => ['revenue', 'expense', 'cogs'].includes(String(a.account_type))),
    [coa]
  );

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
          gl_account_id: accForm.gl_account_id ? Number(accForm.gl_account_id) : null,
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

  async function dryRunImport() {
    if (!importForm.bank_account_id || !importForm.csv.trim()) {
      toast.error('Select account and paste or upload CSV');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/bank/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          bank_account_id: Number(importForm.bank_account_id),
          csv: importForm.csv,
          format: importForm.format,
          filename: importForm.filename || null,
          dryRun: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Parse failed');
      setImportPreview(data);
      toast.success(`Preview: ${data.wouldImport} new · ${data.duplicates} duplicates`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function runImport() {
    if (!importForm.bank_account_id || !importForm.csv.trim()) {
      toast.error('Select account and CSV');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/bank/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          bank_account_id: Number(importForm.bank_account_id),
          csv: importForm.csv,
          format: importForm.format,
          filename: importForm.filename || null,
          dryRun: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      toast.success(`Imported ${data.imported} lines (${data.duplicates} duplicates skipped)`);
      setShowImport(false);
      setImportPreview(null);
      setImportForm({ bank_account_id: '', format: 'auto', csv: '', filename: '' });
      setAllocFilter('unallocated');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  function onFile(file: File | null) {
    if (!file) return;
    setImportForm((f) => ({ ...f, filename: file.name }));
    const reader = new FileReader();
    reader.onload = () => {
      setImportForm((f) => ({ ...f, csv: String(reader.result || '') }));
      setImportPreview(null);
    };
    reader.readAsText(file);
  }

  async function allocateOne(e: React.FormEvent) {
    e.preventDefault();
    if (!showAllocate || !allocForm.gl_account_id) return;
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/bank/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'allocate',
          bank_transaction_id: showAllocate.id,
          gl_account_id: Number(allocForm.gl_account_id),
          memo: allocForm.memo || null,
          tax_amount: allocForm.tax_amount ? Number(allocForm.tax_amount) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Allocated · journal ${data.entryNumber}`);
      setShowAllocate(null);
      setAllocForm({ gl_account_id: '', memo: '', tax_amount: '' });
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function bulkAllocate() {
    if (!bulkGl || selectedIds.size === 0) {
      toast.error('Select lines and a GL account');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/bank/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'bulk_allocate',
          ids: [...selectedIds],
          gl_account_id: Number(bulkGl),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Allocated ${data.allocated}, failed ${data.failed}`);
      setSelectedIds(new Set());
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function openMatch(txn: BankTransaction) {
    setShowMatch(txn);
    setMatchInvoiceId('');
    const dir = Number(txn.amount) > 0 ? 'receivable' : 'payable';
    const params = new URLSearchParams({
      companyId: String(companyId),
      direction: dir,
    });
    if (privyUserId) params.set('privyUserId', privyUserId);
    const res = await fetch(`/api/accounting/invoices?${params}`);
    const data = await res.json();
    setInvoices(
      (data.invoices || []).filter(
        (i: AccountingInvoice) =>
          !['paid', 'void', 'cancelled'].includes(String(i.status)) &&
          Number(i.balance_due || i.total_amount || 0) > 0
      )
    );
  }

  async function matchInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!showMatch || !matchInvoiceId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/bank/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'match_invoice',
          bank_transaction_id: showMatch.id,
          invoice_id: Number(matchInvoiceId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Matched to invoice & payment recorded');
      setShowMatch(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function exclude(id: number) {
    try {
      const res = await fetch('/api/accounting/bank/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'exclude',
          bank_transaction_id: id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Excluded');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
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
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    const unalloc = transactions.filter(
      (t) => (t.allocation_status || 'unallocated') === 'unallocated'
    );
    setSelectedIds(new Set(unalloc.map((t) => t.id)));
  }

  const totalBalance = accounts
    .filter((a) => a.status !== 'closed')
    .reduce((s, a) => s + Number(a.current_balance || 0), 0);

  return (
    <AccountingPage>
      <AccountingHeader
        title="Bank &"
        titleAccent="allocation"
        description="Import FNB/RMB CSV statements, allocate income and expenses to the GL, match AR/AP, and feed management accounts."
        action={
          <>
            <Link
              href="/dashboard/accounting/management"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              <FileSpreadsheet className="w-4 h-4" /> Management accounts
            </Link>
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
                setImportForm((f) => ({
                  ...f,
                  bank_account_id: selectedAccount
                    ? String(selectedAccount)
                    : accounts[0]
                      ? String(accounts[0].id)
                      : '',
                }));
                setShowImport(true);
              }}
              className="btn-primary !py-2.5 !px-5 text-sm"
              disabled={accounts.length === 0}
            >
              <Upload className="w-4 h-4" /> Import CSV
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/70">
            Bank balance
          </div>
          <div className="text-2xl font-black tabular-nums text-emerald-950">
            {formatMoney(totalBalance)}
          </div>
        </div>
        <div className="rounded-3xl border border-amber-100 bg-amber-50/40 p-5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-800/70">
            Unallocated
          </div>
          <div className="text-2xl font-black tabular-nums text-amber-950">
            {pulse?.unallocated ?? 0}
          </div>
          <div className="text-[11px] text-amber-900/70 mt-1">
            In {formatMoney(pulse?.unallocatedIn ?? 0)} · Out{' '}
            {formatMoney(pulse?.unallocatedOut ?? 0)}
          </div>
        </div>
        <div className="rounded-3xl border border-neutral-200 bg-white p-5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            Allocated
          </div>
          <div className="text-2xl font-black tabular-nums">
            {(pulse?.allocated ?? 0) + (pulse?.matched_invoice ?? 0)}
          </div>
        </div>
        <div className="rounded-3xl border border-neutral-200 bg-white p-5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            Accounts
          </div>
          <div className="text-2xl font-black tabular-nums">{accounts.length}</div>
        </div>
      </div>

      <SectionLabel>Bank accounts</SectionLabel>
      {loading && accounts.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
        </div>
      ) : accounts.length === 0 ? (
        <Panel className="mb-8">
          <div className="px-6 py-12 text-center text-sm text-neutral-500">
            Add your FNB/RMB operating account, then import a CSV statement to start allocating.
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <SectionLabel>Transactions</SectionLabel>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={allocFilter}
            onChange={(e) => setAllocFilter(e.target.value)}
            className="rounded-2xl border border-neutral-200 px-3 py-2 text-xs bg-white"
          >
            <option value="unallocated">Unallocated</option>
            <option value="allocated">Allocated</option>
            <option value="matched_invoice">Matched invoice</option>
            <option value="excluded">Excluded</option>
            <option value="all">All</option>
          </select>
          {selectedIds.size > 0 && (
            <>
              <select
                value={bulkGl}
                onChange={(e) => setBulkGl(e.target.value)}
                className="rounded-2xl border border-neutral-200 px-3 py-2 text-xs bg-white max-w-[200px]"
              >
                <option value="">Bulk GL account…</option>
                {incomeExpenseAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void bulkAllocate()}
                disabled={saving}
                className="btn-primary !py-2 !px-3 text-xs"
              >
                <Tags className="w-3.5 h-3.5" /> Allocate {selectedIds.size}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={selectAllVisible}
            className="text-xs font-semibold text-[#00b4d8] hover:underline"
          >
            Select unallocated
          </button>
        </div>
      </div>

      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-neutral-500">
            No transactions. Import a bank CSV to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <th className="px-3 py-3 w-8" />
                  <th className="px-3 py-3 font-semibold">Date</th>
                  <th className="px-3 py-3 font-semibold">Description</th>
                  <th className="px-3 py-3 font-semibold">Ref</th>
                  <th className="px-3 py-3 font-semibold text-right">Amount</th>
                  <th className="px-3 py-3 font-semibold">Allocation</th>
                  <th className="px-3 py-3 font-semibold">GL</th>
                  <th className="px-3 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {transactions.map((t) => {
                  const alloc = t.allocation_status || 'unallocated';
                  const gl = t.gl_account_id ? coaById[t.gl_account_id] : null;
                  return (
                    <tr key={t.id} className="hover:bg-neutral-50/80">
                      <td className="px-3 py-2.5">
                        {alloc === 'unallocated' && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(t.id)}
                            onChange={() => toggleSelect(t.id)}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-neutral-500 whitespace-nowrap">
                        {t.txn_date}
                      </td>
                      <td className="px-3 py-2.5 text-slate-800 max-w-[240px]">
                        <div className="truncate font-medium">{t.description || '—'}</div>
                        {t.counterparty_name && (
                          <div className="text-[11px] text-neutral-400 truncate">
                            {t.counterparty_name}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-neutral-500">
                        {t.reference || '—'}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap ${
                          Number(t.amount) >= 0 ? 'text-emerald-700' : 'text-slate-800'
                        }`}
                      >
                        {formatMoney(t.amount, t.currency || 'ZAR')}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusClass(alloc)}`}
                        >
                          {alloc.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-neutral-600">
                        {gl ? `${gl.code}` : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1">
                          {alloc === 'unallocated' && (
                            <>
                              <IconBtn
                                title="Allocate to GL"
                                onClick={() => {
                                  setShowAllocate(t);
                                  setAllocForm({
                                    gl_account_id: '',
                                    memo: t.description || '',
                                    tax_amount: '',
                                  });
                                }}
                              >
                                <Tags className="w-3.5 h-3.5" />
                              </IconBtn>
                              <IconBtn title="Match invoice" onClick={() => void openMatch(t)}>
                                <Link2 className="w-3.5 h-3.5" />
                              </IconBtn>
                              <IconBtn title="Exclude" onClick={() => void exclude(t.id)}>
                                <Ban className="w-3.5 h-3.5" />
                              </IconBtn>
                            </>
                          )}
                          {t.status === 'unreconciled' && alloc !== 'unallocated' && (
                            <IconBtn
                              title="Mark reconciled"
                              onClick={() => void reconcile(t.id, 'reconcile')}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </IconBtn>
                          )}
                          {t.status === 'reconciled' && (
                            <IconBtn
                              title="Unreconcile"
                              onClick={() => void reconcile(t.id, 'unreconcile')}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </IconBtn>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* New account modal */}
      {showAccount && (
        <Modal title="New bank account" onClose={() => setShowAccount(false)}>
          <form onSubmit={createAccount} className="space-y-3">
            <Field label="Name" required>
              <input
                required
                value={accForm.name}
                onChange={(e) => setAccForm({ ...accForm, name: e.target.value })}
                className="input"
                placeholder="FNB Operating"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank">
                <input
                  value={accForm.bank_name}
                  onChange={(e) => setAccForm({ ...accForm, bank_name: e.target.value })}
                  className="input"
                  placeholder="FNB / RMB"
                />
              </Field>
              <Field label="Account number">
                <input
                  value={accForm.account_number}
                  onChange={(e) => setAccForm({ ...accForm, account_number: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
            <Field label="Opening balance">
              <input
                type="number"
                step="0.01"
                value={accForm.opening_balance}
                onChange={(e) => setAccForm({ ...accForm, opening_balance: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Linked GL cash account">
              <select
                value={accForm.gl_account_id}
                onChange={(e) => setAccForm({ ...accForm, gl_account_id: e.target.value })}
                className="input"
              >
                <option value="">Auto (1110 Bank)</option>
                {plAccounts
                  .filter((a) => a.account_type === 'asset')
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
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

      {/* Import modal */}
      {showImport && (
        <Modal title="Import bank CSV" onClose={() => setShowImport(false)} wide>
          <div className="space-y-3">
            <p className="text-xs text-neutral-500 leading-relaxed">
              Export CSV from FNB/RMB online banking (Date, Description, Amount or Money In/Out,
              Balance). Or use our universal template.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="text-xs font-semibold text-[#00b4d8] inline-flex items-center gap-1 hover:underline"
                onClick={() => {
                  setImportForm((f) => ({
                    ...f,
                    csv: UNIVERSAL_CSV_TEMPLATE,
                    format: 'universal',
                    filename: 'template.csv',
                  }));
                  setImportPreview(null);
                }}
              >
                <Download className="w-3.5 h-3.5" /> Load template
              </button>
            </div>
            <Field label="Bank account" required>
              <select
                required
                value={importForm.bank_account_id}
                onChange={(e) =>
                  setImportForm({ ...importForm, bank_account_id: e.target.value })
                }
                className="input"
              >
                <option value="">Select…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Format hint">
                <select
                  value={importForm.format}
                  onChange={(e) => setImportForm({ ...importForm, format: e.target.value })}
                  className="input"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="fnb">FNB / Money In-Out</option>
                  <option value="rmb">RMB</option>
                  <option value="universal">Universal</option>
                </select>
              </Field>
              <Field label="CSV file">
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={(e) => onFile(e.target.files?.[0] || null)}
                  className="text-xs w-full"
                />
              </Field>
            </div>
            <Field label="CSV content">
              <textarea
                value={importForm.csv}
                onChange={(e) => {
                  setImportForm({ ...importForm, csv: e.target.value });
                  setImportPreview(null);
                }}
                className="input min-h-[140px] font-mono text-xs"
                placeholder="Paste CSV here…"
              />
            </Field>
            {importPreview && (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs space-y-1">
                <div>
                  Format: <strong>{String(importPreview.format)}</strong>
                </div>
                <div>
                  Would import: <strong>{String(importPreview.wouldImport)}</strong> · Duplicates:{' '}
                  {String(importPreview.duplicates)} · Skipped: {String(importPreview.skipped)}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary !py-2 !px-4 text-sm"
                onClick={() => void dryRunImport()}
                disabled={saving}
              >
                Preview
              </button>
              <button
                type="button"
                className="btn-primary !py-2 !px-4 text-sm"
                onClick={() => void runImport()}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Import'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Allocate modal */}
      {showAllocate && (
        <Modal
          title={`Allocate · ${formatMoney(showAllocate.amount)}`}
          onClose={() => setShowAllocate(null)}
        >
          <form onSubmit={allocateOne} className="space-y-3">
            <p className="text-xs text-neutral-500">
              {showAllocate.txn_date} · {showAllocate.description}
              <br />
              {Number(showAllocate.amount) > 0
                ? 'Inflow → credit income (or other) account'
                : 'Outflow → debit expense (or other) account'}
            </p>
            <Field label="GL account" required>
              <select
                required
                value={allocForm.gl_account_id}
                onChange={(e) => setAllocForm({ ...allocForm, gl_account_id: e.target.value })}
                className="input"
              >
                <option value="">Select…</option>
                <optgroup label="Income / expense">
                  {incomeExpenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name} ({a.account_type})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Other">
                  {plAccounts
                    .filter((a) => !['revenue', 'expense', 'cogs'].includes(String(a.account_type)))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                </optgroup>
              </select>
            </Field>
            <Field label="Memo">
              <input
                value={allocForm.memo}
                onChange={(e) => setAllocForm({ ...allocForm, memo: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="VAT amount (optional)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={allocForm.tax_amount}
                onChange={(e) => setAllocForm({ ...allocForm, tax_amount: e.target.value })}
                className="input"
                placeholder="0"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary !py-2 !px-4 text-sm" onClick={() => setShowAllocate(null)}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary !py-2 !px-4 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post allocation'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Match invoice */}
      {showMatch && (
        <Modal
          title={`Match invoice · ${formatMoney(showMatch.amount)}`}
          onClose={() => setShowMatch(null)}
        >
          <form onSubmit={matchInvoice} className="space-y-3">
            <p className="text-xs text-neutral-500">
              {Number(showMatch.amount) > 0 ? 'Match to AR invoice' : 'Match to AP bill'}
            </p>
            <Field label="Invoice" required>
              <select
                required
                value={matchInvoiceId}
                onChange={(e) => setMatchInvoiceId(e.target.value)}
                className="input"
              >
                <option value="">Select open invoice…</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} · {inv.counterparty_name} · bal{' '}
                    {formatMoney(inv.balance_due)}
                  </option>
                ))}
              </select>
            </Field>
            {invoices.length === 0 && (
              <p className="text-xs text-amber-800">
                No open {Number(showMatch.amount) > 0 ? 'AR' : 'AP'} invoices. Create one first or
                allocate to GL instead.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary !py-2 !px-4 text-sm" onClick={() => setShowMatch(null)}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !matchInvoiceId}
                className="btn-primary !py-2 !px-4 text-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Match & pay'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e5e5e5;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          background: white;
        }
        .input:focus {
          outline: none;
          border-color: #00b4d8;
          box-shadow: 0 0 0 3px rgba(0, 180, 216, 0.12);
        }
      `}</style>
    </AccountingPage>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="p-1.5 rounded-lg border border-neutral-200 hover:border-[#00b4d8] hover:text-[#0077b6] text-neutral-500 transition-colors"
    >
      {children}
    </button>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div
        className={`bg-white rounded-3xl shadow-xl w-full max-h-[90vh] overflow-y-auto ${
          wide ? 'max-w-2xl' : 'max-w-md'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
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
