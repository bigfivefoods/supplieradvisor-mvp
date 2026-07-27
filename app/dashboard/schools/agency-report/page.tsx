'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Download,
  Filter,
  Landmark,
  Loader2,
  MapPinned,
  RefreshCw,
  School,
  Truck,
  Trophy,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney } from '@/lib/accounting/types';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

/** All DBE programme reports — slice & dice hub */
const REPORT_GROUPS: Array<{
  label: string;
  items: Array<{ id: string; label: string; hint?: string }>;
}> = [
  {
    label: 'Overview',
    items: [
      { id: 'overview', label: 'Dashboard', hint: 'KPIs + school list' },
      { id: 'hierarchy', label: 'Hierarchy', hint: 'DBE → SPs → schools' },
      { id: 'members', label: 'School list', hint: 'Sortable directory' },
    ],
  },
  {
    label: 'Geography',
    items: [
      { id: 'coverage', label: 'Coverage', hint: 'Schools + SPs' },
      { id: 'province', label: 'Province' },
      { id: 'district', label: 'District' },
      { id: 'circuit', label: 'Circuit' },
      { id: 'quintile', label: 'Quintile' },
      { id: 'map', label: 'Map list' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'feeding', label: 'Feeding', hint: 'Meals & waste' },
      { id: 'prizes', label: 'Prize board' },
      { id: 'risks', label: 'Risks', hint: 'Operational flags' },
      { id: 'isps', label: 'SPs', hint: 'Service providers' },
      {
        id: 'riad',
        label: 'RIAD log',
        hint: 'Risks · issues · actions · decisions',
      },
    ],
  },
  {
    label: 'Funding',
    items: [
      { id: 'claims', label: 'Claims inbox', hint: 'DBE email approve' },
    ],
  },
];

const ALL_REPORTS = REPORT_GROUPS.flatMap((g) => g.items);

type Member = {
  school_profile_id: number;
  name: string;
  emis: string | null;
  province: string | null;
  district: string | null;
  circuit?: string | null;
  quintile: number | null;
  lat: number | null;
  lng: number | null;
  link_status: string;
  learners_enrolled: number;
  learners_verified: number;
  learners_eligible: number;
  meals_served: number;
  meals_planned: number;
  meals_waste: number;
  feeding_days: number;
  po_spend: number;
  approved_brand_pct: number | null;
  prize_score: number | null;
  open_compliance: number;
  verify_pct: number;
  non_approved_receipts: number;
};

type SortKey =
  | 'name'
  | 'learners_enrolled'
  | 'meals_served'
  | 'prize_score'
  | 'approved_brand_pct'
  | 'verify_pct'
  | 'district';

export default function AgencyReportPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

