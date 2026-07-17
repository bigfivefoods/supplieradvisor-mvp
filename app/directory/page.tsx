import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Building2, Search, ShieldCheck, Star } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isEligibleForDiscovery } from '@/lib/business/completeness';
import CompanyLogo from '@/components/business/CompanyLogo';
import { companyPublicPath, SITE_URL } from '@/lib/seo/company-public';

export const revalidate = 300; // 5 min ISR for directory

type Search = {
  q?: string;
  industry?: string;
  city?: string;
  country?: string;
};

type DirCompany = {
  id: number;
  trading_name: string | null;
  legal_name: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  short_description: string | null;
  verification_status: string | null;
  trust_score: number | null;
};

function nameOf(c: DirCompany): string {
  return String(c.trading_name || c.legal_name || `Company #${c.id}`).trim();
}

async function loadDirectory(filters: Search): Promise<{
  companies: DirCompany[];
  industries: string[];
  cities: string[];
  countries: string[];
}> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, trading_name, legal_name, industry, city, country, logo_url, short_description, verification_status, trust_score, is_discoverable, email, updated_at'
    )
    .not('trading_name', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(800);

  if (error) {
    const retry = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, industry, city, country, logo_url, verification_status, is_discoverable'
      )
      .not('trading_name', 'is', null)
      .limit(400);
    const rows = (retry.data || []) as Array<Record<string, unknown>>;
    return filterAndFacet(rows, filters);
  }

  return filterAndFacet((data || []) as Array<Record<string, unknown>>, filters);
}

