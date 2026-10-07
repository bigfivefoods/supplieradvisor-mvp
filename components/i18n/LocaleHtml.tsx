'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { isRtlLocale, stripLocale } from '@/lib/i18n/config';

export default function LocaleHtml() {
  const pathname = usePathname() || '/';

  useEffect(() => {
    const { locale } = stripLocale(pathname);
    const root = document.documentElement;
    root.lang = locale;
    root.dir = isRtlLocale(locale) ? 'rtl' : 'ltr';
  }, [pathname]);

  return null;
}
