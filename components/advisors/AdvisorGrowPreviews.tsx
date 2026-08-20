'use client';

import type { ReactNode } from 'react';
import {
  Activity,
  CalendarDays,
  Dumbbell,
  Globe,
  Inbox,
  ListChecks,
  Share2,
  ShoppingBag,
  Smartphone,
  Sun,
  User,
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

function PhoneChrome({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-[260px] rounded-[2.1rem] border-[10px] border-slate-900 bg-slate-900 shadow-xl">
        <div className="relative h-[540px] overflow-hidden rounded-[1.45rem] bg-white">
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
  children: ReactNode;
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
}: {
  copy: GrowPreviewCopy;
  brand: string;
  logoUrl?: string | null;
  color: string;
}) {
  const ink = advisorBrandInk(color);
  const dock = [
    { id: 'class', label: 'Class', icon: Dumbbell },
    { id: 'progress', label: 'Progress', icon: Activity },
    { id: 'you', label: 'You', emphasis: true },
    { id: 'shop', label: 'Shop', icon: ShoppingBag },
    { id: 'share', label: 'Share', icon: Share2 },
  ] as const;
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-yellow-50 to-slate-50 text-slate-900">
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
            <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-[8px] font-black text-white">
              I&apos;m coming
            </span>
            <span className="rounded-lg px-2 py-0.5 text-[8px] font-bold underline">
              Can&apos;t make it
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-2.5 py-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black">
              {copy.programmeName || 'Programme'}
            </p>
            <p className="text-[10px] font-black tabular-nums">62%</p>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{ width: '62%', backgroundColor: color }}
            />
          </div>
          <p className="mt-1 text-[9px] text-slate-500">
            Today · Squat + engine · log feel &amp; RPE
          </p>
        </div>
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
      </div>
      <div className="flex items-end justify-around border-t border-slate-200/80 bg-white/95 px-1 pb-1.5 pt-1">
        {dock.map((t) => {
          const on = t.id === 'class';
          if (t.emphasis) {
            return (
              <div key={t.id} className="-mt-4 flex flex-col items-center">
                <span
                  className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-[12px] font-black shadow-lg ring-4 ring-white"
                  style={{ backgroundColor: color, color: ink }}
                >
                  A
                </span>
                <span className="text-[8px] font-black text-slate-500">
                  {t.label}
                </span>
              </div>
            );
          }
          const Icon = t.icon;
          return (
            <div
              key={t.id}
              className={`flex flex-col items-center gap-0.5 px-1 text-[8px] font-black ${
                on ? '' : 'text-slate-400'
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
  color,
}: {
  copy: GrowPreviewCopy;
  brand: string;
  color: string;
}) {
  const ink = advisorBrandInk(color);
  const tabs = [
    { id: 'today', label: 'Today', icon: Sun },
    { id: 'diary', label: 'Diary', icon: CalendarDays },
    { id: 'people', label: 'People', icon: Users },
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'me', label: 'Me', icon: User },
  ] as const;
  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <div
        className="px-3 pb-3 pt-7"
        style={{
          background: `linear-gradient(160deg, ${color} 0%, #0f172a 72%)`,
        }}
      >
        <div className="flex items-center gap-2">
          <AvatarCircle letter="J" className="h-10 w-10 ring-2 ring-white/40" />
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/80">
              {copy.staffEyebrow}
            </p>
            <p className="truncate text-[14px] font-black leading-tight text-slate-950">
              Jordan
            </p>
            <p className="text-[9px] text-slate-950/70">{brand}</p>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-2.5">
        <div className="flex gap-1">
          {['All', 'Gym booked', 'My private'].map((t, i) => (
            <span
              key={t}
              className={`rounded-full px-2 py-0.5 text-[8px] font-black ${
                i === 0
                  ? 'bg-[#E8E830] text-slate-950'
                  : 'bg-white/5 text-slate-400'
              }`}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-2.5 py-2">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[12px] font-black">{copy.staffSample}</p>
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[7px] font-black uppercase text-amber-200">
              Gym booked
            </span>
          </div>
          <p className="mt-0.5 text-[9px] text-slate-400">
            Mark attended · programme on the class
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-2.5 py-2">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[12px] font-black">09:00 PT · Ada</p>
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[7px] font-black uppercase text-amber-200">
              Your PT
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-2.5 py-2">
          <p className="text-[8px] font-black uppercase tracking-wide text-amber-300">
            Programmes · follow
          </p>
          <p className="text-[11px] font-bold">
            Ada · {copy.programmeName || 'Plan'}
          </p>
          <p className="text-[9px] text-slate-400">
            62% · feel 4/5 · RPE 7 · “Knees felt good”
          </p>
        </div>
      </div>
      <div className="grid grid-cols-5 border-t border-white/10 bg-slate-950 pb-1.5 pt-1">
        {tabs.map((t, i) => {
          const Icon = t.icon;
          const on = i === 0;
          return (
            <div
              key={t.id}
              className={`flex flex-col items-center gap-0.5 text-[7px] font-black ${
                on ? 'text-white' : 'text-slate-500'
              }`}
            >
              <Icon
                className="h-3.5 w-3.5"
                style={on ? { color } : undefined}
              />
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
}: {
  copy: GrowPreviewCopy;
  color: string;
}) {
  const ink = advisorBrandInk(color);
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const filled = new Set(['0-0', '0-2', '1-0', '1-2']);
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-yellow-50 to-white text-slate-900">
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
        <div className="flex items-center justify-between text-[10px] font-black">
          <span>Ada following</span>
          <span>62%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: '62%' }}
          />
        </div>
        <table className="w-full border-collapse text-[7px]">
          <thead>
            <tr className="text-slate-400">
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
                <td className="pr-0.5 font-black text-yellow-800">{w}</td>
                {days.map((d, i) => {
                  const key = `${w - 1}-${i}`;
                  const on = filled.has(key);
                  const done = key === '0-0';
                  return (
                    <td key={key} className="p-0.5">
                      <div
                        className={`h-6 rounded-md ${
                          done
                            ? 'bg-emerald-200'
                            : on
                              ? 'bg-yellow-200'
                              : 'bg-slate-50'
                        }`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-2">
          <p className="text-[10px] font-black">Mon · Squat + engine</p>
          <p className="text-[9px] text-slate-600">
            Back squat 4×6 · 120s rest
          </p>
          <p className="mt-1 text-[8px] font-bold text-amber-900">
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
}: {
  copy: GrowPreviewCopy;
  brand: string;
  logoUrl?: string | null;
  color: string;
  bio?: string;
  nav: string[];
}) {
  const ink = advisorBrandInk(color);
  const light = ink === '#0f172a' || ink === '#111827';
  const siteNav = [...nav.slice(0, 3), 'Programmes'];
  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 text-slate-900">
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
        <p className="text-[11px] leading-snug text-slate-600">
          {bio ||
            'Book classes, buy a membership or a training programme, then follow it in the member app.'}
        </p>
        <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
          <p className="text-[8px] font-black uppercase tracking-wide text-slate-400">
            This week
          </p>
          <p className="text-[13px] font-black">{copy.sampleTitle}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
            <CalendarDays className="h-3 w-3" />
            {copy.sampleWhen} · 8 spots
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
          <p className="text-[8px] font-black uppercase tracking-wide text-slate-400">
            Programme
          </p>
          <p className="text-[13px] font-black">
            {copy.programmeName} · 4 weeks
          </p>
          <p className="text-[10px] text-slate-500">R450 once-off · pay first</p>
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
              i === 0 ? 'text-white' : 'text-slate-500'
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
        <BrowserChrome url={liveHref} title={`${eyebrow} website preview`}>
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
            {gym ? (
              <GymWebsiteMock
                copy={copy}
                brand={brand}
                logoUrl={logoUrl}
                color={color}
                bio={settings?.public_bio}
                nav={nav}
              />
            ) : (
              <WebsiteMock
                copy={copy}
                brand={brand}
                logoUrl={logoUrl}
                color={color}
                bio={settings?.public_bio}
                nav={nav}
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
        <PhoneChrome label={`${eyebrow} · member phone`}>
          {gym ? (
            <GymMemberPwaMock
              copy={copy}
              brand={brand}
              logoUrl={logoUrl}
              color={color}
            />
          ) : (
            <MemberPwaMock
              copy={copy}
              brand={brand}
              logoUrl={logoUrl}
              color={color}
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
              ? 'What a contracted coach sees: Today with Gym booked vs My private, People (programme follow + feedback), Diary, Inbox, Me. Issued from People, not the public website.'
              : `What a contracted ${copy.staffRole.replace('contracted ', '')} sees on their phone — today's floor, week diary, people, inbox. Issued from People, not the public website.`
          }
        >
          <PhoneChrome label={`${copy.staffEyebrow} · contracted access`}>
            {gym ? (
              <GymCoachPwaMock copy={copy} brand={brand} color={color} />
            ) : (
              <StaffPwaMock copy={copy} brand={brand} color={color} />
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
          <PhoneChrome label="Member Progress · follow the plan">
            <GymProgrammeMock copy={copy} color={color} />
          </PhoneChrome>
        </PreviewCard>
      ) : null}

      {websiteBlock}
    </div>
  );
}
