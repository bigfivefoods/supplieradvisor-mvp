'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  MapPin,
  Award,
  ShieldCheck,
  Loader2,
  Link2,
  CheckCircle2,
  UserPlus,
  X,
  Sparkles,
  Globe2,
  Factory,
  Wallet,
  BadgeCheck,
  Building2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Network,
  Star,
  Filter,
} from 'lucide-react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  SUPPLIER_CERTIFICATIONS,
  SUPPLIER_INDUSTRIES,
  trustBand,
  type DiscoverSupplier,
} from '@/lib/suppliers/types';
import {
  SEED_CONTINENTS,
  SEED_COUNTRIES,
} from '@/lib/geo/world-seed';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage,
} from '@/components/suppliers/SuppliersShell';
import { CommandWorkbenchBand } from '@/components/relationship/RelationshipChrome';
import CompanyLogo from '@/components/business/CompanyLogo';
import TrustBadges from '@/components/business/TrustBadges';

type Facets = {
  countries: string[];
  continents: string[];
  provinces: string[];
  cities: string[];
  industries: string[];
  subIndustries: string[];
  categories: string[];
  certifications: string[];
  beeLevels: string[];
  relationships: string[];
  /** Countries that currently have discoverable companies */
  countriesInNetwork?: string[];
  continentsInNetwork?: string[];
  /** Full seed lists keyed by continent name */
  countriesByContinent?: Record<string, string[]>;
};

const CONTINENTS_FALLBACK = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
  'Antarctica',
];

const BEE_FALLBACK = [
  'Level 1',
  'Level 2',
  'Level 3',
  'Level 4',
  'Level 5',
  'Level 6',
  'Level 7',
  'Level 8',
  'Non-compliant',
];

export default function DiscoverSuppliersPage() {
  return (
    <CompanyRequired>
      <DiscoverInner />
    </CompanyRequired>
  );
}

function DiscoverInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id) || '';

  // ── Deep search state ─────────────────────────────────────────────────────
  const [q, setQ] = useState('');
  const [continent, setContinent] = useState('');
  const [country, setCountry] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [industry, setIndustry] = useState('');
  const [subIndustry, setSubIndustry] = useState('');
  const [category, setCategory] = useState('');
  const [relationship, setRelationship] = useState('');
  const [role, setRole] = useState('');
  const [connection, setConnection] = useState('');
  const [trustMin, setTrustMin] = useState(0);
  const [trustMax, setTrustMax] = useState(100);
  const [otifefMin, setOtifefMin] = useState(0);
  const [otifefMax, setOtifefMax] = useState(100);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [registeredOnly, setRegisteredOnly] = useState(false);
  const [certs, setCerts] = useState<string[]>([]);
  const [bee, setBee] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [connected, setConnected] = useState<DiscoverSupplier[]>([]);
  const [others, setOthers] = useState<DiscoverSupplier[]>([]);
  const [total, setTotal] = useState(0);
  const [connectedTotal, setConnectedTotal] = useState(0);
  const [poolSize, setPoolSize] = useState(0);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [eligibility, setEligibility] = useState<{
    poolBefore?: number;
    hidden?: number;
    visible?: number;
    note?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<number | null>(null);
  /** Geo provinces for selected country (full cascade, not only network) */
  const [geoProvinces, setGeoProvinces] = useState<string[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (q) n++;
    if (continent) n++;
    if (country) n++;
    if (province) n++;
    if (city) n++;
    if (industry) n++;
    if (subIndustry) n++;
    if (category) n++;
    if (relationship) n++;
    if (role) n++;
    if (connection) n++;
    if (trustMin > 0 || trustMax < 100) n++;
    if (otifefMin > 0 || otifefMax < 100) n++;
    if (verifiedOnly) n++;
    if (hasWallet) n++;
    if (registeredOnly) n++;
    if (certs.length) n++;
    if (bee) n++;
    return n;
  }, [
    q,
    continent,
    country,
    province,
    city,
    industry,
    subIndustry,
    category,
    relationship,
    role,
    connection,
    trustMin,
    trustMax,
    otifefMin,
    otifefMax,
    verifiedOnly,
    hasWallet,
    registeredOnly,
    certs,
    bee,
  ]);

  const PAGE_SIZE = 48;
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listOffset, setListOffset] = useState(0);

  const load = useCallback(async (opts?: { append?: boolean; offset?: number }) => {
    const append = Boolean(opts?.append);
    const offset = opts?.offset ?? 0;
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (q) params.set('q', q);
      if (country) params.set('country', country);
      if (continent) params.set('continent', continent);
      if (province) params.set('province', province);
      if (city) params.set('city', city);
      if (industry) params.set('industry', industry);
      if (subIndustry) params.set('sub_industry', subIndustry);
      if (category) params.set('category', category);
      if (relationship) params.set('relationship', relationship);
      if (role) params.set('role', role);
      if (connection) params.set('connection', connection);
      if (trustMin > 0) params.set('trustMin', String(trustMin));
      if (trustMax < 100) params.set('trustMax', String(trustMax));
      if (otifefMin > 0) params.set('otifefMin', String(otifefMin));
      if (otifefMax < 100) params.set('otifefMax', String(otifefMax));
      if (verifiedOnly) params.set('verified', '1');
      if (hasWallet) params.set('hasWallet', '1');
      if (registeredOnly) params.set('registeredOnly', '1');
      if (certs.length) params.set('cert', certs.join(','));
      if (bee) params.set('bee', bee);

      const res = await fetch(`/api/suppliers/discover?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');

      const nextOthers = (data.others || data.suppliers || []) as DiscoverSupplier[];
      if (append) {
        setOthers((prev) => {
          const seen = new Set(prev.map((s) => s.id));
          return [...prev, ...nextOthers.filter((s) => !seen.has(s.id))];
        });
      } else {
        setConnected(data.connected || []);
        setOthers(nextOthers);
      }
      setTotal(Number(data.total || 0));
      setConnectedTotal(Number(data.connectedTotal || 0));
      setPoolSize(Number(data.pool_size || data.platform_company_count || 0));
      setFacets(data.facets || null);
      if (!append && data.eligibility) {
        setEligibility({
          poolBefore: Number(data.eligibility.poolBefore || 0),
          hidden: Number(data.eligibility.hidden || 0),
          visible: Number(data.eligibility.visible || 0),
          note:
            typeof data.eligibility.note === 'string'
              ? data.eligibility.note
              : undefined,
        });
      }
      setHasMore(Boolean(data.hasMore));
      setListOffset(offset + nextOthers.length);
      if (data.warning && !append)
        toast.message('Discover note', { description: data.warning });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Search failed');
      if (!append) {
        setConnected([]);
        setOthers([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [
    companyId,
    q,
    country,
    continent,
    province,
    city,
    industry,
    subIndustry,
    category,
    relationship,
    role,
    connection,
    trustMin,
    trustMax,
    otifefMin,
    otifefMax,
    verifiedOnly,
    hasWallet,
    registeredOnly,
    certs,
    bee,
  ]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 280);
    return () => clearTimeout(t);
  }, [load]);

  // When continent changes, drop country if it doesn't belong to that continent
  useEffect(() => {
    if (!continent || !country || !facets?.countriesByContinent) return;
    const list = facets.countriesByContinent[continent] || [];
    if (list.length && !list.some((c) => c.toLowerCase() === country.toLowerCase())) {
      setCountry('');
      setProvince('');
      setCity('');
    }
  }, [continent, country, facets?.countriesByContinent]);

  // Load provinces for selected country from geo reference (all African states etc.)
  useEffect(() => {
    if (!country) {
      setGeoProvinces([]);
      return;
    }
    let cancelled = false;
    setGeoLoading(true);
    (async () => {
      try {
        const boot = await fetch('/api/geo?resource=bootstrap', {
          cache: 'force-cache',
        });
        const bootData = await boot.json().catch(() => ({}));
        const countries: Array<{ id: number; name: string }> = Array.isArray(
          bootData.countries
        )
          ? bootData.countries
          : [];
        const match = countries.find(
          (c) =>
            String(c.name || '').toLowerCase() === country.toLowerCase()
        );
        if (!match?.id) {
          if (!cancelled) setGeoProvinces([]);
          return;
        }
        const res = await fetch(
          `/api/geo?resource=provinces&countryId=${match.id}`,
          { cache: 'force-cache' }
        );
        const data = await res.json().catch(() => ({}));
        const names = (Array.isArray(data.provinces) ? data.provinces : [])
          .map((p: { name?: string }) => String(p.name || '').trim())
          .filter(Boolean)
          .sort((a: string, b: string) => a.localeCompare(b));
        if (!cancelled) setGeoProvinces(names);
      } catch {
        if (!cancelled) setGeoProvinces([]);
      } finally {
        if (!cancelled) setGeoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [country]);

  const clearAll = () => {
    setQ('');
    setCountry('');
    setContinent('');
    setProvince('');
    setCity('');
    setIndustry('');
    setSubIndustry('');
    setCategory('');
    setRelationship('');
    setRole('');
    setConnection('');
    setTrustMin(0);
    setTrustMax(100);
    setOtifefMin(0);
    setOtifefMax(100);
    setVerifiedOnly(false);
    setHasWallet(false);
    setRegisteredOnly(false);
    setCerts([]);
    setBee('');
  };

  const toggleCert = (c: string) => {
    setCerts((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const connect = async (
    s: DiscoverSupplier,
    mode: 'request' | 'add_and_connect' | 'accept'
  ) => {
    if (!privyUserId) {
      toast.error('Sign in to connect');
      return;
    }
    setConnecting(s.id);
    try {
      const res = await fetch('/api/suppliers/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          targetProfileId: s.id,
          trading_name: s.trading_name,
          mode,
          message:
            mode === 'request'
              ? `Connection request from company #${companyId} on SupplierAdvisor`
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connect failed');
      if (data.alreadyConnected) {
        toast.success(`Already connected with ${s.trading_name}`);
      } else if (data.acceptedIncoming || data.status === 'accepted') {
        toast.success(`Connected with ${s.trading_name} — trade unlocked`);
      } else if (data.alreadyPending || data.status === 'pending') {
        toast.success(`Request sent to ${s.trading_name}`);
      } else {
        toast.success(`Updated connection with ${s.trading_name}`);
      }
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setConnecting(null);
    }
  };

  const declineIncoming = async (s: DiscoverSupplier) => {
    if (!privyUserId) return;
    setConnecting(s.id);
    try {
      const res = await fetch('/api/suppliers/connect', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          targetProfileId: s.id,
          action: 'decline',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Decline failed');
      toast.message(`Declined ${s.trading_name}`);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setConnecting(null);
    }
  };

  /** Always prefer full seed continents so Africa is never missing */
  const continents = useMemo(() => {
    const seed = SEED_CONTINENTS.map((c) => c.name);
    const fromApi = facets?.continents || [];
    return Array.from(new Set([...seed, ...fromApi, ...CONTINENTS_FALLBACK])).sort(
      (a, b) => a.localeCompare(b)
    );
  }, [facets?.continents]);

  const industries = facets?.industries?.length
    ? facets.industries
    : [...SUPPLIER_INDUSTRIES];
  const certOptions = facets?.certifications?.length
    ? Array.from(new Set([...SUPPLIER_CERTIFICATIONS, ...facets.certifications]))
    : [...SUPPLIER_CERTIFICATIONS];
  const beeLevels = facets?.beeLevels?.length ? facets.beeLevels : BEE_FALLBACK;

  const networkCountrySet = useMemo(() => {
    // Prefer explicit network-only list so seed countries don't all show "on network"
    const src = facets?.countriesInNetwork;
    if (src?.length) {
      return new Set(src.map((c) => c.toLowerCase()));
    }
    return new Set<string>();
  }, [facets?.countriesInNetwork]);

  const seedByContinent = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const c of SEED_COUNTRIES) {
      if (!map[c.continent]) map[c.continent] = [];
      map[c.continent].push(c.name);
    }
    for (const k of Object.keys(map)) {
      map[k] = map[k].sort((a, b) => a.localeCompare(b));
    }
    return map;
  }, []);

  /** Full country list: cascade by continent (all African countries when Africa) */
  const countryOptions = useMemo(() => {
    const byCont = {
      ...seedByContinent,
      ...(facets?.countriesByContinent || {}),
    };
    // Prefer seed lists for known continents so Africa is complete
    if (continent) {
      const seedList = seedByContinent[continent] || [];
      const apiList = facets?.countriesByContinent?.[continent] || [];
      const networkOnly = (facets?.countriesInNetwork || []).filter((c) => {
        // keep network countries that might use alternate spellings
        if (!seedList.length) return true;
        return !seedList.some((s) => s.toLowerCase() === c.toLowerCase());
      });
      return Array.from(
        new Set([...seedList, ...apiList, ...networkOnly])
      ).sort((a, b) => a.localeCompare(b));
    }
    const all = new Set<string>();
    for (const list of Object.values(byCont)) {
      for (const c of list) all.add(c);
    }
    for (const c of facets?.countries || []) if (c) all.add(c);
    for (const c of SEED_COUNTRIES) all.add(c.name);
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  }, [continent, facets, seedByContinent]);

  // Cascading province/city: geo seed first, merge network facet values
  const provinces = useMemo(() => {
    const fromNetwork = facets?.provinces || [];
    const set = new Set<string>([...geoProvinces, ...fromNetwork].filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [facets?.provinces, geoProvinces]);
  const cities = useMemo(() => facets?.cities || [], [facets]);

  return (
    <SuppliersPage>
      <SuppliersHeader
        title="Discover"
        titleAccent="Command"
        description="Deep search is the core of network trade — filter by rich company metadata, then connect only with partners who match your criteria."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/connections" className="btn-secondary !py-2.5 !px-5 text-sm">
              <Network className="w-4 h-4" /> Network hub
            </Link>
            <Link href="/dashboard/suppliers/add" className="btn-primary !py-2.5 !px-5 text-sm">
              <UserPlus className="w-4 h-4" /> Invite off-platform
            </Link>
          </div>
        }
      />

      <CommandWorkbenchBand
        pill="Live marketplace · deep metadata search"
        title={
          <>
            Find suppliers you can <span className="text-[#00b4d8]">trust.</span>
          </>
        }
        description="Search every registered business by location, industry, certifications, B-BBEE, trust, OTIFEF, wallet readiness, and relationship status — then connect on-platform."
        stats={[
          {
            label: 'Pool',
            value: loading ? '—' : poolSize || total,
            valueClass: 'text-[#00b4d8]',
          },
          {
            label: 'Matches',
            value: loading ? '—' : total,
            valueClass: 'text-emerald-600',
          },
          {
            label: 'Connected',
            value: loading ? '—' : connectedTotal,
            valueClass: 'text-violet-600',
          },
        ]}
      />

      {/* ═══ DEEP SEARCH — core of the page ═══ */}
      <section className="mb-8 overflow-hidden rounded-[1.75rem] border border-cyan-100 bg-white shadow-sm sm:rounded-[2rem]">
        {/* Search bar hero */}
        <div className="border-b border-cyan-50 bg-gradient-to-br from-sky-50/80 via-white to-cyan-50/40 p-4 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 text-sm font-black text-slate-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#00b4d8]/10 text-[#0077b6]">
                <Sparkles className="h-4 w-4" />
              </span>
              Deep search criteria
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-[#00b4d8] px-2 py-0.5 text-[10px] font-black text-white">
                  {activeFilterCount} active
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:border-rose-200 hover:text-rose-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Clear all
                </button>
              )}
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0077b6] md:hidden"
              >
                <Filter className="h-3.5 w-3.5" />
                {filtersOpen ? 'Hide filters' : 'Show filters'}
                {filtersOpen ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#00b4d8]" />
            <input
              className="w-full rounded-2xl border border-cyan-100 bg-white py-4 pl-12 pr-4 text-base font-medium text-slate-900 shadow-sm outline-none ring-[#00b4d8]/20 transition-all placeholder:text-neutral-400 focus:border-[#00b4d8] focus:ring-4 sm:rounded-3xl sm:py-5 sm:pl-14 sm:text-lg"
              placeholder="Search company name, legal name, city, industry, cert, email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Active chips */}
          {activeFilterCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {q && (
                <Chip label={`“${q}”`} onClear={() => setQ('')} />
              )}
              {continent && <Chip label={continent} onClear={() => setContinent('')} />}
              {country && <Chip label={country} onClear={() => setCountry('')} />}
              {province && <Chip label={province} onClear={() => setProvince('')} />}
              {city && <Chip label={city} onClear={() => setCity('')} />}
              {industry && <Chip label={industry} onClear={() => setIndustry('')} />}
              {subIndustry && <Chip label={subIndustry} onClear={() => setSubIndustry('')} />}
              {category && <Chip label={category} onClear={() => setCategory('')} />}
              {relationship && (
                <Chip label={relationship} onClear={() => setRelationship('')} />
              )}
              {role && <Chip label={`Role: ${role}`} onClear={() => setRole('')} />}
              {connection && (
                <Chip label={`Link: ${connection}`} onClear={() => setConnection('')} />
              )}
              {bee && <Chip label={`BEE ${bee}`} onClear={() => setBee('')} />}
              {verifiedOnly && (
                <Chip label="Verified" onClear={() => setVerifiedOnly(false)} />
              )}
              {hasWallet && <Chip label="On-chain wallet" onClear={() => setHasWallet(false)} />}
              {registeredOnly && (
                <Chip label="Registered" onClear={() => setRegisteredOnly(false)} />
              )}
              {(trustMin > 0 || trustMax < 100) && (
                <Chip
                  label={`Trust ${trustMin}–${trustMax}`}
                  onClear={() => {
                    setTrustMin(0);
                    setTrustMax(100);
                  }}
                />
              )}
              {(otifefMin > 0 || otifefMax < 100) && (
                <Chip
                  label={`OTIFEF ${otifefMin}–${otifefMax}%`}
                  onClear={() => {
                    setOtifefMin(0);
                    setOtifefMax(100);
                  }}
                />
              )}
              {certs.map((c) => (
                <Chip key={c} label={c} onClear={() => toggleCert(c)} />
              ))}
            </div>
          )}
        </div>

        {/* Comprehensive filter grid */}
        <div
          className={`grid gap-0 border-t border-slate-100 md:grid-cols-2 xl:grid-cols-4 ${
            filtersOpen ? '' : 'hidden md:grid'
          }`}
        >
          {/* Location */}
          <FilterPanel icon={Globe2} title="Location" accent="sky">
            <Field label="Continent">
              <select
                className={selectCls}
                value={continent}
                onChange={(e) => {
                  setContinent(e.target.value);
                  // Reset deeper location when continent changes
                  setProvince('');
                  setCity('');
                }}
              >
                <option value="">All continents</option>
                {continents.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Country">
              <select
                className={selectCls}
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
                {countryOptions.map((c) => {
                  const inNetwork = networkCountrySet.has(c.toLowerCase());
                  return (
                    <option key={c} value={c}>
                      {c}
                      {inNetwork ? ' · on network' : ''}
                    </option>
                  );
                })}
              </select>
              <p className="mt-1 text-[10px] text-neutral-400 leading-snug">
                Full world list
                {continent === 'Africa'
                  ? ' — all African countries'
                  : continent
                    ? ` — ${continent}`
                    : ''}
                . “On network” means at least one discoverable company today.
              </p>
            </Field>
            <Field label="Province / state">
              <select
                className={selectCls}
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                disabled={!country && provinces.length === 0}
              >
                <option value="">
                  {geoLoading
                    ? 'Loading provinces…'
                    : country
                      ? 'All provinces / states'
                      : 'Select a country first'}
                </option>
                {provinces.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="City">
              <select
                className={selectCls}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                <option value="">
                  {cities.length
                    ? 'All cities (on network)'
                    : 'All cities — type in free search if needed'}
                </option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </FilterPanel>

          {/* Industry & profile */}
          <FilterPanel icon={Factory} title="Industry & profile" accent="violet">
            <Field label="Industry">
              <select
                className={selectCls}
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              >
                <option value="">All industries</option>
                {industries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sub-industry">
              <select
                className={selectCls}
                value={subIndustry}
                onChange={(e) => setSubIndustry(e.target.value)}
              >
                <option value="">All sub-industries</option>
                {(facets?.subIndustries || []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select
                className={selectCls}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {(facets?.categories || []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Relationship type">
              <select
                className={selectCls}
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
              >
                <option value="">Any relationship</option>
                {(facets?.relationships?.length
                  ? facets.relationships
                  : ['supplier', 'buyer', 'both', 'partner', 'logistics']
                ).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Trade role">
              <select className={selectCls} value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">Any role</option>
                <option value="supplier">Suppliers</option>
                <option value="buyer">Buyers</option>
                <option value="both">Buyer & supplier</option>
              </select>
            </Field>
          </FilterPanel>

          {/* Trust & performance */}
          <FilterPanel icon={Star} title="Trust & performance" accent="amber">
            <div className="mb-3">
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="font-semibold text-neutral-500">Trust score</span>
                <span className="font-black tabular-nums text-slate-800">
                  {trustMin} – {trustMax}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={trustMin}
                  onChange={(e) =>
                    setTrustMin(Math.min(Number(e.target.value), trustMax))
                  }
                  className="w-full accent-[#00b4d8]"
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={trustMax}
                  onChange={(e) =>
                    setTrustMax(Math.max(Number(e.target.value), trustMin))
                  }
                  className="w-full accent-[#0077b6]"
                />
              </div>
            </div>
            <div className="mb-3">
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="font-semibold text-neutral-500">OTIFEF %</span>
                <span className="font-black tabular-nums text-slate-800">
                  {otifefMin} – {otifefMax}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={otifefMin}
                  onChange={(e) =>
                    setOtifefMin(Math.min(Number(e.target.value), otifefMax))
                  }
                  className="w-full accent-emerald-500"
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={otifefMax}
                  onChange={(e) =>
                    setOtifefMax(Math.max(Number(e.target.value), otifefMin))
                  }
                  className="w-full accent-emerald-700"
                />
              </div>
            </div>
            <Field label="B-BBEE level">
              <select className={selectCls} value={bee} onChange={(e) => setBee(e.target.value)}>
                <option value="">Any BEE level</option>
                {beeLevels.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Network status">
              <select
                className={selectCls}
                value={connection}
                onChange={(e) => setConnection(e.target.value)}
              >
                <option value="">Any connection state</option>
                <option value="connected">Already connected</option>
                <option value="pending">Pending request</option>
                <option value="none">Not connected</option>
                <option value="in_book">In my supplier book</option>
              </select>
            </Field>
          </FilterPanel>

          {/* Trust flags & certs */}
          <FilterPanel icon={BadgeCheck} title="Verification & certs" accent="emerald">
            <div className="mb-3 space-y-2">
              <Toggle
                checked={verifiedOnly}
                onChange={setVerifiedOnly}
                label="Verified companies only"
                icon={ShieldCheck}
              />
              <Toggle
                checked={hasWallet}
                onChange={setHasWallet}
                label="On-chain wallet present"
                icon={Wallet}
              />
              <Toggle
                checked={registeredOnly}
                onChange={setRegisteredOnly}
                label="Fully registered (team membership)"
                icon={Building2}
              />
            </div>
            <div className="text-[11px] font-semibold text-neutral-500 mb-2">
              Certifications (AND match)
            </div>
            <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto pr-1">
              {certOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCert(c)}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all ${
                    certs.includes(c)
                      ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-cyan-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </FilterPanel>
        </div>

        {/* Live result strip */}
        <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-6 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-neutral-600">
              {loading ? (
                <span className="inline-flex items-center gap-2 font-medium">
                  <Loader2 className="h-4 w-4 animate-spin text-[#00b4d8]" /> Searching deep
                  metadata…
                </span>
              ) : (
                <>
                  <strong className="font-black text-slate-900">{total}</strong> companies match your
                  criteria
                  {activeFilterCount > 0
                    ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}`
                    : ' · showing full network'}
                  {connectedTotal > 0 && (
                    <>
                      {' '}
                      · <strong className="text-emerald-700">{connectedTotal}</strong> already
                      connected
                    </>
                  )}
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="text-xs font-bold text-[#00b4d8] hover:underline"
            >
              Refresh results
            </button>
          </div>
          {!loading && eligibility && (eligibility.hidden ?? 0) > 0 ? (
            <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-950 leading-relaxed">
              <strong className="font-bold">
                Network pool: {eligibility.visible ?? total} visible
              </strong>
              {' · '}
              <span>
                {eligibility.hidden} hidden (opted out or missing name/country/email/industry)
              </span>
              {eligibility.poolBefore != null ? (
                <span className="text-amber-800/80">
                  {' '}
                  · scanned {eligibility.poolBefore} profiles
                </span>
              ) : null}
              {eligibility.note ? (
                <span className="block mt-0.5 text-amber-900/70">{eligibility.note}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* ═══ CONNECTED (below criteria) ═══ */}
      {!loading && connected.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-black uppercase tracking-[0.14em] text-neutral-400">
              Connected partners matching criteria
            </h2>
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-700">
              {connected.length}
            </span>
          </div>
          <ul className="space-y-3">
            {connected.map((s) => (
              <CompanyCard
                key={s.id}
                s={s}
                connecting={connecting}
                onConnect={connect}
                onDecline={declineIncoming}
              />
            ))}
          </ul>
        </section>
      )}

      {/* ═══ ALL MATCHES ═══ */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-neutral-400">
            {connected.length > 0 ? 'Other matching companies' : 'Matching companies'}
          </h2>
          {!loading && (
            <span className="text-[10px] font-bold text-neutral-400">{others.length} shown</span>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center rounded-[2rem] border border-dashed border-cyan-100 bg-white py-20">
            <Loader2 className="h-9 w-9 animate-spin text-[#00b4d8]" />
          </div>
        ) : others.length === 0 && connected.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-cyan-200 bg-gradient-to-br from-white to-sky-50/60 px-6 py-16 text-center">
            <Search className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
            <p className="font-black text-slate-800">
              {country
                ? `No partners in ${country} yet`
                : continent
                  ? `No partners match in ${continent}`
                  : 'No companies match these criteria'}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
              {country ? (
                <>
                  Deep search is working — the network just doesn&apos;t have a discoverable company in{' '}
                  <strong>{country}</strong> yet
                  {continent ? ` (${continent})` : ''}. Invite a supplier there to grow the network,
                  or broaden filters.
                </>
              ) : (
                <>
                  Broaden location, lower trust/OTIFEF thresholds, or clear certifications. You can
                  also invite a supplier not yet on SupplierAdvisor.
                </>
              )}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={clearAll} className="btn-secondary !py-2.5 !px-5 text-sm">
                Clear all filters
              </button>
              <Link
                href={
                  country || continent
                    ? `/dashboard/suppliers/add?${new URLSearchParams({
                        ...(country ? { country } : {}),
                        ...(continent ? { continent } : {}),
                      }).toString()}`
                    : '/dashboard/suppliers/add'
                }
                className="btn-primary !py-2.5 !px-5 text-sm"
              >
                {country
                  ? `Invite a supplier in ${country}`
                  : 'Invite supplier'}
              </Link>
            </div>
          </div>
        ) : others.length === 0 ? (
          <p className="rounded-2xl border border-neutral-100 bg-white px-4 py-8 text-center text-sm text-neutral-500">
            All matching companies are already in your connected list above.
          </p>
        ) : (
          <>
            <ul className="space-y-3">
              {others.map((s) => (
                <CompanyCard
                  key={s.id}
                  s={s}
                  connecting={connecting}
                  onConnect={connect}
                  onDecline={declineIncoming}
                />
              ))}
            </ul>
            {hasMore && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void load({ append: true, offset: listOffset })}
                  className="btn-secondary !py-2.5 !px-6 text-sm inline-flex items-center gap-2"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Load more companies
                </button>
              </div>
            )}
          </>
        )}
      </section>

    </SuppliersPage>
  );
}

const selectCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/20';

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-white px-2.5 py-1 text-[11px] font-bold text-[#0077b6] shadow-sm">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-0.5 hover:bg-cyan-50"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function FilterPanel({
  icon: Icon,
  title,
  accent,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  accent: 'sky' | 'violet' | 'amber' | 'emerald';
  children: React.ReactNode;
}) {
  const accents = {
    sky: 'from-sky-50/50 to-white border-sky-50',
    violet: 'from-violet-50/40 to-white border-violet-50',
    amber: 'from-amber-50/40 to-white border-amber-50',
    emerald: 'from-emerald-50/40 to-white border-emerald-50',
  };
  const iconTone = {
    sky: 'text-sky-700 bg-sky-100',
    violet: 'text-violet-700 bg-violet-100',
    amber: 'text-amber-800 bg-amber-100',
    emerald: 'text-emerald-700 bg-emerald-100',
  };
  return (
    <div className={`border-b border-r border-slate-100 bg-gradient-to-b p-4 sm:p-5 ${accents[accent]}`}>
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconTone[accent]}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">{title}</h3>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-neutral-100 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:border-cyan-100">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-neutral-300 text-[#00b4d8] accent-[#00b4d8]"
      />
      <Icon className="h-3.5 w-3.5 text-[#00b4d8]" />
      {label}
    </label>
  );
}

function CompanyCard({
  s,
  connecting,
  onConnect,
  onDecline,
}: {
  s: DiscoverSupplier;
  connecting: number | null;
  onConnect: (s: DiscoverSupplier, mode: 'request' | 'add_and_connect' | 'accept') => void;
  onDecline: (s: DiscoverSupplier) => void;
}) {
  const trust = trustBand(Number(s.trust_score || 0));
  const verified = s.verified || s.is_verified || s.verification_status === 'verified';

  return (
    <li className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:border-[#00b4d8]/40 hover:shadow-md sm:p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 flex items-start gap-3">
          <CompanyLogo
            logoUrl={s.logo_url}
            name={s.trading_name || s.legal_name}
            size="md"
          />
          <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-black tracking-tight text-slate-900">
              {s.trading_name}
            </h3>
            {s.already_connected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black uppercase text-sky-800">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </span>
            )}
            {s.in_my_book && !s.already_connected && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-600">
                In book
              </span>
            )}
            {(s as { is_registered?: boolean }).is_registered && (
              <span className="rounded-full border border-cyan-100 bg-cyan-50 px-2 py-0.5 text-[10px] font-bold text-[#0077b6]">
                Registered
              </span>
            )}
          </div>
          <div className="mb-1.5">
            <TrustBadges
              compact
              isVerified={verified}
              verificationStatus={s.verification_status}
              trustScore={s.trust_score}
              otifefPct={s.otifef_average}
            />
          </div>

          {s.legal_name && s.legal_name !== s.trading_name && (
            <p className="mb-1 text-xs text-neutral-500">{s.legal_name}</p>
          )}

          <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
            {(s.city || s.country) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-[#00b4d8]" />
                {[s.city, s.province, s.country, s.continent].filter(Boolean).join(', ')}
              </span>
            )}
            {s.industry && <span>{s.industry}</span>}
            {s.sub_industry && <span>· {s.sub_industry}</span>}
            {s.category && <span>· {s.category}</span>}
            {s.bee_level && <span>· BEE {s.bee_level}</span>}
            {s.relationship_type && <span>· {s.relationship_type}</span>}
          </div>

          {(s.certifications || []).length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {(s.certifications || []).slice(0, 10).map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-0.5 rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-800"
                >
                  <Award className="h-2.5 w-2.5" />
                  {c}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-xs">
            <span
              className={`rounded-full border px-2 py-0.5 font-bold ${trust.className}`}
            >
              Trust {Number(s.trust_score || 0).toFixed(0)}
            </span>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-semibold text-neutral-700">
              OTIFEF{' '}
              <strong className="text-slate-900">
                {Number(s.otifef_average || 0).toFixed(0)}%
              </strong>
            </span>
            {s.wallet_address && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
                <Wallet className="h-3 w-3" /> On-chain
              </span>
            )}
            {s.website && (
              <a
                href={s.website.startsWith('http') ? s.website : `https://${s.website}`}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#0077b6] hover:underline"
              >
                Website
              </a>
            )}
          </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {s.already_connected ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" /> Connected
              </span>
              <Link
                href="/dashboard/suppliers/po"
                className="text-[11px] font-bold text-[#0077b6] hover:underline"
              >
                Raise PO →
              </Link>
            </>
          ) : s.connection_pending_out ? (
            <>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800">
                Request sent
              </span>
              <Link
                href="/dashboard/connections"
                className="text-[11px] font-semibold text-neutral-500 hover:underline"
              >
                View network →
              </Link>
            </>
          ) : s.connection_pending_in ? (
            <>
              <button
                type="button"
                disabled={connecting === s.id}
                onClick={() => void onConnect(s, 'accept')}
                className="btn-primary !px-4 !py-2 text-xs"
              >
                {connecting === s.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Accept
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={connecting === s.id}
                onClick={() => void onDecline(s)}
                className="btn-secondary !border-red-200 !px-4 !py-2 text-xs text-red-600"
              >
                Decline
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={connecting === s.id}
                onClick={() => void onConnect(s, 'request')}
                className="btn-primary !px-4 !py-2 text-xs"
              >
                {connecting === s.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Link2 className="h-3.5 w-3.5" /> Request connect
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={connecting === s.id}
                onClick={() => void onConnect(s, 'add_and_connect')}
                className="btn-secondary !px-4 !py-2 text-xs"
              >
                <UserPlus className="h-3.5 w-3.5" /> Connect now
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
