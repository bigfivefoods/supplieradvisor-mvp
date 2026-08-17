'use client';

import type { ReactNode } from 'react';
import {
  CalendarDays,
  Inbox,
  Smartphone,
  Sun,
  User,
  Users,
} from 'lucide-react';
import { B2cInstallPrompt } from '@/components/b2c/B2cInstallPrompt';

export type AdvisorWorkTab = 'today' | 'diary' | 'people' | 'inbox' | 'me';

const TABS: Array<{
  id: AdvisorWorkTab;
  label: string;
  icon: typeof Sun;
}> = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'diary', label: 'Diary', icon: CalendarDays },
  { id: 'people', label: 'People', icon: Users },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'me', label: 'Me', icon: User },
];

export function AdvisorWorkPwaChrome({
  brand,
  name,
  photoUrl,
  eyebrow,
  accent = '#E8E830',
  unread = 0,
  tab,
  onTab,
  children,
}: {
  brand: string;
  name: string;
  photoUrl?: string | null;
  eyebrow?: string;
  accent?: string;
  unread?: number;
  tab: AdvisorWorkTab;
  onTab: (tab: AdvisorWorkTab) => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <header
        className="sticky top-0 z-30 border-b border-white/10 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
        style={{
          background: `linear-gradient(160deg, ${accent} 0%, #0f172a 72%)`,
        }}
      >
        <div className="mx-auto flex max-w-lg items-center gap-3">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt=""
              className="h-12 w-12 rounded-full object-cover ring-2 ring-white/40"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/30 text-lg font-black">
              {(name || 'W').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
              {eyebrow || brand}
            </p>
            <h1 className="truncate text-xl font-black leading-tight">{name}</h1>
          </div>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new Event('sa-open-install'))
            }
            className="rounded-full bg-black/30 p-2 text-white"
            aria-label="Install app"
          >
            <Smartphone className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-28 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTab(t.id)}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-black ${
                  on ? 'text-white' : 'text-slate-500'
                }`}
              >
                <span className="relative">
                  <Icon
                    className="h-5 w-5"
                    style={on ? { color: accent } : undefined}
                  />
                  {t.id === 'inbox' && unread > 0 ? (
                    <span className="absolute -right-2 -top-1 rounded-full bg-rose-500 px-1 text-[8px] text-white">
                      {unread}
                    </span>
                  ) : null}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
      <B2cInstallPrompt />
    </div>
  );
}
