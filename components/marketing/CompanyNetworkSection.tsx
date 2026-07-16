'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  MapPin,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import FoundingWaitlist from '@/components/marketing/FoundingWaitlist';
import CompanyLogo from '@/components/business/CompanyLogo';
import TrustBadges from '@/components/business/TrustBadges';
import {
  SEED_CONTINENTS,
  SEED_COUNTRIES,
} from '@/lib/geo/world-seed';

export type PublicCompany = {
  id: number;
  legal_name: string | null;
  trading_name: string | null;
  verification_status: string | null;
  verified_at: string | null;
  business_type: string | null;
  industry: string | null;
  sub_industry?: string | null;
  category?: string | null;
  city: string | null;
  province?: string | null;
  country: string | null;
  continent?: string | null;
  logo_url?: string | null;
  website?: string | null;
  short_description?: string | null;
  relationship_type?: string | null;
  bee_level?: string | null;
  certifications?: string[] | null;
  is_supplier?: boolean | null;
  is_buyer?: boolean | null;
  trust_score?: number | null;
  star_avg?: number | null;
  star_count?: number;
  stars_as_supplier_avg?: number | null;
  stars_as_supplier_count?: number;
  stars_as_customer_avg?: number | null;
  stars_as_customer_count?: number;
  otifef_pct?: number | null;
  otifef_count?: number;
  badge: 'verified' | 'network';
  created_at?: string | null;
  join_rank?: number;
};

type Facets = {
  industries: string[];
  subIndustries: string[];
  countries: string[];
  cities: string[];
  provinces: string[];
  continents: string[];
  businessTypes: string[];
  categories: string[];
  beeLevels: string[];
  certifications: string[];
  countriesInNetwork?: string[];
  countriesByContinent?: Record<string, string[]>;
};

const EMPTY_FACETS: Facets = {
  industries: [],
  subIndustries: [],
  countries: [],
  cities: [],
  provinces: [],
  continents: [],
  businessTypes: [],
  categories: [],
  beeLevels: [],
  certifications: [],
};

const PAGE_SIZE = 9;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00b4d8]">
      {children}
    </p>
  );
}

