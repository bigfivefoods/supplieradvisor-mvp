import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, ShieldCheck, ExternalLink, Building2 } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isEligibleForDiscovery } from '@/lib/business/completeness';
import CompanyLogo from '@/components/business/CompanyLogo';
import TrustBadges from '@/components/business/TrustBadges';

type Props = { params: Promise<{ id: string }> };

async function loadCompany(idParam: string) {
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) return null;
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('profiles')
    .select(
      'id, trading_name, legal_name, verification_status, is_verified, industry, city, province, country, continent, logo_url, website, short_description, description, about, bee_level, certifications, trust_score, otifef_average, is_discoverable, registration_number, bank_verification_status'
    )
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  if (!isEligibleForDiscovery(data as Record<string, unknown>).ok) return null;
  return data as Record<string, unknown>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = await loadCompany(id);
  if (!c) return { title: 'Company · SupplierAdvisor' };
  const name = String(c.trading_name || c.legal_name || 'Company');
  const desc =
    String(c.short_description || c.description || c.about || '').slice(0, 160) ||
    `${name} on SupplierAdvisor — verified African trade network.`;
  return {
    title: `${name} · SupplierAdvisor Directory`,
    description: desc,
    openGraph: {
      title: name,
      description: desc,
      images: c.logo_url ? [String(c.logo_url)] : undefined,
    },
  };
}

/**
 * Public SEO company page — /c/[id]
 * Discoverable companies only.
 */
export default async function PublicCompanyPage({ params }: Props) {
  const { id } = await params;
  const c = await loadCompany(id);
  if (!c) notFound();

  const name = String(c.trading_name || c.legal_name || 'Company');
  const verified =
    c.is_verified === true ||
    String(c.verification_status || '').toLowerCase() === 'verified';
  const location = [c.city, c.province, c.country].filter(Boolean).join(', ');
  const about = String(
    c.short_description || c.description || c.about || ''
  ).trim();
  const certs = Array.isArray(c.certifications)
    ? (c.certifications as string[]).map(String)
    : [];

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
            <CompanyLogo logoUrl={c.logo_url as string} name={name} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                {name}
              </h1>
              {c.legal_name && c.legal_name !== name && (
                <p className="text-sm text-neutral-500 mt-0.5">{String(c.legal_name)}</p>
              )}
              <div className="mt-2">
                <TrustBadges
                  isVerified={verified}
                  verificationStatus={c.verification_status as string}
                  bankVerificationStatus={c.bank_verification_status as string}
                  trustScore={c.trust_score as number}
                  otifefPct={c.otifef_average as number}
                />
              </div>
            </div>
          </div>

          <dl className="mt-6 grid sm:grid-cols-2 gap-3 text-sm">
            {c.industry ? (
              <div className="rounded-xl bg-neutral-50 p-3">
                <dt className="text-[10px] font-bold uppercase text-neutral-400">
                  Industry
                </dt>
                <dd className="font-semibold text-slate-800 mt-0.5">
                  {String(c.industry)}
                </dd>
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
            {c.registration_number ? (
              <div className="rounded-xl bg-neutral-50 p-3">
                <dt className="text-[10px] font-bold uppercase text-neutral-400">
                  Registration
                </dt>
                <dd className="font-mono text-sm text-slate-800 mt-0.5">
                  {String(c.registration_number)}
                </dd>
              </div>
            ) : null}
            {c.bee_level ? (
              <div className="rounded-xl bg-neutral-50 p-3">
                <dt className="text-[10px] font-bold uppercase text-neutral-400">
                  B-BBEE
                </dt>
                <dd className="font-semibold text-slate-800 mt-0.5">
                  {String(c.bee_level)}
                </dd>
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

          <div className="mt-8 flex flex-wrap gap-3">
            {c.website ? (
              <a
                href={
                  String(c.website).startsWith('http')
                    ? String(c.website)
                    : `https://${c.website}`
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
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <Building2 className="w-4 h-4" /> Browse directory
            </Link>
            <Link
              href="/login"
              className="text-sm font-semibold text-[#0077b6] hover:underline self-center"
            >
              Log in to connect →
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
