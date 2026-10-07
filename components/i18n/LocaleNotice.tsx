'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { DEFAULT_LOCALE, LOCALES, stripLocale } from '@/lib/i18n/config';
import { loadDict, t } from '@/lib/i18n/dict';

const EXCLUDED_PREFIXES = ['/dashboard', '/me', '/embed', '/api', '/login', '/onboarding', '/install'];

function readCookie(name: string) {
  const part = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`));
  return part?.split('=')[1] || '';
}

export default function LocaleNotice() {
  const pathname = usePathname() || '/';

  useEffect(() => {
    const { locale } = stripLocale(pathname);
    if (locale !== DEFAULT_LOCALE) return;
    if (EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return;

    const cookieLocale = readCookie('sa-locale');
    if (!cookieLocale || cookieLocale === DEFAULT_LOCALE) return;
    if (!(LOCALES as readonly string[]).includes(cookieLocale)) return;

    const key = `sa-locale-notice:${pathname}`;
    if (sessionStorage.getItem(key)) return;

    const show = async () => {
      const dict = await loadDict(cookieLocale as (typeof LOCALES)[number]);
      toast.info(t(dict, 'notice.englishOnlyPage'));
      sessionStorage.setItem(key, '1');
    };

    void show();
  }, [pathname]);

  return null;
}
