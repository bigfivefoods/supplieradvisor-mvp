'use client';

import type { ReactNode } from 'react';

export type MemberAdvisorTab<T extends string = string> = {
  id: T;
  label: string;
  badge?: number | string;
};

export function MemberAdvisorShell<T extends string = string>({
  color,
  header,
  tabs,
  tab,
  onTab,
  children,
  fromClass = 'from-slate-50',
}: {
  color: string;
  header: ReactNode;
  tabs: MemberAdvisorTab<T>[];
  tab: T;
  onTab: (id: T) => void;
  children: ReactNode;
  fromClass?: string;
}) {
  return (
    <div className={`min-h-[100dvh] bg-gradient-to-b ${fromClass} to-slate-50`}>
      <header
        className="text-white"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 55%, #0f172a) 100%)`,
        }}
      >
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
          {header}
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-5 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8 md:px-8 md:py-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden md:block">
          <nav className="sticky top-6 space-y-1 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
            {tabs.map((t) => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTab(t.id)}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-bold ${
                    on ? 'text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                  style={on ? { backgroundColor: color } : undefined}
                >
                  <span>{t.label}</span>
                  {t.badge ? (
                    <span
                      className={`rounded-full px-1.5 text-[10px] ${
                        on ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {t.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 space-y-4">
          <nav className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1 md:hidden">
            {tabs.map((t) => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTab(t.id)}
                  className={`min-w-[4rem] flex-1 rounded-xl py-2 text-xs font-bold ${
                    on ? 'text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                  style={on ? { backgroundColor: color } : undefined}
                >
                  {t.label}
                  {t.badge ? ` (${t.badge})` : ''}
                </button>
              );
            })}
          </nav>
          {children}
        </div>
      </div>
    </div>
  );
}
