'use client';

import { ShieldCheck, Wallet, Star } from 'lucide-react';

export type TrustBadgeInput = {
  verificationStatus?: string | null;
  isVerified?: boolean | null;
  bankVerificationStatus?: string | null;
  /**
   * When false, hide bank verified chip on public surfaces
   * (privacy opt-in: show_bank_verified_public).
   * Default true for authenticated internal UIs.
   */
  showBankBadge?: boolean | null;
  trustScore?: number | null;
  starAvg?: number | null;
  starCount?: number | null;
  otifefPct?: number | null;
  compact?: boolean;
};

/**
 * Shared trust chips for directory, discover, and connection cards.
 */
export default function TrustBadges({
  verificationStatus,
  isVerified,
  bankVerificationStatus,
  showBankBadge = true,
  trustScore,
  starAvg,
  starCount,
  otifefPct,
  compact = false,
}: TrustBadgeInput) {
  const cipc =
    isVerified === true ||
    String(verificationStatus || '').toLowerCase() === 'verified';
  const bank =
    showBankBadge !== false &&
    String(bankVerificationStatus || '').toLowerCase() === 'verified';
  const chip = compact
    ? 'text-[9px] px-1.5 py-0.5'
    : 'text-[10px] px-2 py-0.5';

  return (
    <div className="flex flex-wrap items-center gap-1">
      {cipc ? (
        <span
          className={`inline-flex items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 font-bold uppercase text-emerald-800 ${chip}`}
        >
          <ShieldCheck className="h-3 w-3" /> CIPC
        </span>
      ) : (
        <span
          className={`inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 font-bold uppercase text-slate-500 ${chip}`}
        >
          Unverified
        </span>
      )}
      {bank && (
        <span
          className={`inline-flex items-center gap-0.5 rounded-full border border-sky-200 bg-sky-50 font-bold uppercase text-sky-800 ${chip}`}
        >
          <Wallet className="h-3 w-3" /> Bank
        </span>
      )}
      {trustScore != null && Number.isFinite(Number(trustScore)) && (
        <span
          className={`inline-flex items-center rounded-full border border-neutral-200 bg-white font-bold tabular-nums text-slate-700 ${chip}`}
        >
          Trust {Number(trustScore).toFixed(0)}
        </span>
      )}
      {starAvg != null && (starCount ?? 0) > 0 && (
        <span
          className={`inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 font-bold tabular-nums text-amber-900 ${chip}`}
        >
          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
          {Number(starAvg).toFixed(1)}
        </span>
      )}
      {otifefPct != null && Number.isFinite(Number(otifefPct)) && Number(otifefPct) > 0 && (
        <span
          className={`inline-flex items-center rounded-full border border-violet-100 bg-violet-50 font-bold tabular-nums text-violet-800 ${chip}`}
        >
          OTIFEF {Number(otifefPct).toFixed(0)}%
        </span>
      )}
    </div>
  );
}
