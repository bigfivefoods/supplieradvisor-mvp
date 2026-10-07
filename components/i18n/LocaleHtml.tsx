'use client';

import { usePathname } from 'next/navigation';
import { isRtlLocale, stripLocale } from '@/lib/i18n/config';

export default function LocaleHtml({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname() || '/';
  const { locale } = stripLocale(pathname);
  const dir = isRtlLocale(locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className={className} suppressHydrationWarning>
      {children}
    </html>
  );
}
