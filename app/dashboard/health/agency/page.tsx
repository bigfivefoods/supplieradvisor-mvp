'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  CheckCircle2,
  HeartPulse,
  Landmark,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  HealthHeader,
  HealthPage,
} from '@/components/health/HealthShell';
import { SA_PROVINCES } from '@/lib/schools/types';
import { AGENCY_TYPES } from '@/lib/entities/programme-hierarchy';

const HEALTH_TYPES = AGENCY_TYPES.filter((a) => a.family === 'health');

export default function HealthAgencyPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [agency, setAgency] = useState<Record<string, unknown> | null>(null);
  const [facilities, setFacilities] = useState<Array<Record<string, unknown>>>(
    []
  );
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [regName, setRegName] = useState('Department of Health');
  const [regType, setRegType] = useState('department_of_health');
  const [regProvince, setRegProvince] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'pending' | 'suspended'
  >('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/health/agency?companyId=${companyId}&mode=agency`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (res.status === 403 && data.redirect) {
        toast.message(data.error || 'Use Schools module for DBE');
        window.location.href = data.redirect;
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setAgency(data.agency || null);
      setFacilities(data.facilities || data.schools || []);
      setSummary(data.summary || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const register = async () => {
    try {
      const res = await fetch('/api/health/agency', {
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
      if (!res.ok) throw new Error(data.error || 'Register failed');
      if (data.pending_activation) {
        toast.message(
          data.message ||
            'Department registration submitted — programme tools unlock after platform activation.'
        );
      } else {
        toast.success('Registered as Department of Health');
      }
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const setStatus = async (
    facilityId: number,
    action: 'approve' | 'suspend' | 'reject'
  ) => {
    try {
      const res = await fetch('/api/health/agency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action,
          school_profile_id: facilityId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      toast.success(
        action === 'approve'
          ? 'Facility approved'
          : action === 'suspend'
            ? 'Suspended'
            : 'Rejected'
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const filtered = facilities.filter((f) => {
    const st = String(f.link_status || 'pending');
    if (statusFilter !== 'all' && st !== statusFilter) return false;
    const qq = q.trim().toLowerCase();
    if (!qq) return true;
    const hay = [f.facility_name, f.school_name, f.district, f.province, f.member_type]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(qq);
  });

  return (
    <HealthPage>
      <HealthHeader
        title="DoH desk"
        titleAccent="Department of Health only"
        mode="agency"
        description="Standalone health programme — clinics, hospitals and SPs. Schools / DBE live under the Schools module."
        action={
          <div className="flex gap-2">
            <Link
              href="/dashboard/health/report"
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              Coverage report
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
          <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-5">
            <p className="text-[10px] font-bold uppercase text-rose-700 mb-1">
              Hierarchy
            </p>
            <p className="font-black text-lg text-slate-900">
              DoH → SPs → Clinics &amp; hospitals
            </p>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Department of Health owns the approved food list and must approve
              both service providers and health facilities. This module is
              separate from DBE / NSNP schools.
            </p>
          </div>

          {!agency ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-black flex items-center gap-2 mb-3">
                <Landmark className="w-4 h-4 text-rose-600" />
                Register this company as DoH
              </h3>
              <div className="flex flex-wrap gap-2 items-end">
                <label className="text-xs">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Department name
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
                    {HEALTH_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
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
                  onClick={() => void register()}
                  className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
                >
                  <Building2 className="w-3.5 h-3.5" /> Register DoH
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm">
                Registered as <strong>{String(agency.agency_name)}</strong> (
                {String(agency.agency_type)})
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  {
                    label: 'Facilities',
                    value: Number(summary?.facilityCount || 0),
                    icon: HeartPulse,
                  },
                  {
                    label: 'Active',
                    value: Number(summary?.activeLinks || 0),
                    icon: CheckCircle2,
                  },
                  {
                    label: 'Pending',
                    value: Number(summary?.pendingLinks || 0),
                    icon: Users,
                  },
                  {
                    label: 'Hospitals',
                    value: Number(summary?.hospitals || 0),
                    icon: Building2,
                  },
                  {
                    label: 'Clinics',
                    value: Number(summary?.clinics || 0),
                    icon: HeartPulse,
                  },
                ].map((c) => (
                  <div
                    key={c.label}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400">
                      <c.icon className="w-3.5 h-3.5 text-rose-500" />
                      {c.label}
                    </div>
                    <div className="text-2xl font-black tabular-nums mt-1">
                      {c.value.toLocaleString('en-ZA')}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b flex flex-wrap gap-2 items-center justify-between">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Clinics &amp; hospitals
                  </p>
                  <div className="flex gap-2">
                    <select
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                      value={statusFilter}
                      onChange={(e) =>
                        setStatusFilter(
                          e.target.value as typeof statusFilter
                        )
                      }
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="suspended">Suspended</option>
                    </select>
                    <input
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs min-w-[160px]"
                      placeholder="Search…"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                    <Link
                      href="/dashboard/health/join"
                      className="btn-secondary !py-1.5 !px-3 text-xs"
                    >
                      Add facilities
                    </Link>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[60vh]">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                        <th className="px-4 py-3">Facility</th>
                        <th className="px-3 py-3">Type</th>
                        <th className="px-3 py-3">District</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3 text-right">Census / beds</th>
                        <th className="px-3 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-10 text-center text-slate-500"
                          >
                            No facilities yet — add clinics/hospitals from Join
                            &amp; add.
                          </td>
                        </tr>
                      ) : (
                        filtered.map((f) => {
                          const st = String(f.link_status || 'pending');
                          return (
                            <tr
                              key={String(f.id)}
                              className="border-b border-slate-50 hover:bg-rose-50/40"
                            >
                              <td className="px-4 py-2.5 font-semibold">
                                {String(f.facility_name || f.school_name)}
                              </td>
                              <td className="px-3 py-2.5 text-xs capitalize">
                                {String(f.member_type || 'hospital')}
                              </td>
                              <td className="px-3 py-2.5 text-xs">
                                {[f.district, f.province]
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
                                {Number(
                                  f.learner_count_enrolled || 0
                                ).toLocaleString('en-ZA')}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="inline-flex gap-1">
                                  {st !== 'active' ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void setStatus(Number(f.id), 'approve')
                                      }
                                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-900"
                                    >
                                      Approve
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void setStatus(Number(f.id), 'suspend')
                                      }
                                      className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600"
                                    >
                                      Suspend
                                    </button>
                                  )}
                                  {st === 'pending' ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void setStatus(Number(f.id), 'reject')
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
            </>
          )}
        </div>
      )}
    </HealthPage>
  );
}
