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
  const { cities, companies } = await loadDirectory({});
  const city = matchFacetBySlug(cities, slug);
  if (!city) {
    return { title: 'City not found', robots: { index: false } };
  }
  const n = companies.filter(
    (c) => String(c.city || '').toLowerCase() === city.toLowerCase()
  ).length;
  const title = `Suppliers & companies in ${city}`;
  const description = `Find ${n || ''} B2B suppliers and trade partners in ${city} on SupplierAdvisor. Verified company profiles for buyers and sellers.`;
  const canonical = `${SITE_URL}/directory/city/${facetSlug(city)}`;
  return {
    title,
    description: description.replace(/\s+/g, ' ').trim(),
    keywords: [
      city,
      `suppliers in ${city}`,
      `companies ${city}`,
      'B2B directory',
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

export default async function CityHubPage({ params }: Props) {
  const { slug } = await params;
  const base = await loadDirectory({});
  const city = matchFacetBySlug(base.cities, slug);
  if (!city) notFound();

  const { companies, industries, countries } = await loadDirectory({ city });

  const countryHint =
    companies.find((c) => c.country)?.country ||
    countries[0] ||
    null;

  const canonical = `${SITE_URL}/directory/city/${facetSlug(city)}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Companies in ${city}`,
    description: `SupplierAdvisor directory of companies based in ${city}${
      countryHint ? `, ${countryHint}` : ''
    }.`,
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
            <span className="font-bold text-slate-700">{city}</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Suppliers & companies in {city}
          </h1>
          <p className="text-sm text-neutral-600 mt-1 max-w-2xl">
            {companies.length} discoverable compan
            {companies.length === 1 ? 'y' : 'ies'}
            {countryHint ? ` in ${city}, ${countryHint}` : ` in ${city}`} on
            SupplierAdvisor. Browse verified trade partners near you.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/directory"
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              All cities
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
          <div className="mb-6">
            <h2 className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-2">
              Industries in {city}
            </h2>
            <div className="flex flex-wrap gap-2">
              {industryFacets.map((ind) => (
                <Link
                  key={ind}
                  href={`/directory/industry/${facetSlug(ind)}`}
                  className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-[#00b4d8] hover:text-[#0077b6]"
                >
                  {ind}
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
