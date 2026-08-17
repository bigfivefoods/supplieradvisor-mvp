'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';
import type { ThemeMode } from '@/lib/theme/theme';

const OPTIONS: Array<{
  id: ThemeMode;
  label: string;
  Icon: typeof Sun;
}> = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'system', label: 'System', Icon: Monitor },
];

/**
 * Light / dark / system for public Advisor websites and member portals.
 */
export function AdvisorPortalThemeToggle({
  onLightBrand = false,
}: {
  /** Header is a pale brand colour — use dark ink chips */
  onLightBrand?: boolean;
}) {
  const { mode, setMode } = useTheme();
  const track = onLightBrand
    ? 'border-black/15 bg-black/10'
    : 'border-white/25 bg-white/12';
  const idle = onLightBrand
    ? 'text-slate-700 hover:text-slate-950'
    : 'text-white/80 hover:text-white';
  const active = onLightBrand
    ? 'bg-white text-slate-900 shadow-sm'
    : 'bg-white text-slate-900 shadow-sm';

  return (
    <div
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border p-0.5 ${track}`}
      role="group"
      aria-label="Colour theme"
    >
      {OPTIONS.map(({ id, label, Icon }) => {
        const on = mode === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            title={`${label} theme`}
            aria-pressed={on}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold transition ${
              on ? active : idle
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
