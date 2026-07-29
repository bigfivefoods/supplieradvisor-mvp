/**
 * Server-rendered site-wide JSON-LD for Google / rich results / AI crawlers.
 * Keep as a server component (no 'use client').
 */
import { SITE_URL } from '@/lib/seo/site';

export default function JsonLd() {
  const site = SITE_URL;

  const organization = {
    '@type': 'Organization',
    '@id': `${site}/#organization`,
    name: 'SupplierAdvisor',
    legalName: 'SupplierAdvisor',
    alternateName: ['SupplierAdvisor®', 'Supplier Advisor', 'SA'],
    url: site,
    logo: {
      '@type': 'ImageObject',
      url: `${site}/sa-icon-512.png`,
      width: 512,
      height: 512,
    },
    image: `${site}/og-image.png`,
    description:
      'The verified supply-chain operating system for B2B, B2G and B2C — network trade, inventory, manufacturing, distribution, accounting, and AI intelligence.',
    foundingLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'ZA',
      },
    },
    areaServed: [
      { '@type': 'Place', name: 'Worldwide' },
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
      url: `${site}/demo`,
      availableLanguage: ['English'],
    },
  };

  const website = {
    '@type': 'WebSite',
    '@id': `${site}/#website`,
    url: site,
    name: 'SupplierAdvisor®',
    alternateName: 'Supplier Advisor',
    description:
      'Supply chain operating system for B2B, B2G and B2C trade partners.',
    publisher: { '@id': `${site}/#organization` },
    inLanguage: 'en',
  };

  const software = {
    '@type': 'SoftwareApplication',
    '@id': `${site}/#software`,
    name: 'SupplierAdvisor®',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Supply Chain Management',
    operatingSystem: 'Web',
    url: site,
    image: `${site}/og-image.png`,
    description:
      'End-to-end supply-chain OS: supplier & customer network, inventory, manufacturing (MPS/MRP/BOM), distribution, operations tower, banking, accounting, and Super-Cube leadership intelligence.',
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '0',
      highPrice: '299',
      priceCurrency: 'ZAR',
      offerCount: 3,
      description: '30-day free trial · from R299/mo · founding free seats while available',
      url: `${site}/pricing`,
    },
    featureList: [
      'Verified supplier & customer network (SRM / CRM)',
      'Public company SEO profiles',
      'Operations control tower',
      'Inventory & warehouse',
      'Manufacturing MPS / MRP / BOM',
      'Distribution & logistics',
      'Banking middleware & reconciliation',
      'Accounting & multi-currency',
      'AI intelligence & Super-Cube leadership',
    ],
    publisher: { '@id': `${site}/#organization` },
  };

  const webPage = {
    '@type': 'WebPage',
    '@id': `${site}/#webpage`,
    url: site,
    name: 'SupplierAdvisor® — Supply Chain Operating System',
    isPartOf: { '@id': `${site}/#website` },
    about: { '@id': `${site}/#software` },
    description:
      'Verified trade, inventory, manufacturing, distribution, and intelligence in one company workspace.',
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: `${site}/og-image.png`,
    },
    inLanguage: 'en',
  };

  const faq = {
    '@type': 'FAQPage',
    '@id': `${site}/#faq`,
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is SupplierAdvisor?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'SupplierAdvisor® is a supply-chain operating system and verified trade network for B2B, B2G and B2C — SRM, CRM, inventory, manufacturing, finance, and SHEQ.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do I list my business?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Register at ${site}/onboarding?type=business, complete your profile, and optionally verify with CIPC. Your company can get a public /c/ page.`,
        },
      },
      {
        '@type': 'Question',
        name: 'What is the verification SLA?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Paid CIPC identity verification on SupplierAdvisor targets a 24-hour SLA. See ${site}/verification-sla.`,
        },
      },
    ],
  };

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [organization, website, software, webPage, faq],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
