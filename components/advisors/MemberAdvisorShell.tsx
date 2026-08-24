'use client';

import type { ReactNode } from 'react';
import { PortalHeaderTools } from '@/components/advisors/PortalOpenAppLink';
import { advisorBrandInk } from '@/lib/advisors/brand-ink';
import { B2cPresencePing } from '@/components/b2c/B2cPresencePing';

export type MemberAdvisorTab<T extends string = string> = {
  id: T;
  label: string;
  badge?: number | string;
  icon?: ReactNode;
  /** Treat this tab as selected when `tab` is one of these ids. */
  covers?: T[];
  /** Lifted centre control on the mobile bottom bar (e.g. check-in). */
  emphasis?: boolean;
};

function tabIsOn<T extends string>(t: MemberAdvisorTab<T>, tab: T) {
  return t.id === tab || (t.covers || []).includes(tab);
}

export function MemberAdvisorShell<T extends string = string>({
  color,
  header,
  tabs,
  tab,
  onTab,
  children,
  fromClass = 'from-slate-50',
  mobileTabs,
  mobileNav = 'wrap',
  appHref = '/me',
}: {
  color: string;
  header: ReactNode;
  tabs: MemberAdvisorTab<T>[];
  tab: T;
  onTab: (id: T) => void;
  children: ReactNode;
  fromClass?: string;
  /** Compact icon bar on small screens. Defaults to `tabs`. */
  mobileTabs?: MemberAdvisorTab<T>[];
  mobileNav?: 'wrap' | 'bottom';
  /** SA Member / wallet home. Shown under the theme toggle. */
  appHref?: string;
}) {
  const ink = advisorBrandInk(color);
  const phoneTabs = mobileTabs || tabs;
  const bottom = mobileNav === 'bottom';

  const navBtn = (t: MemberAdvisorTab<T>, kind: 'side' | 'chip' | 'dock') => {
    const on = tabIsOn(t, tab);
    const label = (
      <>
        {t.icon && kind !== 'chip' ? (
          <span className={kind === 'dock' ? '[&>svg]:h-5 [&>svg]:w-5' : '[&>svg]:h-4 [&>svg]:w-4'}>
            {t.icon}
          </span>
        ) : null}
        <span className={kind === 'dock' ? 'truncate' : undefined}>{t.label}</span>
        {t.badge ? (
          <span
            className={`rounded-full px-1.5 text-[10px] font-black ${
              on
                ? 'bg-black/10'
                : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'
            }`}
          >
            {t.badge}
          </span>
        ) : null}
      </>
    );

    if (kind === 'dock' && t.emphasis) {
      return (
        <button
          key={t.id}
          type="button"
          onClick={() => onTab(t.id)}
          aria-current={on ? 'page' : undefined}
          className="relative -mt-5 flex flex-col items-center justify-end gap-0.5 px-1"
        >
          <span
            className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full shadow-lg ring-4 ring-white dark:ring-neutral-950 [&>svg]:h-6 [&>svg]:w-6 [&>img]:h-full [&>img]:w-full [&>img]:object-cover"
            style={{ backgroundColor: color, color: ink }}
          >
            {t.icon}
          </span>
          <span
            className={`text-[10px] font-black ${
              on ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t.label}
          </span>
          {t.badge ? (
            <span className="absolute right-1 top-0 rounded-full bg-rose-600 px-1 text-[9px] font-black text-white">
              {t.badge}
            </span>
          ) : null}
        </button>
      );
    }

    return (
      <button
        key={t.id}
        type="button"
        onClick={() => onTab(t.id)}
        aria-current={on ? 'page' : undefined}
        className={
          kind === 'side'
            ? `flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-bold ${
                on
                  ? ''
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/10'
              }`
            : kind === 'dock'
              ? `flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-black ${
                  on ? '' : 'text-slate-500 dark:text-slate-400'
                }`
              : `min-w-[4rem] flex-1 rounded-xl px-2 py-2 text-xs font-bold ${
                  on
                    ? ''
                    : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/10'
                }`
        }
        style={on && kind !== 'dock' ? { backgroundColor: color, color: ink } : on ? { color } : undefined}
      >
        {kind === 'side' ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {t.icon ? <span className="shrink-0 opacity-80">{t.icon}</span> : null}
            <span className="truncate">{t.label}</span>
          </span>
        ) : (
          label
        )}
        {kind === 'side' && t.badge ? (
          <span
            className={`rounded-full px-1.5 text-[10px] ${
              on ? 'bg-black/10' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'
            }`}
          >
            {t.badge}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div
      className={`advisor-portal min-h-[100dvh] bg-gradient-to-b ${fromClass} to-slate-50 dark:from-slate-950 dark:to-black md:flex md:h-[100dvh] md:flex-col md:overflow-hidden`}
    >
      <B2cPresencePing />
      <header
        className="sticky top-0 z-40 shrink-0 text-white pt-[env(safe-area-inset-top)] shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 55%, #0f172a) 100%)`,
        }}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 md:px-8 md:py-3.5">
          <div className="flex items-stretch justify-between gap-3">
            <div className="min-w-0 flex-1">{header}</div>
            <PortalHeaderTools appHref={appHref} spread />
          </div>
        </div>
      </header>

      <div
        className={`mx-auto grid w-full max-w-6xl gap-6 px-4 py-5 md:min-h-0 md:flex-1 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8 md:overflow-y-auto md:px-8 md:py-8 lg:grid-cols-[240px_minmax(0,1fr)] ${
          bottom ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8' : ''
        }`}
      >
        <aside className="hidden md:block">
          <nav className="sticky top-0 space-y-1 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-neutral-900">
            {tabs.map((t) => navBtn(t, 'side'))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-4">
          {!bottom ? (
            <nav className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-neutral-900 md:hidden">
              {phoneTabs.map((t) => navBtn(t, 'chip'))}
            </nav>
          ) : null}
          {children}
        </div>
      </div>

      {bottom ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 pt-1 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-neutral-950/95 md:hidden"
          style={{ paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto flex max-w-lg items-end justify-around">
            {phoneTabs.map((t) => navBtn(t, 'dock'))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
