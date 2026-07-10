'use client';

import { useEffect, useState } from 'react';
import { Wallet, Sparkles } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { usePrivy } from '@privy-io/react-auth';
import { formatZarPrecise } from '@/lib/sales-contractor/commission';

/**
 * Inline “you could earn” badge for quote/invoice totals.
 */
export default function CommissionBadge({
  amount,
  className = '',
}: {
  amount: number;
  className?: string;
}) {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [commission, setCommission] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    if (!companyId || !privyUserId || !Number.isFinite(amount) || amount <= 0) {
      setCommission(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams({
            companyId: String(companyId),
            privyUserId,
            amount: String(amount),
          });
          const res = await fetch(`/api/sales/commission/preview?${params}`);
          const data = await res.json();
          if (cancelled || !res.ok) return;
          setCommission(Number(data.commissionAmount || 0));
          setRate(Number(data.effectiveRatePct || 0));
        } catch {
          /* ignore */
        }
      })();
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [amount, companyId, privyUserId]);

  if (commission == null || amount <= 0) return null;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/15 to-orange-500/10 px-3 py-2 text-amber-100 ${className}`}
    >
      <Wallet className="w-4 h-4 text-amber-300" />
      <div className="text-xs sm:text-sm">
        <span className="text-amber-200/80">Your commission </span>
        <span className="font-black text-amber-50">{formatZarPrecise(commission)}</span>
        {rate != null && (
          <span className="text-amber-200/70"> · ~{rate.toFixed(2)}% eff.</span>
        )}
      </div>
      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
    </div>
  );
}
