'use client';

/**
 * Light/dark/system only — no company role, Privy, or Advisor skins.
 * Use on public marketing chrome. Signed-in desks keep ThemeToggle.
 */
import { Moon, Sun, Monitor } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
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
}: {
  className?: string;
}) {
  const { mode, setMode } = useTheme();
  const { t } = useLocaleDictionary();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const activeIndex = Math.max(0, APPEARANCE.findIndex((option) => option.id === mode));
  const activeOption = APPEARANCE[activeIndex] || APPEARANCE[0]!;
  const ActiveIcon = activeOption.Icon;
  const triggerLabel = `${t('theme.trigger')}: ${t(activeOption.key)}`;

  const closeMenu = (focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) {
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    }
  };

  const focusMenuItem = (index: number) => {
    const bounded = Math.max(0, Math.min(APPEARANCE.length - 1, index));
    itemRefs.current[bounded]?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        closeMenu(true);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    focusMenuItem(activeIndex);
  }, [activeIndex, open]);

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      window.setTimeout(() => focusMenuItem(APPEARANCE.length - 1), 0);
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const focusedIndex = itemRefs.current.findIndex((el) => el === document.activeElement);
    const currentIndex = focusedIndex >= 0 ? focusedIndex : activeIndex;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusMenuItem((currentIndex + 1) % APPEARANCE.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusMenuItem((currentIndex - 1 + APPEARANCE.length) % APPEARANCE.length);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusMenuItem(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusMenuItem(APPEARANCE.length - 1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = APPEARANCE[currentIndex];
      if (option) setMode(option.id);
      closeMenu(true);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        data-appearance-toggle
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onTriggerKeyDown}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50/90 text-slate-700 transition-colors hover:text-[#0077b6] dark:border-neutral-700 dark:bg-black/80 dark:text-slate-200 dark:hover:text-cyan-300"
      >
        <ActiveIcon className="h-4 w-4" />
      </button>
      {open ? (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          data-appearance-menu
          aria-label={t('theme.ariaLabel')}
          onKeyDown={onMenuKeyDown}
          className="absolute end-0 z-[360] mt-2 min-w-[11rem] max-w-[calc(100vw-1rem)] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        >
          {APPEARANCE.map(({ id, key, Icon }, index) => {
            const active = mode === id;
            const label = t(key);
            return (
              <button
                key={id}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                title={label}
                onClick={() => {
                  setMode(id);
                  closeMenu(true);
                }}
                className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm ${
                  active
                    ? 'bg-sky-50 text-[#0077b6] dark:bg-cyan-500/10 dark:text-cyan-300'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-neutral-800'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
