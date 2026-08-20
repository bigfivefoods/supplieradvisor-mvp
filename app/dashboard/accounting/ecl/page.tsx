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
import {
  AgingBarChart,
  ChartCard,
  MixDoughnut,
} from '@/components/accounting/AccountingCharts';
import { GaapDisclaimer } from '@/components/accounting/GaapDisclaimer';
import {
  DEFAULT_ECL_RATES,
  ECL_BUCKETS,
  type EclBucket,
} from '@/lib/accounting/ecl-types';

const BUCKET_LABEL: Record<EclBucket, string> = {
  current: 'Current (not overdue)',
  d1_30: '1–30 days',
  d31_60: '31–60 days',
  d61_90: '61–90 days',
  d90_plus: 'Over 90 days',
};

type Sheet = {
  rates: Record<EclBucket, number>;
  invoices: Array<{
    id: number;
    invoice_number: string | null;
    counterparty_name: string | null;
    due_date: string | null;
    balance_due: number;
    days_overdue: number;
    bucket: EclBucket;
    rate: number;
    ecl: number;
  }>;
  byBucket: Record<
    EclBucket,
    { balance: number; ecl: number; count: number; rate: number }
  >;
  totalBalance: number;
  targetAllowance: number;
  currentAllowance: number;
  adjustment: number;
  currency: string;
};

