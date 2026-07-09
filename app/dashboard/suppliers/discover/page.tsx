'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Search,
  MapPin,
  Award,
  ShieldCheck,
  Loader2,
  Filter,
  UserPlus,
  Link2,
  CheckCircle2,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  SUPPLIER_CERTIFICATIONS,
  SUPPLIER_INDUSTRIES,
  trustBand,
  type DiscoverSupplier,
} from '@/lib/suppliers/types';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage,
} from '@/components/suppliers/SuppliersShell';

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
  const privyUserId = user?.id || '';

  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [continent, setContinent] = useState('');
  const [province, setProvince] = useState('');
  const [industry, setIndustry] = useState('');
  const [trustMin, setTrustMin] = useState(0);
  const [otifefMin, setOtifefMin] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [certs, setCerts] = useState<string[]>([]);
  const [bee, setBee] = useState('');
  const [rows, setRows] = useState<DiscoverSupplier[]>([]);
  const [facets, setFacets] = useState<{
    countries: string[];
    continents: string[];
    provinces: string[];
    industries: string[];
    certifications: string[];
    beeLevels: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (q) params.set('q', q);
      if (country) params.set('country', country);
      if (continent) params.set('continent', continent);
      if (province) params.set('province', province);
      if (industry) params.set('industry', industry);
      if (trustMin > 0) params.set('trustMin', String(trustMin));
      if (otifefMin > 0) params.set('otifefMin', String(otifefMin));
      if (verifiedOnly) params.set('verified', '1');
      if (certs.length) params.set('cert', certs.join(','));
      if (bee) params.set('bee', bee);

      const res = await fetch(`/api/suppliers/discover?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setRows(data.suppliers || []);
      setFacets(data.facets || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Search failed');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [
    companyId,
    q,
    country,
    continent,
    province,
    industry,
    trustMin,
    otifefMin,
    verifiedOnly,
    certs,
    bee,
  ]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const toggleCert = (c: string) => {
    setCerts((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const connect = async (s: DiscoverSupplier, mode: 'request' | 'add_and_connect') => {
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connect failed');
      toast.success(
        mode === 'request'
          ? `Connection request sent to ${s.trading_name}`
          : `Added ${s.trading_name} to your network`
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setConnecting(null);
    }
  };

  return (
    <SuppliersPage>
      <SuppliersHeader
        title="Discover"
        titleAccent="suppliers"
        description="Search the SupplierAdvisor network by location, industry, certifications, BEE, trust score, and OTIFEF — then connect on-chain ready companies to your book."
      />

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Filters */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="bg-white border rounded-3xl p-4 sticky top-4">
            <div className="flex items-center gap-2 text-sm font-bold mb-3">
              <Filter className="w-4 h-4 text-[#00b4d8]" /> Deep filters
            </div>

            <label className="text-xs font-medium text-neutral-500">Location</label>
            <select
              className="input w-full !py-2 !text-sm mb-2 mt-1"
              value={continent}
              onChange={(e) => setContinent(e.target.value)}
            >
              <option value="">All continents</option>
              {(facets?.continents || ['Africa', 'Europe', 'Asia', 'North America']).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="input w-full !py-2 !text-sm mb-2"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="">All countries</option>
              {(facets?.countries || []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="input w-full !py-2 !text-sm mb-3"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            >
              <option value="">All provinces / states</option>
              {(facets?.provinces || []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <label className="text-xs font-medium text-neutral-500">Industry</label>
            <select
              className="input w-full !py-2 !text-sm mb-3 mt-1"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            >
              <option value="">All industries</option>
              {(facets?.industries?.length ? facets.industries : [...SUPPLIER_INDUSTRIES]).map(
                (c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                )
              )}
            </select>

            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-neutral-500">Min trust score</span>
              <span className="font-bold">{trustMin}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={trustMin}
              onChange={(e) => setTrustMin(Number(e.target.value))}
              className="w-full mb-3"
            />

            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-neutral-500">Min OTIFEF %</span>
              <span className="font-bold">{otifefMin}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={otifefMin}
              onChange={(e) => setOtifefMin(Number(e.target.value))}
              className="w-full mb-3"
            />

            <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
              />
              Verified only
            </label>

            <label className="text-xs font-medium text-neutral-500">BEE level</label>
            <select
              className="input w-full !py-2 !text-sm mb-3 mt-1"
              value={bee}
              onChange={(e) => setBee(e.target.value)}
            >
              <option value="">Any</option>
              {(facets?.beeLevels?.length
                ? facets.beeLevels
                : ['Level 1', 'Level 2', 'Level 3', 'Level 4']
              ).map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <div className="text-xs font-medium text-neutral-500 mb-2">Certifications (AND)</div>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {SUPPLIER_CERTIFICATIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCert(c)}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${
                    certs.includes(c)
                      ? 'border-[#00b4d8] bg-[#00b4d8]/10 text-[#0077b6]'
                      : 'border-neutral-200 text-neutral-600'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="lg:col-span-9">
          <div className="relative mb-4">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              className="input w-full !py-3 !pl-10 !text-sm"
              placeholder="Search name, city, industry, certification…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <p className="text-xs text-neutral-500 mb-3">
            {loading ? 'Searching…' : `${rows.length} suppliers match your trust criteria`}
          </p>

          {loading ? (
            <div className="p-16 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
            </div>
          ) : rows.length === 0 ? (
            <div className="bg-white border rounded-3xl p-16 text-center">
              <Search className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="font-medium text-neutral-700">No suppliers match</p>
              <p className="text-sm text-neutral-500 mt-1">
                Broaden filters — or{' '}
                <a href="/dashboard/suppliers/add" className="text-[#00b4d8] underline">
                  invite a supplier
                </a>{' '}
                not yet on SupplierAdvisor.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {rows.map((s) => {
                const trust = trustBand(Number(s.trust_score || 0));
                const verified =
                  s.verified || s.is_verified || s.verification_status === 'verified';
                return (
                  <li
                    key={s.id}
                    className="bg-white border border-neutral-200 rounded-3xl p-5 hover:border-[#00b4d8]/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-slate-900 truncate">
                            {s.trading_name}
                          </h3>
                          {verified && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              <ShieldCheck className="w-3 h-3" /> Verified
                            </span>
                          )}
                          {s.already_connected && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                              <CheckCircle2 className="w-3 h-3" /> Connected
                            </span>
                          )}
                          {s.in_my_book && !s.already_connected && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                              In my book
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500 mb-2">
                          {(s.city || s.country) && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {[s.city, s.province, s.country].filter(Boolean).join(', ')}
                            </span>
                          )}
                          {s.industry && <span>{s.industry}</span>}
                          {s.sub_industry && <span>· {s.sub_industry}</span>}
                          {s.bee_level && <span>· BEE {s.bee_level}</span>}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {(s.certifications || []).slice(0, 8).map((c) => (
                            <span
                              key={c}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-800 border border-violet-100"
                            >
                              <Award className="w-2.5 h-2.5 inline mr-0.5" />
                              {c}
                            </span>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded-full border font-semibold ${trust.className}`}
                          >
                            Trust {Number(s.trust_score || 0).toFixed(0)}
                          </span>
                          <span className="text-neutral-600">
                            OTIFEF{' '}
                            <strong className="text-slate-900">
                              {Number(s.otifef_average || 0).toFixed(0)}%
                            </strong>
                          </span>
                          {s.wallet_address && (
                            <span className="text-emerald-700 font-medium">On-chain wallet</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:items-end flex-shrink-0">
                        {!s.already_connected && (
                          <>
                            <button
                              type="button"
                              disabled={connecting === s.id}
                              onClick={() => void connect(s, 'request')}
                              className="btn-primary !py-2 !px-4 text-xs"
                            >
                              {connecting === s.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Link2 className="w-3.5 h-3.5" /> Request connect
                                </>
                              )}
                            </button>
                            {!s.in_my_book && (
                              <button
                                type="button"
                                disabled={connecting === s.id}
                                onClick={() => void connect(s, 'add_and_connect')}
                                className="btn-secondary !py-2 !px-4 text-xs"
                              >
                                <UserPlus className="w-3.5 h-3.5" /> Add to book
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </SuppliersPage>
  );
}
