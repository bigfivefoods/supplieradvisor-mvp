'use client';

import { CreditCard, Info } from 'lucide-react';
import Link from 'next/link';

export function SchoolAdvisorBillingCard({
  brand = 'your school / programme',
}: {
  brand?: string;
}) {
  return (
    <div className="rounded-3xl border border-violet-200 bg-violet-50/70 px-4 py-3 sm:px-5 sm:py-4 dark:border-violet-800 dark:bg-violet-950/30">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl border border-black/5 bg-white/80 p-2 dark:bg-slate-900">
          <CreditCard className="h-4 w-4 text-violet-600 dark:text-violet-300" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-violet-700 dark:text-violet-300">
            <Info className="h-3 w-3" /> Billing clarity · SchoolAdvisor®
          </p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            SupplierAdvisor bills the platform subscription only.
          </p>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            NSNP food spend, SP invoices, and programme tariffs stay with{' '}
            <strong>{brand}</strong> and your DBE/PEU. We do not take a cut of
            meal funding. Packaging is always <strong>Public Sector</strong>{' '}
            (government process).
          </p>
          <p className="text-[11px] text-slate-500">
            Company subscription:{' '}
            <Link
              href="/dashboard/my-business/billing"
              className="font-bold text-violet-700 underline dark:text-violet-300"
            >
              My Business → Billing
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
