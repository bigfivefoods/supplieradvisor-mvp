'use client';

/**
 * DBE command-center flowchart: how DBE → Schools → SPs deliver nutrition
 * with compliance gates and prize incentives.
 */
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  Award,
  Building2,
  CheckCircle2,
  ChefHat,
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
};

const AUDIENCE_COPY: Record<
  Audience,
  { eyebrow: string; lead: string }
> = {
  dbe: {
    eyebrow: 'How the programme works',
    lead: 'Hard catalogue controls, delivery proof, PEU monitoring and fair prizes close the loop so every learner gets the nutrition they deserve — and compliant schools and SPs are rewarded.',
  },
  school: {
    eyebrow: 'Your role in the nutrition chain',
    lead: 'DBE sets the approved foods list and menu. You order only catalogue products from preferred SPs, receive into kitchen, feed learners, log serve-day — PEU verifies and prizes reward clean compliance.',
  },
  isp: {
    eyebrow: 'Your role in the nutrition chain',
    lead: 'DBE approves you and the catalogue. Schools order only approved brands from linked SPs. You fulfil with DN + POD photos, stay on-catalogue, climb preferred score — children eat what was authorised.',
  },
};

export default function NsnpSystemFlow({
  compact,
  audience = 'dbe',
}: Props) {
  const copy = AUDIENCE_COPY[audience] || AUDIENCE_COPY.dbe;
  return (
    <section
      className={`rounded-3xl border border-slate-200 bg-white overflow-hidden ${
        compact ? 'mb-4' : 'mb-6'
      }`}
      aria-label="NSNP system flow diagram"
    >
      <div className="bg-gradient-to-r from-[#0077b6] via-[#00b4d8] to-emerald-600 px-5 py-4 text-white">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
          {copy.eyebrow}
        </p>
        <h2 className="text-lg sm:text-xl font-black mt-0.5">
          DBE → Schools → Service providers → Children fed
        </h2>
        <p className="text-sm text-white/90 mt-1 max-w-3xl">{copy.lead}</p>
      </div>

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
              'Publish approved foods catalogue (+ photos, supplier province)',
              'Mandate menu cycle & tariffs',
              'PEU visits + full NSNP monitoring tool',
              'Review & approve claims',
            ]}
            href="/dashboard/schools/agency"
          />
          <RoleCard
            tone="school"
            icon={Building2}
            title="Schools"
            subtitle="Order · receive · feed · claim"
            points={[
              'Join DBE & link preferred SPs',
              'PO only from approved catalogue',
              'Receive with GRN (block off-list)',
              'Serve-day logs + stock discipline',
              'Submit claims · climb prize board',
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
              'Fulfil PO → delivery note + POD photo',
              'On-catalogue lines only',
              'Preferred SP score & SP prizes',
            ]}
            href="/dashboard/schools/isp"
          />
        </div>

        {/* Main process flow */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
            End-to-end nutrition path
          </h3>
          <div className="flex flex-col xl:flex-row xl:items-stretch gap-2 xl:gap-1">
            {FLOW_STEPS.map((step, i) => (
              <div key={step.id} className="contents xl:contents">
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
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
                label: 'Menu adherence',
                detail: 'Orders & serves match mandated menu',
              },
              {
                label: 'Feeding completeness',
                detail: 'Every weekday serve-day logged',
              },
              {
                label: 'Stock discipline + data quality',
                detail: 'Clean GRNs · verified learners / EMIS',
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
                label: 'OTIF (on-time in-full)',
                detail: 'Reliable against school schedules',
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
              <strong className="font-black">Outcome:</strong> DBE rules → SP
              delivers approved food → school feeds learners → PEU verifies →
              claims paid → prizes reinforce good behaviour.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0 sm:ml-auto">
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
    </section>
  );
}

const FLOW_STEPS: Array<{
  id: string;
  title: string;
  who: string;
  desc: string;
  href: string;
  icon: typeof Landmark;
}> = [
  {
    id: 'rules',
    title: 'Set rules',
    who: 'DBE',
    desc: 'Catalogue, menu, approve schools & SPs',
    href: '/dashboard/schools/approved-list',
    icon: ClipboardCheck,
  },
  {
    id: 'order',
    title: 'Order',
    who: 'School',
    desc: 'Hard catalogue PO to linked SP',
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
    title: 'Receive',
    who: 'School',
    desc: 'GRN · reject off-list · prize delta',
    href: '/dashboard/schools/kitchen',
    icon: ChefHat,
  },
  {
    id: 'feed',
    title: 'Feed kids',
    who: 'School',
    desc: 'Serve-day log · menu portions',
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
    title: '3. POD + three-way match',
    desc: 'Delivery notes with photos; receive against PO; exceptions flagged.',
  },
  {
    title: '4. PEU field proof',
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
}: {
  step: (typeof FLOW_STEPS)[number];
  index: number;
}) {
  const Icon = step.icon;
  return (
    <Link
      href={step.href}
      className="flex-1 min-w-0 rounded-2xl border border-slate-200 bg-slate-50/80 hover:border-[#00b4d8] hover:bg-white hover:shadow-sm transition-all px-3 py-3 group"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center">
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
