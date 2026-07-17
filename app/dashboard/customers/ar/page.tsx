'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail, MessageCircle, RefreshCw, Wallet } from 'lucide-react';
import { toast } from 'sonner';
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

  const collectionsSummary = useMemo(() => {
    if (!buckets) return '';
    const lines: string[] = [
      'SupplierAdvisor AR collections summary',
      `Open AR: ${openTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      `Overdue invoices: ${overdueCount}`,
      `Partial payments: ${partialCount}`,
      '',
    ];
    for (const key of [
      'd1_30',
      'd31_60',
      'd61_90',
      'd90_plus',
    ] as const) {
      const b = buckets[key];
      if (!b?.invoices?.length) continue;
      lines.push(`${b.label} (${b.count}):`);
      for (const inv of b.invoices.slice(0, 8)) {
        lines.push(
          `· ${inv.invoice_number || `#${inv.id}`} — ${inv.customer_name || 'Customer'} — ${Number(inv.balance || 0).toLocaleString()} ${inv.currency || 'ZAR'}${
            inv.days_past_due ? ` · ${inv.days_past_due}d past` : ''
          }`
        );
      }
      lines.push('');
    }
    lines.push(
      'Open AR aging: https://www.supplieradvisor.com/dashboard/customers/ar'
    );
    return lines.join('\n').trim();
  }, [buckets, openTotal, overdueCount, partialCount]);

  const copyCollections = async () => {
    if (!collectionsSummary) {
      toast.message('Nothing overdue to summarise');
      return;
    }
    try {
      await navigator.clipboard.writeText(collectionsSummary);
      toast.success('Collections summary copied');
    } catch {
      toast.error('Could not copy — select text from email draft instead');
    }
  };

  const emailCollections = () => {
    if (!collectionsSummary) {
      toast.message('Nothing overdue to summarise');
      return;
    }
    const subject = encodeURIComponent(
      `AR collections — ${overdueCount} overdue · open ${openTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    );
    const body = encodeURIComponent(collectionsSummary);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const whatsappCollections = async () => {
    if (!collectionsSummary) {
      toast.message('Nothing overdue to summarise');
      return;
    }
    try {
      const { openWhatsAppShare } = await import('@/lib/invites/whatsapp');
      openWhatsAppShare({ text: collectionsSummary });
    } catch {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(collectionsSummary)}`,
        '_blank',
        'noopener,noreferrer'
      );
    }
  };

  return (
    <CustomersPage>
      <CustomersHeader
        title="Accounts receivable"
        titleAccent="aging"
        description="Open invoice balances by days past due. Record partial payments (with payment ref) from the invoice list; resend overdue from Invoices."
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
          {(overdueCount > 0 || openTotal > 0) && (
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-black text-amber-950">
                  Collections digest
                </div>
                <p className="text-xs text-amber-900/80 mt-0.5 leading-relaxed">
                  Share a one-tap aging summary with finance or chase via
                  WhatsApp. Payment refs are stored when you mark invoices paid.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void copyCollections()}
                  className="btn-secondary !py-2 !px-3 text-xs"
                >
                  Copy summary
                </button>
                <button
                  type="button"
                  onClick={emailCollections}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-50"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => void whatsappCollections()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-2 text-xs font-bold text-white hover:bg-[#1ebe57]"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </button>
              </div>
            </div>
          )}

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
