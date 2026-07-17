'use client';

/**
 * Self-serve strip when R69 payment exists but verification badge is missing.
 * Re-run CIPC (reuse payment) or apply badge from last CIPC snapshot — no second charge.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Loader2, ShieldCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';

export default function PaidNotBadgedBanner({
  onFixed,
}: {
  onFixed?: () => void;
}) {
  const companyId = getSelectedCompanyId();
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [busy, setBusy] = useState<'rerun' | 'recover' | null>(null);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [hasPayment, setHasPayment] = useState(false);
  const [hasCipcSnapshot, setHasCipcSnapshot] = useState(false);

  const probe = useCallback(async () => {
    if (!companyId || !privyUserId) return;
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        privyUserId,
      });
      const res = await fetch(`/api/business/profile?${params}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const p = (data.profile || data) as Record<string, unknown>;
      const st = String(p.verification_status || '').toLowerCase();
      if (st === 'verified') {
        setShow(false);
        return;
      }
      const payRef = String(p.verification_payment_ref || '').trim();
      const meta =
        p.metadata && typeof p.metadata === 'object'
          ? (p.metadata as Record<string, unknown>)
          : {};
      const v =
        meta.verification && typeof meta.verification === 'object'
          ? (meta.verification as Record<string, unknown>)
          : {};
      const metaPay = Boolean(v.paystack_reference || v.paystackReference);
      const paid = Boolean(payRef || metaPay);
      const snap = Boolean(v.company_name || v.raw || v.registration_number);
      setStatus(st || 'unverified');
      setHasPayment(paid);
      setHasCipcSnapshot(snap);
      // Show when paid and not verified (mismatch has its own banner; still useful here)
      setShow(paid && st !== 'verified');
    } catch {
      setShow(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void probe();
  }, [probe]);

  if (!show || !companyId) return null;

  const run = async (action: 'reuse_and_verify' | 'apply_from_metadata') => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    const key = action === 'reuse_and_verify' ? 'rerun' : 'recover';
    setBusy(key);
    toast.loading(
      action === 'reuse_and_verify'
        ? 'Re-running CIPC with your stored payment…'
        : 'Applying verified badge from last CIPC result…',
      { id: 'paid-badge' }
    );
    try {
      const res = await fetch('/api/business/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.hint || 'Action failed');
      }
      const next = String(data.status || data.profile?.verification_status || '');
      toast.success(
        next === 'verified'
          ? 'Verified badge applied'
          : data.message || 'CIPC updated — check profile if still pending',
        { id: 'paid-badge' }
      );
      await probe();
      onFixed?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed', {
        id: 'paid-badge',
        description: 'Open Profile → Identity for full CIPC options.',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-rose-300 bg-gradient-to-br from-rose-50 via-white to-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between shadow-sm">
      <div className="min-w-0 flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-black text-rose-950">
            Payment recorded — verified badge missing
          </p>
          <p className="text-xs text-rose-900/90 mt-0.5 leading-relaxed">
            Status: <strong>{status || 'pending'}</strong>. R69 already taken —
            re-run CIPC with the same payment or apply the badge if CIPC already
            matched. No second charge.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        <Link
          href="/dashboard/my-business/profile#identity"
          className="btn-secondary !py-2 !px-3 text-xs"
        >
          Open profile
        </Link>
        <button
          type="button"
          disabled={busy != null || !hasPayment}
          onClick={() => void run('reuse_and_verify')}
          className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
          title="Re-run VerifyNow using stored Paystack reference"
        >
          {busy === 'rerun' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Re-run CIPC
        </button>
        {hasCipcSnapshot ? (
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void run('apply_from_metadata')}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
          >
            {busy === 'recover' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            Apply badge
          </button>
        ) : null}
      </div>
    </div>
  );
}
