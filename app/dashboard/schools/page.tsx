'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  Users,
  ChefHat,
  Truck,
  Award,
  UtensilsCrossed,
  ClipboardCheck,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

type School = {
  id: number;
  school_name: string;
  emis_number?: string | null;
  province?: string | null;
  district?: string | null;
  learner_count_enrolled?: number;
  learner_count_verified?: number;
  learner_count_nsnp_eligible?: number;
  staff_count?: number;
  has_on_site_kitchen?: boolean;
};

type Kpis = {
  learnersEnrolled: number;
  learnersVerified: number;
  verifyPct: number;
  mealsServed: number;
  approvedBrandPct: number;
  stockLines: number;
  openPos: number;
  ispLinks: number;
  openCompliance: number;
};

export default function SchoolsHubPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<School | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [prizeScore, setPrizeScore] = useState<number | null>(null);
  const [prizeRank, setPrizeRank] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, rRes, zRes] = await Promise.all([
        fetch(`/api/schools/profile?companyId=${companyId}`, {
          cache: 'no-store',
        }),
        fetch(
          `/api/schools/report?companyId=${companyId}&report=overview`,
          { cache: 'no-store' }
        ),
        fetch(`/api/schools/prizes?companyId=${companyId}`, {
          cache: 'no-store',
        }),
      ]);
      const p = await pRes.json();
      const r = await rRes.json();
      const z = await zRes.json();
      if (!pRes.ok) throw new Error(p.error || 'Failed to load school');
      setSchool(p.school);
      if (rRes.ok) setKpis(r.kpis || null);
      if (zRes.ok && z.score) {
        setPrizeScore(z.score.total);
        setPrizeRank(z.score.rank);
      }
      if (p.error) toast.message(p.error);
      if (r.warning || r.warnings?.[0]) {
        toast.message(String(r.warning || r.warnings[0]));
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

  const tiles = [
    {
      href: '/dashboard/schools/learners',
      icon: Users,
      label: 'Learners',
      value: kpis?.learnersEnrolled ?? school?.learner_count_enrolled ?? '—',
      sub: `${kpis?.verifyPct ?? 0}% verified`,
    },
    {
      href: '/dashboard/schools/feeding',
      icon: UtensilsCrossed,
      label: 'Meals served',
      value: kpis?.mealsServed ?? '—',
      sub: 'Period to date',
    },
    {
      href: '/dashboard/schools/kitchen',
      icon: ChefHat,
      label: 'Kitchen stock',
      value: kpis?.stockLines ?? '—',
      sub: 'SKU lines',
    },
    {
      href: '/dashboard/schools/orders',
      icon: Truck,
      label: 'Open POs',
      value: kpis?.openPos ?? '—',
      sub: `${kpis?.ispLinks ?? 0} ISP links`,
    },
    {
      href: '/dashboard/schools/approved-list',
      icon: ClipboardCheck,
      label: 'Approved brand %',
      value:
        kpis?.approvedBrandPct != null ? `${kpis.approvedBrandPct}%` : '—',
      sub: 'Prize driver',
    },
    {
      href: '/dashboard/schools/prizes',
      icon: Award,
      label: 'Prize score',
      value: prizeScore != null ? prizeScore.toFixed(1) : '—',
      sub: prizeRank ? `Rank #${prizeRank}` : 'Quarterly',
    },
  ];

  return (
    <SchoolsPage>
      <SchoolsHeader
        title={school?.school_name || 'School NSNP'}
        titleAccent="Command"
        description={
          school
            ? [
                school.emis_number && `EMIS ${school.emis_number}`,
                school.district,
                school.province,
              ]
                .filter(Boolean)
                .join(' · ') ||
              'Own kitchen · strict approved brands · ISP procurement · headmaster prizes'
            : 'Register your school kitchen and start NSNP operations'
        }
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          {(kpis?.openCompliance || 0) > 0 ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {kpis!.openCompliance} open compliance item
              {kpis!.openCompliance === 1 ? '' : 's'} —{' '}
              <Link
                href="/dashboard/schools/compliance"
                className="font-bold underline"
              >
                review
              </Link>
            </div>
          ) : null}

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {tiles.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="rounded-3xl border border-slate-200 bg-white p-4 hover:border-[#00b4d8]/40 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  <t.icon className="w-3.5 h-3.5 text-[#00b4d8]" />
                  {t.label}
                </div>
                <div className="text-2xl font-black text-slate-900 tabular-nums">
                  {t.value}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">{t.sub}</div>
              </Link>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              {
                href: '/dashboard/schools/profile',
                label: 'School profile & map pin',
                desc: 'EMIS, GPS, principal, kitchen flags',
              },
              {
                href: '/dashboard/schools/learners',
                label: 'Import & verify learners',
                desc: 'Excel-compatible CSV template',
              },
              {
                href: '/dashboard/schools/approved-list',
                label: 'Edit approved brands',
                desc: 'Add / edit / deactivate catalogue',
              },
              {
                href: '/dashboard/schools/menu',
                label: 'School menu cycle',
                desc: 'Weekly dishes linked to approved products',
              },
              {
                href: '/dashboard/schools/agency',
                label: 'Join DBE / PEU',
                desc: 'Associate with government agency',
              },
              {
                href: '/dashboard/schools/report',
                label: 'Slice & dice reports',
                desc: 'Meals, stock, compliance, district',
              },
            ].map((x) => (
              <Link
                key={x.href}
                href={x.href}
                className="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-4 hover:border-[#00b4d8]"
              >
                <p className="font-bold text-slate-900 text-sm">{x.label}</p>
                <p className="text-xs text-slate-500 mt-1">{x.desc}</p>
              </Link>
            ))}
          </div>

          <p className="mt-6 text-xs text-slate-400 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            Enable the Schools module under Company → Modules if this rail is
            missing for other team members. Run migration{' '}
            <code className="text-[10px]">20260726_schools_nsnp_module.sql</code>
            .
          </p>
        </>
      )}
    </SchoolsPage>
  );
}
