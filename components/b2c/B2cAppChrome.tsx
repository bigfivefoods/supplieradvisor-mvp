'use client';

/**
 * Mobile app chrome for the B2C Member App — status bar, bottom tabs, safe areas.
 */
import type { ReactNode } from 'react';
import {
  Home,
  Link2,
  QrCode,
  UserRound,
  WalletCards,
} from 'lucide-react';

export type B2cTab = 'home' | 'memberships' | 'checkin' | 'account';

const TABS: Array<{
  id: B2cTab;
  label: string;
  icon: typeof Home;
}> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'memberships', label: 'Brands', icon: WalletCards },
  { id: 'checkin', label: 'Check-in', icon: QrCode },
  { id: 'account', label: 'Account', icon: UserRound },
];

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
      className="sticky top-0 z-30 border-b border-white/10 bg-gradient-to-br from-[#0077b6] via-[#0284c7] to-[#0c4a6e] text-white"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 pb-3 pt-1">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/70">
            SA Member
          </p>
          <h1 className="truncate text-lg font-black tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="truncate text-[11px] text-white/85">{subtitle}</p>
          ) : null}
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
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/95 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95"
      style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          const n = badge?.[id] || 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 transition ${
                active
                  ? 'text-[#0077b6]'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <span
                className={`relative flex h-8 w-8 items-center justify-center rounded-2xl ${
                  active
                    ? 'bg-sky-100 shadow-sm dark:bg-sky-950'
                    : 'bg-transparent'
                }`}
              >
                <Icon
                  className={`h-[1.15rem] w-[1.15rem] ${
                    active ? 'stroke-[2.5]' : ''
                  }`}
                />
                {n > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                    {n > 9 ? '9+' : n}
                  </span>
                ) : null}
              </span>
              <span className="text-[10px] font-bold tracking-tight">
                {label}
              </span>
            </button>
          );
        })}
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
    <div className="min-h-[100dvh] bg-[#f0f9ff] text-slate-900 dark:bg-slate-950 dark:text-white">
      <B2cAppHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        right={headerRight}
      />
      <main
        className="mx-auto max-w-lg px-4 pb-28 pt-4"
        style={{ minHeight: 'calc(100dvh - 8rem)' }}
      >
        {children}
      </main>
      <B2cBottomNav tab={tab} onChange={onTab} badge={badge} />
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
      className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur"
    >
      <Link2 className="h-3 w-3" /> Install app
    </button>
  );
}
