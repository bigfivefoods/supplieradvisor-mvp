import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, ExternalLink, Building2, Star } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isEligibleForDiscovery } from '@/lib/business/completeness';
import CompanyLogo from '@/components/business/CompanyLogo';
import TrustBadges from '@/components/business/TrustBadges';
import PublicConnectButton from '@/components/business/PublicConnectButton';

/** Aggregate public ratings (quote QR + invoice feedback). Soft if table missing. */
async function loadPublicRatingStats(companyId: number): Promise<{
  avg: number | null;
  count: number;
}> {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('invoice_feedback')
      .select('rating, feedback_type')
      .eq('profile_id', companyId)
      .not('rating', 'is', null)
      .limit(500);
    if (error || !data?.length) return { avg: null, count: 0 };
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
};

function asCompany(row: Record<string, unknown>): PublicCompany {
  return {
    id: Number(row.id),
    trading_name: row.trading_name != null ? String(row.trading_name) : null,
    legal_name: row.legal_name != null ? String(row.legal_name) : null,
    verification_status:
      row.verification_status != null ? String(row.verification_status) : null,
    is_verified:
      row.is_verified === true ||
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
    is_discoverable: row.is_discoverable !== false && row.is_discoverable !== 'false',
    registration_number:
      row.registration_number != null ? String(row.registration_number) : null,
    bank_verification_status:
      row.bank_verification_status != null
        ? String(row.bank_verification_status)
        : null,
    metadata: row.metadata,
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
      'id, trading_name, legal_name, verification_status, industry, city, province, country, continent, logo_url, website, short_description, description, about, bee_level, certifications, trust_score, otifef_average, is_discoverable, registration_number, bank_verification_status, metadata, deleted_at'
    )
    .eq('id', id)
    .maybeSingle();

  let row = data as Record<string, unknown> | null;
  if (!row) {
    // Retry without optional/missing columns (deleted_at, bank_*, etc.)
    const retry = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, verification_status, industry, city, province, country, logo_url, website, short_description, description, is_discoverable, metadata'
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
  const c = await loadCompany(id);
  if (!c) return { title: 'Company · SupplierAdvisor' };
  const name = c.trading_name || c.legal_name || 'Company';
  const desc =
    (c.short_description || c.description || c.about || '').slice(0, 160) ||
    `${name} on SupplierAdvisor — verified African trade network.`;
  return {
    title: `${name} · SupplierAdvisor Directory`,
    description: desc,
    openGraph: {
      title: name,
      description: desc,
      images: c.logo_url ? [c.logo_url] : undefined,
    },
  };
}

/**
 * Public SEO company page — /c/[id]
 * Discoverable companies only.
 */
export default async function PublicCompanyPage({
  params,
  searchParams,
}: Props & { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = (await searchParams) || {};
  const from = String(sp.from || sp.src || '');
  // Allow quote / rate deep-links to open incomplete-but-real profiles
  const bypassDiscovery = ['quote', 'rate', 'r'].includes(from.toLowerCase());
  const c = await loadCompany(id, { bypassDiscovery });
  if (!c) notFound();

  const name = c.trading_name || c.legal_name || 'Company';
  const legalName = c.legal_name;
  const showLegalName = Boolean(legalName && legalName !== name);
  const verified =
    c.is_verified === true ||
    String(c.verification_status || '').toLowerCase() === 'verified';
  const location = [c.city, c.province, c.country].filter(Boolean).join(', ');
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

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <Link href="/#directory" className="text-sm font-bold text-[#0077b6]">
            ← Directory
          </Link>
          <Link href="/" className="text-xs font-semibold text-neutral-500">
            SupplierAdvisor®
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <article className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <CompanyLogo logoUrl={c.logo_url} name={name} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                {name}
              </h1>
              {showLegalName ? (
                <p className="text-sm text-neutral-500 mt-0.5">{legalName}</p>
              ) : null}
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

          <dl className="mt-6 grid sm:grid-cols-2 gap-3 text-sm">
            {industry ? (
              <div className="rounded-xl bg-neutral-50 p-3">
                <dt className="text-[10px] font-bold uppercase text-neutral-400">
                  Industry
                </dt>
                <dd className="font-semibold text-slate-800 mt-0.5">{industry}</dd>
              </div>
            ) : null}
            {location ? (
              <div className="rounded-xl bg-neutral-50 p-3">
                <dt className="text-[10px] font-bold uppercase text-neutral-400">
                  Location
                </dt>
                <dd className="font-semibold text-slate-800 mt-0.5 inline-flex items-center gap-1">
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
            <p className="mt-6 text-sm text-neutral-700 leading-relaxed">{about}</p>
          ) : null}

          {certs.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {certs.map((cert) => (
                <span
                  key={cert}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-600"
                >
                  {cert}
                </span>
              ))}
            </div>
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
        </article>
      </main>
    </div>
  );
}
