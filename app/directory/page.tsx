import type { Metadata } from 'next';
import Link from 'next/link';
import {
  loadDirectory,
  facetSlug,
  dirCompanyName,
  type DirectoryFilters,
} from '@/lib/seo/directory-data';
import { companyPublicPath, SITE_URL } from '@/lib/seo/company-public';
import DirectoryCompanyGrid from '@/components/seo/DirectoryCompanyGrid';
import DirectoryFiltersPanel from '@/components/seo/DirectoryFiltersPanel';
import DirectoryInviteForm from '@/components/seo/DirectoryInviteForm';

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<DirectoryFilters>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const parts: string[] = [];
  if (sp.industry) parts.push(String(sp.industry));
  if (sp.city) parts.push(`in ${sp.city}`);
  if (sp.country && !sp.city) parts.push(`in ${sp.country}`);
  const focus = parts.length ? parts.join(' ') : 'verified B2B companies';
  const title = `Supplier directory — ${focus}`;
  const description = `Browse ${focus} on SupplierAdvisor. Find CIPC-verified suppliers and trade partners across Africa and beyond.`;
  const qs = new URLSearchParams();
  if (sp.q) qs.set('q', String(sp.q));
  if (sp.industry) qs.set('industry', String(sp.industry));
  if (sp.city) qs.set('city', String(sp.city));
  if (sp.country) qs.set('country', String(sp.country));
  const canonical = `${SITE_URL}/directory${qs.toString() ? `?${qs}` : ''}`;

  return {
    title,
    description,
    keywords: [
      'supplier directory',
      'B2B suppliers',
      'verified companies',
      'SupplierAdvisor',
      sp.industry,
      sp.city,
      sp.country,
      'South Africa suppliers',
    ].filter(Boolean) as string[],
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

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<DirectoryFilters>;
}) {
  const sp = await searchParams;
  const { companies, industries, cities, countries } = await loadDirectory(sp);

  const filterSummary = [
    sp.industry && `Industry: ${sp.industry}`,
    sp.city && `City: ${sp.city}`,
    sp.country && `Country: ${sp.country}`,
    sp.q && `Search: “${sp.q}”`,
  ]
    .filter(Boolean)
    .join(' · ');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'SupplierAdvisor company directory',
    description:
      'Public directory of discoverable companies on the SupplierAdvisor trade network.',
    url: `${SITE_URL}/directory`,
    isPartOf: { '@type': 'WebSite', name: 'SupplierAdvisor', url: SITE_URL },
    numberOfItems: companies.length,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: companies.slice(0, 50).map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}${companyPublicPath(c)}`,
        name: dirCompanyName(c),
      })),
    },
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/"
              className="text-xs font-bold uppercase tracking-wider text-[#0077b6]"
            >
              SupplierAdvisor®
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
              Company directory
            </h1>
            <p className="text-sm text-neutral-600 mt-1 max-w-xl">
              Discover suppliers and trade partners listed on SupplierAdvisor.
              Browse by industry or city for Google-friendly hub pages.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Link
              href="/login?next=/dashboard/suppliers/discover"
              className="btn-secondary !py-2.5 !px-4 text-sm text-center"
            >
              Sign in to connect
            </Link>
            <Link
              href="/onboarding?type=business"
              className="btn-primary !py-2.5 !px-4 text-sm text-center"
            >
              List your company free
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <DirectoryFiltersPanel
          values={{
            q: sp.q ? String(sp.q) : undefined,
            industry: sp.industry ? String(sp.industry) : undefined,
            city: sp.city ? String(sp.city) : undefined,
            country: sp.country ? String(sp.country) : undefined,
          }}
          industries={industries}
          cities={cities}
          countries={countries}
        />

        {industries.length > 0 ? (
          <section className="mb-5" aria-labelledby="hub-industries">
            <h2
              id="hub-industries"
              className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-2"
            >
              Browse by industry
            </h2>
            <div className="flex flex-wrap gap-2">
              {industries.slice(0, 24).map((ind) => (
                <Link
                  key={ind}
                  href={`/directory/industry/${facetSlug(ind)}`}
                  className="rounded-full border border-sky-100 bg-sky-50/80 px-3 py-1 text-xs font-semibold text-sky-900 hover:border-[#00b4d8] hover:bg-sky-50"
                >
                  {ind}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {cities.length > 0 ? (
          <section className="mb-5" aria-labelledby="hub-cities">
            <h2
              id="hub-cities"
              className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-2"
            >
              Browse by city
            </h2>
            <div className="flex flex-wrap gap-2">
              {cities.slice(0, 24).map((city) => (
                <Link
                  key={city}
                  href={`/directory/city/${facetSlug(city)}`}
                  className="rounded-full border border-violet-100 bg-violet-50/70 px-3 py-1 text-xs font-semibold text-violet-900 hover:border-violet-300"
                >
                  {city}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {countries.length > 0 ? (
          <section className="mb-6" aria-labelledby="hub-countries">
            <h2
              id="hub-countries"
              className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-2"
            >
              Browse by country
            </h2>
            <div className="flex flex-wrap gap-2">
              {countries.slice(0, 24).map((country) => (
                <Link
                  key={country}
                  href={`/directory/country/${facetSlug(country)}`}
                  className="rounded-full border border-emerald-100 bg-emerald-50/70 px-3 py-1 text-xs font-semibold text-emerald-900 hover:border-emerald-300"
                >
                  {country}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <p className="text-sm text-neutral-600 mb-4">
          <strong className="text-slate-900">{companies.length}</strong> compan
          {companies.length === 1 ? 'y' : 'ies'}
          {filterSummary ? (
            <span className="text-neutral-500"> · {filterSummary}</span>
          ) : null}
        </p>

        <DirectoryCompanyGrid companies={companies} />

        <div className="mt-8">
          <DirectoryInviteForm />
        </div>

        <aside className="mt-10 rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-5 text-sm text-slate-700">
          <p className="font-bold text-slate-900 mb-1 text-base">
            Get found on Google · grow the network
          </p>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Each company has a public SEO page (name, industry, city, country)
            linked from this directory and{' '}
            <code className="text-[11px]">sitemap.xml</code>. Complete your
            profile (logo, city, blurb), turn on discoverability, and verify with
            CIPC — then partners can find you and connect on SupplierAdvisor.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/onboarding?type=business"
              className="btn-primary !py-2 !px-4 text-xs"
            >
              Register your business
            </Link>
            <Link
              href="/dashboard/my-business/profile"
              className="btn-secondary !py-2 !px-4 text-xs"
            >
              Improve my public page
            </Link>
            <Link
              href="/pricing"
              className="text-xs font-bold text-[#0077b6] hover:underline self-center"
            >
              Pricing →
            </Link>
          </div>
        </aside>
      </main>
    </div>
  );
}
