import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import HomeLanding from '@/components/marketing/HomeLanding';
import { t } from '@/lib/i18n/dict';
import { getLocaleDict } from '@/lib/i18n/server';
import { DEFAULT_LOCALE, OG_LOCALE, hreflangAlternates, isLocale, type Locale } from '@/lib/i18n/config';
import { SITE_URL } from '@/lib/seo/site';
import { HOME_SHARE_CARD, shareImageSrc } from '@/lib/seo/share-cards';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale) || locale === DEFAULT_LOCALE) return {};
  const dict = await getLocaleDict(locale);
  const canonical = `${SITE_URL}/${locale}`;

  return {
    title: { absolute: t(dict, 'meta.home.title') },
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
      images: [
        {
          url: shareImageSrc(HOME_SHARE_CARD.file),
          width: 1200,
          height: 630,
          alt: HOME_SHARE_CARD.alt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t(dict, 'meta.home.title'),
      description: t(dict, 'meta.home.description'),
      images: [shareImageSrc(HOME_SHARE_CARD.file)],
    },
  };
}

export default async function LocalizedHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === DEFAULT_LOCALE) notFound();

  const dict = await getLocaleDict(locale as Locale);
  return <HomeLanding locale={locale as Locale} dict={dict} />;
}
