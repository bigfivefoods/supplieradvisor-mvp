'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, Upload, AlertTriangle } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { formatMoney } from '@/lib/accounting/types';
import {
  AccountingHeader,
  AccountingPage,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel, SectionLabel } from '@/components/relationship/RelationshipChrome';

type MgmtSummary = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  operatingProfit: number;
  netIncome: number;
  journalCount: number;
  bankLines: number;
  bankIn: number;
  bankOut: number;
  unallocated: number;
  unallocatedIn: number;
  unallocatedOut: number;
  allocatedCount: number;
};

type LineRow = {
  id: number;
  code: string;
  name: string;
  account_type: string;
  amount: number;
};

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function monthEnd() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export default function ManagementAccountsPage() {
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
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(monthEnd);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<MgmtSummary | null>(null);
  const [income, setIncome] = useState<LineRow[]>([]);
  const [cogs, setCogs] = useState<LineRow[]>([]);
  const [expenses, setExpenses] = useState<LineRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        report: 'management_accounts',
        from,
        to,
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/accounting/reports?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSummary(data.summary || null);
      setIncome(data.income || []);
      setCogs(data.cogs || []);
      setExpenses(data.expenses || []);
      if (data.warning) toast.message(data.warning);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AccountingPage>
      <AccountingHeader
        title="Management"
        titleAccent="accounts"
        description="Period P&L from posted journals (including bank allocations). Clear unallocated bank lines to keep these numbers complete."
        action={
          <>
            <Link
              href="/dashboard/accounting/bank-reconciliation"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              <Upload className="w-4 h-4" /> Bank import
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </>
        }
      />

      <div className="flex flex-wrap gap-3 mb-6">
        <label className="text-xs font-semibold text-neutral-600">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="ml-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-neutral-600">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="ml-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          className="text-xs font-semibold text-[#00b4d8] hover:underline self-end pb-2"
          onClick={() => {
            setFrom(monthStart());
            setTo(monthEnd());
          }}
        >
          This month
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          {(summary?.unallocated || 0) > 0 && (
            <Link
              href="/dashboard/accounting/bank-reconciliation"
              className="mb-6 flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950 hover:bg-amber-100/80"
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">
                  {summary?.unallocated} bank line
                  {summary?.unallocated === 1 ? '' : 's'} still unallocated
                </div>
                <div className="text-xs mt-1 opacity-90">
                  In {formatMoney(summary?.unallocatedIn ?? 0)} · Out{' '}
                  {formatMoney(summary?.unallocatedOut ?? 0)} — allocate to income/expense so P&L
                  is complete.
                </div>
              </div>
            </Link>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <Kpi label="Revenue" value={formatMoney(summary?.revenue ?? 0)} tone="emerald" />
            <Kpi label="Gross profit" value={formatMoney(summary?.grossProfit ?? 0)} />
            <Kpi label="Expenses" value={formatMoney(summary?.expenses ?? 0)} />
            <Kpi
              label="Operating profit"
              value={formatMoney(summary?.operatingProfit ?? 0)}
              tone={(summary?.operatingProfit ?? 0) >= 0 ? 'emerald' : 'amber'}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-3 mb-8">
            <Kpi label="Bank in (period)" value={formatMoney(summary?.bankIn ?? 0)} />
            <Kpi label="Bank out (period)" value={formatMoney(summary?.bankOut ?? 0)} />
            <Kpi
              label="Journals posted"
              value={String(summary?.journalCount ?? 0)}
              sub={`${summary?.allocatedCount ?? 0} bank-allocated`}
            />
          </div>

          <SectionLabel>Income</SectionLabel>
          <AccountTable rows={income} empty="No income posted in this period" />

          {cogs.length > 0 && (
            <>
              <SectionLabel>Cost of sales</SectionLabel>
              <AccountTable rows={cogs} empty="" />
            </>
          )}

          <SectionLabel>Operating expenses</SectionLabel>
          <AccountTable rows={expenses} empty="No expenses posted in this period" />

          <Panel className="mt-6">
            <div className="px-5 py-5 space-y-2 text-sm">
              <Row label="Revenue" value={formatMoney(summary?.revenue ?? 0)} />
              <Row label="Cost of sales" value={formatMoney(summary?.cogs ?? 0)} />
              <Row label="Gross profit" value={formatMoney(summary?.grossProfit ?? 0)} bold />
              <Row label="Operating expenses" value={formatMoney(summary?.expenses ?? 0)} />
              <div className="border-t border-neutral-100 pt-2">
                <Row
                  label="Net / operating profit"
                  value={formatMoney(summary?.netIncome ?? 0)}
                  bold
                  accent
                />
              </div>
            </div>
          </Panel>

          <p className="mt-6 text-[11px] text-neutral-400 text-center max-w-xl mx-auto">
            Built from posted double-entry journals. Import bank CSV → allocate each line to a GL
            account → figures update here. Match customer receipts / supplier payments to invoices
            when appropriate.
          </p>
        </>
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
      <div className="text-xl font-black tabular-nums text-slate-900">{value}</div>
      {sub && <div className="text-[11px] text-neutral-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function AccountTable({ rows, empty }: { rows: LineRow[]; empty: string }) {
  if (rows.length === 0) {
    return (
      <Panel className="mb-6">
        <div className="px-6 py-8 text-center text-sm text-neutral-500">{empty}</div>
      </Panel>
    );
  }
  return (
    <Panel className="mb-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
              <th className="px-4 py-3 font-semibold">Code</th>
              <th className="px-4 py-3 font-semibold">Account</th>
              <th className="px-4 py-3 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-neutral-50/80">
                <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-700">
                  {r.code}
                </td>
                <td className="px-4 py-2.5 text-slate-800">{r.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                  {formatMoney(r.amount)}
                </td>
              </tr>
            ))}
            <tr className="bg-neutral-50/80">
              <td colSpan={2} className="px-4 py-2.5 font-bold text-slate-900">
                Total
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums font-black">
                {formatMoney(rows.reduce((s, r) => s + Number(r.amount), 0))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className={bold ? 'font-bold text-slate-900' : 'text-neutral-600'}>{label}</span>
      <span
        className={`tabular-nums ${
          accent ? 'font-black text-[#0077b6] text-lg' : bold ? 'font-bold' : 'font-medium'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
