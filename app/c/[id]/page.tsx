import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, ExternalLink, Building2, Star, ChevronRight } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isEligibleForDiscovery } from '@/lib/business/completeness';
import CompanyLogo from '@/components/business/CompanyLogo';
import TrustBadges from '@/components/business/TrustBadges';
import PublicConnectButton from '@/components/business/PublicConnectButton';
import CompanyJsonLd from '@/components/seo/CompanyJsonLd';
import {
  companyCanonicalUrl,
  companyDisplayName,
  companyJsonLdGraph,
  companyLocationLine,
  companySeoDescription,
  companySeoKeywords,
  companySeoTitle,
  isCompanyVerified,
  SITE_URL,
} from '@/lib/seo/company-public';

/** Aggregate public ratings (quote QR + invoice feedback). Soft if table missing. */
async function loadPublicRatingStats(companyId: number): Promise<{
  avg: number | null;
  count: number;
}> {
  try {
    const supabase = getSupabaseServer();
    // Prefer public QR ratings, then any invoice feedback with stars
    const { data, error } = await supabase
      .from('invoice_feedback')
      .select('rating, feedback_type')
      .eq('profile_id', companyId)
      .not('rating', 'is', null)
      .limit(500);
    if (error || !data?.length) {
      // Fallback: peer company_ratings
      try {
        const { data: peer } = await supabase
          .from('company_ratings')
          .select('overall')
          .eq('ratee_profile_id', companyId)
          .eq('status', 'published')
          .limit(200);
        if (peer?.length) {
          const ratings = peer
            .map((r) => Number(r.overall))
            .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
          if (ratings.length) {
            return {
              avg:
                Math.round(
                  (ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10
                ) / 10,
              count: ratings.length,
            };
          }
        }
      } catch {
        /* soft */
      }
      return { avg: null, count: 0 };
    }
    const ratings = data
      .map((r) => Number(r.rating))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
    if (!ratings.length) return { avg: null, count: 0 };
    const sum = ratings.reduce((a, b) => a + b, 0);
    return {
      avg: Math.round((sum / ratings.length) * 10) / 10,
      count: ratings.length,
    };
  } catch {
    return { avg: null, count: 0 };
  }
}

type Props = { params: Promise<{ id: string }> };

type PublicCompany = {
  id: number;
  trading_name: string | null;
  legal_name: string | null;
  verification_status: string | null;
  is_verified: boolean | null;
  industry: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  continent: string | null;
  logo_url: string | null;
  website: string | null;
  short_description: string | null;
  description: string | null;
  about: string | null;
  bee_level: string | null;
  certifications: unknown;
  trust_score: number | null;
  otifef_average: number | null;
  is_discoverable: boolean | null;
  registration_number: string | null;
  bank_verification_status: string | null;
  metadata: unknown;
  updated_at?: string | null;
};

function asCompany(row: Record<string, unknown>): PublicCompany {
  return {
    id: Number(row.id),
    trading_name: row.trading_name != null ? String(row.trading_name) : null,
    legal_name: row.legal_name != null ? String(row.legal_name) : null,
    verification_status:
      row.verification_status != null ? String(row.verification_status) : null,
    is_verified:
      String(row.verification_status || '').toLowerCase() === 'verified',
    industry: row.industry != null ? String(row.industry) : null,
    city: row.city != null ? String(row.city) : null,
    province: row.province != null ? String(row.province) : null,
    country: row.country != null ? String(row.country) : null,
    continent: row.continent != null ? String(row.continent) : null,
    logo_url: row.logo_url != null ? String(row.logo_url) : null,
    website: row.website != null ? String(row.website) : null,
    short_description:
      row.short_description != null ? String(row.short_description) : null,
    description: row.description != null ? String(row.description) : null,
    about: row.about != null ? String(row.about) : null,
    bee_level: row.bee_level != null ? String(row.bee_level) : null,
    certifications: row.certifications,
    trust_score:
      row.trust_score != null && Number.isFinite(Number(row.trust_score))
        ? Number(row.trust_score)
        : null,
    otifef_average:
      row.otifef_average != null && Number.isFinite(Number(row.otifef_average))
        ? Number(row.otifef_average)
        : null,
    is_discoverable:
      row.is_discoverable !== false && row.is_discoverable !== 'false',
    registration_number:
      row.registration_number != null ? String(row.registration_number) : null,
    bank_verification_status:
      row.bank_verification_status != null
        ? String(row.bank_verification_status)
        : null,
    metadata: row.metadata,
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
  };
}

async function loadCompany(
  idParam: string,
  opts?: { bypassDiscovery?: boolean }
): Promise<PublicCompany | null> {
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) return null;
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('profiles')
    .select(
      // Do not select is_verified — column does not exist on profiles
      'id, trading_name, legal_name, verification_status, industry, city, province, country, continent, logo_url, website, short_description, description, about, bee_level, certifications, trust_score, otifef_average, is_discoverable, registration_number, bank_verification_status, metadata, deleted_at, updated_at'
    )
    .eq('id', id)
    .maybeSingle();

  let row = data as Record<string, unknown> | null;
  if (!row) {
    const retry = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, verification_status, industry, city, province, country, logo_url, website, short_description, description, is_discoverable, metadata, updated_at'
      )
      .eq('id', id)
      .maybeSingle();
    if (!retry.data) return null;
    row = retry.data as Record<string, unknown>;
  }
  if (row.deleted_at) return null;
  const raw = row;
  // Quote/rate deep-links should still open the company even if not fully
  // discovery-eligible (completeness / opt-out still blocks open directory).
  if (!opts?.bypassDiscovery && !isEligibleForDiscovery(raw).ok) return null;
  return asCompany(raw);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // Only index discovery-eligible companies (bypass would be noindex)
  const c = await loadCompany(id);
  if (!c) {
    return {
      title: 'Company not found',
      robots: { index: false, follow: false },
    };
  }

  const ratings = await loadPublicRatingStats(c.id);
  const title = companySeoTitle(c);
  const description = companySeoDescription(c, {
    ratingAvg: ratings.avg,
    ratingCount: ratings.count,
  });
  const canonical = companyCanonicalUrl(c.id);
  const name = companyDisplayName(c);
  const keywords = companySeoKeywords(c);
  const images = c.logo_url
    ? [
        {
          url: c.logo_url,
          alt: `${name} logo`,
        },
      ]
    : [{ url: '/og-image.png', alt: 'SupplierAdvisor directory' }];

  return {
    title,
    description,
    keywords,
    authors: [{ name, url: canonical }],
    creator: name,
    publisher: 'SupplierAdvisor',
    category: c.industry || 'Business',
    alternates: {
      canonical,
    },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: 'SupplierAdvisor®',
      locale: 'en_ZA',
      title,
      description,
      images,
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: c.logo_url ? [c.logo_url] : ['/og-image.png'],
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
    other: {
      ...(c.country ? { 'geo.region': c.country } : {}),
      ...(c.city ? { 'geo.placename': c.city } : {}),
    },
  };
}

