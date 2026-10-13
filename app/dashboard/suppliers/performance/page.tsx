'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Truck, Package, Award } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { otifefBand, type OtifefMetrics, type SupplierOtifefRow } from '@/lib/suppliers/types';
import { OtifefKpiCard } from '@/components/portals/OtifefKpiCard';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage
} from '@/components/suppliers/SuppliersShell';
import {
  SrmEmpty,
  SrmSearch,
  SrmSkeleton,
  SrmSortButton,
  SrmToolbar,
  srmFocus,
} from '@/components/suppliers/srm/SrmDesk';
import { compareNum, compareText, matchesQuery } from '@/lib/suppliers/srm-desk';

export default function SupplierPerformancePage() {
  return (
    <CompanyRequired>
      <PerfInner />
    </CompanyRequired>
  );
}

function PerfInner() {
  const companyId = getSelectedCompanyId()!;
  const [preset, setPreset] = useState<'30d' | '90d' | '6m' | '12m' | 'all'>('12m');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [summary, setSummary] = useState<OtifefMetrics | null>(null);
  const [rows, setRows] = useState<SupplierOtifefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'otifef' | 'name' | 'pos'>('otifef');

  const applyPreset = (p: typeof preset) => {
    const today = new Date();
    let from = new Date();
    if (p === '30d') from.setDate(today.getDate() - 30);
    if (p === '90d') from.setDate(today.getDate() - 90);
    if (p === '6m') from.setMonth(today.getMonth() - 6);
    if (p === '12m') from.setFullYear(today.getFullYear() - 1);
    if (p === 'all') from = new Date('2024-01-01');
    setFromDate(from.toISOString().slice(0, 10));
    setToDate(today.toISOString().slice(0, 10));
    setPreset(p);
  };

  useEffect(() => {
    applyPreset('12m');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        from: fromDate,
        to: toDate,
        persist: '1',
      });
      const res = await fetch(`/api/suppliers/otifef?${params}`);
      const data = await res.json();
      setSummary(data.summary || null);
      setRows(data.rows || []);
    } finally {
      setLoading(false);
    }
  }, [companyId, fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const band = otifefBand(summary?.overall || 0);
  const visible = useMemo(() => {
    return rows
      .filter((r) => matchesQuery(q, [r.name, r.supplier_id]))
      .sort((a, b) => {
        if (sort === 'name') return compareText(a.name || '', b.name || '', 'asc');
        if (sort === 'pos') return compareNum(a.total_pos, b.total_pos, 'desc');
        return compareNum(a.overall, b.overall, 'desc');
      });
  }, [rows, q, sort]);

  return (
    <SuppliersPage>
    <div className="pb-8">
      <SuppliersHeader
        title="OTIFEF scorecards"
        description="On-Time × In-Full × Error-Free — the performance backbone of trusted supply. Metrics persist to supplier_scorecards and refresh trust scores on your book."
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {(['30d', '90d', '6m', '12m', 'all'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => applyPreset(p)}
            className={`${srmFocus} rounded-full border px-3 py-1.5 text-xs font-semibold ${
              preset === p
                ? 'border-[#00b4d8] bg-[#00b4d8] text-slate-950'
                : 'border-neutral-200 bg-white text-slate-700'
            }`}
          >
            {p}
          </button>
        ))}
        <input
          type="date"
          className="input !py-1.5 !text-xs !w-auto"
          value={fromDate}
          onChange={(e) => {
            setFromDate(e.target.value);
            setPreset('12m');
          }}
        />
        <input
          type="date"
          className="input !py-1.5 !text-xs !w-auto"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
      </div>

      {loading ? (
        <SrmSkeleton variant="cards" rows={4} />
      ) : (
        <>
          <div className="mb-6">
            <OtifefKpiCard metrics={summary} kind="supplier" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white border rounded-3xl p-6">
              <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
                OVERALL OTIFEF <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-5xl font-black tracking-tighter">
                {(summary?.overall ?? 0).toFixed(1)}%
              </div>
              <span className={`mt-2 inline-flex text-xs font-bold px-3 py-1 rounded-full ${band.className}`}>
                {band.label}
              </span>
              <div className="text-xs text-neutral-500 mt-2">
                {summary?.totalPOs ?? 0} POs · {summary?.supplierCount ?? 0} suppliers
              </div>
            </div>
            <Stat icon={Truck} label="On time" value={summary?.onTime ?? 0} />
            <Stat icon={Package} label="In full" value={summary?.inFull ?? 0} />
            <Stat icon={Award} label="Error free" value={summary?.errorFree ?? 0} />
          </div>

          <SrmToolbar meta={`${visible.length} scored supplier${visible.length === 1 ? '' : 's'}`}>
            <SrmSearch value={q} onChange={setQ} label="Search scorecards" placeholder="Search supplier" />
            <SrmSortButton label="OTIFEF" active={sort === 'otifef'} onClick={() => setSort('otifef')} />
            <SrmSortButton label="Name" active={sort === 'name'} onClick={() => setSort('name')} />
            <SrmSortButton label="POs" active={sort === 'pos'} onClick={() => setSort('pos')} />
          </SrmToolbar>
          <div className="bg-white border rounded-3xl overflow-hidden">
            <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-600">
              Ranked by OTIFEF
            </div>
            {visible.length === 0 ? (
              <div className="p-4">
                <SrmEmpty
                  title="No scorecards in this range"
                  description="Delivered purchase orders with on-time, in-full, and error-free fields will rank here."
                  actionHref="/dashboard/suppliers/po"
                  actionLabel="Open purchase orders"
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs text-slate-600">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">OTIFEF</th>
                      <th className="px-4 py-3">On time</th>
                      <th className="px-4 py-3">In full</th>
                      <th className="px-4 py-3">Error free</th>
                      <th className="px-4 py-3">POs</th>
                      <th className="px-4 py-3">Avg days early</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visible.map((r, i) => (
                      <tr key={r.supplier_id} className="hover:bg-neutral-50">
                        <td className="px-4 py-3 text-neutral-400">{i + 1}</td>
                        <td className="px-4 py-3 font-medium">
                          <Link
                            href={`/dashboard/suppliers/network?id=${r.srm_supplier_id || r.supplier_id}`}
                            className={`${srmFocus} font-semibold text-slate-900 hover:text-[#0077b6]`}
                          >
                            {r.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-black text-[#00b4d8]">
                          {r.overall.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3">{r.ot_percent.toFixed(1)}%</td>
                        <td className="px-4 py-3">{r.if_percent.toFixed(1)}%</td>
                        <td className="px-4 py-3">{r.ef_percent.toFixed(1)}%</td>
                        <td className="px-4 py-3">{r.total_pos}</td>
                        <td className="px-4 py-3">{r.ot_days.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
    </SuppliersPage>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white border rounded-3xl p-6">
      <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
        {label.toUpperCase()} <Icon className="w-4 h-4" />
      </div>
      <div className="text-4xl font-black tracking-tighter">{value.toFixed(1)}%</div>
    </div>
  );
}
