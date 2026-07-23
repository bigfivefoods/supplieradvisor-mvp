'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Wallet,
  CalendarDays,
  Network,
  GraduationCap,
  Star,
  ClipboardList,
  Loader2,
  ArrowRight,
  Building2,
  Scale,
} from 'lucide-react';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import {
  HubHero,
  HubModuleGrid,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney } from '@/lib/accounting/types';
import { statusBadgeClass } from '@/lib/hr/types';

type Summary = {
  migration_required?: boolean;
  warning?: string;
  hint?: string;
  counts?: {
    total: number;
    active: number;
    onLeave: number;
    probation: number;
    terminated: number;
    allocated: number;
    unallocated: number;
    onboardingOpen: number;
    leavePending: number;
    payrollOpen: number;
    disciplinaryOpen?: number;
    withManager?: number;
    withoutManager?: number;
  };
  monthlyWageBill?: number;
  lastPayrollNet?: number;
  recent?: Array<{
    id: number;
    full_name: string;
    job_title?: string;
    status?: string;
    start_date?: string;
  }>;
};

const MODULES: HubModule[] = [
  {
    href: '/dashboard/people/directory',
    icon: Users,
    code: '01',
    title: 'Directory',
    desc: 'Full employee master — every person must sit on a business unit.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/people/org-chart',
    icon: Network,
    code: '02',
    title: 'Organogram',
    desc: 'Business units → work centres → who reports to whom.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
  {
    href: '/dashboard/people/performance',
    icon: Star,
    code: '03',
    title: 'Performance',
    desc: 'Official ratings & continuous feedback (quality, delivery, teamwork).',
    accent: 'from-rose-50 to-white border-rose-100',
  },
  {
    href: '/dashboard/people/disciplinary',
    icon: Scale,
    code: '04',
    title: 'Disciplinary',
    desc: 'Cases, investigations, hearings, sanctions, and close-out.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/people/payroll',
    icon: Wallet,
    code: '05',
    title: 'Payroll',
    desc: 'Runs, PAYE/UIF proxies, approve, pay, GL, labour to cost centres.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/people/leave',
    icon: CalendarDays,
    code: '06',
    title: 'Leave',
    desc: 'Annual, sick, family leave with approval and balances.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/people/training',
    icon: GraduationCap,
    code: '07',
    title: 'Training',
    desc: 'Assign courses, track completion, certificates.',
    accent: 'from-indigo-50 to-white border-indigo-100',
  },
  {
    href: '/dashboard/people/onboarding',
    icon: ClipboardList,
    code: '08',
    title: 'Onboarding',
    desc: 'New-hire checklists from contract to system access.',
    accent: 'from-slate-50 to-white border-slate-200',
  },
];

export default function PeopleHubPage() {
  const companyId = getSelectedCompanyId();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/summary?companyId=${companyId}`);
      const data = await res.json();
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const c = summary?.counts;

  return (
    <RelationshipPage>
      <RelationshipHeader
        title="People"
        titleAccent="HR"
        description="Full people lifecycle — organogram by business unit, reporting lines, performance ratings, disciplinary process, leave, payroll, and training."
        action={
          <Link
            href="/dashboard/people/directory?new=1"
            className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> Add employee
          </Link>
        }
      />

      {summary?.migration_required && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Migration required.</strong>{' '}
          {summary.hint || 'Run supabase/migrations/20260723_hr_people_module.sql'}
          {summary.warning ? ` · ${summary.warning}` : ''}
        </div>
      )}

      <HubHero
        pill="People · Command"
        title="Your workforce,"
        titleAccent="allocated and paid"
        description="Every person links to business units, work centres, and assets so labour costs roll into cost centres and the books."
        stats={[
          { label: 'Headcount', value: c?.total ?? '—' },
          {
            label: 'Active',
            value: c?.active ?? '—',
            valueClass: 'text-emerald-700',
          },
          {
            label: 'Wage bill / mo',
            value: formatMoney(summary?.monthlyWageBill || 0),
          },
          {
            label: 'Unallocated',
            value: c?.unallocated ?? '—',
            valueClass:
              (c?.unallocated || 0) > 0 ? 'text-amber-700' : undefined,
          },
        ]}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          <HubTelemetryGrid>
            <TelemetryCard
              label="On leave"
              value={c?.onLeave ?? 0}
              accent="amber"
              icon={CalendarDays}
              href="/dashboard/people/leave"
            />
            <TelemetryCard
              label="Leave pending"
              value={c?.leavePending ?? 0}
              accent="violet"
              icon={ClipboardList}
              href="/dashboard/people/leave"
            />
            <TelemetryCard
              label="Allocated to cost centres"
              value={c?.allocated ?? 0}
              sub={`${c?.unallocated ?? 0} still need placement`}
              accent="cyan"
              icon={Building2}
              href="/dashboard/people/directory"
            />
            <TelemetryCard
              label="Payroll open"
              value={c?.payrollOpen ?? 0}
              sub={
                summary?.lastPayrollNet
                  ? `Last paid net ${formatMoney(summary.lastPayrollNet)}`
                  : 'Calculate a run'
              }
              accent="emerald"
              icon={Wallet}
              href="/dashboard/people/payroll"
            />
            <TelemetryCard
              label="Disciplinary open"
              value={c?.disciplinaryOpen ?? 0}
              accent="rose"
              icon={Scale}
              href="/dashboard/people/disciplinary"
            />
            <TelemetryCard
              label="Without manager"
              value={c?.withoutManager ?? 0}
              sub={`${c?.withManager ?? 0} have a manager`}
              accent="slate"
              icon={Network}
              href="/dashboard/people/org-chart"
            />
          </HubTelemetryGrid>

          <HubModuleGrid modules={MODULES} />

          {(summary?.recent || []).length > 0 && (
            <div className="mt-8 rounded-3xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900">Recent joiners</h3>
                <Link
                  href="/dashboard/people/directory"
                  className="text-xs font-bold text-[#00b4d8] inline-flex items-center gap-1"
                >
                  Full directory <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <ul className="divide-y divide-slate-50">
                {summary!.recent!.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {r.full_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {r.job_title || '—'}
                        {r.start_date ? ` · started ${r.start_date}` : ''}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadgeClass(r.status)}`}
                    >
                      {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </RelationshipPage>
  );
}
