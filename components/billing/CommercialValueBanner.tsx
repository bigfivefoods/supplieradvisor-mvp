'use client';

/**
 * Commercial conversion: why pay + founding honesty + link to plan picker.
 */
import Link from 'next/link';
import { CreditCard, Sparkles } from 'lucide-react';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  formatZar,
} from '@/lib/billing/company-subscription';

export default function CommercialValueBanner({
  trialDaysLeft,
  foundingRemaining,
  show,
  settleProof,
}: {
  trialDaysLeft?: number | null;
  foundingRemaining?: number | null;
  show: boolean;
  /** Live settle metrics — why pay for Money hub */
  settleProof?: {
    openAr?: number | null;
    claimsConfirmed30d?: number | null;
    ledgerPayments30d?: number | null;
    currency?: string | null;
  } | null;
}) {
  if (!show) return null;

  const ccy = (settleProof?.currency || 'ZAR').toUpperCase();
  const openAr = settleProof?.openAr;
  const claims = settleProof?.claimsConfirmed30d;
  const ledger = settleProof?.ledgerPayments30d;

  return (
    <div className="mb-4 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-violet-50 px-4 py-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
        <div>
          <p className="text-sm font-black text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-violet-600" />
            Why subscribe
            {trialDaysLeft != null && trialDaysLeft <= 7 ? (
              <span className="text-[10px] font-bold uppercase text-amber-800 bg-amber-100 rounded-full px-2 py-0.5">
                Trial · {trialDaysLeft}d left
              </span>
            ) : null}
          </p>
          {(openAr != null || claims != null || ledger != null) && (
            <p className="mt-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-100 rounded-xl px-2.5 py-1.5 inline-block">
              Your settle proof
              {openAr != null
                ? ` · open AR ${ccy} ${Number(openAr).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : ''}
              {ledger != null ? ` · ${ledger} ledger payment(s) · 30d` : ''}
              {claims != null ? ` · ${claims} claim(s) confirmed · 30d` : ''}
            </p>
          )}
          <ul className="mt-2 text-xs text-slate-600 space-y-1 list-disc list-inside">
            <li>
              <strong>Money hub</strong> — claims, AR ledger, dunning, bank match
            </li>
            <li>
              <strong>Paid CIPC</strong> — R69 identity badge with 24h SLA
            </li>
            <li>
              <strong>Trade loop</strong> — first trade, network invites, peer trust
            </li>
            <li>
              From {formatZar(COMPANY_SUBSCRIPTION_MONTHLY_ZAR)}/mo · save up to
              30% prepaid · unlimited team seats
            </li>
            {foundingRemaining != null && foundingRemaining > 0 ? (
              <li>
                Founding free seats: <strong>{foundingRemaining}</strong> remaining
                (earliest companies only — not an open forever offer)
              </li>
            ) : (
              <li>Founding free cohort is limited / full — subscribe to continue</li>
            )}
          </ul>
        </div>
        <Link
          href="/dashboard/my-business/billing?pay=1"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#00b4d8] to-[#0077b6] text-white text-xs font-bold px-4 py-2.5"
        >
          <CreditCard className="w-3.5 h-3.5" />
          Choose plan &amp; pay
        </Link>
      </div>
    </div>
  );
}
