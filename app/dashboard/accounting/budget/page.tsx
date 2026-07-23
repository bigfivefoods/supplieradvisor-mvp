'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Save, Copy, RefreshCw, CalendarRange } from 'lucide-react';
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
import { Panel } from '@/components/relationship/RelationshipChrome';
import {
  MONTH_KEYS,
  type FyMonthColumn,
  type MonthKey,
  sumBudgetMonths,
  fiscalYearStartYear,
  normalizeFyStartMonth,
} from '@/lib/accounting/budget';
import { MONTH_LONG } from '@/lib/accounting/fiscal';

type BudgetRow = {
  account_id: number;
  code: string;
  name: string;
  account_type: string;
  m01: number;
  m02: number;
  m03: number;
  m04: number;
  m05: number;
  m06: number;
  m07: number;
  m08: number;
  m09: number;
  m10: number;
  m11: number;
  m12: number;
  annual_total: number;
};

const TYPE_FILTERS = [
  { value: 'all', label: 'All P&L' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'cogs', label: 'COGS' },
  { value: 'expense', label: 'Expenses' },
];

function isPnlType(t: string) {
  const x = t.toLowerCase();
  return (
    x === 'revenue' ||
    x === 'income' ||
    x === 'sales' ||
    x === 'cogs' ||
    x === 'cost_of_sales' ||
    x === 'expense' ||
    x === 'expenses' ||
    x === 'opex'
  );
}

