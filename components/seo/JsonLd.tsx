/**
 * Server-rendered JSON-LD for Google / rich results.
 * Keep as a server component (no 'use client').
 */
export default function JsonLd() {
  const site = 'https://www.supplieradvisor.com';

  const organization = {
    '@type': 'Organization',
    '@id': `${site}/#organization`,
    name: 'SupplierAdvisor',
    legalName: 'SupplierAdvisor',
    alternateName: ['SupplierAdvisor®', 'Supplier Advisor'],
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
    areaServed: 'Worldwide',
    sameAs: [] as string[],
  };

  const website = {
    '@type': 'WebSite',
    '@id': `${site}/#website`,
    url: site,
    name: 'SupplierAdvisor®',
    description:
      'Supply chain operating system for verified B2B, B2G and B2C trade.',
    publisher: { '@id': `${site}/#organization` },
    inLanguage: 'en',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${site}/login?next=/dashboard/srm/discover`,
      },
      'query-input': 'required name=search_term_string',
    },
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
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Start free — join the verified network',
      url: `${site}/onboarding?type=business`,
    },
    featureList: [
      'Verified supplier & customer network (SRM / CRM)',
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

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [organization, website, software, webPage],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
