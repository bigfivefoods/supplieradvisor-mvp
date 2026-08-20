'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Plus,
  Sparkles,
  X,
  RefreshCw,
  Calculator,
  CheckSquare,
  Info,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { formatMoney, statusClass, type TaxRate } from '@/lib/accounting/types';
import { categoryLabel, type VatCategory } from '@/lib/accounting/vat';
import {
  AccountingHeader,
  AccountingPage,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel, SectionLabel } from '@/components/relationship/RelationshipChrome';
import { GaapDisclaimer } from '@/components/accounting/GaapDisclaimer';
import PeriodSlicer from '@/components/accounting/PeriodSlicer';
import { useAccountingPeriod } from '@/lib/accounting/use-period';
import { FinanceWorkspaceNote } from '@/components/accounting/FinanceWorkspaceNote';
import {
  ChartCard,
  MixDoughnut,
  VatIoTrendChart,
  VatTypeBarChart,
} from '@/components/accounting/AccountingCharts';

type RateRow = TaxRate & { category?: VatCategory | string };

type ReturnBox = {
  outputVat: number;
  inputVat: number;
  netVat: number;
  payableToSars: number;
  refundDue: number;
  standardRatedSales: number;
  standardRatedPurchases: number;
  zeroRatedSupplies: number;
  exemptSupplies: number;
  outOfScope: number;
};

type ByCode = {
  code: string;
  name: string;
  category: VatCategory;
  rate: number;
  outputVat: number;
  inputVat: number;
  outputNet: number;
  inputNet: number;
  count: number;
};

type Unclassified = {
  id: string | number;
  txn_date: string;
  description: string | null;
  amount: number;
  suggested_code: string;
  suggested_reason: string;
};

type VatTxn = {
  id: string | number;
  source: string;
  date?: string;
  ref?: string | null;
  counterparty?: string | null;
  net: number;
  vat: number;
  gross: number;
  tax_code: string;
  category: string;
  side: string;
  unclassified?: boolean;
  suggested_code?: string;
};

type VatMonth = { month: string; outputVat: number; inputVat: number };

type VatTypeFilter =
  | 'all'
  | VatCategory
  | 'unclassified';

