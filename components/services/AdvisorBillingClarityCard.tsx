'use client';

/**
 * Explains what VUKA / SupplierAdvisor bills vs practice revenue.
 */
import { CreditCard, Info } from 'lucide-react';
import Link from 'next/link';

type Props = {
  brand?: string;
  moduleLabel: string;
  accentClass?: string;
};

export function AdvisorBillingClarityCard({
  brand = 'your practice',
  moduleLabel,
  accentClass = 'border-violet-200 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/30',
}: Props) {
  return (
    <div
      className={`rounded-3xl border ${accentClass} px-4 py-3 sm:px-5 sm:py-4`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-white/80 dark:bg-slate-900 p-2 border border-black/5">
          <CreditCard className="w-4 h-4 text-violet-600 dark:text-violet-300" />
        </div>
        <div className="min-w-0 space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-violet-700 dark:text-violet-300 flex items-center gap-1">
            <Info className="w-3 h-3" /> Billing clarity · {moduleLabel}
          </p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            SupplierAdvisor bills the platform subscription only.
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Member fees, class packs, care plans, and chair-side charges stay
            with <strong>{brand}</strong>. Collect them your way (cash, EFT,
            Paystack, etc.) — we do not take a cut of patient or member
            revenue.
          </p>
          <p className="text-[11px] text-slate-500">
            Manage company subscription under{' '}
            <Link
              href="/dashboard/my-business/billing"
              className="font-bold text-violet-700 dark:text-violet-300 underline"
            >
              My Business → Billing
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
