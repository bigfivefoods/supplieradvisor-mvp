'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Printer, RefreshCw } from 'lucide-react';
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
import type { Ias7CashFlow, Ias7Line } from '@/lib/accounting/statement-types';

export default function CashFlowStatementPage() {
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
  const [statement, setStatement] = useState<Ias7CashFlow | null>(null);
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
        from: period.from,
        to: period.to,
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/accounting/cash-flow?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to compile cash flows');
      setStatement(data.statement || null);
      if (data.statement?.warning) toast.message(data.statement.warning);
    } catch (err) {
      setStatement(null);
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, period.from, period.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const money = (n: number) => formatMoney(n, 'ZAR', { compact: false });

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
          titleAccent="cash flows"
          description="IAS 7 / ASC 230. Direct method from the cash and bank general ledger, plus the required reconciliation of profit to operating cash. Unaudited."
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
      ) : !statement ? (
        <p className="text-sm text-slate-500">No cash-flow statement for this period.</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Operating" value={money(statement.netOperating)} />
            <Stat label="Investing" value={money(statement.netInvesting)} />
            <Stat label="Financing" value={money(statement.netFinancing)} />
            <Stat
              label="Net change in cash"
              value={money(statement.netChange)}
            />
          </div>

          <Panel className="p-4 sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Statement of cash flows · {statement.from} to {statement.to}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Direct method (IAS 7.18(a)). Amounts in ZAR.
            </p>
            <CashSection
              title="Cash flows from operating activities"
              rows={statement.operating}
              total={statement.netOperating}
              money={money}
            />
            <CashSection
              title="Cash flows from investing activities"
              rows={statement.investing}
              total={statement.netInvesting}
              money={money}
            />
            <CashSection
              title="Cash flows from financing activities"
              rows={statement.financing}
              total={statement.netFinancing}
              money={money}
            />
            <div className="mt-4 space-y-1 border-t-2 border-slate-800 pt-3 text-sm">
              <Row
                name="Net increase / (decrease) in cash and cash equivalents"
                amount={statement.netChange}
                money={money}
                bold
              />
              <Row
                name="Cash and cash equivalents at beginning of period"
                amount={statement.openingCash}
                money={money}
              />
              <Row
                name="Cash and cash equivalents at end of period"
                amount={statement.closingCash}
                money={money}
                bold
              />
              <Row
                name={
                  statement.reconciled
                    ? 'Opening + net change agrees to closing cash'
                    : `Review — implied close ${money(statement.impliedClose)} vs ledger ${money(statement.closingCash)}`
                }
                amount={statement.impliedClose}
                money={money}
              />
            </div>
          </Panel>

          {statement.indirect ? (
            <Panel className="p-4 sm:p-5">
              <SectionLabel>Reconciliation of profit to operating cash</SectionLabel>
              <p className="mb-3 text-xs text-slate-500">
                Indirect method (IAS 7.18(b); ASC 230 requires this reconciliation
                when the direct method is presented).
              </p>
              <Row
                name="Profit / (loss) for the period"
                amount={statement.indirect.profit}
                money={money}
                bold
              />
              {(statement.indirect.adjustments || []).map((a) => (
                <Row
                  key={a.name}
                  name={a.name}
                  amount={a.amount}
                  money={money}
                />
              ))}
              <div className="mt-2 border-t border-slate-300 pt-2">
                <Row
                  name="Net cash from operating activities (indirect)"
                  amount={statement.indirect.netOperating}
                  money={money}
                  bold
                />
                <Row
                  name="Net cash from operating activities (direct)"
                  amount={statement.netOperating}
                  money={money}
                />
              </div>
            </Panel>
          ) : null}

          <Panel className="p-4 sm:p-5">
            <SectionLabel>Accounting policies — cash flows</SectionLabel>
            <ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed text-slate-700">
              {(statement.policies || []).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </AccountingPage>
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

function CashSection({
  title,
  rows,
  total,
  money,
}: {
  title: string;
  rows: Ias7Line[];
  total: number;
  money: (n: number) => string;
}) {
  return (
    <div className="mt-4">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-800">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="py-1 text-xs text-slate-400">None in this period.</p>
      ) : (
        rows.map((r) => (
          <Row key={r.name} name={r.name} amount={r.net} money={money} />
        ))
      )}
      <Row name={`Net ${title.toLowerCase()}`} amount={total} money={money} bold />
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
