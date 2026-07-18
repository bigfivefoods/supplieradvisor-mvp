/**
 * Public SEO story: paid CIPC verification + platform SLA (crawlable).
 */
import { ShieldCheck, Clock } from 'lucide-react';
import Link from 'next/link';

export default function VerifiedSlaBadge({
  verified,
  companyName,
  compact,
}: {
  verified: boolean;
  companyName?: string;
  compact?: boolean;
}) {
  if (!verified) {
    if (compact) return null;
    return (
      <aside className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">
        <p className="font-semibold text-slate-800">Identity not CIPC-verified yet</p>
        <p className="text-xs mt-1 leading-relaxed">
          On SupplierAdvisor, companies can pay R69 for a live CIPC company
          match. Verified listings show a badge and aim for same-day resolution
          under a 24-hour paid verification SLA.
        </p>
        <Link
          href="/onboarding?type=business"
          className="inline-block mt-2 text-xs font-bold text-[#0077b6] hover:underline"
        >
          List &amp; verify your company →
        </Link>
      </aside>
    );
  }

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-900">
        <ShieldCheck className="w-3.5 h-3.5" />
        CIPC verified · 24h paid SLA
      </span>
    );
  }

  return (
    <aside
      className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-4 py-4"
      itemScope
      itemType="https://schema.org/Organization"
    >
      <div className="flex items-start gap-2">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-black text-emerald-950">
            CIPC-verified identity
            {companyName ? (
              <span className="font-semibold text-emerald-900/80">
                {' '}
                · {companyName}
              </span>
            ) : null}
          </p>
          <p className="text-xs text-emerald-900/85 mt-1 leading-relaxed">
            This company completed paid CIPC company verification on
            SupplierAdvisor. Payment is confirmed via Paystack; verification
            targets a <strong>24-hour SLA</strong> from successful payment to
            badge (or clear mismatch/failure with self-serve re-run — no second
            charge).
          </p>
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-sky-900">
            <Clock className="w-3.5 h-3.5" />
            Money → trust path: pay R69 → CIPC match → public badge
          </p>
          <p className="text-[11px] text-neutral-500 mt-2">
            Learn more in the{' '}
            <Link href="/directory" className="font-semibold text-[#0077b6] hover:underline">
              verified company directory
            </Link>
            .
          </p>
        </div>
      </div>
    </aside>
  );
}
