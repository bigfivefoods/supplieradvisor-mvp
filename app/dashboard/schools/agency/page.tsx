'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  CheckCircle2,
  Landmark,
  Link2,
  Loader2,
  RefreshCw,
  School,
  Unlink,
  Users,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import { SA_PROVINCES } from '@/lib/schools/types';

export default function AgencyPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'school' | 'agency'>('school');
  const [agencies, setAgencies] = useState<Array<Record<string, unknown>>>([]);
  const [links, setLinks] = useState<Array<Record<string, unknown>>>([]);
  const [schools, setSchools] = useState<Array<Record<string, unknown>>>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [myAgency, setMyAgency] = useState<Record<string, unknown> | null>(
    null
  );
  const [regName, setRegName] = useState('Department of Basic Education');
  const [regType, setRegType] = useState('dbe');
  const [regProvince, setRegProvince] = useState('');
  const [pendingIsps, setPendingIsps] = useState<
    Array<Record<string, unknown>>
  >([]);
  const [compliantIsps, setCompliantIsps] = useState<
    Array<Record<string, unknown>>
  >([]);
  const [schoolQ, setSchoolQ] = useState('');
  const [schoolStatusFilter, setSchoolStatusFilter] = useState<
    'all' | 'active' | 'pending' | 'suspended'
  >('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Prefer agency view if registered; also always load school-side data
      const [schoolRes, agencyRes, ispRes] = await Promise.all([
        fetch(`/api/schools/agency?companyId=${companyId}&mode=school`, {
          cache: 'no-store',
        }),
        fetch(`/api/schools/agency?companyId=${companyId}&mode=agency`, {
          cache: 'no-store',
        }),
        fetch(`/api/schools/isps?companyId=${companyId}&mode=agency`, {
          cache: 'no-store',
        }),
      ]);
      const schoolData = await schoolRes.json();
      const agencyData = await agencyRes.json();
      const ispData = await ispRes.json().catch(() => ({}));

      if (agencyData.agency || agencyData.role === 'agency') {
        setRole('agency');
        setMyAgency(agencyData.agency || schoolData.myAgency || null);
        setSchools(agencyData.schools || []);
        setSummary(agencyData.summary || null);
      } else {
        setRole('school');
        setMyAgency(schoolData.myAgency || null);
      }

      if (ispRes.ok && ispData.role === 'agency') {
        setPendingIsps(ispData.pending || []);
        setCompliantIsps(ispData.compliant || []);
      }

      if (schoolRes.ok) {
        setAgencies(schoolData.agencies || []);
        setLinks(schoolData.links || []);
        if (schoolData.warning) toast.message(schoolData.warning);
      }
      if (!schoolRes.ok && !agencyRes.ok) {
        throw new Error(schoolData.error || agencyData.error || 'Failed');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const registerAgency = async () => {
    try {
      const res = await fetch('/api/schools/agency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'register_agency',
          agency_name: regName,
          agency_type: regType,
          province: regProvince || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        regType.includes('health')
          ? 'Registered as Department of Health (DoH → SPs → clinics & hospitals)'
          : 'Registered as education agency (DBE/PEU → SPs → schools)'
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const join = async (agencyProfileId: number) => {
    try {
      const res = await fetch('/api/schools/agency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'join',
          agency_profile_id: agencyProfileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        `Join request sent to ${data.agency_name || 'agency'} — awaits approval`
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const leave = async (agencyProfileId: number) => {
    if (!confirm('Leave this agency association?')) return;
    try {
      const res = await fetch('/api/schools/agency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'leave',
          agency_profile_id: agencyProfileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Left agency');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  /** Approve/reject/suspend an SP↔agency association (by link_id preferred). */
  const setIspStatus = async (
    link: Record<string, unknown>,
    action: 'approve_isp' | 'suspend_isp' | 'reject_isp'
  ) => {
    try {
      const linkId = Number(link.id);
      const ispProfileId = Number(
        link.isp_profile_id ||
          (link.isp as { profile_id?: number } | undefined)?.profile_id ||
          link.profile_id
      );
      const res = await fetch('/api/schools/agency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: action === 'approve_isp' ? 'approve_isp_link' : action,
          link_id: Number.isFinite(linkId) ? linkId : undefined,
          isp_profile_id: Number.isFinite(ispProfileId)
            ? ispProfileId
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        action === 'approve_isp'
          ? 'SP association approved — schools under you may order from them'
          : action === 'suspend_isp'
            ? 'SP association suspended'
            : 'SP join request rejected'
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const setLinkStatus = async (
    schoolProfileId: number,
    action: 'approve' | 'suspend' | 'reject'
  ) => {
    try {
      const res = await fetch('/api/schools/agency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action,
          school_profile_id: schoolProfileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        action === 'approve'
          ? 'Facility approved — included in agency hierarchy & reports'
          : action === 'suspend'
            ? 'Facility suspended'
            : 'Request rejected'
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="DBE / PEU desk"
        titleAccent="Education only"
        description="DBE / PEU → SPs → Schools. Department of Health is a separate module under Health."
        action={
          <div className="flex flex-wrap gap-2">
            {role === 'agency' ? (
              <>
                <Link
                  href="/dashboard/schools/registry-report"
                  className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
                >
                  <BarChart3 className="w-3.5 h-3.5" /> School register
                </Link>
                <Link
                  href="/dashboard/schools/agency-report"
                  className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
                >
                  Programme reports
                </Link>
              </>
            ) : null}
            <Link
              href="/dashboard/health/agency"
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              DoH (Health) →
            </Link>
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

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Programme hierarchy explainer */}
          <div className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 to-sky-50 p-5">
            <h3 className="text-sm font-black text-slate-900 mb-3">
              Programme hierarchy
            </h3>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-white/80 border border-violet-100 px-4 py-3">
                <p className="text-[10px] font-bold uppercase text-violet-700 mb-1">
                  Education
                </p>
                <p className="font-black text-slate-900 tracking-tight">
                  DBE / PEU → SPs → Schools
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Department approves SPs and schools. Schools order only
                  approved foods from those SPs.
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 border border-rose-100 px-4 py-3">
                <p className="text-[10px] font-bold uppercase text-rose-700 mb-1">
                  Health (separate module)
                </p>
                <p className="font-black text-slate-900 tracking-tight">
                  DoH → SPs → Clinics &amp; hospitals
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Not part of Schools — open the{' '}
                  <Link
                    href="/dashboard/health"
                    className="font-bold text-rose-700 underline"
                  >
                    Health module
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>

          {/* Register as DBE / agency */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-black flex items-center gap-2 mb-2">
              <Landmark className="w-4 h-4 text-[#0077b6]" />
              Register this company as DBE / PEU
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Education department only. Schools and SPs request to join; you
              approve them. For Department of Health, use{' '}
              <Link href="/dashboard/health/agency" className="font-bold underline">
                Health → DoH desk
              </Link>
              .
            </p>
            {myAgency ? (
              <AgencyProfileEditor
                companyId={companyId}
                agency={myAgency}
                onSaved={() => void load()}
              />
            ) : (
              <div className="flex flex-wrap gap-2 items-end">
                <label className="text-xs">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Agency name
                  </span>
                  <input
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm w-64"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                  />
                </label>
                <label className="text-xs">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Type
                  </span>
                  <select
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={regType}
                    onChange={(e) => setRegType(e.target.value)}
                  >
                    <option value="dbe">DBE (national)</option>
                    <option value="peu">PEU · provincial education</option>
                    <option value="provincial_nsnp">Provincial NSNP office</option>
                    <option value="district">District education office</option>
                    <option value="other">Other education agency</option>
                  </select>
                </label>
                <label className="text-xs">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Province
                  </span>
                  <select
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={regProvince}
                    onChange={(e) => setRegProvince(e.target.value)}
                  >
                    <option value="">National / all</option>
                    {SA_PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void registerAgency()}
                  className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
                >
                  <Building2 className="w-3.5 h-3.5" /> Register agency
                </button>
              </div>
            )}
          </div>

          {/* Agency console */}
          {role === 'agency' && myAgency ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
                <p className="text-slate-700">
                  <strong>Hierarchy:</strong> approve <em>SPs</em> and{' '}
                  <em>schools</em> under DBE/PEU. Only active associations
                  appear in reports. Clinics &amp; hospitals →{' '}
                  <Link href="/dashboard/health" className="font-bold underline">
                    Health module
                  </Link>
                  .
                </p>
                <Link
                  href="/dashboard/schools/agency-report"
                  className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1 shrink-0"
                >
                  <BarChart3 className="w-3.5 h-3.5" /> Open full reports
                </Link>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                {[
                  {
                    label: 'Schools linked',
                    value: Number(
                      summary?.schoolCount ?? schools.length
                    ).toLocaleString('en-ZA'),
                    icon: School,
                  },
                  {
                    label: 'Active',
                    value: Number(
                      summary?.activeLinks ??
                        schools.filter((s) => s.link_status === 'active')
                          .length
                    ).toLocaleString('en-ZA'),
                    icon: CheckCircle2,
                  },
                  {
                    label: 'Pending',
                    value: Number(
                      summary?.pendingLinks ??
                        schools.filter((s) => s.link_status === 'pending')
                          .length
                    ).toLocaleString('en-ZA'),
                    icon: Link2,
                  },
                  {
                    label: 'Learners',
                    value: Number(summary?.totalLearners ?? 0).toLocaleString(
                      'en-ZA'
                    ),
                    icon: Users,
                  },
                  {
                    label: 'SPs pending',
                    value: pendingIsps.length,
                    icon: Link2,
                  },
                  {
                    label: 'SPs approved',
                    value: compliantIsps.length,
                    icon: CheckCircle2,
                  },
                ].map((c) => (
                  <div
                    key={c.label}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400">
                      <c.icon className="w-3.5 h-3.5 text-[#00b4d8]" />
                      {c.label}
                    </div>
                    <div className="text-2xl font-black tabular-nums mt-1">
                      {String(c.value)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>
                    {Number(summary?.schoolCount ?? schools.length).toLocaleString(
                      'en-ZA'
                    )}
                  </strong>{' '}
                  schools on your programme
                  {summary?.districts != null
                    ? ` · ${Number(summary.districts).toLocaleString('en-ZA')} districts`
                    : ''}
                  {summary?.totalNsnpApproved
                    ? ` · ${Number(summary.totalNsnpApproved).toLocaleString('en-ZA')} NSNP approved enrol.`
                    : ''}
                  . Full geo/enrolment report:{' '}
                  <Link
                    href="/dashboard/schools/registry-report"
                    className="font-bold underline"
                  >
                    School register
                  </Link>
                </span>
              </div>

              {/* SP association queue — same join+approve pattern as schools */}
              <div className="rounded-3xl border border-amber-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b border-amber-100 bg-amber-50/50 text-xs font-bold uppercase text-amber-900">
                  SP associations · SPs join your department, then you approve
                </div>
                {pendingIsps.length === 0 && compliantIsps.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-500">
                    No SP join requests yet. Providers register as SP, then
                    request association with your department (DBE/PEU/DoH).
                    Pending requests appear here until you approve — same as
                    schools.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {pendingIsps.map((link) => (
                      <li
                        key={`p-${String(link.id || link.isp_profile_id)}`}
                        className="px-5 py-3 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <p className="font-bold text-sm">
                            {String(
                              link.display_name ||
                                (link.isp as { trading_name?: string } | null)
                                  ?.trading_name ||
                                `SP ${link.isp_profile_id}`
                            )}
                          </p>
                          <p className="text-[11px] text-amber-800 font-bold uppercase">
                            Join request · pending your approval
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              void setIspStatus(link, 'approve_isp')
                            }
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-900"
                          >
                            Approve association
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void setIspStatus(link, 'reject_isp')
                            }
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-800"
                          >
                            Reject
                          </button>
                        </div>
                      </li>
                    ))}
                    {compliantIsps.map((link) => (
                      <li
                        key={`ok-${String(link.id || link.isp_profile_id)}`}
                        className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 bg-emerald-50/30"
                      >
                        <div>
                          <p className="font-bold text-sm">
                            {String(
                              link.display_name ||
                                (link.isp as { trading_name?: string } | null)
                                  ?.trading_name ||
                                `SP ${link.isp_profile_id}`
                            )}
                          </p>
                          <p className="text-[11px] text-emerald-800 font-bold uppercase">
                            Associated · schools under you may order
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void setIspStatus(link, 'suspend_isp')}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600"
                        >
                          Suspend
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <AgencySchoolsTable
                schools={schools}
                schoolQ={schoolQ}
                setSchoolQ={setSchoolQ}
                schoolStatusFilter={schoolStatusFilter}
                setSchoolStatusFilter={setSchoolStatusFilter}
                agencyName={String(myAgency.agency_name || '')}
                onSetLinkStatus={(id, action) =>
                  void setLinkStatus(id, action)
                }
              />
            </div>
          ) : null}

          {/* School: join DBE */}
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-black mb-3">My agency links</h3>
              {links.filter((l) => l.status !== 'left').length === 0 ? (
                <p className="text-sm text-slate-500">
                  Not linked to DBE yet — join from the directory.
                </p>
              ) : (
                <ul className="space-y-2">
                  {links
                    .filter((l) => l.status !== 'left')
                    .map((l) => (
                      <li
                        key={String(l.id)}
                        className="flex items-center justify-between gap-2 text-sm border-b border-slate-50 py-2"
                      >
                        <div>
                          <span className="font-semibold">
                            {String(l.agency_name)}
                          </span>
                          <span className="block text-[10px] uppercase font-bold text-slate-400">
                            {String(l.status)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            void leave(Number(l.agency_profile_id))
                          }
                          className="btn-secondary !py-1 !px-2 text-[11px] inline-flex items-center gap-1"
                        >
                          <Unlink className="w-3 h-3" /> Leave
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-black mb-3">
                Join DBE / agency directory
              </h3>
              {agencies.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No agencies registered yet. Register the DBE company above
                  first (on the DBE workspace).
                </p>
              ) : (
                <ul className="space-y-2">
                  {agencies.map((a) => {
                    const already = links.some(
                      (l) =>
                        Number(l.agency_profile_id) ===
                          Number(a.profile_id) && l.status !== 'left'
                    );
                    return (
                      <li
                        key={String(a.id)}
                        className="flex items-center justify-between gap-2 text-sm border-b border-slate-50 py-2"
                      >
                        <div>
                          <span className="font-semibold">
                            {String(a.agency_name)}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            {String(a.agency_type).replace(/_/g, ' ')}
                            {a.province ? ` · ${a.province}` : ''}
                          </span>
                        </div>
                        {already ? (
                          <span className="text-[10px] font-bold text-emerald-700">
                            Joined
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void join(Number(a.profile_id))}
                            className="btn-primary !py-1 !px-2 text-[11px] inline-flex items-center gap-1"
                          >
                            <Link2 className="w-3 h-3" /> Join
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </SchoolsPage>
  );
}

function AgencySchoolsTable({
  schools,
  schoolQ,
  setSchoolQ,
  schoolStatusFilter,
  setSchoolStatusFilter,
  agencyName,
  onSetLinkStatus,
}: {
  schools: Array<Record<string, unknown>>;
  schoolQ: string;
  setSchoolQ: (v: string) => void;
  schoolStatusFilter: 'all' | 'active' | 'pending' | 'suspended';
  setSchoolStatusFilter: (v: 'all' | 'active' | 'pending' | 'suspended') => void;
  agencyName: string;
  onSetLinkStatus: (id: number, action: 'approve' | 'suspend' | 'reject') => void;
}) {
  const filtered = schools.filter((s) => {
    const st = String(s.link_status || 'pending');
    if (schoolStatusFilter !== 'all' && st !== schoolStatusFilter) return false;
    const qq = schoolQ.trim().toLowerCase();
    if (!qq) return true;
    const hay = [
      s.school_name,
      s.emis_number,
      s.natemis,
      s.district,
      s.province,
      s.local_municipality,
      s.circuit,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(qq);
  });

  return (
    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">
            Facility associations · {agencyName}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Showing {filtered.length.toLocaleString('en-ZA')} of{' '}
            {schools.length.toLocaleString('en-ZA')} schools
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            value={schoolStatusFilter}
            onChange={(e) =>
              setSchoolStatusFilter(
                e.target.value as 'all' | 'active' | 'pending' | 'suspended'
              )
            }
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
          <input
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs min-w-[180px]"
            placeholder="Search name, NATEMIS, district…"
            value={schoolQ}
            onChange={(e) => setSchoolQ(e.target.value)}
          />
          <Link
            href="/dashboard/schools/registry-report"
            className="text-xs font-bold text-[#0077b6] hover:underline"
          >
            Full register →
          </Link>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
              <th className="px-4 py-3">Organisation</th>
              <th className="px-3 py-3">NATEMIS / EMIS</th>
              <th className="px-3 py-3">District</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">Learners</th>
              <th className="px-3 py-3 text-right">Verified</th>
              <th className="px-3 py-3 text-right">Prize</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  {schools.length === 0
                    ? 'No schools linked yet — import the registry or approve joins.'
                    : 'No schools match this filter.'}
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const st = String(s.link_status || 'pending');
                const learners = Number(
                  s.learner_count_enrolled ||
                    s.final_emis_enrol ||
                    s.final_nsnp_approved_enrol ||
                    0
                );
                return (
                  <tr
                    key={String(s.id)}
                    className="border-b border-slate-50 hover:bg-sky-50/40"
                  >
                    <td className="px-4 py-2.5 font-semibold">
                      {String(s.school_name)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      {String(s.natemis || s.emis_number || '—')}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {[s.district, s.province].filter(Boolean).join(', ') ||
                        '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          st === 'active'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : st === 'pending'
                              ? 'bg-amber-50 border-amber-200 text-amber-900'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        {st}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {learners.toLocaleString('en-ZA')}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {Number(s.learner_count_verified || 0).toLocaleString(
                        'en-ZA'
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                      {s.prize_score != null
                        ? Number(s.prize_score).toFixed(1)
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex flex-wrap gap-1 justify-end">
                        {st !== 'active' ? (
                          <button
                            type="button"
                            onClick={() =>
                              onSetLinkStatus(Number(s.id), 'approve')
                            }
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-900 inline-flex items-center gap-0.5"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Approve
                          </button>
                        ) : null}
                        {st === 'active' ? (
                          <button
                            type="button"
                            onClick={() =>
                              onSetLinkStatus(Number(s.id), 'suspend')
                            }
                            className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600"
                          >
                            Suspend
                          </button>
                        ) : null}
                        {st === 'pending' ? (
                          <button
                            type="button"
                            onClick={() =>
                              onSetLinkStatus(Number(s.id), 'reject')
                            }
                            className="rounded-lg border border-rose-200 px-2 py-1 text-[10px] font-bold text-rose-700"
                          >
                            Reject
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AgencyProfileEditor({
  companyId,
  agency,
  onSaved,
}: {
  companyId: number;
  agency: Record<string, unknown>;
  onSaved: () => void;
}) {
  const [name, setName] = useState(String(agency.agency_name || ''));
  const [contactName, setContactName] = useState(
    String(agency.contact_name || '')
  );
  const [contactEmail, setContactEmail] = useState(
    String(agency.contact_email || '')
  );
  const [contactPhone, setContactPhone] = useState(
    String(agency.contact_phone || '')
  );
  const [about, setAbout] = useState(
    String(agency.about || agency.description || '')
  );
  const [tariff, setTariff] = useState(
    agency.meal_tariff_lunch_zar != null
      ? String(agency.meal_tariff_lunch_zar)
      : agency.meal_tariff_zar != null
        ? String(agency.meal_tariff_zar)
        : '4.5'
  );
  const [claimsLocked, setClaimsLocked] = useState(
    agency.claims_locked === true
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/schools/agency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'update_agency',
          agency_name: name,
          contact_name: contactName,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          about,
          description: about,
          meal_tariff_zar: Number(tariff) || null,
          meal_tariff_lunch_zar: Number(tariff) || null,
          claims_locked: claimsLocked,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('DBE / PEU profile updated');
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-black text-slate-900">{String(agency.agency_name)}</p>
          <span className="text-[10px] font-bold uppercase text-emerald-800">
            {String(agency.agency_type)} · {String(agency.status)}
          </span>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="btn-primary !py-1.5 !px-3 text-xs"
        >
          {saving ? 'Saving…' : 'Save fields'}
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="text-xs">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            Agency name
          </span>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="text-xs">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            Contact name
          </span>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
        </label>
        <label className="text-xs">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            Contact email
          </span>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </label>
        <label className="text-xs">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            Contact phone
          </span>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
        </label>
        <label className="text-xs">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            Lunch meal tariff (ZAR)
          </span>
          <input
            type="number"
            step="0.01"
            min={0}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
            value={tariff}
            onChange={(e) => setTariff(e.target.value)}
          />
        </label>
        <label className="text-xs flex items-center gap-2 pt-5">
          <input
            type="checkbox"
            checked={claimsLocked}
            onChange={(e) => setClaimsLocked(e.target.checked)}
          />
          <span className="font-semibold text-slate-700">
            Lock all claims (pause school submit)
          </span>
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            About / notes
          </span>
          <textarea
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white min-h-[64px]"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
