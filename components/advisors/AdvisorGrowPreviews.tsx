'use client';

import { CalendarDays, Globe, Smartphone, UserRound } from 'lucide-react';
import { logoUrlFromSettings } from '@/lib/business/company-logo';
import { advisorBrandInk } from '@/components/advisors/AdvisorPublicSite';
import {
  growPreviewCopy,
  growWebsiteNav,
  type GrowPreviewCopy,
  type GrowPreviewSettings,
} from '@/lib/advisors/grow-preview';
import type { AdvisorPortalModule } from '@/lib/advisors/portal-sections';

function PhoneChrome({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-[260px] rounded-[2.1rem] border-[10px] border-slate-900 bg-slate-900 shadow-xl">
        <div className="relative h-[520px] overflow-hidden rounded-[1.45rem] bg-white">
          <div className="absolute left-1/2 top-1.5 z-10 h-3.5 w-[72px] -translate-x-1/2 rounded-full bg-slate-900" />
          {children}
        </div>
      </div>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
        {label}
      </p>
    </div>
  );
}

function BrowserChrome({
  children,
  url,
  title,
}: {
  children: React.ReactNode;
  url: string;
  title: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/10">
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-200/80 px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-rose-400" />
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="ml-2 truncate font-mono text-[10px] text-slate-500">
          {url}
        </span>
      </div>
      <div className="h-[480px] bg-white">{children}</div>
      <p className="sr-only">{title}</p>
    </div>
  );
}

