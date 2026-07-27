'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  HealthHeader,
  HealthPage,
} from '@/components/health/HealthShell';
import { useHealthProgrammeRole } from '@/lib/health/useProgrammeRole';

export default function HealthJoinPage() {
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
  const [agencies, setAgencies] = useState<Array<Record<string, unknown>>>([]);
  const [links, setLinks] = useState<Array<Record<string, unknown>>>([]);
  const [candidates, setCandidates] = useState<Array<Record<string, unknown>>>(
    []
  );
  const [memberType, setMemberType] = useState('hospital');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (programme.role === 'department') {
        const res = await fetch('/api/health/agency', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, action: 'list_candidates' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        setCandidates(data.facilities || []);
      } else {
        const res = await fetch(
          `/api/health/agency?companyId=${companyId}&mode=facility`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        setAgencies(data.agencies || []);
        setLinks(data.links || []);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, programme.role]);

  useEffect(() => {
    if (!programme.loading) void load();
  }, [programme.loading, load]);

  const join = async (agencyProfileId: number) => {
    try {
      const res = await fetch('/api/health/agency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'join',
          agency_profile_id: agencyProfileId,
          member_type: memberType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Join failed');
      toast.success('Join request sent to DoH');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const approve = async (schoolProfileId: number) => {
    try {
      const res = await fetch('/api/health/agency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'approve',
          school_profile_id: schoolProfileId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approve failed');
      toast.success('Facility approved');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
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

  return (
    <HealthPage>
      <HealthHeader
        title="Join & add"
        titleAccent={
          programme.role === 'department' ? 'DoH' : 'Facility / SP'
        }
        mode={programme.role === 'department' ? 'agency' : 'facility'}
        description={
          programme.role === 'department'
            ? 'Add clinics and hospitals already on the platform, or approve join requests.'
            : 'Request to join Department of Health. Schools join DBE under the Schools module.'
        }
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-3 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        }
      />

      {programme.role === 'department' ? (
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500">
            Health facilities on platform
          </div>
          <ul className="divide-y max-h-[70vh] overflow-y-auto">
            {candidates.length === 0 ? (
              <li className="px-5 py-10 text-sm text-slate-500 text-center">
                No clinics/hospitals registered yet.
              </li>
            ) : (
              candidates.map((c) => (
                <li
                  key={String(c.school_profile_id)}
                  className="px-5 py-3 flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-bold text-sm">{String(c.name)}</p>
                    <p className="text-[11px] text-slate-500 capitalize">
                      {String(c.member_type || 'hospital')} ·{' '}
                      {[c.district, c.province].filter(Boolean).join(', ') ||
                        '—'}
                      {c.link_status
                        ? ` · ${String(c.link_status)}`
                        : ' · not linked'}
                    </p>
                  </div>
                  {c.already_linked ? (
                    <span className="text-[10px] font-bold uppercase text-emerald-700">
                      {String(c.link_status)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        void approve(Number(c.school_profile_id))
                      }
                      className="btn-primary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add + approve
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <label className="text-xs font-semibold text-slate-600">
              Facility type
              <select
                className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                value={memberType}
                onChange={(e) => setMemberType(e.target.value)}
              >
                <option value="hospital">Hospital</option>
                <option value="clinic">Clinic</option>
                <option value="shelter">Shelter / care home</option>
              </select>
            </label>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b text-xs font-bold uppercase text-slate-500">
              DoH departments you can join
            </div>
            <ul className="divide-y">
              {agencies.length === 0 ? (
                <li className="px-5 py-10 text-sm text-slate-500 text-center">
                  No DoH registered yet. The health department company must
                  register under Health → DoH desk.
                </li>
              ) : (
                agencies.map((a) => {
                  const already = links.some(
                    (l) =>
                      Number(l.agency_profile_id) === Number(a.profile_id) &&
                      l.status !== 'left'
                  );
                  return (
                    <li
                      key={String(a.id)}
                      className="px-5 py-3 flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="font-bold text-sm">
                          {String(a.agency_name)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {String(a.agency_type)} ·{' '}
                          {String(a.province || 'National')}
                        </p>
                      </div>
                      {already ? (
                        <span className="text-[10px] font-bold uppercase text-emerald-700">
                          Requested / linked
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void join(Number(a.profile_id))}
                          className="btn-primary !py-1.5 !px-3 text-xs"
                        >
                          Request join
                        </button>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
          <p className="text-xs text-slate-500">
            Looking for schools / DBE?{' '}
            <Link
              href="/dashboard/schools/join"
              className="font-bold text-[#0077b6]"
            >
              Open Schools join →
            </Link>
          </p>
        </div>
      )}
    </HealthPage>
  );
}
