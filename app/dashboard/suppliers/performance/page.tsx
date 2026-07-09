'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, TrendingUp, Truck, Package, Award } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { otifefBand, type OtifefMetrics, type SupplierOtifefRow } from '@/lib/suppliers/types';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage
} from '@/components/suppliers/SuppliersShell';

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
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              preset === p
                ? 'bg-[#00b4d8] text-white border-[#00b4d8]'
                : 'bg-white border-neutral-200'
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
        <div className="p-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
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

          <div className="bg-white border rounded-3xl overflow-hidden">
            <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-neutral-500">
              Ranked by OTIFEF
            </div>
            {rows.length === 0 ? (
              <div className="p-12 text-center text-sm text-neutral-500">
                No delivered POs with complete OTIFEF fields in this range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
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
                    {rows.map((r, i) => (
                      <tr key={r.supplier_id} className="hover:bg-neutral-50">
                        <td className="px-4 py-3 text-neutral-400">{i + 1}</td>
                        <td className="px-4 py-3 font-medium">{r.name}</td>
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
