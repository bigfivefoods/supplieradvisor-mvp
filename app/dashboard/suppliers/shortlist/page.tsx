'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Filter, Download } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage,
} from '@/components/suppliers/SuppliersShell';
import SharedCompanyCard from '@/components/business/SharedCompanyCard';
import type { DiscoverSupplier } from '@/lib/suppliers/types';
import {
  SrmEmpty,
  SrmSearch,
  SrmSkeleton,
  SrmSortButton,
  SrmToolbar,
  SrmViewSwitch,
  srmFocus,
} from '@/components/suppliers/srm/SrmDesk';
import { compareNum, compareText, matchesQuery, type SrmView } from '@/lib/suppliers/srm-desk';

/**
 * Buyer shortlist: CIPC-verified + high trust/OTIFEF suppliers.
 * Filters: trust, OTIFEF, industry, country · CSV export.
 */
export default function SupplierShortlistPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [rows, setRows] = useState<DiscoverSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [minTrust, setMinTrust] = useState(50);
  const [minOtifef, setMinOtifef] = useState(0);
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'trust' | 'otifef' | 'name'>('trust');
  const [view, setView] = useState<SrmView>('list');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        verified: '1',
        trustMin: String(minTrust),
        otifefMin: String(minOtifef),
        role: 'supplier',
        limit: '120',
      });
      if (industry.trim()) params.set('industry', industry.trim());
      if (country.trim()) params.set('country', country.trim());
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/suppliers/discover?${params}`);
      const data = await res.json();
      const list = (data.suppliers || []) as DiscoverSupplier[];
      let filtered = list.filter(
        (s) =>
          s.verified ||
          s.is_verified ||
          String(s.verification_status || '').toLowerCase() === 'verified'
      );
      // Client-side industry/country when API facets are soft-match
      if (industry.trim()) {
        const ind = industry.trim().toLowerCase();
        filtered = filtered.filter((s) =>
          String(s.industry || '')
            .toLowerCase()
            .includes(ind)
        );
      }
      if (country.trim()) {
        const c = country.trim().toLowerCase();
        filtered = filtered.filter((s) =>
          String(s.country || '')
            .toLowerCase()
            .includes(c)
        );
      }
      setRows(filtered);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, minTrust, minOtifef, industry, country]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    return rows
      .filter((s) =>
        matchesQuery(q, [s.trading_name, s.legal_name, s.industry, s.city, s.country])
      )
      .sort((a, b) => {
        if (sort === 'name') return compareText(a.trading_name || '', b.trading_name || '', 'asc');
        if (sort === 'otifef') {
          return compareNum(Number(a.otifef_average || 0), Number(b.otifef_average || 0), 'desc');
        }
        return compareNum(Number(a.trust_score || 0), Number(b.trust_score || 0), 'desc');
      });
  }, [rows, q, sort]);

  const industries = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.industry) set.add(String(r.industry));
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.country) set.add(String(r.country));
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const exportCsv = () => {
    const header = [
      'id',
      'trading_name',
      'legal_name',
      'industry',
      'city',
      'province',
      'country',
      'trust_score',
      'otifef',
      'verification_status',
      'directory_url',
    ];
    const lines = [header.join(',')];
    for (const s of visible) {
      const cells = [
        s.id,
        s.trading_name || '',
        s.legal_name || '',
        s.industry || '',
        s.city || '',
        s.province || '',
        s.country || '',
        s.trust_score ?? '',
        s.otifef_average ?? '',
        s.verification_status || '',
        `https://www.supplieradvisor.com/c/${s.id}`,
      ].map((v) => {
        const str = String(v ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      lines.push(cells.join(','));
    }
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supplier-shortlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SuppliersPage>
      <SuppliersHeader
        title="Verified"
        titleAccent="shortlist"
        description="CIPC-verified suppliers with trust / OTIFEF / industry / country filters — export for RFQs."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={!rows.length}
              className={`${srmFocus} btn-secondary !py-2 !px-4 text-sm inline-flex items-center gap-1.5 disabled:opacity-40`}
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <Link
              href="/dashboard/suppliers/discover"
              className="btn-secondary !py-2 !px-4 text-sm"
            >
              Full discover
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <Filter className="w-4 h-4 text-[#00b4d8] mb-2" />
        <label className="text-xs font-semibold text-neutral-600">
          Min trust
          <input
            type="number"
            min={0}
            max={100}
            className="input mt-1 w-24 !py-2 !px-2 !text-sm"
            value={minTrust}
            onChange={(e) => setMinTrust(Number(e.target.value) || 0)}
          />
        </label>
        <label className="text-xs font-semibold text-neutral-600">
          Min OTIFEF %
          <input
            type="number"
            min={0}
            max={100}
            className="input mt-1 w-24 !py-2 !px-2 !text-sm"
            value={minOtifef}
            onChange={(e) => setMinOtifef(Number(e.target.value) || 0)}
          />
        </label>
        <label className="text-xs font-semibold text-neutral-600">
          Industry
          <input
            list="shortlist-industries"
            className="input mt-1 w-40 !py-2 !px-2 !text-sm"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Any"
          />
          <datalist id="shortlist-industries">
            {industries.map((i) => (
              <option key={i} value={i} />
            ))}
          </datalist>
        </label>
        <label className="text-xs font-semibold text-neutral-600">
          Country
          <input
            list="shortlist-countries"
            className="input mt-1 w-36 !py-2 !px-2 !text-sm"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Any"
          />
          <datalist id="shortlist-countries">
            {countries.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className={`${srmFocus} btn-primary !py-2 !px-4 text-sm`}
        >
          Apply
        </button>
        <p className="text-[11px] text-neutral-500 self-center">
          <ShieldCheck className="w-3.5 h-3.5 inline text-emerald-600" /> Only
          verified (CIPC) profiles that pass discovery completeness.
        </p>
      </div>

      <SrmToolbar meta={loading ? 'Searching verified suppliers…' : `${visible.length} on the shortlist`}>
        <SrmSearch value={q} onChange={setQ} label="Search shortlist" placeholder="Search name, industry, city" />
        <SrmSortButton label="Trust" active={sort === 'trust'} onClick={() => setSort('trust')} />
        <SrmSortButton label="OTIFEF" active={sort === 'otifef'} onClick={() => setSort('otifef')} />
        <SrmSortButton label="Name" active={sort === 'name'} onClick={() => setSort('name')} />
        <SrmViewSwitch value={view} onChange={setView} views={['list', 'table']} />
      </SrmToolbar>

      {loading ? (
        <SrmSkeleton variant={view === 'table' ? 'table' : 'cards'} rows={6} />
      ) : visible.length === 0 ? (
        <SrmEmpty
          title="No verified suppliers match"
          description="Relax trust or OTIFEF, clear industry and country, or open Discover to connect more partners."
          actionHref="/dashboard/suppliers/discover"
          actionLabel="Open discover"
        />
      ) : view === 'table' ? (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Industry</th>
                <th className="px-4 py-3">Place</th>
                <th className="px-4 py-3">Trust</th>
                <th className="px-4 py-3">OTIFEF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{s.trading_name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.industry || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{[s.city, s.country].filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{Number(s.trust_score || 0).toFixed(0)}</td>
                  <td className="px-4 py-3 font-bold tabular-nums text-[#0077b6]">{Number(s.otifef_average || 0).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((s) => (
            <SharedCompanyCard
              key={s.id}
              company={{
                id: s.id,
                trading_name: s.trading_name,
                legal_name: s.legal_name,
                logo_url: s.logo_url,
                verification_status: s.verification_status,
                is_verified: s.is_verified || s.verified,
                industry: s.industry,
                city: s.city,
                province: s.province,
                country: s.country,
                trust_score: s.trust_score,
                otifef_pct: s.otifef_average,
                certifications: s.certifications,
                href: `/c/${s.id}`,
              }}
              compact
              footer={
                <Link
                  href={`/dashboard/connections/${s.id}`}
                  className="text-xs font-bold text-[#0077b6] hover:underline"
                >
                  Connection workspace →
                </Link>
              }
            />
          ))}
        </div>
      )}
    </SuppliersPage>
  );
}
