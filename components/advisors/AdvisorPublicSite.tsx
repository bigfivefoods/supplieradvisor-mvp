'use client';

import type { ReactNode } from 'react';
import { Globe, Loader2, Mail, MapPin, Phone } from 'lucide-react';
import { AdvisorPayAccepted } from '@/components/billing/ApplePayAccepted';
import { AdvisorPortalThemeToggle } from '@/components/advisors/AdvisorPortalThemeToggle';

export type AdvisorPublicNavItem = { id: string; label: string };

export type AdvisorPublicHourRow = { days: string; hours: string };

export function advisorBrandInk(color: string): string {
  return isLightBrand(color) ? '#0f172a' : '#ffffff';
}

function isLightBrand(color: string): boolean {
  const hex = color.replace('#', '').trim();
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

export function prettyPublicDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function AdvisorPublicStatus({
  color,
  error,
}: {
  color?: string;
  error?: string | null;
}) {
  if (error) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-6 dark:bg-black">
        <div className="max-w-md rounded-3xl border border-rose-100 bg-white px-6 py-8 text-center shadow-sm dark:border-rose-900/50 dark:bg-neutral-900">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 dark:bg-black">
      <Loader2
        className="h-8 w-8 animate-spin"
        style={{ color: color || '#64748b' }}
      />
    </div>
  );
}

