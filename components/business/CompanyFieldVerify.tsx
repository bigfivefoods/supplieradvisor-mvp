'use client';

import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { getPaystackPublicKey, openPaystackCheckout } from '@/lib/billing/paystack-client';
import { buildFieldCheckReference, type FieldCheckRefId } from '@/lib/verifynow/pay-then-check';

type MatchFlag = 'match' | 'mismatch' | 'partial' | 'unknown';

type FieldSummary = {
  check: string;
  status: string;
  source: string;
  checked_at: string;
  subject_masked?: string | null;
  matches?: Partial<Record<string, MatchFlag>>;
  detail?: string;
  price_excl_vat_zar?: number;
  paystack_reference?: string | null;
  amount_zar?: number | null;
  payment_status?: 'paid' | 'refunded' | null;
};

type Product = {
  id: string;
  label: string;
  guideName: string;
  credits: number;
  priceExclVatZar: number;
  priceLabel: string;
  customerZar?: number;
  customerCents?: number;
  customerPriceLabel?: string;
};

type Snapshot = {
  configured: boolean;
  canRun: boolean;
  mode: string;
  checks: Record<string, FieldSummary>;
  disabledReason: string | null;
  directVatCheck: boolean;
  vatNote: string;
  supplierBundleNote: string;
  supplierBundle: {
    availableAsSingleApi: boolean;
    priceLabel: string;
    credits: number;
    customerZar?: number;
    customerCents?: number;
    customerPriceLabel?: string;
    listZar?: number;
  };
  checksCatalogue: Product[];
  asyncBank: boolean;
};

type Focus = 'registration' | 'name' | 'vat' | 'director' | 'bank';

type Quote = { label: string; cents: number; zar: number };

const memory = new Map<number, Snapshot>();
const waiters = new Map<number, Promise<Snapshot>>();
const listeners = new Map<number, Set<(row: Snapshot) => void>>();

function publish(companyId: number, row: Snapshot) {
  memory.set(companyId, row);
  listeners.get(companyId)?.forEach((listener) => listener(row));
}

async function loadSnapshot(companyId: number): Promise<Snapshot> {
  const cached = waiters.get(companyId);
  if (cached) return cached;
  const pending = fetch(`/api/business/verifynow/fields?companyId=${companyId}`)
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load verification');
      const row: Snapshot = {
        configured: Boolean(data.configured),
        canRun: Boolean(data.canRun),
        mode: String(data.mode || 'sandbox'),
        checks: (data.checks && !Array.isArray(data.checks) ? data.checks : {}) as Record<
          string,
          FieldSummary
        >,
        disabledReason: data.disabledReason ? String(data.disabledReason) : null,
        directVatCheck: data.directVatCheck === true,
        vatNote: String(data.vatNote || ''),
        supplierBundleNote: String(data.supplierBundleNote || ''),
        supplierBundle: data.supplierBundle,
        checksCatalogue: Array.isArray(data.catalogue) ? data.catalogue : [],
        asyncBank: Boolean(data.asyncBank),
      };
      publish(companyId, row);
      return row;
    })
    .finally(() => {
      waiters.delete(companyId);
    });
  waiters.set(companyId, pending);
  return pending;
}

function useSnapshot(companyId: number) {
  const [row, setRow] = useState<Snapshot | null>(memory.get(companyId) || null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const set = listeners.get(companyId) || new Set();
    const listener = (next: Snapshot) => {
      if (alive) setRow(next);
    };
    set.add(listener);
    listeners.set(companyId, set);
    if (!memory.has(companyId)) {
      void loadSnapshot(companyId).catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'Could not load verification');
      });
    }
    return () => {
      alive = false;
      set.delete(listener);
    };
  }, [companyId]);
  return { row, error, reload: () => loadSnapshot(companyId) };
}

function stamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Badge({
  label,
  status,
  at,
}: {
  label: string;
  status?: string;
  at?: string;
}) {
  if (!status || status === 'unknown') return null;
  const tone =
    status === 'match' || status === 'verified' || status === 'clear'
      ? 'border-[#00b4d8]/30 bg-[#00b4d8]/10 text-[#0077b6]'
      : status === 'pending' || status === 'review' || status === 'partial'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-rose-200 bg-rose-50 text-rose-800';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}
      title={`VerifyNow · ${status}${at ? ` · ${stamp(at)}` : ''}`}
    >
      <ShieldCheck className="h-3 w-3" aria-hidden />
      {label}: {status}
      {at ? <span className="font-semibold normal-case tracking-normal">· {stamp(at)}</span> : null}
    </span>
  );
}

function quoteFor(row: Snapshot, check: string): Quote | null {
  if (check === 'supplier_bundle') {
    const bundle = row.supplierBundle;
    if (!bundle?.customerCents || !bundle.customerPriceLabel) return null;
    return {
      label: bundle.customerPriceLabel,
      cents: bundle.customerCents,
      zar: bundle.customerZar || bundle.customerCents / 100,
    };
  }
  const id = check === 'bank_account' && row.asyncBank ? 'business_bank_account' : check;
  const product =
    row.checksCatalogue.find((item) => item.id === id) ||
    row.checksCatalogue.find((item) => item.id === check);
  if (!product?.customerCents || !product.customerPriceLabel) return null;
  return {
    label: product.customerPriceLabel,
    cents: product.customerCents,
    zar: product.customerZar || product.customerCents / 100,
  };
}

function receiptLine(summary?: FieldSummary) {
  if (!summary?.paystack_reference) return null;
  const amount =
    summary.amount_zar != null && summary.amount_zar > 0 ? `R${summary.amount_zar} · ` : '';
  const state = summary.payment_status === 'refunded' ? 'refunded' : 'receipt';
  return `${amount}Paystack ${state} ${summary.paystack_reference}`;
}

