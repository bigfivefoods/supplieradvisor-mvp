'use client';

/**
 * Company SaaS vs member card / Apple Pay settlement, plus the
 * connected payout bank when the Advisor has completed it.
 */
import { useEffect, useState } from 'react';
import { Check, CreditCard, Landmark } from 'lucide-react';
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

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void withAuthJson<{ payout?: AdvisorPayoutPublic }>(
      `/api/advisors/payouts?companyId=${companyId}`
    )
      .then((data) => {
        if (!cancelled) setPayout(data.payout || null);
      })
      .catch(() => {
        if (!cancelled) setPayout(null);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, withAuthJson]);

  const ready = Boolean(payout?.ready);
  const bankLine = [
    payout?.account_name || payout?.business_name,
    payout?.settlement_bank_name,
    payout?.account_last4 ? `•••• ${payout.account_last4}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={`rounded-3xl border ${accentClass} px-4 py-3 sm:px-5 sm:py-4`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl border border-black/5 bg-white/80 p-2 dark:bg-slate-900">
          {ready ? (
            <Landmark className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
          ) : (
            <CreditCard className="h-4 w-4 text-violet-600 dark:text-violet-300" />
          )}
        </div>
        <div className="min-w-0 space-y-1.5">
          <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-violet-700 dark:text-violet-300">
            {moduleLabel} · Card / Apple Pay
          </p>
          {ready ? (
            <>
              <p className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                <Check className="h-4 w-4 text-emerald-600" />
                Payout bank connected
              </p>
              {bankLine ? (
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {bankLine}
                </p>
              ) : null}
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Member card and Apple Pay settle here. Members pay the listed
                price; {brand} pays 1% admin plus card fees.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Connect a payout bank to take card and Apple Pay
              </p>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Company SaaS stays on SupplierAdvisor. Member sales settle to
                your bank. Cash and proof of payment stay with{' '}
                <strong>{brand}</strong>.
              </p>
            </>
          )}
          <p className="text-[11px] text-slate-500">
            <Link
              href={accountsHref}
              className="font-bold text-violet-700 underline dark:text-violet-300"
            >
              {ready ? 'Change bank on Accounts' : 'Add bank on Accounts'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
