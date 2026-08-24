'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';
import type { ThemeMode } from '@/lib/theme/theme';

const OPTIONS: Array<{ id: ThemeMode; label: string; icon: typeof Sun }> = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

export function B2cThemeToggle({
  compact = false,
  onDark = false,
}: {
  compact?: boolean;
  onDark?: boolean;
}) {
  const { mode, resolved, setMode, toggle } = useTheme();

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => toggle()}
        className={
          onDark
            ? 'rounded-full bg-white/15 p-2 text-white'
            : 'rounded-full border border-slate-200 bg-white p-2 text-slate-700 dark:border-white/20 dark:bg-white/10 dark:text-white'
        }
        aria-label={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={resolved === 'dark' ? 'Light theme' : 'Dark theme'}
      >
        {resolved === 'dark' ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </button>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-black text-slate-900 dark:text-white">Appearance</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
        Light or dark for this device. Applies to SA Member and stays when you
        open a company workspace.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {OPTIONS.map(({ id, label, icon: Icon }) => {
          const on = mode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-2.5 text-[11px] font-bold ${
                on
                  ? 'border-[#0077b6] bg-sky-50 text-[#0077b6] dark:border-sky-400 dark:bg-sky-950 dark:text-sky-200'
                  : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
