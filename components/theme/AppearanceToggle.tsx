'use client';

/**
 * Light/dark/system only — no company role, Privy, or Advisor skins.
 * Use on public marketing chrome. Signed-in desks keep ThemeToggle.
 */
import { Moon, Sun, Monitor } from 'lucide-react';
import { useLocaleDictionary } from '@/components/i18n/LocaleDictionaryProvider';
import { useTheme } from '@/components/theme/ThemeProvider';
import type { ThemeMode } from '@/lib/theme/theme';

const APPEARANCE: Array<{ id: ThemeMode; key: 'theme.light' | 'theme.dark' | 'theme.system'; Icon: typeof Sun }> = [
  { id: 'light', key: 'theme.light', Icon: Sun },
  { id: 'dark', key: 'theme.dark', Icon: Moon },
  { id: 'system', key: 'theme.system', Icon: Monitor },
];

export default function AppearanceToggle({
  className = '',
  iconOnly = false,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  const { mode, setMode } = useTheme();
  const { t } = useLocaleDictionary();
  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50/90 p-0.5 dark:border-neutral-700 dark:bg-black/80 ${className}`}
      role="group"
      aria-label={t('theme.ariaLabel')}
    >
      {APPEARANCE.map(({ id, key, Icon }) => {
        const active = mode === id;
        const label = t(key);
        return (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            title={label}
            aria-label={label}
            aria-pressed={active}
            aria-checked={active}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-all ${
              active
                ? 'bg-white text-slate-900 shadow-sm dark:bg-neutral-800 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {iconOnly ? <span className="sr-only">{label}</span> : <span className="hidden sm:inline">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