export default function BudgetPage() {
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

  const [year, setYear] = useState(() => fiscalYearStartYear(new Date(), 3));
  const [fyStartMonth, setFyStartMonth] = useState(3);
  const [fyLabel, setFyLabel] = useState('');
  const [fyRangeLabel, setFyRangeLabel] = useState('');
  const [monthColumns, setMonthColumns] = useState<FyMonthColumn[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [dirty, setDirty] = useState<Record<number, Partial<BudgetRow>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingFy, setSavingFy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [yearReady, setYearReady] = useState(false);

  // Bootstrap current FY year from company settings once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ companyId: String(companyId) });
        if (privyUserId) params.set('privyUserId', privyUserId);
        const res = await fetch(`/api/accounting/settings?${params}`);
        const data = await res.json();
        const sm = normalizeFyStartMonth(
          data.settings?.fiscal_year_start_month
        );
        if (!cancelled) {
          setFyStartMonth(sm);
          setYear(fiscalYearStartYear(new Date(), sm));
          setYearReady(true);
        }
      } catch {
        if (!cancelled) setYearReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, privyUserId]);

  const load = useCallback(async () => {
    if (!yearReady) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        year: String(year),
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/accounting/budgets?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      const list = (data.rows || []).filter((r: BudgetRow) =>
        isPnlType(String(r.account_type || ''))
      );
      setRows(list);
      setDirty({});
      setWarning(data.warning || null);
      if (data.fiscalYearStartMonth) {
        setFyStartMonth(Number(data.fiscalYearStartMonth));
      }
      setFyLabel(data.fyLabel || String(year));
      setFyRangeLabel(data.fyRangeLabel || '');
      setMonthColumns(
        Array.isArray(data.monthColumns) ? data.monthColumns : []
      );
      if (data.hint && data.warning) {
        toast.message(data.warning, { description: data.hint });
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load budget');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, year, privyUserId, yearReady]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayRows = useMemo(() => {
    return rows
      .map((r) => {
        const d = dirty[r.account_id];
        return d ? { ...r, ...d } : r;
      })
      .filter((r) => {
        if (typeFilter === 'all') return true;
        const t = String(r.account_type || '').toLowerCase();
        if (typeFilter === 'revenue') {
          return t === 'revenue' || t === 'income' || t === 'sales';
        }
        if (typeFilter === 'cogs') {
          return t === 'cogs' || t === 'cost_of_sales';
        }
        return t === 'expense' || t === 'expenses' || t === 'opex';
      });
  }, [rows, dirty, typeFilter]);

  const headers: FyMonthColumn[] =
    monthColumns.length === 12
      ? monthColumns
      : MONTH_KEYS.map((key, i) => ({
          key,
          shortLabel: String(i + 1),
          label: `P${i + 1}`,
          period: i + 1,
          calendarMonth: i + 1,
          calendarYear: year,
        }));

  function setCell(accountId: number, key: MonthKey, value: string) {
    const n = value === '' || value === '-' ? 0 : Number(value);
    if (!Number.isFinite(n)) return;
    setDirty((prev) => {
      const base = rows.find((r) => r.account_id === accountId) || {
        account_id: accountId,
      };
      const merged = { ...base, ...prev[accountId], [key]: n };
      const annual = sumBudgetMonths(merged as BudgetRow);
      return {
        ...prev,
        [accountId]: { ...prev[accountId], [key]: n, annual_total: annual },
      };
    });
  }

  function setAnnualSpread(accountId: number, annualStr: string) {
    const annual = Number(annualStr);
    if (!Number.isFinite(annual)) return;
    const each = Math.round((annual / 12) * 100) / 100;
    const months: Partial<BudgetRow> = {};
    let sum = 0;
    MONTH_KEYS.forEach((k, i) => {
      if (i < 11) {
        months[k] = each;
        sum += each;
      } else {
        months[k] = Math.round((annual - sum) * 100) / 100;
      }
    });
    months.annual_total = annual;
    setDirty((prev) => ({
      ...prev,
      [accountId]: { ...prev[accountId], ...months },
    }));
  }

  async function save() {
    const ids = Object.keys(dirty).map(Number);
    if (!ids.length) {
      toast.message('No changes to save');
      return;
    }
    setSaving(true);
    try {
      const payloadRows = ids.map((id) => {
        const base = rows.find((r) => r.account_id === id)!;
        const d = dirty[id];
        const merged = { ...base, ...d };
        const out: Record<string, unknown> = { account_id: id };
        for (const k of MONTH_KEYS) out[k] = Number(merged[k] || 0);
        return out;
      });
      const res = await fetch('/api/accounting/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          year,
          rows: payloadRows,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(`Saved ${data.saved} account budget(s)`);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function copyPriorYear() {
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          year,
          action: 'copy_year',
          fromYear: year - 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Copy failed');
      toast.success(`Copied ${data.copied || 0} lines from FY ${year - 1}`);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Copy failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveFyStart(month: number) {
    const m = normalizeFyStartMonth(month);
    setSavingFy(true);
    try {
      const res = await fetch('/api/accounting/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          year,
          action: 'set_fy_start',
          fiscalYearStartMonth: m,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to set financial year');
      setFyStartMonth(m);
      toast.success(
        `Financial year starts in ${MONTH_LONG[m - 1]}. Columns updated.`
      );
      // Keep same FY start year; reload columns
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSavingFy(false);
    }
  }

  const dirtyCount = Object.keys(dirty).length;
  const yearTotal = displayRows.reduce(
    (s, r) => s + Number(r.annual_total || sumBudgetMonths(r)),
    0
  );

  return (
    <AccountingPage>
      <AccountingHeader
        title="Annual"
        titleAccent="budget"
        description="12-month plan aligned to your financial year. Drives budget vs actual in management accounts and reports."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/accounting/reports?report=budget_vs_actual"
              className="btn-secondary !py-2.5 !px-4 text-sm"
            >
              Plan vs actual
            </Link>
            <button
              type="button"
              disabled={saving}
              onClick={() => void copyPriorYear()}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <Copy className="w-4 h-4" /> Copy prior FY
            </button>
            <button
              type="button"
              disabled={saving || dirtyCount === 0}
              onClick={() => void save()}
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : `Save${dirtyCount ? ` (${dirtyCount})` : ''}`}
            </button>
          </div>
        }
      />

      {warning && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {warning}
          {warning.includes('accounting_budgets') || warning.includes('schema')
            ? ' — run supabase/migrations/20260723_accounting_budgets.sql'
            : ''}
        </div>
      )}

      {/* Financial year controls */}
      <Panel className="mb-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-4 sm:gap-6">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-700">
              <CalendarRange className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-700">
                Financial year
              </p>
              <p className="text-lg font-bold text-slate-900">
                FY {fyLabel || year}
              </p>
              {fyRangeLabel && (
                <p className="text-xs text-neutral-500 mt-0.5">{fyRangeLabel}</p>
              )}
            </div>
          </div>

          <label className="text-xs font-semibold text-neutral-600">
            FY starts in
            <select
              className="ml-0 mt-1 block w-full min-w-[10rem] rounded-xl border border-neutral-200 px-3 py-2 text-sm font-bold text-slate-900"
              value={fyStartMonth}
              disabled={savingFy}
              onChange={(e) => void saveFyStart(Number(e.target.value))}
            >
              {MONTH_LONG.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-neutral-600">
            Budget for FY starting
            <input
              type="number"
              className="ml-0 mt-1 block w-28 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-bold"
              value={year}
              min={2000}
              max={2100}
              onChange={(e) => setYear(Number(e.target.value))}
            />
            <span className="mt-1 block text-[10px] font-normal text-neutral-400">
              Calendar year the FY begins (e.g. 2026 for Mar 2026–Feb 2027)
            </span>
          </label>

          <div className="flex flex-wrap gap-1 items-end pb-1">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTypeFilter(t.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                  typeFilter === t.value
                    ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                {t.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          <div className="ml-auto text-sm font-semibold text-slate-600 self-center">
            FY total{' '}
            <span className="font-black text-slate-900 tabular-nums">
              {formatMoney(yearTotal)}
            </span>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-neutral-500">
          Columns are ordered by your financial year ({MONTH_LONG[fyStartMonth - 1]}{' '}
          → {MONTH_LONG[(fyStartMonth + 10) % 12]}). Change the start month any
          time under Accounting → Settings as well. Existing month amounts stay
          on the same period slots (m01 = first month of FY).
        </p>
      </Panel>

      <Panel className="!p-0 overflow-hidden">
        {loading || !yearReady ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : displayRows.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-neutral-500">
            No P&L accounts found. Seed the chart of accounts first.
            <div className="mt-3">
              <Link
                href="/dashboard/accounting/chart-of-accounts"
                className="font-bold text-[#00b4d8] underline"
              >
                Open Chart of Accounts
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] uppercase tracking-wider text-neutral-400">
                  <th className="sticky left-0 z-10 bg-slate-50 px-3 py-3 font-semibold">
                    Account
                  </th>
                  <th className="px-2 py-3 font-semibold text-right">Type</th>
                  {headers.map((col) => (
                    <th
                      key={col.key}
                      className="px-1 py-3 font-semibold text-right"
                      title={col.label}
                    >
                      <div>{col.shortLabel}</div>
                      <div className="font-normal normal-case tracking-normal text-[9px] text-neutral-400">
                        {String(col.calendarYear).slice(2)}
                      </div>
                    </th>
                  ))}
                  <th className="px-2 py-3 font-semibold text-right">FY total</th>
                  <th className="px-2 py-3 font-semibold text-right">
                    Spread
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {displayRows.map((r) => {
                  const isDirty = Boolean(dirty[r.account_id]);
                  return (
                    <tr
                      key={r.account_id}
                      className={`hover:bg-sky-50/40 ${isDirty ? 'bg-amber-50/40' : ''}`}
                    >
                      <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5">
                        <div className="font-mono text-[10px] text-neutral-400">
                          {r.code}
                        </div>
                        <div className="font-semibold text-slate-900 max-w-[160px] truncate">
                          {r.name}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right text-neutral-500 capitalize">
                        {r.account_type}
                      </td>
                      {MONTH_KEYS.map((k) => (
                        <td key={k} className="px-0.5 py-1">
                          <input
                            type="number"
                            step="0.01"
                            className="w-[4.5rem] rounded-lg border border-slate-200 bg-white px-1 py-1 text-right tabular-nums text-[11px] focus:border-[#00b4d8] focus:outline-none"
                            value={Number(r[k] || 0)}
                            onChange={(e) =>
                              setCell(r.account_id, k, e.target.value)
                            }
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right font-bold tabular-nums text-slate-900">
                        {formatMoney(
                          Number(r.annual_total || sumBudgetMonths(r))
                        )}
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          step="1"
                          placeholder="Annual"
                          title="Enter FY total to spread evenly across 12 periods"
                          className="w-[4.5rem] rounded-lg border border-dashed border-slate-300 bg-slate-50 px-1 py-1 text-right text-[11px]"
                          onBlur={(e) => {
                            if (e.target.value) {
                              setAnnualSpread(r.account_id, e.target.value);
                              e.target.value = '';
                            }
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="mt-3 text-[11px] text-neutral-500">
        Tip: use <strong>Spread</strong> for an even FY total. Yellow rows are
        unsaved. Plan vs actual uses the same financial year start (
        <Link
          href="/dashboard/accounting/settings"
          className="text-[#00b4d8] underline"
        >
          Accounting settings
        </Link>
        ).
      </p>
    </AccountingPage>
  );
}
