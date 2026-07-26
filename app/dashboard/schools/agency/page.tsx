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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Prefer agency view if registered; also always load school-side data
      const [schoolRes, agencyRes] = await Promise.all([
        fetch(`/api/schools/agency?companyId=${companyId}&mode=school`, {
          cache: 'no-store',
        }),
        fetch(`/api/schools/agency?companyId=${companyId}&mode=agency`, {
          cache: 'no-store',
        }),
      ]);
      const schoolData = await schoolRes.json();
      const agencyData = await agencyRes.json();

      if (agencyData.agency || agencyData.role === 'agency') {
        setRole('agency');
        setMyAgency(agencyData.agency || schoolData.myAgency || null);
        setSchools(agencyData.schools || []);
        setSummary(agencyData.summary || null);
      } else {
        setRole('school');
        setMyAgency(schoolData.myAgency || null);
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
      toast.success('Registered as governmental agency (DBE / PEU)');
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
      toast.success(`Joined ${data.agency_name || 'agency'}`);
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
          ? 'School approved — included in agency reports'
          : action === 'suspend'
            ? 'School suspended'
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
        title="DBE & agencies"
        titleAccent="Join programme"
        description="Schools request to join DBE/PEU. You approve them, then run world-class programme reports across all approved organisations."
        action={
          <div className="flex flex-wrap gap-2">
            {role === 'agency' ? (
              <Link
                href="/dashboard/schools/agency-report"
                className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                <BarChart3 className="w-3.5 h-3.5" /> Agency reports
              </Link>
            ) : null}
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
          {/* Register as DBE / agency */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-black flex items-center gap-2 mb-2">
              <Landmark className="w-4 h-4 text-[#0077b6]" />
              Register this company as DBE / PEU
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Add the DBE (or a provincial NSNP office) as a company on
              SupplierAdvisor, then register it here. Schools can then join and
              you will see their reports and scores.
            </p>
            {myAgency ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                <strong>{String(myAgency.agency_name)}</strong>
                <span className="ml-2 text-[10px] font-bold uppercase text-emerald-800">
                  {String(myAgency.agency_type)} · {String(myAgency.status)}
                </span>
              </div>
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
                    <option value="provincial_nsnp">Provincial NSNP</option>
                    <option value="district_peu">District PEU</option>
                    <option value="circuit">Circuit</option>
                    <option value="other">Other</option>
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
                  <strong>Only approved</strong> organisations appear in agency
                  reports. Pending joins wait for your approval. Hospitals and
                  other orgs can use the same association model next.
                </p>
                <Link
                  href="/dashboard/schools/agency-report"
                  className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1 shrink-0"
                >
                  <BarChart3 className="w-3.5 h-3.5" /> Open full reports
                </Link>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Organisations',
                    value: summary?.schoolCount ?? schools.length,
                    icon: School,
                  },
                  {
                    label: 'Learners',
                    value: summary?.totalLearners ?? 0,
                    icon: Users,
                  },
                  {
                    label: 'Verified learners',
                    value: summary?.totalVerified ?? 0,
                    icon: Users,
                  },
                  {
                    label: 'Avg prize score',
                    value:
                      summary?.avgPrizeScore != null
                        ? String(summary.avgPrizeScore)
                        : '—',
                    icon: Landmark,
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

              <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500">
                  Associations · {String(myAgency.agency_name)}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead>
                      <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                        <th className="px-4 py-3">Organisation</th>
                        <th className="px-3 py-3">EMIS</th>
                        <th className="px-3 py-3">District</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3 text-right">Learners</th>
                        <th className="px-3 py-3 text-right">Verified</th>
                        <th className="px-3 py-3 text-right">Prize</th>
                        <th className="px-3 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schools.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-4 py-12 text-center text-slate-500"
                          >
                            No schools have requested to join yet.
                          </td>
                        </tr>
                      ) : (
                        schools.map((s) => {
                          const st = String(s.link_status || 'pending');
                          return (
                            <tr
                              key={String(s.id)}
                              className="border-b border-slate-50 hover:bg-sky-50/40"
                            >
                              <td className="px-4 py-2.5 font-semibold">
                                {String(s.school_name)}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs">
                                {String(s.emis_number || '—')}
                              </td>
                              <td className="px-3 py-2.5 text-xs">
                                {[s.district, s.province]
                                  .filter(Boolean)
                                  .join(', ') || '—'}
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
                                {Number(s.learner_count_enrolled || 0)}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {Number(s.learner_count_verified || 0)}
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
                                        void setLinkStatus(
                                          Number(s.id),
                                          'approve'
                                        )
                                      }
                                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-900 inline-flex items-center gap-0.5"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />{' '}
                                      Approve
                                    </button>
                                  ) : null}
                                  {st === 'active' ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void setLinkStatus(
                                          Number(s.id),
                                          'suspend'
                                        )
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
                                        void setLinkStatus(
                                          Number(s.id),
                                          'reject'
                                        )
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
