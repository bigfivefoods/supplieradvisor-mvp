import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import HomeLanding from '@/components/marketing/HomeLanding';
import { t } from '@/lib/i18n/dict';
import { getLocaleDict } from '@/lib/i18n/server';
import { DEFAULT_LOCALE, OG_LOCALE, hreflangAlternates, isLocale, type Locale } from '@/lib/i18n/config';
import { SITE_URL } from '@/lib/seo/site';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale) || locale === DEFAULT_LOCALE) return {};
  const dict = await getLocaleDict(locale);
  const canonical = `${SITE_URL}/${locale}`;

  return {
    title: t(dict, 'meta.home.title'),
    description: t(dict, 'meta.home.description'),
    alternates: {
      canonical,
      languages: hreflangAlternates('/', SITE_URL),
    },
    openGraph: {
      title: t(dict, 'meta.home.title'),
      description: t(dict, 'meta.home.description'),
      locale: OG_LOCALE[locale],
      url: canonical,
    },
  };
}

export default async function LocalizedHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === DEFAULT_LOCALE) notFound();

  const dict = await getLocaleDict(locale as Locale);
  return <HomeLanding locale={locale as Locale} dict={dict} />;
}
