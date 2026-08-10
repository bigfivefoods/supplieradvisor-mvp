'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';
import type { ThemeMode } from '@/lib/theme/theme';

type Props = {
  /** compact = icon only; full = segmented control */
  variant?: 'icon' | 'segmented' | 'menu';
  className?: string;
};

const MODES: Array<{ id: ThemeMode; label: string; Icon: typeof Sun }> = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'system', label: 'System', Icon: Monitor },
];

/**
 * Theme toggle — light / dark / system.
 * Place in app chrome and marketing nav.
 */
export default function ThemeToggle({
  variant = 'icon',
  className = '',
}: Props) {
  const { mode, resolved, setMode, toggle } = useTheme();

  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50/90 p-0.5 dark:border-neutral-700 dark:bg-black/80 ${className}`}
        role="group"
        aria-label="Colour theme"
      >
        {MODES.map(({ id, label, Icon }) => {
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

  // Icon toggle (cycles light ↔ dark; long-press/menu not needed)
  return (
    <button
      type="button"
      onClick={toggle}
      title={
        resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
      }
      aria-label={
        resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
      }
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-[#00b4d8]/50 hover:text-[#0077b6] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-[#00b4d8]/50 dark:hover:text-[#00b4d8] ${className}`}
    >
      {resolved === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