// useSearchParams requires a client boundary; page is already client.

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reportFromUrl = searchParams.get('report') || 'overview';

  const [report, setReportState] = useState<string>(
    ALL_REPORTS.some((r) => r.id === reportFromUrl) ? reportFromUrl : 'overview'
  );
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('ytd', 3)
  );
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [circuit, setCircuit] = useState('');
  const [quintile, setQuintile] = useState('');
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('learners_enrolled');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [riadItems, setRiadItems] = useState<Array<Record<string, unknown>>>(
    []
  );
  const [riadSummary, setRiadSummary] = useState<Record<string, number>>({});
  const [riadLoading, setRiadLoading] = useState(false);
  const [riadTargetFilter, setRiadTargetFilter] = useState('all');
  const [riadStatusFilter, setRiadStatusFilter] = useState('open');
  const [riadQ, setRiadQ] = useState('');

  const setReport = useCallback(
    (id: string) => {
      setReportState(id);
      const params = new URLSearchParams(searchParams.toString());
      if (id === 'overview') params.delete('report');
      else params.set('report', id);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    if (ALL_REPORTS.some((r) => r.id === reportFromUrl) && reportFromUrl !== report) {
      setReportState(reportFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync URL → state only
  }, [reportFromUrl]);

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        from: period.from,
        to: period.to,
        report,
        status: 'active',
      });
      if (province) params.set('province', province);
      if (district) params.set('district', district);
      if (circuit) params.set('circuit', circuit);
      if (quintile) params.set('quintile', quintile);
      const res = await fetch(`/api/schools/agency/report?${params}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.status === 403) {
        setForbidden(true);
        setData(null);
        return;
      }
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData(json);
      if (json.warnings?.[0]) toast.message(String(json.warnings[0]));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [
    companyId,
    period.from,
    period.to,
    report,
    province,
    district,
    circuit,
    quintile,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadRiad = useCallback(async () => {
    setRiadLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        scope: 'agency',
        status: riadStatusFilter,
        target: riadTargetFilter,
      });
      if (riadQ.trim()) params.set('q', riadQ.trim());
      const res = await fetch(`/api/schools/riad?${params}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'RIAD load failed');
      setRiadItems(json.items || []);
      setRiadSummary(json.summary || {});
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'RIAD load failed');
      setRiadItems([]);
    } finally {
      setRiadLoading(false);
    }
  }, [companyId, riadStatusFilter, riadTargetFilter, riadQ]);

  useEffect(() => {
    if (report === 'riad') void loadRiad();
  }, [report, loadRiad]);

  const k = (data?.kpis || {}) as Record<string, number | null>;
  const agency = (data?.agency || {}) as Record<string, string>;
  const members = (data?.members || []) as Member[];
  const byProvince = (data?.byProvince || []) as Array<Record<string, unknown>>;
  const byDistrict = (data?.byDistrict || []) as Array<Record<string, unknown>>;
  const byCircuit = (data?.byCircuit ||
    data?.schoolsByCircuit ||
    []) as Array<Record<string, unknown>>;
  const byQuintile = (data?.byQuintile || []) as Array<Record<string, unknown>>;
  const coverageByProvince = (data?.coverageByProvince ||
    []) as Array<Record<string, unknown>>;
  const coverageByDistrict = (data?.coverageByDistrict ||
    []) as Array<Record<string, unknown>>;
  const ispsByProvince = (data?.ispsByProvince ||
    []) as Array<Record<string, unknown>>;
  const ispsByDistrict = (data?.ispsByDistrict ||
    []) as Array<Record<string, unknown>>;
  const ispList = (data?.isps || []) as Array<Record<string, unknown>>;
  const hierarchyTree = (data?.hierarchyTree || null) as {
    agency?: {
      name?: string;
      type?: string;
      family?: string;
      chain?: string[];
      description?: string;
    };
    totals?: {
      facilities?: number;
      learners?: number;
      isps?: number;
      linked_to_sp?: number;
      unlinked_to_sp?: number;
      provinces?: number;
      districts?: number;
    };
    isps?: Array<{
      isp_profile_id: number;
      name: string;
      status: string;
      facility_count: number;
      facilities: Array<{
        school_profile_id: number;
        name: string;
        member_type: string;
        member_label: string;
        province: string | null;
        district: string | null;
        learners_enrolled: number;
      }>;
      facilities_truncated?: boolean;
    }>;
    unlinked_count?: number;
    unlinked_truncated?: boolean;
    unlinked_by_district?: Array<{
      key: string;
      schools: number;
      learners: number;
    }>;
    unlinked_facilities?: Array<{
      school_profile_id: number;
      name: string;
      member_label: string;
      province: string | null;
      district: string | null;
      learners_enrolled?: number;
    }>;
  } | null;
  const hierarchyMeta = (data?.hierarchy || null) as {
    chain?: string[];
    description?: string;
    facilityPlural?: string;
  } | null;
  const prizeBoard = (data?.prizeLeaderboard || []) as Array<
    Record<string, unknown>
  >;
  const feedingTrend = (data?.feedingTrend || []) as Array<{
    month: string;
    served: number;
    planned: number;
    waste: number;
  }>;
  const risks = (data?.risks || {}) as Record<string, Member[]>;
  const claims = (data?.claims || []) as Array<Record<string, unknown>>;
  const claimsInbox = (data?.claimsInbox || []) as Array<
    Record<string, unknown>
  >;
  const facets = (data?.facets || {
    provinces: [],
    districts: [],
    circuits: [],
    quintiles: [],
  }) as {
    provinces: string[];
    districts: string[];
    circuits?: string[];
    quintiles?: number[];
  };

  const reviewClaim = async (
    claimId: number,
    status: 'approved' | 'rejected' | 'paid'
  ) => {
    const email = window.prompt(
      'Confirm with your official DBE email (must match department contact email on file):'
    );
    if (!email || !email.includes('@')) {
      toast.error('DBE email is required to approve or reject a claim');
      return;
    }
    let notes: string | null = null;
    if (status === 'rejected') {
      notes = window.prompt('Rejection reason (required):');
      if (!notes?.trim()) {
        toast.error('Rejection reason is required');
        return;
      }
    }
    try {
      const res = await fetch('/api/schools/agency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'review_claim',
          claim_id: claimId,
          status,
          approver_email: email.trim(),
          notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Review failed');
      toast.success(json.message || `Claim ${status}`);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const filteredMembers = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let list = members;
    if (qq) {
      list = list.filter((m) => {
        const hay =
          `${m.name} ${m.emis || ''} ${m.province || ''} ${m.district || ''} ${m.circuit || ''}`.toLowerCase();
        return hay.includes(qq);
      });
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === 'name' || sortKey === 'district') {
        return (
          dir *
          String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''))
        );
      }
      const av = Number(a[sortKey] ?? -Infinity);
      const bv = Number(b[sortKey] ?? -Infinity);
      return dir * (av - bv);
    });
  }, [members, q, sortKey, sortDir]);

  const sliceKpis = useMemo(() => {
    const list = filteredMembers;
    const learners = list.reduce((n, m) => n + m.learners_enrolled, 0);
    const meals = list.reduce((n, m) => n + m.meals_served, 0);
    const waste = list.reduce((n, m) => n + m.meals_waste, 0);
    const prizes = list
      .map((m) => m.prize_score)
      .filter((n): n is number => n != null);
    return {
      schools: list.length,
      learners,
      meals,
      wastePct: meals > 0 ? Math.round((waste / meals) * 1000) / 10 : 0,
      avgPrize: prizes.length
        ? Math.round(
            (prizes.reduce((a, b) => a + b, 0) / prizes.length) * 10
          ) / 10
        : null,
      districts: new Set(list.map((m) => m.district).filter(Boolean)).size,
    };
  }, [filteredMembers]);

  const clearFilters = () => {
    setProvince('');
    setDistrict('');
    setCircuit('');
    setQuintile('');
    setQ('');
  };

  const hasFilters = Boolean(
    province || district || circuit || quintile || q.trim()
  );

  const exportCsv = () => {
    // Coverage export when on geo tabs
    if (
      report === 'coverage' ||
      report === 'province' ||
      report === 'district'
    ) {
      const rows =
        report === 'district' ||
        (report === 'coverage' && coverageByDistrict.length)
          ? coverageByDistrict.length
            ? coverageByDistrict
            : byDistrict
          : coverageByProvince.length
            ? coverageByProvince
            : byProvince;
      const lines = [
        'region,schools,learners,verified,meals_served,po_spend,isps,isps_active,isps_pending',
      ];
      for (const r of rows) {
        lines.push(
          [
            csv(String(r.key || '')),
            Number(r.schools ?? r.organisations ?? 0),
            Number(r.learners || 0),
            Number(r.verified || 0),
            Number(r.meals_served || 0),
            Number(r.po_spend || 0),
            Number(r.isps || 0),
            Number(r.isps_active || 0),
            Number(r.isps_pending || 0),
          ].join(',')
        );
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dbe-coverage-${report}-${period.from}_${period.to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (report === 'riad') {
      const lines = [
        'created_at,target_type,subject_name,riad_type,title,status,priority,category,district,emis_or_csd,raised_by_agency,owner',
      ];
      for (const it of riadItems) {
        lines.push(
          [
            csv(String(it.created_at || '')),
            String(it.target_type || ''),
            csv(String(it.subject_name || '')),
            String(it.riad_type || ''),
            csv(String(it.title || '')),
            String(it.status || ''),
            String(it.priority || it.severity || ''),
            csv(String(it.category || '')),
            csv(String(it.district || '')),
            csv(String(it.emis || it.csd_number || '')),
            it.raised_by_agency ? 'yes' : 'no',
            csv(String(it.owner_name || '')),
          ].join(',')
        );
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dbe-riad-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (report === 'isps') {
      const lines = [
        'name,status,provinces,schools_linked,districts_served,compliance',
      ];
      for (const i of ispList) {
        lines.push(
          [
            csv(String(i.name || '')),
            String(i.status || ''),
            csv(
              Array.isArray(i.provinces)
                ? (i.provinces as string[]).join('; ')
                : ''
            ),
            Number(i.schools_linked || 0),
            csv(
              Array.isArray(i.districts_served)
                ? (i.districts_served as string[]).join('; ')
                : ''
            ),
            String(i.compliance_status || ''),
          ].join(',')
        );
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dbe-isps-${period.from}_${period.to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const lines = [
      'name,emis,province,district,quintile,learners,verified,eligible,verify_pct,meals_served,meals_waste,po_spend,approved_brand_pct,prize_score,open_compliance',
    ];
    for (const m of filteredMembers) {
      lines.push(
        [
          csv(m.name),
          m.emis || '',
          m.province || '',
          m.district || '',
          m.quintile ?? '',
          m.learners_enrolled,
          m.learners_verified,
          m.learners_eligible,
          m.verify_pct,
          m.meals_served,
          m.meals_waste,
          m.po_spend,
          m.approved_brand_pct ?? '',
          m.prize_score ?? '',
          m.open_compliance,
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dbe-agency-report-${period.from}_${period.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (forbidden) {
    return (
      <SchoolsPage>
        <SchoolsHeader
          title="Agency reports"
          titleAccent="DBE only"
          description="Register this company as a DBE / PEU agency first."
        />
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-10 text-center">
          <Landmark className="w-10 h-10 text-amber-600 mx-auto mb-3" />
          <p className="font-bold text-slate-900">Not registered as an agency</p>
          <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
            Open DBE &amp; agencies, register as Department of Basic Education
            (or PEU), approve schools that join, then return for programme-wide
            reports.
          </p>
          <Link
            href="/dashboard/schools/agency"
            className="btn-primary !py-2 !px-4 text-sm mt-4 inline-flex"
          >
            Go to DBE / agencies →
          </Link>
        </div>
      </SchoolsPage>
    );
  }

  const activeReportMeta =
    ALL_REPORTS.find((r) => r.id === report) || ALL_REPORTS[0];

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Programme reports"
        titleAccent={agency.name || 'DBE'}
        description={
          hierarchyMeta?.chain
            ? `${hierarchyMeta.chain.join(' → ')} · slice by period, province, district, circuit, quintile · ${period.label}`
            : `Slice & dice schools, coverage, feeding, claims and SPs · ${period.label}`
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/schools/registry-report"
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              School register
            </Link>
            <button
              type="button"
              onClick={exportCsv}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        }
      />

      {/* Report picker — grouped */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {REPORT_GROUPS.map((g) => (
            <div key={g.label} className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1.5 px-1">
                {g.label}
              </p>
              <div className="flex flex-wrap gap-1">
                {g.items.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    title={r.hint || r.label}
                    onClick={() => setReport(r.id)}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                      report === r.id
                        ? 'border-sky-600 bg-sky-600 text-white shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 hover:bg-white'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 px-1 text-[11px] text-slate-500">
          Viewing <strong className="text-slate-800">{activeReportMeta.label}</strong>
          {activeReportMeta.hint ? ` — ${activeReportMeta.hint}` : ''}. Use
          slicers below to filter the whole programme.
        </p>
      </div>

      {/* Slice & dice bar */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="flex items-center gap-2 mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
          <Filter className="w-3.5 h-3.5" /> Slice &amp; dice
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="min-w-[140px] flex-1 sm:flex-none">
            <PeriodSlicer
              value={period}
              onChange={setPeriod}
              showTrailing
              className="!mb-0"
            />
          </div>
          <label className="text-[10px] font-bold uppercase text-slate-400">
            Province
            <select
              value={province}
              onChange={(e) => {
                setProvince(e.target.value);
                setDistrict('');
                setCircuit('');
              }}
              className="mt-0.5 block w-full min-w-[9rem] rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm"
            >
              <option value="">All</option>
              {facets.provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase text-slate-400">
            District
            <select
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                setCircuit('');
              }}
              className="mt-0.5 block w-full min-w-[9rem] rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm"
            >
              <option value="">All</option>
              {facets.districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase text-slate-400">
            Circuit
            <select
              value={circuit}
              onChange={(e) => setCircuit(e.target.value)}
              className="mt-0.5 block w-full min-w-[8rem] rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm"
            >
              <option value="">All</option>
              {(facets.circuits || []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase text-slate-400">
            Quintile
            <select
              value={quintile}
              onChange={(e) => setQuintile(e.target.value)}
              className="mt-0.5 block w-full min-w-[5rem] rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm"
            >
              <option value="">All</option>
              {(facets.quintiles || [1, 2, 3, 4, 5]).map((qn) => (
                <option key={qn} value={String(qn)}>
                  Q{qn}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase text-slate-400 flex-1 min-w-[10rem]">
            Search
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="School, EMIS, circuit…"
              className="mt-0.5 block w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm"
            />
          </label>
          <label className="text-[10px] font-bold uppercase text-slate-400">
            Sort schools
            <select
              value={`${sortKey}:${sortDir}`}
              onChange={(e) => {
                const [k, d] = e.target.value.split(':') as [SortKey, 'asc' | 'desc'];
                setSortKey(k);
                setSortDir(d);
              }}
              className="mt-0.5 block w-full min-w-[10rem] rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm"
            >
              <option value="learners_enrolled:desc">Learners ↓</option>
              <option value="learners_enrolled:asc">Learners ↑</option>
              <option value="meals_served:desc">Meals ↓</option>
              <option value="prize_score:desc">Prize ↓</option>
              <option value="approved_brand_pct:desc">Approved % ↓</option>
              <option value="verify_pct:desc">Verify % ↓</option>
              <option value="name:asc">Name A–Z</option>
              <option value="district:asc">District A–Z</option>
            </select>
          </label>
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          ) : null}
        </div>
        {hasFilters || q.trim() ? (
          <p className="mt-2 text-[11px] text-slate-600">
            Filtered view:{' '}
            <strong>{sliceKpis.schools.toLocaleString('en-ZA')}</strong> schools
            · <strong>{sliceKpis.learners.toLocaleString('en-ZA')}</strong>{' '}
            learners ·{' '}
            <strong>{sliceKpis.districts.toLocaleString('en-ZA')}</strong>{' '}
            districts
            {sliceKpis.meals > 0
              ? ` · ${sliceKpis.meals.toLocaleString('en-ZA')} meals`
              : ''}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Kpi
              icon={School}
              label="Schools (filtered)"
              value={String(
                hasFilters || q.trim()
                  ? sliceKpis.schools
                  : k.organisations ?? members.length ?? 0
              )}
              sub={
                hasFilters || q.trim()
                  ? `${sliceKpis.districts} districts in slice`
                  : `${k.schools ?? 0} on programme`
              }
            />
            <Kpi
              icon={Truck}
              label="SPs"
              value={String(k.isps ?? ispList.length ?? 0)}
              sub={`${k.isps_active ?? 0} active · ${k.isps_pending ?? 0} pending`}
              tone="emerald"
            />
            <Kpi
              icon={Users}
              label="Learners"
              value={String(
                hasFilters || q.trim()
                  ? sliceKpis.learners
                  : k.totalLearners ?? 0
              )}
              sub={`${k.totalVerified ?? 0} verified · avg ${k.avgVerifyPct ?? '—'}%`}
            />
            <Kpi
              icon={UtensilsCrossed}
              label="Meals served"
              value={String(k.mealsServed ?? 0)}
              sub={`Waste ${k.wastePct ?? 0}%`}
              tone="emerald"
            />
            <Kpi
              icon={Trophy}
              label="Avg prize score"
              value={
                k.avgPrizeScore != null ? String(k.avgPrizeScore) : '—'
              }
              sub={`Approved brand avg ${k.avgApprovedBrandPct ?? '—'}%`}
              tone="amber"
            />
            <Kpi
              icon={Wallet}
              label="Claims inbox"
              value={String(k.submittedClaims ?? claimsInbox.length ?? 0)}
              sub={`${k.totalClaims ?? claims.length} total packs`}
              tone="amber"
            />
            <Kpi
              icon={Wallet}
              label="PO spend"
              value={formatMoney(Number(k.poSpend || 0))}
              sub={`${k.poCount ?? 0} orders`}
            />
            <Kpi
              icon={AlertTriangle}
              label="Open compliance"
              value={String(k.openCompliance ?? 0)}
              sub={`${k.nonApprovedReceipts ?? 0} non-approved GRNs`}
              tone="amber"
            />
            <Kpi
              icon={MapPinned}
              label="GPS mapped"
              value={String(k.withGps ?? 0)}
              sub="Schools with coordinates"
            />
            <Kpi
              icon={Users}
              label="NSNP eligible"
              value={String(k.totalEligible ?? 0)}
              sub={`${k.totalStaff ?? 0} staff on books`}
            />
          </div>

          {(report === 'claims' ||
            (report === 'overview' && claimsInbox.length > 0)) && (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden mb-6">
              <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  {report === 'claims'
                    ? 'All claim packs'
                    : `Claims awaiting review (${claimsInbox.length})`}
                </span>
                {report !== 'claims' ? (
                  <button
                    type="button"
                    onClick={() => setReport('claims')}
                    className="text-[11px] font-bold text-[#0077b6]"
                  >
                    Full inbox →
                  </button>
                ) : null}
              </div>
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-3">School</th>
                    <th className="px-3 py-3">Period</th>
                    <th className="px-3 py-3 text-right">Meals</th>
                    <th className="px-3 py-3 text-right">Claim</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(report === 'claims' ? claims : claimsInbox).length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No claim packs yet. Schools submit under Claims after
                        serve-day logging.
                      </td>
                    </tr>
                  ) : (
                    (report === 'claims' ? claims : claimsInbox).map((c) => (
                      <tr
                        key={String(c.id)}
                        className="border-b border-slate-50"
                      >
                        <td className="px-4 py-3 font-semibold">
                          {String(c.school_name || 'School')}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          {String(c.period_from)} → {String(c.period_to)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold">
                          {String(c.meals_served ?? '—')}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold">
                          {formatMoney(Number(c.claim_amount || 0))}
                        </td>
                        <td className="px-3 py-3 capitalize text-xs font-bold">
                          {String(c.status)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {c.status === 'submitted' ? (
                            <div className="inline-flex gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  void reviewClaim(Number(c.id), 'approved')
                                }
                                className="text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void reviewClaim(Number(c.id), 'paid')
                                }
                                className="text-[10px] font-bold px-2 py-1 rounded-md bg-sky-50 text-sky-800 border border-sky-200"
                              >
                                Paid
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void reviewClaim(Number(c.id), 'rejected')
                                }
                                className="text-[10px] font-bold px-2 py-1 rounded-md bg-rose-50 text-rose-800 border border-rose-200"
                              >
                                Reject
                              </button>
                            </div>
                          ) : c.status === 'approved' ? (
                            <button
                              type="button"
                              onClick={() =>
                                void reviewClaim(Number(c.id), 'paid')
                              }
                              className="text-[10px] font-bold px-2 py-1 rounded-md bg-sky-50 text-sky-800 border border-sky-200"
                            >
                              Mark paid
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {(report === 'overview' || report === 'members') && (
            <MemberTable members={filteredMembers} />
          )}

          {report === 'hierarchy' && (
            <HierarchyView
              tree={hierarchyTree}
              meta={hierarchyMeta}
              agencyName={String(agency.name || 'Agency')}
            />
          )}

          {report === 'coverage' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-slate-700">
                <strong>Coverage report:</strong> schools associated with your
                department by province/district, plus SPs that joined you
                (province from SP service areas; district from schools they
                supply in your network).
              </div>
              <CoverageTable
                title="Schools & SPs by province"
                rows={
                  coverageByProvince.length ? coverageByProvince : byProvince
                }
                keyLabel="Province"
              />
              <CoverageTable
                title="Schools & SPs by district"
                rows={
                  coverageByDistrict.length ? coverageByDistrict : byDistrict
                }
                keyLabel="District"
              />
              <div className="grid lg:grid-cols-2 gap-4">
                <IspCountTable
                  title="SPs by province (service area)"
                  rows={ispsByProvince}
                  keyLabel="Province"
                />
                <IspCountTable
                  title="SPs by district (schools they supply)"
                  rows={ispsByDistrict}
                  keyLabel="District"
                />
              </div>
              <GroupTable
                title="Schools by province (detail)"
                rows={byProvince}
                keyLabel="Province"
              />
              <GroupTable
                title="Schools by district (detail)"
                rows={byDistrict}
                keyLabel="District"
              />
            </div>
          )}

          {report === 'province' && (
            <div className="space-y-6">
              <CoverageTable
                title="Province coverage · schools + SPs"
                rows={
                  coverageByProvince.length ? coverageByProvince : byProvince
                }
                keyLabel="Province"
              />
              <GroupTable
                title="Schools by province"
                rows={byProvince}
                keyLabel="Province"
              />
              <IspCountTable
                title="SPs by province"
                rows={ispsByProvince}
                keyLabel="Province"
              />
            </div>
          )}
          {report === 'district' && (
            <div className="space-y-6">
              <CoverageTable
                title="District coverage · schools + SPs"
                rows={
                  coverageByDistrict.length ? coverageByDistrict : byDistrict
                }
                keyLabel="District"
              />
              <GroupTable
                title="Schools by district"
                rows={byDistrict}
                keyLabel="District"
              />
              <IspCountTable
                title="SPs by district (from school links)"
                rows={ispsByDistrict}
                keyLabel="District"
              />
            </div>
          )}
          {report === 'circuit' && (
            <GroupTable
              title="Schools by circuit"
              rows={byCircuit}
              keyLabel="Circuit"
            />
          )}
          {report === 'isps' && (
            <IspDirectoryTable isps={ispList} byProvince={ispsByProvince} />
          )}
          {report === 'riad' && (
            <AgencyRiadReport
              items={riadItems}
              summary={riadSummary}
              loading={riadLoading}
              targetFilter={riadTargetFilter}
              statusFilter={riadStatusFilter}
              q={riadQ}
              onTargetFilter={setRiadTargetFilter}
              onStatusFilter={setRiadStatusFilter}
              onQ={setRiadQ}
              onRefresh={() => void loadRiad()}
              companyId={companyId}
            />
          )}
          {report === 'quintile' && (
            <GroupTable
              title="By quintile"
              rows={byQuintile}
              keyLabel="Quintile"
            />
          )}

          {report === 'prizes' && (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Prize leaderboard (approved members)
              </div>
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-3">#</th>
                    <th className="px-3 py-3">School</th>
                    <th className="px-3 py-3">Province</th>
                    <th className="px-3 py-3 text-right">Learners</th>
                    <th className="px-3 py-3 text-right">Approved %</th>
                    <th className="px-3 py-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {prizeBoard.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No prize scores yet across approved members.
                      </td>
                    </tr>
                  ) : (
                    prizeBoard.map((b) => (
                      <tr
                        key={String(b.rank)}
                        className="border-b border-slate-50"
                      >
                        <td className="px-4 py-2 font-black">{String(b.rank)}</td>
                        <td className="px-3 py-2 font-semibold">
                          {String(b.name)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {[b.district, b.province]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(b.learners_enrolled || 0)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {b.approved_brand_pct != null
                            ? `${Number(b.approved_brand_pct).toFixed(0)}%`
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-black tabular-nums">
                          {b.prize_score != null
                            ? Number(b.prize_score).toFixed(1)
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {report === 'feeding' && (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500">
                Network feeding trend
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-3">Month</th>
                    <th className="px-3 py-3 text-right">Planned</th>
                    <th className="px-3 py-3 text-right">Served</th>
                    <th className="px-3 py-3 text-right">Waste</th>
                  </tr>
                </thead>
                <tbody>
                  {feedingTrend.map((t) => (
                    <tr key={t.month} className="border-b border-slate-50">
                      <td className="px-4 py-2 font-mono text-xs font-bold">
                        {t.month}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {t.planned}
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">
                        {t.served}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {t.waste}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report === 'risks' && (
            <div className="grid lg:grid-cols-2 gap-4">
              <RiskCard
                title="Low learner verification"
                items={risks.lowVerify || []}
                primary={(m) => `${m.verify_pct}% verified`}
              />
              <RiskCard
                title="Low approved-brand compliance"
                items={risks.lowApprovedBrand || []}
                primary={(m) =>
                  m.approved_brand_pct != null
                    ? `${m.approved_brand_pct}%`
                    : '—'
                }
              />
              <RiskCard
                title="High waste"
                items={risks.highWaste || []}
                primary={(m) =>
                  m.meals_served
                    ? `${Math.round((m.meals_waste / m.meals_served) * 100)}% waste`
                    : '—'
                }
              />
              <RiskCard
                title="Open compliance items"
                items={risks.openCompliance || []}
                primary={(m) => `${m.open_compliance} open`}
              />
              <RiskCard
                title="No feeding logged in period"
                items={risks.noFeedingLogged || []}
                primary={() => '0 days'}
              />
            </div>
          )}

          {report === 'map' && (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500">
                Locations ({filteredMembers.filter((m) => m.lat != null).length}{' '}
                with GPS)
              </div>
              <ul className="divide-y max-h-[480px] overflow-y-auto">
                {filteredMembers.map((m) => (
                  <li
                    key={m.school_profile_id}
                    className="px-4 py-3 flex justify-between gap-2 text-sm"
                  >
                    <div>
                      <p className="font-semibold">{m.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {[m.district, m.province].filter(Boolean).join(' · ')}
                        {' · '}
                        {m.learners_enrolled} learners
                      </p>
                    </div>
                    {m.lat != null && m.lng != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${m.lat},${m.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-[#0077b6] hover:underline shrink-0"
                      >
                        Map →
                      </a>
                    ) : (
                      <span className="text-[10px] text-slate-400">No GPS</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </SchoolsPage>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'emerald' | 'amber';
}) {
  const bg =
    tone === 'emerald'
      ? 'border-emerald-100 bg-emerald-50/40'
      : tone === 'amber'
        ? 'border-amber-100 bg-amber-50/40'
        : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-3xl border p-4 ${bg}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400">
        <Icon className="w-3.5 h-3.5 text-[#00b4d8]" />
        {label}
      </div>
      <div className="text-xl font-black tabular-nums mt-0.5 break-all">
        {value}
      </div>
      {sub ? (
        <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>
      ) : null}
    </div>
  );
}

function MemberTable({ members }: { members: Member[] }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <span>Schools in current slice · {members.length.toLocaleString('en-ZA')}</span>
        <span className="text-[10px] font-semibold normal-case text-slate-400">
          Sorted via Slice &amp; dice controls
        </span>
      </div>
      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[960px]">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
              <th className="px-4 py-3">School</th>
              <th className="px-3 py-3">EMIS</th>
              <th className="px-3 py-3">District / circuit</th>
              <th className="px-3 py-3">Q</th>
              <th className="px-3 py-3 text-right">Learners</th>
              <th className="px-3 py-3 text-right">Verified %</th>
              <th className="px-3 py-3 text-right">Meals</th>
              <th className="px-3 py-3 text-right">PO spend</th>
              <th className="px-3 py-3 text-right">Approved %</th>
              <th className="px-3 py-3 text-right">Prize</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  No schools in this filter. Clear slicers or approve joins
                  under Join &amp; add.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr
                  key={m.school_profile_id}
                  className="border-b border-slate-50 hover:bg-sky-50/40"
                >
                  <td className="px-4 py-2.5 font-semibold max-w-[220px]">
                    {m.name}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    {m.emis || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {[m.district, m.circuit, m.province]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs tabular-nums">
                    {m.quintile != null ? `Q${m.quintile}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {m.learners_enrolled.toLocaleString('en-ZA')}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {m.verify_pct}%
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold">
                    {m.meals_served}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatMoney(m.po_spend)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {m.approved_brand_pct != null
                      ? `${m.approved_brand_pct}%`
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-black tabular-nums">
                    {m.prize_score != null ? m.prize_score.toFixed(1) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HierarchyView({
  tree,
  meta,
  agencyName,
}: {
  tree: {
    agency?: {
      name?: string;
      type?: string;
      family?: string;
      chain?: string[];
      description?: string;
    };
    totals?: {
      facilities?: number;
      learners?: number;
      isps?: number;
      linked_to_sp?: number;
      unlinked_to_sp?: number;
      provinces?: number;
      districts?: number;
    };
    isps?: Array<{
      isp_profile_id: number;
      name: string;
      status: string;
      facility_count: number;
      facilities: Array<{
        school_profile_id: number;
        name: string;
        member_type: string;
        member_label: string;
        province: string | null;
        district: string | null;
        learners_enrolled: number;
      }>;
      facilities_truncated?: boolean;
    }>;
    unlinked_count?: number;
    unlinked_truncated?: boolean;
    unlinked_by_district?: Array<{
      key: string;
      schools: number;
      learners: number;
    }>;
    unlinked_facilities?: Array<{
      school_profile_id: number;
      name: string;
      member_label: string;
      province: string | null;
      district: string | null;
      learners_enrolled?: number;
    }>;
  } | null;
  meta: {
    chain?: string[];
    description?: string;
    facilityPlural?: string;
  } | null;
  agencyName: string;
}) {
  const chain = tree?.agency?.chain || meta?.chain || [
    'Agency',
    'SPs',
    'Facilities',
  ];
  const isps = tree?.isps || [];
  const unlinked = tree?.unlinked_facilities || [];
  const unlinkedCount = tree?.unlinked_count ?? unlinked.length;
  const totals = tree?.totals || {};
  const byDistrict = tree?.unlinked_by_district || [];

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5">
        <p className="text-[10px] font-bold uppercase text-violet-700 mb-2">
          Chain of association
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-900">
          {chain.map((step, i) => (
            <span key={step} className="inline-flex items-center gap-2">
              {i > 0 ? (
                <span className="text-violet-400 font-normal">→</span>
              ) : null}
              <span className="rounded-xl bg-white border border-violet-100 px-3 py-1.5 shadow-sm">
                {step}
              </span>
            </span>
          ))}
        </div>
        <p className="text-sm text-slate-600 mt-3 max-w-2xl">
          {tree?.agency?.description ||
            meta?.description ||
            'Agency approves SPs and facilities. Facilities order only from SPs under the same agency.'}
        </p>
        {totals.facilities != null ? (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-xl bg-white border border-violet-100 px-3 py-2">
              <p className="text-[10px] font-bold uppercase text-slate-400">
                Schools linked
              </p>
              <p className="text-xl font-black tabular-nums">
                {Number(totals.facilities).toLocaleString('en-ZA')}
              </p>
            </div>
            <div className="rounded-xl bg-white border border-violet-100 px-3 py-2">
              <p className="text-[10px] font-bold uppercase text-slate-400">
                Learners
              </p>
              <p className="text-xl font-black tabular-nums">
                {Number(totals.learners || 0).toLocaleString('en-ZA')}
              </p>
            </div>
            <div className="rounded-xl bg-white border border-violet-100 px-3 py-2">
              <p className="text-[10px] font-bold uppercase text-slate-400">
                Districts
              </p>
              <p className="text-xl font-black tabular-nums">
                {Number(totals.districts || 0).toLocaleString('en-ZA')}
              </p>
            </div>
            <div className="rounded-xl bg-white border border-violet-100 px-3 py-2">
              <p className="text-[10px] font-bold uppercase text-slate-400">
                SPs
              </p>
              <p className="text-xl font-black tabular-nums">
                {Number(totals.isps || 0).toLocaleString('en-ZA')}
              </p>
            </div>
          </div>
        ) : null}
        <p className="text-xs text-slate-500 mt-3">
          Full school directory with municipalities &amp; enrolments:{' '}
          <Link
            href="/dashboard/schools/registry-report"
            className="font-bold text-[#0077b6] hover:underline"
          >
            School register report →
          </Link>
        </p>
      </div>

      {/* Level 1: Agency */}
      <div className="rounded-3xl border-2 border-violet-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-violet-50 border-b border-violet-100 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-violet-700" />
          <span className="text-xs font-bold uppercase text-violet-900">
            1 · Department
          </span>
        </div>
        <div className="px-5 py-4">
          <p className="font-black text-lg text-slate-900">
            {tree?.agency?.name || agencyName}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Type: {String(tree?.agency?.type || '—')} · Family:{' '}
            {String(tree?.agency?.family || '—')} ·{' '}
            {Number(totals.facilities || 0).toLocaleString('en-ZA')} schools
          </p>
        </div>
      </div>

      {/* Level 2: SPs */}
      <div className="rounded-3xl border-2 border-amber-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
          <Truck className="w-4 h-4 text-amber-700" />
          <span className="text-xs font-bold uppercase text-amber-900">
            2 · SPs · {isps.length} associated
          </span>
        </div>
        {isps.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            No SPs have joined this department yet. SPs request association
            under Schools → SPs, then you approve them.
          </p>
        ) : (
          <ul className="divide-y">
            {isps.map((isp) => (
              <li key={isp.isp_profile_id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <p className="font-bold text-slate-900">{isp.name}</p>
                    <p className="text-[11px] font-bold uppercase text-slate-500">
                      {isp.status} · supplies {isp.facility_count}{' '}
                      {meta?.facilityPlural?.toLowerCase() || 'facilities'}
                    </p>
                  </div>
                </div>
                {isp.facilities.length === 0 ? (
                  <p className="text-xs text-slate-400 pl-3 border-l-2 border-slate-100">
                    No linked {meta?.facilityPlural?.toLowerCase() || 'facilities'}{' '}
                    yet under this SP.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5 pl-3 border-l-2 border-sky-200">
                    {isp.facilities.map((f) => (
                      <li
                        key={f.school_profile_id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span className="font-semibold text-slate-800 inline-flex items-center gap-1.5">
                          <School className="w-3.5 h-3.5 text-sky-600" />
                          {f.name}
                          <span className="text-[10px] font-bold uppercase text-slate-400">
                            {f.member_label}
                          </span>
                        </span>
                        <span className="text-xs text-slate-500">
                          {[f.district, f.province].filter(Boolean).join(', ') ||
                            '—'}
                          {f.learners_enrolled
                            ? ` · ${f.learners_enrolled.toLocaleString('en-ZA')} learners`
                            : ''}
                        </span>
                      </li>
                    ))}
                    {isp.facilities_truncated ? (
                      <li className="text-xs text-slate-400 pl-1">
                        … and more under this SP (full list on School register)
                      </li>
                    ) : null}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Level 3: facilities under agency (not yet on an SP) */}
      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase text-slate-500">
            3 · Schools on your programme not yet linked to an SP (
            {unlinkedCount.toLocaleString('en-ZA')})
          </span>
          <Link
            href="/dashboard/schools/registry-report"
            className="text-xs font-bold text-[#0077b6] hover:underline"
          >
            Open full school register →
          </Link>
        </div>
        {byDistrict.length > 0 ? (
          <div className="px-5 py-3 border-b bg-slate-50/80">
            <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">
              By district
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
              {byDistrict.map((d) => (
                <div
                  key={d.key}
                  className="flex justify-between gap-2 text-xs rounded-lg bg-white border border-slate-100 px-2 py-1.5"
                >
                  <span className="font-semibold text-slate-800 truncate">
                    {d.key}
                  </span>
                  <span className="tabular-nums text-slate-600 shrink-0">
                    {d.schools.toLocaleString('en-ZA')} ·{' '}
                    {d.learners.toLocaleString('en-ZA')} learners
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {unlinked.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            {unlinkedCount === 0
              ? 'Every approved school is linked to an SP, or no schools yet.'
              : 'See district breakdown above and the school register for the full list.'}
          </p>
        ) : (
          <>
            <p className="px-5 py-2 text-[11px] text-slate-500 border-b">
              Sample of {unlinked.length.toLocaleString('en-ZA')}
              {tree?.unlinked_truncated
                ? ` (of ${unlinkedCount.toLocaleString('en-ZA')})`
                : ''}
            </p>
            <ul className="divide-y max-h-64 overflow-y-auto">
              {unlinked.map((f) => (
                <li
                  key={f.school_profile_id}
                  className="px-5 py-2.5 flex justify-between text-sm gap-2"
                >
                  <span className="font-semibold">
                    {f.name}{' '}
                    <span className="text-[10px] uppercase text-slate-400 font-bold">
                      {f.member_label}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {[f.district, f.province].filter(Boolean).join(', ') || '—'}
                    {f.learners_enrolled
                      ? ` · ${Number(f.learners_enrolled).toLocaleString('en-ZA')}`
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function GroupTable({
  title,
  rows,
  keyLabel,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  keyLabel: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500">
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
              <th className="px-4 py-3">{keyLabel}</th>
              <th className="px-3 py-3 text-right">Schools</th>
              <th className="px-3 py-3 text-right">Learners</th>
              <th className="px-3 py-3 text-right">Verified</th>
              <th className="px-3 py-3 text-right">Meals</th>
              <th className="px-3 py-3 text-right">PO spend</th>
              <th className="px-3 py-3 text-right">Avg prize</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  No schools in this view yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={String(r.key)} className="border-b border-slate-50">
                  <td className="px-4 py-2 font-semibold">{String(r.key)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-black">
                    {Number(r.schools ?? r.organisations ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Number(r.learners || 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Number(r.verified || 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Number(r.meals_served || 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold">
                    {formatMoney(Number(r.po_spend || 0))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.avg_prize != null ? Number(r.avg_prize).toFixed(1) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CoverageTable({
  title,
  rows,
  keyLabel,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  keyLabel: string;
}) {
  return (
    <div className="rounded-3xl border border-emerald-100 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-emerald-50 bg-emerald-50/40 text-xs font-bold uppercase text-emerald-900 flex items-center gap-2">
        <MapPinned className="w-3.5 h-3.5" />
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
              <th className="px-4 py-3">{keyLabel}</th>
              <th className="px-3 py-3 text-right">Schools</th>
              <th className="px-3 py-3 text-right">Learners</th>
              <th className="px-3 py-3 text-right">SPs</th>
              <th className="px-3 py-3 text-right">SPs active</th>
              <th className="px-3 py-3 text-right">SPs pending</th>
              <th className="px-3 py-3 text-right">Meals</th>
              <th className="px-3 py-3 text-right">PO spend</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  No geographic coverage data yet. Approve school and SP
                  associations first.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={String(r.key)} className="border-b border-slate-50">
                  <td className="px-4 py-2 font-semibold">{String(r.key)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-black text-sky-900">
                    {Number(r.schools ?? r.organisations ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Number(r.learners || 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-black text-emerald-900">
                    {Number(r.isps || 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Number(r.isps_active || 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-800">
                    {Number(r.isps_pending || 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Number(r.meals_served || 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold">
                    {formatMoney(Number(r.po_spend || 0))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IspCountTable({
  title,
  rows,
  keyLabel,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  keyLabel: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
        <Truck className="w-3.5 h-3.5 text-emerald-600" />
        {title}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
            <th className="px-4 py-3">{keyLabel}</th>
            <th className="px-3 py-3 text-right">SPs</th>
            <th className="px-3 py-3 text-right">Active</th>
            <th className="px-3 py-3 text-right">Pending</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                No SPs associated yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={String(r.key)} className="border-b border-slate-50">
                <td className="px-4 py-2 font-semibold">{String(r.key)}</td>
                <td className="px-3 py-2 text-right font-black tabular-nums">
                  {Number(r.isps || 0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-800">
                  {Number(r.isps_active || 0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-800">
                  {Number(r.isps_pending || 0)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function IspDirectoryTable({
  isps,
  byProvince,
}: {
  isps: Array<Record<string, unknown>>;
  byProvince: Array<Record<string, unknown>>;
}) {
  return (
    <div className="space-y-4">
      <IspCountTable
        title="SPs per province"
        rows={byProvince}
        keyLabel="Province"
      />
      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500">
          SP directory · associated with this department
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                <th className="px-4 py-3">SP</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Provinces</th>
                <th className="px-3 py-3 text-right">Schools linked</th>
                <th className="px-3 py-3">Districts served</th>
              </tr>
            </thead>
            <tbody>
              {isps.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No SPs have requested to join this department yet.
                  </td>
                </tr>
              ) : (
                isps.map((i) => (
                  <tr
                    key={String(i.isp_profile_id)}
                    className="border-b border-slate-50"
                  >
                    <td className="px-4 py-2 font-semibold">
                      {String(i.name)}
                    </td>
                    <td className="px-3 py-2 text-xs font-bold uppercase">
                      <span
                        className={
                          i.status === 'active'
                            ? 'text-emerald-800'
                            : i.status === 'pending'
                              ? 'text-amber-800'
                              : 'text-slate-500'
                        }
                      >
                        {String(i.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {Array.isArray(i.provinces) && i.provinces.length
                        ? (i.provinces as string[]).join(', ')
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-black">
                      {Number(i.schools_linked || 0)}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 max-w-xs">
                      {Array.isArray(i.districts_served) &&
                      (i.districts_served as string[]).length
                        ? (i.districts_served as string[]).join(' · ')
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RiskCard({
  title,
  items,
  primary,
}: {
  title: string;
  items: Member[];
  primary: (m: Member) => string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-black flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">None flagged</p>
      ) : (
        <ol className="space-y-2 text-sm">
          {items.map((m, i) => (
            <li
              key={m.school_profile_id}
              className="flex justify-between gap-2 border-b border-slate-50 pb-1.5"
            >
              <span className="font-semibold truncate">
                {i + 1}. {m.name}
              </span>
              <span className="text-xs font-bold tabular-nums shrink-0">
                {primary(m)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function csv(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function AgencyRiadReport({
  items,
  summary,
  loading,
  targetFilter,
  statusFilter,
  q,
  onTargetFilter,
  onStatusFilter,
  onQ,
  onRefresh,
  companyId,
}: {
  items: Array<Record<string, unknown>>;
  summary: Record<string, number>;
  loading: boolean;
  targetFilter: string;
  statusFilter: string;
  q: string;
  onTargetFilter: (v: string) => void;
  onStatusFilter: (v: string) => void;
  onQ: (v: string) => void;
  onRefresh: () => void;
  companyId: number;
}) {
  const [statusBusy, setStatusBusy] = useState<number | null>(null);

  const patchStatus = async (id: number, status: string) => {
    setStatusBusy(id);
    try {
      const res = await fetch('/api/schools/riad', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          id,
          status,
          resolution: status === 'resolved' ? 'Closed by DBE' : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      toast.success(status === 'resolved' ? 'RIAD closed' : 'Status updated');
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setStatusBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-sm text-rose-950">
        <strong>Programme RIAD log</strong> — risks, issues, actions and
        decisions raised by DBE against schools/SPs, plus feedback logged by
        schools and service providers under your department. Raise new RIADs
        from{' '}
        <Link
          href="/dashboard/schools/registry-report"
          className="font-bold underline underline-offset-2"
        >
          School register
        </Link>{' '}
        or{' '}
        <Link
          href="/dashboard/schools/sp-register"
          className="font-bold underline underline-offset-2"
        >
          Service providers
        </Link>
        .
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {[
          { label: 'Total', value: summary.total ?? items.length },
          { label: 'Open', value: summary.open ?? 0 },
          { label: 'In progress', value: summary.inProgress ?? 0 },
          { label: 'Closed', value: summary.closed ?? 0 },
          { label: 'Critical', value: summary.critical ?? 0 },
          { label: 'Schools', value: summary.schools ?? 0 },
          { label: 'SPs', value: summary.isps ?? 0 },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
          >
            <p className="text-[10px] font-bold uppercase text-slate-400">
              {k.label}
            </p>
            <p className="text-xl font-black tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs font-semibold text-slate-600">
          Target
          <select
            className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            value={targetFilter}
            onChange={(e) => onTargetFilter(e.target.value)}
          >
            <option value="all">Schools + SPs</option>
            <option value="school">Schools only</option>
            <option value="isp">SPs only</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Status
          <select
            className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            value={statusFilter}
            onChange={(e) => onStatusFilter(e.target.value)}
          >
            <option value="open">Open (not closed)</option>
            <option value="all">All</option>
            <option value="in_progress">In progress</option>
            <option value="closed">Closed</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 flex-1 min-w-[160px]">
          Search
          <input
            className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            placeholder="Subject, title, EMIS, CSD…"
            value={q}
            onChange={(e) => onQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRefresh();
            }}
          />
        </label>
        <button
          type="button"
          onClick={onRefresh}
          className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          RIAD entries · {items.length}
        </div>
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50 text-left text-[10px] font-bold uppercase text-slate-400 sticky top-0">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      No RIAD entries for this filter. Raise one from the school
                      or SP register.
                    </td>
                  </tr>
                ) : (
                  items.map((it) => {
                    const id = Number(it.id);
                    const st = String(it.status || 'open');
                    const closed = ['closed', 'resolved', 'done'].includes(
                      st.toLowerCase()
                    );
                    return (
                      <tr
                        key={id}
                        className="border-t border-slate-50 hover:bg-slate-50/60 align-top"
                      >
                        <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                          {it.created_at
                            ? new Date(String(it.created_at)).toLocaleString(
                                'en-ZA'
                              )
                            : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-[10px] font-bold uppercase ${
                              String(it.target_type) === 'isp'
                                ? 'text-emerald-700'
                                : 'text-sky-700'
                            }`}
                          >
                            {String(it.target_type) === 'isp'
                              ? 'SP'
                              : String(it.target_type) === 'school'
                                ? 'School'
                                : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-semibold">
                            {String(it.subject_name || '—')}
                          </span>
                          <span className="block text-[10px] text-slate-500 font-mono">
                            {it.emis
                              ? `EMIS/NATEMIS ${String(it.emis)}`
                              : it.csd_number
                                ? `CSD ${String(it.csd_number)}`
                                : it.district
                                  ? String(it.district)
                                  : ''}
                          </span>
                        </td>
                        <td className="px-3 py-2 capitalize text-xs font-bold">
                          {String(it.riad_type || '—')}
                        </td>
                        <td className="px-3 py-2 max-w-[240px]">
                          <span className="font-medium">{String(it.title)}</span>
                          {it.category ? (
                            <span className="block text-[10px] text-slate-500">
                              {String(it.category)}
                            </span>
                          ) : null}
                          {it.description ? (
                            <span className="block text-[11px] text-slate-600 line-clamp-2 mt-0.5">
                              {String(it.description)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-xs capitalize font-semibold">
                          {st.replace(/_/g, ' ')}
                        </td>
                        <td className="px-3 py-2 text-xs font-bold capitalize">
                          {String(it.priority || it.severity || '—')}
                        </td>
                        <td className="px-3 py-2 text-[10px] font-bold uppercase">
                          {it.raised_by_agency ? (
                            <span className="text-rose-700">DBE raised</span>
                          ) : (
                            <span className="text-slate-500">Self / field</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {!closed ? (
                            <div className="flex flex-col gap-1 items-end">
                              <button
                                type="button"
                                disabled={statusBusy === id}
                                onClick={() =>
                                  void patchStatus(id, 'in_progress')
                                }
                                className="btn-secondary !py-0.5 !px-2 text-[10px]"
                              >
                                In progress
                              </button>
                              <button
                                type="button"
                                disabled={statusBusy === id}
                                onClick={() => void patchStatus(id, 'resolved')}
                                className="btn-primary !py-0.5 !px-2 text-[10px]"
                              >
                                Close
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-emerald-700 font-bold">
                              Done
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
