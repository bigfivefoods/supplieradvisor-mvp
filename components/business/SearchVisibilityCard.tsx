'use client';

import Link from 'next/link';
import { CheckCircle2, Eye, EyeOff, ArrowRight, Circle } from 'lucide-react';
import {
  DISCOVERABLE_MIN_COMPLETENESS_PCT,
  isEligibleForDiscovery,
  type CompletenessResult,
} from '@/lib/business/completeness';

/**
 * Explains whether this company appears in Discover / public directory.
 */
export default function SearchVisibilityCard({
  profile,
  completeness,
  isRegistered = true,
}: {
  profile: Record<string, unknown> | null | undefined;
  completeness?: CompletenessResult | { pct: number } | null;
  /** Selected workspace is always a registered company */
  isRegistered?: boolean;
}) {
  if (!profile) return null;

  const elig = isEligibleForDiscovery(profile, { isRegistered });
  const pct =
    completeness && 'pct' in completeness
      ? completeness.pct
      : elig.completeness.pct;
  const optedOut =
    profile.is_discoverable === false || profile.is_discoverable === 'false';

  const signals = [
    {
      key: 'name',
      label: 'Trading / legal name',
      ok: !!String(profile.trading_name || profile.legal_name || '').trim(),
      href: '#identity',
    },
    {
      key: 'country',
      label: 'Country',
      ok: !!String(profile.country || '').trim(),
      href: '#location',
    },
    {
      key: 'email',
      label: 'Email',
      ok: !!String(profile.email || '').trim(),
      href: '#contacts',
    },
    {
      key: 'industry',
      label: 'Industry',
      ok: !!(
        profile.industry ||
        (Array.isArray(profile.industries) && profile.industries[0])
      ),
      href: '#industry',
    },
  ];

  if (optedOut) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <EyeOff className="w-4 h-4 text-neutral-500" />
          Hidden from Discover & directory
        </div>
        <p className="text-xs text-neutral-600">
          Discoverability is off. Turn it on in{' '}
          <Link
            href="/dashboard/my-business/settings"
            className="font-semibold text-[#0077b6] underline"
          >
            Settings
          </Link>{' '}
          so partners can find you.
        </p>
      </div>
    );
  }

  if (elig.ok) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 space-y-1.5">
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
          <Eye className="w-4 h-4" />
          Visible in Discover & public directory
        </div>
        <p className="text-xs text-emerald-900/80">
          Profile {pct}% complete
          {isRegistered
            ? ' · registered workspace'
            : ` · min ${DISCOVERABLE_MIN_COMPLETENESS_PCT}% or country/email/industry`}
          . Others can search and request a connection.
        </p>
        <Link
          href={`/c/${profile.id || ''}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:underline"
        >
          View public page <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
        <EyeOff className="w-4 h-4" />
        Not visible in search yet
      </div>
      <p className="text-xs text-amber-950/80">
        {elig.reason ||
          `Add country, email, or industry (profile is ${pct}%).`}
      </p>
      <ul className="grid sm:grid-cols-2 gap-1.5 text-xs">
        {signals.map((s) => (
          <li key={s.key}>
            <a
              href={s.href}
              className="flex items-center gap-1.5 text-slate-800 hover:text-[#0077b6]"
            >
              {s.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              {s.label}
            </a>
          </li>
        ))}
      </ul>
      <Link
        href="#location"
        className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 hover:underline"
      >
        Fix location first <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
