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

  useEffect(() => {
    void load();
  }, [load]);

  const resolveClaim = async (
    claimId: number,
    action: 'confirm' | 'reject'
  ) => {
    setClaimBusy(claimId);
    try {
      const res = await fetch('/api/customers/payment-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, claimId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        action === 'confirm' ? 'Posted to AR ledger' : 'Claim rejected',
        {
          description: data.bankMatchHint || undefined,
        }
      );
      if (
        action === 'confirm' &&
        Array.isArray(data.bankSuggestions) &&
        data.bankSuggestions.length
      ) {
        setBankSugs(data.bankSuggestions as BankSug[]);
        setBankInvoiceId(Number(data.claim?.invoice_id) || null);
      }
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setClaimBusy(null);
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

  const sendDunningNow = async () => {
    const ids = hub?.dunningInvoiceIds || [];
    if (!ids.length) {
      toast.message('No overdue invoices for dunning');
      return;
    }
    setDunBusy(true);
    let sent = 0;
    try {
      for (const id of ids.slice(0, 8)) {
        const res = await fetch('/api/customers/docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            type: 'invoice',
            id,
            action: 'dunning_send_now',
          }),
        });
        if (res.ok) sent += 1;
      }
      toast.success(`Dunning sent for ${sent} invoice(s)`);
      void load();
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
              disabled={dunBusy}
              onClick={() => void sendDunningNow()}
              className="btn-secondary !py-2 !px-3 text-sm"
            >
              {dunBusy ? 'Sending…' : 'Dunning send-now'}
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
              label="Installments overdue"
              value={String(hub.overdueInstallments)}
              warn={hub.overdueInstallments > 0}
            />
          </div>

          {(hub.creditAlerts || []).length > 0 ? (
            <section className="rounded-2xl border border-rose-300 bg-rose-50/60 p-4">
              <p className="text-sm font-black text-rose-950 mb-2">
                Credit limit alerts
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
                    </span>
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
                  </li>
                ))}
              </ul>
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

          {hub.pendingClaims > 0 ? (
            <section className="rounded-2xl border border-teal-300 bg-teal-50/50 p-4">
              <p className="text-sm font-black text-teal-950 mb-2 flex items-center gap-2">
                <Banknote className="w-4 h-4" />
                Buyer payment claims
              </p>
              <ul className="space-y-2">
                {hub.claims.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white rounded-xl border border-teal-100 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <strong>
                        {Number(c.amount).toLocaleString()} {c.currency || ''}
                      </strong>
                      {' · '}
                      {c.invoice_number || `inv #${c.invoice_id}`}
                      {c.customer_name ? ` · ${c.customer_name}` : ''}
                      {c.reference ? ` · ref ${c.reference}` : ''}
                      {c.proof_url ? (
                        <>
                          {' · '}
                          <a
                            href={String(c.proof_url)}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-teal-800 underline"
                          >
                            View POP
                          </a>
                        </>
                      ) : null}
                      {c.notes ? (
                        <span className="block text-neutral-500 mt-0.5 truncate max-w-xs">
                          {String(c.notes).slice(0, 120)}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        disabled={claimBusy === c.id}
                        onClick={() => void resolveClaim(c.id, 'confirm')}
                        className="rounded-full bg-teal-700 text-white px-2.5 py-1 text-[10px] font-bold"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        disabled={claimBusy === c.id}
                        onClick={() => void resolveClaim(c.id, 'reject')}
                        className="rounded-full border px-2.5 py-1 text-[10px] font-bold"
                      >
                        Reject
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
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
