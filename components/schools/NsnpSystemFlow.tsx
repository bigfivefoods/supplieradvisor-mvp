'use client';

/**
 * DBE command-center flowchart: how DBE → Schools → SPs deliver nutrition
 * with compliance gates, meal planning, kitchen cover, and prize incentives.
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  Award,
  Building2,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ClipboardCheck,
  Landmark,
  Package,
  ShieldCheck,
  Truck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

type Audience = 'dbe' | 'school' | 'isp';

type Props = {
  /** Compact strip vs full command diagram */
  compact?: boolean;
  /** Tailors intro copy for DBE, school, or service provider hubs */
  audience?: Audience;
  /** Start collapsed (recommended on school/SP daily hubs) */
  defaultCollapsed?: boolean;
};

const AUDIENCE_COPY: Record<
  Audience,
  { eyebrow: string; lead: string }
> = {
  dbe: {
    eyebrow: 'How the programme works',
    lead: 'DBE sets the catalogue, feeding calendar, recipe BOMs and budgets. Schools plan stock and order only approved foods from linked SPs. PEU verifies serve-days; claims and prizes close the loop so every learner is fed what was authorised.',
  },
  school: {
    eyebrow: 'Your role in the nutrition chain',
    lead: 'DBE publishes the catalogue, calendar, menu and recipes. You import learners, hold kitchen stock by days of cover, raise POs from suggested demand, receive GRNs, feed children on serve-day — then claim with evidence.',
  },
  isp: {
    eyebrow: 'Your role in the nutrition chain',
    lead: 'DBE approves you and the catalogue. Schools order from the same menu/recipe plan and feeding calendar. You fulfil on-catalogue with DN + POD; preferred score rewards reliability — children eat what was authorised.',
  },
};

