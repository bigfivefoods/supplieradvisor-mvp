'use client';

/**
 * DBE school register report — schools linked to the department:
 * counts, geography (province → district → CMC → circuit → municipality → ward),
 * quintile/level, and learner / NSNP enrolment totals.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Building2,
  Download,
  FileSpreadsheet,
  Landmark,
  Loader2,
  MapPinned,
  RefreshCw,
  School,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import { useProgrammeRole } from '@/lib/schools/useProgrammeRole';
import { SA_PROVINCES } from '@/lib/schools/types';
import RaiseRiadModal, {
  type RaiseRiadTarget,
} from '@/components/schools/RaiseRiadModal';

type Kpis = {
  schools: number;
  schools_with_natemis: number;
  schools_with_enrolment: number;
  total_learners_enrolled: number;
  total_nsnp_eligible: number;
  total_nsnp_applic: number;
  total_final_emis: number;
  total_nsnp_approved: number;
  avg_learners_per_school: number;
  median_learners: number;
  provinces: number;
  districts: number;
  cmcs: number;
  circuits: number;
  municipalities: number;
  wards: number;
  quintile_1: number;
  quintile_2: number;
  quintile_3: number;
  quintile_4: number;
  quintile_5: number;
  quintile_unknown: number;
  link_active: number;
  link_pending: number;
  registry_imported: number;
};

type RollRow = {
  key: string;
  schools: number;
  learners_enrolled: number;
  learners_nsnp_eligible: number;
  nsnp_approved_enrol: number;
  final_emis_enrol: number;
  nsnp_applic_enrol: number;
};

type SchoolRow = {
  school_profile_id: number;
  company_id?: number | null;
  school_name: string;
  natemis: string | null;
  emis_number: string | null;
  province: string | null;
  district: string | null;
  cmc: string | null;
  circuit: string | null;
  local_municipality: string | null;
  municipality_ward: string | null;
  quintile: number | null;
  level_label: string | null;
  phase: string | null;
  learners_enrolled: number;
  learners_nsnp_eligible: number;
  nsnp_approved_enrol: number;
  final_emis_enrol: number;
  nsnp_applic_enrol: number;
  enrolment_year: string | null;
  link_status: string;
};

type TabId =
  | 'overview'
  | 'province'
  | 'district'
  | 'cmc'
  | 'circuit'
  | 'municipality'
  | 'ward'
  | 'quintile'
  | 'level'
  | 'schools';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'province', label: 'Province' },
  { id: 'district', label: 'District' },
  { id: 'cmc', label: 'CMC' },
  { id: 'circuit', label: 'Circuit' },
  { id: 'municipality', label: 'Municipality' },
  { id: 'ward', label: 'Ward' },
  { id: 'quintile', label: 'Quintile' },
  { id: 'level', label: 'Level' },
  { id: 'schools', label: 'School list' },
];

function fmt(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-ZA');
}

function csvCell(v: unknown) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function RegistryReportPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const programme = useProgrammeRole();
  const [tab, setTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<'active' | 'pending' | 'all'>('active');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [cmc, setCmc] = useState('');
  const [q, setQ] = useState('');
  const [qDraft, setQDraft] = useState('');
  const [riadTarget, setRiadTarget] = useState<RaiseRiadTarget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        status,
        includeSchools: '1',
      });
      if (province) params.set('province', province);
      if (district) params.set('district', district);
      if (municipality) params.set('municipality', municipality);
      if (cmc) params.set('cmc', cmc);
      if (q) params.set('q', q);
      const res = await fetch(`/api/schools/registry-report?${params}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.status === 403) {
        setForbidden(true);
        setData(null);
        return;
      }
      if (!res.ok) throw new Error(json.error || 'Failed to load report');
      setData(json);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, status, province, district, municipality, cmc, q]);

  useEffect(() => {
    if (programme.role === 'department') void load();
  }, [programme.role, load]);

  const k = (data?.kpis || {}) as Partial<Kpis>;
  const agency = (data?.agency || {}) as {
    name?: string;
    type?: string;
    province?: string;
  };
  const byProvince = (data?.byProvince || []) as RollRow[];
  const byDistrict = (data?.byDistrict || []) as RollRow[];
  const byCmc = (data?.byCmc || []) as RollRow[];
  const byCircuit = (data?.byCircuit || []) as RollRow[];
  const byMunicipality = (data?.byMunicipality || []) as RollRow[];
  const byWard = (data?.byWard || []) as RollRow[];
  const byQuintile = (data?.byQuintile || []) as RollRow[];
  const byLevel = (data?.byLevel || []) as RollRow[];
  const byPhase = (data?.byPhase || []) as RollRow[];
  const topSchools = (data?.topSchoolsByEnrolment || []) as Array<
    Record<string, unknown>
  >;
  const schools = (data?.schools || []) as SchoolRow[];
  const facets = (data?.facets || {
    provinces: [],
    districts: [],
    municipalities: [],
    cmcs: [],
  }) as {
    provinces: string[];
    districts: string[];
    municipalities: string[];
    cmcs: string[];
  };

  const rollForTab = useMemo((): RollRow[] => {
    switch (tab) {
      case 'province':
        return byProvince;
      case 'district':
        return byDistrict;
      case 'cmc':
        return byCmc;
      case 'circuit':
        return byCircuit;
      case 'municipality':
        return byMunicipality;
      case 'ward':
        return byWard;
      case 'quintile':
        return byQuintile;
      case 'level':
        return byLevel;
      default:
        return [];
    }
  }, [
    tab,
    byProvince,
    byDistrict,
    byCmc,
    byCircuit,
    byMunicipality,
    byWard,
    byQuintile,
    byLevel,
  ]);

  const downloadRollCsv = (rows: RollRow[], name: string) => {
    const lines = [
      'region,schools,learners_enrolled,nsnp_eligible,nsnp_approved,final_emis,nsnp_applic',
    ];
    for (const r of rows) {
      lines.push(
        [
          csvCell(r.key),
          r.schools,
          r.learners_enrolled,
          r.learners_nsnp_eligible,
          r.nsnp_approved_enrol,
          r.final_emis_enrol,
          r.nsnp_applic_enrol,
        ].join(',')
      );
    }
    downloadText(lines.join('\n'), `dbe-schools-by-${name}.csv`);
  };

  const downloadSchoolCsv = async () => {
    try {
      toast.message('Building full school CSV…');
      const params = new URLSearchParams({
        companyId: String(companyId),
        status,
        includeSchools: '1',
        export: '1',
      });
      if (province) params.set('province', province);
      if (district) params.set('district', district);
      if (municipality) params.set('municipality', municipality);
      if (cmc) params.set('cmc', cmc);
      if (q) params.set('q', q);
      const res = await fetch(`/api/schools/registry-report?${params}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Export failed');
      const rows = (json.schools || []) as SchoolRow[];
      const lines = [
        [
          'school_name',
          'natemis',
          'emis',
          'province',
          'district',
          'cmc',
          'circuit',
          'local_municipality',
          'ward',
          'quintile',
          'level',
          'phase',
          'learners_enrolled',
          'nsnp_eligible',
          'nsnp_approved',
          'final_emis',
          'nsnp_applic',
          'enrolment_year',
          'link_status',
        ].join(','),
      ];
      for (const s of rows) {
        lines.push(
          [
            csvCell(s.school_name),
            csvCell(s.natemis),
            csvCell(s.emis_number),
            csvCell(s.province),
            csvCell(s.district),
            csvCell(s.cmc),
            csvCell(s.circuit),
            csvCell(s.local_municipality),
            csvCell(s.municipality_ward),
            s.quintile ?? '',
            csvCell(s.level_label),
            csvCell(s.phase),
            s.learners_enrolled,
            s.learners_nsnp_eligible,
            s.nsnp_approved_enrol,
            s.final_emis_enrol,
            s.nsnp_applic_enrol,
            csvCell(s.enrolment_year),
            csvCell(s.link_status),
          ].join(',')
        );
      }
      downloadText(
        lines.join('\n'),
        `dbe-school-register-${new Date().toISOString().slice(0, 10)}.csv`
      );
      toast.success(`Exported ${rows.length} schools`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
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

  if (programme.role !== 'department' || forbidden) {
    return (
      <SchoolsPage>
        <SchoolsHeader
          title="School register report"
          titleAccent="DBE only"
          mode="agency"
          description="Department view of all linked schools, locations and enrolments."
        />
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-10 text-center">
          <Landmark className="w-10 h-10 text-amber-600 mx-auto mb-3" />
          <p className="font-bold text-slate-900">Department access required</p>
          <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
            Switch to your DBE / PEU company, register as an agency if needed,
            then import or approve schools.
          </p>
          <div className="flex justify-center gap-2 mt-4">
            <Link
              href="/dashboard/schools/agency"
              className="btn-primary !py-2 !px-4 text-sm"
            >
              DBE desk
            </Link>
            <Link
              href="/dashboard/schools/registry-import"
              className="btn-secondary !py-2 !px-4 text-sm"
            >
              Import schools
            </Link>
          </div>
        </div>
      </SchoolsPage>
    );
  }

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="School register report"
        titleAccent={agency.name || 'DBE'}
        mode="agency"
        description={
          data?.generated_at
            ? `All schools linked to your department · generated ${new Date(String(data.generated_at)).toLocaleString('en-ZA')}`
            : 'Counts, geography and learner enrolments for every school on your programme.'
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/schools/registry-import"
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Import
            </Link>
            <Link
              href="/dashboard/schools/agency-report?report=riad"
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <AlertTriangle className="w-3.5 h-3.5" /> RIAD log
            </Link>
            <button
              type="button"
              onClick={() => void downloadSchoolCsv()}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> Full CSV
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-xs"
              disabled={loading}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold text-slate-600">
          Link status
          <select
            className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm min-w-[120px]"
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as 'active' | 'pending' | 'all')
            }
          >
            <option value="active">Active only</option>
            <option value="pending">Pending</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Province
          <select
            className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm min-w-[160px]"
            value={province}
            onChange={(e) => {
              setProvince(e.target.value);
              setDistrict('');
              setMunicipality('');
              setCmc('');
            }}
          >
            <option value="">All provinces</option>
            {(facets.provinces.length
              ? facets.provinces
              : SA_PROVINCES
            ).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          District
          <select
            className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm min-w-[160px]"
            value={district}
            onChange={(e) => {
              setDistrict(e.target.value);
              setMunicipality('');
            }}
          >
            <option value="">All districts</option>
            {facets.districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Municipality
          <select
            className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm min-w-[160px]"
            value={municipality}
            onChange={(e) => setMunicipality(e.target.value)}
          >
            <option value="">All municipalities</option>
            {facets.municipalities.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          CMC
          <select
            className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm min-w-[140px]"
            value={cmc}
            onChange={(e) => setCmc(e.target.value)}
          >
            <option value="">All CMCs</option>
            {facets.cmcs.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 flex-1 min-w-[180px]">
          Search
          <div className="mt-1 flex gap-2">
            <input
              className="block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              placeholder="School, NATEMIS, circuit…"
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
          {/* Import completeness banner */}
          {k.schools != null && (
            <div
              className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
                (k.registry_imported || 0) >= 5000
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                  : 'border-amber-200 bg-amber-50 text-amber-950'
              }`}
            >
              <strong>Register status:</strong>{' '}
              {fmt(k.schools)} school(s) linked
              {(k.registry_imported || 0) > 0
                ? ` · ${fmt(k.registry_imported)} from provincial xlsx import`
                : ''}
              {(k.schools_with_natemis || 0) > 0
                ? ` · ${fmt(k.schools_with_natemis)} with NATEMIS`
                : ''}
              . Same institution names can appear more than once when they have
              different NATEMIS numbers (not duplicates).
            </div>
          )}

          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mb-4">
            <Kpi
              icon={<School className="w-4 h-4" />}
              label="Schools linked"
              value={fmt(k.schools)}
              sub={`${fmt(k.registry_imported)} registry import · ${fmt(k.schools_with_natemis)} NATEMIS`}
            />
            <Kpi
              icon={<Users className="w-4 h-4" />}
              label="Learners (enrolled)"
              value={fmt(k.total_learners_enrolled)}
              sub={`Avg ${fmt(k.avg_learners_per_school)} · median ${fmt(k.median_learners)}`}
            />
            <Kpi
              icon={<Users className="w-4 h-4" />}
              label="NSNP approved enrol."
              value={fmt(k.total_nsnp_approved)}
              sub={`Eligible ${fmt(k.total_nsnp_eligible)} · applic. ${fmt(k.total_nsnp_applic)}`}
            />
            <Kpi
              icon={<MapPinned className="w-4 h-4" />}
              label="Districts"
              value={fmt(k.districts)}
              sub={`${fmt(k.provinces)} province(s) · ${fmt(k.cmcs)} CMC`}
            />
            <Kpi
              icon={<Building2 className="w-4 h-4" />}
              label="Municipalities"
              value={fmt(k.municipalities)}
              sub={`${fmt(k.circuits)} circuits · ${fmt(k.wards)} wards`}
            />
            <Kpi
              icon={<Landmark className="w-4 h-4" />}
              label="Quintiles 1–3"
              value={fmt(
                (k.quintile_1 || 0) +
                  (k.quintile_2 || 0) +
                  (k.quintile_3 || 0)
              )}
              sub={`Q1 ${fmt(k.quintile_1)} · Q2 ${fmt(k.quintile_2)} · Q3 ${fmt(k.quintile_3)}`}
            />
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                  tab === t.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="grid lg:grid-cols-2 gap-4">
              <RollTable
                title="By province"
                rows={byProvince}
                onExport={() => downloadRollCsv(byProvince, 'province')}
              />
              <RollTable
                title="By district"
                rows={byDistrict.slice(0, 30)}
                total={byDistrict.length}
                onExport={() => downloadRollCsv(byDistrict, 'district')}
              />
              <RollTable
                title="By municipality"
                rows={byMunicipality.slice(0, 30)}
                total={byMunicipality.length}
                onExport={() =>
                  downloadRollCsv(byMunicipality, 'municipality')
                }
              />
              <RollTable
                title="By CMC"
                rows={byCmc.slice(0, 30)}
                total={byCmc.length}
                onExport={() => downloadRollCsv(byCmc, 'cmc')}
              />
              <RollTable
                title="By quintile"
                rows={byQuintile}
                onExport={() => downloadRollCsv(byQuintile, 'quintile')}
              />
              <RollTable
                title="By school level"
                rows={byLevel}
                onExport={() => downloadRollCsv(byLevel, 'level')}
              />
              {byPhase.length > 0 && (
                <RollTable
                  title="By phase"
                  rows={byPhase}
                  onExport={() => downloadRollCsv(byPhase, 'phase')}
                />
              )}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden lg:col-span-2">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">
                    Largest schools by enrolment
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500">
                      <tr>
                        <th className="px-3 py-2">School</th>
                        <th className="px-3 py-2">District</th>
                        <th className="px-3 py-2">Municipality</th>
                        <th className="px-3 py-2">Q</th>
                        <th className="px-3 py-2 text-right">Enrolled</th>
                        <th className="px-3 py-2 text-right">NSNP approved</th>
                        <th className="px-3 py-2">NATEMIS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topSchools.map((s, i) => (
                        <tr
                          key={i}
                          className="border-t border-slate-50 hover:bg-slate-50/80"
                        >
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {String(s.school_name || '')}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {String(s.district || '—')}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {String(s.local_municipality || '—')}
                          </td>
                          <td className="px-3 py-2">
                            {s.quintile != null ? `Q${s.quintile}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {fmt(Number(s.learners_enrolled || 0))}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {fmt(Number(s.nsnp_approved_enrol || 0))}
                          </td>
                          <td className="px-3 py-2 text-slate-500 font-mono text-xs">
                            {String(s.natemis || '—')}
                          </td>
                        </tr>
                      ))}
                      {!topSchools.length && (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-3 py-8 text-center text-slate-500"
                          >
                            No schools yet — import the provincial register or
                            approve joins.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab !== 'overview' && tab !== 'schools' && (
            <RollTable
              title={`Schools by ${tab}`}
              rows={rollForTab}
              onExport={() => downloadRollCsv(rollForTab, tab)}
              showAll
            />
          )}

          {tab === 'schools' && (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    School directory
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Showing {fmt(schools.length)} of{' '}
                    {fmt(Number(data?.schools_total || schools.length))}
                    {data?.schools_truncated
                      ? ' · use Full CSV for the complete list'
                      : ''}
                    {' · raise RIAD from any row'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void downloadSchoolCsv()}
                  className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Full CSV
                </button>
              </div>
              <div className="overflow-x-auto max-h-[70vh]">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">School</th>
                      <th className="px-3 py-2">NATEMIS</th>
                      <th className="px-3 py-2">Province</th>
                      <th className="px-3 py-2">District</th>
                      <th className="px-3 py-2">CMC</th>
                      <th className="px-3 py-2">Circuit</th>
                      <th className="px-3 py-2">Municipality</th>
                      <th className="px-3 py-2">Ward</th>
                      <th className="px-3 py-2">Q</th>
                      <th className="px-3 py-2">Level</th>
                      <th className="px-3 py-2 text-right">Enrolled</th>
                      <th className="px-3 py-2 text-right">NSNP</th>
                      <th className="px-3 py-2 text-right">EMIS</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schools.map((s) => (
                      <tr
                        key={s.school_profile_id}
                        className="border-t border-slate-50 hover:bg-slate-50/80"
                      >
                        <td className="px-3 py-2 font-medium text-slate-900 max-w-[220px]">
                          {s.school_name}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">
                          {s.natemis || s.emis_number || '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {s.province || '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {s.district || '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {s.cmc || '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {s.circuit || '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {s.local_municipality || '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {s.municipality_ward || '—'}
                        </td>
                        <td className="px-3 py-2">
                          {s.quintile != null ? `Q${s.quintile}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {s.level_label || s.phase || '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmt(s.learners_enrolled)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmt(s.nsnp_approved_enrol)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmt(s.final_emis_enrol)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setRiadTarget({
                                type: 'school',
                                id: s.school_profile_id,
                                companyId: s.company_id,
                                name: s.school_name,
                                subtitle: [
                                  s.natemis || s.emis_number
                                    ? `NATEMIS ${s.natemis || s.emis_number}`
                                    : null,
                                  s.district,
                                  s.province,
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
                    {!schools.length && (
                      <tr>
                        <td
                          colSpan={14}
                          className="px-3 py-10 text-center text-slate-500"
                        >
                          No schools match these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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

function RollTable({
  title,
  rows,
  total,
  onExport,
  showAll,
}: {
  title: string;
  rows: RollRow[];
  total?: number;
  onExport?: () => void;
  showAll?: boolean;
}) {
  const list = showAll ? rows : rows;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
          {total != null && total > rows.length ? (
            <p className="text-[11px] text-slate-500">
              Top {rows.length} of {total}
            </p>
          ) : null}
        </div>
        {onExport ? (
          <button
            type="button"
            onClick={onExport}
            className="text-xs font-semibold text-[#0077b6] hover:underline inline-flex items-center gap-1"
          >
            <Download className="w-3 h-3" /> CSV
          </button>
        ) : null}
      </div>
      <div className={`overflow-x-auto ${showAll ? 'max-h-[70vh]' : ''}`}>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500 sticky top-0">
            <tr>
              <th className="px-3 py-2">Region</th>
              <th className="px-3 py-2 text-right">Schools</th>
              <th className="px-3 py-2 text-right">Enrolled</th>
              <th className="px-3 py-2 text-right">NSNP approved</th>
              <th className="px-3 py-2 text-right">NSNP eligible</th>
              <th className="px-3 py-2 text-right">Final EMIS</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr
                key={r.key}
                className="border-t border-slate-50 hover:bg-slate-50/80"
              >
                <td className="px-3 py-2 font-medium text-slate-900">
                  {r.key}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {fmt(r.schools)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmt(r.learners_enrolled)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmt(r.nsnp_approved_enrol)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmt(r.learners_nsnp_eligible)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmt(r.final_emis_enrol)}
                </td>
              </tr>
            ))}
            {!list.length && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-slate-500"
                >
                  No data for this breakdown.
                </td>
              </tr>
            )}
          </tbody>
          {list.length > 0 && (
            <tfoot className="bg-slate-50 border-t border-slate-200 text-sm font-bold">
              <tr>
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmt(list.reduce((n, r) => n + r.schools, 0))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmt(list.reduce((n, r) => n + r.learners_enrolled, 0))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmt(list.reduce((n, r) => n + r.nsnp_approved_enrol, 0))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmt(list.reduce((n, r) => n + r.learners_nsnp_eligible, 0))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmt(list.reduce((n, r) => n + r.final_emis_enrol, 0))}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
