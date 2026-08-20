'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Loader2,
  PieChart,
  Printer,
  RefreshCw,
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
import PeriodSlicer from '@/components/accounting/PeriodSlicer';
import { useAccountingPeriod } from '@/lib/accounting/use-period';
import { FinanceWorkspaceNote } from '@/components/accounting/FinanceWorkspaceNote';
import {
  ChartCard,
  MixDoughnut,
} from '@/components/accounting/AccountingCharts';
import type {
  GeneralLedger,
  LedgerAccount,
} from '@/lib/accounting/statement-types';

export default function GeneralLedgerPage() {
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
  const { fyStartMonth, period, setPeriod } = useAccountingPeriod(
    companyId,
    privyUserId,
    'full_fy'
  );
  const [ledger, setLedger] = useState<GeneralLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        from: period.from,
        to: period.to,
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/accounting/general-ledger?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load ledger');
      setLedger(data.ledger || null);
      if (data.ledger?.warning) toast.message(data.ledger.warning);
    } catch (err) {
      setLedger(null);
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, period.from, period.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const money = (n: number) => formatMoney(n, 'ZAR', { compact: false });
  const needle = q.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!ledger) return [];
    if (!needle) return ledger.accounts;
    return ledger.accounts.filter((a) =>
      `${a.code} ${a.name} ${a.account_type}`.toLowerCase().includes(needle)
    );
  }, [ledger, needle]);

  return (
    <AccountingPage>
      <style>{`
        @media print {
          nav, aside, header, .print\\:hidden { display: none !important; }
          body { background: white !important; }
        }
        @page { margin: 14mm; }
      `}</style>
      <div className="print:hidden">
        <AccountingHeader
          title="General"
          titleAccent="ledger"
          description="The book of accounts from posted journals — opening balance, every debit and credit in the period, running balance, and closing. Accrual basis under IAS 1 / the Conceptual Framework. Unaudited."
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
        <GaapDisclaimer className="mb-2" />
        <FinanceWorkspaceNote className="mb-4" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : !ledger ? (
        <p className="text-sm text-slate-500">No ledger for this period.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Period debits"
              value={money(ledger.total_period_debit)}
            />
            <Stat
              label="Period credits"
              value={money(ledger.total_period_credit)}
            />
            <Stat
              label="Journals"
              value={String(ledger.journal_count)}
            />
            <Stat
              label="Control"
              value={
                ledger.balanced
                  ? 'In balance'
                  : `Out by ${money(ledger.difference)}`
              }
              warn={!ledger.balanced}
            />
          </div>
          <p className="text-[11px] text-slate-500">{ledger.basis}</p>

          <div className="grid gap-4 lg:grid-cols-2 print:hidden">
            <ChartCard
              title="Period mix"
              subtitle="Debits by account type"
              icon={PieChart}
              height={240}
            >
              <MixDoughnut
                segments={['asset', 'liability', 'equity', 'revenue', 'cogs', 'expense']
                  .map((t) => ({
                    label: t,
                    value: ledger.accounts
                      .filter((a) => a.account_type === t)
                      .reduce((s, a) => s + a.period_debit, 0),
                  }))
                  .filter((s) => s.value > 0)}
                centerLabel="Debits"
                centerValue={money(ledger.total_period_debit)}
              />
            </ChartCard>
            <ChartCard
              title="Largest movements"
              subtitle="Accounts by period debit"
              icon={BarChart3}
              height={240}
            >
              <MixDoughnut
                segments={[...ledger.accounts]
                  .sort((a, b) => b.period_debit - a.period_debit)
                  .slice(0, 8)
                  .map((a) => ({
                    label: `${a.code} ${a.name}`.slice(0, 22),
                    value: a.period_debit,
                  }))}
                centerLabel="Top"
                centerValue={money(
                  [...ledger.accounts]
                    .sort((a, b) => b.period_debit - a.period_debit)
                    .slice(0, 8)
                    .reduce((s, a) => s + a.period_debit, 0)
                )}
              />
            </ChartCard>
          </div>

          <div className="print:hidden">
            <input
              className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="Filter accounts…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <SectionLabel>Accounts</SectionLabel>
          {rows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              No posted activity on the chart for this period. Seed the chart of
              accounts and post journals first.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((a) => (
                <AccountBlock
                  key={a.account_id}
                  account={a}
                  open={openId === a.account_id}
                  onToggle={() =>
                    setOpenId((id) =>
                      id === a.account_id ? null : a.account_id
                    )
                  }
                  money={money}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </AccountingPage>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        warn
          ? 'border-amber-300 bg-amber-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-black tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}

function AccountBlock({
  account,
  open,
  onToggle,
  money,
}: {
  account: LedgerAccount;
  open: boolean;
  onToggle: () => void;
  money: (n: number) => string;
}) {
  return (
    <Panel className="p-4 sm:p-5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
      >
        <div className="flex min-w-0 items-start gap-2">
          {open ? (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          )}
          <div className="min-w-0">
            <p className="font-black text-slate-900">
              {account.code} · {account.name}
            </p>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {account.account_type}
              {account.subtype ? ` · ${account.subtype}` : ''} ·{' '}
              {account.movement_count} line
              {account.movement_count === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-right text-xs tabular-nums">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">
              Opening
            </p>
            <p className="font-semibold">{money(account.opening_natural)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">
              Period Dr / Cr
            </p>
            <p className="font-semibold">
              {money(account.period_debit)} / {money(account.period_credit)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">
              Closing
            </p>
            <p className="font-black">{money(account.closing_natural)}</p>
          </div>
        </div>
      </button>
      {open ? (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                <th className="py-1.5 pr-3">Date</th>
                <th className="py-1.5 pr-3">Ref</th>
                <th className="py-1.5 pr-3">Narrative</th>
                <th className="py-1.5 pr-3 text-right">Debit</th>
                <th className="py-1.5 pr-3 text-right">Credit</th>
                <th className="py-1.5 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100 text-slate-600">
                <td className="py-1.5 pr-3" colSpan={3}>
                  Opening balance
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">—</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">—</td>
                <td className="py-1.5 text-right font-semibold tabular-nums">
                  {money(account.opening_natural)}
                </td>
              </tr>
              {account.movements.map((m) => (
                <tr
                  key={`${m.journal_id}-${m.date}-${m.debit}-${m.credit}`}
                  className="border-t border-slate-100"
                >
                  <td className="whitespace-nowrap py-1.5 pr-3">{m.date}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    {m.entry_number || `#${m.journal_id}`}
                  </td>
                  <td className="max-w-sm py-1.5 pr-3">
                    {m.line_memo || m.memo || m.source || '—'}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {m.debit ? money(m.debit) : ''}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {m.credit ? money(m.credit) : ''}
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">
                    {money(m.natural_balance)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-black">
                <td className="py-2 pr-3" colSpan={3}>
                  Closing balance
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {money(account.period_debit)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {money(account.period_credit)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {money(account.closing_natural)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </Panel>
  );
}
