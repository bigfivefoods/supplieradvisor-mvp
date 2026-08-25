'use client';

import { useState, type ReactNode } from 'react';
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
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

function GymAppHeader({
  eyebrow,
  brand,
  logoUrl,
  color,
  ink,
  sub,
}: {
  eyebrow: string;
  brand: string;
  logoUrl?: string | null;
  color: string;
  ink: string;
  sub: string;
}) {
  return (
    <div
      className="px-3 pb-3 pt-7"
      style={{
        background: `linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 50%, #0f172a) 100%)`,
        color: ink,
      }}
    >
      <p className="text-[8px] font-black uppercase tracking-[0.16em] opacity-70">
        {eyebrow}
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
          <p className="truncate text-[13px] font-black leading-tight">{brand}</p>
          <p className="text-[9px] opacity-80">{sub}</p>
        </div>
        <AvatarCircle
          letter={sub.includes('coach') ? 'J' : 'A'}
          className="h-9 w-9 ring-2 ring-white/50"
        />
      </div>
    </div>
  );
}

function MiniFold({
  title,
  hint,
  badge,
  open,
  nested,
  skin,
  children,
}: {
  title: string;
  hint?: string;
  badge?: string;
  open?: boolean;
  nested?: boolean;
  skin: ReturnType<typeof previewSkin>;
  children?: ReactNode;
}) {
  return (
    <div className={`${skin.card} overflow-hidden ${nested ? 'shadow-none' : ''}`}>
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-black ${skin.title}`}>{title}</p>
          {hint ? <p className={`text-[8px] leading-snug ${skin.muted}`}>{hint}</p> : null}
        </div>
        {badge ? (
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-black ${skin.coming}`}>
            {badge}
          </span>
        ) : null}
        <span className={`text-[9px] font-black ${skin.kicker}`}>
          {open ? '▾' : '▸'}
        </span>
      </div>
      {open && children ? (
        <div className="space-y-1.5 border-t border-black/5 px-2.5 py-2 dark:border-white/10">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function MiniWeekStrip({
  skin,
  color,
  ink,
  selected = 2,
  arrows = true,
}: {
  skin: ReturnType<typeof previewSkin>;
  color: string;
  ink: string;
  selected?: number;
  arrows?: boolean;
}) {
  const days = [
    ['Mon', '24'],
    ['Tue', '25'],
    ['Wed', '26'],
    ['Thu', '27'],
    ['Fri', '28'],
    ['Sat', '29'],
    ['Sun', '30'],
  ];
  return (
    <div className="flex items-stretch gap-0.5">
      {arrows ? (
        <span
          className={`flex w-5 shrink-0 items-center justify-center rounded-lg ${skin.card}`}
        >
          <ChevronLeft className="h-3 w-3" />
        </span>
      ) : null}
      <div className="grid min-w-0 flex-1 grid-cols-7 gap-0.5">
        {days.map(([d, n], i) => {
          const on = i === selected;
          return (
            <span
              key={d}
              className={`rounded-lg py-1 text-center ${
                on ? '' : skin.weekOff
              }`}
              style={on ? { backgroundColor: color, color: ink } : undefined}
            >
              <span className="block text-[7px] font-black uppercase">{d}</span>
              <span className="block text-[10px] font-black leading-none">{n}</span>
            </span>
          );
        })}
      </div>
      {arrows ? (
        <span
          className={`flex w-5 shrink-0 items-center justify-center rounded-lg ${skin.card}`}
        >
          <ChevronRight className="h-3 w-3" />
        </span>
      ) : null}
    </div>
  );
}

function ScreenSlider({
  screens,
  dark,
  labelPrefix,
}: {
  screens: Array<{ id: string; title: string; phone: ReactNode }>;
  dark?: boolean;
  labelPrefix: string;
}) {
  const [i, setI] = useState(0);
  const n = screens.length;
  const go = (j: number) => setI(((j % n) + n) % n);
  const cur = screens[i] || screens[0];
  if (!cur) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2">
        {n > 1 ? (
          <button
            type="button"
            aria-label="Previous screen"
            onClick={() => go(i - 1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 dark:border-white/15 dark:bg-neutral-900 dark:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : null}
        <PhoneChrome label={`${labelPrefix} · ${cur.title}`} dark={dark}>
          {cur.phone}
        </PhoneChrome>
        {n > 1 ? (
          <button
            type="button"
            aria-label="Next screen"
            onClick={() => go(i + 1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 dark:border-white/15 dark:bg-neutral-900 dark:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {n > 1 ? (
        <>
          <input
            type="range"
            min={0}
            max={n - 1}
            step={1}
            value={i}
            aria-label="Preview screen"
            onChange={(e) => setI(Number(e.target.value))}
            className="w-full accent-slate-900 dark:accent-yellow-400"
          />
          <div className="flex flex-wrap justify-center gap-1">
            {screens.map((s, j) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setI(j)}
                aria-pressed={j === i}
                className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                  j === i
                    ? 'bg-slate-900 text-white dark:bg-yellow-400 dark:text-yellow-950'
                    : 'border border-slate-200 bg-white text-slate-500 dark:border-white/15 dark:bg-neutral-900'
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function GymMemberDock({
  active,
  color,
  ink,
  skin,
}: {
  active: 'class' | 'progress';
  color: string;
  ink: string;
  skin: ReturnType<typeof previewSkin>;
}) {
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
    <div className={skin.dock}>
      {dock.map((t) => {
        const on = t.id === active;
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
  );
}

function GymMemberPwaMock({
  copy,
  brand,
  logoUrl,
  color,
  dark,
  screen = 'class',
}: {
  copy: GrowPreviewCopy;
  brand: string;
  logoUrl?: string | null;
  color: string;
  dark?: boolean;
  screen?: 'class' | 'after' | 'journey';
}) {
  const ink = advisorBrandInk(color);
  const skin = previewSkin(Boolean(dark));
  const active = screen === 'journey' ? 'progress' : 'class';
  return (
    <div className={skin.pageGym}>
      <GymAppHeader
        eyebrow={copy.pwaEyebrow}
        brand={brand}
        logoUrl={logoUrl}
        color={color}
        ink={ink}
        sub="Hi Alex"
      />
      <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-2.5">
        {screen === 'class' ? (
          <>
            <p className={`text-[11px] font-black ${skin.title}`}>Next up</p>
            <div
              className="rounded-2xl p-2.5 shadow-sm"
              style={{ backgroundColor: color, color: ink }}
            >
              <p className="text-[8px] font-black uppercase tracking-widest opacity-70">
                Next up
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
            <MiniFold
              title="Coming up"
              hint="Sessions planned, grouped by month"
              badge="5 sessions"
              open
              skin={skin}
            >
              <p className={`text-[9px] font-black ${skin.title}`}>August</p>
              <div className={`${skin.card} px-2 py-1.5`}>
                <p className={`text-[8px] font-black uppercase ${skin.kicker}`}>
                  Coming up
                </p>
                <p className={`text-[11px] font-black ${skin.title}`}>
                  Hyrox engine
                </p>
                <p className={`text-[8px] ${skin.muted}`}>Thu · 06:00</p>
              </div>
            </MiniFold>
            <MiniFold
              title="After class"
              hint="4 plan vs 3 actual · 75% achieved"
              badge="75%"
              skin={skin}
            />
          </>
        ) : null}
        {screen === 'after' ? (
          <>
            <p className={`text-[11px] font-black ${skin.title}`}>After class</p>
            <MiniFold
              title="August"
              hint="4 plan vs 3 actual · 75% achieved"
              badge="75%"
              open
              skin={skin}
            >
              <div className="grid grid-cols-3 gap-1">
                {[
                  ['4', 'Plan'],
                  ['3', 'Actual'],
                  ['75%', 'Achieved'],
                ].map(([v, l]) => (
                  <div
                    key={l}
                    className={`rounded-xl px-1 py-1.5 text-center ${skin.card}`}
                  >
                    <p className={`text-[11px] font-black tabular-nums ${skin.title}`}>
                      {v}
                    </p>
                    <p className={`text-[7px] font-black uppercase ${skin.kicker}`}>
                      {l}
                    </p>
                  </div>
                ))}
              </div>
              <div className={`${skin.card} px-2 py-1.5`}>
                <p className={`text-[8px] font-black uppercase ${skin.kicker}`}>
                  Attended
                </p>
                <p className={`text-[11px] font-black ${skin.title}`}>
                  {copy.sampleTitle}
                </p>
                <p className={`text-[8px] ${skin.muted}`}>Mon · rate this class</p>
              </div>
            </MiniFold>
            <MiniFold
              title="July"
              hint="8 plan vs 7 actual · 88% achieved"
              badge="88%"
              skin={skin}
            />
          </>
        ) : null}
        {screen === 'journey' ? (
          <>
            <p className={`text-[11px] font-black ${skin.title}`}>Journey</p>
            <div className="grid grid-cols-3 gap-1">
              {[
                ['12', 'Classes · 30d'],
                ['48', 'Attended'],
                ['9', 'Check-ins'],
              ].map(([v, l]) => (
                <div
                  key={l}
                  className={`rounded-xl px-1 py-1.5 text-center ${skin.card}`}
                >
                  <p className={`text-[11px] font-black tabular-nums ${skin.title}`}>
                    {v}
                  </p>
                  <p className={`text-[6px] font-black uppercase leading-tight ${skin.kicker}`}>
                    {l}
                  </p>
                </div>
              ))}
            </div>
            <MiniFold
              title="August"
              hint="4 planned · 3 attended"
              badge="75%"
              open
              skin={skin}
            >
              <div className={`${skin.card} px-2 py-1.5`}>
                <p className={`text-[11px] font-black ${skin.title}`}>
                  {copy.sampleTitle}
                </p>
                <p className={`text-[8px] ${skin.muted}`}>Attended · tap to rate</p>
              </div>
            </MiniFold>
            <MiniFold
              title="Training notes"
              hint="Coach notes and modifications"
              skin={skin}
            />
          </>
        ) : null}
      </div>
      <GymMemberDock active={active} color={color} ink={ink} skin={skin} />
    </div>
  );
}

function GymCoachDock({
  active,
  color,
  ink,
  skin,
}: {
  active: 'today' | 'diary' | 'people' | 'inbox';
  color: string;
  ink: string;
  skin: ReturnType<typeof previewSkin>;
}) {
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
    <div className={skin.dock}>
      {tabs.map((t) => {
        const on = t.id === active;
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
  );
}

function GymCoachPwaMock({
  copy,
  brand,
  logoUrl,
  color,
  dark,
  screen = 'today',
}: {
  copy: GrowPreviewCopy;
  brand: string;
  logoUrl?: string | null;
  color: string;
  dark?: boolean;
  screen?: 'today' | 'diary' | 'people' | 'inbox';
}) {
  const ink = advisorBrandInk(color);
  const skin = previewSkin(Boolean(dark));
  const hours = ['05', '06', '07', '08', '09'];
  const dockActive =
    screen === 'people' || screen === 'inbox' || screen === 'diary'
      ? screen
      : 'today';
  return (
    <div className={skin.pageGym}>
      <GymAppHeader
        eyebrow={copy.staffEyebrow}
        brand={brand}
        logoUrl={logoUrl}
        color={color}
        ink={ink}
        sub="Jordan · coach"
      />
      <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden p-2.5">
        {screen === 'today' || screen === 'diary' ? (
          <>
            <MiniWeekStrip
              skin={skin}
              color={color}
              ink={ink}
              selected={2}
              arrows
            />
            <p className={`text-[11px] font-black ${skin.title}`}>
              {screen === 'diary' ? 'Diary' : 'Today'}
            </p>
            <div className={`${skin.card} overflow-hidden`}>
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="flex items-stretch border-t border-black/5 first:border-t-0"
                >
                  <span className={`w-8 shrink-0 py-1.5 text-center text-[7px] font-bold ${skin.kicker}`}>
                    {h}
                  </span>
                  <div className="min-h-[22px] flex-1 px-1 py-0.5">
                    {i === 1 && screen === 'diary' ? (
                      <span
                        className="inline-block rounded px-1 py-0.5 text-[7px] font-black"
                        style={{ backgroundColor: color, color: ink }}
                      >
                        Class · strength
                      </span>
                    ) : null}
                    {i === 1 && screen === 'today' ? (
                      <span
                        className="inline-block rounded px-1 py-0.5 text-[7px] font-black"
                        style={{ backgroundColor: color, color: ink }}
                      >
                        Class · {copy.sampleTitle}
                      </span>
                    ) : null}
                    {i === 4 ? (
                      <span className="inline-block rounded bg-teal-200 px-1 py-0.5 text-[7px] font-black text-teal-900">
                        Client · Ada PT
                      </span>
                    ) : null}
                    {i === 2 ? (
                      <span className="inline-block rounded bg-indigo-200 px-1 py-0.5 text-[7px] font-black text-indigo-900">
                        Workout · lift
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className={`flex gap-2 text-[7px] font-bold ${skin.muted}`}>
              <span>Class</span>
              <span className="text-indigo-600">Workout</span>
              <span className="text-teal-700">Client</span>
            </div>
          </>
        ) : null}
        {screen === 'people' ? (
          <>
            <p className={`text-[11px] font-black ${skin.title}`}>People</p>
            <p className={`text-[8px] ${skin.muted}`}>
              Your book only · they update their own details
            </p>
            <MiniFold
              title="Classes"
              hint="Booked on your group classes"
              badge="5"
              open
              skin={skin}
            >
              <MiniFold
                title="Morning strength"
                badge="3"
                open
                nested
                skin={skin}
              >
                <p className={`text-[11px] font-black ${skin.title}`}>Alex</p>
                <p className={`text-[8px] ${skin.muted}`}>Class member</p>
                <p className={`mt-1 text-[11px] font-black ${skin.title}`}>Priya</p>
                <p className={`text-[8px] ${skin.muted}`}>Class member</p>
              </MiniFold>
              <MiniFold title="Engine" badge="2" nested skin={skin} />
            </MiniFold>
            <MiniFold
              title="Clients"
              hint="Your private PT clients"
              badge="2"
              open
              skin={skin}
            >
              <p className={`text-[11px] font-black ${skin.title}`}>Ada</p>
              <p className={`text-[8px] ${skin.muted}`}>Private PT</p>
            </MiniFold>
          </>
        ) : null}
        {screen === 'inbox' ? (
          <>
            <div className="flex items-center justify-between">
              <p className={`text-[11px] font-black ${skin.title}`}>Inbox</p>
              <span
                className="rounded-full px-1.5 py-0.5 text-[7px] font-black"
                style={{ backgroundColor: color, color: ink }}
              >
                New
              </span>
            </div>
            <div className={`${skin.card} px-2.5 py-2`}>
              <div className="flex items-center justify-between gap-1">
                <p className={`text-[11px] font-black ${skin.title}`}>Alex</p>
                <span className="text-[7px] font-black text-rose-500">1 new</span>
              </div>
              <p className={`text-[8px] ${skin.muted}`}>
                Will I need bands tomorrow?
              </p>
            </div>
            <div className={`${skin.card} px-2.5 py-2`}>
              <p className={`text-[11px] font-black ${skin.title}`}>Front desk</p>
              <p className={`text-[8px] ${skin.muted}`}>
                New intro booked on Thursday
              </p>
            </div>
            <div className={`${skin.card} px-2.5 py-2`}>
              <p className={`text-[11px] font-black ${skin.title}`}>Sam · coach</p>
              <p className={`text-[8px] ${skin.muted}`}>
                Shared Friday engine workout
              </p>
            </div>
          </>
        ) : null}
      </div>
      <GymCoachDock
        active={dockActive}
        color={color}
        ink={ink}
        skin={skin}
      />
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
              ? `What ${copy.audience} see on their phone: Class (Next up, Coming up by month, After class plan vs actual), Progress Journey, You in the raised centre. Use the slider to click through each screen.`
              : `What ${copy.audience} see on their phone after they join ${brand}. ${copy.sampleHint} Branded preview, not a live client record.`
          }
        >
          {gym ? (
            <ScreenSlider
              dark={dark}
              labelPrefix={`${eyebrow} · member`}
              screens={[
                {
                  id: 'class',
                  title: 'Class',
                  phone: (
                    <GymMemberPwaMock
                      copy={copy}
                      brand={brand}
                      logoUrl={logoUrl}
                      color={color}
                      dark={dark}
                      screen="class"
                    />
                  ),
                },
                {
                  id: 'after',
                  title: 'After class',
                  phone: (
                    <GymMemberPwaMock
                      copy={copy}
                      brand={brand}
                      logoUrl={logoUrl}
                      color={color}
                      dark={dark}
                      screen="after"
                    />
                  ),
                },
                {
                  id: 'journey',
                  title: 'Journey',
                  phone: (
                    <GymMemberPwaMock
                      copy={copy}
                      brand={brand}
                      logoUrl={logoUrl}
                      color={color}
                      dark={dark}
                      screen="journey"
                    />
                  ),
                },
                {
                  id: 'programme',
                  title: 'Programme',
                  phone: (
                    <GymProgrammeMock copy={copy} color={color} dark={dark} />
                  ),
                },
              ]}
            />
          ) : (
            <PhoneChrome label={`${eyebrow} · member phone`} dark={dark}>
              <MemberPwaMock
                copy={copy}
                brand={brand}
                logoUrl={logoUrl}
                color={color}
                dark={dark}
              />
            </PhoneChrome>
          )}
        </PreviewCard>

        {copy.staffRole ? (
          <PreviewCard
            icon={<UserRound className="h-4 w-4" />}
            title={gym ? 'Coach app' : `${copy.staffRole} PWA`}
            hint={
              gym
                ? 'What a contracted coach sees: Today and Diary (open-to-close, class / workout / client colours), People (their class members and private clients), Inbox. Use the slider to click through each screen. Issued from People, not the public website.'
                : `What a contracted ${copy.staffRole.replace('contracted ', '')} sees on their phone — today's floor, week diary, people, inbox. Issued from People, not the public website.`
            }
          >
            {gym ? (
              <ScreenSlider
                dark={dark}
                labelPrefix={`${copy.staffEyebrow}`}
                screens={[
                  {
                    id: 'today',
                    title: 'Today',
                    phone: (
                      <GymCoachPwaMock
                        copy={copy}
                        brand={brand}
                        logoUrl={logoUrl}
                        color={color}
                        dark={dark}
                        screen="today"
                      />
                    ),
                  },
                  {
                    id: 'diary',
                    title: 'Diary',
                    phone: (
                      <GymCoachPwaMock
                        copy={copy}
                        brand={brand}
                        logoUrl={logoUrl}
                        color={color}
                        dark={dark}
                        screen="diary"
                      />
                    ),
                  },
                  {
                    id: 'people',
                    title: 'People',
                    phone: (
                      <GymCoachPwaMock
                        copy={copy}
                        brand={brand}
                        logoUrl={logoUrl}
                        color={color}
                        dark={dark}
                        screen="people"
                      />
                    ),
                  },
                  {
                    id: 'inbox',
                    title: 'Inbox',
                    phone: (
                      <GymCoachPwaMock
                        copy={copy}
                        brand={brand}
                        logoUrl={logoUrl}
                        color={color}
                        dark={dark}
                        screen="inbox"
                      />
                    ),
                  },
                ]}
              />
            ) : (
              <PhoneChrome
                label={`${copy.staffEyebrow} · contracted access`}
                dark={dark}
              >
                <StaffPwaMock
                  copy={copy}
                  brand={brand}
                  color={color}
                  dark={dark}
                />
              </PhoneChrome>
            )}
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