function StarRow({ avg, count }: { avg: number | null | undefined; count: number }) {
  if (avg == null || count <= 0) {
    return <span className="text-[11px] text-slate-400">No peer stars yet</span>;
  }
  const full = Math.min(5, Math.max(0, Math.round(avg)));
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`${avg.toFixed(1)} from ${count} peer ratings`}
    >
      <span className="text-amber-400 text-[11px] tracking-tight" aria-hidden>
        {'★'.repeat(full)}
        <span className="text-slate-200">{'★'.repeat(5 - full)}</span>
      </span>
      <span className="text-sm font-black tabular-nums text-slate-900">
        {avg.toFixed(1)}
      </span>
      <span className="text-[11px] text-slate-500">({count})</span>
    </span>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = 'Any',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  if (!options.length && !value) return null;
  return (
    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
      {label}
      <select
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function CompanyCard({ company }: { company: PublicCompany }) {
  const name = company.trading_name || company.legal_name || `Company #${company.id}`;
  const sub =
    company.trading_name &&
    company.legal_name &&
    company.trading_name !== company.legal_name
      ? company.legal_name
      : null;
  const meta = [
    company.industry || company.business_type,
    company.sub_industry,
    company.city,
    company.province,
    company.country,
  ]
    .filter(Boolean)
    .join(' · ');
  const isVerified = company.badge === 'verified';
  const stars = company.star_avg;
  const starCount = company.star_count ?? 0;
  const trust = company.trust_score;
  const otifef = company.otifef_pct;
  const rank = company.join_rank;
  const joined =
    company.created_at && !Number.isNaN(Date.parse(company.created_at))
      ? new Date(company.created_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
        })
      : null;

  return (
    <Link
      href={`/c/${company.id}`}
      className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm transition-all hover:border-[#00b4d8]/40 hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <CompanyLogo
            logoUrl={company.logo_url}
            name={name}
            size="md"
          />
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {rank != null && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-slate-600">
                  #{rank}
                </span>
              )}
              {joined && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Joined {joined}
                </span>
              )}
              {company.is_supplier && (
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[9px] font-bold uppercase text-sky-800">
                  Supplier
                </span>
              )}
              {company.is_buyer && (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-bold uppercase text-violet-800">
                  Buyer
                </span>
              )}
            </div>
            <h3 className="truncate text-lg font-bold text-slate-900">{name}</h3>
            {sub && <p className="truncate text-sm text-slate-500">{sub}</p>}
            <div className="mt-1.5">
              <TrustBadges
                compact
                isVerified={isVerified}
                verificationStatus={company.verification_status}
                trustScore={trust}
                starAvg={stars}
                starCount={starCount}
                otifefPct={otifef}
              />
            </div>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
            isVerified
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border border-sky-200 bg-sky-50 text-sky-800'
          }`}
        >
          {isVerified ? 'Verified' : 'Member'}
        </span>
      </div>

      <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-[#00b4d8]" />
        <span className="truncate">{meta || 'Joined SupplierAdvisor'}</span>
      </div>

      {company.short_description && (
        <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
          {company.short_description}
        </p>
      )}

      {company.certifications && company.certifications.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {company.certifications.slice(0, 4).map((c) => (
            <span
              key={c}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-600"
            >
              {c}
            </span>
          ))}
          {company.certifications.length > 4 && (
            <span className="text-[9px] font-semibold text-slate-400">
              +{company.certifications.length - 4}
            </span>
          )}
        </div>
      )}

      <div className="mt-auto grid grid-cols-3 gap-1.5 border-t border-slate-100 pt-3">
        <div
          className="rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-2 text-center"
          title="Platform trust score"
        >
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
            Trust
          </div>
          <div className="mt-0.5 flex items-center justify-center gap-0.5">
            <ShieldCheck className="h-3 w-3 text-[#00b4d8]" />
            <span className="text-sm font-black tabular-nums text-slate-900">
              {trust != null && Number.isFinite(trust) && trust > 0
                ? Math.round(trust)
                : 'New'}
            </span>
          </div>
        </div>
        <div
          className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-2 py-2 text-center"
          title="On-Time · In-Full · Error-Free performance"
        >
          <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700/70">
            OTIFEF
          </div>
          <div className="mt-0.5 text-sm font-black tabular-nums text-emerald-900">
            {otifef != null && otifef > 0 ? `${Math.round(otifef)}%` : '—'}
          </div>
        </div>
        <div
          className="rounded-xl border border-amber-100 bg-amber-50/40 px-2 py-2 text-center"
          title="Peer star ratings from suppliers and customers"
        >
          <div className="text-[9px] font-bold uppercase tracking-wider text-amber-800/70">
            Stars
          </div>
          <div className="mt-0.5 text-sm font-black tabular-nums text-slate-900">
            {stars != null && starCount > 0 ? stars.toFixed(1) : '—'}
            {starCount > 0 && (
              <span className="text-[10px] font-semibold text-slate-500">
                {' '}
                ({starCount})
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2.5 space-y-1.5 rounded-xl border border-slate-100 bg-white px-2.5 py-2">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-slate-500">Peer stars</span>
          <StarRow avg={stars} count={starCount} />
        </div>
        {(company.stars_as_supplier_count || 0) > 0 ||
        (company.stars_as_customer_count || 0) > 0 ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-50 pt-1.5 text-[10px] text-slate-500">
            {(company.stars_as_supplier_count || 0) > 0 && (
              <span>
                As supplier:{' '}
                <strong className="text-slate-700">
                  {company.stars_as_supplier_avg?.toFixed(1)}★
                </strong>{' '}
                ({company.stars_as_supplier_count} from customers)
              </span>
            )}
            {(company.stars_as_customer_count || 0) > 0 && (
              <span>
                As customer:{' '}
                <strong className="text-slate-700">
                  {company.stars_as_customer_avg?.toFixed(1)}★
                </strong>{' '}
                ({company.stars_as_customer_count} from suppliers)
              </span>
            )}
          </div>
        ) : (
          <p className="text-[10px] leading-snug text-slate-400">
            Rated by suppliers & customers as they trade — the loop that improves every
            business.
          </p>
        )}
      </div>

      {company.website && (
        <span
          className="mt-2 truncate text-[11px] font-semibold text-[#0077b6]"
          onClick={(e) => e.preventDefault()}
        >
          {company.website.replace(/^https?:\/\//, '')}
        </span>
      )}
    </Link>
  );
}

/**
 * Homepage companies section — Browse (join order) + rich metadata Search.
 */
export default function CompanyNetworkSection() {
  const [tab, setTab] = useState<'browse' | 'search'>('browse');
  const [companies, setCompanies] = useState<PublicCompany[]>([]);
  const [facets, setFacets] = useState<Facets>(EMPTY_FACETS);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [networkCount, setNetworkCount] = useState(0);
  const [platformTotal, setPlatformTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [totalFiltered, setTotalFiltered] = useState(0);

  // Search filters
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [industry, setIndustry] = useState('');
  const [subIndustry, setSubIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [continent, setContinent] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [badge, setBadge] = useState('');
  const [role, setRole] = useState('');
  const [cert, setCert] = useState('');
  const [bee, setBee] = useState('');
  const [minStars, setMinStars] = useState('');
  const [minTrust, setMinTrust] = useState('');
  const [minOtifef, setMinOtifef] = useState('');
  const [sort, setSort] = useState('joined');
  const [showFilters, setShowFilters] = useState(true);

  // Debounce free-text search
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 280);
    return () => window.clearTimeout(t);
  }, [q]);

  // Open search tab when hash is #directory or #search
  useEffect(() => {
    const applyHash = () => {
      const h = (window.location.hash || '').replace('#', '').toLowerCase();
      if (h === 'directory' || h === 'search' || h === 'directory-search') {
        setTab('search');
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  const applyPageMeta = (data: {
    page?: number;
    pageCount?: number;
    counts?: { total?: number; verified?: number; network?: number; platformTotal?: number };
    allCount?: number;
  }) => {
    setPage(Math.max(1, Number(data.page || 1)));
    setPageCount(Math.max(1, Number(data.pageCount || 1)));
    setTotalFiltered(
      Number(data.counts?.total ?? data.allCount ?? 0)
    );
    setVerifiedCount(data.counts?.verified ?? 0);
    setNetworkCount(data.counts?.network ?? 0);
    if (typeof data.counts?.platformTotal === 'number') {
      setPlatformTotal(data.counts.platformTotal);
    }
  };

  const [loadingMore, setLoadingMore] = useState(false);

  const loadBrowse = useCallback(async (pageNum = 1, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        pageSize: String(PAGE_SIZE),
        sort: 'joined',
      });
      const res = await fetch(
        `/api/public/verified-companies?${params}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      const next = (data.companies || []) as PublicCompany[];
      if (append) {
        setCompanies((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...next.filter((c) => !seen.has(c.id))];
        });
      } else {
        setCompanies(next);
      }
      setFacets(data.facets || EMPTY_FACETS);
      applyPageMeta(data);
      if (typeof data.counts?.platformTotal !== 'number') {
        setPlatformTotal(data.counts?.total ?? data.companies?.length ?? 0);
      }
    } catch {
      if (!append) {
        setCompanies([]);
        setPlatformTotal(null);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const loadSearch = useCallback(async (pageNum = 1, append = false) => {
    if (append) setLoadingMore(true);
    else setSearching(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pageNum));
      params.set('pageSize', String(PAGE_SIZE));
      if (qDebounced) params.set('q', qDebounced);
      if (industry) params.set('industry', industry);
      if (subIndustry) params.set('sub_industry', subIndustry);
      if (country) params.set('country', country);
      if (province) params.set('province', province);
      if (city) params.set('city', city);
      if (continent) params.set('continent', continent);
      if (businessType) params.set('business_type', businessType);
      if (badge) params.set('badge', badge);
      if (role) params.set('role', role);
      if (cert) params.set('cert', cert);
      if (bee) params.set('bee', bee);
      if (minStars) params.set('minStars', minStars);
      if (minTrust) params.set('minTrust', minTrust);
      if (minOtifef) params.set('minOtifef', minOtifef);
      if (sort) params.set('sort', sort);

      const res = await fetch(
        `/api/public/verified-companies?${params.toString()}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      const next = (data.companies || []) as PublicCompany[];
      if (append) {
        setCompanies((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...next.filter((c) => !seen.has(c.id))];
        });
      } else {
        setCompanies(next);
      }
      if (data.facets) setFacets(data.facets);
      applyPageMeta(data);
    } catch {
      if (!append) setCompanies([]);
    } finally {
      setSearching(false);
      setLoading(false);
      setLoadingMore(false);
    }
  }, [
    qDebounced,
    industry,
    subIndustry,
    country,
    province,
    city,
    continent,
    businessType,
    badge,
    role,
    cert,
    bee,
    minStars,
    minTrust,
    minOtifef,
    sort,
  ]);

  useEffect(() => {
    if (tab === 'browse') void loadBrowse(1);
  }, [tab, loadBrowse]);

  useEffect(() => {
    if (tab === 'search') void loadSearch(1);
  }, [tab, loadSearch]);

  const goPage = (p: number) => {
    const next = Math.max(1, Math.min(pageCount, p));
    setPage(next);
    if (tab === 'browse') void loadBrowse(next, false);
    else void loadSearch(next, false);
  };

  /** Infinite-style append of the next page */
  const loadMore = () => {
    if (pageSafe >= pageCount || loadingMore) return;
    const next = pageSafe + 1;
    setPage(next);
    if (tab === 'browse') void loadBrowse(next, true);
    else void loadSearch(next, true);
  };

  const activeFilters = useMemo(() => {
    const bits: string[] = [];
    if (qDebounced) bits.push(`“${qDebounced}”`);
    if (industry) bits.push(industry);
    if (subIndustry) bits.push(subIndustry);
    if (continent) bits.push(continent);
    if (country) bits.push(country);
    if (province) bits.push(province);
    if (city) bits.push(city);
    if (businessType) bits.push(businessType);
    if (badge) bits.push(badge);
    if (role) bits.push(role);
    if (cert) bits.push(cert);
    if (bee) bits.push(bee);
    if (minStars) bits.push(`≥${minStars}★`);
    if (minTrust) bits.push(`trust ≥${minTrust}`);
    if (minOtifef) bits.push(`OTIFEF ≥${minOtifef}%`);
    return bits;
  }, [
    qDebounced,
    industry,
    subIndustry,
    continent,
    country,
    province,
    city,
    businessType,
    badge,
    role,
    cert,
    bee,
    minStars,
    minTrust,
    minOtifef,
  ]);

  const clearFilters = () => {
    setQ('');
    setQDebounced('');
    setIndustry('');
    setSubIndustry('');
    setCountry('');
    setProvince('');
    setCity('');
    setContinent('');
    setBusinessType('');
    setBadge('');
    setRole('');
    setCert('');
    setBee('');
    setMinStars('');
    setMinTrust('');
    setMinOtifef('');
    setSort('joined');
  };

  // Server already returned one page of companies
  const pageSafe = Math.min(Math.max(1, page), pageCount);
  const paged = companies;
  const listTotal = totalFiltered || companies.length;

  // Province/city options filtered by selected country when possible
  const provinceOptions = useMemo(() => {
    if (!country) return facets.provinces;
    return facets.provinces; // server facets are global; OK for marketing
  }, [facets.provinces, country]);

  const seedByContinent = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const c of SEED_COUNTRIES) {
      if (!map[c.continent]) map[c.continent] = [];
      map[c.continent].push(c.name);
    }
    for (const k of Object.keys(map)) {
      map[k] = [...map[k]].sort((a, b) => a.localeCompare(b));
    }
    return map;
  }, []);

  const continentOptions = useMemo(() => {
    const seed = SEED_CONTINENTS.map((c) => c.name);
    return Array.from(
      new Set([...seed, ...(facets.continents || [])])
    ).sort((a, b) => a.localeCompare(b));
  }, [facets.continents]);

  const countryOptions = useMemo(() => {
    const byCont = {
      ...seedByContinent,
      ...(facets.countriesByContinent || {}),
    };
    if (continent && byCont[continent]?.length) {
      const networkOnly = (facets.countriesInNetwork || []).filter(
        (c) =>
          !byCont[continent].some(
            (s) => s.toLowerCase() === c.toLowerCase()
          )
      );
      return Array.from(
        new Set([...byCont[continent], ...networkOnly])
      ).sort((a, b) => a.localeCompare(b));
    }
    const all = new Set<string>();
    for (const list of Object.values(byCont)) {
      for (const c of list) all.add(c);
    }
    for (const c of facets.countries || []) if (c) all.add(c);
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  }, [continent, facets, seedByContinent]);

  const networkCountrySet = useMemo(
    () =>
      new Set(
        (facets.countriesInNetwork || []).map((c) => c.toLowerCase())
      ),
    [facets.countriesInNetwork]
  );

  // Drop country if it doesn't belong to selected continent
  useEffect(() => {
    if (!continent || !country) return;
    const list = countryOptions;
    if (
      list.length &&
      !list.some((c) => c.toLowerCase() === country.toLowerCase())
    ) {
      setCountry('');
    }
  }, [continent, country, countryOptions]);

  const busy = loading || searching;

  return (
    <section
      id="network"
      className="scroll-mt-20 border-t border-slate-200 bg-white py-20 sm:py-28"
    >
      <div id="directory" className="scroll-mt-24 mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
        <div className="mb-8 text-center sm:mb-10">
          <SectionLabel>Who has joined</SectionLabel>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">
            Companies on SupplierAdvisor®
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            {platformTotal
              ? `${platformTotal} companies on the platform${
                  verifiedCount > 0 ? ` · ${verifiedCount} verified` : ''
                }${networkCount > 0 ? ` · ${networkCount} building trust` : ''}`
              : 'Companies joining the verified supply-chain network'}
            . Browse join order or{' '}
            <strong className="text-slate-800">search by rich metadata</strong> —
            industry, location, trust, OTIFEF, certifications, and more.
          </p>
          <div className="mx-auto mt-5 max-w-2xl rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3.5 text-left sm:px-6 sm:text-center">
            <p className="text-sm font-semibold leading-relaxed text-sky-950">
              Continuous trust loop
            </p>
            <p className="mt-1 text-sm leading-relaxed text-sky-900/80">
              Companies are rated by their <strong>suppliers</strong> and{' '}
              <strong>customers</strong> — peer stars for how they trade, and{' '}
              <strong>OTIFEF</strong> (On-Time · In-Full · Error-Free) for delivery
              performance. That feedback loop helps every business improve, and builds
              trust you can see before you trade.
            </p>
          </div>
          <div className="mt-6">
            <FoundingWaitlist />
          </div>
        </div>

        {/* Tabs */}
        <div
          className="mb-6 flex flex-wrap items-center justify-center gap-2"
          role="tablist"
          aria-label="Company directory views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'browse'}
            onClick={() => setTab('browse')}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
              tab === 'browse'
                ? 'bg-[#00b4d8] text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-700 hover:border-[#00b4d8] hover:text-[#0077b6]'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Browse
          </button>
          <button
            type="button"
            role="tab"
            id="directory-search"
            aria-selected={tab === 'search'}
            onClick={() => {
              setTab('search');
              if (typeof window !== 'undefined') {
                window.history.replaceState(null, '', '#directory');
              }
            }}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
              tab === 'search'
                ? 'bg-[#00b4d8] text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-700 hover:border-[#00b4d8] hover:text-[#0077b6]'
            }`}
          >
            <Search className="h-4 w-4" />
            Search directory
          </button>
        </div>

        {tab === 'search' && (
          <div className="mb-6 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, industry, city, certs, description…"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#00b4d8] focus:outline-none focus:ring-2 focus:ring-[#00b4d8]/20"
                  aria-label="Search companies"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:border-[#00b4d8]"
                >
                  <Filter className="h-3.5 w-3.5" />
                  {showFilters ? 'Hide filters' : 'Show filters'}
                </button>
                {activeFilters.length > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-4 py-2.5 text-xs font-bold text-orange-900 hover:bg-orange-100"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Clear ({activeFilters.length})
                  </button>
                )}
              </div>
            </div>

            {showFilters && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SelectField
                  label="Industry"
                  value={industry}
                  onChange={setIndustry}
                  options={facets.industries}
                />
                <SelectField
                  label="Sub-industry"
                  value={subIndustry}
                  onChange={setSubIndustry}
                  options={facets.subIndustries}
                />
                <SelectField
                  label="Continent"
                  value={continent}
                  onChange={(v) => {
                    setContinent(v);
                    setProvince('');
                    setCity('');
                  }}
                  options={continentOptions}
                />
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Country
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value);
                      setProvince('');
                      setCity('');
                    }}
                  >
                    <option value="">
                      {continent
                        ? `All countries in ${continent}`
                        : 'All countries'}
                    </option>
                    {countryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                        {networkCountrySet.has(c.toLowerCase())
                          ? ' · on network'
                          : ''}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[10px] font-medium normal-case tracking-normal text-slate-400">
                    Full world list
                    {continent === 'Africa' ? ' — all African countries' : ''}.
                  </span>
                </label>
                <SelectField
                  label="Province / region"
                  value={province}
                  onChange={setProvince}
                  options={provinceOptions}
                />
                <SelectField
                  label="City"
                  value={city}
                  onChange={setCity}
                  options={facets.cities}
                />
                <SelectField
                  label="Business type"
                  value={businessType}
                  onChange={setBusinessType}
                  options={facets.businessTypes}
                />
                <SelectField
                  label="Certification"
                  value={cert}
                  onChange={setCert}
                  options={facets.certifications}
                />
                <SelectField
                  label="B-BBEE level"
                  value={bee}
                  onChange={setBee}
                  options={facets.beeLevels}
                />
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Trust badge
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                  >
                    <option value="">Any</option>
                    <option value="verified">Verified only</option>
                    <option value="network">Member (building trust)</option>
                  </select>
                </label>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Role
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="">Any</option>
                    <option value="supplier">Suppliers</option>
                    <option value="buyer">Buyers</option>
                    <option value="both">Both</option>
                  </select>
                </label>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Min stars
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                    value={minStars}
                    onChange={(e) => setMinStars(e.target.value)}
                  >
                    <option value="">Any</option>
                    <option value="3">3+</option>
                    <option value="3.5">3.5+</option>
                    <option value="4">4+</option>
                    <option value="4.5">4.5+</option>
                  </select>
                </label>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Min trust score
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                    value={minTrust}
                    onChange={(e) => setMinTrust(e.target.value)}
                  >
                    <option value="">Any</option>
                    <option value="40">40+</option>
                    <option value="60">60+</option>
                    <option value="75">75+</option>
                    <option value="90">90+</option>
                  </select>
                </label>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Min OTIFEF %
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                    value={minOtifef}
                    onChange={(e) => setMinOtifef(e.target.value)}
                  >
                    <option value="">Any</option>
                    <option value="70">70%+</option>
                    <option value="85">85%+</option>
                    <option value="95">95%+</option>
                  </select>
                </label>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Sort by
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="joined">Join order</option>
                    <option value="name">Name A–Z</option>
                    <option value="stars">Highest stars</option>
                    <option value="trust">Highest trust</option>
                    <option value="otifef">Highest OTIFEF</option>
                  </select>
                </label>
              </div>
            )}

            {activeFilters.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {activeFilters.map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-900"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {busy && companies.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: PAGE_SIZE }, (_, i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-3xl border border-slate-200 bg-slate-50"
              />
            ))}
          </div>
        ) : companies.length > 0 ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
              <span>
                Showing{' '}
                <strong className="tabular-nums text-slate-800">
                  {listTotal === 0
                    ? '0'
                    : `${(pageSafe - 1) * PAGE_SIZE + 1}–${Math.min(pageSafe * PAGE_SIZE, listTotal)}`}
                </strong>{' '}
                of{' '}
                <strong className="tabular-nums text-slate-800">
                  {listTotal}
                </strong>
                {tab === 'search' && activeFilters.length > 0
                  ? ' matching filters'
                  : tab === 'browse'
                    ? ' · first to join → latest'
                    : ''}
                {searching && (
                  <span className="ml-2 text-[11px] font-semibold text-[#00b4d8]">
                    Updating…
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Page {pageSafe} of {pageCount}
              </span>
            </div>

            <div className="grid min-h-[22rem] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paged.map((company) => (
                <CompanyCard key={company.id} company={company} />
              ))}
            </div>

            {pageCount > 1 && (
              <div className="mt-10 flex flex-col items-center gap-4">
                {pageSafe < pageCount && (
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={loadMore}
                    className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#0096c7] disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading…' : 'Load more companies'}
                  </button>
                )}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={pageSafe <= 1}
                    onClick={() => goPage(pageSafe - 1)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition-colors hover:border-[#00b4d8] hover:text-[#0077b6] disabled:pointer-events-none disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <button
                    type="button"
                    disabled={pageSafe >= pageCount}
                    onClick={() => goPage(pageSafe + 1)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition-colors hover:border-[#00b4d8] hover:text-[#0077b6] disabled:pointer-events-none disabled:opacity-40"
                    aria-label="Next page"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div
                  className="flex flex-wrap items-center justify-center gap-1.5"
                  role="tablist"
                  aria-label="Company pages"
                >
                  {Array.from({ length: Math.min(pageCount, 24) }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Page ${i + 1}`}
                      aria-selected={i + 1 === pageSafe}
                      onClick={() => goPage(i + 1)}
                      className={`h-2.5 rounded-full transition-all ${
                        i + 1 === pageSafe
                          ? 'w-7 bg-[#00b4d8]'
                          : 'w-2.5 bg-slate-200 hover:bg-slate-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-10 text-center">
              <Link
                href="/onboarding?type=business"
                className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#0099b8]"
              >
                Join the network <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
            {tab === 'search' && activeFilters.length > 0 ? (
              <>
                <Search className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="font-semibold text-slate-900">No companies match</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                  Try clearing filters or broadening your search terms.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-800"
                >
                  <X className="h-4 w-4" /> Clear filters
                </button>
              </>
            ) : (
              <>
                <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-[#00b4d8]" />
                <p className="font-semibold text-slate-900">
                  Be among the first on the network
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                  Complete company onboarding — your trading name will appear here for
                  others to discover.
                </p>
                <Link
                  href="/onboarding?type=business"
                  className="mt-6 inline-flex rounded-full bg-[#00b4d8] px-6 py-3 text-sm font-semibold text-white"
                >
                  Register your business
                </Link>
              </>
            )}
          </div>
        )}

        <p className="mt-8 text-center text-[11px] text-slate-400">
          <Star className="mr-1 inline h-3 w-3 text-amber-400" />
          Public directory shows discoverable companies only. Log in for full
          marketplace connect tools.
        </p>
      </div>
    </section>
  );
}
