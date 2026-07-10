'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, Upload, AlertTriangle, CalendarRange } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { formatMoney } from '@/lib/accounting/types';
import {
  fiscalYearLabel,
  fiscalYearMonths,
  fiscalYearQuarters,
  resolvePeriodPreset,
  type PeriodPreset,
} from '@/lib/accounting/fiscal';
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

type ViewMode = 'month' | 'quarter' | 'ytd';

const INITIAL = resolvePeriodPreset('this_month');

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

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [preset, setPreset] = useState<PeriodPreset>(INITIAL.preset);
  const [from, setFrom] = useState(INITIAL.from);
  const [to, setTo] = useState(INITIAL.to);
  const [periodLabel, setPeriodLabel] = useState(INITIAL.label);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<MgmtSummary | null>(null);
  const [income, setIncome] = useState<LineRow[]>([]);
  const [cogs, setCogs] = useState<LineRow[]>([]);
  const [expenses, setExpenses] = useState<LineRow[]>([]);

  const fyLabel = useMemo(() => fiscalYearLabel(new Date()), []);
  const fyMonths = useMemo(() => fiscalYearMonths(new Date()), []);
  const fyQuarters = useMemo(() => fiscalYearQuarters(new Date()), []);

  const applyPreset = useCallback((p: Exclude<PeriodPreset, 'custom'>) => {
    const range = resolvePeriodPreset(p);
    setPreset(range.preset);
    setFrom(range.from);
    setTo(range.to);
    setPeriodLabel(range.label);
  }, []);

  const applyCustomRange = useCallback((nextFrom: string, nextTo: string, label: string) => {
    setPreset('custom');
    setFrom(nextFrom);
    setTo(nextTo);
    setPeriodLabel(label);
  }, []);

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

  const activeMonthKey = `${from}_${to}`;

  return (
    <AccountingPage>
      <AccountingHeader
        title="Management"
        titleAccent="accounts"
        description="Period P&L from posted journals (including bank allocations). Financial year runs March → February."
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

      {/* Period controls */}
      <Panel className="mb-6">
        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <CalendarRange className="w-4 h-4 text-[#00b4d8]" />
              <span className="font-bold text-slate-900">{periodLabel}</span>
              <span className="text-xs text-neutral-400 tabular-nums">
                {from} → {to}
              </span>
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              FY {fyLabel} · Mar–Feb
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'month' as const, label: 'Month' },
                { id: 'quarter' as const, label: 'Quarter' },
                { id: 'ytd' as const, label: 'YTD / FY' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setViewMode(m.id);
                  if (m.id === 'month') applyPreset('this_month');
                  else if (m.id === 'quarter') applyPreset('this_quarter');
                  else applyPreset('ytd');
                }}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors ${
                  viewMode === m.id
                    ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Quick presets for current mode */}
          {viewMode === 'month' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={preset === 'this_month'}
                  onClick={() => applyPreset('this_month')}
                  label="This month"
                />
                <Chip
                  active={preset === 'last_month'}
                  onClick={() => applyPreset('last_month')}
                  label="Last month"
                />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                  Months in FY {fyLabel}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {fyMonths.map((m) => {
                    const active = activeMonthKey === `${m.from}_${m.to}`;
                    return (
                      <button
                        key={m.from}
                        type="button"
                        onClick={() =>
                          applyCustomRange(
                            m.from,
                            m.to,
                            `${m.label} ${m.from.slice(0, 4) === m.to.slice(0, 4) ? m.from.slice(0, 4) : m.from.slice(0, 4) + '/' + m.to.slice(2, 4)}`
                          )
                        }
                        className={`min-w-[3rem] text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-colors ${
                          active
                            ? 'border-[#00b4d8] bg-[#00b4d8]/10 text-[#0077b6]'
                            : m.isCurrent
                              ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
                              : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/40'
                        }`}
                        title={`${m.from} → ${m.to}`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {viewMode === 'quarter' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={preset === 'this_quarter'}
                  onClick={() => applyPreset('this_quarter')}
                  label="This quarter"
                />
                <Chip
                  active={preset === 'last_quarter'}
                  onClick={() => applyPreset('last_quarter')}
                  label="Last quarter"
                />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                  Quarters in FY {fyLabel}
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {fyQuarters.map((q) => {
                    const active = activeMonthKey === `${q.from}_${q.to}`;
                    return (
                      <button
                        key={q.quarter}
                        type="button"
                        onClick={() =>
                          applyCustomRange(q.from, q.to, `FY ${fyLabel} ${q.label}`)
                        }
                        className={`text-left rounded-2xl border px-3 py-3 transition-colors ${
                          active
                            ? 'border-[#00b4d8] bg-[#00b4d8]/10 shadow-sm'
                            : q.isCurrent
                              ? 'border-emerald-200 bg-emerald-50/40'
                              : 'border-neutral-200 bg-white hover:border-[#00b4d8]/40'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900">{q.label}</div>
                        <div className="text-[10px] text-neutral-400 mt-1 tabular-nums">
                          {q.from} → {q.to}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {viewMode === 'ytd' && (
            <div className="flex flex-wrap gap-2">
              <Chip
                active={preset === 'ytd'}
                onClick={() => applyPreset('ytd')}
                label="YTD (1 Mar → today)"
              />
              <Chip
                active={preset === 'full_fy'}
                onClick={() => applyPreset('full_fy')}
                label={`Full FY ${fyLabel}`}
              />
              <Chip
                active={periodLabel.startsWith('Full FY') && preset === 'custom'}
                onClick={() => {
                  // Day before current FY start → lands in prior FY
                  const currentStart = resolvePeriodPreset('full_fy').from;
                  const [y, m, d] = currentStart.split('-').map(Number);
                  const lastDayPrior = new Date(y, m - 1, d);
                  lastDayPrior.setDate(lastDayPrior.getDate() - 1);
                  const prior = resolvePeriodPreset('full_fy', lastDayPrior);
                  applyCustomRange(prior.from, prior.to, prior.label);
                }}
                label="Prior FY"
              />
            </div>
          )}

          {/* Custom date override always available */}
          <div className="flex flex-wrap gap-3 items-end pt-1 border-t border-neutral-100">
            <label className="text-xs font-semibold text-neutral-600">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPreset('custom');
                  setPeriodLabel('Custom period');
                }}
                className="mt-1 block rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-neutral-600">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPreset('custom');
                  setPeriodLabel('Custom period');
                }}
                className="mt-1 block rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              className="text-xs font-semibold text-[#00b4d8] hover:underline pb-2"
              onClick={() => void load()}
            >
              Apply dates
            </button>
          </div>
        </div>
      </Panel>

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
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                {periodLabel}
              </div>
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
            Financial year: 1 March – 28/29 February. Built from posted double-entry journals.
            Import bank PDF → mass-allocate to GL → figures update here.
          </p>
        </>
      )}
    </AccountingPage>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
          : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/50'
      }`}
    >
      {label}
    </button>
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
