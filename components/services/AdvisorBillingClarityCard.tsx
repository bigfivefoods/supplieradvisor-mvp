'use client';

/**
 * Prompt to connect Advisor card / Apple Pay. Hidden once a payout bank is set.
 */
import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import Link from 'next/link';
import { useApiAuth } from '@/lib/client/use-api-auth';
import type { AdvisorPayoutPublic } from '@/lib/billing/advisor-payout';

type Props = {
  brand?: string;
  moduleLabel: string;
  accountsHref: string;
  accentClass?: string;
};

export function AdvisorBillingClarityCard({
  brand = 'your practice',
  moduleLabel,
  accountsHref,
  accentClass = 'border-violet-200 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/30',
}: Props) {
  const { companyId, withAuthJson } = useApiAuth();
  const [payout, setPayout] = useState<AdvisorPayoutPublic | null>(null);
  const [loaded, setLoaded] = useState(!companyId);

  useEffect(() => {
    if (!companyId) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void withAuthJson<{ payout?: AdvisorPayoutPublic }>(
      `/api/advisors/payouts?companyId=${companyId}`
    )
      .then((data) => {
        if (!cancelled) {
          setPayout(data.payout || null);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPayout(null);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, withAuthJson]);

  if (!loaded || payout?.ready) return null;

  return (
    <div
      className={`rounded-3xl border ${accentClass} px-4 py-3 sm:px-5 sm:py-4`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl border border-black/5 bg-white/80 p-2 dark:bg-slate-900">
          <CreditCard className="h-4 w-4 text-violet-600 dark:text-violet-300" />
        </div>
        <div className="min-w-0 space-y-1.5">
          <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-violet-700 dark:text-violet-300">
            {moduleLabel} · Card / Apple Pay
          </p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Connect a payout bank to take card and Apple Pay
          </p>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Company SaaS stays on SupplierAdvisor. Member sales settle to your
            bank. Cash and proof of payment stay with <strong>{brand}</strong>.
          </p>
          <p className="text-[11px] text-slate-500">
            <Link
              href={accountsHref}
              className="font-bold text-violet-700 underline dark:text-violet-300"
            >
              Add bank on Accounts
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
