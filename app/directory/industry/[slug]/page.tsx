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
  const { industries, companies } = await loadDirectory({});
  const industry = matchFacetBySlug(industries, slug);
  if (!industry) {
    return { title: 'Industry not found', robots: { index: false } };
  }
  const title = `${industry} suppliers & companies`;
  const description = `Browse ${companies.filter((c) => String(c.industry || '').toLowerCase() === industry.toLowerCase()).length || ''} ${industry} companies on SupplierAdvisor — verified B2B trade network. Find suppliers and partners in ${industry}.`;
  const canonical = `${SITE_URL}/directory/industry/${facetSlug(industry)}`;
  return {
    title,
    description: description.replace(/\s+/g, ' ').trim(),
    keywords: [
      industry,
      `${industry} suppliers`,
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
    },
    robots: { index: true, follow: true },
  };
}

export default async function IndustryHubPage({ params }: Props) {
  const { slug } = await params;
  const base = await loadDirectory({});
  const industry = matchFacetBySlug(base.industries, slug);
  if (!industry) notFound();

  const { companies, cities, countries } = await loadDirectory({ industry });
  const verifiedCount = companies.filter(
    (c) => String(c.verification_status || '').toLowerCase() === 'verified'
  ).length;

  const canonical = `${SITE_URL}/directory/industry/${facetSlug(industry)}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${industry} suppliers on SupplierAdvisor`,
    description: `Directory of ${industry} companies on the SupplierAdvisor trade network. ${verifiedCount} CIPC-verified listings with a 24h paid verification SLA.`,
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

  // Related city chips from this industry set
  const cityFacets = [
    ...new Set(companies.map((c) => c.city).filter((x): x is string => Boolean(x))),
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
            <span className="font-bold text-slate-700">{industry}</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {industry} suppliers & companies
          </h1>
          <p className="text-sm text-neutral-600 mt-1 max-w-2xl">
            {companies.length} discoverable compan
            {companies.length === 1 ? 'y' : 'ies'} in{' '}
            <strong>{industry}</strong> on SupplierAdvisor
            {verifiedCount > 0
              ? ` · ${verifiedCount} CIPC-verified (paid identity, 24h SLA)`
              : ''}
            . Connect, raise POs, and close the trade loop with verified
            partners.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/directory"
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              All industries
            </Link>
            <Link
              href="/verification-sla"
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              Verification SLA
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
        {cityFacets.length > 0 ? (
          <div className="mb-6">
            <h2 className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-2">
              Cities with {industry} companies
            </h2>
            <div className="flex flex-wrap gap-2">
              {cityFacets.map((city) => (
                <Link
                  key={city}
                  href={`/directory/city/${facetSlug(city)}`}
                  className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-[#00b4d8] hover:text-[#0077b6]"
                >
                  {city}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {countries.length > 0 ? (
          <p className="text-xs text-neutral-500 mb-4">
            Countries in this industry:{' '}
            {countries.slice(0, 12).join(' · ')}
            {countries.length > 12 ? '…' : ''}
          </p>
        ) : null}

        <DirectoryCompanyGrid companies={companies} />
      </main>
    </div>
  );
}
