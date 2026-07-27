'use client';

/**
 * DBE Insights — Service provider register (linked SPs).
 * Raise RIAD against any SP from the directory.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Download,
  Loader2,
  RefreshCw,
  Truck,
  MapPinned,
  Building2,
  Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import { useProgrammeRole } from '@/lib/schools/useProgrammeRole';
import RaiseRiadModal, {
  type RaiseRiadTarget,
} from '@/components/schools/RaiseRiadModal';

type SpRow = {
  isp_profile_id: number;
  company_id: number;
  name: string;
  csd_number: string | null;
  district: string | null;
  cluster_allocation: string | null;
  province: string | null;
  compliance_status: string;
  link_status: string;
  registry_source: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  schools_linked: number;
};

function fmt(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-ZA');
}

export default function SpRegisterPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const programme = useProgrammeRole();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState('all');
  const [district, setDistrict] = useState('');
  const [qDraft, setQDraft] = useState('');
  const [q, setQ] = useState('');
  const [riadTarget, setRiadTarget] = useState<RaiseRiadTarget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        status,
      });
      if (district) params.set('district', district);
      if (q) params.set('q', q);
      const res = await fetch(`/api/schools/sp-register?${params}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData(json);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, status, district, q]);

  useEffect(() => {
    if (programme.role === 'department') void load();
  }, [programme.role, load]);

  const sps = (data?.sps || []) as SpRow[];
  const k = (data?.kpis || {}) as Record<string, number>;
  const facets = (data?.facets || { districts: [] }) as {
    districts: string[];
  };
  const byDistrict = (data?.byDistrict || []) as Array<{
    key: string;
    sps: number;
  }>;
  const byCluster = (data?.byCluster || []) as Array<{
    key: string;
    sps: number;
  }>;

  const downloadCsv = () => {
    const headers = [
      'name',
      'csd_number',
      'district',
      'cluster_allocation',
      'province',
      'link_status',
      'compliance_status',
      'schools_linked',
      'contact_name',
      'contact_phone',
      'contact_email',
      'registry_source',
      'isp_profile_id',
    ];
    const lines = [
      headers.join(','),
      ...sps.map((s) =>
        headers
          .map((h) => {
            const v = (s as Record<string, unknown>)[h];
            const t = v == null ? '' : String(v);
            return `"${t.replace(/"/g, '""')}"`;
          })
          .join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dbe-sp-register-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (programme.loading) {
    return (
      <SchoolsPage>
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      </SchoolsPage>
    );
  }

  if (programme.role !== 'department') {
    return (
      <SchoolsPage>
        <SchoolsHeader
          title="Service providers"
          titleAccent="DBE only"
          description="Only the department can view the provincial SP register."
        />
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
          <p className="font-bold">Switch to your DBE / PEU company</p>
        </div>
      </SchoolsPage>
    );
  }

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Service providers"
        titleAccent="Register · Insights"
        description="SPs associated with your department — district, cluster, CSD. Raise a RIAD against any provider."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/schools/sp-registry-import"
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              Import SPs
            </Link>
            <Link
              href="/dashboard/schools/agency-report?report=riad"
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <AlertTriangle className="w-3.5 h-3.5" /> RIAD log
            </Link>
            <button
              type="button"
              onClick={downloadCsv}
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

      <div className="mb-4 flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold text-slate-600">
          Link status
          <select
            className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm min-w-[120px]"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          District
          <select
            className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm min-w-[160px]"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          >
            <option value="">All districts</option>
            {facets.districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 flex-1 min-w-[180px]">
          Search
          <div className="mt-1 flex gap-2">
            <input
              className="block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              placeholder="Name, CSD, cluster…"
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setQ(qDraft.trim());
              }}
            />
            <button
              type="button"
              className="btn-primary !py-1.5 !px-3 text-xs"
              onClick={() => setQ(qDraft.trim())}
            >
              Go
            </button>
          </div>
        </label>
      </div>

      {loading && !data ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mb-4">
            <Kpi
              icon={<Truck className="w-4 h-4" />}
              label="SPs linked"
              value={fmt(k.sps)}
              sub={`${fmt(k.active)} active · ${fmt(k.pending)} pending`}
            />
            <Kpi
              icon={<Building2 className="w-4 h-4" />}
              label="With CSD"
              value={fmt(k.with_csd)}
              sub={`${fmt(k.from_registry)} from registry import`}
            />
            <Kpi
              icon={<MapPinned className="w-4 h-4" />}
              label="Districts"
              value={fmt(k.districts)}
              sub={`${fmt(k.clusters)} clusters`}
            />
            <Kpi
              icon={<Link2 className="w-4 h-4" />}
              label="School connections"
              value={fmt(k.schools_connected)}
              sub={`${fmt(k.compliant)} compliance OK`}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <RollCard title="By district" rows={byDistrict.slice(0, 12)} />
            <RollCard title="By cluster" rows={byCluster.slice(0, 12)} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Service provider directory
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {fmt(sps.length)} provider(s) · raise RIAD from any row
                </p>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500 sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">CSD</th>
                    <th className="px-3 py-2">District</th>
                    <th className="px-3 py-2">Cluster</th>
                    <th className="px-3 py-2">Link</th>
                    <th className="px-3 py-2 text-right">Schools</th>
                    <th className="px-3 py-2">Contact</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sps.map((s) => (
                    <tr
                      key={s.isp_profile_id}
                      className="border-t border-slate-50 hover:bg-slate-50/80"
                    >
                      <td className="px-3 py-2 font-medium text-slate-900 max-w-[220px]">
                        {s.name}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">
                        {s.csd_number || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {s.district || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {s.cluster_allocation || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-[10px] font-bold uppercase ${
                            s.link_status === 'active'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {s.link_status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmt(s.schools_linked)}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {s.contact_name || s.contact_phone || s.contact_email || '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setRiadTarget({
                              type: 'isp',
                              id: s.isp_profile_id,
                              name: s.name,
                              subtitle: [
                                s.csd_number ? `CSD ${s.csd_number}` : null,
                                s.district,
                                s.cluster_allocation,
                              ]
                                .filter(Boolean)
                                .join(' · '),
                            })
                          }
                          className="btn-secondary !py-1 !px-2 text-[11px] inline-flex items-center gap-1 text-rose-800 border-rose-200"
                        >
                          <AlertTriangle className="w-3 h-3" /> RIAD
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!sps.length && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-10 text-center text-slate-500"
                      >
                        No service providers yet — import the SP list or approve
                        joins.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {riadTarget ? (
        <RaiseRiadModal
          agencyCompanyId={companyId}
          target={riadTarget}
          onClose={() => setRiadTarget(null)}
        />
      ) : null}
    </SchoolsPage>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-black text-slate-900 tabular-nums tracking-tight">
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 text-[11px] text-slate-500 leading-snug">{sub}</div>
      ) : null}
    </div>
  );
}

function RollCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; sps: number }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-2.5 border-b text-xs font-bold uppercase text-slate-500">
        {title}
      </div>
      <ul className="max-h-48 overflow-y-auto divide-y divide-slate-50">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-sm text-slate-500 text-center">—</li>
        ) : (
          rows.map((r) => (
            <li
              key={r.key}
              className="px-4 py-2 flex justify-between text-sm gap-2"
            >
              <span className="truncate text-slate-700">{r.key}</span>
              <span className="font-bold tabular-nums shrink-0">{r.sps}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
