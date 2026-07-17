'use client';

import Link from 'next/link';
import { CheckCircle2, Eye, EyeOff, ArrowRight, Circle } from 'lucide-react';
import {
  DISCOVERABLE_MIN_COMPLETENESS_PCT,
  isEligibleForDiscovery,
  type CompletenessResult,
} from '@/lib/business/completeness';
import { companyPublicPath } from '@/lib/seo/company-public';

/**
 * Explains whether this company appears in Discover / public directory.
 */
export default function SearchVisibilityCard({
  profile,
  completeness,
  isRegistered = true,
  onToggleDiscoverable,
  toggling = false,
}: {
  profile: Record<string, unknown> | null | undefined;
  completeness?: CompletenessResult | { pct: number } | null;
  /** Selected workspace is always a registered company */
  isRegistered?: boolean;
  /** Persist is_discoverable from profile */
  onToggleDiscoverable?: (next: boolean) => void | Promise<void>;
  toggling?: boolean;
}) {
  if (!profile) return null;

  const elig = isEligibleForDiscovery(profile, { isRegistered });
  const pct =
    completeness && 'pct' in completeness
      ? completeness.pct
      : elig.completeness.pct;
  const optedOut =
    profile.is_discoverable === false || profile.is_discoverable === 'false';
  const discoverableOn = !optedOut;

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
      key: 'city',
      label: 'City (Google local SEO)',
      ok: !!String(profile.city || '').trim(),
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
    {
      key: 'logo',
      label: 'Logo (search & cards)',
      ok: !!String(profile.logo_url || '').trim(),
      href: '#identity',
    },
    {
      key: 'blurb',
      label: 'Short description',
      ok: !!String(
        profile.short_description || profile.description || profile.about || ''
      ).trim(),
      href: '#identity',
    },
  ];
  const seoMissing = signals.filter((s) => !s.ok);
  const publicPath = profile?.id
    ? companyPublicPath({
        id: Number(profile.id),
        trading_name: (profile.trading_name as string | null) || null,
        legal_name: (profile.legal_name as string | null) || null,
      })
    : '/directory';

  const toggle = (
    <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        Discoverable
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={discoverableOn}
        disabled={!onToggleDiscoverable || toggling}
        onClick={() => void onToggleDiscoverable?.(!discoverableOn)}
        className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
          discoverableOn ? 'bg-emerald-500' : 'bg-neutral-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            discoverableOn ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </label>
  );

  if (optedOut) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <EyeOff className="w-4 h-4 text-neutral-500" />
            Hidden from Discover & directory
          </div>
          {toggle}
        </div>
        <p className="text-xs text-neutral-600">
          Discoverability is off. Turn the switch on so partners can find you in
          search and the public directory.
        </p>
      </div>
    );
  }

  if (elig.ok) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
            <Eye className="w-4 h-4" />
            Visible in Discover & Google directory
          </div>
          {toggle}
        </div>
        <p className="text-xs text-emerald-900/80">
          Profile {pct}% complete
          {isRegistered
            ? ' · registered workspace'
            : ` · min ${DISCOVERABLE_MIN_COMPLETENESS_PCT}% or country/email/industry`}
          . Your public SEO page can appear in Google via the SupplierAdvisor
          directory.
        </p>
        {seoMissing.length > 0 ? (
          <div className="rounded-xl border border-sky-200 bg-white/80 px-3 py-2">
            <p className="text-[11px] font-bold text-sky-950 mb-1">
              List better on Google — add:
            </p>
            <ul className="grid sm:grid-cols-2 gap-1 text-[11px]">
              {seoMissing.map((s) => (
                <li key={s.key}>
                  <a
                    href={s.href}
                    className="inline-flex items-center gap-1 text-slate-700 hover:text-[#0077b6]"
                  >
                    <Circle className="w-3 h-3 text-sky-400 shrink-0" />
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Link
            href={publicPath}
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:underline"
          >
            View public SEO page <ArrowRight className="w-3 h-3" />
          </Link>
          <Link
            href="/directory"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#0077b6] hover:underline"
          >
            Open directory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
          <EyeOff className="w-4 h-4" />
          Not listed on Google / directory yet
        </div>
        {toggle}
      </div>
      <p className="text-xs text-amber-950/80">
        {elig.reason ||
          `Add country, email, or industry (profile is ${pct}%).`}{' '}
        Complete the checklist so partners can find you on supplieradvisor.com
        and in search.
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
        Fix location & SEO fields <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
