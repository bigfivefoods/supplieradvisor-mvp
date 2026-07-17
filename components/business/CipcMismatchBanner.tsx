'use client';

/**
 * Main-dashboard / hub strip: self-serve CIPC name mismatch fix.
 * Calls apply_cipc_name (uses stored R69 payment — no re-pay).
 */
import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';

export default function CipcMismatchBanner({
  verificationStatus,
  onFixed,
}: {
  verificationStatus?: string | null;
  /** Called after successful apply so parent can refresh KPIs */
  onFixed?: () => void;
}) {
  const status = String(verificationStatus || '').toLowerCase();
  const companyId = getSelectedCompanyId();
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [busy, setBusy] = useState(false);

  if (status !== 'mismatch' || !companyId) return null;

  const apply = async () => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    setBusy(true);
    toast.loading('Applying CIPC name and re-checking…', { id: 'dash-cipc' });
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
      if (!res.ok) {
        throw new Error(data.error || data.hint || 'Could not apply CIPC name');
      }
      toast.success(data.message || 'CIPC name applied', { id: 'dash-cipc' });
      onFixed?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed', {
        id: 'dash-cipc',
        description: 'Open Profile → Identity for full fix options.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div className="min-w-0 flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-black text-amber-950">
            CIPC name does not match your profile
          </p>
          <p className="text-xs text-amber-900/90 mt-0.5 leading-relaxed">
            Apply the registered company name from CIPC and re-verify with your
            existing R69 payment — no second charge.
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
          disabled={busy}
          onClick={() => void apply()}
          className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1.5"
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5" />
          )}
          Fix name & re-verify
        </button>
      </div>
    </div>
  );
}
