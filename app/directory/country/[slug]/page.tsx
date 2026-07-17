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

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { countries, companies } = await loadDirectory({});
  const country = matchFacetBySlug(countries, slug);
  if (!country) {
    return { title: 'Country not found', robots: { index: false } };
  }
  const n = companies.filter(
    (c) => String(c.country || '').toLowerCase() === country.toLowerCase()
  ).length;
  const title = `Suppliers & companies in ${country}`;
  const description = `Find ${n || ''} B2B suppliers and trade partners in ${country} on SupplierAdvisor. Verified company profiles for buyers and sellers.`;
  const canonical = `${SITE_URL}/directory/country/${facetSlug(country)}`;
  return {
    title,
    description: description.replace(/\s+/g, ' ').trim(),
    keywords: [
      country,
      `suppliers in ${country}`,
      `B2B ${country}`,
      'SupplierAdvisor',
      'verified suppliers',
    ],
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'SupplierAdvisor®',
      type: 'website',
    },
    robots: { index: true, follow: true },
  };
}

export default async function CountryHubPage({ params }: Props) {
  const { slug } = await params;
  const base = await loadDirectory({});
  const country = matchFacetBySlug(base.countries, slug);
  if (!country) notFound();

  const { companies, industries, cities } = await loadDirectory({ country });

  const canonical = `${SITE_URL}/directory/country/${facetSlug(country)}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Companies in ${country}`,
    description: `SupplierAdvisor directory of companies in ${country}.`,
    url: canonical,
    numberOfItems: companies.length,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: companies.slice(0, 40).map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: dirCompanyName(c),
        url: `${SITE_URL}${companyPublicPath(c)}`,
      })),
    },
  };

  const industryFacets = [
    ...new Set(
      companies.map((c) => c.industry).filter((x): x is string => Boolean(x))
    ),
  ]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 16);
  const cityFacets = [
    ...new Set(
      companies.map((c) => c.city).filter((x): x is string => Boolean(x))
    ),
  ]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 16);

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
            <span className="font-bold text-slate-700">{country}</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Suppliers & companies in {country}
          </h1>
          <p className="text-sm text-neutral-600 mt-1 max-w-2xl">
            {companies.length} discoverable compan
            {companies.length === 1 ? 'y' : 'ies'} in <strong>{country}</strong>{' '}
            on SupplierAdvisor.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/directory"
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              All countries
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
        {industryFacets.length > 0 ? (
          <div className="mb-4">
            <h2 className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-2">
              Industries in {country}
            </h2>
            <div className="flex flex-wrap gap-2">
              {industryFacets.map((ind) => (
                <Link
                  key={ind}
                  href={`/directory/industry/${facetSlug(ind)}`}
                  className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-[#00b4d8]"
                >
                  {ind}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        {cityFacets.length > 0 ? (
          <div className="mb-6">
            <h2 className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-2">
              Cities in {country}
            </h2>
            <div className="flex flex-wrap gap-2">
              {cityFacets.map((city) => (
                <Link
                  key={city}
                  href={`/directory/city/${facetSlug(city)}`}
                  className="rounded-full border border-violet-100 bg-violet-50/70 px-3 py-1 text-xs font-semibold text-violet-900 hover:border-violet-300"
                >
                  {city}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <DirectoryCompanyGrid companies={companies} />
      </main>
    </div>
  );
}
