'use client';

/**
 * Seller Money hub — settle-by-default daily surface.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  Wallet,
  FileDown,
  AlertTriangle,
  Banknote,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  CustomersHeader,
  CustomersPage,
} from '@/components/customers/CustomersShell';
import SettleFunnelStrip from '@/components/dashboard/SettleFunnelStrip';
import ClaimDecisionDrawer, {
  type ClaimRow,
} from '@/components/customers/ClaimDecisionDrawer';

type Hub = {
  openAr: number;
  baseCurrency: string;
  overdueCount: number;
  partialCount: number;
  pendingClaims: number;
  openInstallments: number;
  overdueInstallments: number;
  dunningDue: number;
  claims: Array<{
    id: number;
    invoice_id: number;
    amount: number;
    currency?: string;
    invoice_number?: string | null;
    customer_name?: string | null;
    reference?: string | null;
    proof_url?: string | null;
    notes?: string | null;
    claimed_at?: string;
    ageHours?: number;
    slaBreached?: boolean;
  }>;
  topOpenInvoices: Array<{
    id: number;
    invoice_number: string | null;
    customer_name: string | null;
    balance: number;
    currency: string;
    due_date: string | null;
    status: string;
  }>;
  recentLedger: Array<{
    id?: number;
    invoice_id: number;
    amount: number;
    currency?: string;
    paid_at: string;
    method?: string | null;
  }>;
  installments?: Array<{
    id: number;
    invoice_id: number;
    due_date: string;
    amount: number;
    overdue: boolean;
    invoice_number?: string | null;
  }>;
  dunningInvoiceIds?: number[];
  settled30d?: number;
  brokenPromises?: Array<{
    id: number;
    invoice_number: string | null;
    customer_name: string | null;
    promise_to_pay_date: string;
    balance: number;
    currency: string;
  }>;
  creditAlerts?: Array<{
    customerId: number;
    customerName: string;
    creditLimit: number;
    openBalance: number;
    overBy: number;
  }>;
};

type BankSug = {
  bankTxnId: number | string;
  amount: number;
  confidence: number;
  reason: string;
  description?: string | null;
  reference?: string | null;
};

export default function SellerMoneyHubPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [hub, setHub] = useState<Hub | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimBusy, setClaimBusy] = useState<number | null>(null);
  const [dunBusy, setDunBusy] = useState(false);
  const [bankSugs, setBankSugs] = useState<BankSug[]>([]);
  const [bankInvoiceId, setBankInvoiceId] = useState<number | null>(null);
  const [dunningPreview, setDunningPreview] = useState<
    Array<{
      id: number;
      invoice_number?: string | null;
      customer_name?: string | null;
      contact_email?: string | null;
      balance: number;
      currency?: string;
      due_date?: string | null;
      days_past_due?: number;
      ladder_day?: number;
      ladder_label?: string;
      paused?: boolean;
      already_sent_level?: boolean;
      would_send?: boolean;
    }>
  >([]);
  const [showDunPreview, setShowDunPreview] = useState(false);
  const [claimDrawer, setClaimDrawer] = useState<ClaimRow | null>(null);
  const [statementPack, setStatementPack] = useState<{
    customers: Array<{
      customerId: number;
      customerName: string;
      openBalance: number;
      openInvoiceCount: number;
      currency: string;
      pdfHref: string;
    }>;
    totalOpen: number;
    customerCount: number;
  } | null>(null);
  const [stmtBusy, setStmtBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/customers/money-hub?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setHub(data.hub);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
      setHub(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const loadDunningPreview = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/customers/docs/dunning-preview?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) setDunningPreview(data.preview || data.items || []);
    } catch {
      setDunningPreview([]);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadStatementPack = async () => {
    setStmtBusy(true);
    try {
      const res = await fetch(
        `/api/customers/ar-statement?companyId=${companyId}&format=pack`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setStatementPack(data.pack || null);
      if (!(data.pack?.customers || []).length) {
        toast.message('No open-AR customers for statements');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
      setStatementPack(null);
    } finally {
      setStmtBusy(false);
    }
  };

  const applyBankMatch = async (sug: BankSug) => {
    if (!bankInvoiceId) {
      toast.message('Open Bank reconciliation to apply matches');
      return;
    }
    toast.loading('Matching bank line to invoice…', { id: 'bank-m' });
    try {
      // Reuse accounting allocate via bank auto-match style endpoint
      const res = await fetch('/api/accounting/match-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          bankTxnId: sug.bankTxnId,
          invoiceId: bankInvoiceId,
        }),
      }).catch(() => null);
      if (!res || !res.ok) {
        // Fallback: open recon with hint
        toast.message('Apply in Bank reconciliation', {
          id: 'bank-m',
          description: `Txn ${sug.bankTxnId} · conf ${sug.confidence}%`,
        });
        window.location.href = `/dashboard/accounting/bank-reconciliation?matchTxn=${sug.bankTxnId}&invoiceId=${bankInvoiceId}`;
        return;
      }
      toast.success('Bank line matched to invoice', { id: 'bank-m' });
      setBankSugs([]);
      void load();
    } catch {
      toast.message('Open Bank reconciliation to finish match', { id: 'bank-m' });
    }
  };

  const openDunningPreview = async () => {
    setShowDunPreview(true);
    await loadDunningPreview();
  };

  const dunningOne = async (
    id: number,
    action: 'dunning_send_now' | 'dunning_skip' | 'set_dunning_pause'
  ) => {
    try {
      const res = await fetch('/api/customers/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          type: 'invoice',
          id,
          action,
          pause: action === 'set_dunning_pause' ? true : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        action === 'dunning_send_now'
          ? 'Dunning sent'
          : action === 'set_dunning_pause'
            ? 'Dunning paused'
            : 'Level skipped'
      );
      void loadDunningPreview();
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const sendDunningNow = async () => {
    // Prefer preview list (excludes paused / already-sent); fall back to hub ids
    if (!showDunPreview || !dunningPreview.length) {
      await openDunningPreview();
      toast.message('Review dunning preview, then confirm send');
      return;
    }
    const toSend = dunningPreview
      .filter(
        (p) =>
          !p.paused && p.would_send === true && !p.already_sent_level
      )
      .slice(0, 8);
    if (!toSend.length) {
      toast.message('Nothing to send — all paused, already sent, or no email');
      return;
    }
    setDunBusy(true);
    let sent = 0;
    try {
      for (const row of toSend) {
        const res = await fetch('/api/customers/docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            type: 'invoice',
            id: row.id,
            action: 'dunning_send_now',
          }),
        });
        if (res.ok) sent += 1;
      }
      toast.success(`Dunning sent for ${sent} invoice(s)`);
      void load();
      void loadDunningPreview();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Dunning failed');
    } finally {
      setDunBusy(false);
    }
  };

  return (
    <CustomersPage>
      <CustomersHeader
        title="Money"
        titleAccent="Settle"
        showNav
        description="Open AR, buyer payment claims, installments, dunning, and ledger — settle by default."
        action={
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/customers/money-hub?companyId=${companyId}&format=csv`}
              className="btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-1.5"
            >
              <FileDown className="w-4 h-4" />
              Export CSV
            </a>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-1.5"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void openDunningPreview()}
              className="btn-secondary !py-2 !px-3 text-sm"
            >
              Dunning preview
            </button>
            <button
              type="button"
              disabled={dunBusy}
              onClick={() => void sendDunningNow()}
              className="btn-secondary !py-2 !px-3 text-sm"
            >
              {dunBusy ? 'Sending…' : 'Dunning send-now'}
            </button>
            <button
              type="button"
              disabled={stmtBusy}
              className="btn-secondary !py-2 !px-3 text-sm"
              onClick={() => void loadStatementPack()}
            >
              {stmtBusy ? 'Loading…' : 'Statement pack'}
            </button>
            <Link
              href="/dashboard/customers/ar"
              className="btn-primary !py-2 !px-3 text-sm"
            >
              Full AR aging
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : !hub ? (
        <p className="text-sm text-neutral-500 text-center py-12">
          Could not load money hub.
        </p>
      ) : (
        <div className="space-y-6">
          <SettleFunnelStrip />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              label="Open AR"
              value={hub.openAr.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
              icon={Wallet}
            />
            <Kpi label="Overdue inv" value={String(hub.overdueCount)} />
            <Kpi
              label="Pending claims"
              value={String(hub.pendingClaims)}
              warn={hub.pendingClaims > 0}
            />
            <Kpi
              label="Settled 30d"
              value={String(
                Math.round(Number(hub.settled30d || 0)).toLocaleString()
              )}
            />
          </div>

          {(hub.creditAlerts || []).length > 0 ? (
            <section className="rounded-2xl border border-rose-300 bg-rose-50/60 p-4">
              <p className="text-sm font-black text-rose-950 mb-1">
                Credit policy
              </p>
              <p className="text-[11px] text-rose-900/80 mb-2 leading-relaxed">
                Over-limit or held customers cannot be invoiced/shared until balance
                drops or you clear hold. Collect on Money, then release.
              </p>
              <ul className="text-xs space-y-1">
                {hub.creditAlerts!.map((c) => (
                  <li
                    key={c.customerId}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>
                      <Link
                        href="/dashboard/customers/profiles"
                        className="font-bold text-rose-900 underline"
                      >
                        {c.customerName}
                      </Link>
                      {' · open '}
                      {c.openBalance.toLocaleString()} / limit{' '}
                      {c.creditLimit.toLocaleString()}
                      {c.overBy > 0
                        ? ` · over by ${c.overBy.toLocaleString()}`
                        : ' · on hold'}
                      {c.overBy > 0 ? (
                        <span className="block text-[10px] text-rose-800/80 mt-0.5">
                          Collect ≥ {c.overBy.toLocaleString()} to return under
                          limit, or raise credit limit on profile.
                        </span>
                      ) : null}
                    </span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        className="rounded-full border border-rose-300 bg-white px-2 py-0.5 text-[10px] font-bold text-rose-900"
                        onClick={() => {
                          void (async () => {
                            try {
                              const res = await fetch('/api/customers', {
                                method: 'PATCH',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  companyId,
                                  id: c.customerId,
                                  action: 'set_credit_hold',
                                }),
                              });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok)
                                throw new Error(data.error || 'Failed');
                              toast.success('Credit hold applied');
                              void load();
                            } catch (e: unknown) {
                              toast.error(
                                e instanceof Error ? e.message : 'Failed'
                              );
                            }
                          })();
                        }}
                      >
                        Apply hold
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-900"
                        onClick={() => {
                          void (async () => {
                            try {
                              const res = await fetch('/api/customers', {
                                method: 'PATCH',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  companyId,
                                  id: c.customerId,
                                  action: 'clear_credit_hold',
                                }),
                              });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok)
                                throw new Error(data.error || 'Failed');
                              toast.success('Hold cleared — pay to stay under limit');
                              void load();
                            } catch (e: unknown) {
                              toast.error(
                                e instanceof Error ? e.message : 'Failed'
                              );
                            }
                          })();
                        }}
                      >
                        Clear hold
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {showDunPreview ? (
            <section className="rounded-2xl border border-orange-300 bg-orange-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-sm font-black text-orange-950">
                  Dunning preview — who gets emailed next
                </p>
                <button
                  type="button"
                  className="text-[10px] font-bold underline text-orange-900"
                  onClick={() => setShowDunPreview(false)}
                >
                  Hide
                </button>
              </div>
              <p className="text-[11px] text-orange-900/80 mb-2 leading-relaxed">
                Pause customers you should not blast. Send-now only hits non-paused
                rows (max 8). Sample: gentle day 1 → firm day 7 → final day 14.
              </p>
              {dunningPreview.length === 0 ? (
                <p className="text-xs text-neutral-500">
                  No overdue candidates (or preview empty).
                </p>
              ) : (
                <ul className="text-xs space-y-2 max-h-56 overflow-y-auto">
                  {dunningPreview.slice(0, 15).map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-xl border border-orange-100 px-3 py-2"
                    >
                      <span>
                        <Link
                          href={`/dashboard/customers/invoices?id=${p.id}`}
                          className="font-bold underline text-orange-950"
                        >
                          {p.invoice_number || `#${p.id}`}
                        </Link>
                        {' · '}
                        {p.customer_name || '—'}
                        {p.ladder_day != null
                          ? ` · day ${p.ladder_day} (${p.ladder_label || ''})`
                          : ''}
                        {p.days_past_due != null
                          ? ` · ${p.days_past_due}d late`
                          : ''}
                        {p.balance != null
                          ? ` · ${Number(p.balance).toLocaleString()} ${
                              p.currency || ''
                            }`
                          : ''}
                        {p.paused ? (
                          <span className="ml-1 font-bold text-neutral-500">
                            · paused
                          </span>
                        ) : null}
                        {p.already_sent_level ? (
                          <span className="ml-1 text-neutral-400">
                            · already sent
                          </span>
                        ) : null}
                        {!p.contact_email ? (
                          <span className="ml-1 text-rose-700 font-bold">
                            · no email
                          </span>
                        ) : null}
                      </span>
                      <span className="flex gap-1">
                        <button
                          type="button"
                          className="rounded-full bg-orange-700 text-white px-2 py-0.5 text-[10px] font-bold"
                          onClick={() => void dunningOne(p.id, 'dunning_send_now')}
                        >
                          Send
                        </button>
                        <button
                          type="button"
                          className="rounded-full border px-2 py-0.5 text-[10px] font-bold"
                          onClick={() =>
                            void dunningOne(p.id, 'set_dunning_pause')
                          }
                        >
                          Pause
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {(hub.brokenPromises || []).length > 0 ? (
            <section className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4">
              <p className="text-sm font-black text-amber-950 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Broken promise-to-pay
              </p>
              <ul className="text-xs space-y-1">
                {hub.brokenPromises!.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/dashboard/customers/invoices?id=${p.id}`}
                      className="font-bold underline text-amber-950"
                    >
                      {p.invoice_number || `#${p.id}`}
                    </Link>
                    {' · '}
                    {p.customer_name || 'Customer'} · promise{' '}
                    {p.promise_to_pay_date} · {p.balance.toLocaleString()}{' '}
                    {p.currency}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {hub.openAr < 0.01 &&
          hub.pendingClaims === 0 &&
          (hub.brokenPromises || []).length === 0 ? (
            <section className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-sky-50 p-5">
              <p className="text-sm font-black text-emerald-950">
                Settled — nothing urgent on collections
              </p>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                No open AR or pending claims. Grow volume or close the trust
                loop next.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Link
                  href="/dashboard/connections/discover"
                  className="rounded-full bg-[#00b4d8] text-white text-xs font-bold px-3 py-1.5"
                >
                  Discover open-to-trade
                </Link>
                <Link
                  href="/dashboard?ratePrompt=open"
                  className="rounded-full border border-emerald-300 bg-white text-emerald-950 text-xs font-bold px-3 py-1.5"
                >
                  Rate partners
                </Link>
                <Link
                  href="/dashboard/customers/invoices"
                  className="rounded-full border border-sky-200 bg-white text-sky-900 text-xs font-bold px-3 py-1.5"
                >
                  Issue invoice
                </Link>
              </div>
            </section>
          ) : null}

          {statementPack && statementPack.customers?.length > 0 ? (
            <section className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-sm font-black text-sky-950">
                  Statement pack · {statementPack.customerCount} customer(s) · open{' '}
                  {Number(statementPack.totalOpen || 0).toLocaleString()}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-[10px] font-bold rounded-full bg-sky-700 text-white px-2.5 py-1"
                    onClick={() => {
                      void (async () => {
                        try {
                          const r = await fetch('/api/customers/ar-statement', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              companyId,
                              action: 'email_pack',
                            }),
                          });
                          const j = await r.json().catch(() => ({}));
                          if (!r.ok) throw new Error(j.error || 'Failed');
                          toast.success(
                            `Emailed ${j.emailed}/${j.attempted} statements`
                          );
                        } catch (e: unknown) {
                          toast.error(
                            e instanceof Error ? e.message : 'Failed'
                          );
                        }
                      })();
                    }}
                  >
                    Email all
                  </button>
                  <button
                    type="button"
                    className="text-[10px] font-bold underline text-sky-900"
                    onClick={() => setStatementPack(null)}
                  >
                    Hide
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-56 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-neutral-500 border-b">
                      <th className="py-1.5 pr-2">Customer</th>
                      <th className="py-1.5 pr-2">Open</th>
                      <th className="py-1.5 pr-2">Invs</th>
                      <th className="py-1.5">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementPack.customers.map((c) => (
                      <tr key={c.customerId} className="border-b border-sky-100">
                        <td className="py-1.5 pr-2 font-semibold">
                          {c.customerName}
                        </td>
                        <td className="py-1.5 pr-2 tabular-nums">
                          {c.openBalance.toLocaleString()} {c.currency}
                        </td>
                        <td className="py-1.5 pr-2">{c.openInvoiceCount}</td>
                        <td className="py-1.5">
                          <a
                            href={c.pdfHref}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-[#0077b6] underline"
                          >
                            Open
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {hub.pendingClaims > 0 ? (
            <section className="rounded-2xl border border-teal-300 bg-teal-50/50 p-4">
              <p className="text-sm font-black text-teal-950 mb-1 flex items-center gap-2">
                <Banknote className="w-4 h-4" />
                Claim inbox — open to decide
              </p>
              <p className="text-[11px] text-teal-900/80 mb-2">
                Sorted by age. Open a claim for POP preview, bank match, confirm or
                reject with reason.
              </p>
              <ul className="space-y-2">
                {hub.claims.map((c) => (
                  <li
                    key={c.id}
                    className={`flex flex-wrap items-center justify-between gap-2 text-xs bg-white rounded-xl border px-3 py-2 ${
                      c.slaBreached
                        ? 'border-rose-300 bg-rose-50/40'
                        : 'border-teal-100'
                    }`}
                  >
                    <span className="min-w-0">
                      {c.slaBreached ? (
                        <span className="mr-1.5 rounded-full bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 uppercase">
                          SLA
                        </span>
                      ) : null}
                      {c.ageHours != null ? (
                        <span className="mr-1.5 font-bold text-amber-900">
                          {c.ageHours}h
                        </span>
                      ) : null}
                      <strong>
                        {Number(c.amount).toLocaleString()} {c.currency || ''}
                      </strong>
                      {' · '}
                      {c.invoice_number || `inv #${c.invoice_id}`}
                      {c.customer_name ? ` · ${c.customer_name}` : ''}
                      {c.proof_url ? (
                        <span className="ml-1 text-teal-800 font-bold">· POP</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      disabled={claimBusy === c.id}
                      onClick={() => setClaimDrawer(c as ClaimRow)}
                      className="rounded-full bg-teal-700 text-white px-3 py-1 text-[10px] font-bold"
                    >
                      Review
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {claimDrawer ? (
            <ClaimDecisionDrawer
              companyId={companyId}
              claim={claimDrawer}
              onClose={() => setClaimDrawer(null)}
              onResolved={() => void load()}
            />
          ) : null}

          <section className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-800">Open invoices</p>
              {hub.dunningDue > 0 ? (
                <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {hub.dunningDue} may need dunning
                </span>
              ) : null}
            </div>
            <ul className="divide-y divide-neutral-100">
              {hub.topOpenInvoices.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-neutral-500">
                  No open AR — nice.
                </li>
              ) : (
                hub.topOpenInvoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <div>
                      <Link
                        href={`/dashboard/customers/invoices?id=${inv.id}`}
                        className="font-bold text-slate-900 hover:text-[#0077b6]"
                      >
                        {inv.invoice_number || `#${inv.id}`}
                      </Link>
                      <span className="text-xs text-neutral-500 ml-2">
                        {inv.customer_name || '—'} · {inv.status}
                        {inv.due_date ? ` · due ${inv.due_date}` : ''}
                      </span>
                    </div>
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-[10px] font-bold text-amber-900 underline"
                        onClick={() => {
                          const d = window.prompt(
                            'Promise-to-pay date (YYYY-MM-DD)',
                            new Date(Date.now() + 7 * 86400000)
                              .toISOString()
                              .slice(0, 10)
                          );
                          if (!d) return;
                          void (async () => {
                            try {
                              const res = await fetch('/api/customers/docs', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  companyId,
                                  type: 'invoice',
                                  id: inv.id,
                                  action: 'set_promise_to_pay',
                                  promise_to_pay_date: d.slice(0, 10),
                                }),
                              });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok)
                                throw new Error(data.error || 'Failed');
                              toast.success(`Promise set to ${d.slice(0, 10)}`);
                              void load();
                            } catch (e: unknown) {
                              toast.error(
                                e instanceof Error ? e.message : 'Failed'
                              );
                            }
                          })();
                        }}
                      >
                        Set promise
                      </button>
                      <span className="font-black tabular-nums">
                        {inv.balance.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}{' '}
                        {inv.currency}
                      </span>
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          {bankSugs.length > 0 ? (
            <section className="rounded-2xl border border-sky-300 bg-sky-50 p-4">
              <p className="text-sm font-black text-sky-950 mb-2">
                Bank match suggestions (from last confirm)
              </p>
              <ul className="space-y-2 text-xs">
                {bankSugs.map((s) => (
                  <li
                    key={String(s.bankTxnId)}
                    className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-xl border border-sky-100 px-3 py-2"
                  >
                    <span>
                      {s.amount.toLocaleString()} · conf {s.confidence}% ·{' '}
                      {s.reason}
                      {s.reference ? ` · ref ${s.reference}` : ''}
                    </span>
                    <button
                      type="button"
                      className="rounded-full bg-sky-700 text-white px-2.5 py-1 text-[10px] font-bold"
                      onClick={() => void applyBankMatch(s)}
                    >
                      Apply match
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {(hub.installments || []).length > 0 ? (
            <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
              <p className="text-xs font-bold text-violet-950 mb-2">
                Installment schedule
              </p>
              <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                {hub.installments!.map((r) => (
                  <li
                    key={r.id}
                    className={r.overdue ? 'text-rose-800 font-semibold' : ''}
                  >
                    {r.due_date} · {r.amount.toLocaleString()} · inv{' '}
                    {r.invoice_number || r.invoice_id}
                    {r.overdue ? ' · OVERDUE' : ''}
                    {' · '}
                    <Link
                      href={`/dashboard/customers/invoices?id=${r.invoice_id}`}
                      className="text-[#0077b6] underline"
                    >
                      open
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {hub.recentLedger.length > 0 ? (
            <section className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
              <p className="text-xs font-bold text-emerald-950 mb-2">
                Recent ledger payments
              </p>
              <ul className="text-xs space-y-1">
                {hub.recentLedger.map((e, i) => (
                  <li key={e.id || i}>
                    {Number(e.amount).toLocaleString()} {e.currency || ''} · inv
                    #{e.invoice_id}
                    {e.method ? ` · ${e.method}` : ''} ·{' '}
                    {String(e.paid_at).slice(0, 10)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2 text-xs">
            <Link
              href="/dashboard/accounting/bank-reconciliation"
              className="font-bold text-[#0077b6] underline"
            >
              Bank reconcile
            </Link>
            <Link
              href="/dashboard/customers/ar"
              className="font-bold text-[#0077b6] underline"
            >
              Aging &amp; dunning
            </Link>
            <Link
              href="/dashboard?ratePrompt=open"
              className="font-bold text-[#0077b6] underline"
            >
              Rate partners
            </Link>
          </div>
        </div>
      )}
    </CustomersPage>
  );
}

function Kpi({
  label,
  value,
  warn,
  icon: Icon,
}: {
  label: string;
  value: string;
  warn?: boolean;
  icon?: typeof Wallet;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        warn
          ? 'border-amber-200 bg-amber-50'
          : 'border-neutral-200 bg-white'
      }`}
    >
      <div className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-1">
        {Icon ? <Icon className="w-3 h-3" /> : null}
        {label}
      </div>
      <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
        {value}
      </div>
    </div>
  );
}
