import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import {
  facetSlug,
  loadDirectory,
  matchFacetBySlug,
  dirCompanyName,
} from '@/lib/seo/directory-data';
import { companyPublicPath, SITE_URL } from '@/lib/seo/company-public';
import DirectoryCompanyGrid from '@/components/seo/DirectoryCompanyGrid';

export const revalidate = 300;

type Props = { params: Promise<{ slug: string; citySlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, citySlug } = await params;
  const { industries, cities } = await loadDirectory({});
  const industry = matchFacetBySlug(industries, slug);
  const city = matchFacetBySlug(cities, citySlug);
  if (!industry || !city) {
    return { title: 'Not found', robots: { index: false } };
  }
  const { companies } = await loadDirectory({ industry, city }, { listLimit: 500 });
  const n = companies.length;
  const title = `${industry} suppliers in ${city}`;
  const description = `Find ${n || ''} ${industry} companies and suppliers in ${city} on SupplierAdvisor. Verified B2B trade profiles — connect, raise POs, and grow your network.`;
  const canonical = `${SITE_URL}/directory/industry/${facetSlug(industry)}/in/${facetSlug(city)}`;
  return {
    title,
    description: description.replace(/\s+/g, ' ').trim(),
    keywords: [
      industry,
      city,
      `${industry} ${city}`,
      `${industry} suppliers ${city}`,
      `suppliers in ${city}`,
      `${industry} companies`,
      'SupplierAdvisor',
      'B2B directory',
      'verified suppliers',
    ],
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'SupplierAdvisor®',
      type: 'website',
      locale: 'en_ZA',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.png'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export default async function IndustryCityHubPage({ params }: Props) {
  const { slug, citySlug } = await params;
  const base = await loadDirectory({});
  const industry = matchFacetBySlug(base.industries, slug);
  const city = matchFacetBySlug(base.cities, citySlug);
  if (!industry || !city) notFound();

  const { companies, countries } = await loadDirectory(
    { industry, city },
    { listLimit: 500 }
  );
  const verifiedCount = companies.filter(
    (c) => String(c.verification_status || '').toLowerCase() === 'verified'
  ).length;
  const countryHint =
    companies.find((c) => c.country)?.country || countries[0] || null;

  const canonical = `${SITE_URL}/directory/industry/${facetSlug(industry)}/in/${facetSlug(city)}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#page`,
        name: `${industry} suppliers in ${city}`,
        description: `Directory of ${industry} companies based in ${city}${
          countryHint ? `, ${countryHint}` : ''
        } on SupplierAdvisor.`,
        url: canonical,
        numberOfItems: companies.length,
        isPartOf: {
          '@type': 'WebSite',
          name: 'SupplierAdvisor',
          url: SITE_URL,
        },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: companies.slice(0, 50).map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: dirCompanyName(c),
            url: `${SITE_URL}${companyPublicPath(c)}`,
          })),
        },
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
            name: 'Directory',
            item: `${SITE_URL}/directory`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: industry,
            item: `${SITE_URL}/directory/industry/${facetSlug(industry)}`,
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: city,
            item: canonical,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `Where can I find ${industry} suppliers in ${city}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `SupplierAdvisor lists ${companies.length} discoverable ${industry} compan${
                companies.length === 1 ? 'y' : 'ies'
              } in ${city}. Browse profiles, check verification, and connect to trade at ${canonical}.`,
            },
          },
          {
            '@type': 'Question',
            name: `How do I list my ${industry} company in ${city}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Register free at ${SITE_URL}/onboarding?type=business, complete your profile with industry and city, and turn on discoverability. You get a public /c/ SEO page linked from this hub.`,
            },
          },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-1 text-xs text-neutral-500 mb-2"
          >
            <Link href="/" className="font-semibold hover:text-[#0077b6]">
              Home
            </Link>
            <ChevronRight className="w-3 h-3" />
            <Link
              href="/directory"
              className="font-semibold hover:text-[#0077b6]"
            >
              Directory
            </Link>
            <ChevronRight className="w-3 h-3" />
            <Link
              href={`/directory/industry/${facetSlug(industry)}`}
              className="font-semibold hover:text-[#0077b6]"
            >
              {industry}
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="font-bold text-slate-700">{city}</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {industry} suppliers in {city}
          </h1>
          <p className="text-sm text-neutral-600 mt-1 max-w-2xl">
            {companies.length} discoverable {industry} compan
            {companies.length === 1 ? 'y' : 'ies'} in{' '}
            <strong>
              {city}
              {countryHint ? `, ${countryHint}` : ''}
            </strong>
            {verifiedCount > 0
              ? ` · ${verifiedCount} CIPC-verified`
              : ''}{' '}
            on SupplierAdvisor. Connect with local trade partners and grow your
            network.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/directory/industry/${facetSlug(industry)}`}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              All {industry}
            </Link>
            <Link
              href={`/directory/city/${facetSlug(city)}`}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              All in {city}
            </Link>
            <Link
              href="/onboarding?type=business"
              className="btn-primary !py-2 !px-3 text-xs"
            >
              List your company
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <DirectoryCompanyGrid companies={companies} />

        <aside className="mt-10 rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-5 text-sm text-slate-700">
          <p className="font-bold text-slate-900 mb-1">
            Get your {industry} business found in {city}
          </p>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Every listed company gets a public SEO page (/c/slug-id), appears in
            Google via sitemap.xml, and is linked from industry and city hubs
            like this one.
          </p>
          <Link
            href="/onboarding?type=business"
            className="btn-primary !py-2 !px-4 text-xs mt-3 inline-flex"
          >
            Register free
          </Link>
        </aside>
      </main>
    </div>
  );
}
