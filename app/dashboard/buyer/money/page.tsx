'use client';

/**
 * Buyer Money hub — open invoices + claim status + pay path.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, Banknote, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  BuyerCompanyRequired,
  BuyerHeader,
} from '@/components/buyer/BuyerShell';

type Inv = {
  id: number;
  invoice_number: string | null;
  supplier_profile_id: number | null;
  supplier_name?: string | null;
  balance: number;
  currency: string;
  status: string;
  due_date: string | null;
  claimStatus: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_branch?: string | null;
};

export default function BuyerMoneyPage() {
  return (
    <BuyerCompanyRequired>
      <Inner />
    </BuyerCompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Inv[]>([]);
  const [pendingClaims, setPendingClaims] = useState(0);
  const [claimTimeline, setClaimTimeline] = useState<
    Array<{
      invoice_id: number;
      status: string;
      amount: number;
      currency: string;
      claimed_at?: string;
      resolved_at?: string | null;
      reference?: string | null;
    }>
  >([]);
  const [claimBusy, setClaimBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/buyer/money-hub?buyerCompanyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setInvoices(data.hub?.openInvoices || []);
      setPendingClaims(Number(data.hub?.pendingClaims || 0));
      setClaimTimeline(data.hub?.claimTimeline || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const claimPaid = async (inv: Inv) => {
    if (!inv.supplier_profile_id || !privyUserId) {
      toast.error('Supplier context missing');
      return;
    }
    if (inv.claimStatus === 'pending' || inv.claimStatus === 'confirmed') {
      toast.message(`Claim already ${inv.claimStatus}`);
      return;
    }
    const ref = window.prompt('Payment reference (bank/EFT ref)', '') || '';
    const proof = window.prompt(
      'Proof URL (optional — paste link to POP / PDF / image)',
      ''
    );
    const notes = window.prompt(
      'Notes for seller (optional)',
      'Payment made — please confirm on AR.'
    );
    setClaimBusy(inv.id);
    try {
      const res = await fetch('/api/buyer/payment-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerCompanyId: companyId,
          privyUserId,
          supplierProfileId: inv.supplier_profile_id,
          invoiceId: inv.id,
          amount: inv.balance,
          currency: inv.currency,
          reference: ref || null,
          proofUrl: proof?.trim() || null,
          notes: notes?.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Claim submitted — seller will confirm');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setClaimBusy(null);
    }
  };

  return (
    <>
      <BuyerHeader
        title="Money"
        description="Open shared invoices, payment claims, and pay notifications — settle with suppliers."
      />
      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 leading-relaxed">
        <p className="font-bold text-slate-900">How to pay &amp; close the loop</p>
        <ol className="mt-1.5 list-decimal list-inside space-y-0.5">
          <li>Pay the supplier using bank details on the invoice PDF.</li>
          <li>
            Click <strong>I paid</strong> with your bank reference (+ optional proof
            URL).
          </li>
          <li>Seller confirms → claim shows confirmed → rate the supplier.</li>
        </ol>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => void load()}
          className="btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-1.5"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <Link
          href="/dashboard/buyer/documents?type=invoice"
          className="btn-secondary !py-2 !px-3 text-sm"
        >
          All shared docs
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-1">
            <Wallet className="w-3 h-3" /> Open invoices
          </div>
          <div className="text-2xl font-black mt-1">{invoices.length}</div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-[10px] font-bold uppercase text-amber-800">
            Claims pending
          </div>
          <div className="text-2xl font-black text-amber-950 mt-1">
            {pendingClaims}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-neutral-500 text-center py-12">
          No open shared invoices. Suppliers share invoices after they bill you.
        </p>
      ) : (
        <ul className="space-y-2">
          {invoices.map((inv) => (
            <li
              key={inv.id}
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-2"
            >
              <div>
                <Link
                  href={`/dashboard/buyer/documents?invoiceId=${inv.id}${
                    inv.supplier_profile_id
                      ? `&supplierProfileId=${inv.supplier_profile_id}`
                      : ''
                  }`}
                  className="font-bold text-slate-900 hover:text-[#0077b6]"
                >
                  {inv.invoice_number || `Invoice #${inv.id}`}
                </Link>
                <div className="text-xs text-neutral-500 mt-0.5">
                  {inv.supplier_name ? `${inv.supplier_name} · ` : ''}
                  {inv.status}
                  {inv.due_date ? ` · due ${inv.due_date}` : ''}
                  {inv.claimStatus ? (
                    <span
                      className={`ml-1.5 font-bold ${
                        inv.claimStatus === 'confirmed'
                          ? 'text-emerald-700'
                          : inv.claimStatus === 'pending'
                            ? 'text-amber-800'
                            : 'text-rose-700'
                      }`}
                    >
                      · claim {inv.claimStatus}
                    </span>
                  ) : null}
                </div>
                {inv.bank_name || inv.bank_account ? (
                  <div className="text-[11px] text-slate-600 mt-1 font-mono">
                    Pay: {inv.bank_name || 'Bank'}
                    {inv.bank_account ? ` · ${inv.bank_account}` : ''}
                    {inv.bank_branch ? ` · branch ${inv.bank_branch}` : ''}
                  </div>
                ) : (
                  <div className="text-[11px] text-neutral-400 mt-1">
                    Bank details on invoice PDF if not listed
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-black tabular-nums text-sm">
                  {inv.balance.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}{' '}
                  {inv.currency}
                </span>
                {!['paid', 'void'].includes(inv.status) &&
                inv.claimStatus !== 'pending' &&
                inv.claimStatus !== 'confirmed' ? (
                  <button
                    type="button"
                    disabled={claimBusy === inv.id}
                    onClick={() => void claimPaid(inv)}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 disabled:opacity-50"
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    I paid
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {claimTimeline.length > 0 ? (
        <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-bold text-slate-800 mb-2">
            Claim timeline
          </p>
          <ul className="text-xs space-y-1.5 max-h-48 overflow-y-auto">
            {claimTimeline.map((c, i) => (
              <li key={`${c.invoice_id}-${i}`}>
                <span
                  className={
                    c.status === 'confirmed'
                      ? 'text-emerald-700 font-bold'
                      : c.status === 'pending'
                        ? 'text-amber-800 font-bold'
                        : 'text-rose-700 font-bold'
                  }
                >
                  {c.status}
                </span>
                {' · inv #'}
                {c.invoice_id} · {c.amount.toLocaleString()} {c.currency}
                {c.reference ? ` · ref ${c.reference}` : ''}
                {c.claimed_at
                  ? ` · claimed ${String(c.claimed_at).slice(0, 10)}`
                  : ''}
                {c.resolved_at
                  ? ` · resolved ${String(c.resolved_at).slice(0, 10)}`
                  : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
