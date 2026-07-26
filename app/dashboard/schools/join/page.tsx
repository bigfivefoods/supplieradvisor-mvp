'use client';

/**
 * Simple join hub — role-aware:
 * - School / facility: request to join DBE/DoH
 * - SP: request to join DBE/DoH
 * - Department: search & add schools/SPs, approve pending
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  School,
  Search,
  Truck,
  Unlink,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import { useProgrammeRole } from '@/lib/schools/useProgrammeRole';

export default function JoinProgrammePage() {
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

  // Shared directory of agencies
  const [agencies, setAgencies] = useState<Array<Record<string, unknown>>>([]);
  // School links
  const [schoolLinks, setSchoolLinks] = useState<
    Array<Record<string, unknown>>
  >([]);
  // SP links
  const [spLinks, setSpLinks] = useState<Array<Record<string, unknown>>>([]);
  const [myIsp, setMyIsp] = useState<Record<string, unknown> | null>(null);

  // Agency desk
  const [pendingSchools, setPendingSchools] = useState<
    Array<Record<string, unknown>>
  >([]);
  const [activeSchools, setActiveSchools] = useState<
    Array<Record<string, unknown>>
  >([]);
  const [pendingSps, setPendingSps] = useState<Array<Record<string, unknown>>>(
    []
  );
  const [activeSps, setActiveSps] = useState<Array<Record<string, unknown>>>(
    []
  );
  const [searchQ, setSearchQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<Array<Record<string, unknown>>>([]);
  const [addAs, setAddAs] = useState<'school' | 'sp'>('school');
  const [approveNow, setApproveNow] = useState(true);
  const [schoolsOnSystem, setSchoolsOnSystem] = useState<
    Array<Record<string, unknown>>
  >([]);
  const [spsOnSystem, setSpsOnSystem] = useState<
    Array<Record<string, unknown>>
  >([]);
  const [dirFilter, setDirFilter] = useState('');
  const [addingId, setAddingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (programme.role === 'department') {
        const [agencyRes, ispRes, candRes] = await Promise.all([
          fetch(`/api/schools/agency?companyId=${companyId}&mode=agency`, {
            cache: 'no-store',
          }),
          fetch(`/api/schools/isps?companyId=${companyId}&mode=agency`, {
            cache: 'no-store',
          }),
          fetch('/api/schools/agency', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId,
              action: 'list_candidates',
            }),
          }),
        ]);
        const agencyData = await agencyRes.json();
        const ispData = await ispRes.json().catch(() => ({}));
        const candData = await candRes.json().catch(() => ({}));
        if (!agencyRes.ok) throw new Error(agencyData.error || 'Failed');
        const schools = (agencyData.schools || []) as Array<
          Record<string, unknown>
        >;
        setPendingSchools(
          schools.filter((s) => String(s.link_status || s.status) === 'pending')
        );
        setActiveSchools(
          schools.filter((s) => String(s.link_status || s.status) === 'active')
        );
        setPendingSps(ispData.pending || []);
        setActiveSps(ispData.compliant || []);
        if (candRes.ok) {
          setSchoolsOnSystem(candData.schools_on_system || []);
          setSpsOnSystem(candData.sps_on_system || []);
        }
      } else if (programme.role === 'sp') {
        const res = await fetch(
          `/api/schools/isps?companyId=${companyId}&mode=isp`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        setMyIsp(data.myIsp || null);
        setSpLinks(data.myAgencyLinks || []);
        setAgencies(data.agencies || []);
      } else {
        // school / facility
        const res = await fetch(
          `/api/schools/agency?companyId=${companyId}&mode=school`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        setSchoolLinks(data.links || []);
        setAgencies(data.agencies || []);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, programme.role]);

  useEffect(() => {
    if (!programme.loading) void load();
  }, [load, programme.loading]);

  const schoolJoin = async (agencyProfileId: number) => {
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
      toast.success(data.message || 'Join request sent — awaits approval');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const spRegisterAndJoin = async (agencyProfileId: number) => {
    try {
      if (!myIsp) {
        const reg = await fetch('/api/schools/isps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            action: 'register_as_isp',
            food_handling_cert: true,
          }),
        });
        const regData = await reg.json();
        if (!reg.ok) throw new Error(regData.error || 'Register failed');
      }
      const res = await fetch('/api/schools/isps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'join_agency',
          agency_profile_id: agencyProfileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(data.message || 'Join request sent — awaits approval');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const schoolLeave = async (agencyProfileId: number) => {
    if (!confirm('Leave this department?')) return;
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
      toast.success('Left department');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const spLeave = async (agencyProfileId: number) => {
    if (!confirm('Leave this department association?')) return;
    try {
      const res = await fetch('/api/schools/isps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'leave_agency',
          agency_profile_id: agencyProfileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Left department');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const approveSchool = async (schoolProfileId: number, action: 'approve' | 'reject' | 'suspend') => {
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
          ? 'School approved'
          : action === 'reject'
            ? 'Request rejected'
            : 'School suspended'
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const approveSp = async (
    link: Record<string, unknown>,
    action: 'approve_isp' | 'reject_isp' | 'suspend_isp'
  ) => {
    try {
      const res = await fetch('/api/schools/agency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: action === 'approve_isp' ? 'approve_isp_link' : action,
          link_id: Number(link.id) || undefined,
          isp_profile_id: Number(link.isp_profile_id) || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        action === 'approve_isp'
          ? 'SP approved'
          : action === 'reject_isp'
            ? 'SP rejected'
            : 'SP suspended'
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const runSearch = async () => {
    if (searchQ.trim().length < 2) {
      toast.message('Type a company name or id');
      return;
    }
    setSearching(true);
    try {
      const res = await fetch('/api/schools/agency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'search_companies',
          q: searchQ.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setHits(data.companies || []);
      if (!(data.companies || []).length) toast.message('No companies found');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const addCompany = async (
    targetId: number,
    as: 'school' | 'sp' = addAs,
    approve: boolean = approveNow
  ) => {
    setAddingId(targetId);
    try {
      const res = await fetch('/api/schools/agency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: as === 'school' ? 'add_school' : 'add_sp',
          school_company_id: as === 'school' ? targetId : undefined,
          isp_profile_id: as === 'sp' ? targetId : undefined,
          target_company_id: targetId,
          approve,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(data.message || 'Added');
      setHits([]);
      setSearchQ('');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setAddingId(null);
    }
  };

  const title =
    programme.role === 'department'
      ? 'Add & approve'
      : programme.role === 'sp'
        ? 'Join a department'
        : 'Join a department';
  const accent =
    programme.role === 'department'
      ? 'Schools & SPs'
      : programme.role === 'sp'
        ? 'As SP'
        : 'As school';
  const desc =
    programme.role === 'department'
      ? 'Search for a company and add them as a school or SP. Approve join requests, or add them already approved.'
      : programme.role === 'sp'
        ? 'One click to request association with DBE / PEU / DoH. They must approve before you can supply their facilities.'
        : 'One click to request association with DBE / PEU / DoH. They must approve before you can order and claim.';

  return (
    <SchoolsPage>
      <SchoolsHeader
        title={title}
        titleAccent={accent}
        description={desc}
        action={
          <div className="flex gap-2">
            {programme.role === 'department' ? (
              <Link
                href="/dashboard/schools/agency"
                className="btn-secondary !py-2 !px-3 text-xs"
              >
                Full desk
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

      {loading || programme.loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : programme.role === 'department' ? (
        <DepartmentDesk
          pendingSchools={pendingSchools}
          activeSchools={activeSchools}
          pendingSps={pendingSps}
          activeSps={activeSps}
          schoolsOnSystem={schoolsOnSystem}
          spsOnSystem={spsOnSystem}
          dirFilter={dirFilter}
          setDirFilter={setDirFilter}
          searchQ={searchQ}
          setSearchQ={setSearchQ}
          searching={searching}
          hits={hits}
          addAs={addAs}
          setAddAs={setAddAs}
          approveNow={approveNow}
          setApproveNow={setApproveNow}
          addingId={addingId}
          onSearch={() => void runSearch()}
          onAdd={(id, as, approve) => void addCompany(id, as, approve)}
          onApproveSchool={approveSchool}
          onApproveSp={approveSp}
        />
      ) : programme.role === 'sp' ? (
        <JoinDirectory
          kind="sp"
          agencies={agencies}
          myLinks={spLinks}
          onJoin={(id) => void spRegisterAndJoin(id)}
          onLeave={(id) => void spLeave(id)}
        />
      ) : (
        <JoinDirectory
          kind="school"
          agencies={agencies}
          myLinks={schoolLinks}
          onJoin={(id) => void schoolJoin(id)}
          onLeave={(id) => void schoolLeave(id)}
        />
      )}
    </SchoolsPage>
  );
}

function CandidateList({
  title,
  empty,
  rows,
  kind,
  addingId,
  approveNow,
  onAdd,
  linkedRows,
}: {
  title: string;
  empty: string;
  rows: Array<Record<string, unknown>>;
  kind: 'school' | 'sp';
  addingId: number | null;
  approveNow: boolean;
  onAdd: (id: number, as?: 'school' | 'sp', approve?: boolean) => void;
  linkedRows: Array<Record<string, unknown>>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      <div
        className={`px-4 py-2.5 text-xs font-bold uppercase flex items-center gap-1.5 ${
          kind === 'school'
            ? 'bg-sky-50 text-sky-900 border-b border-sky-100'
            : 'bg-amber-50 text-amber-900 border-b border-amber-100'
        }`}
      >
        {kind === 'school' ? (
          <School className="w-3.5 h-3.5" />
        ) : (
          <Truck className="w-3.5 h-3.5" />
        )}
        {title}
      </div>
      <ul className="divide-y max-h-72 overflow-y-auto">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-sm text-slate-500">{empty}</li>
        ) : (
          rows.map((r) => {
            const cid = Number(r.company_id);
            return (
              <li
                key={`${kind}-${cid}`}
                className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold truncate">{String(r.name)}</p>
                  <p className="text-[10px] text-slate-500">
                    id {cid}
                    {r.emis ? ` · EMIS ${String(r.emis)}` : ''}
                    {r.province ? ` · ${String(r.province)}` : ''}
                    {r.district ? ` · ${String(r.district)}` : ''}
                    {r.learners != null
                      ? ` · ${Number(r.learners)} learners`
                      : ''}
                    {r.compliance_status
                      ? ` · ${String(r.compliance_status)}`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={addingId === cid}
                  onClick={() => onAdd(cid, kind, approveNow)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold border ${
                    kind === 'school'
                      ? 'border-sky-200 bg-sky-50 text-sky-900'
                      : 'border-amber-200 bg-amber-50 text-amber-900'
                  }`}
                >
                  {addingId === cid ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : approveNow ? (
                    'Add + approve'
                  ) : (
                    'Add pending'
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
      {linkedRows.length > 0 ? (
        <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2">
          <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">
            Already under you ({linkedRows.length})
          </p>
          <ul className="text-[11px] text-slate-600 space-y-0.5 max-h-24 overflow-y-auto">
            {linkedRows.slice(0, 40).map((r) => (
              <li key={`lnk-${kind}-${String(r.company_id)}`}>
                <CheckCircle2 className="w-3 h-3 inline text-emerald-600 mr-1" />
                {String(r.name)}{' '}
                <span className="text-slate-400">
                  · {String(r.link_status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function JoinDirectory({
  kind,
  agencies,
  myLinks,
  onJoin,
  onLeave,
}: {
  kind: 'school' | 'sp';
  agencies: Array<Record<string, unknown>>;
  myLinks: Array<Record<string, unknown>>;
  onJoin: (agencyProfileId: number) => void;
  onLeave: (agencyProfileId: number) => void;
}) {
  const linked = new Set(
    myLinks
      .filter((l) => ['pending', 'active'].includes(String(l.status)))
      .map((l) => Number(l.agency_profile_id))
  );

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-black mb-1 flex items-center gap-2">
          {kind === 'sp' ? (
            <Truck className="w-4 h-4 text-amber-600" />
          ) : (
            <School className="w-4 h-4 text-sky-600" />
          )}
          My departments
        </h3>
        <p className="text-[11px] text-slate-500 mb-3">
          Pending = waiting for approval. Active = you can operate under them.
        </p>
        {myLinks.filter((l) => String(l.status) !== 'left').length === 0 ? (
          <p className="text-sm text-slate-500">
            Not linked yet — request to join from the list →
          </p>
        ) : (
          <ul className="space-y-2">
            {myLinks
              .filter((l) => String(l.status) !== 'left')
              .map((l) => {
                const st = String(l.status);
                return (
                  <li
                    key={String(l.id)}
                    className="flex items-center justify-between gap-2 border-b border-slate-50 py-2"
                  >
                    <div>
                      <p className="font-semibold text-sm">
                        {String(l.agency_name || l.agency_profile_id)}
                      </p>
                      <p
                        className={`text-[10px] font-bold uppercase ${
                          st === 'active'
                            ? 'text-emerald-700'
                            : st === 'pending'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {st === 'active'
                          ? 'Approved'
                          : st === 'pending'
                            ? 'Pending approval'
                            : st}
                      </p>
                    </div>
                    {(st === 'active' || st === 'pending') && (
                      <button
                        type="button"
                        onClick={() => onLeave(Number(l.agency_profile_id))}
                        className="btn-secondary !py-1 !px-2 text-[11px] inline-flex items-center gap-1"
                      >
                        <Unlink className="w-3 h-3" /> Leave
                      </button>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </div>

      <div className="rounded-3xl border-2 border-sky-100 bg-white p-5">
        <h3 className="text-sm font-black mb-1 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-violet-600" />
          Join DBE / DoH
        </h3>
        <p className="text-[11px] text-slate-500 mb-3">
          {kind === 'sp'
            ? 'Request association. Department approves — then you can supply their schools/clinics.'
            : 'Request association. Department approves — then you can order approved foods and claim.'}
        </p>
        {agencies.length === 0 ? (
          <p className="text-sm text-slate-500">
            No departments registered yet. Ask your DBE/DoH to register under
            Schools → Desk.
          </p>
        ) : (
          <ul className="space-y-2">
            {agencies.map((a) => {
              const id = Number(a.profile_id);
              const joined = linked.has(id);
              return (
                <li
                  key={String(a.profile_id || a.id)}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 py-2.5"
                >
                  <div>
                    <p className="font-semibold text-sm">
                      {String(a.agency_name)}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">
                      {String(a.agency_type || '').replace(/_/g, ' ')}
                      {a.province ? ` · ${String(a.province)}` : ''}
                    </p>
                  </div>
                  {joined ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Linked
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onJoin(id)}
                      className="btn-primary !py-1.5 !px-3 text-xs font-bold"
                    >
                      Request to join
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

function DepartmentDesk({
  pendingSchools,
  activeSchools,
  pendingSps,
  activeSps,
  schoolsOnSystem,
  spsOnSystem,
  dirFilter,
  setDirFilter,
  searchQ,
  setSearchQ,
  searching,
  hits,
  addAs,
  setAddAs,
  approveNow,
  setApproveNow,
  addingId,
  onSearch,
  onAdd,
  onApproveSchool,
  onApproveSp,
}: {
  pendingSchools: Array<Record<string, unknown>>;
  activeSchools: Array<Record<string, unknown>>;
  pendingSps: Array<Record<string, unknown>>;
  activeSps: Array<Record<string, unknown>>;
  schoolsOnSystem: Array<Record<string, unknown>>;
  spsOnSystem: Array<Record<string, unknown>>;
  dirFilter: string;
  setDirFilter: (v: string) => void;
  searchQ: string;
  setSearchQ: (v: string) => void;
  searching: boolean;
  hits: Array<Record<string, unknown>>;
  addAs: 'school' | 'sp';
  setAddAs: (v: 'school' | 'sp') => void;
  approveNow: boolean;
  setApproveNow: (v: boolean) => void;
  addingId: number | null;
  onSearch: () => void;
  onAdd: (id: number, as?: 'school' | 'sp', approve?: boolean) => void;
  onApproveSchool: (
    schoolProfileId: number,
    action: 'approve' | 'reject' | 'suspend'
  ) => void;
  onApproveSp: (
    link: Record<string, unknown>,
    action: 'approve_isp' | 'reject_isp' | 'suspend_isp'
  ) => void;
}) {
  const fq = dirFilter.trim().toLowerCase();
  const filterRow = (name: unknown, extra = '') => {
    if (!fq) return true;
    return `${String(name || '')} ${extra}`.toLowerCase().includes(fq);
  };
  const schoolAvail = schoolsOnSystem.filter(
    (s) => !s.already_linked && filterRow(s.name, `${s.province || ''} ${s.district || ''} ${s.emis || ''}`)
  );
  const schoolLinked = schoolsOnSystem.filter(
    (s) => s.already_linked && filterRow(s.name, `${s.province || ''}`)
  );
  const spAvail = spsOnSystem.filter(
    (s) => !s.already_linked && filterRow(s.name, `${s.province || ''} ${s.city || ''}`)
  );
  const spLinked = spsOnSystem.filter(
    (s) => s.already_linked && filterRow(s.name, `${s.province || ''}`)
  );

  return (
    <div className="space-y-4">
      {/* Quick pick: schools & SPs already on the platform */}
      <div className="rounded-3xl border-2 border-sky-100 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-black flex items-center gap-2">
              <School className="w-4 h-4 text-sky-600" />
              Schools &amp; SPs already on the system
            </h3>
            <p className="text-[11px] text-slate-600 mt-0.5">
              One-click add under your department. Toggle approve immediately
              below, or leave pending for later.
            </p>
          </div>
          <label className="text-xs min-w-[12rem]">
            <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Filter list
            </span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={dirFilter}
              onChange={(e) => setDirFilter(e.target.value)}
              placeholder="Name, province, EMIS…"
            />
          </label>
        </div>

        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={approveNow}
            onChange={(e) => setApproveNow(e.target.checked)}
          />
          Approve immediately when adding
        </label>

        <div className="grid lg:grid-cols-2 gap-4">
          <CandidateList
            title={`Schools on platform · ${schoolAvail.length} available`}
            empty="No school companies found yet."
            rows={schoolAvail}
            kind="school"
            addingId={addingId}
            approveNow={approveNow}
            onAdd={onAdd}
            linkedRows={schoolLinked}
          />
          <CandidateList
            title={`SPs on platform · ${spAvail.length} available`}
            empty="No SP companies found yet."
            rows={spAvail}
            kind="sp"
            addingId={addingId}
            approveNow={approveNow}
            onAdd={onAdd}
            linkedRows={spLinked}
          />
        </div>
      </div>

      {/* Add by search */}
      <div className="rounded-3xl border-2 border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5">
        <h3 className="text-sm font-black flex items-center gap-2 mb-1">
          <Plus className="w-4 h-4 text-violet-700" />
          Search any company
        </h3>
        <p className="text-[11px] text-slate-600 mb-3">
          Or find a company by name / id if they are not listed above (e.g.
          not yet tagged as school or SP).
        </p>
        <div className="flex flex-wrap gap-2 items-end mb-3">
          <label className="text-xs flex-1 min-w-[12rem]">
            <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Company name or id
            </span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSearch();
                }}
                placeholder="e.g. KZN NSNP School"
              />
            </div>
          </label>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-bold">
            <button
              type="button"
              onClick={() => setAddAs('school')}
              className={`px-3 py-2 ${
                addAs === 'school'
                  ? 'bg-sky-600 text-white'
                  : 'bg-white text-slate-600'
              }`}
            >
              As school
            </button>
            <button
              type="button"
              onClick={() => setAddAs('sp')}
              className={`px-3 py-2 ${
                addAs === 'sp'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-slate-600'
              }`}
            >
              As SP
            </button>
          </div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 px-1">
            <input
              type="checkbox"
              checked={approveNow}
              onChange={(e) => setApproveNow(e.target.checked)}
            />
            Approve immediately
          </label>
          <button
            type="button"
            onClick={onSearch}
            disabled={searching}
            className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
          >
            {searching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            Search
          </button>
        </div>
        {hits.length > 0 ? (
          <ul className="rounded-2xl border border-slate-200 bg-white divide-y max-h-56 overflow-y-auto">
            {hits.map((c) => {
              const already =
                addAs === 'school'
                  ? Boolean(c.already_school)
                  : Boolean(c.already_sp);
              return (
                <li
                  key={String(c.id)}
                  className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <div>
                    <p className="font-semibold">
                      {String(c.trading_name || c.legal_name || `Company ${c.id}`)}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      id {String(c.id)} · {String(c.org_type || c.business_type || '—')}
                      {c.city ? ` · ${String(c.city)}` : ''}
                    </p>
                  </div>
                  {already ? (
                    <span className="text-[11px] font-bold text-emerald-700">
                      Already linked
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={addingId === Number(c.id)}
                      onClick={() => onAdd(Number(c.id), addAs, approveNow)}
                      className="btn-primary !py-1.5 !px-3 text-xs"
                    >
                      {addingId === Number(c.id) ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                      ) : (
                        <>
                          Add as {addAs === 'school' ? 'school' : 'SP'}
                          {approveNow ? ' · approve' : ' · pending'}
                        </>
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* School queue */}
        <div className="rounded-3xl border border-sky-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-sky-100 bg-sky-50/60 text-xs font-bold uppercase text-sky-900 flex items-center gap-2">
            <School className="w-3.5 h-3.5" />
            Schools · {pendingSchools.length} pending · {activeSchools.length}{' '}
            approved
          </div>
          <ul className="divide-y max-h-80 overflow-y-auto">
            {pendingSchools.length === 0 && activeSchools.length === 0 ? (
              <li className="px-5 py-8 text-sm text-slate-500">
                No schools yet. Add one above, or wait for join requests.
              </li>
            ) : null}
            {pendingSchools.map((s) => (
              <li
                key={`p-${String(s.id || s.school_profile_id)}`}
                className="px-5 py-3 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <p className="font-bold text-sm">
                    {String(s.school_name || s.name || `School ${s.id}`)}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-amber-700">
                    Pending approval
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onApproveSchool(Number(s.id || s.school_profile_id), 'approve')
                    }
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-900"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onApproveSchool(Number(s.id || s.school_profile_id), 'reject')
                    }
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-800"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
            {activeSchools.map((s) => (
              <li
                key={`a-${String(s.id || s.school_profile_id)}`}
                className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 bg-emerald-50/20"
              >
                <div>
                  <p className="font-bold text-sm">
                    {String(s.school_name || s.name || `School ${s.id}`)}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-emerald-700">
                    Approved
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onApproveSchool(Number(s.id || s.school_profile_id), 'suspend')
                  }
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600"
                >
                  Suspend
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* SP queue */}
        <div className="rounded-3xl border border-amber-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-100 bg-amber-50/60 text-xs font-bold uppercase text-amber-900 flex items-center gap-2">
            <Truck className="w-3.5 h-3.5" />
            SPs · {pendingSps.length} pending · {activeSps.length} approved
          </div>
          <ul className="divide-y max-h-80 overflow-y-auto">
            {pendingSps.length === 0 && activeSps.length === 0 ? (
              <li className="px-5 py-8 text-sm text-slate-500">
                No SPs yet. Add one above, or wait for join requests.
              </li>
            ) : null}
            {pendingSps.map((link) => (
              <li
                key={`sp-p-${String(link.id || link.isp_profile_id)}`}
                className="px-5 py-3 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <p className="font-bold text-sm">
                    {String(
                      link.display_name ||
                        link.trading_name ||
                        `SP ${link.isp_profile_id}`
                    )}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-amber-700">
                    Pending approval
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => onApproveSp(link, 'approve_isp')}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-900"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => onApproveSp(link, 'reject_isp')}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-800"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
            {activeSps.map((link) => (
              <li
                key={`sp-a-${String(link.id || link.isp_profile_id)}`}
                className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 bg-emerald-50/20"
              >
                <div>
                  <p className="font-bold text-sm">
                    {String(
                      link.display_name ||
                        link.trading_name ||
                        `SP ${link.isp_profile_id}`
                    )}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-emerald-700">
                    Approved
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onApproveSp(link, 'suspend_isp')}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600"
                >
                  Suspend
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
