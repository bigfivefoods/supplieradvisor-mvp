'use client';

/**
 * Light/dark/system only — no company role, Privy, or Advisor skins.
 * Use on public marketing chrome. Signed-in desks keep ThemeToggle.
 */
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';
import type { ThemeMode } from '@/lib/theme/theme';

const APPEARANCE: Array<{ id: ThemeMode; label: string; Icon: typeof Sun }> = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'system', label: 'System', Icon: Monitor },
];

export default function AppearanceToggle({
  className = '',
}: {
  className?: string;
}) {
  const { mode, setMode } = useTheme();
  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50/90 p-0.5 dark:border-neutral-700 dark:bg-black/80 ${className}`}
      role="group"
      aria-label="Colour theme"
    >
      {APPEARANCE.map(({ id, label, Icon }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            title={label}
            aria-pressed={active}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-all ${
              active
                ? 'bg-white text-slate-900 shadow-sm dark:bg-neutral-800 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white'
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
