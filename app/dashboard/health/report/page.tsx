'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  HealthHeader,
  HealthPage,
} from '@/components/health/HealthShell';
import { useHealthProgrammeRole } from '@/lib/health/useProgrammeRole';
import ManagementReportPanel from '@/components/advisors/ManagementReportPanel';

export default function HealthReportPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const programme = useHealthProgrammeRole();
  const [loading, setLoading] = useState(true);
  const [facilities, setFacilities] = useState<Array<Record<string, unknown>>>(
    []
  );
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [agency, setAgency] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/health/agency?companyId=${companyId}&mode=agency`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setFacilities(data.facilities || []);
      setSummary(data.summary || null);
      setAgency(data.agency || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (programme.role === 'department') void load();
    else setLoading(false);
  }, [programme.role, load]);

  const byDistrict = useMemo(() => {
    const map = new Map<string, { key: string; n: number; patients: number }>();
    for (const f of facilities) {
      if (String(f.link_status) !== 'active') continue;
      const key =
        [f.district, f.province].filter(Boolean).join(', ') || 'Unknown';
      if (!map.has(key)) map.set(key, { key, n: 0, patients: 0 });
      const g = map.get(key)!;
      g.n += 1;
      g.patients += Number(f.learner_count_enrolled || 0);
    }
    return [...map.values()].sort((a, b) => b.n - a.n);
  }, [facilities]);

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of facilities) {
      if (String(f.link_status) !== 'active') continue;
      const t = String(f.member_type || 'hospital');
      map.set(t, (map.get(t) || 0) + 1);
    }
    return [...map.entries()].map(([key, n]) => ({ key, n }));
  }, [facilities]);

  const exportCsv = () => {
    const lines = [
      'name,type,district,province,status,census',
    ];
    for (const f of facilities) {
      lines.push(
        [
          csv(String(f.facility_name || f.school_name || '')),
          csv(String(f.member_type || '')),
          csv(String(f.district || '')),
          csv(String(f.province || '')),
          csv(String(f.link_status || '')),
          Number(f.learner_count_enrolled || 0),
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doh-facilities-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (programme.loading || loading) {
    return (
      <HealthPage>
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
        </div>
      </HealthPage>
    );
  }

  if (programme.role !== 'department') {
    return (
      <HealthPage>
        <HealthHeader
          title="Coverage report"
          titleAccent="DoH only"
          mode="agency"
        />
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
          <p className="font-bold">Department of Health access required</p>
          <Link
            href="/dashboard/health/agency"
            className="btn-primary !py-2 !px-4 text-sm mt-4 inline-flex"
          >
            DoH desk →
          </Link>
        </div>
      </HealthPage>
    );
  }

  return (
    <HealthPage>
      <ManagementReportPanel advisor="health" className="mb-6" />
      <HealthHeader
        title="Health coverage report"
        titleAccent={String(agency?.agency_name || 'DoH')}
        mode="agency"
        description="Clinics and hospitals linked to your department — by district and facility type."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          ['Facilities', summary?.facilityCount],
          ['Active', summary?.activeLinks],
          ['Hospitals', summary?.hospitals],
          ['Clinics', summary?.clinics],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <p className="text-[10px] font-bold uppercase text-slate-400">
              {String(label)}
            </p>
            <p className="text-2xl font-black tabular-nums">
              {Number(value || 0).toLocaleString('en-ZA')}
            </p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Roll title="By district" rows={byDistrict} />
        <Roll
          title="By facility type"
          rows={byType.map((r) => ({
            key: r.key,
            n: r.n,
            patients: 0,
          }))}
          hidePatients
        />
      </div>
    </HealthPage>
  );
}

function Roll({
  title,
  rows,
  hidePatients,
}: {
  title: string;
  rows: Array<{ key: string; n: number; patients: number }>;
  hidePatients?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b text-sm font-bold">{title}</div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-3 py-2">Region / type</th>
            <th className="px-3 py-2 text-right">Facilities</th>
            {!hidePatients ? (
              <th className="px-3 py-2 text-right">Census</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-slate-50">
              <td className="px-3 py-2 font-medium capitalize">{r.key}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold">
                {r.n.toLocaleString('en-ZA')}
              </td>
              {!hidePatients ? (
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.patients.toLocaleString('en-ZA')}
                </td>
              ) : null}
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td
                colSpan={hidePatients ? 2 : 3}
                className="px-3 py-8 text-center text-slate-500"
              >
                No active facilities yet
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function csv(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
