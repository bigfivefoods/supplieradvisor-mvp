'use client';

import Link from 'next/link';
import { MapPin } from 'lucide-react';
import CompanyLogo from '@/components/business/CompanyLogo';
import TrustBadges from '@/components/business/TrustBadges';

export type SharedCompanyCardData = {
  id: number;
  trading_name?: string | null;
  legal_name?: string | null;
  logo_url?: string | null;
  verification_status?: string | null;
  is_verified?: boolean | null;
  bank_verification_status?: string | null;
  industry?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  short_description?: string | null;
  trust_score?: number | null;
  star_avg?: number | null;
  star_count?: number | null;
  otifef_pct?: number | null;
  certifications?: string[] | null;
  href?: string;
};

/**
 * Single company card for directory, discover previews, and shortlists.
 */
export default function SharedCompanyCard({
  company,
  footer,
  compact = false,
}: {
  company: SharedCompanyCardData;
  footer?: React.ReactNode;
  compact?: boolean;
}) {
  const name =
    company.trading_name || company.legal_name || `Company #${company.id}`;
  const sub =
    company.trading_name &&
    company.legal_name &&
    company.trading_name !== company.legal_name
      ? company.legal_name
      : null;
  const place = [company.city, company.province, company.country]
    .filter(Boolean)
    .join(', ');
  const href = company.href || `/c/${company.id}`;
  const verified =
    company.is_verified === true ||
    String(company.verification_status || '').toLowerCase() === 'verified';

  return (
    <div
      className={`flex flex-col rounded-3xl border border-slate-200 bg-white shadow-sm transition-all hover:border-[#00b4d8]/40 hover:shadow-md ${
        compact ? 'p-4' : 'p-5 sm:p-6'
      }`}
    >
      <Link href={href} className="flex items-start gap-3 min-w-0">
        <CompanyLogo logoUrl={company.logo_url} name={name} size={compact ? 'sm' : 'md'} />
        <div className="min-w-0 flex-1">
          <h3
            className={`truncate font-bold text-slate-900 ${
              compact ? 'text-base' : 'text-lg'
            }`}
          >
            {name}
          </h3>
          {sub ? (
            <p className="truncate text-xs text-slate-500">{sub}</p>
          ) : null}
          <div className="mt-1.5">
            <TrustBadges
              compact
              isVerified={verified}
              verificationStatus={company.verification_status}
              bankVerificationStatus={company.bank_verification_status}
              trustScore={company.trust_score}
              starAvg={company.star_avg}
              starCount={company.star_count}
              otifefPct={company.otifef_pct}
            />
          </div>
        </div>
      </Link>

      {(company.industry || place) && (
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
          {company.industry ? <span>{company.industry}</span> : null}
          {place ? (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="h-3 w-3 text-[#00b4d8]" />
              {place}
            </span>
          ) : null}
        </div>
      )}

      {company.short_description ? (
        <p className="mt-2 line-clamp-2 text-xs text-slate-600 leading-relaxed">
          {company.short_description}
        </p>
      ) : null}

      {company.certifications && company.certifications.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {company.certifications.slice(0, 4).map((c) => (
            <span
              key={c}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-600"
            >
              {c}
            </span>
          ))}
        </div>
      ) : null}

      {footer ? <div className="mt-3 pt-3 border-t border-slate-100">{footer}</div> : null}
    </div>
  );
}
