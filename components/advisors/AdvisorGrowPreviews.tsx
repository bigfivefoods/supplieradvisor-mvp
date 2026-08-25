'use client';

import { useState, type ReactNode } from 'react';
import {
  Activity,
  CalendarDays,
  Dumbbell,
  Globe,
  Inbox,
  ListChecks,
  Moon,
  Share2,
  ShoppingBag,
  Smartphone,
  Sun,
  UserRound,
  Users,
} from 'lucide-react';
import { logoUrlFromSettings } from '@/lib/business/company-logo';
import { advisorBrandInk } from '@/components/advisors/AdvisorPublicSite';
import {
  growPreviewCopy,
  growWebsiteNav,
  type GrowPreviewCopy,
  type GrowPreviewSettings,
} from '@/lib/advisors/grow-preview';
import type { AdvisorPortalModule } from '@/lib/advisors/portal-sections';

type PreviewTheme = 'light' | 'dark';

function previewSkin(dark: boolean) {
  return {
    pageGym: dark
      ? 'flex h-full flex-col bg-gradient-to-b from-slate-950 to-black text-slate-100'
      : 'flex h-full flex-col bg-gradient-to-b from-yellow-50 to-slate-50 text-slate-900',
    page: dark
      ? 'flex h-full flex-col bg-gradient-to-b from-slate-950 to-black text-slate-100'
      : 'flex h-full flex-col bg-slate-50 text-slate-900',
    site: dark
      ? 'flex h-full flex-col overflow-hidden bg-slate-950 text-slate-100'
      : 'flex h-full flex-col overflow-hidden bg-slate-50 text-slate-900',
    card: dark
      ? 'rounded-2xl border border-white/10 bg-neutral-900'
      : 'rounded-2xl border border-slate-200 bg-white',
    title: dark ? 'text-white' : 'text-slate-900',
    muted: dark ? 'text-slate-400' : 'text-slate-500',
    kicker: dark ? 'text-slate-500' : 'text-slate-400',
    body: dark ? 'text-slate-400' : 'text-slate-600',
    dock: dark
      ? 'flex items-end justify-around border-t border-white/10 bg-neutral-950/95 px-1 pb-1.5 pt-1'
      : 'flex items-end justify-around border-t border-slate-200/80 bg-white/95 px-1 pb-1.5 pt-1',
    youRing: dark ? 'ring-4 ring-neutral-950' : 'ring-4 ring-white',
    youLabel: dark ? 'text-slate-400' : 'text-slate-500',
    dockOff: dark ? 'text-slate-500' : 'text-slate-400',
    weekOff: dark ? 'bg-white/5 text-slate-500' : 'bg-white text-slate-400',
    chipTrack: dark
      ? 'inline-flex rounded-full border border-white/10 bg-white/5 p-0.5'
      : 'inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5',
    chipOff: dark ? 'text-slate-400' : 'text-slate-500',
    track: dark ? 'bg-white/10' : 'bg-slate-100',
    coming: dark ? 'bg-white text-slate-950' : 'bg-slate-900 text-white',
    dash: dark
      ? 'rounded-2xl border border-dashed border-white/15 bg-neutral-900 px-2.5 py-2 text-[10px] text-slate-400'
      : 'rounded-2xl border border-dashed border-slate-200 bg-white px-2.5 py-2 text-[10px] text-slate-500',
    tabBar: dark
      ? 'flex gap-1 overflow-x-auto border-b border-white/10 bg-neutral-950 px-2 py-1.5'
      : 'flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-1.5',
    tabOff: dark ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500',
    amber: dark
      ? 'rounded-xl border border-amber-500/30 bg-amber-950/40 p-2'
      : 'rounded-xl border border-amber-200 bg-amber-50 p-2',
    amberInk: dark ? 'text-amber-200' : 'text-amber-900',
    cellOn: dark ? 'bg-yellow-500/40' : 'bg-yellow-200',
    cellDone: dark ? 'bg-emerald-500/40' : 'bg-emerald-200',
    cellOff: dark ? 'bg-white/5' : 'bg-slate-50',
    weekLabel: dark ? 'text-yellow-300' : 'text-yellow-800',
  };
}

