'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_NATIVE_NAMES,
  isTranslatedPath,
  localizedPath,
  stripLocale,
  type Locale,
} from '@/lib/i18n/config';
import { useLocaleDictionary } from '@/components/i18n/LocaleDictionaryProvider';

type Variant = 'menu' | 'list';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function setLocaleCookie(locale: Locale) {
  document.cookie = `sa-locale=${locale}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax`;
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18Zm6.9 8h-3.1a14.8 14.8 0 0 0-1.3-5A7.03 7.03 0 0 1 18.9 11ZM12 5.1c.9 1.2 1.8 3.2 2 5.9h-4c.2-2.7 1.1-4.7 2-5.9Zm-2 7.9h4c-.2 2.7-1.1 4.7-2 5.9c-.9-1.2-1.8-3.2-2-5.9Zm-4.5-2h-3.4A7.03 7.03 0 0 1 6.5 6c-.6 1.4-1 3-1 5Zm0 2c.1 2 .5 3.6 1 5a7.03 7.03 0 0 1-4.4-5h3.4Zm9 5c.6-1.4 1-3 1-5h3.4a7.03 7.03 0 0 1-4.4 5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={`hidden h-4 w-4 sm:block transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
      <path d="M5.2 7.7a.75.75 0 0 1 1.06.04L10 11.67l3.74-3.93a.75.75 0 0 1 1.08 1.04l-4.28 4.5a.75.75 0 0 1-1.08 0l-4.28-4.5a.75.75 0 0 1 .04-1.08Z" fill="currentColor" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <path d="M16.7 5.3a1 1 0 0 1 0 1.4L8.9 14.5a1 1 0 0 1-1.4 0L3.3 10.3a1 1 0 0 1 1.4-1.4l3.5 3.5l7.1-7.1a1 1 0 0 1 1.4 0Z" fill="currentColor" />
    </svg>
  );
}

export default function LanguageSwitcher({ variant = 'menu', onNavigate }: { variant?: Variant; onNavigate?: () => void }) {
  const { locale: activeLocale, t } = useLocaleDictionary();
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const headingId = useId();

  const stripped = stripLocale(pathname).pathname;
  const translated = isTranslatedPath(pathname);

  const options = useMemo(
    () =>
      LOCALES.map((locale) => {
        const href = translated ? localizedPath(locale, stripped) : localizedPath(DEFAULT_LOCALE, stripped);
        return {
          locale,
          href,
          nativeName: LOCALE_NATIVE_NAMES[locale],
          current: activeLocale === locale,
          hrefLang: translated ? locale : 'en',
        };
      }),
    [activeLocale, stripped, translated]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  if (variant === 'list') {
    return (
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <Link
            key={option.locale}
            href={option.href}
            hrefLang={option.hrefLang}
            lang={option.locale}
            aria-current={option.current ? 'page' : undefined}
            onClick={() => {
              setLocaleCookie(option.locale);
              onNavigate?.();
            }}
            className={`inline-flex min-h-11 items-center justify-between rounded-2xl border px-3 py-2 text-sm font-medium ${
              option.current
                ? 'border-[#0077b6] bg-sky-50 text-[#0077b6] dark:border-cyan-400/70 dark:bg-cyan-500/10 dark:text-cyan-300'
                : 'border-slate-200 text-slate-700 dark:border-neutral-700 dark:text-slate-200'
            }`}
          >
            <span>{option.nativeName}</span>
            {option.current ? <CheckIcon /> : null}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-11 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <GlobeIcon />
        <span>{activeLocale.toUpperCase()}</span>
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <div
          ref={panelRef}
          className="absolute end-0 z-[360] mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
          role="menu"
          aria-labelledby={headingId}
        >
          <p id={headingId} className="px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t('switcher.chooseLanguage')}
          </p>
          <div className="mt-1 space-y-0.5">
            {options.map((option) => (
              <Link
                key={option.locale}
                href={option.href}
                hrefLang={option.hrefLang}
                lang={option.locale}
                role="menuitem"
                aria-current={option.current ? 'page' : undefined}
                onClick={() => {
                  setLocaleCookie(option.locale);
                  setOpen(false);
                  onNavigate?.();
                }}
                className={`flex min-h-10 items-center justify-between rounded-xl px-2.5 py-2 text-sm ${
                  option.current
                    ? 'bg-sky-50 text-[#0077b6] dark:bg-cyan-500/10 dark:text-cyan-300'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-neutral-800'
                }`}
              >
                <span>{option.nativeName}</span>
                {option.current ? <CheckIcon /> : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
