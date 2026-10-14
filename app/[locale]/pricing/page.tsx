import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PricingContent from '@/components/marketing/PricingContent';
import { t } from '@/lib/i18n/dict';
import { getLocaleDict } from '@/lib/i18n/server';
import { DEFAULT_LOCALE, OG_LOCALE, hreflangAlternates, isLocale, type Locale } from '@/lib/i18n/config';
import { SITE_URL } from '@/lib/seo/site';
import {
  MARKETING_PRICING_TERMS,
  PRICING_FAQ_ITEMS,
} from '@/lib/marketing/pricing-plans';
import { jsonLdString, pricingFaqJsonLd, pricingProductJsonLd } from '@/lib/seo/jsonld';
import { PRICING_SHARE_CARD, shareImageSrc } from '@/lib/seo/share-cards';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale) || locale === DEFAULT_LOCALE) return {};
  const dict = await getLocaleDict(locale);
  const canonical = `${SITE_URL}/${locale}/pricing`;
  const pricingTitle = t(dict, 'meta.pricing.title');
  const socialTitle = pricingTitle.includes('SupplierAdvisor')
    ? pricingTitle
    : `${pricingTitle} · ${t(dict, 'brand.supplierAdvisor')}`;

  return {
    title: pricingTitle,
    description: t(dict, 'meta.pricing.description'),
    alternates: {
      canonical,
      languages: hreflangAlternates('/pricing', SITE_URL),
    },
    openGraph: {
      title: socialTitle,
      description: t(dict, 'meta.pricing.description'),
      locale: OG_LOCALE[locale],
      url: canonical,
      images: [
        {
          url: shareImageSrc(PRICING_SHARE_CARD.file),
          width: 1200,
          height: 630,
          alt: PRICING_SHARE_CARD.alt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description: t(dict, 'meta.pricing.description'),
      images: [shareImageSrc(PRICING_SHARE_CARD.file)],
    },
  };
}

export default async function LocalizedPricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === DEFAULT_LOCALE) notFound();

  const dict = await getLocaleDict(locale as Locale);
  const canonicalUrl = `${SITE_URL}/${locale}/pricing`;
  const description = t(dict, 'meta.pricing.description');
  const productJsonLd = pricingProductJsonLd(
    canonicalUrl,
    description,
    MARKETING_PRICING_TERMS
  );
  const faqJsonLd = pricingFaqJsonLd(PRICING_FAQ_ITEMS);

  return (
    <>
      <PricingContent locale={locale as Locale} dict={dict} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }}
      />
    </>
  );
}