function PreviewThemeToggle({
  theme,
  onTheme,
}: {
  theme: PreviewTheme;
  onTheme: (t: PreviewTheme) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-neutral-950">
      <div>
        <p className="text-sm font-black text-slate-900 dark:text-white">
          Preview theme
        </p>
        <p className="text-[11px] text-slate-500">
          Light and dark as members and coaches see on their phone.
        </p>
      </div>
      <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5 dark:border-white/15 dark:bg-white/5">
        {(['light', 'dark'] as const).map((t) => {
          const on = theme === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => onTheme(t)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black ${
                on
                  ? 'bg-slate-900 text-white shadow-sm dark:bg-yellow-400 dark:text-yellow-950'
                  : 'text-slate-500'
              }`}
            >
              {t === 'light' ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
              {t === 'light' ? 'Light' : 'Dark'}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PhoneChrome({
  children,
  label,
  dark,
}: {
  children: ReactNode;
  label: string;
  dark?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`w-[260px] rounded-[2.1rem] border-[10px] shadow-xl ${
          dark ? 'border-slate-700 bg-slate-800' : 'border-slate-900 bg-slate-900'
        }`}
      >
        <div
          className={`relative h-[540px] overflow-hidden rounded-[1.45rem] ${
            dark ? 'bg-black' : 'bg-white'
          }`}
        >
          <div
            className={`absolute left-1/2 top-1.5 z-10 h-3.5 w-[72px] -translate-x-1/2 rounded-full ${
              dark ? 'bg-slate-800' : 'bg-slate-900'
            }`}
          />
          {children}
        </div>
      </div>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
        {label}
        <span className="ml-1 font-bold normal-case tracking-normal text-slate-400">
          · {dark ? 'dark' : 'light'}
        </span>
      </p>
    </div>
  );
}

function BrowserChrome({
  children,
  url,
  title,
  dark,
}: {
  children: ReactNode;
  url: string;
  title: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border ${
        dark
          ? 'border-white/10 bg-slate-900'
          : 'border-slate-200 bg-slate-100 dark:border-white/10'
      }`}
    >
      <div
        className={`flex items-center gap-1.5 border-b px-3 py-1.5 ${
          dark
            ? 'border-white/10 bg-slate-800'
            : 'border-slate-200 bg-slate-200/80'
        }`}
      >
        <span className="h-2 w-2 rounded-full bg-rose-400" />
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span
          className={`ml-2 truncate font-mono text-[10px] ${
            dark ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          {url}
        </span>
      </div>
      <div className={`h-[480px] ${dark ? 'bg-slate-950' : 'bg-white'}`}>
        {children}
      </div>
      <p className="sr-only">{title}</p>
    </div>
  );
}

function AvatarCircle({
  letter,
  className,
}: {
  letter: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-white/25 text-[11px] font-black ${className || 'h-8 w-8'}`}
    >
      {letter}
    </div>
  );
}

function GymMemberPwaMock({
  copy,
  brand,
  logoUrl,
  color,
  dark,
}: {
  copy: GrowPreviewCopy;
  brand: string;
  logoUrl?: string | null;
  color: string;
  dark?: boolean;
}) {
  const ink = advisorBrandInk(color);
  const skin = previewSkin(Boolean(dark));
  const dock: Array<{
    id: string;
    label: string;
    icon?: typeof Dumbbell;
    emphasis?: boolean;
  }> = [
    { id: 'class', label: 'Class', icon: Dumbbell },
    { id: 'progress', label: 'Progress', icon: Activity },
    { id: 'you', label: 'You', emphasis: true },
    { id: 'shop', label: 'Shop', icon: ShoppingBag },
    { id: 'share', label: 'Share', icon: Share2 },
  ];
  return (
    <div className={skin.pageGym}>
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
        <div className="mt-1 flex items-end gap-2">
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
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-black leading-tight">
              {brand}
            </p>
            <p className="text-[9px] opacity-80">Hi Alex</p>
          </div>
          <AvatarCircle letter="A" className="h-9 w-9 ring-2 ring-white/50" />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-2.5">
        <div
          className="rounded-2xl p-2.5 shadow-sm"
          style={{ backgroundColor: color, color: ink }}
        >
          <p className="text-[8px] font-black uppercase tracking-widest opacity-70">
            Next class
          </p>
          <p className="text-[13px] font-black leading-tight">
            {copy.sampleTitle}
          </p>
          <p className="mt-0.5 text-[10px] font-bold opacity-80">
            {copy.sampleWhen} · Coach Sam
          </p>
          <div className="mt-2 flex gap-1">
            <span className={`rounded-lg px-2 py-0.5 text-[8px] font-black ${skin.coming}`}>
              I&apos;m coming
            </span>
            <span className="rounded-lg px-2 py-0.5 text-[8px] font-bold underline">
              Can&apos;t make it
            </span>
          </div>
        </div>
        <div className={`${skin.card} px-2.5 py-2`}>
          <div className="flex items-center justify-between">
            <p className={`text-[10px] font-black ${skin.title}`}>
              {copy.programmeName || 'Programme'}
            </p>
            <p className={`text-[10px] font-black tabular-nums ${skin.title}`}>
              62%
            </p>
          </div>
          <div className={`mt-1 h-1 overflow-hidden rounded-full ${skin.track}`}>
            <div
              className="h-full rounded-full"
              style={{ width: '62%', backgroundColor: color }}
            />
          </div>
          <p className={`mt-1 text-[9px] ${skin.muted}`}>
            Today · Squat + engine · log feel &amp; RPE
          </p>
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div
              key={`${d}-${i}`}
              className={`rounded-lg py-1 text-center text-[8px] font-black ${
                i === 1 ? '' : skin.weekOff
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
      </div>
      <div className={skin.dock}>
        {dock.map((t) => {
          const on = t.id === 'class';
          if (t.emphasis) {
            return (
              <div key={t.id} className="-mt-4 flex flex-col items-center">
                <span
                  className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-[12px] font-black shadow-lg ${skin.youRing}`}
                  style={{ backgroundColor: color, color: ink }}
                >
                  A
                </span>
                <span className={`text-[8px] font-black ${skin.youLabel}`}>
                  {t.label}
                </span>
              </div>
            );
          }
          const Icon = t.icon;
          if (!Icon) return null;
          return (
            <div
              key={t.id}
              className={`flex flex-col items-center gap-0.5 px-1 text-[8px] font-black ${
                on ? '' : skin.dockOff
              }`}
              style={on ? { color } : undefined}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GymCoachPwaMock({
  copy,
  brand,
  logoUrl,
  color,
  dark,
}: {
  copy: GrowPreviewCopy;
  brand: string;
  logoUrl?: string | null;
  color: string;
  dark?: boolean;
}) {
  const ink = advisorBrandInk(color);
  const skin = previewSkin(Boolean(dark));
  const tabs: Array<{
    id: string;
    label: string;
    icon?: typeof Sun;
    emphasis?: boolean;
  }> = [
    { id: 'today', label: 'Today', icon: Sun },
    { id: 'diary', label: 'Diary', icon: CalendarDays },
    { id: 'you', label: 'You', emphasis: true },
    { id: 'people', label: 'People', icon: Users },
    { id: 'inbox', label: 'Inbox', icon: Inbox },
  ];
  return (
    <div className={skin.pageGym}>
      <div
        className="px-3 pb-3 pt-7"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 50%, #0f172a) 100%)`,
          color: ink,
        }}
      >
        <p className="text-[8px] font-black uppercase tracking-[0.16em] opacity-70">
          {copy.staffEyebrow}
        </p>
        <div className="mt-1 flex items-end gap-2">
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
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-black leading-tight">
              {brand}
            </p>
            <p className="text-[9px] opacity-80">Jordan · coach</p>
          </div>
          <AvatarCircle letter="J" className="h-9 w-9 ring-2 ring-white/50" />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-[12px] font-black leading-tight ${skin.title}`}>
            Today
          </p>
          <div className={skin.chipTrack}>
            {['All', 'Gym', 'Mine'].map((t, i) => (
              <span
                key={t}
                className={`rounded-full px-1.5 py-0.5 text-[7px] font-black ${
                  i === 0 ? 'shadow-sm' : skin.chipOff
                }`}
                style={i === 0 ? { backgroundColor: color, color: ink } : undefined}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <div
          className="rounded-2xl p-2.5 shadow-sm"
          style={{ backgroundColor: color, color: ink }}
        >
          <p className="text-[8px] font-black uppercase tracking-widest opacity-70">
            Next up · Gym
          </p>
          <p className="text-[13px] font-black leading-tight">
            {copy.staffSample}
          </p>
          <p className="mt-0.5 text-[10px] font-bold opacity-80">
            Mark attended · open roster
          </p>
        </div>
        <div className={`${skin.card} px-2.5 py-2`}>
          <p className={`text-[8px] font-black uppercase tracking-wide ${skin.kicker}`}>
            Also today
          </p>
          <p className={`text-[11px] font-black ${skin.title}`}>09:00 PT · Ada</p>
          <p className={`text-[9px] ${skin.muted}`}>Mine · 1 booked</p>
        </div>
        <div className={`${skin.card} px-2.5 py-2`}>
          <p className={`text-[8px] font-black uppercase tracking-wide ${skin.kicker}`}>
            Programme follow
          </p>
          <p className={`text-[11px] font-black ${skin.title}`}>
            Ada · {copy.programmeName || 'Plan'}
          </p>
          <p className={`text-[9px] ${skin.muted}`}>
            62% · feel 4/5 · RPE 7
          </p>
        </div>
      </div>
      <div className={skin.dock}>
        {tabs.map((t) => {
          const on = t.id === 'today';
          if (t.emphasis) {
            return (
              <div key={t.id} className="-mt-4 flex flex-col items-center">
                <span
                  className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-[12px] font-black shadow-lg ${skin.youRing}`}
                  style={{ backgroundColor: color, color: ink }}
                >
                  J
                </span>
                <span className={`text-[8px] font-black ${skin.youLabel}`}>
                  {t.label}
                </span>
              </div>
            );
          }
          const Icon = t.icon;
          if (!Icon) return null;
          return (
            <div
              key={t.id}
              className={`flex flex-col items-center gap-0.5 px-1 text-[8px] font-black ${
                on ? '' : skin.dockOff
              }`}
              style={on ? { color } : undefined}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GymProgrammeMock({
  copy,
  color,
  dark,
}: {
  copy: GrowPreviewCopy;
  color: string;
  dark?: boolean;
}) {
  const ink = advisorBrandInk(color);
  const skin = previewSkin(Boolean(dark));
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const filled = new Set(['0-0', '0-2', '1-0', '1-2']);
  return (
    <div className={skin.pageGym}>
      <div
        className="px-3 pb-2.5 pt-7"
        style={{ backgroundColor: color, color: ink }}
      >
        <p className="text-[8px] font-black uppercase tracking-[0.16em] opacity-70">
          Programmes · follow
        </p>
        <p className="text-[14px] font-black leading-tight">
          {copy.programmeName || 'Programme'}
        </p>
        <p className="text-[9px] opacity-80">4 weeks · sell or assign</p>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-2.5">
        <div
          className={`flex items-center justify-between text-[10px] font-black ${skin.title}`}
        >
          <span>Ada following</span>
          <span>62%</span>
        </div>
        <div className={`h-1.5 overflow-hidden rounded-full ${skin.track}`}>
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: '62%' }}
          />
        </div>
        <table className="w-full border-collapse text-[7px]">
          <thead>
            <tr className={skin.kicker}>
              <th className="w-4" />
              {days.map((d, i) => (
                <th key={`${d}-${i}`} className="font-black">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((w) => (
              <tr key={w}>
                <td className={`pr-0.5 font-black ${skin.weekLabel}`}>{w}</td>
                {days.map((d, i) => {
                  const key = `${w - 1}-${i}`;
                  const on = filled.has(key);
                  const done = key === '0-0';
                  return (
                    <td key={key} className="p-0.5">
                      <div
                        className={`h-6 rounded-md ${
                          done
                            ? skin.cellDone
                            : on
                              ? skin.cellOn
                              : skin.cellOff
                        }`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className={skin.amber}>
          <p className={`text-[10px] font-black ${skin.title}`}>
            Mon · Squat + engine
          </p>
          <p className={`text-[9px] ${skin.body}`}>
            Back squat 4×6 · 120s rest
          </p>
          <p className={`mt-1 text-[8px] font-bold ${skin.amberInk}`}>
            Feel 4/5 Good · RPE 7 · “Knees felt good”
          </p>
        </div>
      </div>
    </div>
  );
}

function GymWebsiteMock({
  copy,
  brand,
  logoUrl,
  color,
  bio,
  nav,
  dark,
}: {
  copy: GrowPreviewCopy;
  brand: string;
  logoUrl?: string | null;
  color: string;
  bio?: string;
  nav: string[];
  dark?: boolean;
}) {
  const ink = advisorBrandInk(color);
  const skin = previewSkin(Boolean(dark));
  const light = ink === '#0f172a' || ink === '#111827';
  const siteNav = [...nav.slice(0, 3), 'Programmes'];
  return (
    <div className={skin.site}>
      <header
        className="shrink-0 border-b px-3 py-2.5"
        style={{
          backgroundColor: color,
          color: ink,
          borderColor: light ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.2)',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-8 w-8 rounded-2xl bg-white object-contain p-0.5"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-white/20 text-[11px] font-black">
                {brand.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.16em] opacity-70">
                GymAdvisor®
              </p>
              <p className="truncate text-[12px] font-black">{brand}</p>
            </div>
          </div>
          <span
            className="shrink-0 rounded-full px-2 py-1 text-[8px] font-black"
            style={
              light
                ? { backgroundColor: '#0f172a', color: '#ffffff' }
                : { backgroundColor: '#ffffff', color }
            }
          >
            {copy.websiteCta}
          </span>
        </div>
        <nav className="mt-2 flex gap-1 overflow-x-auto">
          {siteNav.map((n) => (
            <span
              key={n}
              className="shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold opacity-90"
              style={{
                backgroundColor: 'color-mix(in srgb, currentColor 12%, transparent)',
              }}
            >
              {n}
            </span>
          ))}
        </nav>
      </header>
      <div className="space-y-2 overflow-hidden p-3">
        <p className={`text-[11px] leading-snug ${skin.body}`}>
          {bio ||
            'Book classes, buy a membership or a training programme, then follow it in the member app.'}
        </p>
        <div className={`${skin.card} p-2.5 shadow-sm`}>
          <p className={`text-[8px] font-black uppercase tracking-wide ${skin.kicker}`}>
            This week
          </p>
          <p className={`text-[13px] font-black ${skin.title}`}>
            {copy.sampleTitle}
          </p>
          <p className={`mt-0.5 flex items-center gap-1 text-[10px] ${skin.muted}`}>
            <CalendarDays className="h-3 w-3" />
            {copy.sampleWhen} · 8 spots
          </p>
        </div>
        <div className={`${skin.card} p-2.5 shadow-sm`}>
          <p className={`text-[8px] font-black uppercase tracking-wide ${skin.kicker}`}>
            Programme
          </p>
          <p className={`text-[13px] font-black ${skin.title}`}>
            {copy.programmeName} · 4 weeks
          </p>
          <p className={`text-[10px] ${skin.muted}`}>
            R450 once-off · pay first
          </p>
        </div>
      </div>
    </div>
  );
}

function MemberPwaMock({
  copy,
  brand,
  logoUrl,
  color,
  dark,
}: {
  copy: GrowPreviewCopy;
  brand: string;
  logoUrl?: string | null;
  color: string;
  dark?: boolean;
}) {
  const ink = advisorBrandInk(color);
  const skin = previewSkin(Boolean(dark));
  return (
    <div className={skin.page}>
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
      <div className={skin.tabBar}>
        {copy.pwaTabs.map((t) => {
          const on = t === copy.pwaActiveTab;
          return (
            <span
              key={t}
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ${
                on ? '' : skin.tabOff
              }`}
              style={on ? { backgroundColor: color, color: ink } : undefined}
            >
              {t}
            </span>
          );
        })}
      </div>
      <div className="space-y-2 p-2.5">
        <p className={`text-[10px] font-bold ${skin.muted}`}>{copy.sampleHint}</p>
        <div className={`${skin.card} p-2.5 shadow-sm`}>
          <p className={`text-[9px] font-black uppercase tracking-wide ${skin.kicker}`}>
            Next
          </p>
          <p className={`text-[13px] font-black ${skin.title}`}>
            {copy.sampleTitle}
          </p>
          <p className={`mt-0.5 flex items-center gap-1 text-[10px] ${skin.muted}`}>
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
                    i === 1 ? '' : skin.weekOff
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
            <div className={skin.dash}>
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
  dark,
}: {
  copy: GrowPreviewCopy;
  brand: string;
  color: string;
  dark?: boolean;
}) {
  const ink = advisorBrandInk(color);
  const skin = previewSkin(Boolean(dark));
  return (
    <div className={skin.page}>
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
        <p className={`text-[9px] font-black uppercase tracking-wide ${skin.kicker}`}>
          Today
        </p>
        <div className={`${skin.card} p-2.5`}>
          <p className={`text-[12px] font-black ${skin.title}`}>
            {copy.staffSample}
          </p>
          <p className={`mt-1 text-[9px] ${skin.muted}`}>
            Diary · mark attended · message
          </p>
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div
              key={`${d}-${i}`}
              className={`rounded-lg py-1 text-center text-[8px] font-black ${
                i === 1 ? '' : skin.weekOff
              }`}
              style={i === 1 ? { backgroundColor: color, color: ink } : undefined}
            >
              {d}
            </div>
          ))}
        </div>
      </div>
      <div className={skin.dock}>
        {copy.staffTabs.map((t, i) =>
          t === 'You' ? (
            <span
              key={t}
              className={`-mt-2 flex flex-col items-center text-[7px] font-black ${skin.youLabel}`}
            >
              <span
                className={`mb-0.5 flex h-6 w-6 items-center justify-center rounded-full ${skin.youRing}`}
                style={{ backgroundColor: color, color: ink }}
              >
                Y
              </span>
              {t}
            </span>
          ) : (
            <span
              key={t}
              className={`text-center text-[7px] font-black ${
                i === 0 ? skin.title : skin.dockOff
              }`}
            >
              {t}
            </span>
          )
        )}
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
  dark,
}: {
  copy: GrowPreviewCopy;
  brand: string;
  logoUrl?: string | null;
  color: string;
  bio?: string;
  nav: string[];
  dark?: boolean;
}) {
  const ink = advisorBrandInk(color);
  const skin = previewSkin(Boolean(dark));
  return (
    <div className={skin.site}>
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
                style={{
                  backgroundColor:
                    'color-mix(in srgb, currentColor 12%, transparent)',
                }}
              >
                {n}
              </span>
            ))}
          </nav>
        ) : null}
      </header>
      <div className="space-y-2 p-3">
        <p className={`text-[11px] leading-snug ${skin.body}`}>
          {bio || copy.sampleHint}
        </p>
        <div className={`${skin.card} p-3 shadow-sm`}>
          <p className={`text-[9px] font-black uppercase tracking-wide ${skin.kicker}`}>
            This week
          </p>
          <p className={`text-[13px] font-black ${skin.title}`}>
            {copy.sampleTitle}
          </p>
          <p className={`mt-0.5 flex items-center gap-1 text-[10px] ${skin.muted}`}>
            <CalendarDays className="h-3 w-3" />
            {copy.sampleWhen}
          </p>
        </div>
      </div>
    </div>
  );
}

function PreviewCard({
  icon,
  title,
  hint,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-950">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-slate-500">{icon}</span>
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="text-[11px] text-slate-500">{hint}</p>
        </div>
      </div>
      {children}
    </section>
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
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>('light');
  const dark = previewTheme === 'dark';
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
  const showLiveSite = !onWebsitePage && published && Boolean(liveHref);
  const gym = module === 'fitgraph';

  const websiteBlock = (
    <PreviewCard
      icon={<Globe className="h-4 w-4" />}
      title="Portal / website"
      hint={
        published
          ? `Live public site ${copy.audience} can open in a browser${
              ownSite ? ` — or embed on ${ownSite}` : ''
            }. Classes, join, and programmes for sale.`
          : `Optional public site. Until you publish, ${copy.audience} use the app. Tick sections below.`
      }
    >
      {showLiveSite ? (
        <BrowserChrome
          url={liveHref}
          title={`${eyebrow} website preview`}
          dark={dark}
        >
          <iframe
            key={frameKey}
            title={`${eyebrow} website preview`}
            src={liveHref}
            className={`h-full w-full ${dark ? 'bg-slate-950' : 'bg-white'}`}
          />
        </BrowserChrome>
      ) : (
        <>
          <BrowserChrome
            url={liveHref || 'not published yet'}
            title={`${eyebrow} website mock`}
            dark={dark}
          >
            {gym ? (
              <GymWebsiteMock
                copy={copy}
                brand={brand}
                logoUrl={logoUrl}
                color={color}
                bio={settings?.public_bio}
                nav={nav}
                dark={dark}
              />
            ) : (
              <WebsiteMock
                copy={copy}
                brand={brand}
                logoUrl={logoUrl}
                color={color}
                bio={settings?.public_bio}
                nav={nav}
                dark={dark}
              />
            )}
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
    </PreviewCard>
  );

  return (
    <div className="space-y-4">
      <PreviewThemeToggle theme={previewTheme} onTheme={setPreviewTheme} />
      <div
        className={`grid gap-6 lg:grid-cols-2 ${
          gym || copy.staffRole ? 'xl:grid-cols-2' : ''
        }`}
      >
        <PreviewCard
          icon={<Smartphone className="h-4 w-4" />}
          title={`${copy.audienceSingular[0].toUpperCase()}${copy.audienceSingular.slice(1)} app`}
          hint={
            gym
              ? `What ${copy.audience} see on their phone: Class, Progress (programmes), You in the raised centre circle, Shop and Share.`
              : `What ${copy.audience} see on their phone after they join ${brand}. ${copy.sampleHint} Branded preview, not a live client record.`
          }
        >
          <PhoneChrome label={`${eyebrow} · member phone`} dark={dark}>
            {gym ? (
              <GymMemberPwaMock
                copy={copy}
                brand={brand}
                logoUrl={logoUrl}
                color={color}
                dark={dark}
              />
            ) : (
              <MemberPwaMock
                copy={copy}
                brand={brand}
                logoUrl={logoUrl}
                color={color}
                dark={dark}
              />
            )}
          </PhoneChrome>
        </PreviewCard>

        {copy.staffRole ? (
          <PreviewCard
            icon={<UserRound className="h-4 w-4" />}
            title={gym ? 'Coach app' : `${copy.staffRole} PWA`}
            hint={
              gym
                ? 'What a contracted coach sees: Today with All / Gym / Mine, People (programme follow + feedback), Diary, Inbox, and You in the raised centre circle — same dock as the member app. Issued from People, not the public website.'
                : `What a contracted ${copy.staffRole.replace('contracted ', '')} sees on their phone — today's floor, week diary, people, inbox. Issued from People, not the public website.`
            }
          >
            <PhoneChrome
              label={`${copy.staffEyebrow} · contracted access`}
              dark={dark}
            >
              {gym ? (
                <GymCoachPwaMock
                  copy={copy}
                  brand={brand}
                  logoUrl={logoUrl}
                  color={color}
                  dark={dark}
                />
              ) : (
                <StaffPwaMock
                  copy={copy}
                  brand={brand}
                  color={color}
                  dark={dark}
                />
              )}
            </PhoneChrome>
          </PreviewCard>
        ) : null}

        {gym && copy.showProgramme ? (
          <PreviewCard
            icon={<ListChecks className="h-4 w-4" />}
            title="Programme"
            hint={
              copy.programmeHint ||
              'Build a calendar of movements, sell it or assign it, and watch feel / effort after each day.'
            }
          >
            <PhoneChrome label="Member Progress · follow the plan" dark={dark}>
              <GymProgrammeMock copy={copy} color={color} dark={dark} />
            </PhoneChrome>
          </PreviewCard>
        ) : null}

        {websiteBlock}
      </div>
    </div>
  );
}