export default function EclPage() {
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
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [rates, setRates] = useState<Record<EclBucket, number>>(DEFAULT_ECL_RATES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (nextRates?: Record<EclBucket, number>) => {
      setLoading(true);
      try {
        const res = await fetch('/api/accounting/ecl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            action: 'preview',
            rates: nextRates || rates,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        setSheet(data.ecl);
        if (data.ecl?.rates) setRates(data.ecl.rates);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed');
      } finally {
        setLoading(false);
      }
    },
    [companyId, privyUserId, rates]
  );

  useEffect(() => {
    void load();
    // initial only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function postAllowance() {
    if (
      !window.confirm(
        'Post the ECL adjustment to the GL? This writes Dr 6820 Credit loss / Cr 1135 Allowance (or the reverse if the allowance is released).'
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/ecl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'post',
          rates,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      if (data.skipped) {
        toast.message('Allowance already equals the worksheet — nothing to post');
      } else {
        toast.success(
          data.entryNumber
            ? `Posted ${data.entryNumber} · adjustment ${formatMoney(data.adjustment)}`
            : 'ECL allowance posted'
        );
      }
      void load(rates);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  const ccy = sheet?.currency || 'ZAR';

  return (
    <AccountingPage>
      <AccountingHeader
        title="Expected"
        titleAccent="credit losses"
        description="IFRS 9 simplified approach for trade receivables. Set aging rates, review the worksheet, and post the allowance (1135) and credit-loss expense (6820)."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load(rates)}
              className="btn-secondary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Recalculate
            </button>
            <button
              type="button"
              disabled={saving || loading || !sheet}
              onClick={() => void postAllowance()}
              className="btn-primary !py-2.5 !px-5 text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Post allowance to GL
            </button>
          </div>
        }
      />

      <GaapDisclaimer className="mb-4" />

      <SectionLabel>Aging rates (%)</SectionLabel>
      <Panel className="mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-5">
          {ECL_BUCKETS.map((b) => (
            <label key={b} className="block text-xs font-semibold text-neutral-600">
              {BUCKET_LABEL[b]}
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={rates[b]}
                onChange={(e) =>
                  setRates((r) => ({ ...r, [b]: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
            </label>
          ))}
        </div>
        <p className="px-5 pb-4 text-[11px] text-neutral-500">
          Defaults are a starting point (1 / 2 / 5 / 10 / 25). Change them to your
          observed loss history, then Recalculate and post.
        </p>
      </Panel>

      {loading && !sheet ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : !sheet ? null : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Kpi label="Open AR" value={formatMoney(sheet.totalBalance, ccy, { compact: false })} />
            <Kpi
              label="Target allowance"
              value={formatMoney(sheet.targetAllowance, ccy, { compact: false })}
            />
            <Kpi
              label="On books (1135)"
              value={formatMoney(sheet.currentAllowance, ccy, { compact: false })}
            />
            <Kpi
              label="Adjustment to post"
              value={formatMoney(sheet.adjustment, ccy, { compact: false })}
              tone={sheet.adjustment >= 0 ? 'amber' : 'emerald'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 mb-6 print:hidden">
            <ChartCard
              title="AR aging"
              subtitle="Open balances by bucket"
              height={240}
            >
              <AgingBarChart
                buckets={{
                  current: sheet.byBucket.current.balance,
                  d1_30: sheet.byBucket.d1_30.balance,
                  d31_60: sheet.byBucket.d31_60.balance,
                  d61_90: sheet.byBucket.d61_90.balance,
                  d90_plus: sheet.byBucket.d90_plus.balance,
                }}
              />
            </ChartCard>
            <ChartCard
              title="ECL by bucket"
              subtitle="Target allowance mix"
              height={240}
            >
              <MixDoughnut
                segments={ECL_BUCKETS.map((b) => ({
                  label: BUCKET_LABEL[b],
                  value: sheet.byBucket[b].ecl,
                }))}
                centerLabel="Allowance"
                centerValue={formatMoney(sheet.targetAllowance, ccy)}
              />
            </ChartCard>
          </div>

          <SectionLabel>By aging bucket</SectionLabel>
          <Panel className="mb-6 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-neutral-400">
                  <th className="px-5 py-2 text-left">Bucket</th>
                  <th className="px-4 py-2 text-right">Invoices</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                  <th className="px-4 py-2 text-right">Rate</th>
                  <th className="px-5 py-2 text-right">ECL</th>
                </tr>
              </thead>
              <tbody>
                {ECL_BUCKETS.map((b) => {
                  const row = sheet.byBucket[b];
                  return (
                    <tr key={b} className="border-t border-neutral-50">
                      <td className="px-5 py-2 font-medium">{BUCKET_LABEL[b]}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.count}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatMoney(row.balance, ccy, { compact: false })}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.rate}%</td>
                      <td className="px-5 py-2 text-right tabular-nums font-semibold">
                        {formatMoney(row.ecl, ccy, { compact: false })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>

          <SectionLabel>Open receivables</SectionLabel>
          <Panel>
            {sheet.invoices.length === 0 ? (
              <div className="px-6 py-10 text-sm text-neutral-500 text-center">
                No open AR invoices. ECL is zero.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-neutral-400">
                      <th className="px-5 py-2 text-left">Invoice</th>
                      <th className="px-4 py-2 text-left">Customer</th>
                      <th className="px-4 py-2 text-right">Days</th>
                      <th className="px-4 py-2 text-right">Balance</th>
                      <th className="px-4 py-2 text-right">Rate</th>
                      <th className="px-5 py-2 text-right">ECL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.invoices.map((inv) => (
                      <tr key={inv.id} className="border-t border-neutral-50">
                        <td className="px-5 py-2 font-medium">
                          {inv.invoice_number || `#${inv.id}`}
                        </td>
                        <td className="px-4 py-2">{inv.counterparty_name || '—'}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {inv.days_overdue}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatMoney(inv.balance_due, ccy, { compact: false })}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{inv.rate}%</td>
                        <td className="px-5 py-2 text-right tabular-nums font-semibold">
                          {formatMoney(inv.ecl, ccy, { compact: false })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </AccountingPage>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'amber' | 'emerald';
}) {
  return (
    <div className="rounded-3xl border border-neutral-100 bg-white px-4 py-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
        {label}
      </div>
      <div
        className={`mt-1 text-lg font-black tabular-nums ${
          tone === 'amber'
            ? 'text-amber-800'
            : tone === 'emerald'
              ? 'text-emerald-800'
              : 'text-slate-900'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
