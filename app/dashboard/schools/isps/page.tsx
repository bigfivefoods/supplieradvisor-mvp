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
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

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
  const [directory, setDirectory] = useState<Array<Record<string, unknown>>>(
    []
  );
  const [schoolAgencyActiveCount, setSchoolAgencyActiveCount] = useState(0);

  // ISP view
  const [myIsp, setMyIsp] = useState<Record<string, unknown> | null>(null);
  const [myAgencyLinks, setMyAgencyLinks] = useState<
    Array<Record<string, unknown>>
  >([]);
  const [agencies, setAgencies] = useState<Array<Record<string, unknown>>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Auto mode returns school / isp / agency based on company profile
      const res = await fetch(`/api/schools/isps?companyId=${companyId}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      const r = (data.role || 'school') as ViewRole;
      setRole(r);
      setPolicy(String(data.policy || ''));

      if (r === 'isp') {
        setMyIsp(data.myIsp || null);
        setMyAgencyLinks(data.myAgencyLinks || []);
        setAgencies(data.agencies || []);
      } else if (r === 'agency') {
        // Agencies manage ISP associations on the DBE page
        setLinks([]);
        setDirectory([]);
      } else {
        setLinks(data.links || []);
        setDirectory(data.directory || []);
        setSchoolAgencyActiveCount(Number(data.schoolAgencyActiveCount || 0));
        setMyIsp(data.myIsp || null);
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

  const registerAsIsp = async () => {
    try {
      const res = await fetch('/api/schools/isps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          'Registered as ISP — now request to join a DBE/PEU/DoH department'
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

  const linkIsp = async (ispProfileId: number) => {
    try {
      const res = await fetch('/api/schools/isps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          isp_profile_id: ispProfileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('ISP linked to school');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const isIsp = role === 'isp' || Boolean(myIsp);
  const headerDesc =
    role === 'isp'
      ? 'Request association with DBE / PEU / DoH. They must approve before schools under them can order from you — same join-and-approve model as schools.'
      : role === 'agency'
        ? 'Manage ISP join requests under Schools → DBE (agency desk).'
        : 'ISPs must join your department and be approved. Your school must also be approved by that department. Only then can you link and order.';

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="ISPs"
        titleAccent={
          role === 'isp' ? 'Join a department' : 'Department-associated only'
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
                <Landmark className="w-3.5 h-3.5" /> ISP queue on DBE desk
              </Link>
            ) : null}
            {!isIsp && role !== 'agency' ? (
              <button
                type="button"
                onClick={() => void registerAsIsp()}
                className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                <Building2 className="w-3.5 h-3.5" /> Register as ISP
              </button>
            ) : null}
            {isIsp && !myIsp ? (
              <button
                type="button"
                onClick={() => void registerAsIsp()}
                className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                <Building2 className="w-3.5 h-3.5" /> Complete ISP profile
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
          'ISPs and schools both request to join a DBE/PEU/DoH. The department must approve each association. Schools only trade with ISPs approved under the same department.'}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : role === 'agency' ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <Landmark className="w-10 h-10 mx-auto text-amber-600 mb-3" />
          <p className="font-black text-slate-900">
            Agency desk for ISP associations
          </p>
          <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
            ISPs request to join your department. Approve them on the DBE /
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
          agencies={agencies}
          onJoin={joinAgency}
          onLeave={leaveAgency}
          onRegister={registerAsIsp}
        />
      ) : (
        <SchoolIspView
          links={links}
          directory={directory}
          schoolAgencyActiveCount={schoolAgencyActiveCount}
          onLink={linkIsp}
        />
      )}
    </SchoolsPage>
  );
}

function IspJoinView({
  myIsp,
  myAgencyLinks,
  agencies,
  onJoin,
  onLeave,
  onRegister,
}: {
  myIsp: Record<string, unknown> | null;
  myAgencyLinks: Array<Record<string, unknown>>;
  agencies: Array<Record<string, unknown>>;
  onJoin: (id: number) => void;
  onLeave: (id: number) => void;
  onRegister: () => void;
}) {
  if (!myIsp) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <Building2 className="w-10 h-10 mx-auto text-slate-400 mb-3" />
        <p className="font-black">Register as an ISP first</p>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Then request to join each department (DBE / PEU / DoH) you want to
          supply. They must approve — same as schools joining an agency.
        </p>
        <button
          type="button"
          onClick={() => void onRegister()}
          className="btn-primary !py-2 !px-4 text-sm mt-4"
        >
          Register as ISP
        </button>
      </div>
    );
  }

  const activeOrPending = new Set(
    myAgencyLinks
      .filter((l) => ['pending', 'active'].includes(String(l.status)))
      .map((l) => Number(l.agency_profile_id))
  );

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-black mb-1">My department associations</h3>
        <p className="text-[11px] text-slate-500 mb-3">
          Profile · {String(myIsp.trading_name || myIsp.profile_id)} · global
          status {String(myIsp.compliance_status || 'pending')}
        </p>
        {myAgencyLinks.length === 0 ? (
          <p className="text-sm text-slate-500">
            Not associated with any department yet. Join from the directory —
            schools under that department can only order after they approve you.
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
                        ? 'Approved · may supply their schools'
                        : st === 'pending'
                          ? 'Pending department approval'
                          : st}
                    </span>
                  </div>
                  {st === 'active' || st === 'pending' ? (
                    <button
                      type="button"
                      onClick={() =>
                        void onLeave(Number(l.agency_profile_id))
                      }
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

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-black mb-1">
          Join DBE / PEU / DoH directory
        </h3>
        <p className="text-[11px] text-slate-500 mb-3">
          Request association. The department must approve before their schools
          can buy from you.
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
  directory,
  schoolAgencyActiveCount,
  onLink,
}: {
  links: Array<Record<string, unknown>>;
  directory: Array<Record<string, unknown>>;
  schoolAgencyActiveCount: number;
  onLink: (ispProfileId: number) => void;
}) {
  return (
    <div className="space-y-4">
      {schoolAgencyActiveCount === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Your school must <strong>join and be approved</strong> by a DBE/PEU/DoH
          before the approved-ISP directory unlocks.{' '}
          <Link
            href="/dashboard/schools/agency"
            className="font-bold underline underline-offset-2"
          >
            Request association
          </Link>
        </div>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-black mb-3">Linked to this school</h3>
          {links.length === 0 ? (
            <p className="text-sm text-slate-500">
              No ISPs linked yet. Choose from providers approved by your
              department.
            </p>
          ) : (
            <ul className="space-y-2">
              {links.map((l) => (
                <li
                  key={String(l.id)}
                  className="flex justify-between text-sm border-b border-slate-50 py-2"
                >
                  <span className="font-semibold">
                    {String(l.display_name || l.isp_profile_id)}
                  </span>
                  <span className="text-xs capitalize text-slate-500">
                    {String(l.status)}
                    {l.agency_approved === false
                      ? ' · not on agency list'
                      : ' · agency OK'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-black mb-1">
            Department-approved ISP directory
          </h3>
          <p className="text-[11px] text-slate-500 mb-3">
            Only ISPs that joined your school&apos;s department and were
            approved appear here.
          </p>
          {directory.length === 0 ? (
            <p className="text-sm text-slate-500">
              No approved ISPs for your department yet. Providers register,
              request to join the same DBE/PEU/DoH, and await approval.
            </p>
          ) : (
            <ul className="space-y-2">
              {directory.map((d) => (
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
                  <button
                    type="button"
                    onClick={() => void onLink(Number(d.profile_id))}
                    className="btn-secondary !py-1 !px-2 text-[11px] inline-flex items-center gap-1"
                  >
                    <Link2 className="w-3 h-3" /> Link
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
