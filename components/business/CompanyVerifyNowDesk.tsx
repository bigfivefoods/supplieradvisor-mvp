'use client';

/**
 * VerifyNow CIPC + bank AVS for the selected company.
 * Paystack checkout on this page, then VerifyNow — same process as Profile.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { Panel } from '@/components/relationship/RelationshipChrome';
import {
  getPaystackPublicKey,
  openPaystackCheckout,
} from '@/lib/billing/paystack-client';

const CIPC_ZAR = 69;
const CIPC_CENTS = CIPC_ZAR * 100;
const BANK_ZAR = 50;
const BANK_CENTS = BANK_ZAR * 100;
const BANK_TYPES = [
  'Current',
  'Savings',
  'Cheque',
  'Transmission',
  'Bond',
  'Credit',
] as const;

type Profile = {
  trading_name?: string | null;
  legal_name?: string | null;
  email?: string | null;
  registration_number?: string | null;
  vat_number?: string | null;
  director_id_number?: string | null;
  verification_status?: string | null;
  is_verified?: boolean | null;
  verification_payment_ref?: string | null;
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  account_type?: string | null;
  branch_code?: string | null;
  bank_verification_status?: string | null;
  metadata?: Record<string, unknown> | null;
};

function asObj(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

export function CompanyVerifyNowDesk({ onChanged }: { onChanged?: () => void }) {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Profile>({});
  const [cipcConsent, setCipcConsent] = useState(false);
  const [bankConsent, setBankConsent] = useState(false);
  const [paying, setPaying] = useState<'cipc' | 'bank' | null>(null);
  const [running, setRunning] = useState<'cipc' | 'bank' | null>(null);
  const [cipcPhase, setCipcPhase] = useState<{
    phase: 'running' | 'success' | 'mismatch' | 'pending' | 'failed';
    message: string;
  } | null>(null);
  const [cipcResult, setCipcResult] = useState<{
    status?: string;
    message?: string;
    verification?: Record<string, unknown>;
  } | null>(null);
  const [bankResult, setBankResult] = useState<{
    status?: string;
    message?: string;
    verification?: Record<string, unknown>;
  } | null>(null);
  const bankSnap = useRef<{
    accountNumber: string;
    branchCode: string;
    bankName: string;
    accountType: string;
    accountName: string;
  } | null>(null);
  const bankInFlight = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/business/profile?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load company');
      const profile = (data.profile || {}) as Profile;
      setForm(profile);
      const meta = asObj(profile.metadata);
      const v = asObj(meta?.verification);
      if (v) {
        setCipcResult({
          status: String(v.status || profile.verification_status || ''),
          message: v.company_name
            ? `Last CIPC check: ${String(v.company_name)}`
            : undefined,
          verification: {
            companyName: v.company_name,
            registrationNumber: v.registration_number,
            companyStatus: v.company_status,
            nameMatch: v.name_match,
          },
        });
      }
      const bv = asObj(meta?.bank_verification);
      if (bv) {
        setBankResult({
          status: String(bv.status || profile.bank_verification_status || ''),
          message: bv.summary ? `Last bank check: ${String(bv.summary)}` : undefined,
          verification: {
            summary: bv.summary,
            accountFound: bv.account_found,
            accountOpen: bv.account_open,
            identityMatch: bv.identity_match,
            acceptsCredits: bv.accepts_credits,
          },
        });
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async (patch: Record<string, unknown>) => {
    const res = await fetch('/api/business/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, privyUserId, ...patch }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save');
    if (data.profile) setForm((prev) => ({ ...prev, ...data.profile }));
  };

  const email =
    String(form.email || user?.email?.address || '').trim();
  const reg = String(form.registration_number || '').trim();
  const vat = String(form.vat_number || '').trim();
  const cipcVerified =
    form.is_verified === true ||
    String(form.verification_status || '').toLowerCase() === 'verified';
  const cipcStatus = String(
    form.verification_status || cipcResult?.status || 'unverified'
  ).toLowerCase();
  const bankVerified =
    String(form.bank_verification_status || bankResult?.status || '').toLowerCase() ===
    'verified';
  const bankStatus = String(
    form.bank_verification_status || bankResult?.status || 'not run'
  ).toLowerCase();
  const hasCipcPay = Boolean(
    form.verification_payment_ref ||
      asObj(asObj(form.metadata)?.verification)?.paystack_reference
  );
  const cipcName = String(
    cipcResult?.verification?.companyName ||
      asObj(asObj(form.metadata)?.verification)?.company_name ||
      ''
  ).trim();
  const nameMismatch =
    !cipcVerified &&
    (cipcStatus === 'mismatch' ||
      String(cipcResult?.verification?.nameMatch || '').toLowerCase() ===
        'mismatch') &&
    cipcName.length > 0;

  const applyCipc = (data: {
    status?: string;
    message?: string;
    profile?: Profile;
    verification?: Record<string, unknown>;
  }) => {
    setCipcResult({
      status: data.status,
      message: data.message,
      verification: data.verification,
    });
    if (data.profile) setForm((prev) => ({ ...prev, ...data.profile }));
    else if (data.status) {
      setForm((prev) => ({
        ...prev,
        verification_status: data.status,
        is_verified: data.status === 'verified',
      }));
    }
  };

  const runCipc = async (
    paystackReference: string | null,
    reusePayment?: boolean
  ) => {
    if (!reusePayment && !paystackReference?.trim()) {
      toast.error(`Payment is required before CIPC (R${CIPC_ZAR}).`);
      return;
    }
    setRunning('cipc');
    setCipcPhase({
      phase: 'running',
      message: reusePayment
        ? 'Re-running CIPC with stored payment…'
        : 'Payment received — CIPC check running…',
    });
    toast.loading(
      reusePayment
        ? 'Re-running CIPC with your previous payment…'
        : 'Payment received — verifying with VerifyNow (CIPC)…',
      { id: 'vn-company' }
    );
    try {
      const res = await fetch('/api/business/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          registrationNumber: reg || undefined,
          vatNumber: vat || undefined,
          ...(paystackReference ? { paystackReference } : {}),
          reusePayment: reusePayment === true,
          consent: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.hint || 'VerifyNow CIPC failed');
      }
      applyCipc(data);
      const st = String(data.status || data.profile?.verification_status || '');
      if (st === 'verified') {
        setCipcPhase({
          phase: 'success',
          message: data.message || 'Verified badge applied — CIPC match confirmed.',
        });
        toast.success(data.message || 'Company verified via VerifyNow', {
          id: 'vn-company',
        });
      } else if (st === 'mismatch') {
        setCipcPhase({
          phase: 'mismatch',
          message:
            data.message ||
            'CIPC name mismatch — apply the CIPC name, then re-run (no second charge).',
        });
        toast.message('CIPC name mismatch', { id: 'vn-company', duration: 9000 });
      } else {
        setCipcPhase({
          phase: 'pending',
          message: data.message || `Status: ${st || 'pending'}.`,
        });
        toast.message(data.message || 'CIPC finished — badge not verified yet', {
          id: 'vn-company',
        });
      }
      onChanged?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Verification failed';
      setCipcPhase({ phase: 'failed', message: msg });
      toast.error(msg, { id: 'vn-company', duration: 10000 });
    } finally {
      setRunning(null);
      setPaying(null);
    }
  };

  const startCipcPay = async () => {
    if (!reg && !vat) {
      toast.error('Add a CIPC registration number (or VAT number) first.');
      return;
    }
    if (!cipcConsent) {
      toast.error('Confirm consent before paying for CIPC.');
      return;
    }
    if (!email) {
      toast.error('Add a company email on Profile before Paystack checkout.');
      return;
    }
    const key = getPaystackPublicKey();
    if (!key) {
      toast.error('Paystack is not configured.');
      return;
    }
    try {
      await persist({
        registration_number: reg || null,
        vat_number: vat || null,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not save numbers');
      return;
    }
    setPaying('cipc');
    const ref = `sa-verify-${companyId}-${Date.now()}`;
    try {
      await openPaystackCheckout({
        key,
        email,
        amountCents: CIPC_CENTS,
        currency: 'ZAR',
        ref,
        metadata: {
          company_id: String(companyId),
          purpose: 'verifynow_company_verification',
          amount_zar: String(CIPC_ZAR),
        },
        onSuccess: (reference) => {
          void runCipc(reference || ref);
        },
        onClose: () => setPaying(null),
      });
    } catch (e: unknown) {
      setPaying(null);
      toast.error(e instanceof Error ? e.message : 'Could not open Paystack');
    }
  };

  const rerunCipc = () => {
    if (!cipcConsent && !hasCipcPay) {
      toast.error('Confirm consent before re-running CIPC.');
      return;
    }
    void runCipc(null, true);
  };

  const recoverBadge = async () => {
    setRunning('cipc');
    toast.loading('Applying verified badge from last CIPC result…', {
      id: 'vn-recover',
    });
    try {
      const res = await fetch('/api/business/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'apply_from_metadata',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Recovery failed');
      applyCipc(data);
      toast.success(data.message || 'Verified badge applied', { id: 'vn-recover' });
      onChanged?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Recovery failed', {
        id: 'vn-recover',
      });
    } finally {
      setRunning(null);
    }
  };

  const applyCipcName = async () => {
    setRunning('cipc');
    toast.loading('Applying CIPC name and re-checking…', { id: 'cipc-name' });
    try {
      const res = await fetch('/api/business/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'apply_cipc_name',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Could not apply name');
      applyCipc(data);
      if (data.trading_name) {
        setForm((prev) => ({
          ...prev,
          trading_name: data.trading_name,
          legal_name: data.legal_name || data.trading_name,
        }));
      }
      toast.success(data.message || 'Applied CIPC name', { id: 'cipc-name' });
      onChanged?.();
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not apply CIPC name', {
        id: 'cipc-name',
      });
    } finally {
      setRunning(null);
    }
  };

  const runBank = async (paystackReference: string) => {
    if (!paystackReference?.trim()) {
      toast.error(`Payment is required before bank AVS (R${BANK_ZAR}).`);
      setPaying(null);
      return;
    }
    const snap = bankSnap.current;
    const accountNumber =
      snap?.accountNumber || String(form.account_number || '').replace(/\s/g, '');
    const branchCode =
      snap?.branchCode || String(form.branch_code || '').replace(/\s/g, '');
    if (!accountNumber || !/^\d{6}$/.test(branchCode)) {
      toast.error('Missing bank account number or 6-digit branch code.');
      setPaying(null);
      setRunning(null);
      return;
    }
    bankInFlight.current = true;
    setRunning('bank');
    toast.loading('Payment received — verifying bank with VerifyNow…', {
      id: 'vn-bank',
    });
    try {
      const res = await fetch('/api/business/verify-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          paystackReference,
          bankAccountNumber: accountNumber,
          bankBranchCode: branchCode,
          bankName: snap?.bankName || form.bank_name || undefined,
          bankAccountType: snap?.accountType || form.account_type || 'Current',
          accountName: snap?.accountName || form.account_name || undefined,
          consent: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.hint || 'Bank verification failed');
      }
      if (data.profile) setForm((prev) => ({ ...prev, ...data.profile }));
      setBankResult({
        status: data.status,
        message: data.message,
        verification: data.verification,
      });
      toast.success(data.message || 'Bank account verified via VerifyNow', {
        id: 'vn-bank',
      });
      onChanged?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Bank verification failed', {
        id: 'vn-bank',
        duration: 8000,
      });
    } finally {
      setRunning(null);
      setPaying(null);
      bankInFlight.current = false;
    }
  };

  const startBankPay = async () => {
    const accountNumber = String(form.account_number || '').replace(/\s/g, '');
    const branchCode = String(form.branch_code || '').replace(/\s/g, '');
    if (!bankConsent) {
      toast.error('Tick consent before verifying the bank account.');
      return;
    }
    if (!accountNumber) {
      toast.error('Enter the bank account number first.');
      return;
    }
    if (!/^\d{6}$/.test(branchCode)) {
      toast.error('Enter a valid 6-digit branch code.');
      return;
    }
    if (!reg && !String(form.director_id_number || '').replace(/\s/g, '')) {
      toast.error(
        'Add a CIPC registration number or director SA ID (Profile → Licenses) first.'
      );
      return;
    }
    const accountName = String(
      form.account_name || form.legal_name || form.trading_name || ''
    ).trim();
    if (!accountName) {
      toast.error('Enter the account name (name on the bank account).');
      return;
    }
    if (!email) {
      toast.error('Add a company email on Profile for Paystack checkout.');
      return;
    }
    const key = getPaystackPublicKey();
    if (!key) {
      toast.error('Paystack is not configured.');
      return;
    }
    try {
      await persist({
        bank_name: form.bank_name || null,
        account_name: accountName,
        account_number: accountNumber,
        account_type: form.account_type || 'Current',
        branch_code: branchCode,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not save bank details');
      return;
    }
    bankSnap.current = {
      accountNumber,
      branchCode,
      bankName: String(form.bank_name || '').trim(),
      accountType: String(form.account_type || 'Current').trim() || 'Current',
      accountName,
    };
    setPaying('bank');
    const ref = `sa-bank-${companyId}-${Date.now()}`;
    try {
      await openPaystackCheckout({
        key,
        email,
        amountCents: BANK_CENTS,
        currency: 'ZAR',
        ref,
        metadata: {
          company_id: String(companyId),
          purpose: 'verifynow_bank_verification',
          amount_zar: String(BANK_ZAR),
        },
        onSuccess: (reference) => {
          bankInFlight.current = true;
          void runBank(reference || ref);
        },
        onClose: () => {
          if (bankInFlight.current) return;
          setPaying(null);
        },
      });
    } catch (e: unknown) {
      setPaying(null);
      toast.error(e instanceof Error ? e.message : 'Could not open Paystack');
    }
  };

  const set = (field: keyof Profile, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const inputCls = 'input w-full !py-2 !px-2.5 !text-sm';

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div
          className={`rounded-2xl border px-4 py-3 ${
            cipcVerified
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-neutral-200 bg-white'
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
            CIPC · VerifyNow
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-black text-slate-900">
            <ShieldCheck
              className={`h-4 w-4 ${cipcVerified ? 'text-emerald-600' : 'text-neutral-300'}`}
            />
            {cipcVerified ? 'Verified' : cipcStatus || 'Unverified'}
          </p>
        </div>
        <div
          className={`rounded-2xl border px-4 py-3 ${
            bankVerified
              ? 'border-sky-200 bg-sky-50'
              : 'border-neutral-200 bg-white'
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
            Bank AVS · VerifyNow
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-black text-slate-900">
            <Wallet
              className={`h-4 w-4 ${bankVerified ? 'text-sky-600' : 'text-neutral-300'}`}
            />
            {bankVerified ? 'Verified' : bankStatus}
          </p>
        </div>
      </div>

      {nameMismatch ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-black">CIPC name does not match your profile</p>
              <div className="grid sm:grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-white/80 border border-amber-200 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-neutral-400">
                    On your profile
                  </p>
                  <p className="font-semibold truncate">
                    {form.trading_name || form.legal_name || '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-white/80 border border-emerald-200 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-emerald-700">
                    From CIPC
                  </p>
                  <p className="font-semibold text-emerald-900 truncate">{cipcName}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={running === 'cipc'}
                onClick={() => void applyCipcName()}
                className="btn-primary !py-2 !px-3 text-xs"
              >
                {running === 'cipc' ? 'Applying…' : 'Use CIPC name & re-verify (no re-pay)'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel
          title="CIPC company check"
          action={
            <span className="text-[11px] font-black tabular-nums text-[#0077b6]">
              R{CIPC_ZAR}
            </span>
          }
        >
          <div className="p-4 space-y-3">
            <p className="text-[12px] text-neutral-600 leading-relaxed">
              Live VerifyNow CIPC lookup. Pay via Paystack on this page — the check
              runs here, you never leave SupplierAdvisor.
            </p>
            <div className="grid sm:grid-cols-2 gap-2.5">
              <label className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Registration no.
                </span>
                <input
                  className={`${inputCls} font-mono mt-0.5`}
                  value={form.registration_number || ''}
                  onChange={(e) => set('registration_number', e.target.value)}
                  placeholder="2020/123456/07"
                />
              </label>
              <label className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  VAT number
                </span>
                <input
                  className={`${inputCls} font-mono mt-0.5`}
                  value={form.vat_number || ''}
                  onChange={(e) => set('vat_number', e.target.value)}
                />
              </label>
            </div>
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-neutral-300 text-[#00b4d8] focus:ring-[#00b4d8]"
                checked={cipcConsent}
                onChange={(e) => setCipcConsent(e.target.checked)}
              />
              <span className="text-[11px] text-neutral-600 leading-snug">
                Authorise a CIPC check via VerifyNow (KYB / FICA-style).
              </span>
            </label>
            <button
              type="button"
              disabled={paying === 'cipc' || running === 'cipc'}
              onClick={() => void startCipcPay()}
              className="btn-primary w-full !py-2.5 text-sm inline-flex items-center justify-center gap-1.5"
            >
              {paying === 'cipc' || running === 'cipc' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {cipcVerified
                ? `Pay R${CIPC_ZAR} & re-verify`
                : `Pay R${CIPC_ZAR} & verify CIPC`}
            </button>
            {cipcPhase ? (
              <div
                className={`rounded-xl border px-3 py-2.5 text-[12px] leading-snug ${
                  cipcPhase.phase === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                    : cipcPhase.phase === 'running'
                      ? 'border-sky-200 bg-sky-50 text-sky-950'
                      : cipcPhase.phase === 'mismatch'
                        ? 'border-amber-200 bg-amber-50 text-amber-950'
                        : 'border-rose-200 bg-rose-50 text-rose-950'
                }`}
              >
                <p className="font-black uppercase tracking-wide text-[10px] mb-0.5">
                  {cipcPhase.phase === 'running'
                    ? 'CIPC running…'
                    : cipcPhase.phase === 'success'
                      ? 'Verified'
                      : cipcPhase.phase === 'mismatch'
                        ? 'Name mismatch'
                        : cipcPhase.phase === 'pending'
                          ? 'Paid · badge pending'
                          : 'CIPC failed'}
                </p>
                <p>{cipcPhase.message}</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={running === 'cipc' || paying === 'cipc'}
                onClick={rerunCipc}
                className="btn-secondary !py-1.5 !px-3 text-xs"
              >
                Re-run CIPC (reuse payment)
              </button>
              {hasCipcPay || asObj(asObj(form.metadata)?.verification) ? (
                <button
                  type="button"
                  disabled={running === 'cipc'}
                  onClick={() => void recoverBadge()}
                  className="rounded-xl border border-amber-300 bg-amber-50 !py-1.5 !px-3 text-xs font-bold text-amber-950"
                >
                  Apply verified from last result
                </button>
              ) : null}
            </div>
            {cipcResult?.verification?.companyName ||
            cipcResult?.verification?.registrationNumber ? (
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3 space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <Building2 className="h-3.5 w-3.5" />
                  CIPC result
                  {cipcVerified ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : null}
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
                  {cipcResult.verification.companyName ? (
                    <>
                      <dt className="text-neutral-500">Name</dt>
                      <dd className="font-semibold truncate">
                        {String(cipcResult.verification.companyName)}
                      </dd>
                    </>
                  ) : null}
                  {cipcResult.verification.registrationNumber ? (
                    <>
                      <dt className="text-neutral-500">Reg.</dt>
                      <dd className="font-mono truncate">
                        {String(cipcResult.verification.registrationNumber)}
                      </dd>
                    </>
                  ) : null}
                  {cipcResult.verification.companyStatus ? (
                    <>
                      <dt className="text-neutral-500">Status</dt>
                      <dd className="font-semibold">
                        {String(cipcResult.verification.companyStatus)}
                      </dd>
                    </>
                  ) : null}
                </dl>
              </div>
            ) : null}
            <p className="text-[11px] text-neutral-500">
              Payment alone does not set the badge — CIPC must pass.{' '}
              <Link
                href="/dashboard/my-business/profile#identity"
                className="font-semibold text-[#0077b6] hover:underline"
              >
                Full identity on Profile
              </Link>
            </p>
          </div>
        </Panel>

        <Panel
          title="Bank account AVS"
          action={
            <span className="text-[11px] font-black tabular-nums text-[#0077b6]">
              R{BANK_ZAR}
            </span>
          }
        >
          <div className="p-4 space-y-3">
            <p className="text-[12px] text-neutral-600 leading-relaxed">
              VerifyNow ownership check. Needs account + branch, and a CIPC
              registration number or director SA ID.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Bank name
                </span>
                <input
                  className={`${inputCls} mt-0.5`}
                  value={form.bank_name || ''}
                  onChange={(e) => set('bank_name', e.target.value)}
                  placeholder="FNB, Capitec…"
                />
              </label>
              <label className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Account type
                </span>
                <select
                  className={`${inputCls} mt-0.5`}
                  value={form.account_type || 'Current'}
                  onChange={(e) => set('account_type', e.target.value)}
                >
                  {BANK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Account name
                </span>
                <input
                  className={`${inputCls} mt-0.5`}
                  value={form.account_name || ''}
                  onChange={(e) => set('account_name', e.target.value)}
                />
              </label>
              <label className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Account number
                </span>
                <input
                  className={`${inputCls} font-mono mt-0.5`}
                  value={form.account_number || ''}
                  onChange={(e) => set('account_number', e.target.value)}
                  inputMode="numeric"
                />
              </label>
              <label className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Branch code
                </span>
                <input
                  className={`${inputCls} font-mono mt-0.5`}
                  value={form.branch_code || ''}
                  onChange={(e) =>
                    set('branch_code', e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="6 digits"
                  inputMode="numeric"
                  maxLength={6}
                />
              </label>
            </div>
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-neutral-300 text-[#00b4d8] focus:ring-[#00b4d8]"
                checked={bankConsent}
                onChange={(e) => setBankConsent(e.target.checked)}
              />
              <span className="text-[11px] text-neutral-600 leading-snug">
                Authorise a bank ownership check via VerifyNow after R{BANK_ZAR}{' '}
                payment.
              </span>
            </label>
            <button
              type="button"
              disabled={paying === 'bank' || running === 'bank'}
              onClick={() => void startBankPay()}
              className="btn-primary w-full !py-2.5 text-sm inline-flex items-center justify-center gap-1.5"
            >
              {paying === 'bank' || running === 'bank' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="h-4 w-4" />
              )}
              {bankVerified
                ? `Pay R${BANK_ZAR} & re-verify`
                : `Pay R${BANK_ZAR} & verify bank`}
            </button>
            {bankResult?.verification &&
            (bankResult.verification.summary ||
              bankResult.verification.accountFound) ? (
              <div
                className={`rounded-xl border p-3 text-[11px] space-y-1 ${
                  bankVerified
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-amber-200 bg-amber-50/40'
                }`}
              >
                {bankResult.message ? (
                  <p className="font-semibold text-slate-800">{bankResult.message}</p>
                ) : null}
                <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  {(
                    [
                      ['Found', bankResult.verification.accountFound],
                      ['Open', bankResult.verification.accountOpen],
                      ['Identity', bankResult.verification.identityMatch],
                      ['Credits', bankResult.verification.acceptsCredits],
                    ] as Array<[string, unknown]>
                  )
                    .filter(([, v]) => v != null && String(v).trim())
                    .map(([label, value]) => (
                      <div key={label} className="contents">
                        <dt className="text-neutral-500">{label}</dt>
                        <dd className="font-semibold text-slate-800">{String(value)}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            ) : null}
            <p className="text-[11px] text-neutral-500">
              Full bank letter and IBAN live on{' '}
              <Link
                href="/dashboard/my-business/profile#banking"
                className="font-semibold text-[#0077b6] hover:underline"
              >
                Profile → Banking
              </Link>
              .
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
