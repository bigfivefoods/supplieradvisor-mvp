'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
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

const REPORTS = [
  { id: 'trial_balance', label: 'Trial balance' },
  { id: 'pnl', label: 'Profit & loss' },
  { id: 'balance_sheet', label: 'Balance sheet' },
  { id: 'ar_aging', label: 'AR aging' },
  { id: 'ap_aging', label: 'AP aging' },
  { id: 'cashflow', label: 'Cash flow' },
] as const;

export default function ReportsPage() {
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
  const [report, setReport] = useState<string>('trial_balance');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        report,
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`/api/accounting/reports?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData(json);
      if (json.warning) toast.message(json.warning);
    } catch (err) {
      setData(null);
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, report, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AccountingPage>
      <AccountingHeader
        title="Reports &"
        titleAccent="analytics"
        description="Financial statements, aging, and cash movement — powered by posted journals and live AR/AP."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2.5 !px-5 text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {REPORTS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setReport(r.id)}
            className={`px-3 py-2 rounded-full text-xs font-semibold border transition-all ${
              report === r.id
                ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/40'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {['trial_balance', 'pnl', 'balance_sheet', 'cashflow'].includes(report) && (
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
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <ReportBody report={report} data={data} />
      )}
    </AccountingPage>
  );
}

function ReportBody({
  report,
  data,
}: {
  report: string;
  data: Record<string, unknown> | null;
}) {
  if (!data) {
    return (
      <Panel>
        <div className="px-6 py-12 text-center text-sm text-neutral-500">No data</div>
      </Panel>
    );
  }

  if (report === 'trial_balance') {
    const rows = (data.rows as Array<Record<string, unknown>>) || [];
    const totals = data.totals as { debit: number; credit: number; balanced: boolean } | undefined;
    return (
      <>
        {totals && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <SumCard label="Total debits" value={formatMoney(totals.debit)} />
            <SumCard label="Total credits" value={formatMoney(totals.credit)} />
            <SumCard
              label="Balanced"
              value={totals.balanced ? 'Yes' : 'No'}
              tone={totals.balanced ? 'emerald' : 'amber'}
            />
          </div>
        )}
        <SimpleTable
          headers={['Code', 'Name', 'Type', 'Debit', 'Credit']}
          rows={rows.map((r) => [
            String(r.code),
            String(r.name),
            String(r.account_type),
            formatMoney(Number(r.debit)),
            formatMoney(Number(r.credit)),
          ])}
        />
      </>
    );
  }

  if (report === 'pnl') {
    const summary = data.summary as Record<string, number> | undefined;
    const rows = (data.rows as Array<Record<string, unknown>>) || [];
    return (
      <>
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <SumCard label="Revenue" value={formatMoney(summary.revenue)} />
            <SumCard label="COGS" value={formatMoney(summary.cogs)} />
            <SumCard label="Gross profit" value={formatMoney(summary.grossProfit)} />
            <SumCard label="Expenses" value={formatMoney(summary.expenses)} />
            <SumCard
              label="Net income"
              value={formatMoney(summary.netIncome)}
              tone={summary.netIncome >= 0 ? 'emerald' : 'amber'}
            />
          </div>
        )}
        <SimpleTable
          headers={['Code', 'Name', 'Type', 'Amount']}
          rows={rows.map((r) => [
            String(r.code),
            String(r.name),
            String(r.account_type),
            formatMoney(Number(r.amount)),
          ])}
        />
      </>
    );
  }

  if (report === 'balance_sheet') {
    const summary = data.summary as Record<string, number | boolean> | undefined;
    const rows = (data.rows as Array<Record<string, unknown>>) || [];
    return (
      <>
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <SumCard label="Assets" value={formatMoney(Number(summary.assets))} />
            <SumCard label="Liabilities" value={formatMoney(Number(summary.liabilities))} />
            <SumCard label="Equity (+ NI)" value={formatMoney(Number(summary.equity))} />
            <SumCard
              label="Equation"
              value={summary.balanced ? 'Balanced' : 'Off'}
              tone={summary.balanced ? 'emerald' : 'amber'}
            />
          </div>
        )}
        <SimpleTable
          headers={['Code', 'Name', 'Type', 'Amount']}
          rows={rows.map((r) => [
            String(r.code),
            String(r.name),
            String(r.account_type),
            formatMoney(Number(r.amount)),
          ])}
        />
      </>
    );
  }

  if (report === 'ar_aging' || report === 'ap_aging') {
    const buckets = data.buckets as Record<string, number> | undefined;
    const rows = (data.rows as Array<Record<string, unknown>>) || [];
    return (
      <>
        {buckets && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <SumCard label="Current" value={formatMoney(buckets.current)} />
            <SumCard label="1–30" value={formatMoney(buckets.d1_30)} />
            <SumCard label="31–60" value={formatMoney(buckets.d31_60)} />
            <SumCard label="61–90" value={formatMoney(buckets.d61_90)} />
            <SumCard label="90+" value={formatMoney(buckets.d90_plus)} tone="amber" />
          </div>
        )}
        <SectionLabel>
          {report === 'ar_aging' ? 'Receivables' : 'Payables'} detail
        </SectionLabel>
        <SimpleTable
          headers={['Number', 'Counterparty', 'Due', 'Days', 'Balance']}
          rows={rows.map((r) => [
            String(r.invoice_number || r.id),
            String(r.counterparty_name || '—'),
            String(r.due_date || '—'),
            String(r.days_overdue ?? 0),
            formatMoney(Number(r.balance_due)),
          ])}
        />
      </>
    );
  }

  if (report === 'cashflow') {
    const summary = data.summary as Record<string, number> | undefined;
    const rows = (data.rows as Array<Record<string, unknown>>) || [];
    return (
      <>
        {summary && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <SumCard label="Inflow" value={formatMoney(summary.inflow)} tone="emerald" />
            <SumCard label="Outflow" value={formatMoney(summary.outflow)} />
            <SumCard label="Net" value={formatMoney(summary.net)} />
          </div>
        )}
        <SimpleTable
          headers={['Date', 'Direction', 'Method', 'Counterparty', 'Amount']}
          rows={rows.map((r) => [
            String(r.paid_at || '').slice(0, 10),
            String(r.direction),
            String(r.method || '—'),
            String(r.counterparty_name || '—'),
            formatMoney(Number(r.amount)),
          ])}
        />
      </>
    );
  }

  return null;
}

function SumCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
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
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <Panel>
      {rows.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-neutral-500">
          No rows for this period. Post journals or create invoices to populate reports.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                {headers.map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-neutral-50/80">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-4 py-2.5 ${j === row.length - 1 || j >= 3 ? 'tabular-nums' : ''} ${
                        j === 0 ? 'font-mono text-xs font-semibold text-slate-700' : 'text-slate-700'
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