export default function NsnpSystemFlow({
  compact,
  audience = 'dbe',
  defaultCollapsed,
}: Props) {
  const copy = AUDIENCE_COPY[audience] || AUDIENCE_COPY.dbe;
  const startCollapsed =
    defaultCollapsed ?? (audience === 'school' || audience === 'isp');
  const [open, setOpen] = useState(!startCollapsed);

  return (
    <section
      className={`rounded-3xl border border-slate-200 bg-white overflow-hidden ${
        compact ? 'mb-4' : 'mb-6'
      }`}
      aria-label="NSNP system flow diagram"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left bg-gradient-to-r from-[#0077b6] via-[#00b4d8] to-emerald-600 px-5 py-4 text-white"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              {copy.eyebrow}
            </p>
            <h2 className="text-lg sm:text-xl font-black mt-0.5">
              DBE → Schools → Service providers → Children fed
            </h2>
            <p className="text-sm text-white/90 mt-1 max-w-3xl">{copy.lead}</p>
          </div>
          <span className="shrink-0 mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
            {open ? 'Hide' : 'Show'} diagram
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${
                open ? 'rotate-180' : ''
              }`}
            />
          </span>
        </div>
      </button>

      {open ? (
        <div className="p-4 sm:p-6 space-y-6">
          {/* Role swimlanes */}
          <div className="grid lg:grid-cols-3 gap-3">
            <RoleCard
              tone="dbe"
              icon={Landmark}
              title="DBE / PEU"
              subtitle="Sets the rules & verifies"
              points={[
                'Approve schools & service providers',
                'Publish approved foods catalogue (+ photos, province)',
                'Annual feeding calendar (terms · days) → schools & SPs',
                'Recipe BOMs by weekday · breakfast/lunch · MPS/MRP',
                'Mandate menu cycle, category budgets & tariffs',
                'PEU visits + NSNP monitoring tool · claim approval',
              ]}
              href="/dashboard/schools/agency"
            />
            <RoleCard
              tone="school"
              icon={Building2}
              title="Schools"
              subtitle="Plan · stock · order · feed · claim"
              points={[
                'Join DBE · import learners (Template A) · attest',
                'Use calendar + recipes for MPS meals & product need',
                'Kitchen: set days of stock cover · reorder prompts',
                'Suggested PO → linked SP · only approved catalogue',
                'GRN into stock · serve-day log · claims & prizes',
              ]}
              href="/dashboard/schools"
            />
            <RoleCard
              tone="sp"
              icon={Truck}
              title="Service providers"
              subtitle="Supply only approved brands"
              points={[
                'Register & get DBE compliance tick',
                'Accept school claims / links',
                'See feeding calendar & MPS/MRP for volumes',
                'Fulfil PO → DN + POD photo · on-catalogue only',
                'Preferred SP score, OTIF & SP prizes',
              ]}
              href="/dashboard/schools/isp"
            />
          </div>

          {/* Planning path (upstream) */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Programme planning (DBE → school kitchen)
            </h3>
            <div className="flex flex-col xl:flex-row xl:items-stretch gap-2 xl:gap-1">
              {PLAN_STEPS.map((step, i) => (
                <div key={step.id} className="contents">
                  <FlowStep step={step} index={i + 1} tone="plan" />
                  {i < PLAN_STEPS.length - 1 ? (
                    <>
                      <div className="hidden xl:flex items-center justify-center px-0.5 text-slate-300">
                        <ArrowRight className="w-5 h-5 shrink-0" />
                      </div>
                      <div className="xl:hidden flex justify-center py-0.5 text-slate-300">
                        <ArrowDown className="w-4 h-4" />
                      </div>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* Main supply / feed path */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Golden supply path (order → children fed)
            </h3>
            <div className="flex flex-col xl:flex-row xl:items-stretch gap-2 xl:gap-1">
              {FLOW_STEPS.map((step, i) => (
                <div key={step.id} className="contents">
                  <FlowStep step={step} index={i + 1} />
                  {i < FLOW_STEPS.length - 1 ? (
                    <>
                      <div className="hidden xl:flex items-center justify-center px-0.5 text-slate-300">
                        <ArrowRight className="w-5 h-5 shrink-0" />
                      </div>
                      <div className="xl:hidden flex justify-center py-0.5 text-slate-300">
                        <ArrowDown className="w-4 h-4" />
                      </div>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* Compliance gates */}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              <h3 className="text-sm font-black text-emerald-950">
                Compliance gates (kids get what was approved)
              </h3>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {COMPLIANCE_GATES.map((g) => (
                <div
                  key={g.title}
                  className="rounded-xl bg-white border border-emerald-100 px-3 py-2.5"
                >
                  <p className="text-xs font-bold text-slate-900">{g.title}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    {g.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Prize loops */}
          <div className="grid md:grid-cols-2 gap-3">
            <PrizeCard
              title="School / headmaster prizes"
              tone="school"
              href="/dashboard/schools/prizes"
              intro="Quarterly score rewards honest feeding — not paperwork theatre."
              items={[
                {
                  label: 'Approved brand procurement',
                  detail: '% of GRN lines on DBE catalogue',
                },
                {
                  label: 'Zero off-catalogue events',
                  detail: 'Refuse wrong brands at the gate',
                },
                {
                  label: 'Menu & recipe adherence',
                  detail: 'Orders & serves match mandated cycle',
                },
                {
                  label: 'Feeding completeness',
                  detail: 'Serve-days match feeding calendar',
                },
                {
                  label: 'Stock cover + learners',
                  detail: 'Kitchen levels · verified register / EMIS',
                },
              ]}
              footer="High scores unlock claim confidence and public prize standing."
            />
            <PrizeCard
              title="Service provider prizes"
              tone="sp"
              href="/dashboard/schools/isp-sla"
              intro="SPs who only deliver on-catalogue become preferred suppliers."
              items={[
                {
                  label: 'On-catalogue delivery %',
                  detail: 'Core of preferred score',
                },
                {
                  label: 'Full-compliance deliveries',
                  detail: 'Every line on the approved list',
                },
                {
                  label: 'POD photo proof',
                  detail: 'Photo evidence on delivery notes',
                },
                {
                  label: 'OTIF vs required delivery date',
                  detail: 'Reliable against school order dates',
                },
                {
                  label: 'Preferred badge (≥95%)',
                  detail: 'Schools order preferred SPs first',
                },
              ]}
              footer="Probation if compliance slips — schools are steered away until fixed."
            />
          </div>

          {/* Closed loop */}
          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sky-950 min-w-0">
              <Users className="w-5 h-5 shrink-0 text-[#0077b6]" />
              <p className="text-sm">
                <strong className="font-black">Outcome:</strong> DBE calendar +
                recipes → school stock cover & PO → SP delivers approved food →
                kitchen GRN → learners fed on serve-day → PEU verifies → claims
                paid → prizes reinforce good behaviour.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0 sm:ml-auto">
              <Link
                href="/dashboard/schools/feeding-calendar"
                className="text-[11px] font-bold rounded-full bg-white border border-sky-200 px-3 py-1.5 text-[#0077b6]"
              >
                Feeding calendar
              </Link>
              <Link
                href="/dashboard/schools/recipes"
                className="text-[11px] font-bold rounded-full bg-white border border-sky-200 px-3 py-1.5 text-[#0077b6]"
              >
                Recipes · MPS/MRP
              </Link>
              <Link
                href="/dashboard/schools/monitoring"
                className="text-[11px] font-bold rounded-full bg-white border border-sky-200 px-3 py-1.5 text-[#0077b6]"
              >
                Monitoring tool
              </Link>
              <Link
                href="/dashboard/schools/ops"
                className="text-[11px] font-bold rounded-full bg-[#0077b6] text-white px-3 py-1.5"
              >
                Exception cockpit
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

type FlowStepDef = {
  id: string;
  title: string;
  who: string;
  desc: string;
  href: string;
  icon: typeof Landmark;
};

/** Upstream: programme design that cascades to schools & SPs */
const PLAN_STEPS: FlowStepDef[] = [
  {
    id: 'catalogue',
    title: 'Catalogue & menu',
    who: 'DBE',
    desc: 'Approved foods · mandated breakfast/lunch cycle',
    href: '/dashboard/schools/approved-list',
    icon: ClipboardCheck,
  },
  {
    id: 'calendar',
    title: 'Feeding calendar',
    who: 'DBE',
    desc: 'Exact feeding days per month & term',
    href: '/dashboard/schools/feeding-calendar',
    icon: CalendarDays,
  },
  {
    id: 'recipes',
    title: 'Recipes · MPS/MRP',
    who: 'DBE',
    desc: 'BOM by weekday · meals & product need',
    href: '/dashboard/schools/recipes',
    icon: Calculator,
  },
  {
    id: 'learners',
    title: 'Learners',
    who: 'School',
    desc: 'Template A import · verify · NSNP eligible',
    href: '/dashboard/schools/learners',
    icon: Users,
  },
  {
    id: 'cover',
    title: 'Stock cover',
    who: 'School',
    desc: 'Days to hold · reorder · suggested PO qty',
    href: '/dashboard/schools/kitchen',
    icon: ChefHat,
  },
];

/** Downstream golden path once food moves */
const FLOW_STEPS: FlowStepDef[] = [
  {
    id: 'order',
    title: 'Order',
    who: 'School',
    desc: 'Catalogue PO · required delivery date · SP',
    href: '/dashboard/schools/orders',
    icon: Package,
  },
  {
    id: 'deliver',
    title: 'Deliver',
    who: 'SP',
    desc: 'DN + POD photo · on-catalogue only',
    href: '/dashboard/schools/deliveries',
    icon: Truck,
  },
  {
    id: 'receive',
    title: 'Receive · GRN',
    who: 'School',
    desc: 'Into kitchen stock · reject off-list',
    href: '/dashboard/schools/kitchen',
    icon: ChefHat,
  },
  {
    id: 'feed',
    title: 'Feed kids',
    who: 'School',
    desc: 'Serve-day · calendar feeding days',
    href: '/dashboard/schools/serve-day',
    icon: UtensilsCrossed,
  },
  {
    id: 'verify',
    title: 'Verify',
    who: 'PEU',
    desc: 'Visits + monitoring KPI',
    href: '/dashboard/schools/monitoring',
    icon: CheckCircle2,
  },
  {
    id: 'reward',
    title: 'Claim & prize',
    who: 'DBE',
    desc: 'Pay claims · reward compliance',
    href: '/dashboard/schools/prizes',
    icon: Award,
  },
];

const COMPLIANCE_GATES = [
  {
    title: '1. Catalogue hard-stop',
    desc: 'POs and GRNs reject products not on the live DBE approved list.',
  },
  {
    title: '2. Active school ↔ SP link',
    desc: 'Schools only order from approved, linked service providers.',
  },
  {
    title: '3. Calendar + recipe plan',
    desc: 'Feeding days and BOMs drive whole-number meals and product MRP for schools & SPs.',
  },
  {
    title: '4. Kitchen stock cover',
    desc: 'Days-of-stock target from menu demand; reorder prompts and suggested PO quantities.',
  },
  {
    title: '5. POD + three-way match',
    desc: 'Delivery notes with photos; receive against PO; exceptions flagged.',
  },
  {
    title: '6. PEU field proof',
    desc: 'Monitoring tool scores feeding time, food groups, records, health & gardens.',
  },
];

function RoleCard({
  tone,
  icon: Icon,
  title,
  subtitle,
  points,
  href,
}: {
  tone: 'dbe' | 'school' | 'sp';
  icon: typeof Landmark;
  title: string;
  subtitle: string;
  points: string[];
  href: string;
}) {
  const ring =
    tone === 'dbe'
      ? 'border-sky-200 bg-sky-50/40'
      : tone === 'school'
        ? 'border-emerald-200 bg-emerald-50/40'
        : 'border-amber-200 bg-amber-50/40';
  const badge =
    tone === 'dbe'
      ? 'bg-sky-600'
      : tone === 'school'
        ? 'bg-emerald-600'
        : 'bg-amber-600';
  return (
    <div className={`rounded-2xl border ${ring} p-4 flex flex-col`}>
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-9 h-9 rounded-xl ${badge} text-white flex items-center justify-center`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="font-black text-slate-900 text-sm">{title}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {subtitle}
          </p>
        </div>
      </div>
      <ul className="space-y-1.5 flex-1 mb-3">
        {points.map((p) => (
          <li
            key={p}
            className="text-[12px] text-slate-700 leading-snug flex gap-1.5"
          >
            <span className="text-emerald-600 font-bold shrink-0">✓</span>
            {p}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className="text-[11px] font-bold text-[#0077b6] inline-flex items-center gap-1"
      >
        Open workspace <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function FlowStep({
  step,
  index,
  tone = 'flow',
}: {
  step: FlowStepDef;
  index: number;
  tone?: 'flow' | 'plan';
}) {
  const Icon = step.icon;
  const ring =
    tone === 'plan'
      ? 'border-violet-200 bg-violet-50/50 hover:border-violet-400'
      : 'border-slate-200 bg-slate-50/80 hover:border-[#00b4d8]';
  const num =
    tone === 'plan' ? 'bg-violet-800' : 'bg-slate-900';
  return (
    <Link
      href={step.href}
      className={`flex-1 min-w-0 rounded-2xl border hover:bg-white hover:shadow-sm transition-all px-3 py-3 group ${ring}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`w-6 h-6 rounded-full ${num} text-white text-[10px] font-black flex items-center justify-center`}
        >
          {index}
        </span>
        <Icon className="w-4 h-4 text-[#0077b6]" />
      </div>
      <p className="text-xs font-black text-slate-900 group-hover:text-[#0077b6]">
        {step.title}
      </p>
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
        {step.who}
      </p>
      <p className="text-[11px] text-slate-600 mt-1 leading-snug">{step.desc}</p>
    </Link>
  );
}

function PrizeCard({
  title,
  intro,
  items,
  footer,
  href,
  tone,
}: {
  title: string;
  intro: string;
  items: Array<{ label: string; detail: string }>;
  footer: string;
  href: string;
  tone: 'school' | 'sp';
}) {
  const border =
    tone === 'school' ? 'border-emerald-200' : 'border-amber-200';
  const head =
    tone === 'school'
      ? 'from-emerald-600 to-teal-600'
      : 'from-amber-500 to-orange-500';
  return (
    <div className={`rounded-2xl border ${border} overflow-hidden bg-white`}>
      <div className={`bg-gradient-to-r ${head} px-4 py-3 text-white`}>
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4" />
          <p className="text-sm font-black">{title}</p>
        </div>
        <p className="text-[11px] text-white/90 mt-1">{intro}</p>
      </div>
      <ul className="px-4 py-3 space-y-2">
        {items.map((it) => (
          <li key={it.label} className="flex gap-2 text-[12px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <span className="font-bold text-slate-900">{it.label}</span>
              <span className="text-slate-500"> — {it.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="px-4 pb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500 leading-snug">{footer}</p>
        <Link
          href={href}
          className="text-[11px] font-bold text-[#0077b6] shrink-0"
        >
          View →
        </Link>
      </div>
    </div>
  );
}
