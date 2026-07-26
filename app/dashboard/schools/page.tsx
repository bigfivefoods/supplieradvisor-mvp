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
  Camera,
  MessageSquareHeart,
  ShieldAlert,
  Wrench,
  ArrowRight,
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
  photo_url?: string | null;
  motto?: string | null;
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
  const [surveyAvg, setSurveyAvg] = useState<number | null>(null);
  const [surveyResponses, setSurveyResponses] = useState(0);
  const [riadOpen, setRiadOpen] = useState(0);
  const [maintOpen, setMaintOpen] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, rRes, zRes, sRes, riadRes, mRes] = await Promise.all([
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
        fetch(`/api/schools/surveys?companyId=${companyId}`, {
          cache: 'no-store',
        }),
        fetch(`/api/schools/riad?companyId=${companyId}&status=open`, {
          cache: 'no-store',
        }),
        fetch(`/api/schools/maintenance?companyId=${companyId}`, {
          cache: 'no-store',
        }),
      ]);
      const p = await pRes.json();
      const r = await rRes.json();
      const z = await zRes.json();
      const s = await sRes.json().catch(() => ({}));
      const riad = await riadRes.json().catch(() => ({}));
      const m = await mRes.json().catch(() => ({}));
      if (!pRes.ok) throw new Error(p.error || 'Failed to load school');
      setSchool(p.school);
      if (rRes.ok) setKpis(r.kpis || null);
      if (zRes.ok && z.score) {
        setPrizeScore(z.score.total);
        setPrizeRank(z.score.rank);
      }
      if (sRes.ok && s.summary) {
        setSurveyAvg(s.summary.avgRating ?? null);
        setSurveyResponses(s.summary.responses ?? 0);
      }
      if (riadRes.ok && riad.summary) {
        setRiadOpen(
          (riad.summary.open || 0) + (riad.summary.inProgress || 0)
        );
      }
      if (mRes.ok && m.summary) {
        setMaintOpen((m.summary.open || 0) + (m.summary.inProgress || 0));
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

  const primaryActions = [
    {
      href: '/dashboard/schools/serve-day',
      icon: UtensilsCrossed,
      label: 'Serve day',
      desc: 'Menu → present → meals → waste',
      accent: 'from-sky-500 to-cyan-400',
    },
    {
      href: '/dashboard/schools/surveys',
      icon: MessageSquareHeart,
      label: 'Food surveys',
      desc:
        surveyResponses > 0
          ? `${surveyResponses} responses · ${surveyAvg != null ? surveyAvg.toFixed(1) + '★' : 'live'}`
          : 'Learner & parent feedback',
      accent: 'from-violet-500 to-fuchsia-400',
    },
    {
      href: '/dashboard/schools/riad',
      icon: ShieldAlert,
      label: 'RIAD log',
      desc: riadOpen > 0 ? `${riadOpen} open items` : 'Risks & decisions',
      accent: 'from-amber-500 to-orange-400',
    },
    {
      href: '/dashboard/schools/maintenance',
      icon: Wrench,
      label: 'Maintenance',
      desc: maintOpen > 0 ? `${maintOpen} open fixes` : 'Kitchen & campus',
      accent: 'from-emerald-500 to-teal-400',
    },
  ];

  const tiles = [
    {
      href: '/dashboard/schools/learners',
      icon: Users,
      label: 'Learners',
      value: kpis?.learnersEnrolled ?? school?.learner_count_enrolled ?? '—',
      sub: `${kpis?.verifyPct ?? 0}% verified`,
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
    {
      href: '/dashboard/schools/profile',
      icon: Camera,
      label: 'School photo',
      value: school?.photo_url ? '✓' : 'Add',
      sub: school?.photo_url ? 'On profile' : 'Build pride',
    },
  ];

  return (
    <SchoolsPage>
      <SchoolsHeader
        title={school?.school_name || 'School NSNP'}
        titleAccent="Command"
        description={
          school?.motto ||
          (school
            ? [
                school.emis_number && `EMIS ${school.emis_number}`,
                school.district,
                school.province,
              ]
                .filter(Boolean)
                .join(' · ') ||
              'Own kitchen · approved brands · better meals for every child'
            : 'Register your school and start improving meals & learning')
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
          {/* Hero identity */}
          <div className="mb-6 rounded-3xl border border-slate-200 bg-white overflow-hidden flex flex-col sm:flex-row">
            <div className="sm:w-40 h-36 sm:h-auto shrink-0 bg-gradient-to-br from-sky-100 to-emerald-50 relative">
              {school?.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={school.photo_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[#0077b6]">
                  <Camera className="w-8 h-8 opacity-60" />
                  <Link
                    href="/dashboard/schools/profile"
                    className="text-[11px] font-bold underline"
                  >
                    Add photo
                  </Link>
                </div>
              )}
            </div>
            <div className="p-5 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
                Principal command centre
              </p>
              <h2 className="text-xl font-black text-slate-900 mt-0.5">
                {school?.school_name || 'Your school'}
              </h2>
              <p className="text-sm text-slate-500 mt-1 max-w-xl">
                Improve education quality and the meals children receive —
                one clear screen for today&apos;s serve, feedback, risks, and
                fixes.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Link
                  href="/dashboard/schools/serve-day"
                  className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
                >
                  Start serve day <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/dashboard/schools/surveys"
                  className="btn-secondary !py-2 !px-3 text-xs"
                >
                  Share food survey
                </Link>
              </div>
            </div>
          </div>

          {(kpis?.openCompliance || 0) > 0 || riadOpen > 0 || maintOpen > 0 ? (
            <div className="mb-4 space-y-2">
              {(kpis?.openCompliance || 0) > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex gap-2">
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
              {riadOpen > 0 ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950 flex gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  {riadOpen} open RIAD item{riadOpen === 1 ? '' : 's'} —{' '}
                  <Link
                    href="/dashboard/schools/riad"
                    className="font-bold underline"
                  >
                    lead the list
                  </Link>
                </div>
              ) : null}
              {maintOpen > 0 ? (
                <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950 flex gap-2">
                  <Wrench className="w-4 h-4 shrink-0 mt-0.5" />
                  {maintOpen} open maintenance fix
                  {maintOpen === 1 ? '' : 'es'} —{' '}
                  <Link
                    href="/dashboard/schools/maintenance"
                    className="font-bold underline"
                  >
                    clear the queue
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Big 4 principal actions */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {primaryActions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 hover:shadow-md transition-all"
              >
                <div
                  className={`w-9 h-9 rounded-xl bg-gradient-to-br ${a.accent} text-white flex items-center justify-center mb-3 shadow-sm`}
                >
                  <a.icon className="w-4 h-4" />
                </div>
                <p className="font-black text-slate-900 text-sm">{a.label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  {a.desc}
                </p>
              </Link>
            ))}
          </div>

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
                href: '/dashboard/schools/serve-day',
                label: 'Serve day (W1)',
                desc: 'Menu → present → meals → waste in one tap flow',
              },
              {
                href: '/dashboard/schools/visits',
                label: 'PEU visits (W1)',
                desc: 'Field monitor checklist for approved schools',
              },
              {
                href: '/dashboard/schools/claims',
                label: 'Claims & cost (W2)',
                desc: 'Cost per meal + funding pack CSV',
              },
              {
                href: '/dashboard/schools/isp-sla',
                label: 'ISP SLA (W3)',
                desc: 'Delivery quality & brand compliance',
              },
              {
                href: '/dashboard/schools/emis',
                label: 'EMIS attest (W4)',
                desc: 'Grade headcounts + term attestation',
              },
              {
                href: '/dashboard/schools/audit',
                label: 'Audit pack (W5)',
                desc: 'Hashed evidence + public transparency',
              },
              {
                href: '/dashboard/schools/agency',
                label: 'Join DBE / PEU',
                desc: 'Approve associations',
              },
              {
                href: '/dashboard/schools/agency-report',
                label: 'Agency pack',
                desc: 'Multi-school heatmaps & risks',
              },
              {
                href: '/dashboard/schools/prizes',
                label: 'Fair prizes',
                desc: 'National / province / quintile ranks',
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
            <code className="text-[10px]">
              20260726_schools_photo_survey_riad_maintenance.sql
            </code>
            .
          </p>
        </>
      )}
    </SchoolsPage>
  );
}
