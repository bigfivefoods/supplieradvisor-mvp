import { notFound } from 'next/navigation';
import { LocaleDictionaryProvider } from '@/components/i18n/LocaleDictionaryProvider';
import { LOCALES, type Locale } from '@/lib/i18n/config';
import { getLocaleDict } from '@/lib/i18n/server';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== 'en').map((locale) => ({ locale }));
}

export default async function LocalizedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale) || locale === 'en') {
    notFound();
  }

  const activeLocale = locale as Locale;
  const dict = await getLocaleDict(activeLocale);

  return (
    <LocaleDictionaryProvider initialLocale={activeLocale} initialDict={dict}>
      {children}
    </LocaleDictionaryProvider>
  );
}
