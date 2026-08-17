'use client';

/**
 * SA Member chrome — phone: header + bottom tabs.
 * Desktop / laptop: left nav + wide canvas.
 */
import type { ReactNode } from 'react';
import {
  CalendarDays,
  Home,
  Link2,
  QrCode,
  Store,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { SaOfficialLogo } from '@/components/brand/SaOfficialLogo';

export type B2cTab =
  | 'home'
  | 'shop'
  | 'memberships'
  | 'checkin'
  | 'account'
  | 'calendar'
  | 'book';

const TABS: Array<{
  id: B2cTab;
  label: string;
  icon: typeof Home;
}> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'memberships', label: 'Places', icon: WalletCards },
  { id: 'checkin', label: 'Check-in', icon: QrCode },
  { id: 'shop', label: 'Shop', icon: Store },
  { id: 'account', label: 'Me', icon: UserRound },
];

const DESKTOP_TABS: Array<{
  id: B2cTab;
  label: string;
  icon: typeof Home;
}> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'memberships', label: 'Places', icon: WalletCards },
  { id: 'calendar', label: 'Diary', icon: CalendarDays },
  { id: 'checkin', label: 'Check-in', icon: QrCode },
  { id: 'shop', label: 'Shop', icon: Store },
  { id: 'account', label: 'Me', icon: UserRound },
];

function NavButton({
  id,
  label,
  icon: Icon,
  active,
  badge,
  layout,
  onClick,
}: {
  id: B2cTab;
  label: string;
  icon: typeof Home;
  active: boolean;
  badge?: number;
  layout: 'bottom' | 'side';
  onClick: () => void;
}) {
  const n = badge || 0;
  if (layout === 'side') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
          active
            ? 'bg-white/15 text-white'
            : 'text-sky-100/80 hover:bg-white/10 hover:text-white'
        }`}
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
          <Icon className={`h-5 w-5 ${active ? 'stroke-[2.5]' : ''}`} />
          {n > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
              {n > 9 ? '9+' : n}
            </span>
          ) : null}
        </span>
        <span className="text-sm font-bold">{label}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 transition ${
        active
          ? 'text-[#0077b6]'
          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
      }`}
    >
      <span
        className={`relative flex h-8 w-8 items-center justify-center rounded-2xl ${
          active ? 'bg-sky-100 shadow-sm dark:bg-sky-950' : 'bg-transparent'
        }`}
      >
        <Icon className={`h-[1.15rem] w-[1.15rem] ${active ? 'stroke-[2.5]' : ''}`} />
        {n > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
            {n > 9 ? '9+' : n}
          </span>
        ) : null}
      </span>
      <span className="text-[10px] font-bold tracking-tight">{label}</span>
    </button>
  );
}

export function B2cAppHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-30 border-b border-white/10 bg-gradient-to-br from-[#0077b6] via-[#0284c7] to-[#0c4a6e] text-white dark:from-[#082f49] dark:via-[#0c4a6e] dark:to-black"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 pb-3 pt-1 md:max-w-none md:px-8 md:pb-4 md:pt-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <SaOfficialLogo
            title="SA Member"
            className="sa-logo-on-dark h-8 w-auto shrink-0 md:h-9"
          />
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/70">
              SA Member
            </p>
            <h1 className="truncate text-lg font-black tracking-tight md:text-2xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="truncate text-[11px] text-white/85 md:text-sm">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {right}
      </div>
    </header>
  );
}

export function B2cBottomNav({
  tab,
  onChange,
  badge,
}: {
  tab: B2cTab;
  onChange: (t: B2cTab) => void;
  badge?: Partial<Record<B2cTab, number>>;
}) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/95 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 md:hidden"
      style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {TABS.map(({ id, label, icon }) => (
          <NavButton
            key={id}
            id={id}
            label={label}
            icon={icon}
            active={tab === id}
            badge={badge?.[id]}
            layout="bottom"
            onClick={() => onChange(id)}
          />
        ))}
      </div>
    </nav>
  );
}

export function B2cAppShell({
  children,
  tab,
  onTab,
  headerTitle,
  headerSubtitle,
  headerRight,
  badge,
}: {
  children: ReactNode;
  tab: B2cTab;
  onTab: (t: B2cTab) => void;
  headerTitle: string;
  headerSubtitle?: string;
  headerRight?: ReactNode;
  badge?: Partial<Record<B2cTab, number>>;
}) {
  return (
    <div className="b2c-app min-h-[100dvh] overscroll-none bg-[#f0f9ff] text-slate-900 dark:bg-black dark:text-neutral-50 md:flex">
      <aside className="sticky top-0 hidden h-[100dvh] w-56 shrink-0 flex-col bg-gradient-to-b from-[#0077b6] via-[#0369a1] to-[#0c4a6e] px-3 py-5 text-white dark:from-[#082f49] dark:via-[#0c4a6e] dark:to-black lg:w-64 md:flex">
        <div className="mb-6 px-2">
          <SaOfficialLogo
            title="SA Member"
            className="sa-logo-on-dark h-10 w-auto"
          />
          <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-sky-100/80">
            Personal · free
          </p>
          <p className="mt-1 text-xl font-black tracking-tight">SA Member</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {DESKTOP_TABS.map(({ id, label, icon }) => (
            <NavButton
              key={id}
              id={id}
              label={label}
              icon={icon}
              active={tab === id || (tab === 'book' && id === 'calendar')}
              badge={badge?.[id]}
              layout="side"
              onClick={() => onTab(id)}
            />
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <B2cAppHeader
          title={headerTitle}
          subtitle={headerSubtitle}
          right={headerRight}
        />
        <main
          className="mx-auto w-full max-w-lg px-4 pb-28 pt-4 md:max-w-6xl md:px-8 md:pb-10 md:pt-6"
          style={{ minHeight: 'calc(100dvh - 8rem)' }}
        >
          {children}
        </main>
        <B2cBottomNav tab={tab} onChange={onTab} badge={badge} />
      </div>
    </div>
  );
}

export function B2cInstallChip() {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new Event('sa-open-install'));
      }}
      className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur md:hidden"
    >
      <Link2 className="h-3 w-3" /> Install app
    </button>
  );
}
