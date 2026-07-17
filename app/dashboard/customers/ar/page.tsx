'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, Wallet } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  CustomersHeader,
  CustomersPage,
} from '@/components/customers/CustomersShell';

type Bucket = {
  label: string;
  count: number;
  amount: number;
  invoices: Array<{
    id: number;
    invoice_number?: string | null;
    customer_name?: string | null;
    status?: string | null;
    balance: number;
    currency?: string | null;
    due_date?: string | null;
    days_past_due?: number;
  }>;
};

export default function ArAgingPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openTotal, setOpenTotal] = useState(0);
  const [partialCount, setPartialCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [buckets, setBuckets] = useState<Record<string, Bucket> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/customers/ar-aging?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load AR');
      setOpenTotal(Number(data.openTotal || 0));
      setPartialCount(Number(data.partialCount || 0));
      setOverdueCount(Number(data.overdueCount || 0));
      setBuckets(data.buckets || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
      setBuckets(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <CustomersPage>
      <CustomersHeader
        title="Accounts receivable"
        titleAccent="aging"
        description="Open invoice balances by days past due. Record partial payments from the invoice list; resend overdue from Invoices."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              href="/dashboard/customers/invoices?status=overdue&action=resend"
              className="btn-primary !py-2 !px-3 text-sm"
            >
              Follow up overdue
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-[10px] font-bold uppercase text-neutral-400">
                Open AR
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                {openTotal.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
              <div className="text-[10px] font-bold uppercase text-amber-700/80">
                Overdue invoices
              </div>
              <div className="text-2xl font-black text-amber-950 mt-1">
                {overdueCount}
              </div>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4">
              <div className="text-[10px] font-bold uppercase text-sky-700/80">
                Partial payments
              </div>
              <div className="text-2xl font-black text-sky-950 mt-1">
                {partialCount}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-5 gap-3">
            {buckets &&
              (
                [
                  'current',
                  'd1_30',
                  'd31_60',
                  'd61_90',
                  'd90_plus',
                ] as const
              ).map((key) => {
                const b = buckets[key];
                if (!b) return null;
                return (
                  <div
                    key={key}
                    className="rounded-2xl border border-neutral-200 bg-white p-3"
                  >
                    <div className="text-[10px] font-bold uppercase text-neutral-400">
                      {b.label}
                    </div>
                    <div className="text-lg font-black text-slate-900 mt-1 tabular-nums">
                      {Number(b.amount || 0).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {b.count} invoice{b.count === 1 ? '' : 's'}
                    </div>
                  </div>
                );
              })}
          </div>

          {buckets &&
            Object.entries(buckets).map(([key, b]) => {
              if (!b.invoices?.length) return null;
              return (
                <div
                  key={key}
                  className="rounded-3xl border border-neutral-200 bg-white overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#00b4d8]" />
                    <h3 className="text-sm font-black text-slate-900">
                      {b.label}
                    </h3>
                  </div>
                  <ul className="divide-y divide-neutral-100">
                    {b.invoices.map((inv) => (
                      <li
                        key={inv.id}
                        className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <div>
                          <div className="font-bold text-slate-900">
                            {inv.invoice_number || `#${inv.id}`}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {inv.customer_name || 'Customer'}
                            {inv.due_date
                              ? ` · due ${String(inv.due_date).slice(0, 10)}`
                              : ''}
                            {inv.days_past_due
                              ? ` · ${inv.days_past_due}d past`
                              : ''}
                            {inv.status ? ` · ${inv.status}` : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold tabular-nums">
                            {Number(inv.balance || 0).toLocaleString()}{' '}
                            <span className="text-xs font-semibold text-neutral-400">
                              {inv.currency || 'ZAR'}
                            </span>
                          </div>
                          <Link
                            href="/dashboard/customers/invoices"
                            className="text-[11px] font-bold text-[#0077b6] hover:underline"
                          >
                            Open invoices
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

          {openTotal <= 0 ? (
            <p className="text-sm text-neutral-500 text-center py-8">
              No open AR balances. Issue and send invoices to build collections.
            </p>
          ) : null}
        </div>
      )}
    </CustomersPage>
  );
}