/**
 * Public SEO company page — /c/[id]
 * Discoverable companies only (unless ?from=quote|rate|r).
 */
export default async function PublicCompanyPage({
  params,
  searchParams,
}: Props & {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = (await searchParams) || {};
  const from = String(sp.from || sp.src || '');
  const bypassDiscovery = ['quote', 'rate', 'r'].includes(from.toLowerCase());
  const c = await loadCompany(id, { bypassDiscovery });
  if (!c) notFound();

  const name = companyDisplayName(c);
  const legalName = c.legal_name;
  const showLegalName = Boolean(legalName && legalName !== name);
  const verified = isCompanyVerified(c) || c.is_verified === true;
  const location = companyLocationLine(c);
  const about = (c.short_description || c.description || c.about || '').trim();
  const certs = Array.isArray(c.certifications)
    ? c.certifications.map(String)
    : [];
  const industry = c.industry;
  const registrationNumber = c.registration_number;
  const beeLevel = c.bee_level;
  const website = c.website;
  const publicRatings = await loadPublicRatingStats(c.id);
  const showBankBadge = (() => {
    const meta =
      c.metadata && typeof c.metadata === 'object'
        ? (c.metadata as Record<string, unknown>)
        : {};
    return meta.show_bank_verified_public === true;
  })();

  const pageUrl = companyCanonicalUrl(c.id);
  const jsonLd = companyJsonLdGraph(c, {
    ratingAvg: publicRatings.avg,
    ratingCount: publicRatings.count,
    pageUrl,
  });

  // SEO intro sentence (crawlable unique copy)
  const seoLead = [
    name,
    industry ? `is a ${industry} company` : 'is a B2B company',
    location ? `based in ${location}` : null,
    verified ? 'with CIPC-verified identity on SupplierAdvisor' : 'listed on SupplierAdvisor',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <CompanyJsonLd graph={jsonLd} />

      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-1 text-xs text-neutral-500 mb-2"
          >
            <Link href="/" className="font-semibold hover:text-[#0077b6]">
              SupplierAdvisor
            </Link>
            <ChevronRight className="w-3 h-3" aria-hidden />
            <Link
              href="/#directory"
              className="font-semibold hover:text-[#0077b6]"
            >
              Directory
            </Link>
            <ChevronRight className="w-3 h-3" aria-hidden />
            <span className="font-bold text-slate-700 truncate max-w-[12rem]">
              {name}
            </span>
          </nav>
          <div className="flex items-center justify-between">
            <Link href="/#directory" className="text-sm font-bold text-[#0077b6]">
              ← Directory
            </Link>
            <Link href="/" className="text-xs font-semibold text-neutral-500">
              SupplierAdvisor®
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <article
          className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-sm"
          itemScope
          itemType="https://schema.org/Organization"
        >
          <div className="flex items-start gap-4">
            <CompanyLogo logoUrl={c.logo_url} name={name} size="lg" />
            <div className="min-w-0 flex-1">
              <h1
                className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900"
                itemProp="name"
              >
                {name}
              </h1>
              {showLegalName ? (
                <p className="text-sm text-neutral-500 mt-0.5" itemProp="legalName">
                  {legalName}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
                {seoLead}.
              </p>
              <div className="mt-2">
                <TrustBadges
                  isVerified={verified}
                  verificationStatus={c.verification_status}
                  bankVerificationStatus={c.bank_verification_status}
                  showBankBadge={showBankBadge}
                  trustScore={c.trust_score}
                  otifefPct={c.otifef_average}
                />
              </div>
              {publicRatings.count > 0 && publicRatings.avg != null ? (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-950">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {publicRatings.avg.toFixed(1)}
                  <span className="font-semibold text-amber-800/80">
                    · {publicRatings.count} public rating
                    {publicRatings.count === 1 ? '' : 's'}
                  </span>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-neutral-400">
                  <Link
                    href={`/r/${c.id}?src=profile`}
                    className="font-semibold text-[#0077b6] hover:underline"
                  >
                    Rate this company →
                  </Link>
                </p>
              )}
            </div>
          </div>

          <h2 className="sr-only">Company details</h2>
          <dl className="mt-6 grid sm:grid-cols-2 gap-3 text-sm">
            {industry ? (
              <div className="rounded-xl bg-neutral-50 p-3">
                <dt className="text-[10px] font-bold uppercase text-neutral-400">
                  Industry
                </dt>
                <dd
                  className="font-semibold text-slate-800 mt-0.5"
                  itemProp="knowsAbout"
                >
                  {industry}
                </dd>
              </div>
            ) : null}
            {location ? (
              <div className="rounded-xl bg-neutral-50 p-3">
                <dt className="text-[10px] font-bold uppercase text-neutral-400">
                  Location
                </dt>
                <dd
                  className="font-semibold text-slate-800 mt-0.5 inline-flex items-center gap-1"
                  itemProp="address"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#00b4d8]" />
                  {location}
                </dd>
              </div>
            ) : null}
            {registrationNumber ? (
              <div className="rounded-xl bg-neutral-50 p-3">
                <dt className="text-[10px] font-bold uppercase text-neutral-400">
                  Registration
                </dt>
                <dd className="font-mono text-sm text-slate-800 mt-0.5">
                  {registrationNumber}
                </dd>
              </div>
            ) : null}
            {beeLevel ? (
              <div className="rounded-xl bg-neutral-50 p-3">
                <dt className="text-[10px] font-bold uppercase text-neutral-400">
                  B-BBEE
                </dt>
                <dd className="font-semibold text-slate-800 mt-0.5">{beeLevel}</dd>
              </div>
            ) : null}
          </dl>

          {about ? (
            <section className="mt-6" aria-labelledby="about-heading">
              <h2
                id="about-heading"
                className="text-sm font-black uppercase tracking-wide text-neutral-400 mb-2"
              >
                About {name}
              </h2>
              <p
                className="text-sm text-neutral-700 leading-relaxed"
                itemProp="description"
              >
                {about}
              </p>
            </section>
          ) : (
            <section className="mt-6" aria-labelledby="about-heading">
              <h2
                id="about-heading"
                className="text-sm font-black uppercase tracking-wide text-neutral-400 mb-2"
              >
                About {name}
              </h2>
              <p className="text-sm text-neutral-600 leading-relaxed">
                {name}
                {industry ? ` operates in ${industry}` : ''}
                {location ? ` from ${location}` : ''}. Find verified suppliers and
                customers on{' '}
                <Link href="/" className="font-semibold text-[#0077b6] hover:underline">
                  SupplierAdvisor.com
                </Link>
                — the trade network for trusted B2B supply chains.
              </p>
            </section>
          )}

          {certs.length > 0 ? (
            <section className="mt-4" aria-labelledby="certs-heading">
              <h2
                id="certs-heading"
                className="text-sm font-black uppercase tracking-wide text-neutral-400 mb-2"
              >
                Certifications
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {certs.map((cert) => (
                  <span
                    key={cert}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-600"
                  >
                    {cert}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3 items-center">
            <PublicConnectButton peerId={c.id} peerName={name} />
            {website ? (
              <a
                href={
                  website.startsWith('http') ? website : `https://${website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
                itemProp="url"
              >
                <ExternalLink className="w-4 h-4" /> Website
              </a>
            ) : null}
            <Link
              href="/#directory"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <Building2 className="w-4 h-4" /> Browse directory
            </Link>
          </div>

          <footer className="mt-8 pt-4 border-t border-neutral-100 text-[11px] text-neutral-400 leading-relaxed">
            <p>
              {name} is listed in the SupplierAdvisor public directory at{' '}
              <a href={pageUrl} className="text-[#0077b6] hover:underline">
                {pageUrl.replace(/^https?:\/\//, '')}
              </a>
              . SupplierAdvisor helps buyers and suppliers discover verified
              trade partners across Africa and beyond.
            </p>
            <p className="mt-1">
              <Link href={SITE_URL} className="hover:underline">
                Home
              </Link>
              {' · '}
              <Link href="/#directory" className="hover:underline">
                Company directory
              </Link>
              {' · '}
              <Link href="/pricing" className="hover:underline">
                Pricing
              </Link>
              {' · '}
              <Link href={`/r/${c.id}?src=seo`} className="hover:underline">
                Rate {name}
              </Link>
            </p>
          </footer>
        </article>
      </main>
    </div>
  );
}
