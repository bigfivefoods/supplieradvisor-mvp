import Link from 'next/link';
import { MapPin, ExternalLink, Building2, Star, ChevronRight } from 'lucide-react';
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
  isCompanyVerified,
  SITE_URL,
} from '@/lib/seo/company-public';
import VerifiedSlaBadge from '@/components/seo/VerifiedSlaBadge';
import { readPublicTrust } from '@/lib/verifynow/company-checks';
import { publicStorePath } from '@/lib/storefront/public-store';
import type { PublicCompany, PublicRatingSnapshot } from '@/lib/seo/load-public-company';

export default function CompanyPublicView({
  company: c,
  ratings,
}: {
  company: PublicCompany;
  ratings: PublicRatingSnapshot;
}) {
  const name = companyDisplayName(c);
  const legalName = c.legal_name;
  const showLegalName = Boolean(legalName && legalName !== name);
  const verified = isCompanyVerified(c) || c.is_verified === true;
  const location = companyLocationLine(c);
  const about = (c.short_description || c.description || c.about || '').trim();
  const certs = Array.isArray(c.certifications) ? c.certifications.map(String) : [];
  const industry = c.industry;
  const registrationNumber = c.registration_number;
  const beeLevel = c.bee_level;
  const website = c.website;
  const storePath = publicStorePath({
    tradingName: c.trading_name,
    legalName: c.legal_name,
    metadata: c.metadata,
  });
  const showBankBadge = (() => {
    const meta =
      c.metadata && typeof c.metadata === 'object'
        ? (c.metadata as Record<string, unknown>)
        : {};
    return meta.show_bank_verified_public === true;
  })();

  const pageUrl = companyCanonicalUrl(c);
  const jsonLd = companyJsonLdGraph(c, {
    reviews: ratings.reviews,
    pageUrl,
  });
  const claimHref = `/onboarding?type=business&claim=${c.id}&name=${encodeURIComponent(name)}`;
  const trialHref = `/onboarding?lane=b2b&claim=${c.id}&name=${encodeURIComponent(name)}`;

  const seoLead = [
    name,
    industry ? `is a ${industry} company` : 'is a B2B company',
    location ? `based in ${location}` : null,
    verified ? 'with CIPC-verified identity on SupplierAdvisor®' : 'listed on SupplierAdvisor®',
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
              SupplierAdvisor®
            </Link>
            <ChevronRight className="w-3 h-3" aria-hidden />
            <span className="font-bold text-slate-700 truncate max-w-[12rem]">{name}</span>
          </nav>
          <div className="flex items-center justify-between">
            <Link href="/" className="text-sm font-bold text-[#0077b6]">
              ← Home
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
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900" itemProp="name">
                {name}
              </h1>
              {showLegalName ? (
                <p className="text-sm text-neutral-500 mt-0.5" itemProp="legalName">
                  {legalName}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{seoLead}.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <TrustBadges
                  isVerified={verified}
                  verificationStatus={c.verification_status}
                  bankVerificationStatus={c.bank_verification_status}
                  showBankBadge={showBankBadge}
                  trustScore={c.trust_score}
                  otifefPct={c.otifef_average}
                  supplierTrust={(() => {
                    const trust = readPublicTrust(c.metadata);
                    return trust ? { status: trust.status, checkedAt: trust.checked_at } : null;
                  })()}
                />
                {verified ? <VerifiedSlaBadge verified companyName={name} compact /> : null}
              </div>
              {ratings.count > 0 && ratings.avg != null ? (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-950">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {ratings.avg.toFixed(1)}
                  <span className="font-semibold text-amber-800/80">
                    · {ratings.count} public rating{ratings.count === 1 ? '' : 's'}
                  </span>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-neutral-400">
                  <Link href={`/r/${c.id}?src=profile`} className="font-semibold text-[#0077b6] hover:underline">
                    Rate this company →
                  </Link>
                </p>
              )}
            </div>
          </div>

          <div className="mt-5">
            <VerifiedSlaBadge verified={verified} companyName={name} />
          </div>

          <h2 className="sr-only">Company details</h2>
          <dl className="mt-6 grid sm:grid-cols-2 gap-3 text-sm">
            {industry ? (
              <div className="rounded-xl bg-neutral-50 p-3">
                <dt className="text-[10px] font-bold uppercase text-neutral-400">Industry</dt>
                <dd className="font-semibold text-slate-800 mt-0.5" itemProp="knowsAbout">
                  {industry}
                </dd>
              </div>
            ) : null}
            {location ? (
              <div className="rounded-xl bg-neutral-50 p-3">
                <dt className="text-[10px] font-bold uppercase text-neutral-400">Location</dt>
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
                <dt className="text-[10px] font-bold uppercase text-neutral-400">Registration</dt>
                <dd className="font-mono text-sm text-slate-800 mt-0.5">{registrationNumber}</dd>
              </div>
            ) : null}
            {beeLevel ? (
              <div className="rounded-xl bg-neutral-50 p-3">
                <dt className="text-[10px] font-bold uppercase text-neutral-400">B-BBEE</dt>
                <dd className="font-semibold text-slate-800 mt-0.5">{beeLevel}</dd>
              </div>
            ) : null}
          </dl>

          {about ? (
            <section className="mt-6" aria-labelledby="about-heading">
              <h2 id="about-heading" className="text-sm font-black uppercase tracking-wide text-neutral-400 mb-2">
                About {name}
              </h2>
              <p className="text-sm text-neutral-700 leading-relaxed" itemProp="description">
                {about}
              </p>
            </section>
          ) : (
            <section className="mt-6" aria-labelledby="about-heading">
              <h2 id="about-heading" className="text-sm font-black uppercase tracking-wide text-neutral-400 mb-2">
                About {name}
              </h2>
              <p className="text-sm text-neutral-600 leading-relaxed">
                {name}
                {industry ? ` operates in ${industry}` : ''}
                {location ? ` from ${location}` : ''}. Find verified suppliers and customers on{' '}
                <Link href="/" className="font-semibold text-[#0077b6] hover:underline">
                  SupplierAdvisor.com
                </Link>
                .
              </p>
            </section>
          )}

          {certs.length > 0 ? (
            <section className="mt-4" aria-labelledby="certs-heading">
              <h2 id="certs-heading" className="text-sm font-black uppercase tracking-wide text-neutral-400 mb-2">
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
            {storePath ? (
              <Link
                href={storePath}
                className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
              >
                Order from catalogue
              </Link>
            ) : null}
            <Link
              href={`/me?join=1&company=${c.id}&brand=${encodeURIComponent(name)}&kind=customer`}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              Add to SA Member wallet
            </Link>
            <PublicConnectButton peerId={c.id} peerName={name} />
            <Link
              href={`/login?next=${encodeURIComponent(`/dashboard?peerTrade=${c.id}&peerName=${encodeURIComponent(name)}`)}`}
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              Connect &amp; trade
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(`/dashboard/connections?requestTrade=${c.id}&name=${encodeURIComponent(name)}`)}`}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              Request to trade
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(`/dashboard/settle?peer=${c.id}`)}`}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              Start settle
            </Link>
            {website ? (
              <a
                href={website.startsWith('http') ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
                itemProp="url"
              >
                <ExternalLink className="w-4 h-4" /> Website
              </a>
            ) : null}
            <Link
              href="/onboarding?type=business"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <Building2 className="w-4 h-4" /> Join network
            </Link>
          </div>

          <aside
            className="mt-6 rounded-2xl border border-[#00b4d8]/40 bg-[#00b4d8]/10 px-4 py-4"
            aria-label="Claim your profile or start a free trial"
          >
            <p className="text-sm font-black text-slate-900">Claim your profile</p>
            <p className="mt-1 text-xs text-slate-700 leading-relaxed">
              If this is your company, claim the listing on SupplierAdvisor®. New companies start a
              30-day free trial, then from R299/month.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={claimHref} className="btn-primary !py-2 !px-4 text-xs" data-cta="claim-profile">
                Claim your profile
              </Link>
              <Link href={trialHref} className="btn-primary !py-2 !px-4 text-xs" data-cta="start-free-trial">
                Start free trial
              </Link>
              <Link href="/pricing" className="btn-secondary !py-2 !px-4 text-xs">
                Pricing
              </Link>
              <Link
                href={`/login?next=${encodeURIComponent(`/dashboard/my-business/profile?claim=${c.id}`)}`}
                className="btn-secondary !py-2 !px-4 text-xs"
              >
                Sign in to manage
              </Link>
            </div>
          </aside>

          <section className="mt-8 rounded-2xl border border-neutral-200 bg-white px-4 py-4" aria-labelledby="company-faq">
            <h2 id="company-faq" className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-3">
              About this listing
            </h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-bold text-slate-800">Who is {name}?</dt>
                <dd className="mt-0.5 text-neutral-600 leading-relaxed">
                  {about ||
                    companySeoDescription(c, {
                      ratingAvg: ratings.avg,
                      ratingCount: ratings.count,
                    })}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-800">How do I connect with {name}?</dt>
                <dd className="mt-0.5 text-neutral-600 leading-relaxed">
                  Use Connect &amp; trade above, or{' '}
                  <Link
                    href={`/login?next=${encodeURIComponent(`/dashboard?peerTrade=${c.id}&peerName=${encodeURIComponent(name)}`)}`}
                    className="font-semibold text-[#0077b6] hover:underline"
                  >
                    sign in to start a trade
                  </Link>
                  .
                </dd>
              </div>
              {verified ? (
                <div>
                  <dt className="font-bold text-slate-800">Is {name} verified?</dt>
                  <dd className="mt-0.5 text-neutral-600 leading-relaxed">
                    Yes. CIPC-verified identity on SupplierAdvisor® (
                    <Link href="/verification-sla" className="font-semibold text-[#0077b6] hover:underline">
                      24h paid verification SLA
                    </Link>
                    ).
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <footer className="mt-8 pt-4 border-t border-neutral-100 text-[11px] text-neutral-400 leading-relaxed">
            <p>
              {name} public profile on SupplierAdvisor®:{' '}
              <a href={pageUrl} className="text-[#0077b6] hover:underline">
                {pageUrl.replace(/^https?:\/\//, '')}
              </a>
              . SupplierAdvisor® is the supply-chain OS for verified trade.
            </p>
            <p className="mt-1">
              <Link href={SITE_URL} className="hover:underline">
                Home
              </Link>
              {' · '}
              <Link href="/marketplace" className="hover:underline">
                Marketplace
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
