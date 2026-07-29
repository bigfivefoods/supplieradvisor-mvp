'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  Link2,
  Building2,
  Truck,
  Landmark,
  Unlink,
  CheckCircle2,
  Search,
  School,
  XCircle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import NsnpSystemFlow from '@/components/schools/NsnpSystemFlow';

type ViewRole = 'school' | 'isp' | 'agency' | 'loading';

export default function IspsPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<ViewRole>('loading');
  const [policy, setPolicy] = useState('');

  // School view
  const [links, setLinks] = useState<Array<Record<string, unknown>>>([]);
  const [pendingClaims, setPendingClaims] = useState<
    Array<Record<string, unknown>>
  >([]);
  const [directory, setDirectory] = useState<Array<Record<string, unknown>>>(
    []
  );
  const [schoolAgencyActiveCount, setSchoolAgencyActiveCount] = useState(0);

  // SP view
  const [myIsp, setMyIsp] = useState<Record<string, unknown> | null>(null);
  const [myAgencyLinks, setMyAgencyLinks] = useState<
    Array<Record<string, unknown>>
  >([]);
  const [mySchoolLinks, setMySchoolLinks] = useState<
    Array<Record<string, unknown>>
  >([]);
  const [claimableSchools, setClaimableSchools] = useState<
    Array<Record<string, unknown>>
  >([]);
  const [activeAgencyCount, setActiveAgencyCount] = useState(0);
  const [agencies, setAgencies] = useState<Array<Record<string, unknown>>>([]);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [searching, setSearching] = useState(false);

  const load = useCallback(
    async (opts?: { q?: string }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ companyId: String(companyId) });
        const q = (opts?.q ?? schoolSearch).trim();
        if (q.length >= 2) params.set('q', q);

        const res = await fetch(`/api/schools/isps?${params}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');

        const r = (data.role || 'school') as ViewRole;
        setRole(r);
        setPolicy(String(data.policy || ''));

        if (r === 'isp') {
          setMyIsp(data.myIsp || null);
          setMyAgencyLinks(data.myAgencyLinks || []);
          setMySchoolLinks(data.mySchoolLinks || []);
          setClaimableSchools(data.claimableSchools || []);
          setActiveAgencyCount(Number(data.activeAgencyCount || 0));
          setAgencies(data.agencies || []);
        } else if (r === 'agency') {
          setLinks([]);
          setDirectory([]);
          setPendingClaims([]);
        } else {
          setLinks(data.links || []);
          setPendingClaims(data.pendingClaims || []);
          setDirectory(data.directory || []);
          setSchoolAgencyActiveCount(Number(data.schoolAgencyActiveCount || 0));
          setMyIsp(data.myIsp || null);
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Load failed');
      } finally {
        setLoading(false);
      }
    },
    [companyId, schoolSearch]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const searchSchools = async () => {
    const q = schoolSearch.trim();
    if (q.length < 2) {
      toast.error('Type at least 2 characters (school name or EMIS)');
      return;
    }
    setSearching(true);
    try {
      await load({ q });
    } finally {
      setSearching(false);
    }
  };

  const registerAsIsp = async () => {
    try {
      const res = await fetch('/api/schools/isps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          action: 'register_as_isp',
          food_handling_cert: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        data.message ||
          'Registered as SP — now request to join a DBE/PEU department'
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const joinAgency = async (agencyProfileId: number) => {
    try {
      const res = await fetch('/api/schools/isps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          action: 'join_agency',
          agency_profile_id: agencyProfileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        data.message ||
          'Join request sent — department must approve your association'
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const leaveAgency = async (agencyProfileId: number) => {
    if (!confirm('Leave this department association?')) return;
    try {
      const res = await fetch('/api/schools/isps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          action: 'leave_agency',
          agency_profile_id: agencyProfileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Left department association');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const claimSchool = async (schoolProfileId: number) => {
    try {
      const res = await fetch('/api/schools/isps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          action: 'claim_school',
          school_profile_id: schoolProfileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(data.message || 'Claim sent — school must accept');
      void load({ q: schoolSearch });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const withdrawSchoolClaim = async (schoolProfileId: number) => {
    if (!confirm('Withdraw this school claim / connection?')) return;
    try {
      const res = await fetch('/api/schools/isps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          action: 'withdraw_school_claim',
          school_profile_id: schoolProfileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(data.message || 'Withdrawn');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const respondClaim = async (
    ispProfileId: number,
    accept: boolean
  ) => {
    try {
      const res = await fetch('/api/schools/isps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          action: accept ? 'accept_school_claim' : 'reject_school_claim',
          isp_profile_id: ispProfileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(data.message || (accept ? 'Accepted' : 'Rejected'));
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const linkIsp = async (ispProfileId: number) => {
    try {
      const res = await fetch('/api/schools/isps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          isp_profile_id: ispProfileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(data.message || 'SP linked to school');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const unlinkIsp = async (ispProfileId: number) => {
    if (!confirm('Remove this SP from your school?')) return;
    try {
      const res = await fetch('/api/schools/isps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          action: 'unlink_isp',
          isp_profile_id: ispProfileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('SP unlinked');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const isIsp = role === 'isp' || Boolean(myIsp);
  const headerDesc =
    role === 'isp'
      ? 'Join a department, then claim schools under it. Each school must accept your claim before you can supply them.'
      : role === 'agency'
        ? 'Manage SP join requests under Schools → DBE (agency desk).'
        : 'Accept SP claims on your school, or link department-approved SPs yourself.';

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="SPs"
        titleAccent={
          role === 'isp'
            ? 'Claim schools'
            : role === 'school'
              ? 'Accept claims'
              : 'Department-associated only'
        }
        description={headerDesc}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/schools/deliveries"
              className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Truck className="w-3.5 h-3.5" /> Deliveries · POD
            </Link>
            {role === 'agency' ? (
              <Link
                href="/dashboard/schools/agency"
                className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                <Landmark className="w-3.5 h-3.5" /> SP queue on DBE desk
              </Link>
            ) : null}
            {!isIsp && role !== 'agency' ? (
              <button
                type="button"
                onClick={() => void registerAsIsp()}
                className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                <Building2 className="w-3.5 h-3.5" /> Register as SP
              </button>
            ) : null}
            {isIsp && !myIsp ? (
              <button
                type="button"
                onClick={() => void registerAsIsp()}
                className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                <Building2 className="w-3.5 h-3.5" /> Complete SP profile
              </button>
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

      <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
        <strong>Policy:</strong>{' '}
        {policy ||
          'SPs join a department and claim schools. Schools accept claims. Both must share an approved department link.'}
      </div>

      {!loading && role !== 'agency' ? (
        <NsnpSystemFlow audience={isIsp ? 'isp' : 'school'} />
      ) : null}

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : role === 'agency' ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <Landmark className="w-10 h-10 mx-auto text-amber-600 mb-3" />
          <p className="font-black text-slate-900">
            Agency desk for SP associations
          </p>
          <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
            SPs request to join your department. Approve them on the DBE /
            agency page — parallel to school join approvals.
          </p>
          <Link
            href="/dashboard/schools/agency"
            className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-2 mt-5"
          >
            Open association queues
          </Link>
        </div>
      ) : role === 'isp' || myIsp ? (
        <IspJoinView
          myIsp={myIsp}
          myAgencyLinks={myAgencyLinks}
          mySchoolLinks={mySchoolLinks}
          claimableSchools={claimableSchools}
          activeAgencyCount={activeAgencyCount}
          agencies={agencies}
          schoolSearch={schoolSearch}
          searching={searching}
          onSchoolSearchChange={setSchoolSearch}
          onSearchSchools={() => void searchSchools()}
          onClaimSchool={claimSchool}
          onWithdrawSchool={withdrawSchoolClaim}
          onJoin={joinAgency}
          onLeave={leaveAgency}
          onRegister={registerAsIsp}
        />
      ) : (
        <SchoolIspView
          links={links}
          pendingClaims={pendingClaims}
          directory={directory}
          schoolAgencyActiveCount={schoolAgencyActiveCount}
          onLink={linkIsp}
          onAccept={(id) => void respondClaim(id, true)}
          onReject={(id) => void respondClaim(id, false)}
          onUnlink={unlinkIsp}
        />
      )}
    </SchoolsPage>
  );
}

function IspJoinView({
  myIsp,
  myAgencyLinks,
  mySchoolLinks,
  claimableSchools,
  activeAgencyCount,
  agencies,
  schoolSearch,
  searching,
  onSchoolSearchChange,
  onSearchSchools,
  onClaimSchool,
  onWithdrawSchool,
  onJoin,
  onLeave,
  onRegister,
}: {
  myIsp: Record<string, unknown> | null;
  myAgencyLinks: Array<Record<string, unknown>>;
  mySchoolLinks: Array<Record<string, unknown>>;
  claimableSchools: Array<Record<string, unknown>>;
  activeAgencyCount: number;
  agencies: Array<Record<string, unknown>>;
  schoolSearch: string;
  searching: boolean;
  onSchoolSearchChange: (v: string) => void;
  onSearchSchools: () => void;
  onClaimSchool: (schoolProfileId: number) => void;
  onWithdrawSchool: (schoolProfileId: number) => void;
  onJoin: (id: number) => void;
  onLeave: (id: number) => void;
  onRegister: () => void;
}) {
  if (!myIsp) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <Building2 className="w-10 h-10 mx-auto text-slate-400 mb-3" />
        <p className="font-black">Register as an SP first</p>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Then request to join each department (DBE / PEU) you want to
          supply. After they approve, claim schools under that department.
        </p>
        <button
          type="button"
          onClick={() => void onRegister()}
          className="btn-primary !py-2 !px-4 text-sm mt-4"
        >
          Register as SP
        </button>
      </div>
    );
  }

  const activeOrPending = new Set(
    myAgencyLinks
      .filter((l) => ['pending', 'active'].includes(String(l.status)))
      .map((l) => Number(l.agency_profile_id))
  );

  const pendingSchools = mySchoolLinks.filter(
    (l) => String(l.status) === 'pending'
  );
  const activeSchools = mySchoolLinks.filter(
    (l) => String(l.status) === 'active'
  );

  return (
    <div className="space-y-4">
      {/* Claim schools */}
      <div className="rounded-3xl border-2 border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 space-y-4">
        <div>
          <h3 className="text-sm font-black flex items-center gap-2">
            <School className="w-4 h-4 text-emerald-700" />
            Claim / connect to schools
          </h3>
          <p className="text-[11px] text-slate-600 mt-1">
            Search by school name or EMIS. Only schools under departments that
            have approved you appear. The school must accept your claim.
          </p>
        </div>

        {activeAgencyCount === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            You need at least one <strong>approved</strong> department
            association before you can claim schools. Request to join below and
            wait for DBE approval.
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm bg-white"
                placeholder="School name or EMIS number…"
                value={schoolSearch}
                onChange={(e) => onSchoolSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSearchSchools();
                  }
                }}
              />
            </div>
            <button
              type="button"
              disabled={searching}
              onClick={onSearchSchools}
              className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-2"
            >
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search
            </button>
          </div>
        )}

        {claimableSchools.length > 0 ? (
          <ul className="space-y-2">
            {claimableSchools.map((s) => {
              const id = Number(s.id);
              const linked = Boolean(s.already_linked);
              const st = s.link_status ? String(s.link_status) : null;
              return (
                <li
                  key={id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm border border-slate-100 rounded-xl bg-white px-3 py-2"
                >
                  <div>
                    <span className="font-semibold">
                      {String(s.school_name)}
                    </span>
                    <span className="block text-[10px] text-slate-500 font-mono">
                      EMIS {String(s.emis_number || '—')}
                      {s.district ? ` · ${String(s.district)}` : ''}
                    </span>
                  </div>
                  {linked ? (
                    <span
                      className={`text-[11px] font-bold uppercase ${
                        st === 'active'
                          ? 'text-emerald-700'
                          : st === 'pending'
                            ? 'text-amber-700'
                            : 'text-slate-500'
                      }`}
                    >
                      {st === 'pending' ? 'Claim pending' : st || 'Linked'}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void onClaimSchool(id)}
                      className="btn-secondary !py-1 !px-2 text-[11px] inline-flex items-center gap-1"
                    >
                      <Link2 className="w-3 h-3" /> Claim school
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : schoolSearch.trim().length >= 2 && activeAgencyCount > 0 ? (
          <p className="text-sm text-slate-500">
            No claimable schools matched “{schoolSearch}”. Try EMIS or another
            name fragment.
          </p>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-black mb-1 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            My school claims
          </h3>
          <p className="text-[11px] text-slate-500 mb-3">
            Pending {pendingSchools.length} · Active {activeSchools.length}
          </p>
          {mySchoolLinks.length === 0 ? (
            <p className="text-sm text-slate-500">
              No school claims yet. Search and claim schools above.
            </p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {mySchoolLinks.map((l) => {
                const st = String(l.status || 'pending');
                return (
                  <li
                    key={String(l.id)}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-slate-50 py-2"
                  >
                    <div>
                      <span className="font-semibold">
                        {String(l.school_name || l.school_profile_id)}
                      </span>
                      <span className="block text-[10px] text-slate-500 font-mono">
                        EMIS {String(l.emis_number || '—')}
                        {l.district ? ` · ${String(l.district)}` : ''}
                      </span>
                      <span
                        className={`block text-[10px] uppercase font-bold ${
                          st === 'active'
                            ? 'text-emerald-700'
                            : st === 'pending'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {st === 'active'
                          ? 'Connected · school accepted'
                          : st === 'pending'
                            ? 'Awaiting school acceptance'
                            : st}
                      </span>
                    </div>
                    {st === 'active' || st === 'pending' ? (
                      <button
                        type="button"
                        onClick={() =>
                          void onWithdrawSchool(Number(l.school_profile_id))
                        }
                        className="btn-secondary !py-1 !px-2 text-[11px] inline-flex items-center gap-1"
                      >
                        <Unlink className="w-3 h-3" />{' '}
                        {st === 'pending' ? 'Withdraw' : 'Leave'}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-black mb-1">My department associations</h3>
          <p className="text-[11px] text-slate-500 mb-3">
            Profile · {String(myIsp.trading_name || myIsp.profile_id)} · global
            status {String(myIsp.compliance_status || 'pending')}
          </p>
          {myAgencyLinks.length === 0 ? (
            <p className="text-sm text-slate-500">
              Not associated with any department yet. Join from the directory —
              then claim schools after they approve you.
            </p>
          ) : (
            <ul className="space-y-2">
              {myAgencyLinks.map((l) => {
                const st = String(l.status || 'pending');
                return (
                  <li
                    key={String(l.id)}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-slate-50 py-2"
                  >
                    <div>
                      <span className="font-semibold">
                        {String(l.agency_name || l.agency_profile_id)}
                      </span>
                      <span
                        className={`block text-[10px] uppercase font-bold ${
                          st === 'active'
                            ? 'text-emerald-700'
                            : st === 'pending'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {st === 'active'
                          ? 'Approved · may claim their schools'
                          : st === 'pending'
                            ? 'Pending department approval'
                            : st}
                      </span>
                    </div>
                    {st === 'active' || st === 'pending' ? (
                      <button
                        type="button"
                        onClick={() => void onLeave(Number(l.agency_profile_id))}
                        className="btn-secondary !py-1 !px-2 text-[11px] inline-flex items-center gap-1"
                      >
                        <Unlink className="w-3 h-3" /> Leave
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-black mb-1">
          Join DBE / PEU directory
        </h3>
        <p className="text-[11px] text-slate-500 mb-3">
          Request association. The department must approve before you can claim
          their schools.
        </p>
        {agencies.length === 0 ? (
          <p className="text-sm text-slate-500">
            No active agencies listed yet. Departments register under Schools →
            DBE.
          </p>
        ) : (
          <ul className="space-y-2">
            {agencies.map((a) => {
              const id = Number(a.profile_id);
              const joined = activeOrPending.has(id);
              const existing = myAgencyLinks.find(
                (l) => Number(l.agency_profile_id) === id
              );
              return (
                <li
                  key={String(a.profile_id)}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-slate-50 py-2"
                >
                  <div>
                    <span className="font-semibold">
                      {String(a.agency_name)}
                    </span>
                    <span className="block text-[10px] text-slate-500 uppercase font-bold">
                      {String(a.agency_type || '').replace(/_/g, ' ')}
                      {a.province ? ` · ${String(a.province)}` : ''}
                    </span>
                  </div>
                  {joined ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {String(existing?.status || 'joined')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void onJoin(id)}
                      className="btn-secondary !py-1 !px-2 text-[11px] inline-flex items-center gap-1"
                    >
                      <Link2 className="w-3 h-3" /> Request to join
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function SchoolIspView({
  links,
  pendingClaims,
  directory,
  schoolAgencyActiveCount,
  onLink,
  onAccept,
  onReject,
  onUnlink,
}: {
  links: Array<Record<string, unknown>>;
  pendingClaims: Array<Record<string, unknown>>;
  directory: Array<Record<string, unknown>>;
  schoolAgencyActiveCount: number;
  onLink: (ispProfileId: number) => void;
  onAccept: (ispProfileId: number) => void;
  onReject: (ispProfileId: number) => void;
  onUnlink: (ispProfileId: number) => void;
}) {
  const activeLinks = links.filter((l) => String(l.status) === 'active');
  const linkedIds = new Set(links.map((l) => Number(l.isp_profile_id)));

  return (
    <div className="space-y-4">
      {schoolAgencyActiveCount === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Your school must <strong>join and be approved</strong> by a DBE/PEU
          before SP claims unlock.{' '}
          <Link
            href="/dashboard/schools/join"
            className="font-bold underline underline-offset-2"
          >
            Request association
          </Link>
        </div>
      ) : null}

      {/* Pending SP claims — accept / reject */}
      <div className="rounded-3xl border-2 border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5">
        <h3 className="text-sm font-black mb-1 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-700" />
          SP claims awaiting your acceptance
        </h3>
        <p className="text-[11px] text-slate-600 mb-3">
          Service providers under your department can request to supply your
          school. Accept only SPs you want to trade with.
        </p>
        {pendingClaims.length === 0 ? (
          <p className="text-sm text-slate-500">
            No pending claims right now.
          </p>
        ) : (
          <ul className="space-y-2">
            {pendingClaims.map((l) => (
              <li
                key={String(l.id)}
                className="flex flex-wrap items-center justify-between gap-2 text-sm border border-amber-100 rounded-xl bg-white px-3 py-2"
              >
                <div>
                  <span className="font-semibold">
                    {String(l.display_name || l.isp_profile_id)}
                  </span>
                  <span className="block text-[10px] uppercase font-bold text-amber-700">
                    Pending claim
                    {l.agency_approved === false
                      ? ' · not on agency list'
                      : ' · agency OK'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void onAccept(Number(l.isp_profile_id))}
                    className="btn-primary !py-1 !px-2 text-[11px] inline-flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => void onReject(Number(l.isp_profile_id))}
                    className="btn-secondary !py-1 !px-2 text-[11px] inline-flex items-center gap-1"
                  >
                    <XCircle className="w-3 h-3" /> Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-black mb-3">Linked to this school</h3>
          {activeLinks.length === 0 ? (
            <p className="text-sm text-slate-500">
              No active SPs yet. Accept a claim above or link from the
              department directory.
            </p>
          ) : (
            <ul className="space-y-2">
              {activeLinks.map((l) => (
                <li
                  key={String(l.id)}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-slate-50 py-2"
                >
                  <div>
                    <span className="font-semibold">
                      {String(l.display_name || l.isp_profile_id)}
                    </span>
                    <span className="block text-xs text-emerald-700 font-bold uppercase">
                      Active
                      {l.agency_approved === false
                        ? ' · not on agency list'
                        : ' · agency OK'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onUnlink(Number(l.isp_profile_id))}
                    className="btn-secondary !py-1 !px-2 text-[11px] inline-flex items-center gap-1"
                  >
                    <Unlink className="w-3 h-3" /> Unlink
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-black mb-1">
            Department-approved SP directory
          </h3>
          <p className="text-[11px] text-slate-500 mb-3">
            Link an SP yourself (instant active), or wait for them to claim you.
          </p>
          {directory.length === 0 ? (
            <p className="text-sm text-slate-500">
              No approved SPs for your department yet. Providers register,
              request to join the same DBE/PEU, and await approval.
            </p>
          ) : (
            <ul className="space-y-2">
              {directory.map((d) => {
                const id = Number(d.profile_id);
                const already = linkedIds.has(id);
                const existing = links.find(
                  (l) => Number(l.isp_profile_id) === id
                );
                return (
                  <li
                    key={String(d.profile_id || d.id)}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-slate-50 py-2"
                  >
                    <div>
                      <span className="font-semibold">
                        {String(d.display_name || d.trading_name)}
                      </span>
                      <span className="block text-[10px] uppercase font-bold text-emerald-700">
                        Associated with your department
                      </span>
                    </div>
                    {already ? (
                      <span className="text-[11px] font-bold capitalize text-slate-600">
                        {String(existing?.status || 'linked')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void onLink(id)}
                        className="btn-secondary !py-1 !px-2 text-[11px] inline-flex items-center gap-1"
                      >
                        <Link2 className="w-3 h-3" /> Link
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
  );
}
