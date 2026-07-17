import Link from 'next/link';
import { MapPin, ShieldCheck, Star, Building2 } from 'lucide-react';
import CompanyLogo from '@/components/business/CompanyLogo';
import { companyPublicPath } from '@/lib/seo/company-public';
import {
  dirCompanyName,
  type DirCompany,
} from '@/lib/seo/directory-data';

export default function DirectoryCompanyGrid({
  companies,
}: {
  companies: DirCompany[];
}) {
  if (!companies.length) {
    return (
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
    );
  }

  return (
    <ul className="grid sm:grid-cols-2 gap-4">
      {companies.map((c) => {
        const n = dirCompanyName(c);
        const verified =
          String(c.verification_status || '').toLowerCase() === 'verified';
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
                  <h2 className="font-black text-slate-900 truncate">{n}</h2>
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
  );
}
