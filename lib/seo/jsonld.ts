/**
 * JSON-LD for public marketing pages.
 * Offer amounts come from the company subscription, not from invented prices.
 */
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
} from '@/lib/billing/company-subscription';
import { LOCALES } from '@/lib/i18n/config';
import type { IndustryPage } from '@/lib/marketing/industries';
import {
  MARKETING_PRICING_TERMS,
  PRICING_FAQ_ITEMS,
} from '@/lib/marketing/pricing-plans';
import { SA_ICON_512, SA_OG_IMAGE_URL } from '@/lib/brand/assets';
import { SITE_NAME, SITE_URL } from '@/lib/seo/site';

const LANGUAGE_NAMES: Record<(typeof LOCALES)[number], string> = {
  en: 'English',
  fr: 'French',
  ar: 'Arabic',
  pt: 'Portuguese',
  sw: 'Swahili',
  zu: 'Zulu',
};

export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function absoluteUrl(path: string): string {
  if (!path || path === '/') return SITE_URL;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function companyPlanOffers(
  url: string,
  terms: readonly (typeof MARKETING_PRICING_TERMS)[number][] = MARKETING_PRICING_TERMS
) {
  return terms.map((tier) => ({
    '@type': 'Offer',
    name:
      tier.months === 1
        ? `${COMPANY_TRIAL_DAYS}-day trial, then from R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month`
        : `${tier.label} prepaid`,
    price: tier.payZar,
    priceCurrency: 'ZAR',
    availability: 'https://schema.org/InStock',
    url,
    description:
      tier.months === 1
        ? `${COMPANY_TRIAL_DAYS}-day free trial, then from R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month. Unlimited team users on the company plan.`
        : `${tier.label} prepaid company subscription (${tier.discountPercent}% off the monthly list). Same platform access as the monthly plan.`,
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: tier.payZar,
      priceCurrency: 'ZAR',
      referenceQuantity: {
        '@type': 'QuantitativeValue',
        value: tier.months,
        unitCode: 'MON',
      },
    },
  }));
}

export function organizationNode() {
  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    legalName: 'SupplierAdvisor',
    alternateName: ['Supplier Advisor', 'SupplierAdvisor'],
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}${SA_ICON_512}`,
      width: 512,
      height: 512,
    },
    image: `${SITE_URL}${SA_OG_IMAGE_URL}`,
    description:
      'SupplierAdvisor® is the supply-chain operating system with a verified trade and trust layer for B2B, B2G, and B2C.',
    foundingLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'ZA',
      },
    },
    areaServed: [
      { '@type': 'Country', name: 'South Africa' },
      { '@type': 'Continent', name: 'Africa' },
    ],
    knowsAbout: [
      'Supply chain management',
      'Supplier relationship management',
      'B2B trade networks',
      'Inventory and manufacturing',
    ],
    sameAs: ['https://x.com/supplieradvisa'],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      url: `${SITE_URL}/demo`,
      availableLanguage: LOCALES.map((locale) => LANGUAGE_NAMES[locale]),
    },
  };
}

export function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    alternateName: 'Supplier Advisor',
    description:
      'Supply-chain operating system for B2B, B2G, and B2C trade partners.',
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: [...LOCALES],
  };
}

export function softwareApplicationNode() {
  const offers = companyPlanOffers(`${SITE_URL}/pricing`, MARKETING_PRICING_TERMS);
  const monthly = offers[0];
  return {
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}/#software`,
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Supply Chain Management',
    operatingSystem: 'Web',
    url: SITE_URL,
    image: `${SITE_URL}${SA_OG_IMAGE_URL}`,
    description: `${COMPANY_TRIAL_DAYS}-day company trial, then from R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month. Verified trade, inventory, manufacturing, distribution, and finance in one workspace.`,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'ZAR',
      lowPrice: COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
      highPrice: Math.max(...MARKETING_PRICING_TERMS.map((tier) => tier.payZar)),
      offerCount: offers.length,
      url: `${SITE_URL}/pricing`,
      description: monthly?.description,
      offers,
    },
    featureList: [
      'Verified supplier and customer network',
      'Public company profiles',
      'Operations control tower',
      'Inventory and warehouse',
      'Manufacturing MPS, MRP, and BOM',
      'Distribution and logistics',
      'Bank reconciliation and accounting',
    ],
    publisher: { '@id': `${SITE_URL}/#organization` },
  };
}

export function siteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [organizationNode(), websiteNode(), softwareApplicationNode()],
  };
}

export function pricingProductJsonLd(
  url: string,
  description: string,
  terms: readonly (typeof MARKETING_PRICING_TERMS)[number][] = MARKETING_PRICING_TERMS
) {
  const offers = companyPlanOffers(url, terms);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'SupplierAdvisor® company subscription',
    description,
    brand: {
      '@type': 'Brand',
      name: SITE_NAME,
    },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'ZAR',
      lowPrice: COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
      highPrice: Math.max(...terms.map((tier) => tier.payZar)),
      offerCount: offers.length,
      offers,
    },
  };
}

export function pricingFaqJsonLd(
  items: readonly { question: string; answer: string }[] = PRICING_FAQ_ITEMS
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function industryJsonLd(industry: IndustryPage) {
  const url = absoluteUrl(`/industries/${industry.slug}`);
  const description = industry.metaDescription || industry.subhead;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: industry.name,
        description,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/#software` },
        inLanguage: 'en',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: SITE_URL,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Industries',
            item: absoluteUrl('/industries'),
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: industry.name,
            item: url,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `What gets in the way for ${industry.name}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: industry.pains.join(' '),
            },
          },
          {
            '@type': 'Question',
            name: `What does SupplierAdvisor® change for ${industry.name}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: industry.wins.join(' '),
            },
          },
          {
            '@type': 'Question',
            name: `Which modules are named for ${industry.name}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: industry.modules.join(', '),
            },
          },
        ],
      },
    ],
  };
}
