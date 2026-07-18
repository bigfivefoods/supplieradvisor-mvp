'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, CreditCard, Clock, X } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { CompanySubscriptionInfo } from '@/lib/billing/company-subscription';
import { formatZar, COMPANY_SUBSCRIPTION_MONTHLY_ZAR } from '@/lib/billing/company-subscription';

/** Routes always usable when subscription lapsed */
const ALWAYS_ALLOW = [
  '/dashboard/select-company',
  '/dashboard/my-business/billing',
  '/dashboard/my-business/profile',
  '/dashboard/my-business/team',
  '/dashboard/my-business/legal',
  '/dashboard/guide',
];

function isAllowedPath(pathname: string | null): boolean {
  if (!pathname) return true;
  return ALWAYS_ALLOW.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
}

/**
 * Sticky banner + soft gate when trial/subscription is expired or ending soon.
 */
export default function SubscriptionAccessBanner() {
  const pathname = usePathname();
  const companyId = getSelectedCompanyId();
  const [sub, setSub] = useState<CompanySubscriptionInfo | null>(null);
  const [dismissWarn, setDismissWarn] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) {
      setSub(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/business/subscription?companyId=${companyId}&autoTrial=0`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (res.ok && data.subscription) {
        setSub(data.subscription as CompanySubscriptionInfo);
      }
    } catch {
      /* soft */
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load, pathname]);

  if (!companyId || !sub || sub.isLifetime) return null;

  const days = sub.daysRemaining;
  const endingSoon =
    sub.hasAccess &&
    days != null &&
    days <= 7 &&
    (sub.isTrial || sub.isActive || sub.status === 'cancelled');

  const locked = !sub.hasAccess;
  const allow = isAllowedPath(pathname);

  // Soft gate: block interaction outside allowlist when locked
  const showGate = locked && !allow;

  if (!locked && (!endingSoon || dismissWarn)) {
    return null;
  }

  const daysLabel =
    days == null
      ? null
      : days <= 0
        ? 'today'
        : days === 1
          ? '1 day'
          : `${days} days`;

  return (
    <>
      {locked && (
        <div className="border-b border-rose-200 bg-rose-50 px-3 sm:px-4 py-2.5">
          <div className="max-w-screen-2xl mx-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-sm text-rose-950">
                <strong className="font-bold">
                  {sub.status === 'past_due'
                    ? 'Payment past due'
                    : sub.isTrial || sub.status === 'expired'
                      ? 'Trial ended — subscribe to continue trading'
                      : 'Access expired'}
                </strong>
                <span className="text-rose-900/90">
                  {' '}
                  — plans from {formatZar(COMPANY_SUBSCRIPTION_MONTHLY_ZAR)}
                  /mo (save up to 30% prepaid). Profile &amp; billing stay open.
                </span>
              </div>
            </div>
            <Link
              href="/dashboard/my-business/billing?pay=1"
              className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800 touch-manipulation"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Pay &amp; restore access
            </Link>
          </div>
        </div>
      )}

      {!locked && endingSoon && !dismissWarn && (
        <div className="border-b border-amber-200 bg-amber-50 px-3 sm:px-4 py-2.5">
          <div className="max-w-screen-2xl mx-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-950">
                <strong className="font-bold">
                  {sub.isTrial ? 'Free trial' : 'Subscription'} ends
                  {daysLabel ? ` in ${daysLabel}` : ' soon'}
                </strong>
                <span className="text-amber-900/90">
                  {' '}
                  — pick a prepaid term on billing (save up to 30%) before
                  trade tools lock. From{' '}
                  {formatZar(COMPANY_SUBSCRIPTION_MONTHLY_ZAR)}/mo.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/dashboard/my-business/billing?pay=1"
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-amber-800 px-4 py-2 text-xs font-bold text-white hover:bg-amber-900 touch-manipulation"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Choose plan
              </Link>
              <button
                type="button"
                onClick={() => setDismissWarn(true)}
                className="p-2 rounded-lg text-amber-800/60 hover:bg-amber-100"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showGate && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-3xl border border-rose-100 bg-white shadow-2xl p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <h2 className="text-lg font-black text-slate-900">
              Trial ended — pay to continue
            </h2>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Trade tools (invoices, AR, network) pause when the trial ends.
              Profile, team, and billing stay open. Plans from{' '}
              {formatZar(COMPANY_SUBSCRIPTION_MONTHLY_ZAR)}/mo with prepaid
              discounts — founding free seats may still be available.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                href="/dashboard/my-business/billing?pay=1"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#00b4d8] to-[#0077b6] px-5 py-2.5 text-sm font-bold text-white"
              >
                <CreditCard className="w-4 h-4" />
                Pay now on billing
              </Link>
              <Link
                href="/dashboard/my-business/profile"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700"
              >
                Company profile
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
