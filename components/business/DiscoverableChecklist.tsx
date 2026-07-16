'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import {
  DISCOVERABLE_MIN_COMPLETENESS_PCT,
  type CompletenessResult,
} from '@/lib/business/completeness';

const PRIORITY_KEYS = [
  'trading_name',
  'email',
  'location',
  'registration',
  'logo',
  'address',
  'industry',
] as const;

/**
 * Shown when company wants to be discoverable but is under the completeness bar.
 */
export default function DiscoverableChecklist({
  completeness,
  isDiscoverable,
}: {
  completeness: CompletenessResult | null | undefined;
  isDiscoverable?: boolean | null;
}) {
  if (!completeness) return null;
  if (isDiscoverable === false) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        You are hidden from the public directory. Turn on discoverability in{' '}
        <Link href="/dashboard/my-business/settings" className="font-semibold text-[#0077b6] underline">
          Settings
        </Link>
        .
      </div>
    );
  }
  if (completeness.pct >= DISCOVERABLE_MIN_COMPLETENESS_PCT) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        Profile {completeness.pct}% complete — eligible for directory & discover
        (when discoverable is on).
      </div>
    );
  }

  const checks = PRIORITY_KEYS.map((key) => {
    const found = completeness.checks.find((c) => c.key === key);
    return {
      key,
      label: found?.label || key,
      ok: completeness.map[key] ?? found?.ok ?? false,
    };
  });

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-3 space-y-2">
      <div className="text-sm font-bold text-sky-950">
        Finish your profile to appear in the directory ({completeness.pct}% /{' '}
        {DISCOVERABLE_MIN_COMPLETENESS_PCT}% needed)
      </div>
      <ul className="grid sm:grid-cols-2 gap-1.5 text-xs">
        {checks.map((c) => (
          <li key={c.key} className="flex items-center gap-1.5 text-slate-700">
            {c.ok ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            )}
            {c.label}
          </li>
        ))}
      </ul>
      <Link
        href="/dashboard/my-business/profile"
        className="inline-flex items-center gap-1 text-xs font-bold text-[#0077b6] hover:underline"
      >
        Complete profile <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