export default function TaxPage() {
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

  const [rates, setRates] = useState<RateRow[]>([]);
  const [summary, setSummary] = useState<{
    outputVat: number;
    inputVat: number;
    netVat: number;
    invoiceCount: number;
    bankClassified: number;
    bankUnclassified: number;
  } | null>(null);
  const [returnBox, setReturnBox] = useState<ReturnBox | null>(null);
  const [byCode, setByCode] = useState<ByCode[]>([]);
  const [unclassified, setUnclassified] = useState<Unclassified[]>([]);
  const [transactions, setTransactions] = useState<VatTxn[]>([]);
  const [byMonth, setByMonth] = useState<VatMonth[]>([]);
  const [typeFilter, setTypeFilter] = useState<VatTypeFilter>('all');
  const [sideFilter, setSideFilter] = useState<'all' | 'input' | 'output'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'invoice' | 'bank'>('all');
  const [search, setSearch] = useState('');
  const [txnSelected, setTxnSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCode, setBulkCode] = useState('VAT15');
  const [taxInclusive, setTaxInclusive] = useState(true);

  const { fyStartMonth, period, setPeriod } = useAccountingPeriod(
    companyId,
    privyUserId,
    'this_quarter'
  );
  const from = period.from;
  const to = period.to;

  const [form, setForm] = useState({
    code: '',
    name: '',
    rate: '15',
    tax_type: 'vat',
    category: 'standard',
    is_default: false,
    is_recoverable: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`/api/accounting/tax?${params}`);
      const data = await res.json();
      setRates(data.rates || []);
      setSummary(data.summary || null);
      setReturnBox(data.returnBox || null);
      setByCode(data.byCode || []);
      setUnclassified(data.unclassified || []);
      setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
      setByMonth(Array.isArray(data.byMonth) ? data.byMonth : []);
      setSelected(new Set());
      setTxnSelected(new Set());
      if (data.warning) toast.message(data.warning, { description: data.hint });
    } catch {
      setRates([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  async function seed() {
    try {
      const res = await fetch('/api/accounting/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, seed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        data.seeded
          ? `Seeded ${data.seeded} VAT codes (standard / zero / exempt / out of scope)`
          : data.message || 'Done'
      );
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          code: form.code,
          name: form.name,
          rate: Number(form.rate),
          tax_type: form.tax_type,
          category: form.category,
          is_default: form.is_default,
          is_recoverable: form.is_recoverable,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Tax rate created');
      setShowModal(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function classifySelected(code?: string) {
    const ids = Array.from(selected);
    if (!ids.length) {
      toast.message('Select bank lines first');
      return;
    }
    setClassifying(true);
    try {
      const res = await fetch('/api/accounting/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'classify_bank',
          ids,
          tax_code: code || bulkCode,
          tax_inclusive: taxInclusive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Classified ${data.updated} line(s) as ${data.tax_code}`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setClassifying(false);
    }
  }

  async function autoClassify() {
    setClassifying(true);
    try {
      const res = await fetch('/api/accounting/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'auto_classify',
          from,
          to,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        data.updated
          ? `Auto-classified ${data.updated} bank lines (review codes)`
          : 'No unclassified lines found'
      );
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setClassifying(false);
    }
  }

  function toggleAllUnclassified() {
    if (selected.size === unclassified.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(unclassified.map((u) => String(u.id))));
    }
  }

  function toggleOne(id: string | number) {
    const key = String(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function txnKey(row: Pick<VatTxn, 'id' | 'source'>) {
    return `${row.source}-${row.id}`;
  }

  function toggleTxn(row: VatTxn) {
    const key = txnKey(row);
    setTxnSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function applyVatCode(
    rows: VatTxn[],
    taxCode: string,
    inclusive = taxInclusive
  ) {
    if (!rows.length) {
      toast.message('Select a transaction first');
      return;
    }
    setClassifying(true);
    try {
      const bankIds = rows.filter((r) => r.source === 'bank').map((r) => r.id);
      const invIds = rows.filter((r) => r.source === 'invoice').map((r) => r.id);
      let updated = 0;
      if (bankIds.length) {
        const res = await fetch('/api/accounting/tax', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            action: 'classify_bank',
            ids: bankIds,
            tax_code: taxCode,
            tax_inclusive: inclusive,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        updated += Number(data.updated || 0);
      }
      if (invIds.length) {
        const res = await fetch('/api/accounting/tax', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            action: 'classify_invoice',
            ids: invIds,
            tax_code: taxCode,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        updated += Number(data.updated || 0);
      }
      toast.success(`Reallocated ${updated} line(s) to ${taxCode}`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setClassifying(false);
    }
  }

  const typeOptions: Array<{ id: VatTypeFilter; label: string }> = [
    { id: 'all', label: 'All types' },
    { id: 'standard', label: 'Standard-rated' },
    { id: 'zero_rated', label: 'Zero-rated' },
    { id: 'exempt', label: 'Exempt' },
    { id: 'out_of_scope', label: 'Out of scope' },
    { id: 'unclassified', label: 'Unclassified' },
  ];

  const filteredTxns = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      const cat = String(t.category || (t.unclassified ? 'unclassified' : ''));
      if (typeFilter !== 'all' && cat !== typeFilter) return false;
      if (sideFilter !== 'all' && t.side !== sideFilter) return false;
      if (sourceFilter !== 'all' && t.source !== sourceFilter) return false;
      if (q) {
        const hay = `${t.ref || ''} ${t.counterparty || ''} ${t.tax_code || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, sideFilter, sourceFilter, search]);

  const monthLabels = byMonth.map((m) => {
    const [y, mo] = m.month.split('-');
    const d = new Date(Number(y), Number(mo) - 1, 1);
    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  });

  const rateOptions = rates.length
    ? rates
    : [
        { code: 'VAT15', name: 'Standard 15%', rate: 15, category: 'standard' },
        { code: 'VAT0', name: 'Zero-rated', rate: 0, category: 'zero_rated' },
        { code: 'EXEMPT', name: 'Exempt', rate: 0, category: 'exempt' },
        { code: 'OUT', name: 'Out of scope', rate: 0, category: 'out_of_scope' },
      ];

  return (
    <AccountingPage>
      <AccountingHeader
        title="Tax &"
        titleAccent="VAT"
        description="Filter every VAT line by type, reallocate a wrong code, and see input versus output VAT on the charts."
        action={
          <>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button type="button" onClick={() => void seed()} className="btn-secondary !py-2.5 !px-5 text-sm">
              <Sparkles className="w-4 h-4" /> Seed ZA VAT
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              <Plus className="w-4 h-4" /> Add rate
            </button>
          </>
        }
      />

      <div className="mb-4 print:hidden">
        <PeriodSlicer
          value={period}
          onChange={setPeriod}
          fyStartMonth={fyStartMonth}
        />
      </div>
      <GaapDisclaimer className="mb-2" />
      <FinanceWorkspaceNote className="mb-4" />

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          {/* VAT return box */}
          {returnBox && (
            <div className="mb-6 rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-sky-50/70 to-cyan-50/40 p-5 sm:p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0077b6] mb-1">
                    VAT return box
                  </div>
                  <h3 className="text-xl font-black tracking-tight text-slate-900">
                    Input · Output · Net for period
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-xl">
                    Output VAT from sales (AR + bank inflows). Input VAT from purchases (AP + bank
                    outflows) marked standard-rated & recoverable.
                  </p>
                </div>
                <div
                  className={`rounded-2xl border px-4 py-3 text-right ${
                    returnBox.netVat >= 0
                      ? 'border-amber-200 bg-amber-50/80'
                      : 'border-emerald-200 bg-emerald-50/80'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    {returnBox.netVat >= 0 ? 'Payable to SARS' : 'Refund due'}
                  </div>
                  <div className="text-2xl font-black tabular-nums text-slate-900">
                    {formatMoney(
                      returnBox.netVat >= 0 ? returnBox.payableToSars : returnBox.refundDue
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="Output VAT (sales)" value={formatMoney(returnBox.outputVat)} tone="amber" />
                <Kpi label="Input VAT (purchases)" value={formatMoney(returnBox.inputVat)} tone="emerald" />
                <Kpi label="Net VAT" value={formatMoney(returnBox.netVat)} />
                <Kpi
                  label="Std-rated sales (excl.)"
                  value={formatMoney(returnBox.standardRatedSales)}
                />
                <Kpi
                  label="Std-rated purchases (excl.)"
                  value={formatMoney(returnBox.standardRatedPurchases)}
                />
                <Kpi
                  label="Zero-rated supplies"
                  value={formatMoney(returnBox.zeroRatedSupplies)}
                />
                <Kpi label="Exempt supplies" value={formatMoney(returnBox.exemptSupplies)} />
                <Kpi label="Out of scope" value={formatMoney(returnBox.outOfScope)} />
              </div>
            </div>
          )}

          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <Kpi label="Invoices in period" value={String(summary.invoiceCount)} />
              <Kpi label="Bank lines classified" value={String(summary.bankClassified)} />
              <Kpi
                label="Bank lines to classify"
                value={String(summary.bankUnclassified)}
                tone={summary.bankUnclassified > 0 ? 'amber' : 'emerald'}
              />
              <Kpi
                label="VAT lines"
                value={String(transactions.length)}
                sub="Filter and reallocate below"
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <ChartCard
              title="Input vs output VAT"
              subtitle="Recoverable purchases versus VAT on sales"
              height={240}
            >
              <MixDoughnut
                segments={[
                  {
                    label: 'Output VAT',
                    value: returnBox?.outputVat || 0,
                    color: '#d97706',
                  },
                  {
                    label: 'Input VAT',
                    value: returnBox?.inputVat || 0,
                    color: '#059669',
                  },
                ]}
                centerLabel={
                  (returnBox?.netVat || 0) >= 0 ? 'Payable' : 'Refund'
                }
                centerValue={formatMoney(
                  Math.abs(returnBox?.netVat || 0)
                )}
              />
            </ChartCard>
            <ChartCard
              title="VAT by type"
              subtitle="Output and input on each tax code"
              height={240}
            >
              <VatTypeBarChart
                labels={byCode.map((b) => b.code)}
                output={byCode.map((b) => b.outputVat)}
                input={byCode.map((b) => b.inputVat)}
              />
            </ChartCard>
            <ChartCard
              title="VAT over the period"
              subtitle="Monthly input and output"
              height={240}
            >
              <VatIoTrendChart
                labels={monthLabels}
                output={byMonth.map((m) => m.outputVat)}
                input={byMonth.map((m) => m.inputVat)}
              />
            </ChartCard>
          </div>

          {/* How VAT works */}
          <div className="mb-6 flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600 leading-relaxed">
            <Info className="w-4 h-4 shrink-0 text-[#00b4d8] mt-0.5" />
            <div>
              <span className="font-bold text-slate-800">How to set this up · </span>
              <strong>1)</strong> Seed ZA VAT codes (15% / 0% / exempt / out of scope).{' '}
              <strong>2)</strong> On invoices, use tax rates per line (exclusive).{' '}
              <strong>3)</strong> On bank lines, set tax code — amounts are usually{' '}
              <em>VAT-inclusive</em> (we extract tax = amount × 15/115).{' '}
              <strong>4)</strong> Use Out of scope for salaries, transfers, loans.{' '}
              <strong>5)</strong> Net VAT = Output − Input (positive = pay SARS).
            </div>
          </div>

          {/* Classify bank transactions */}
          <SectionLabel
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={classifying}
                  onClick={() => void autoClassify()}
                  className="btn-secondary !py-1.5 !px-3 text-xs"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  {classifying ? 'Working…' : 'Auto-suggest all'}
                </button>
                <Link
                  href="/dashboard/accounting/bank-reconciliation"
                  className="text-xs font-semibold text-[#00b4d8] hover:underline inline-flex items-center gap-1"
                >
                  Bank import <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            }
          >
            Classify bank transactions
          </SectionLabel>

          <Panel className="mb-6">
            {unclassified.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-neutral-500">
                {rates.length === 0
                  ? 'Seed VAT codes first, then classify bank lines.'
                  : 'All bank lines in this period have a tax code — nice work.'}
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-neutral-100 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleAllUnclassified}
                    className="text-xs font-semibold text-slate-600 inline-flex items-center gap-1.5"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-[#00b4d8]" />
                    {selected.size === unclassified.length ? 'Clear selection' : 'Select all'}
                  </button>
                  <span className="text-[11px] text-neutral-400">
                    {selected.size} selected · {unclassified.length} unclassified
                  </span>
                  <div className="flex flex-wrap items-center gap-2 ml-auto">
                    <label className="text-[11px] font-semibold text-neutral-600 inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={taxInclusive}
                        onChange={(e) => setTaxInclusive(e.target.checked)}
                      />
                      Amount includes VAT
                    </label>
                    <select
                      value={bulkCode}
                      onChange={(e) => setBulkCode(e.target.value)}
                      className="rounded-xl border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold"
                    >
                      {rateOptions.map((r) => (
                        <option key={String(r.code)} value={String(r.code)}>
                          {r.code} — {r.name} ({r.rate}%)
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={classifying || !selected.size}
                      onClick={() => void classifySelected()}
                      className="btn-primary !py-1.5 !px-3 text-xs disabled:opacity-50"
                    >
                      Apply to selected
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                        <th className="px-3 py-2 w-10" />
                        <th className="px-3 py-2 font-semibold">Date</th>
                        <th className="px-3 py-2 font-semibold">Description</th>
                        <th className="px-3 py-2 font-semibold text-right">Amount</th>
                        <th className="px-3 py-2 font-semibold">Suggested</th>
                        <th className="px-3 py-2 font-semibold">Quick set</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {unclassified.map((u) => {
                        const key = String(u.id);
                        const on = selected.has(key);
                        return (
                          <tr key={key} className="hover:bg-neutral-50/80">
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggleOne(u.id)}
                              />
                            </td>
                            <td className="px-3 py-2 tabular-nums text-xs text-neutral-500 whitespace-nowrap">
                              {String(u.txn_date || '').slice(0, 10)}
                            </td>
                            <td className="px-3 py-2 text-slate-800 max-w-xs truncate">
                              {u.description || '—'}
                            </td>
                            <td
                              className={`px-3 py-2 text-right tabular-nums font-semibold ${
                                u.amount < 0 ? 'text-rose-700' : 'text-emerald-700'
                              }`}
                            >
                              {formatMoney(u.amount)}
                            </td>
                            <td className="px-3 py-2">
                              <div className="text-xs font-bold text-[#0077b6]">{u.suggested_code}</div>
                              <div className="text-[10px] text-neutral-400 max-w-[12rem] truncate">
                                {u.suggested_reason}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                {['VAT15', 'VAT0', 'EXEMPT', 'OUT'].map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => {
                                      setSelected(new Set([key]));
                                      setBulkCode(c);
                                      void (async () => {
                                        setClassifying(true);
                                        try {
                                          const res = await fetch('/api/accounting/tax', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              companyId,
                                              privyUserId,
                                              action: 'classify_bank',
                                              ids: [u.id],
                                              tax_code: c,
                                              tax_inclusive: taxInclusive,
                                            }),
                                          });
                                          const data = await res.json();
                                          if (!res.ok) throw new Error(data.error || 'Failed');
                                          toast.success(`${c} applied`);
                                          void load();
                                        } catch (err) {
                                          toast.error(
                                            err instanceof Error ? err.message : 'Failed'
                                          );
                                        } finally {
                                          setClassifying(false);
                                        }
                                      })();
                                    }}
                                    className="text-[10px] font-bold px-2 py-1 rounded-lg border border-neutral-200 hover:border-[#00b4d8] hover:text-[#0077b6]"
                                  >
                                    {c}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Panel>

          {/* By tax code */}
          <SectionLabel>Breakdown by tax code</SectionLabel>
          <Panel className="mb-6">
            {byCode.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-neutral-500">
                No classified VAT in this period yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                      <th className="px-4 py-3 font-semibold">Code</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold text-right">Rate</th>
                      <th className="px-4 py-3 font-semibold text-right">Output VAT</th>
                      <th className="px-4 py-3 font-semibold text-right">Input VAT</th>
                      <th className="px-4 py-3 font-semibold text-right">Sales excl.</th>
                      <th className="px-4 py-3 font-semibold text-right">Purch. excl.</th>
                      <th className="px-4 py-3 font-semibold text-right">Lines</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {byCode.map((b) => (
                      <tr key={b.code} className="hover:bg-neutral-50/80">
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold">{b.code}</td>
                        <td className="px-4 py-2.5 text-neutral-600">
                          {categoryLabel(b.category)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{b.rate}%</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                          {formatMoney(b.outputVat)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                          {formatMoney(b.inputVat)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {formatMoney(b.outputNet)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {formatMoney(b.inputNet)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{b.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* Tax rate table */}
          <SectionLabel>Tax rates / codes</SectionLabel>
          <Panel className="mb-6">
            {rates.length === 0 ? (
              <div className="px-6 py-14 text-center text-sm text-neutral-500">
                No tax rates. Seed standard ZA VAT (15% / 0% / exempt / out of scope) or add custom
                codes.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                      <th className="px-4 py-3 font-semibold">Code</th>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold text-right">Rate</th>
                      <th className="px-4 py-3 font-semibold">Recoverable</th>
                      <th className="px-4 py-3 font-semibold">Default</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {rates.map((r) => (
                      <tr key={r.id} className="hover:bg-neutral-50/80">
                        <td className="px-4 py-3 font-mono text-xs font-semibold">{r.code}</td>
                        <td className="px-4 py-3 text-slate-800">{r.name}</td>
                        <td className="px-4 py-3 text-neutral-600">
                          {categoryLabel((r.category as VatCategory) || 'standard')}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">
                          {r.rate}%
                        </td>
                        <td className="px-4 py-3">
                          {r.is_recoverable === false ? 'No' : 'Yes'}
                        </td>
                        <td className="px-4 py-3">{r.is_default ? 'Yes' : '—'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusClass(String(r.status || 'active'))}`}
                          >
                            {r.status || 'active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <SectionLabel
            action={
              <span className="text-[11px] text-neutral-500">
                {filteredTxns.length} of {transactions.length} lines
              </span>
            }
          >
            VAT transactions
          </SectionLabel>
          <Panel className="mb-6">
            <div className="px-4 py-3 border-b border-neutral-100 space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                {typeOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTypeFilter(opt.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                      typeFilter === opt.id
                        ? 'border-[#00b4d8] bg-sky-50 text-[#0077b6]'
                        : 'border-neutral-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={sideFilter}
                  onChange={(e) =>
                    setSideFilter(e.target.value as 'all' | 'input' | 'output')
                  }
                  className="rounded-xl border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold"
                >
                  <option value="all">Input & output</option>
                  <option value="output">Output (sales)</option>
                  <option value="input">Input (purchases)</option>
                </select>
                <select
                  value={sourceFilter}
                  onChange={(e) =>
                    setSourceFilter(e.target.value as 'all' | 'invoice' | 'bank')
                  }
                  className="rounded-xl border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold"
                >
                  <option value="all">Invoices & bank</option>
                  <option value="invoice">Invoices only</option>
                  <option value="bank">Bank only</option>
                </select>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search description or counterparty"
                  className="min-w-[12rem] flex-1 rounded-xl border border-neutral-200 px-3 py-1.5 text-xs"
                />
                <select
                  value={bulkCode}
                  onChange={(e) => setBulkCode(e.target.value)}
                  className="rounded-xl border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold"
                >
                  {rateOptions.map((r) => (
                    <option key={String(r.code)} value={String(r.code)}>
                      {r.code} — {r.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={classifying || txnSelected.size === 0}
                  onClick={() =>
                    void applyVatCode(
                      filteredTxns.filter((t) => txnSelected.has(txnKey(t))),
                      bulkCode
                    )
                  }
                  className="btn-primary !py-1.5 !px-3 text-xs disabled:opacity-50"
                >
                  Reallocate selected
                </button>
              </div>
              <p className="text-[11px] text-neutral-500">
                Change a wrong VAT type here. If a bank line is already posted to GL,{' '}
                <Link
                  href="/dashboard/accounting/bank-reconciliation"
                  className="font-semibold text-[#00b4d8] hover:underline"
                >
                  unallocate on Bank
                </Link>{' '}
                first so the journal is voided, then re-allocate.
              </p>
            </div>
            {filteredTxns.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-neutral-500">
                No VAT transactions match these filters.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[36rem] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white z-[1]">
                    <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                      <th className="px-3 py-2 w-10">
                        <input
                          type="checkbox"
                          checked={
                            filteredTxns.length > 0 &&
                            filteredTxns.every((t) => txnSelected.has(txnKey(t)))
                          }
                          onChange={() => {
                            if (
                              filteredTxns.every((t) =>
                                txnSelected.has(txnKey(t))
                              )
                            ) {
                              setTxnSelected(new Set());
                            } else {
                              setTxnSelected(
                                new Set(filteredTxns.map((t) => txnKey(t)))
                              );
                            }
                          }}
                        />
                      </th>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 font-semibold">Source</th>
                      <th className="px-3 py-2 font-semibold">Description</th>
                      <th className="px-3 py-2 font-semibold">Side</th>
                      <th className="px-3 py-2 font-semibold">Type</th>
                      <th className="px-3 py-2 font-semibold text-right">Net</th>
                      <th className="px-3 py-2 font-semibold text-right">VAT</th>
                      <th className="px-3 py-2 font-semibold">Reallocate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {filteredTxns.map((row) => {
                      const key = txnKey(row);
                      const cat = (row.category ||
                        (row.unclassified ? 'unclassified' : 'standard')) as
                        | VatCategory
                        | 'unclassified';
                      return (
                        <tr key={`${row.source}-${key}`} className="hover:bg-neutral-50/80">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={txnSelected.has(key)}
                              onChange={() => toggleTxn(row)}
                            />
                          </td>
                          <td className="px-3 py-2 tabular-nums text-xs whitespace-nowrap text-neutral-500">
                            {String(row.date || '').slice(0, 10)}
                          </td>
                          <td className="px-3 py-2 text-[10px] font-bold uppercase text-neutral-500">
                            {row.source}
                          </td>
                          <td className="px-3 py-2 max-w-[16rem] truncate text-slate-800">
                            {row.ref || row.counterparty || '—'}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`text-[10px] font-bold uppercase ${
                                row.side === 'output'
                                  ? 'text-amber-800'
                                  : 'text-emerald-800'
                              }`}
                            >
                              {row.side}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-mono text-xs font-semibold">
                              {row.tax_code || '—'}
                            </div>
                            <div className="text-[10px] text-neutral-400">
                              {cat === 'unclassified'
                                ? 'Unclassified'
                                : categoryLabel(cat)}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatMoney(Number(row.net || 0))}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">
                            {formatMoney(Number(row.vat || 0))}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              disabled={classifying}
                              value={row.tax_code || ''}
                              onChange={(e) => {
                                const next = e.target.value;
                                if (!next || next === row.tax_code) return;
                                void applyVatCode([row], next);
                              }}
                              className="max-w-[9rem] rounded-lg border border-neutral-200 px-2 py-1 text-[11px] font-semibold"
                            >
                              {!row.tax_code ? (
                                <option value="">Set type…</option>
                              ) : null}
                              {rateOptions.map((r) => (
                                <option key={String(r.code)} value={String(r.code)}>
                                  {r.code}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold">New tax rate</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={create} className="p-5 space-y-3">
              <label className="block text-xs font-semibold text-neutral-600">
                Code
                <input
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="VAT15"
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
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
                Rate %
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-neutral-600">
                Category
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  <option value="standard">Standard-rated (e.g. 15%)</option>
                  <option value="zero_rated">Zero-rated</option>
                  <option value="exempt">Exempt</option>
                  <option value="out_of_scope">Out of scope</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                <input
                  type="checkbox"
                  checked={form.is_recoverable}
                  onChange={(e) => setForm({ ...form, is_recoverable: e.target.checked })}
                />
                Input VAT recoverable
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                />
                Default rate
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn-secondary !py-2 !px-4 text-sm"
                  onClick={() => setShowModal(false)}
                >
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

function Kpi({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'emerald' | 'amber';
}) {
  const cls =
    tone === 'emerald'
      ? 'border-emerald-100 bg-emerald-50/40'
      : tone === 'amber'
        ? 'border-amber-100 bg-amber-50/40'
        : 'border-neutral-200 bg-white';
  return (
    <div className={`rounded-3xl border p-4 ${cls}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
        {label}
      </div>
      <div className="text-lg font-black tabular-nums text-slate-900">{value}</div>
      {sub && <div className="text-[11px] text-neutral-500 mt-0.5">{sub}</div>}
    </div>
  );
}
