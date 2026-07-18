'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FileDown,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
  Users,
  Wallet,
} from 'lucide-react';
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
    promise_to_pay_date?: string | null;
    broken_promise?: boolean;
  }>;
};

type CustomerRollup = {
  customerId: number | null;
  customerName: string;
  invoiceCount: number;
  openBalance: number;
  overdueCount: number;
  partialCount: number;
  brokenPromiseCount: number;
  promiseDueCount: number;
  currency: string;
  creditLimit?: number | null;
  overCreditLimit?: boolean;
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
  const [openTotalBase, setOpenTotalBase] = useState<number | null>(null);
  const [baseCurrency, setBaseCurrency] = useState('ZAR');
  const [partialCount, setPartialCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [brokenPromiseCount, setBrokenPromiseCount] = useState(0);
  const [buckets, setBuckets] = useState<Record<string, Bucket> | null>(null);
  const [dunningPreview, setDunningPreview] = useState<
    Array<Record<string, unknown>>
  >([]);
  const [customers, setCustomers] = useState<CustomerRollup[]>([]);
  const [statementHistory, setStatementHistory] = useState<
    Array<{ id: string; summary: string; created_at: string }>
  >([]);
  const [ledgerEntries, setLedgerEntries] = useState<
    Array<{
      id?: number;
      invoice_id: number;
      amount: number;
      currency?: string;
      paid_at: string;
      reference?: string | null;
      method?: string | null;
    }>
  >([]);
  const [ledgerWarning, setLedgerWarning] = useState<string | null>(null);
  const [paymentClaims, setPaymentClaims] = useState<
    Array<{
      id: number;
      invoice_id: number;
      amount: number;
      currency?: string;
      reference?: string | null;
      invoice_number?: string | null;
      customer_name?: string | null;
      claimed_at?: string;
      status?: string;
    }>
  >([]);
  const [claimBusy, setClaimBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agingRes, custRes, histRes, dunRes, ledRes, claimRes] =
        await Promise.all([
        fetch(`/api/customers/ar-aging?companyId=${companyId}`, {
          cache: 'no-store',
        }),
        fetch(`/api/customers/ar-by-customer?companyId=${companyId}`, {
          cache: 'no-store',
        }),
        fetch(
          `/api/customers/ar-statement/history?companyId=${companyId}`,
          { cache: 'no-store' }
        ).catch(() => null),
        fetch(
          `/api/customers/docs/dunning-preview?companyId=${companyId}`,
          { cache: 'no-store' }
        ).catch(() => null),
        fetch(`/api/customers/ar-ledger?companyId=${companyId}&limit=25`, {
          cache: 'no-store',
        }).catch(() => null),
        fetch(
          `/api/customers/payment-claims?companyId=${companyId}&status=pending`,
          { cache: 'no-store' }
        ).catch(() => null),
      ]);
      const data = await agingRes.json();
      if (!agingRes.ok) throw new Error(data.error || 'Failed to load AR');
      setOpenTotal(Number(data.openTotal || 0));
      setOpenTotalBase(
        data.openTotalBase != null ? Number(data.openTotalBase) : null
      );
      setBaseCurrency(String(data.baseCurrency || 'ZAR'));
      setPartialCount(Number(data.partialCount || 0));
      setOverdueCount(Number(data.overdueCount || 0));
      setBrokenPromiseCount(Number(data.brokenPromiseCount || 0));
      setBuckets(data.buckets || null);
      if (dunRes && dunRes.ok) {
        const d = await dunRes.json().catch(() => ({}));
        setDunningPreview(
          ((d.preview || []) as Array<Record<string, unknown>>).filter(
            (p) => p.would_send
          )
        );
      } else {
        setDunningPreview([]);
      }

      const cData = await custRes.json().catch(() => ({}));
      if (custRes.ok) {
        setCustomers((cData.customers as CustomerRollup[]) || []);
      } else {
        setCustomers([]);
      }

      if (histRes && histRes.ok) {
        const h = await histRes.json().catch(() => ({}));
        setStatementHistory(
          ((h.events || []) as Array<{
            id: string;
            summary: string;
            created_at: string;
          }>) || []
        );
      } else {
        setStatementHistory([]);
      }

      if (ledRes && ledRes.ok) {
        const l = await ledRes.json().catch(() => ({}));
        setLedgerEntries(
          ((l.entries || []) as Array<{
            id?: number;
            invoice_id: number;
            amount: number;
            currency?: string;
            paid_at: string;
            reference?: string | null;
            method?: string | null;
          }>) || []
        );
        setLedgerWarning(
          l.tableMissing
            ? String(
                l.warning ||
                  'Run 20260717_ar_ledger.sql for first-class payment ledger'
              )
            : null
        );
      } else {
        setLedgerEntries([]);
        setLedgerWarning(null);
      }

      if (claimRes && claimRes.ok) {
        const c = await claimRes.json().catch(() => ({}));
        setPaymentClaims(
          ((c.claims || []) as Array<{
            id: number;
            invoice_id: number;
            amount: number;
            currency?: string;
            reference?: string | null;
            invoice_number?: string | null;
            customer_name?: string | null;
            claimed_at?: string;
            status?: string;
          }>) || []
        );
      } else {
        setPaymentClaims([]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
      setBuckets(null);
      setCustomers([]);
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
      `Broken promises: ${brokenPromiseCount}`,
      '',
    ];
    if (customers.length) {
      lines.push('By customer:');
      for (const c of customers.slice(0, 12)) {
        lines.push(
          `· ${c.customerName} — ${c.invoiceCount} inv · ${Number(
            c.openBalance
          ).toLocaleString()} ${c.currency}${
            c.brokenPromiseCount
              ? ` · ${c.brokenPromiseCount} broken promise`
              : ''
          }`
        );
      }
      lines.push('');
    }
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
          }${inv.broken_promise ? ' · BROKEN PROMISE' : ''}`
        );
      }
      lines.push('');
    }
    lines.push(
      'Open AR aging: https://www.supplieradvisor.com/dashboard/customers/ar'
    );
    return lines.join('\n').trim();
  }, [
    buckets,
    openTotal,
    overdueCount,
    partialCount,
    brokenPromiseCount,
    customers,
  ]);

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

  const openStatement = (customerId: number | null) => {
    if (!customerId) {
      toast.message('Link a customer profile to download a PDF statement');
      return;
    }
    window.open(
      `/api/customers/ar-statement?companyId=${companyId}&customerId=${customerId}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const resolveClaim = async (
    claimId: number,
    action: 'confirm' | 'reject'
  ) => {
    setClaimBusy(claimId);
    toast.loading(
      action === 'confirm' ? 'Confirming into ledger…' : 'Rejecting claim…',
      { id: 'claim-res' }
    );
    try {
      const res = await fetch('/api/customers/payment-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, claimId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        action === 'confirm'
          ? 'Payment posted to AR ledger'
          : 'Claim rejected',
        { id: 'claim-res' }
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed', {
        id: 'claim-res',
      });
    } finally {
      setClaimBusy(null);
    }
  };

  const dunningAction = async (
    invoiceId: number,
    action: 'dunning_send_now' | 'dunning_skip'
  ) => {
    toast.loading(
      action === 'dunning_send_now' ? 'Sending dunning…' : 'Skipping level…',
      { id: 'dun-act' }
    );
    try {
      const res = await fetch('/api/customers/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          type: 'invoice',
          id: invoiceId,
          action,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.reason || 'Failed');
      toast.success(
        action === 'dunning_send_now'
          ? `Dunning sent${data.to ? ` to ${data.to}` : ''}`
          : 'Level skipped',
        { id: 'dun-act' }
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed', { id: 'dun-act' });
    }
  };

  const emailStatement = async (customerId: number | null) => {
    if (!customerId) {
      toast.message('Link a customer profile to email a statement');
      return;
    }
    toast.loading('Emailing statement PDF…', { id: 'stmt-email' });
    try {
      const res = await fetch('/api/customers/ar-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          customerId,
          action: 'email',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Send failed');
      toast.success(`Statement emailed to ${data.to}`, {
        id: 'stmt-email',
        description: `Open ${Number(data.openTotal || 0).toLocaleString()} ${data.currency || ''}`.trim(),
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Send failed', {
        id: 'stmt-email',
      });
    }
  };

  return (
    <CustomersPage>
      <CustomersHeader
        title="Accounts receivable"
        titleAccent="aging"
        description="Aging buckets, customer rollup, broken promises, and PDF statements. Weekly digest Mon · monthly statement email 1st."
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
                  Share aging + customer rollup. Broken promises =
                  promise-to-pay date past with balance still open.
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

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-[10px] font-bold uppercase text-neutral-400">
                Open AR (mixed CCY)
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                {openTotal.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>
            {openTotalBase != null ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4">
                <div className="text-[10px] font-bold uppercase text-sky-700/80">
                  Open AR ({baseCurrency})
                </div>
                <div className="text-2xl font-black text-sky-950 mt-1 tabular-nums">
                  {openTotalBase.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </div>
                <div className="text-[10px] text-sky-800/70 mt-0.5">
                  FX indicative
                </div>
              </div>
            ) : null}
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
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
              <div className="text-[10px] font-bold uppercase text-rose-700/80">
                Broken promises
              </div>
              <div className="text-2xl font-black text-rose-950 mt-1">
                {brokenPromiseCount}
              </div>
            </div>
          </div>

          {paymentClaims.length > 0 ? (
            <div className="rounded-2xl border border-teal-300 bg-gradient-to-br from-teal-50 to-white px-4 py-3">
              <div className="text-[10px] font-bold uppercase text-teal-900 mb-1">
                Buyer payment claims ({paymentClaims.length})
              </div>
              <p className="text-[11px] text-teal-900/70 mb-2">
                Buyers reported payment — confirm to post a ledger line and
                update invoice balance.
              </p>
              <ul className="space-y-2">
                {paymentClaims.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs border border-teal-100 rounded-xl bg-white px-3 py-2"
                  >
                    <div>
                      <span className="font-bold text-slate-900">
                        {Number(c.amount).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}{' '}
                        {c.currency || baseCurrency}
                      </span>
                      <span className="text-neutral-500 ml-1.5">
                        {c.invoice_number || `inv #${c.invoice_id}`}
                        {c.customer_name ? ` · ${c.customer_name}` : ''}
                        {c.reference ? ` · ref ${c.reference}` : ''}
                      </span>
                    </div>
                    <span className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={claimBusy === c.id}
                        onClick={() => void resolveClaim(c.id, 'confirm')}
                        className="rounded-full bg-teal-700 text-white px-2.5 py-1 text-[10px] font-bold disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        disabled={claimBusy === c.id}
                        onClick={() => void resolveClaim(c.id, 'reject')}
                        className="rounded-full border border-neutral-200 px-2.5 py-1 text-[10px] font-bold text-neutral-600 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white px-4 py-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div>
                <div className="text-[10px] font-bold uppercase text-emerald-800">
                  Payment ledger
                </div>
                <p className="text-[11px] text-emerald-900/70">
                  First-class payment lines (not notes-only). Recorded on mark
                  paid / AR ledger API.
                </p>
              </div>
              <Wallet className="w-4 h-4 text-emerald-700 shrink-0" />
            </div>
            {ledgerWarning ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                {ledgerWarning}
              </p>
            ) : ledgerEntries.length === 0 ? (
              <p className="text-xs text-neutral-500">
                No ledger payments yet. Partial/full mark-paid writes rows here
                after migration.
              </p>
            ) : (
              <ul className="divide-y divide-emerald-100 max-h-56 overflow-y-auto">
                {ledgerEntries.map((e) => (
                  <li
                    key={String(e.id || `${e.invoice_id}-${e.paid_at}`)}
                    className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800">
                        {Number(e.amount).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}{' '}
                        {e.currency || baseCurrency}
                      </span>
                      <span className="text-neutral-500 ml-1.5">
                        inv #{e.invoice_id}
                        {e.reference ? ` · ref ${e.reference}` : ''}
                        {e.method ? ` · ${e.method}` : ''}
                      </span>
                    </div>
                    <span className="text-neutral-400 tabular-nums">
                      {String(e.paid_at).slice(0, 16).replace('T', ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {dunningPreview.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-3">
              <div className="text-[10px] font-bold uppercase text-amber-800 mb-2">
                Dunning preview — next cron would send ({dunningPreview.length})
              </div>
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {dunningPreview.slice(0, 12).map((p) => (
                  <li
                    key={String(p.id)}
                    className="text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>
                      {String(p.invoice_number || p.id)} ·{' '}
                      {String(p.customer_name || 'Customer')} · day{' '}
                      {String(p.ladder_day)} ({String(p.ladder_label)}) ·{' '}
                      {Number(p.balance || 0).toLocaleString()}{' '}
                      {String(p.currency || '')}
                    </span>
                    <span className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        className="rounded-full bg-amber-900 text-white px-2 py-0.5 text-[10px] font-bold"
                        onClick={() =>
                          void dunningAction(Number(p.id), 'dunning_send_now')
                        }
                      >
                        Send now
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-bold text-amber-950"
                        onClick={() =>
                          void dunningAction(Number(p.id), 'dunning_skip')
                        }
                      >
                        Skip
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {statementHistory.length > 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
              <div className="text-[10px] font-bold uppercase text-neutral-400 mb-2">
                Collections history
              </div>
              <ul className="space-y-1.5 max-h-36 overflow-y-auto">
                {statementHistory.slice(0, 12).map((e) => (
                  <li
                    key={e.id}
                    className="text-xs text-slate-700 flex flex-wrap gap-x-2"
                  >
                    <span className="text-neutral-400 tabular-nums">
                      {e.created_at
                        ? String(e.created_at).slice(0, 16).replace('T', ' ')
                        : ''}
                    </span>
                    <span>{e.summary}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {customers.length > 0 ? (
            <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#00b4d8]" />
                <h3 className="text-sm font-black text-slate-900">
                  By customer
                </h3>
                <span className="text-xs text-neutral-400">
                  {customers.length} accounts
                </span>
              </div>
              <ul className="divide-y divide-neutral-100">
                {customers.map((c) => (
                  <li
                    key={`${c.customerId ?? 'x'}-${c.customerName}`}
                    className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                        {c.customerName}
                        {c.brokenPromiseCount > 0 ? (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-black uppercase text-rose-800">
                            {c.brokenPromiseCount} broken promise
                          </span>
                        ) : null}
                        {c.overCreditLimit ? (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[9px] font-black uppercase text-orange-900">
                            Over credit limit
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {c.invoiceCount} open · {c.overdueCount} overdue
                        {c.partialCount ? ` · ${c.partialCount} partial` : ''}
                        {c.creditLimit != null && c.creditLimit > 0
                          ? ` · limit ${Number(c.creditLimit).toLocaleString()}`
                          : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right font-bold tabular-nums">
                        {Number(c.openBalance || 0).toLocaleString()}{' '}
                        <span className="text-xs font-semibold text-neutral-400">
                          {c.currency || 'ZAR'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openStatement(c.customerId)}
                        className="btn-secondary !py-1.5 !px-2.5 text-xs inline-flex items-center gap-1"
                        title="PDF statement of open invoices"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => void emailStatement(c.customerId)}
                        className="btn-secondary !py-1.5 !px-2.5 text-xs inline-flex items-center gap-1 border-sky-200 text-sky-900"
                        title="Email PDF statement to customer"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Email
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

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
                        className={`px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm ${
                          inv.broken_promise ? 'bg-rose-50/50' : ''
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                            {inv.invoice_number || `#${inv.id}`}
                            {inv.broken_promise ? (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-black uppercase text-rose-800">
                                Broken promise
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {inv.customer_name || 'Customer'}
                            {inv.due_date
                              ? ` · due ${String(inv.due_date).slice(0, 10)}`
                              : ''}
                            {inv.days_past_due
                              ? ` · ${inv.days_past_due}d past`
                              : ''}
                            {inv.promise_to_pay_date
                              ? ` · promise ${String(inv.promise_to_pay_date).slice(0, 10)}`
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
                            className="text-xs font-semibold text-[#0077b6] hover:underline"
                          >
                            Open invoices →
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
        </div>
      )}
    </CustomersPage>
  );
}