export default function CompanyFieldVerify({
  companyId,
  focus,
  email,
}: {
  companyId: number;
  focus: Focus;
  email?: string;
}) {
  const { row, error } = useSnapshot(companyId);
  const [open, setOpen] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [purpose, setPurpose] = useState(
    'Supplier due diligence for this SupplierAdvisor® company profile'
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (error) {
    return <p className="mt-2 text-xs text-rose-700">{error}</p>;
  }
  if (!row) return null;

  const company = row.checks.cipc_company_match;
  const director = row.checks.cipc_director_search;
  const said = row.checks.said_verification;
  const aml = row.checks.aml_pep;
  const bank = row.checks.bank_account;
  const paystackKey = getPaystackPublicKey();
  const blockedReason = !row.configured
    ? row.disabledReason
    : !row.canRun
      ? 'Only a company owner or admin can run VerifyNow checks.'
      : null;

  async function postCheck(check: string, extra: Record<string, unknown>) {
    const res = await fetch('/api/business/verifynow/fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, check, consent: true, purpose, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Check failed');
    return data as { replayed?: boolean; refunded?: boolean };
  }

  async function refreshBank() {
    setBusy(true);
    setMessage(null);
    try {
      await postCheck('bank_account', { action: 'refresh', consent: false, purpose: '' });
      setMessage('Bank result refreshed.');
      await loadSnapshot(companyId);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Could not refresh');
    } finally {
      setBusy(false);
    }
  }

  async function complete(check: string, paystackReference: string) {
    setBusy(true);
    setMessage(null);
    try {
      const data = await postCheck(check, { paystackReference });
      setMessage(
        data.replayed
          ? 'Returned the saved result for this payment. No second check.'
          : 'Payment verified and the check is saved.'
      );
      setOpen(null);
      setConsent(false);
      await loadSnapshot(companyId);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Check failed');
      await loadSnapshot(companyId);
    } finally {
      setBusy(false);
    }
  }

  async function refund(check: string, paystackReference: string) {
    setBusy(true);
    setMessage(null);
    try {
      await postCheck(check, { action: 'refund', paystackReference, consent: false, purpose: '' });
      setMessage('Payment refunded. This reference cannot run another check.');
      setOpen(null);
      await loadSnapshot(companyId);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Refund failed');
    } finally {
      setBusy(false);
    }
  }

  async function pay(check: string, quote: Quote) {
    const existing = row?.checks[check];
    if (
      existing?.status === 'error' &&
      existing.payment_status !== 'refunded' &&
      existing.paystack_reference
    ) {
      await complete(check, existing.paystack_reference);
      return;
    }
    if (!paystackKey) {
      setMessage('Paystack is not configured. Set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY.');
      return;
    }
    if (!email) {
      setMessage('Add a company email before paying for a check.');
      return;
    }
    setBusy(true);
    setMessage(null);
    let settled = false;
    try {
      const ref = buildFieldCheckReference(check as FieldCheckRefId, companyId, Date.now());
      await openPaystackCheckout({
        key: paystackKey,
        email,
        amountCents: quote.cents,
        currency: 'ZAR',
        ref,
        metadata: {
          company_id: String(companyId),
          check,
          purpose: 'supplier_field_check',
          check_purpose: purpose,
          consent: 'true',
          amount_zar: String(quote.zar),
        },
        onSuccess: (reference) => {
          settled = true;
          void complete(check, reference);
        },
        onClose: () => {
          if (!settled) {
            setBusy(false);
            setMessage('Payment window closed. The check was not run.');
          }
        },
        onError: (err) => {
          settled = true;
          setBusy(false);
          setMessage(err instanceof Error ? err.message : 'Paystack could not open.');
        },
      });
    } catch (err: unknown) {
      if (!settled) {
        setBusy(false);
        setMessage(err instanceof Error ? err.message : 'Paystack could not open.');
      }
    }
  }

  const action = (check: string, label: string) => {
    const quote = quoteFor(row, check);
    const existing = row.checks[check];
    const failed =
      existing?.status === 'error' &&
      existing.payment_status !== 'refunded' &&
      Boolean(existing.paystack_reference);
    const priceLabel = quote?.label;
    return (
      <div className="mt-2">
        <button
          type="button"
          disabled={Boolean(blockedReason) || busy || !quote}
          onClick={() => {
            setOpen(open === check ? null : check);
            setMessage(null);
          }}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#00b4d8] px-3 text-xs font-bold text-[#0077b6] disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400"
        >
          {busy && open === check ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {failed ? `Paid ${priceLabel}` : `Pay ${priceLabel || ''} & verify ${label}`}
        </button>
        {blockedReason ? <p className="mt-1 text-[11px] text-neutral-500">{blockedReason}</p> : null}
        {!blockedReason && !paystackKey ? (
          <p className="mt-1 text-[11px] text-neutral-500">
            Paystack is not configured. Set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY.
          </p>
        ) : null}
        {receiptLine(existing) ? (
          <p className="mt-1 text-[11px] text-neutral-500">{receiptLine(existing)}</p>
        ) : null}
        {open === check && !blockedReason && quote ? (
          <div className="mt-2 rounded-xl border border-[#00b4d8]/30 bg-[#00b4d8]/5 p-3">
            <p className="text-xs leading-relaxed text-slate-700">
              This check is <strong>{quote.label} (VAT inclusive)</strong>. You pay that amount
              through Paystack first. SupplierAdvisor® runs VerifyNow only after the payment is
              verified. One payment equals one check.
              {row.mode === 'sandbox' ? ' Sandbox mode uses no VerifyNow credits.' : ''}
            </p>
            <label className="mt-2 flex items-start gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              <span>
                I confirm the person or company has agreed to this check for the purpose below
                (POPIA).
              </span>
            </label>
            <label className="mt-2 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Purpose
              <textarea
                className="mt-1 w-full rounded-lg border border-neutral-200 bg-white p-2 text-sm font-normal normal-case tracking-normal text-slate-800"
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                rows={2}
              />
            </label>
            {failed ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!consent || purpose.trim().length < 10 || busy}
                  onClick={() => void complete(check, existing?.paystack_reference || '')}
                  className="rounded-full bg-[#00b4d8] px-3 py-1.5 text-xs font-bold text-white disabled:bg-neutral-300"
                >
                  Retry check
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void refund(check, existing?.paystack_reference || '')}
                  className="rounded-full border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-700 disabled:opacity-50"
                >
                  Refund payment
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!consent || purpose.trim().length < 10 || busy || !paystackKey || !email}
                onClick={() => void pay(check, quote)}
                className="mt-2 rounded-full bg-[#00b4d8] px-3 py-1.5 text-xs font-bold text-white disabled:bg-neutral-300"
              >
                Pay {quote.label} & verify
              </button>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="mt-2 space-y-1.5">
      {focus === 'name' ? (
        <Badge label="Name" status={company?.matches?.name} at={company?.checked_at} />
      ) : null}
      {focus === 'registration' ? (
        <>
          <div className="flex flex-wrap gap-1">
            <Badge label="VerifyNow" status={company?.status} at={company?.checked_at} />
            <Badge label="Status" status={company?.matches?.status} at={company?.checked_at} />
            <Badge label="Address" status={company?.matches?.address} at={company?.checked_at} />
            <Badge label="Directors" status={company?.matches?.directors} at={company?.checked_at} />
          </div>
          {action('cipc_company_match', 'company')}
          {action('supplier_bundle', 'supplier bundle')}
          <p className="text-[11px] leading-relaxed text-neutral-500">{row.supplierBundleNote}</p>
        </>
      ) : null}
      {focus === 'vat' ? (
        <>
          <Badge
            label="VAT"
            status={
              director?.matches?.vat && director.matches.vat !== 'unknown'
                ? director.matches.vat
                : company?.matches?.vat
            }
            at={director?.checked_at || company?.checked_at}
          />
          <p className="text-[11px] leading-relaxed text-neutral-500">{row.vatNote}</p>
        </>
      ) : null}
      {focus === 'director' ? (
        <>
          <div className="flex flex-wrap gap-1">
            <Badge label="Director search" status={director?.status} at={director?.checked_at} />
            <Badge label="SA ID" status={said?.status} at={said?.checked_at} />
            <Badge label="AML" status={aml?.status} at={aml?.checked_at} />
          </div>
          {director?.subject_masked ? (
            <p className="text-[11px] text-neutral-500">ID {director.subject_masked}</p>
          ) : null}
          {action('cipc_director_search', 'directorships')}
          {action('said_verification', 'SA ID')}
          {action('aml_pep', 'AML / PEP')}
        </>
      ) : null}
      {focus === 'bank' ? (
        <>
          <div className="flex flex-wrap gap-1">
            <Badge label="Account" status={bank?.status} at={bank?.checked_at} />
            <Badge label="Open" status={bank?.matches?.account_open} at={bank?.checked_at} />
            <Badge label="Holder" status={bank?.matches?.holder} at={bank?.checked_at} />
            <Badge label="Debit" status={bank?.matches?.accepts_debits} at={bank?.checked_at} />
            <Badge label="Credit" status={bank?.matches?.accepts_credits} at={bank?.checked_at} />
          </div>
          {bank?.subject_masked ? (
            <p className="text-[11px] text-neutral-500">Account {bank.subject_masked}</p>
          ) : null}
          {bank?.status === 'pending' && row.canRun && row.configured ? (
            <button
              type="button"
              className="text-xs font-bold text-[#0077b6]"
              onClick={() => void refreshBank()}
            >
              Refresh bank result
            </button>
          ) : null}
          {action('bank_account', row.asyncBank ? 'Capitec Business account' : 'bank account')}
        </>
      ) : null}
      {message ? <p className="text-[11px] text-slate-600">{message}</p> : null}
    </div>
  );
}
