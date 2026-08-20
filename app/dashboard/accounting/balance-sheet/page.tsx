'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  PieChart,
  Printer,
  RefreshCw,
  Scale,
} from 'lucide-react';
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
import { GaapDisclaimer } from '@/components/accounting/GaapDisclaimer';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import {
  BalanceCompositionChart,
  ChartCard,
  MixDoughnut,
} from '@/components/accounting/AccountingCharts';
import {
  SOFP_POLICIES,
  type BalanceSheetCompleteness,
  type BalanceSheetRow,
  type BalanceSheetSummary,
} from '@/lib/accounting/statement-types';

export default function BalanceSheetPage() {
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
  const [fyStartMonth, setFyStartMonth] = useState(3);
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('full_fy', 3)
  );
  const [summary, setSummary] = useState<BalanceSheetSummary | null>(null);
  const [rows, setRows] = useState<BalanceSheetRow[]>([]);
  const [completeness, setCompleteness] = useState<BalanceSheetCompleteness[]>(
    []
  );
  const [asAt, setAsAt] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ companyId: String(companyId) });
        if (privyUserId) params.set('privyUserId', privyUserId);
        const res = await fetch(`/api/accounting/settings?${params}`);
        const data = await res.json();
        const sm = Number(data.settings?.fiscal_year_start_month || 3);
        if (!cancelled && sm >= 1 && sm <= 12) {
          setFyStartMonth(sm);
          setPeriod((prev) =>
            prev.preset === 'full_fy'
              ? initialPeriodSlicerValue('full_fy', sm)
              : prev
          );
        }
      } catch {
        /* soft */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, privyUserId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        report: 'balance_sheet',
        to: period.to,
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/accounting/reports?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to compile balance sheet');
      setSummary((data.summary as BalanceSheetSummary) || null);
      setRows((data.rows as BalanceSheetRow[]) || []);
      setCompleteness(
        (data.completeness as BalanceSheetCompleteness[]) || []
      );
      setAsAt(String(data.period?.to || period.to));
      setWarning(data.warning ? String(data.warning) : null);
      if (data.warning) toast.message(data.warning);
    } catch (err) {
      setSummary(null);
      setRows([]);
      setCompleteness([]);
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, period.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const money = (n: number) => formatMoney(n, 'ZAR', { compact: false });
  const workingCapital = summary
    ? summary.currentAssets - summary.currentLiabilities
    : 0;

  return (
    <AccountingPage>
      <style>{`
        @media print {
          nav, aside, header, .print\\:hidden { display: none !important; }
          body { background: white !important; }
          section { break-inside: avoid; }
        }
        @page { margin: 16mm; }
      `}</style>
      <div className="print:hidden">
        <AccountingHeader
          title="Statement of"
          titleAccent="financial position"
          description="IAS 1 balance sheet as at the period end. All posted journals through that date. Unaudited."
          action={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void load()}
                className="btn-secondary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Print / PDF
              </button>
            </div>
          }
        />
        <div className="mb-4">
          <PeriodSlicer
            value={period}
            fyStartMonth={fyStartMonth}
            onChange={setPeriod}
          />
        </div>
        <GaapDisclaimer className="mb-4" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : !summary ? (
        <p className="text-sm text-slate-500">
          No statement of financial position for this date
          {warning ? ` — ${warning}` : '.'}
        </p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Assets" value={money(summary.assets)} />
            <Stat label="Liabilities" value={money(summary.liabilities)} />
            <Stat label="Equity" value={money(summary.equity)} />
            <Stat
              label="Equation"
              value={summary.balanced ? 'Balanced' : 'Review'}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Current assets"
              value={money(summary.currentAssets)}
            />
            <Stat
              label="Current liabilities"
              value={money(summary.currentLiabilities)}
            />
            <Stat label="Working capital" value={money(workingCapital)} />
            <Stat
              label="Unclosed profit / (loss)"
              value={money(summary.netIncome)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 print:hidden">
            <ChartCard
              title="Composition"
              subtitle="Assets · liabilities · equity"
              icon={Scale}
              height={240}
            >
              <BalanceCompositionChart
                assets={summary.assets}
                liabilities={summary.liabilities}
                equity={summary.equity}
              />
            </ChartCard>
            <ChartCard
              title="Asset mix"
              subtitle="Largest asset accounts"
              icon={PieChart}
              height={240}
            >
              <MixDoughnut
                segments={rows
                  .filter((r) => r.account_type === 'asset')
                  .slice(0, 8)
                  .map((r) => ({
                    label: r.name.slice(0, 22),
                    value: r.amount,
                  }))}
                centerLabel="Assets"
                centerValue={money(summary.assets)}
              />
            </ChartCard>
          </div>

          <Panel className="p-4 sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Statement of financial position · as at {asAt || period.to}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Classified current / non-current (IAS 1.60). Amounts in ZAR.
              Issued invoices sit in trade receivables until collected — revenue
              is on the{' '}
              <Link
                href="/dashboard/accounting/reports?report=pnl"
                className="font-semibold text-[#0077b6] hover:underline"
              >
                income statement
              </Link>
              .
            </p>

            <SofpBlock
              title="Assets"
              sections={['current_assets', 'non_current_assets']}
              rows={rows}
              total={summary.assets}
              money={money}
            />
            <SofpBlock
              title="Liabilities"
              sections={['current_liabilities', 'non_current_liabilities']}
              rows={rows}
              total={summary.liabilities}
              money={money}
            />
            <SofpBlock
              title="Equity"
              sections={['equity']}
              rows={rows}
              total={summary.equity}
              money={money}
              extra={
                summary.netIncome !== 0
                  ? {
                      code: 'NI',
                      name: 'Unclosed profit / (loss) to reporting date',
                      amount: summary.netIncome,
                    }
                  : null
              }
            />
            <div className="mt-4 space-y-1 border-t-2 border-slate-800 pt-3 text-sm">
              <Row
                name="Total assets"
                amount={summary.assets}
                money={money}
                bold
              />
              <Row
                name="Total equity and liabilities"
                amount={summary.liabilities + summary.equity}
                money={money}
                bold
              />
              <p
                className={`pt-1 text-xs ${
                  summary.balanced ? 'text-emerald-800' : 'text-amber-800'
                }`}
              >
                {summary.balanced
                  ? 'Assets = equity + liabilities.'
                  : `Out of balance by ${money(
                      summary.assets - (summary.liabilities + summary.equity)
                    )} — review journals.`}
              </p>
            </div>
          </Panel>

          {completeness.length > 0 ? (
            <Panel className="p-4 sm:p-5 print:hidden">
              <SectionLabel>Allocation completeness</SectionLabel>
              <ul className="mt-2 space-y-2">
                {completeness.map((c) => (
                  <li
                    key={c.key}
                    className={`flex flex-wrap items-start gap-2 rounded-xl border px-3 py-2 text-[12px] ${
                      c.ok
                        ? 'border-emerald-100 bg-emerald-50/60 text-emerald-950'
                        : 'border-amber-100 bg-amber-50/70 text-amber-950'
                    }`}
                  >
                    <span className="shrink-0 font-bold">
                      {c.ok ? '✓' : '!'} {c.label}
                    </span>
                    <span className="text-[11px] opacity-90">{c.detail}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-slate-500">
                <Link
                  href="/dashboard/accounting/fixed-assets"
                  className="font-semibold text-[#00b4d8] hover:underline"
                >
                  Fixed assets
                </Link>
                {' · '}
                <Link
                  href="/dashboard/accounting/reports?report=balance_sheet"
                  className="font-semibold text-[#00b4d8] hover:underline"
                >
                  Reports tab
                </Link>
                {' · '}
                <Link
                  href="/dashboard/accounting/afs"
                  className="font-semibold text-[#00b4d8] hover:underline"
                >
                  Full AFS pack
                </Link>
              </p>
            </Panel>
          ) : null}

          <Panel className="p-4 sm:p-5">
            <SectionLabel>Accounting policies — financial position</SectionLabel>
            <ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed text-slate-700">
              {SOFP_POLICIES.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </AccountingPage>
  );
}

function SofpBlock({
  title,
  sections,
  rows,
  total,
  money,
  extra,
}: {
  title: string;
  sections: readonly string[];
  rows: BalanceSheetRow[];
  total: number;
  money: (n: number) => string;
  extra?: { code: string; name: string; amount: number } | null;
}) {
  return (
    <div className="mt-5">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-800">
        {title}
      </p>
      {sections.map((sec) => {
        const secRows = rows.filter((r) => r.section === sec);
        if (!secRows.length && !(sec === 'equity' && extra)) return null;
        const label =
          secRows[0]?.section_label ||
          sec.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const subtotal =
          secRows.reduce((s, r) => s + r.amount, 0) +
          (sec === 'equity' && extra ? extra.amount : 0);
        return (
          <div key={sec} className="ml-1 mt-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {label}
            </p>
            {secRows.map((r) => (
              <Row
                key={r.id}
                name={`${r.code}  ${r.name}`}
                amount={r.amount}
                money={money}
              />
            ))}
            {sec === 'equity' && extra ? (
              <Row name={`${extra.code}  ${extra.name}`} amount={extra.amount} money={money} />
            ) : null}
            <Row name={`Total ${label.toLowerCase()}`} amount={subtotal} money={money} bold />
          </div>
        );
      })}
      <div className="mt-1 border-t border-slate-200 pt-1">
        <Row name={`Total ${title.toLowerCase()}`} amount={total} money={money} bold />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-black tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}

function Row({
  name,
  amount,
  money,
  bold,
}: {
  name: string;
  amount: number;
  money: (n: number) => string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-0.5 text-sm ${
        bold ? 'font-black' : ''
      }`}
    >
      <span className={bold ? 'text-slate-900' : 'text-slate-700'}>{name}</span>
      <span className="shrink-0 tabular-nums">{money(amount)}</span>
    </div>
  );
}
