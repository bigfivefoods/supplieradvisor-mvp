'use client';

import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';

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
};

type Product = {
  id: string;
  label: string;
  guideName: string;
  credits: number;
  priceExclVatZar: number;
  priceLabel: string;
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
  };
  checksCatalogue: Product[];
  asyncBank: boolean;
};

type Focus = 'registration' | 'name' | 'vat' | 'director' | 'bank';

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

function productFor(row: Snapshot, id: string): Product | undefined {
  return row.checksCatalogue.find((item) => item.id === id);
}

export default function CompanyFieldVerify({
  companyId,
  focus,
}: {
  companyId: number;
  focus: Focus;
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
  const disabled = !row.configured || !row.canRun;
  const disabledReason = !row.configured
    ? row.disabledReason
    : !row.canRun
      ? 'Only a company owner or admin can run VerifyNow checks.'
      : null;

  async function refreshBank() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/business/verifynow/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, check: 'bank_account', action: 'refresh' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not refresh');
      setMessage('Bank result refreshed.');
      await loadSnapshot(companyId);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Could not refresh');
    } finally {
      setBusy(false);
    }
  }

  async function run(check: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/business/verifynow/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, check, consent: true, purpose }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check failed');
      setMessage(data.replayed ? 'Returned the saved result. No second charge.' : 'Check saved.');
      setOpen(null);
      setConsent(false);
      await loadSnapshot(companyId);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setBusy(false);
    }
  }

  const action = (check: string, label: string, price?: string) => (
    <div className="mt-2">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => {
          setOpen(open === check ? null : check);
          setMessage(null);
        }}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#00b4d8] px-3 text-xs font-bold text-[#0077b6] disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400"
      >
        {busy && open === check ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Verify {label}
        {price ? <span className="font-semibold">{price} excl. VAT</span> : null}
      </button>
      {disabledReason ? <p className="mt-1 text-[11px] text-neutral-500">{disabledReason}</p> : null}
      {open === check && !disabled ? (
        <div className="mt-2 rounded-xl border border-[#00b4d8]/30 bg-[#00b4d8]/5 p-3">
          <p className="text-xs leading-relaxed text-slate-700">
            This VerifyNow check costs <strong>{price} excluding VAT</strong>
            {row.mode === 'sandbox' ? ' in the price list. Sandbox mode uses no credits.' : '.'}{' '}
            SupplierAdvisor® sends it from the server. Tick consent and keep the purpose.
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
          <button
            type="button"
            disabled={!consent || purpose.trim().length < 10 || busy}
            onClick={() => void run(check)}
            className="mt-2 rounded-full bg-[#00b4d8] px-3 py-1.5 text-xs font-bold text-white disabled:bg-neutral-300"
          >
            Run check
          </button>
        </div>
      ) : null}
    </div>
  );

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
          {action(
            'cipc_company_match',
            'company',
            productFor(row, 'cipc_company_match')?.priceLabel
          )}
          {action('supplier_bundle', 'supplier bundle', row.supplierBundle?.priceLabel)}
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
          {action(
            'cipc_director_search',
            'directorships',
            productFor(row, 'cipc_director_search')?.priceLabel
          )}
          {action('said_verification', 'SA ID', productFor(row, 'said_verification')?.priceLabel)}
          {action('aml_pep', 'AML / PEP', productFor(row, 'aml_pep')?.priceLabel)}
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
          {action(
            'bank_account',
            row.asyncBank ? 'Capitec Business account' : 'bank account',
            productFor(row, row.asyncBank ? 'business_bank_account' : 'bank_account')?.priceLabel
          )}
        </>
      ) : null}
      {message ? <p className="text-[11px] text-slate-600">{message}</p> : null}
    </div>
  );
}
