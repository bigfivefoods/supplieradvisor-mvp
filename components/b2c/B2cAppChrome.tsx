'use client';

/**
 * SA Member chrome — phone: header + bottom dock with You in the centre.
 * Desktop / laptop: left nav + wide canvas.
 */
import type { ReactNode } from 'react';
import {
  Home,
  Link2,
  Share2,
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
  | 'you'
  | 'share'
  | 'calendar'
  | 'book';

export function isYouTab(tab: B2cTab) {
  return tab === 'you' || tab === 'account';
}

export function normalizeB2cTab(raw: string | null | undefined): B2cTab | null {
  const t = String(raw || '');
  if (t === 'account' || t === 'you') return 'you';
  // Old PWA shortcut / menu landed on the gym-door QR page. Send it to Places.
  if (t === 'checkin' || t === 'places') return 'memberships';
  if (
    t === 'home' ||
    t === 'shop' ||
    t === 'memberships' ||
    t === 'share' ||
    t === 'calendar' ||
    t === 'book'
  ) {
    return t;
  }
  return null;
}

type DockId = 'home' | 'memberships' | 'you' | 'shop' | 'share';

const DOCK: Array<{
  id: DockId;
  tab: B2cTab;
  label: string;
  icon: typeof Home;
}> = [
  { id: 'home', tab: 'home', label: 'Home', icon: Home },
  { id: 'memberships', tab: 'memberships', label: 'Places', icon: WalletCards },
  { id: 'you', tab: 'you', label: 'You', icon: UserRound },
  { id: 'shop', tab: 'shop', label: 'Shop', icon: Store },
  { id: 'share', tab: 'share', label: 'Share', icon: Share2 },
];

function youActive(tab: B2cTab) {
  return isYouTab(tab);
}

function dockActive(id: DockId, tab: B2cTab) {
  if (id === 'you') return youActive(tab);
  if (id === 'home') {
    return tab === 'home' || tab === 'calendar' || tab === 'book';
  }
  return tab === id;
}

export function B2cYouAvatar({
  photoUrl,
  initials,
  size = 'md',
  active,
}: {
  photoUrl?: string | null;
  initials?: string;
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
}) {
  const dim =
    size === 'lg' ? 'h-16 w-16 text-xl' : size === 'sm' ? 'h-9 w-9 text-sm' : 'h-14 w-14 text-lg';
  const letter = (initials || 'Y').trim().slice(0, 1).toUpperCase() || 'Y';
  const url = String(photoUrl || '').trim();
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-300 via-[#00b4d8] to-[#0077b6] font-black text-white ${dim} ${
        active
          ? 'ring-[3px] ring-[#00b4d8] shadow-[0_8px_24px_rgba(0,180,216,0.45)]'
          : 'ring-[3px] ring-white shadow-[0_10px_28px_rgba(15,23,42,0.28)] dark:ring-neutral-950'
      }`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="leading-none">{letter}</span>
      )}
    </span>
  );
}

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
      className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1 transition ${
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
      <span className="text-[10px] font-black tracking-tight">{label}</span>
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
  youPhotoUrl,
  youInitials,
}: {
  tab: B2cTab;
  onChange: (t: B2cTab) => void;
  badge?: Partial<Record<B2cTab, number>>;
  youPhotoUrl?: string | null;
  youInitials?: string;
}) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/70 bg-white/90 shadow-[0_-12px_40px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-950/90 md:hidden"
      style={{ paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-lg items-end justify-around px-1 pt-1">
        {DOCK.map(({ id, tab: t, label, icon }) => {
          const active = dockActive(id, tab);
          if (id === 'you') {
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange('you')}
                aria-current={active ? 'page' : undefined}
                aria-label="You"
                className="relative -mt-7 flex min-w-[4.25rem] flex-1 flex-col items-center justify-end gap-0.5 px-1"
              >
                <B2cYouAvatar
                  photoUrl={youPhotoUrl}
                  initials={youInitials}
                  size="md"
                  active={active}
                />
                <span
                  className={`text-[10px] font-black tracking-tight ${
                    active ? 'text-[#0077b6]' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  You
                </span>
                {(badge?.you || badge?.account) ? (
                  <span className="absolute right-[18%] top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                    {(badge.you || badge.account || 0) > 9
                      ? '9+'
                      : badge.you || badge.account}
                  </span>
                ) : null}
              </button>
            );
          }
          return (
            <NavButton
              key={id}
              id={t}
              label={label}
              icon={icon}
              active={active}
              badge={badge?.[t]}
              layout="bottom"
              onClick={() => onChange(t)}
            />
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
  youPhotoUrl,
  youInitials,
}: {
  children: ReactNode;
  tab: B2cTab;
  onTab: (t: B2cTab) => void;
  headerTitle: string;
  headerSubtitle?: string;
  headerRight?: ReactNode;
  badge?: Partial<Record<B2cTab, number>>;
  youPhotoUrl?: string | null;
  youInitials?: string;
}) {
  return (
    <div className="b2c-app sa-member-lockup min-h-[100dvh] overscroll-none bg-[#eef6fb] text-slate-900 dark:bg-black dark:text-neutral-50 md:flex">
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
          {DOCK.map(({ id, tab: t, label, icon: Icon }) => {
            const active = dockActive(id, tab);
            if (id === 'you') {
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onTab('you')}
                  className={`relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                    active
                      ? 'bg-white/15 text-white'
                      : 'text-sky-100/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <B2cYouAvatar
                    photoUrl={youPhotoUrl}
                    initials={youInitials}
                    size="sm"
                    active={active}
                  />
                  <span className="text-sm font-bold">You</span>
                </button>
              );
            }
            return (
              <NavButton
                key={id}
                id={t}
                label={label}
                icon={Icon}
                active={active}
                badge={badge?.[t]}
                layout="side"
                onClick={() => onTab(t)}
              />
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <B2cAppHeader
          title={headerTitle}
          subtitle={headerSubtitle}
          right={headerRight}
        />
        <main
          className="mx-auto w-full max-w-lg px-4 pb-32 pt-4 md:max-w-6xl md:px-8 md:pb-10 md:pt-6"
          style={{ minHeight: 'calc(100dvh - 8rem)' }}
        >
          {children}
        </main>
        <B2cBottomNav
          tab={tab}
          onChange={onTab}
          badge={badge}
          youPhotoUrl={youPhotoUrl}
          youInitials={youInitials}
        />
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
