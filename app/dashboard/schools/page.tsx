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
import GoldenPathStrip from '@/components/schools/GoldenPathStrip';
import NsnpSystemFlow from '@/components/schools/NsnpSystemFlow';
import ProcessGuidePdfButtons from '@/components/schools/ProcessGuidePdfButtons';
import SchoolTodayBoard from '@/components/schools/SchoolTodayBoard';

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
  const [role, setRole] = useState<'school' | 'agency' | 'isp'>('school');
  const [school, setSchool] = useState<Record<string, unknown> | null>(null);
  const [readiness, setReadiness] = useState<SchoolReadiness | null>(null);
  const [agencySummary, setAgencySummary] = useState<Record<
    string,
    number | string
  > | null>(null);
  const [agencyNext, setAgencyNext] = useState<{
    label: string;
    href: string;
    desc: string;
  } | null>(null);
  const [ispSummary, setIspSummary] = useState<Record<
    string,
    number | string
  > | null>(null);
  const [ispNext, setIspNext] = useState<{
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
        setIspSummary(null);
      } else if (ready.role === 'isp') {
        setRole('isp');
        setIspSummary(ready.summary || null);
        setIspNext(ready.nextAction || null);
        setSchool(null);
        setReadiness(null);
        setAgencySummary(null);
      } else {
        setRole('school');
        setSchool(ready.school || null);
        setReadiness(ready.readiness || null);
        setIspSummary(null);
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

  if (role === 'isp') {
    return (
      <SchoolsPage>
        <SchoolsHeader
          title="SP command"
          titleAccent="Supply"
          description="Receive school POs → procure approved items → deliver to schools. You do not set menus. See the full DBE → school → SP → children fed process below."
          mode="isp"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <ProcessGuidePdfButtons variant="header" />
              <button
                type="button"
                onClick={() => void load()}
                className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>
          }
        />
        <GoldenPathStrip companyId={companyId} />
        <NsnpSystemFlow audience="isp" />
        <div className="mb-4">
          <ProcessGuidePdfButtons variant="inline" />
        </div>
        <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-6 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
            Service provider · do this next
          </p>
          <h2 className="text-xl font-black text-slate-900 mt-0.5">
            {ispNext?.label || 'Fulfil queue'}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {ispNext?.desc ||
              'Receive school POs, procure on-catalogue items, deliver with DN + POD. Schools GRN into kitchen.'}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Link
              href="/dashboard/schools/ops"
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2 min-h-[44px]"
            >
              Open fulfil queue <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={ispNext?.href || '/dashboard/schools/deliveries'}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2 min-h-[44px]"
            >
              Deliveries
            </Link>
            <Link
              href="/dashboard/schools/isps"
              className="btn-secondary !py-2.5 !px-4 text-sm min-h-[44px] inline-flex items-center"
            >
              SP profile
            </Link>
            <Link
              href="/dashboard/schools/isp-sla"
              className="btn-secondary !py-2.5 !px-4 text-sm min-h-[44px] inline-flex items-center"
            >
              SLA scores
            </Link>
            <Link
              href="/dashboard/invite-business?type=supplier&from=nsnp-sp"
              className="btn-secondary !py-2.5 !px-4 text-sm min-h-[44px] inline-flex items-center gap-1.5 border-amber-200 bg-amber-50 text-amber-950"
            >
              Invite supplier
            </Link>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Source stock · wholesalers
          </p>
          <h3 className="text-base font-black text-slate-900 mt-0.5">
            Invite suppliers with a standard business invite
          </h3>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Same invitation as the rest of SupplierAdvisor: email + claim link.
            They join the network as a supplier so you can send POs and get
            quotes. Worth sending even if they never accept.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Link
              href="/dashboard/invite-business?type=supplier&from=nsnp-sp"
              className="btn-primary !py-2 !px-3 text-xs"
            >
              Invite business (supplier)
            </Link>
            <Link
              href="/dashboard/suppliers/po"
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              Raise PO
            </Link>
            <Link
              href="/dashboard/connections"
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              Network hub
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            {
              label: 'Open POs',
              value: ispSummary?.openPos ?? 0,
              href: '/dashboard/schools/deliveries',
            },
            {
              label: 'Active DNs',
              value: ispSummary?.deliveriesActive ?? 0,
              href: '/dashboard/schools/deliveries',
            },
            {
              label: 'Awaiting school',
              value: ispSummary?.awaitingSchoolReceive ?? 0,
              href: '/dashboard/schools/deliveries',
            },
            {
              label: 'Compliance',
              value: String(ispSummary?.compliance || 'pending'),
              href: '/dashboard/schools/isps',
            },
          ].map((t) => (
            <Link
              key={t.label}
              href={t.href}
              className="rounded-3xl border border-slate-200 bg-white p-4 hover:border-amber-300 transition-all"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t.label}
              </p>
              <p className="text-2xl font-black tabular-nums capitalize mt-0.5">
                {t.value}
              </p>
            </Link>
          ))}
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
          description="DBE does not order or receive food. Set the catalogue, menus, recipes and feeding calendar; approve schools & SPs; run PEU compliance; review claims. Schools order and receive; SPs supply."
          mode="agency"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <ProcessGuidePdfButtons variant="header" />
              <button
                type="button"
                onClick={() => void load()}
                className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>
          }
        />
        <GoldenPathStrip companyId={companyId} />
        <NsnpSystemFlow audience="dbe" />

        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <Link
            href="/dashboard/schools/ops"
            className="btn-primary !py-2 !px-3 text-xs"
          >
            Exception cockpit
          </Link>
          <ProcessGuidePdfButtons variant="inline" />
        </div>

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
                  'Set menus, catalogue, recipes and calendar; approve schools & SPs; PEU compliance and claim review. DBE never raises school POs or GRNs.'}
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
              href: '/dashboard/schools/join',
              label: 'Add & approve schools / SPs',
              desc: 'Create, search, add and approve under DBE',
            },
            {
              href: '/dashboard/schools/agency',
              label: 'DBE desk',
              desc: 'Department profile, tariffs, school list',
            },
            {
              href: '/dashboard/schools/approved-list',
              label: 'Approved foods catalogue',
              desc: 'Schools may only order from this list',
            },
            {
              href: '/dashboard/schools/registry-import',
              label: 'Import school register',
              desc: 'Bulk xlsx — district, CMC, NATEMIS, enrolments',
            },
            {
              href: '/dashboard/schools/registry-report',
              label: 'School register report',
              desc: 'All schools · districts · municipalities · learners',
            },
            {
              href: '/dashboard/schools/agency-report',
              label: 'Programme reports & claims',
              desc: 'Hierarchy, coverage, claim inbox (email approve)',
            },
            {
              href: '/dashboard/schools/menu',
              label: 'Mandated menu',
              desc: 'Breakfast + lunch cycle schools must follow',
            },
            {
              href: '/dashboard/schools/isp-sla',
              label: 'SP delivery SLA',
              desc: 'Brand compliance across the network',
            },
            {
              href: '/dashboard/schools/prizes',
              label: 'Fair prizes',
              desc: 'Honest scores — menu & feeding completeness',
            },
            {
              href: '/dashboard/schools/feeding-calendar',
              label: 'Feeding calendar',
              desc: 'Annual feeding days per month & term — schools & SPs',
            },
            {
              href: '/dashboard/schools/recipes',
              label: 'Recipes · MPS / MRP',
              desc: 'BOM from catalogue · meals & product requirements',
            },
            {
              href: '/dashboard/schools/approved-list?demo=1',
              label: 'Demo seed (API)',
              desc: 'POST /api/schools/demo-seed from DBE company for training catalogue',
            },
            {
              href: '/dashboard/schools/monitoring',
              label: 'NSNP Monitoring Tool',
              desc: 'Field worker form · KPI · RKMP · health & gardens',
            },
            {
              href: '/dashboard/schools/monitoring-report',
              label: 'Monitoring report',
              desc: 'Slice & dice · graphs · district & KPI analytics',
            },
            {
              href: '/dashboard/schools/visits',
              label: 'PEU visit planner',
              desc: 'Plan day routes · field pack · planned vs actual',
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
          <div className="flex flex-wrap items-center gap-2">
            <ProcessGuidePdfButtons variant="header" />
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        }
      />

      <GoldenPathStrip companyId={companyId} />
      <NsnpSystemFlow audience="school" />
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <ProcessGuidePdfButtons variant="inline" />
        <Link
          href="/dashboard/schools/ops"
          className="btn-secondary !py-1.5 !px-3 text-xs"
        >
          Supply ops · match · funding sim
        </Link>
      </div>

      {/* Priority 1 — Today board */}
      <SchoolTodayBoard companyId={companyId} />

      {/* Hero — ops first so principals act in seconds */}
      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden flex flex-col sm:flex-row mb-4">
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
        <div className="p-5 flex-1 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
              Do this next
            </p>
            <h2 className="text-lg font-black text-slate-900 mt-0.5">
              {next?.label ||
                (r?.today.serveComplete
                  ? `✓ Served ${r.today.served ?? 0} meals`
                  : r?.today.menuDish
                    ? `Menu: ${r.today.menuDish}`
                    : 'Ready to feed children?')}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {next?.desc ||
                (r?.today.serveComplete
                  ? 'Serve day done — check deliveries, stock or claims.'
                  : 'Fast path: receive SP drops → kitchen stock → log serve day → claim.')}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Link
                href={next?.href || '/dashboard/schools/serve-day'}
                className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1 min-h-[44px]"
              >
                {next?.label || 'Serve day'}{' '}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              {(k?.deliveriesAwaiting || 0) > 0 ? (
                <Link
                  href="/dashboard/schools/deliveries"
                  className="btn-secondary !py-2.5 !px-3 text-sm inline-flex items-center gap-1 min-h-[44px]"
                >
                  <Truck className="w-3.5 h-3.5" />
                  Receive {k!.deliveriesAwaiting}
                </Link>
              ) : null}
              {!r?.today.serveComplete ? (
                <Link
                  href="/dashboard/schools/serve-day"
                  className="btn-secondary !py-2.5 !px-3 text-sm min-h-[44px] inline-flex items-center"
                >
                  Serve day
                </Link>
              ) : (
                <Link
                  href="/dashboard/schools/claims"
                  className="btn-secondary !py-2.5 !px-3 text-sm min-h-[44px] inline-flex items-center"
                >
                  Claims
                </Link>
              )}
            </div>
          </div>
          {typeof r?.score === 'number' ? (
            <div className="shrink-0 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-center min-w-[5.5rem]">
              <p className="text-2xl font-black tabular-nums text-slate-900">
                {r.score}%
              </p>
              <p className="text-[10px] font-bold uppercase text-slate-400">
                Setup
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Alerts */}
      {(k?.openCompliance || 0) > 0 ||
      (k?.openRiad || 0) > 0 ||
      (k?.openMaint || 0) > 0 ||
      (k?.deliveriesAwaiting || 0) > 0 ||
      (k && !k.agencyActive) ? (
        <div className="mb-4 space-y-2">
          {(k?.deliveriesAwaiting || 0) > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex gap-2">
              <Truck className="w-4 h-4 shrink-0 mt-0.5" />
              {k!.deliveriesAwaiting} SP delivery(ies) waiting to be received
              into kitchen —{' '}
              <Link
                href="/dashboard/schools/deliveries"
                className="font-bold underline"
              >
                receive now
              </Link>
            </div>
          ) : null}
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

      {/* Efficient daily ops — ordered process */}
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
        Efficient daily process · order → receive → stock → feed → fund
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {[
          {
            step: 1,
            href: '/dashboard/schools/orders',
            icon: Truck,
            label: 'Order',
            desc:
              (k?.openOrders || 0) > 0
                ? `${k!.openOrders} open PO(s)`
                : 'Approved catalogue only',
            urgent: false,
            accent: 'from-indigo-500 to-violet-400',
          },
          {
            step: 2,
            href: '/dashboard/schools/deliveries',
            icon: Truck,
            label: 'Receive',
            desc:
              (k?.deliveriesAwaiting || 0) > 0
                ? `${k!.deliveriesAwaiting} waiting now`
                : 'SP DN + POD → GRN',
            urgent: (k?.deliveriesAwaiting || 0) > 0,
            accent: 'from-amber-500 to-orange-400',
          },
          {
            step: 3,
            href: '/dashboard/schools/kitchen',
            icon: ChefHat,
            label: 'Kitchen',
            desc: `${k?.stockLines ?? 0} stock lines`,
            urgent: false,
            accent: 'from-rose-500 to-orange-400',
          },
          {
            step: 4,
            href: '/dashboard/schools/serve-day',
            icon: UtensilsCrossed,
            label: 'Serve',
            desc: r?.today.serveComplete
              ? `✓ ${r.today.served} meals`
              : 'Present → meals → waste',
            urgent: !r?.today.serveComplete,
            accent: 'from-sky-500 to-cyan-400',
          },
          {
            step: 5,
            href: '/dashboard/schools/claims',
            icon: FileText,
            label: 'Claim',
            desc: r?.readyForClaims
              ? 'Submit funding pack'
              : 'After serve days',
            urgent: Boolean(r?.readyForClaims && r?.today.serveComplete),
            accent: 'from-emerald-500 to-teal-400',
          },
          {
            step: 6,
            href: '/dashboard/schools/prizes',
            icon: Award,
            label: 'Prizes',
            desc:
              prizeScore != null
                ? `Score ${prizeScore.toFixed(0)}`
                : 'Compliance rank',
            urgent: false,
            accent: 'from-amber-400 to-yellow-300',
          },
        ].map((a) => (
          <Link
            key={a.href + a.label}
            href={a.href}
            className={`group relative overflow-hidden rounded-2xl border bg-white p-3 hover:shadow-md transition-all min-h-[7.5rem] ${
              a.urgent
                ? 'border-amber-300 ring-2 ring-amber-200/60'
                : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center">
                {a.step}
              </span>
              {a.urgent ? (
                <span className="text-[9px] font-bold uppercase text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                  Now
                </span>
              ) : null}
            </div>
            <div
              className={`w-8 h-8 rounded-lg bg-gradient-to-br ${a.accent} text-white flex items-center justify-center mb-2 shadow-sm`}
            >
              <a.icon className="w-3.5 h-3.5" />
            </div>
            <p className="font-black text-slate-900 text-sm">{a.label}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              {a.desc}
            </p>
          </Link>
        ))}
      </div>

      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
        Also useful today
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-6">
        {[
          {
            href: '/dashboard/schools/kitchen-pack',
            icon: ChefHat,
            label: 'Kitchen pack',
            desc: 'Mobile POD · GRN · serve',
          },
          {
            href: '/dashboard/schools/isps',
            icon: Users,
            label: 'SPs',
            desc: `${k?.ispLinks ?? 0} linked · preferred first`,
          },
          {
            href: '/dashboard/schools/approved-list',
            icon: ClipboardCheck,
            label: 'Catalogue',
            desc: k?.agencyActive ? 'Order only these foods' : 'Join DBE first',
          },
          {
            href: '/dashboard/schools/surveys',
            icon: MessageSquareHeart,
            label: 'Surveys',
            desc:
              (k?.surveyResponses || 0) > 0
                ? `${k!.surveyResponses} · ${k?.surveyAvg ?? '—'}★`
                : 'Learner feedback',
          },
          {
            href: '/dashboard/schools/nutrition',
            icon: BarChart3,
            label: 'Nutrition',
            desc: 'vs DBE average',
          },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-2xl border border-slate-200 bg-white p-3 hover:border-[#00b4d8]/40 transition-all"
          >
            <div className="flex items-center gap-2 mb-1">
              <a.icon className="w-3.5 h-3.5 text-[#0077b6]" />
              <p className="font-bold text-sm text-slate-900">{a.label}</p>
            </div>
            <p className="text-[11px] text-slate-500">{a.desc}</p>
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
            sub: `${k?.ispLinks ?? 0} SP links`,
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

      <p className="mt-4 text-xs text-slate-400 flex items-center gap-1 flex-wrap">
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        End-to-end: DBE rules → school stock vs menu → PO if short → SP procure &
        deliver → GRN → serve children → PEU verify → claims.
      </p>
    </SchoolsPage>
  );
}