export function AdvisorPublicSite({
  eyebrow,
  brand,
  bio,
  city,
  phone,
  email,
  websiteUrl,
  logoUrl,
  hours,
  color,
  payoutReady,
  nav,
  cta,
  children,
  footerNote,
}: {
  eyebrow: string;
  brand: string;
  bio?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  hours?: AdvisorPublicHourRow[] | null;
  color: string;
  payoutReady?: boolean;
  nav?: AdvisorPublicNavItem[];
  cta?: { href: string; label: string };
  children: ReactNode;
  footerNote?: string;
}) {
  const links = (nav || []).filter((n) => n.id && n.label);
  const tel = phone ? phone.replace(/\s+/g, '') : '';
  const primary = cta || (links[0] ? { href: `#${links[0].id}`, label: links[0].label } : null);
  const siteHref = websiteUrl
    ? websiteUrl.startsWith('http')
      ? websiteUrl
      : `https://${websiteUrl}`
    : '';
  const hourRows = hours || [];
  const hasVisit =
    Boolean(city || phone || email || siteHref || hourRows.length || payoutReady);
  const light = isLightBrand(color);
  const ink = light ? 'text-slate-900' : 'text-white';
  const muted = light ? 'text-slate-700' : 'text-white/70';
  const chip = light ? 'bg-black/10' : 'bg-white/15';
  const hairline = light ? 'border-black/10' : 'border-white/20';

  return (
    <div className="advisor-portal min-h-[100dvh] bg-slate-50 text-slate-900 dark:bg-black dark:text-neutral-50">
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md ${ink} ${light ? 'border-black/10' : 'border-white/10'}`}
        style={{ backgroundColor: color }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-2xl bg-white object-contain p-0.5 shadow-sm md:h-11 md:w-11"
              />
            ) : null}
            <div className="min-w-0">
              <p className={`text-[9px] font-black uppercase tracking-[0.18em] ${muted}`}>
                {eyebrow}
              </p>
              <p className="truncate text-base font-black md:text-lg">{brand}</p>
            </div>
          </div>
          {links.length ? (
            <nav className="hidden items-center gap-0.5 lg:flex">
              {links.map((n) => (
                <a
                  key={n.id}
                  href={`#${n.id}`}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold hover:bg-black/10 ${light ? 'text-slate-800' : 'text-white/90'}`}
                >
                  {n.label}
                </a>
              ))}
            </nav>
          ) : null}
          <div className="flex shrink-0 items-center gap-2 md:hidden">
            <AdvisorPortalThemeToggle onLightBrand={light} />
          </div>
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <AdvisorPortalThemeToggle onLightBrand={light} />
            {phone ? (
              <a
                href={`tel:${tel}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-black hover:bg-black/5 ${light ? 'border-slate-900/20 text-slate-900' : 'border-white/30 text-white hover:bg-white/10'}`}
              >
                Call
              </a>
            ) : null}
            {primary ? (
              <a
                href={primary.href}
                className={`rounded-full px-4 py-1.5 text-xs font-black shadow-sm ${light ? 'bg-slate-900 text-white' : 'bg-white'}`}
                style={light ? undefined : { color }}
              >
                {primary.label}
              </a>
            ) : null}
          </div>
        </div>
        {links.length ? (
          <nav className="flex gap-1 overflow-x-auto px-4 pb-2 scrollbar-none lg:hidden">
            {links.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${chip} ${ink}`}
              >
                {n.label}
              </a>
            ))}
          </nav>
        ) : null}
      </header>

      <section className={`relative overflow-hidden ${ink}`} style={{ backgroundColor: color }}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 20%, #fff 0, transparent 42%), radial-gradient(circle at 88% 80%, #fff 0, transparent 36%)',
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-12 md:items-end md:px-8 md:py-16">
          <div className="md:col-span-7 lg:col-span-8">
            <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${muted}`}>
              {eyebrow}
            </p>
            <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
              {brand}
            </h1>
            {bio ? (
              <p className={`mt-4 max-w-2xl text-sm leading-relaxed md:text-lg ${light ? 'text-slate-800' : 'text-white/90'}`}>
                {bio}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-2">
              {city ? (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${chip}`}>
                  <MapPin className="h-3.5 w-3.5" /> {city}
                </span>
              ) : null}
              {phone ? (
                <a
                  href={`tel:${tel}`}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${chip}`}
                >
                  <Phone className="h-3.5 w-3.5" /> {phone}
                </a>
              ) : null}
              {email ? (
                <a
                  href={`mailto:${email}`}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${chip}`}
                >
                  <Mail className="h-3.5 w-3.5" /> {email}
                </a>
              ) : null}
              {siteHref ? (
                <a
                  href={siteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${chip}`}
                >
                  <Globe className="h-3.5 w-3.5" /> Website
                </a>
              ) : null}
              {payoutReady ? (
                <AdvisorPayAccepted
                  tone={light ? 'onBrandLight' : 'onBrandDark'}
                  size="sm"
                  label="Accepted"
                />
              ) : null}
            </div>
            {primary ? (
              <a
                href={primary.href}
                className={`mt-6 inline-flex rounded-2xl px-5 py-2.5 text-sm font-black shadow-sm md:hidden ${light ? 'bg-slate-900 text-white' : 'bg-white'}`}
                style={light ? undefined : { color }}
              >
                {primary.label}
              </a>
            ) : null}
          </div>
          {hasVisit ? (
            <aside className="hidden md:col-span-5 md:block lg:col-span-4">
              <div className={`rounded-3xl border p-5 shadow-lg backdrop-blur-sm ${hairline} ${light ? 'bg-white/50' : 'bg-white/12'}`}>
                <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${muted}`}>
                  Visit
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {city ? (
                    <li className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {city}
                    </li>
                  ) : null}
                  {phone ? (
                    <li>
                      <a href={`tel:${tel}`} className="flex items-start gap-2 hover:underline">
                        <Phone className="mt-0.5 h-4 w-4 shrink-0" /> {phone}
                      </a>
                    </li>
                  ) : null}
                  {email ? (
                    <li>
                      <a
                        href={`mailto:${email}`}
                        className="flex items-start gap-2 break-all hover:underline"
                      >
                        <Mail className="mt-0.5 h-4 w-4 shrink-0" /> {email}
                      </a>
                    </li>
                  ) : null}
                </ul>
                {hourRows.length ? (
                  <dl className={`mt-4 space-y-1 border-t pt-3 text-xs ${hairline}`}>
                    {hourRows.map((row) => (
                      <div key={row.days} className="flex justify-between gap-3">
                        <dt className={`font-semibold ${muted}`}>{row.days}</dt>
                        <dd className="font-bold tabular-nums">{row.hours}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {payoutReady ? (
                  <div className="mt-4">
                    <AdvisorPayAccepted
                      tone={light ? 'onBrandLight' : 'onBrandDark'}
                      size="sm"
                    />
                  </div>
                ) : null}
              </div>
            </aside>
          ) : null}
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8 md:space-y-14 md:px-8 md:py-12">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white dark:border-white/10 dark:bg-neutral-950">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3 md:px-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              {eyebrow}
            </p>
            <p className="mt-1 text-base font-black text-slate-900 dark:text-white">{brand}</p>
            {bio ? (
              <p className="mt-2 line-clamp-3 text-sm text-slate-500">{bio}</p>
            ) : null}
            {payoutReady ? (
              <div className="mt-4">
                <AdvisorPayAccepted tone="onLight" size="sm" />
              </div>
            ) : null}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Contact
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
              {city ? <li>{city}</li> : null}
              {phone ? (
                <li>
                  <a href={`tel:${tel}`} className="hover:underline">
                    {phone}
                  </a>
                </li>
              ) : null}
              {email ? (
                <li>
                  <a href={`mailto:${email}`} className="hover:underline">
                    {email}
                  </a>
                </li>
              ) : null}
              {!city && !phone && !email ? (
                <li className="text-slate-400">Details on request</li>
              ) : null}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Hours
            </p>
            {hourRows.length ? (
              <dl className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                {hourRows.map((row) => (
                  <div key={row.days} className="flex justify-between gap-3">
                    <dt>{row.days}</dt>
                    <dd className="font-semibold tabular-nums">{row.hours}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-slate-400">Ask when you book</p>
            )}
          </div>
        </div>
        <p className="border-t border-slate-100 py-4 text-center text-[11px] text-slate-400">
          {footerNote || 'Powered by SupplierAdvisor®'}
        </p>
      </footer>
    </div>
  );
}

export function AdvisorPublicSection({
  id,
  title,
  icon,
  aside,
  children,
}: {
  id: string;
  title: string;
  icon?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white md:text-2xl">
          {icon}
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function AdvisorPublicDayJump({ dates }: { dates: string[] }) {
  if (dates.length < 2) return null;
  return (
    <nav className="mb-5 hidden gap-1.5 overflow-x-auto pb-1 md:flex">
      {dates.map((d) => (
        <a
          key={d}
          href={`#day-${d}`}
          className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-white/15 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
        >
          {prettyPublicDate(d)}
        </a>
      ))}
    </nav>
  );
}