function filterAndFacet(
  rows: Array<Record<string, unknown>>,
  filters: Search
): {
  companies: DirCompany[];
  industries: string[];
  cities: string[];
  countries: string[];
} {
  const eligible = rows
    .filter((r) => isEligibleForDiscovery(r).ok)
    .map(
      (r): DirCompany => ({
        id: Number(r.id),
        trading_name: r.trading_name != null ? String(r.trading_name) : null,
        legal_name: r.legal_name != null ? String(r.legal_name) : null,
        industry: r.industry != null ? String(r.industry) : null,
        city: r.city != null ? String(r.city) : null,
        country: r.country != null ? String(r.country) : null,
        logo_url: r.logo_url != null ? String(r.logo_url) : null,
        short_description:
          r.short_description != null ? String(r.short_description) : null,
        verification_status:
          r.verification_status != null
            ? String(r.verification_status)
            : null,
        trust_score:
          r.trust_score != null && Number.isFinite(Number(r.trust_score))
            ? Number(r.trust_score)
            : null,
      })
    )
    .filter((c) => Number.isFinite(c.id) && c.id > 0);

  const q = String(filters.q || '')
    .toLowerCase()
    .trim();
  const industry = String(filters.industry || '').trim();
  const city = String(filters.city || '').trim();
  const country = String(filters.country || '').trim();

  let list = eligible;
  if (industry) {
    list = list.filter(
      (c) =>
        String(c.industry || '').toLowerCase() === industry.toLowerCase()
    );
  }
  if (city) {
    list = list.filter(
      (c) => String(c.city || '').toLowerCase() === city.toLowerCase()
    );
  }
  if (country) {
    list = list.filter(
      (c) => String(c.country || '').toLowerCase() === country.toLowerCase()
    );
  }
  if (q) {
    list = list.filter((c) => {
      const hay = [
        c.trading_name,
        c.legal_name,
        c.industry,
        c.city,
        c.country,
        c.short_description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  // Facets from full eligible set (not filtered) for stable UX
  const industries = [
    ...new Set(
      eligible.map((c) => c.industry).filter((x): x is string => Boolean(x))
    ),
  ].sort((a, b) => a.localeCompare(b));
  const cities = [
    ...new Set(
      eligible.map((c) => c.city).filter((x): x is string => Boolean(x))
    ),
  ].sort((a, b) => a.localeCompare(b));
  const countries = [
    ...new Set(
      eligible.map((c) => c.country).filter((x): x is string => Boolean(x))
    ),
  ].sort((a, b) => a.localeCompare(b));

  // Verified first, then name
  list = [...list].sort((a, b) => {
    const av =
      String(a.verification_status || '').toLowerCase() === 'verified' ? 0 : 1;
    const bv =
      String(b.verification_status || '').toLowerCase() === 'verified' ? 0 : 1;
    if (av !== bv) return av - bv;
    return nameOf(a).localeCompare(nameOf(b));
  });

  return {
    companies: list.slice(0, 200),
    industries,
    cities,
    countries,
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
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
  searchParams: Promise<Search>;
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
        name: nameOf(c),
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
              Verified profiles and public pages are built for Google and your
              buyers.
            </p>
          </div>
          <Link
            href="/onboarding?type=business"
            className="btn-primary !py-2.5 !px-4 text-sm shrink-0"
          >
            List your company
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <form
          method="get"
          action="/directory"
          className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-sm mb-6 grid sm:grid-cols-2 lg:grid-cols-5 gap-3"
        >
          <label className="lg:col-span-2 block">
            <span className="text-[10px] font-bold uppercase text-neutral-400">
              Search
            </span>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                name="q"
                defaultValue={sp.q || ''}
                placeholder="Company, industry, city…"
                className="w-full rounded-2xl border border-neutral-200 pl-9 pr-3 py-2.5 text-sm"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase text-neutral-400">
              Industry
            </span>
            <select
              name="industry"
              defaultValue={sp.industry || ''}
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2.5 text-sm bg-white"
            >
              <option value="">All industries</option>
              {industries.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase text-neutral-400">
              City
            </span>
            <select
              name="city"
              defaultValue={sp.city || ''}
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2.5 text-sm bg-white"
            >
              <option value="">All cities</option>
              {cities.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase text-neutral-400">
              Country
            </span>
            <select
              name="country"
              defaultValue={sp.country || ''}
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2.5 text-sm bg-white"
            >
              <option value="">All countries</option>
              {countries.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 lg:col-span-5 flex flex-wrap gap-2">
            <button type="submit" className="btn-primary !py-2.5 !px-5 text-sm">
              Apply filters
            </button>
            <Link
              href="/directory"
              className="btn-secondary !py-2.5 !px-4 text-sm"
            >
              Clear
            </Link>
          </div>
        </form>

        <p className="text-sm text-neutral-600 mb-4">
          <strong className="text-slate-900">{companies.length}</strong> compan
          {companies.length === 1 ? 'y' : 'ies'}
          {filterSummary ? (
            <span className="text-neutral-500"> · {filterSummary}</span>
          ) : null}
        </p>

        {companies.length === 0 ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-12 text-center">
            <Building2 className="w-10 h-10 mx-auto text-neutral-300 mb-3" />
            <p className="text-sm text-neutral-600 font-semibold">
              No companies match these filters.
            </p>
            <Link
              href="/directory"
              className="inline-block mt-4 text-sm font-bold text-[#0077b6] hover:underline"
            >
              View all →
            </Link>
          </div>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-4">
            {companies.map((c) => {
              const n = nameOf(c);
              const verified =
                String(c.verification_status || '').toLowerCase() ===
                'verified';
              const loc = [c.city, c.country].filter(Boolean).join(', ');
              const href = companyPublicPath(c);
              return (
                <li key={c.id}>
                  <Link
                    href={href}
                    className="flex gap-3 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-[#00b4d8]/50 hover:shadow-md transition-all h-full"
                  >
                    <CompanyLogo logoUrl={c.logo_url} name={n} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-black text-slate-900 truncate">
                          {n}
                        </h2>
                        {verified ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                            <ShieldCheck className="w-3 h-3" /> Verified
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {[c.industry, loc].filter(Boolean).join(' · ') ||
                          'On SupplierAdvisor'}
                      </p>
                      {c.short_description ? (
                        <p className="text-xs text-neutral-600 mt-1.5 line-clamp-2 leading-relaxed">
                          {c.short_description}
                        </p>
                      ) : null}
                      {c.trust_score != null && c.trust_score > 0 ? (
                        <p className="mt-1.5 text-[11px] font-semibold text-amber-800 inline-flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          Trust {Math.round(c.trust_score)}
                        </p>
                      ) : null}
                      {loc ? (
                        <p className="mt-1 text-[11px] text-neutral-400 inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {loc}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <aside className="mt-10 rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-4 text-sm text-slate-700">
          <p className="font-bold text-slate-900 mb-1">Get found on Google</p>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Each company has a public SEO page (name, industry, city) linked
            from this directory and{' '}
            <code className="text-[11px]">sitemap.xml</code>. Complete your
            profile, turn on discoverability, and verify with CIPC for a
            stronger listing.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/dashboard/my-business/profile"
              className="text-xs font-bold text-[#0077b6] hover:underline"
            >
              Edit my profile →
            </Link>
            <Link
              href="/pricing"
              className="text-xs font-bold text-[#0077b6] hover:underline"
            >
              Pricing →
            </Link>
          </div>
        </aside>
      </main>
    </div>
  );
}