function MemberPwaMock({
  copy,
  brand,
  logoUrl,
  color,
}: {
  copy: GrowPreviewCopy;
  brand: string;
  logoUrl?: string | null;
  color: string;
}) {
  const ink = advisorBrandInk(color);
  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900">
      <div
        className="px-3 pb-3 pt-7"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 50%, #0f172a) 100%)`,
          color: ink,
        }}
      >
        <p className="text-[8px] font-black uppercase tracking-[0.16em] opacity-70">
          {copy.pwaEyebrow}
        </p>
        <div className="mt-1 flex items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-8 w-8 rounded-xl bg-white/20 object-contain p-0.5"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-[11px] font-black">
              {brand.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-black leading-tight">
              {brand}
            </p>
            <p className="text-[9px] opacity-80">Hi Alex · demo preview</p>
          </div>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-1.5">
        {copy.pwaTabs.map((t) => {
          const on = t === copy.pwaActiveTab;
          return (
            <span
              key={t}
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ${
                on ? '' : 'bg-slate-100 text-slate-500'
              }`}
              style={on ? { backgroundColor: color, color: ink } : undefined}
            >
              {t}
            </span>
          );
        })}
      </div>
      <div className="space-y-2 p-2.5">
        <p className="text-[10px] font-bold text-slate-500">{copy.sampleHint}</p>
        <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
            Next
          </p>
          <p className="text-[13px] font-black">{copy.sampleTitle}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
            <CalendarDays className="h-3 w-3" />
            {copy.sampleWhen}
          </p>
          <span
            className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[9px] font-black"
            style={{ backgroundColor: color, color: ink }}
          >
            {copy.showWeekDiary ? 'Booked' : 'Ready'}
          </span>
        </div>
        {copy.showWeekDiary ? (
          <>
            <div className="grid grid-cols-7 gap-0.5">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <div
                  key={`${d}-${i}`}
                  className={`rounded-lg py-1 text-center text-[8px] font-black ${
                    i === 1 ? '' : 'bg-white text-slate-400'
                  }`}
                  style={
                    i === 1 ? { backgroundColor: color, color: ink } : undefined
                  }
                >
                  {d}
                  <div className="text-[9px]">{14 + i}</div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-2.5 py-2 text-[10px] text-slate-500">
              Open slot · 07:00 · tap to book
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function StaffPwaMock({
  copy,
  brand,
  color,
}: {
  copy: GrowPreviewCopy;
  brand: string;
  color: string;
}) {
  const ink = advisorBrandInk(color);
  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <div
        className="px-3 pb-3 pt-7"
        style={{
          background: `linear-gradient(160deg, ${color} 0%, #0f172a 72%)`,
          color: ink,
        }}
      >
        <p className="text-[8px] font-black uppercase tracking-[0.16em] opacity-70">
          {copy.staffEyebrow}
        </p>
        <p className="mt-1 truncate text-[13px] font-black">{brand}</p>
        <p className="text-[9px] opacity-80">Jordan · contracted</p>
      </div>
      <div className="flex-1 space-y-2 p-2.5">
        <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
          Today
        </p>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-2.5">
          <p className="text-[12px] font-black">{copy.staffSample}</p>
          <p className="mt-1 text-[9px] text-slate-400">
            Diary · mark attended · message
          </p>
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div
              key={`${d}-${i}`}
              className={`rounded-lg py-1 text-center text-[8px] font-black ${
                i === 1 ? '' : 'bg-white/5 text-slate-500'
              }`}
              style={i === 1 ? { backgroundColor: color, color: ink } : undefined}
            >
              {d}
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-5 border-t border-white/10 bg-slate-950 pb-2 pt-1">
        {copy.staffTabs.map((t, i) => (
          <span
            key={t}
            className={`text-center text-[7px] font-black ${
              i === 1 ? 'text-white' : 'text-slate-500'
            }`}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function WebsiteMock({
  copy,
  brand,
  logoUrl,
  color,
  bio,
  nav,
}: {
  copy: GrowPreviewCopy;
  brand: string;
  logoUrl?: string | null;
  color: string;
  bio?: string;
  nav: string[];
}) {
  const ink = advisorBrandInk(color);
  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 text-slate-900">
      <header
        className="shrink-0 px-4 py-3"
        style={{ backgroundColor: color, color: ink }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-8 w-8 rounded-xl bg-white object-contain p-0.5"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-[11px] font-black">
                {brand.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-[11px] font-black">{brand}</p>
              <p className="text-[8px] font-bold uppercase tracking-wider opacity-70">
                Public website
              </p>
            </div>
          </div>
          <span
            className="hidden rounded-full px-2 py-1 text-[9px] font-black sm:inline"
            style={
              ink === '#ffffff'
                ? { backgroundColor: '#ffffff', color }
                : { backgroundColor: '#0f172a', color: '#ffffff' }
            }
          >
            {copy.websiteCta}
          </span>
        </div>
        {nav.length ? (
          <nav className="mt-2 flex gap-1 overflow-x-auto">
            {nav.map((n) => (
              <span
                key={n}
                className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold opacity-90"
                style={{ backgroundColor: 'color-mix(in srgb, currentColor 12%, transparent)' }}
              >
                {n}
              </span>
            ))}
          </nav>
        ) : null}
      </header>
      <div className="space-y-2 p-3">
        <p className="text-[11px] leading-snug text-slate-600">
          {bio || copy.sampleHint}
        </p>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
            This week
          </p>
          <p className="text-[13px] font-black">{copy.sampleTitle}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
            <CalendarDays className="h-3 w-3" />
            {copy.sampleWhen}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AdvisorGrowPreviews({
  module,
  eyebrow,
  settings,
  embedPath,
  websiteHref,
  websiteEnabled,
  frameKey = 0,
  placement = 'view-portal',
}: {
  module: AdvisorPortalModule;
  eyebrow: string;
  settings?: GrowPreviewSettings | null;
  embedPath: string;
  websiteHref: string;
  websiteEnabled?: boolean;
  frameKey?: number;
  placement?: 'view-portal' | 'website-settings';
}) {
  const copy = growPreviewCopy(module);
  const brand = (settings?.brand_name || '').trim() || eyebrow.replace(/®/g, '');
  const color =
    settings?.embed_primary_color || settings?.primary_color || copy.color;
  const logoUrl = logoUrlFromSettings(settings);
  const published = websiteEnabled ?? settings?.enabled === true;
  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const liveHref = embedPath && origin ? `${origin}${embedPath}` : embedPath;
  const ownSite = String(settings?.website_url || '').trim();
  const nav = growWebsiteNav(module);
  const onWebsitePage = placement === 'website-settings';
  const showLiveSite =
    !onWebsitePage && published && Boolean(liveHref);

  return (
    <div
      className={`grid gap-6 lg:grid-cols-2 ${
        copy.staffRole ? 'xl:grid-cols-3' : ''
      }`}
    >
      <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-950">
        <div className="flex items-start gap-2">
          <Smartphone className="mt-0.5 h-4 w-4 text-slate-500" />
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              {copy.audienceSingular} PWA
            </h3>
            <p className="text-[11px] text-slate-500">
              What {copy.audience} see on their phone after they join {brand}.{' '}
              {copy.sampleHint} Branded preview, not a live client record.
            </p>
          </div>
        </div>
        <PhoneChrome label={`${eyebrow} · phone home screen`}>
          <MemberPwaMock
            copy={copy}
            brand={brand}
            logoUrl={logoUrl}
            color={color}
          />
        </PhoneChrome>
      </section>

      {copy.staffRole ? (
        <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-950">
          <div className="flex items-start gap-2">
            <UserRound className="mt-0.5 h-4 w-4 text-slate-500" />
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {copy.staffRole} PWA
              </h3>
              <p className="text-[11px] text-slate-500">
                What a contracted {copy.staffRole.replace('contracted ', '')}{' '}
                sees on their phone — today&apos;s floor, week diary, people,
                inbox. Issued from People, not the public website.
              </p>
            </div>
          </div>
          <PhoneChrome label={`${copy.staffEyebrow} · contracted access`}>
            <StaffPwaMock copy={copy} brand={brand} color={color} />
          </PhoneChrome>
        </section>
      ) : null}

      <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-950">
        <div className="flex items-start gap-2">
          <Globe className="mt-0.5 h-4 w-4 text-slate-500" />
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Website
            </h3>
            <p className="text-[11px] text-slate-500">
              {published
                ? `Live public site ${copy.audience} can open in a browser${
                    ownSite ? ` — or embed on ${ownSite}` : ''
                  }.`
                : `Optional. Publish only if you want a public page. Until then, ${copy.audience} use the app.`}
            </p>
          </div>
        </div>
        {showLiveSite ? (
          <BrowserChrome
            url={liveHref}
            title={`${eyebrow} website preview`}
          >
            <iframe
              key={frameKey}
              title={`${eyebrow} website preview`}
              src={liveHref}
              className="h-full w-full bg-white"
            />
          </BrowserChrome>
        ) : (
          <>
            <BrowserChrome
              url={liveHref || 'not published yet'}
              title={`${eyebrow} website mock`}
            >
              <WebsiteMock
                copy={copy}
                brand={brand}
                logoUrl={logoUrl}
                color={color}
                bio={settings?.public_bio}
                nav={nav}
              />
            </BrowserChrome>
            {published ? (
              <p className="text-center text-[11px] font-semibold text-emerald-700">
                {onWebsitePage
                  ? 'Published — save, then use Open portal above or Grow → View portal for the live page.'
                  : 'Published — issue a public token on Website to load the live page here.'}
              </p>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-center">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Website is off
                </p>
                <p className="mt-1 text-[12px] text-slate-500">
                  {onWebsitePage
                    ? 'Tick Publish above when you want this page on the public web.'
                    : 'You do not have to use a website. If you want one, publish it under Grow → Website.'}
                </p>
                {!onWebsitePage && websiteHref ? (
                  <a
                    href={websiteHref}
                    className="mt-3 inline-flex rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white dark:bg-yellow-400 dark:text-yellow-950"
                  >
                    Open Website settings
                  </a>
                ) : null}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
