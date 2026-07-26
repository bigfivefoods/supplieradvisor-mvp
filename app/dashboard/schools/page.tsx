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
  Building2,
  Landmark,
  BarChart3,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import type { SchoolReadiness } from '@/lib/schools/process';

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
  const [role, setRole] = useState<'school' | 'agency'>('school');
  const [school, setSchool] = useState<Record<string, unknown> | null>(null);
  const [readiness, setReadiness] = useState<SchoolReadiness | null>(null);
  const [agencySummary, setAgencySummary] = useState<Record<
    string,
    number
  > | null>(null);
  const [agencyNext, setAgencyNext] = useState<{
    label: string;
    href: string;
    desc: string;
  } | null>(null);
  const [prizeScore, setPrizeScore] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [readyRes, prizeRes] = await Promise.all([
        fetch(`/api/schools/readiness?companyId=${companyId}`, {
          cache: 'no-store',
        }),
        fetch(`/api/schools/prizes?companyId=${companyId}`, {
          cache: 'no-store',
        }),
      ]);
      const ready = await readyRes.json();
      const prize = await prizeRes.json().catch(() => ({}));

      if (!readyRes.ok) throw new Error(ready.error || 'Failed to load');

      if (ready.role === 'agency') {
        setRole('agency');
        setAgencySummary(ready.summary || null);
        setAgencyNext(ready.nextAction || null);
        setSchool(null);
        setReadiness(null);
      } else {
        setRole('school');
        setSchool(ready.school || null);
        setReadiness(ready.readiness || null);
      }
      if (prizeRes.ok && prize.score) {
        setPrizeScore(Number(prize.score.total) || null);
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

  if (loading) {
    return (
      <SchoolsPage>
        <SchoolsHeader
          title="NSNP command"
          titleAccent="Loading"
          description="Building your school / DBE command centre…"
          mode={role}
        />
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      </SchoolsPage>
    );
  }

  if (role === 'agency') {
    return (
      <SchoolsPage>
        <SchoolsHeader
          title="DBE / PEU command"
          titleAccent="Programme"
          description="Approve schools, own the approved foods list, run PEU visits, review claims — revolutionise how nutrition reaches every child."
          mode="agency"
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

        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-6 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0077b6] text-white flex items-center justify-center">
              <Landmark className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
                Agency command
              </p>
              <h2 className="text-xl font-black text-slate-900 mt-0.5">
                {agencyNext?.label || 'Programme command'}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                {agencyNext?.desc ||
                  'Approve associations, publish approved brands, monitor serve-day compliance. Use the module navbar to move between functions.'}
              </p>
              {agencyNext ? (
                <Link
                  href={agencyNext.href}
                  className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2 mt-4"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            {
              href: '/dashboard/schools/agency',
              label: 'Pending schools',
              value: agencySummary?.pendingSchools ?? 0,
              icon: Building2,
            },
            {
              href: '/dashboard/schools/agency',
              label: 'Active schools',
              value: agencySummary?.activeSchools ?? 0,
              icon: CheckCircle2,
            },
            {
              href: '/dashboard/schools/agency-report',
              label: 'Claims to review',
              value: agencySummary?.submittedClaims ?? 0,
              icon: FileText,
            },
            {
              href: '/dashboard/schools/approved-list',
              label: 'Approved list',
              value: 'Edit',
              icon: ClipboardCheck,
            },
          ].map((t) => (
            <Link
              key={t.label}
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
            </Link>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              href: '/dashboard/schools/agency',
              label: 'Approve school joins',
              desc: 'Only approved schools unlock catalogue & claims',
            },
            {
              href: '/dashboard/schools/approved-list',
              label: 'Own approved foods',
              desc: 'Schools may only order from this list',
            },
            {
              href: '/dashboard/schools/visits',
              label: 'PEU field visits',
              desc: 'Checklist scores for approved schools',
            },
            {
              href: '/dashboard/schools/agency-report',
              label: 'Multi-school pack',
              desc: 'Heatmaps, risks, nutrition, brand compliance',
            },
            {
              href: '/dashboard/schools/isp-sla',
              label: 'ISP delivery SLA',
              desc: 'Brand compliance across the network',
            },
            {
              href: '/dashboard/schools/prizes',
              label: 'Fair prizes',
              desc: 'Honest scores — menu & feeding completeness',
            },
          ].map((x) => (
            <Link
              key={x.href + x.label}
              href={x.href}
              className="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-4 hover:border-[#00b4d8]"
            >
              <p className="font-bold text-slate-900 text-sm">{x.label}</p>
              <p className="text-xs text-slate-500 mt-1">{x.desc}</p>
            </Link>
          ))}
        </div>
      </SchoolsPage>
    );
  }

  // ——— School principal hub ———
  const r = readiness;
  const k = r?.kpis;
  const next = r?.nextAction;

  return (
    <SchoolsPage>
      <SchoolsHeader
        title={String(school?.school_name || 'School NSNP')}
        titleAccent="Command"
        description={
          String(school?.motto || '') ||
          [
            school?.emis_number && `EMIS ${school.emis_number}`,
            school?.district,
            school?.province,
          ]
            .filter(Boolean)
            .join(' · ') ||
          'Own kitchen · approved brands · better meals for every child'
        }
        mode="school"
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

      {/* Hero + process */}
      <div className="grid lg:grid-cols-5 gap-4 mb-6">
        <div className="lg:col-span-3 rounded-3xl border border-slate-200 bg-white overflow-hidden flex flex-col sm:flex-row">
          <div className="sm:w-36 h-32 sm:h-auto shrink-0 bg-gradient-to-br from-sky-100 to-emerald-50 relative">
            {school?.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={String(school.photo_url)}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[#0077b6]">
                <Camera className="w-7 h-7 opacity-60" />
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
              Today at your school
            </p>
            <h2 className="text-lg font-black text-slate-900 mt-0.5">
              {r?.today.serveComplete
                ? `✓ Served ${r.today.served ?? 0} meals`
                : r?.today.menuDish
                  ? `Menu: ${r.today.menuDish}`
                  : 'Ready to feed children?'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {next?.desc ||
                'One clear path: setup → approved foods → kitchen → serve day → claims.'}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Link
                href={next?.href || '/dashboard/schools/serve-day'}
                className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
              >
                {next?.label || 'Serve day'}{' '}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/dashboard/schools/surveys"
                className="btn-secondary !py-2 !px-3 text-xs"
              >
                Food survey
              </Link>
            </div>
          </div>
        </div>
        <div className="lg:col-span-2">
          <NsnpProcessRail
            role="school"
            checks={checks}
            score={r?.score}
          />
        </div>
      </div>

      {/* Alerts */}
      {(k?.openCompliance || 0) > 0 ||
      (k?.openRiad || 0) > 0 ||
      (k?.openMaint || 0) > 0 ||
      (k && !k.agencyActive) ? (
        <div className="mb-4 space-y-2">
          {k && !k.agencyActive ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950 flex gap-2">
              <Landmark className="w-4 h-4 shrink-0 mt-0.5" />
              {k.agencyLinked
                ? 'DBE/PEU join pending approval — claims & full catalogue unlock after approve.'
                : 'Join your DBE/PEU so approved foods and claims work correctly.'}{' '}
              <Link
                href="/dashboard/schools/agency"
                className="font-bold underline"
              >
                open
              </Link>
            </div>
          ) : null}
          {(k?.openCompliance || 0) > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {k!.openCompliance} open compliance item(s) —{' '}
              <Link
                href="/dashboard/schools/compliance"
                className="font-bold underline"
              >
                review
              </Link>
            </div>
          ) : null}
          {(k?.openRiad || 0) > 0 ? (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950 flex gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              {k!.openRiad} open RIAD item(s) —{' '}
              <Link
                href="/dashboard/schools/riad"
                className="font-bold underline"
              >
                lead the list
              </Link>
            </div>
          ) : null}
          {(k?.openMaint || 0) > 0 ? (
            <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950 flex gap-2">
              <Wrench className="w-4 h-4 shrink-0 mt-0.5" />
              {k!.openMaint} open maintenance fix(es) —{' '}
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

      {/* Daily 4 */}
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
        Daily school path
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          {
            href: '/dashboard/schools/serve-day',
            icon: UtensilsCrossed,
            label: 'Serve day',
            desc: r?.today.serveComplete
              ? `${r.today.served} meals logged`
              : 'Present → meals → waste',
            accent: 'from-sky-500 to-cyan-400',
          },
          {
            href: '/dashboard/schools/kitchen',
            icon: ChefHat,
            label: 'Kitchen',
            desc: `${k?.stockLines ?? 0} stock lines`,
            accent: 'from-rose-500 to-orange-400',
          },
          {
            href: '/dashboard/schools/surveys',
            icon: MessageSquareHeart,
            label: 'Surveys',
            desc:
              (k?.surveyResponses || 0) > 0
                ? `${k!.surveyResponses} · ${k?.surveyAvg ?? '—'}★`
                : 'Learner feedback',
            accent: 'from-violet-500 to-fuchsia-400',
          },
          {
            href: '/dashboard/schools/claims',
            icon: FileText,
            label: 'Claims',
            desc: r?.readyForClaims
              ? 'Submit funding pack'
              : 'Need DBE + feeding',
            accent: 'from-emerald-500 to-teal-400',
          },
        ].map((a) => (
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

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {[
          {
            href: '/dashboard/schools/learners',
            icon: Users,
            label: 'Learners',
            value: k?.learners ?? '—',
            sub: `${k?.verifiedPct ?? 0}% verified`,
          },
          {
            href: '/dashboard/schools/orders',
            icon: Truck,
            label: 'Open orders',
            value: k?.openOrders ?? '—',
            sub: `${k?.ispLinks ?? 0} ISP links`,
          },
          {
            href: '/dashboard/schools/approved-list',
            icon: ClipboardCheck,
            label: 'Approved list',
            value: k?.agencyActive ? 'Linked' : 'Join DBE',
            sub: 'Brand gate for POs & GRN',
          },
          {
            href: '/dashboard/schools/prizes',
            icon: Award,
            label: 'Prize score',
            value: prizeScore != null ? prizeScore.toFixed(1) : '—',
            sub: 'Honest quarterly rank',
          },
          {
            href: '/dashboard/schools/riad',
            icon: ShieldAlert,
            label: 'RIAD open',
            value: k?.openRiad ?? 0,
            sub: 'Lead risks & decisions',
          },
          {
            href: '/dashboard/schools/report',
            icon: BarChart3,
            label: 'Analytics',
            value: 'Open',
            sub: 'Slice NSNP performance',
          },
        ].map((t) => (
          <Link
            key={t.href + t.label}
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

      <p className="mt-2 text-xs text-slate-400 flex items-center gap-1">
        <MapPin className="w-3.5 h-3.5" />
        End-to-end process: profile → DBE approve → learners → menu → ISP →
        order → GRN → serve day → survey → claims → audit. Run migration{' '}
        <code className="text-[10px]">
          20260726_schools_photo_survey_riad_maintenance.sql
        </code>
        .
      </p>
    </SchoolsPage>
  );
}
