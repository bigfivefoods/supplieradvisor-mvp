'use client';

/**
 * End-to-end NSNP diagram:
 * DBE → Schools → Service providers → Children fed
 *
 * Shown on DBE, School, and SP command hubs so every role sees the same
 * full process, with their own swimlane highlighted.
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
  Handshake,
  Landmark,
  Package,
  ShoppingCart,
  ShieldCheck,
  Truck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import ProcessGuidePdfButtons from '@/components/schools/ProcessGuidePdfButtons';

type Audience = 'dbe' | 'school' | 'isp';

type Props = {
  compact?: boolean;
  /** Tailors highlight + intro for DBE, school, or SP command hubs */
  audience?: Audience;
  /** Start collapsed (default: open on all command hubs) */
  defaultCollapsed?: boolean;
};

const AUDIENCE_COPY: Record<
  Audience,
  { eyebrow: string; lead: string; youAre: string }
> = {
  dbe: {
    eyebrow: 'Full programme — your command view',
    lead: 'You set the rules (catalogue, menus, recipes, calendar) and check compliance. You never order or receive food. Schools stock-check and order; SPs procure and deliver; children are fed; you review claims.',
    youAre: 'You are DBE / PEU',
  },
  school: {
    eyebrow: 'Full programme — your kitchen view',
    lead: 'DBE sets the menu. You check kitchen stock against that menu; when short, raise a PO to your SP; receive stock into the kitchen; serve meals. SPs do not invent menus — they supply what you order.',
    youAre: 'You are the school',
  },
  isp: {
    eyebrow: 'Full programme — your supply view',
    lead: 'DBE sets the catalogue and menus. Schools raise POs when kitchens are short. You receive those POs, procure approved items, and deliver to schools. You do not set menus or serve children.',
    youAre: 'You are the service provider',
  },
};

type PhaseStep = {
  id: string;
  n: string;
  title: string;
  who: 'DBE' | 'School' | 'SP' | 'PEU' | 'All';
  desc: string;
  href: string;
  icon: typeof Landmark;
  role: 'dbe' | 'school' | 'sp' | 'peu' | 'shared';
};

type Phase = {
  id: string;
  title: string;
  subtitle: string;
  steps: PhaseStep[];
};

const PHASES: Phase[] = [
  {
    id: 'setup',
    title: '1 · Join the programme',
    subtitle: 'Who is allowed to participate',
    steps: [
      {
        id: 'join-school',
        n: '1a',
        title: 'Schools join DBE',
        who: 'School',
        desc: 'Request association; DBE/PEU approves the school.',
        href: '/dashboard/schools/join',
        icon: Building2,
        role: 'school',
      },
      {
        id: 'join-sp',
        n: '1b',
        title: 'SPs join DBE',
        who: 'SP',
        desc: 'Register as service provider; DBE approves compliance tick.',
        href: '/dashboard/schools/isps',
        icon: Truck,
        role: 'sp',
      },
      {
        id: 'approve',
        n: '1c',
        title: 'DBE approves joins',
        who: 'DBE',
        desc: 'Approve or reject school and SP associations on the desk.',
        href: '/dashboard/schools/join',
        icon: Handshake,
        role: 'dbe',
      },
    ],
  },
  {
    id: 'rules',
    title: '2 · DBE sets the rules (no ordering)',
    subtitle: 'Catalogue · menu · recipes · calendar — schools & SPs inherit these',
    steps: [
      {
        id: 'catalogue',
        n: '2a',
        title: 'Approved catalogue',
        who: 'DBE',
        desc: 'Brands and products that may be bought and served.',
        href: '/dashboard/schools/approved-list',
        icon: ClipboardCheck,
        role: 'dbe',
      },
      {
        id: 'menu',
        n: '2b',
        title: 'Menu cycle',
        who: 'DBE',
        desc: 'Breakfast and lunch dishes by weekday — mandated for schools.',
        href: '/dashboard/schools/menu',
        icon: UtensilsCrossed,
        role: 'dbe',
      },
      {
        id: 'recipes',
        n: '2c',
        title: 'Recipes · BOMs',
        who: 'DBE',
        desc: 'Portions, ingredients, MPS/MRP quantities for planning.',
        href: '/dashboard/schools/recipes',
        icon: Calculator,
        role: 'dbe',
      },
      {
        id: 'calendar',
        n: '2d',
        title: 'Feeding calendar',
        who: 'DBE',
        desc: 'Which days learners are fed (terms, months, holidays).',
        href: '/dashboard/schools/feeding-calendar',
        icon: CalendarDays,
        role: 'dbe',
      },
    ],
  },
  {
    id: 'stock-order',
    title: '3 · School stock-check → order when short',
    subtitle: 'Kitchen vs DBE menu — only schools raise POs',
    steps: [
      {
        id: 'learners',
        n: '3a',
        title: 'Learners on register',
        who: 'School',
        desc: 'Import and verify eligible learners for feed counts.',
        href: '/dashboard/schools/learners',
        icon: Users,
        role: 'school',
      },
      {
        id: 'stock',
        n: '3b',
        title: 'Check kitchen stock',
        who: 'School',
        desc: 'Compare on-hand stock to DBE menu / recipe need and cover days.',
        href: '/dashboard/schools/kitchen',
        icon: ChefHat,
        role: 'school',
      },
      {
        id: 'po',
        n: '3c',
        title: 'PO to SP if short',
        who: 'School',
        desc: 'Raise purchase order to linked SP — approved catalogue only.',
        href: '/dashboard/schools/orders',
        icon: Package,
        role: 'school',
      },
    ],
  },
  {
    id: 'supply',
    title: '4 · SP procures and delivers',
    subtitle: 'Service providers supply what schools ordered',
    steps: [
      {
        id: 'receive-po',
        n: '4a',
        title: 'Receive school PO',
        who: 'SP',
        desc: 'See open POs from linked schools in the fulfil inbox.',
        href: '/dashboard/schools/sp-orders-report',
        icon: Package,
        role: 'sp',
      },
      {
        id: 'procure',
        n: '4b',
        title: 'Procure items',
        who: 'SP',
        desc: 'Buy / pack on-catalogue products needed for the PO.',
        href: '/dashboard/schools/ops',
        icon: ShoppingCart,
        role: 'sp',
      },
      {
        id: 'deliver',
        n: '4c',
        title: 'Deliver to school',
        who: 'SP',
        desc: 'Delivery note + photo POD; only approved brands.',
        href: '/dashboard/schools/deliveries',
        icon: Truck,
        role: 'sp',
      },
    ],
  },
  {
    id: 'feed',
    title: '5 · School receives → children fed',
    subtitle: 'GRN into kitchen, then plates on feed days',
    steps: [
      {
        id: 'grn',
        n: '5a',
        title: 'Receive into kitchen',
        who: 'School',
        desc: 'GRN stock; reject off-catalogue lines at the gate.',
        href: '/dashboard/schools/deliveries',
        icon: ChefHat,
        role: 'school',
      },
      {
        id: 'serve',
        n: '5b',
        title: 'Serve meals',
        who: 'School',
        desc: 'Log serve-day against the DBE feeding calendar.',
        href: '/dashboard/schools/serve-day',
        icon: UtensilsCrossed,
        role: 'school',
      },
      {
        id: 'children',
        n: '5c',
        title: 'Children fed',
        who: 'All',
        desc: 'Outcome: learners eat the authorised menu that day.',
        href: '/dashboard/schools/serve-day',
        icon: Users,
        role: 'shared',
      },
    ],
  },
  {
    id: 'close',
    title: '6 · Verify, pay, reward',
    subtitle: 'Close the loop without DBE ordering food',
    steps: [
      {
        id: 'monitor',
        n: '6a',
        title: 'PEU monitoring',
        who: 'PEU',
        desc: 'Field visits and NSNP monitoring scores.',
        href: '/dashboard/schools/monitoring',
        icon: ShieldCheck,
        role: 'peu',
      },
      {
        id: 'claim',
        n: '6b',
        title: 'School claim pack',
        who: 'School',
        desc: 'Submit claim with evidence after feeding.',
        href: '/dashboard/schools/claims',
        icon: ClipboardCheck,
        role: 'school',
      },
      {
        id: 'review',
        n: '6c',
        title: 'DBE reviews claims',
        who: 'DBE',
        desc: 'Approve or query claims — not GRN or warehouse.',
        href: '/dashboard/schools/agency-report?report=claims',
        icon: Landmark,
        role: 'dbe',
      },
      {
        id: 'prizes',
        n: '6d',
        title: 'Prizes & preferred SPs',
        who: 'DBE',
        desc: 'Reward school compliance and on-catalogue SPs.',
        href: '/dashboard/schools/prizes',
        icon: Award,
        role: 'dbe',
      },
    ],
  },
];

const ROLE_CARDS: Array<{
  tone: 'dbe' | 'school' | 'sp';
  audienceKey: Audience;
  icon: typeof Landmark;
  title: string;
  subtitle: string;
  does: string[];
  doesNot: string[];
  href: string;
}> = [
  {
    tone: 'dbe',
    audienceKey: 'dbe',
    icon: Landmark,
    title: 'DBE / PEU',
    subtitle: 'Sets rules & checks compliance',
    does: [
      'Approve schools and service providers',
      'Publish catalogue, menu, recipes, calendar',
      'PEU visits and monitoring',
      'Review and approve claim packs',
      'Run prizes and preferred-SP scoring',
    ],
    doesNot: [
      'Does not raise school POs',
      'Does not receive or GRN deliveries',
      'Does not cook or serve meals',
    ],
    href: '/dashboard/schools/agency',
  },
  {
    tone: 'school',
    audienceKey: 'school',
    icon: Building2,
    title: 'Schools',
    subtitle: 'Stock → order → receive → serve',
    does: [
      'Join DBE and import learners',
      'Check kitchen stock against DBE menu',
      'Raise PO to SP when short',
      'Receive stock (GRN) into kitchen',
      'Serve meals on feed days · claim',
    ],
    doesNot: [
      'Does not invent the national menu',
      'Does not procure for other schools',
    ],
    href: '/dashboard/schools',
  },
  {
    tone: 'sp',
    audienceKey: 'isp',
    icon: Truck,
    title: 'Service providers',
    subtitle: 'PO in → procure → deliver',
    does: [
      'Join DBE and link to schools',
      'Receive purchase orders from schools',
      'Procure approved catalogue items',
      'Deliver with DN + photo POD',
      'Earn preferred score and OTIF',
    ],
    doesNot: [
      'Does not set DBE menus',
      'Does not serve children in the kitchen',
    ],
    href: '/dashboard/schools/isps',
  },
];

const COMPLIANCE_GATES = [
  {
    title: 'Catalogue hard-stop',
    desc: 'POs and GRNs only allow products on the live DBE approved list.',
  },
  {
    title: 'Active school ↔ SP link',
    desc: 'Schools only order from approved, linked service providers.',
  },
  {
    title: 'Menu + calendar drive demand',
    desc: 'Stock cover and suggested POs come from DBE menu, recipes and feed days.',
  },
  {
    title: 'POD + GRN match',
    desc: 'SP delivers with photo proof; school receives into kitchen stock.',
  },
  {
    title: 'PEU field proof',
    desc: 'Monitoring checks that meals match the authorised programme.',
  },
  {
    title: 'Claims only after feeding',
    desc: 'DBE pays claims backed by serve-day and compliance evidence.',
  },
];

function audienceMatchesRole(
  audience: Audience,
  role: PhaseStep['role']
): boolean {
  if (role === 'shared') return true;
  if (role === 'peu') return audience === 'dbe';
  if (role === 'dbe') return audience === 'dbe';
  if (role === 'school') return audience === 'school';
  if (role === 'sp') return audience === 'isp';
  return false;
}

export default function NsnpSystemFlow({
  compact,
  audience = 'dbe',
  defaultCollapsed = false,
}: Props) {
  const copy = AUDIENCE_COPY[audience] || AUDIENCE_COPY.dbe;
  const [open, setOpen] = useState(!defaultCollapsed);

  return (
    <section
      className={`rounded-3xl border border-slate-200 bg-white overflow-hidden ${
        compact ? 'mb-4' : 'mb-6'
      }`}
      aria-label="NSNP full process diagram: DBE to schools to service providers to children fed"
      id="nsnp-system-flow"
    >
      <div className="bg-gradient-to-r from-[#0077b6] via-[#00b4d8] to-emerald-600 px-5 py-4 text-white">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-left min-w-0 flex-1"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              {copy.eyebrow}
            </p>
            <h2 className="text-lg sm:text-xl font-black mt-0.5 leading-tight">
              DBE → Schools → Service providers → Children fed
            </h2>
            <p className="text-sm text-white/90 mt-1.5 max-w-3xl leading-snug">
              {copy.lead}
            </p>
            <p className="mt-2 inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold">
              {copy.youAre}
            </p>
          </button>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <ProcessGuidePdfButtons variant="map" />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-white/25"
            >
              {open ? 'Hide' : 'Show'} full process
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  open ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <div className="p-4 sm:p-6 space-y-8">
          {/* Chain strip */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-center">
            {[
              { label: 'DBE / PEU', sub: 'Sets rules', tone: 'sky' },
              { label: 'Schools', sub: 'Stock · order · serve', tone: 'emerald' },
              { label: 'Service providers', sub: 'Procure · deliver', tone: 'amber' },
              { label: 'Children fed', sub: 'Outcome', tone: 'rose' },
            ].map((node, i, arr) => (
              <div key={node.label} className="contents">
                <div
                  className={`rounded-2xl border px-3 py-2 min-w-[7rem] ${
                    node.tone === 'sky'
                      ? 'border-sky-200 bg-sky-50'
                      : node.tone === 'emerald'
                        ? 'border-emerald-200 bg-emerald-50'
                        : node.tone === 'amber'
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-rose-200 bg-rose-50'
                  }`}
                >
                  <p className="text-xs font-black text-slate-900">{node.label}</p>
                  <p className="text-[10px] text-slate-500 font-semibold">
                    {node.sub}
                  </p>
                </div>
                {i < arr.length - 1 ? (
                  <ArrowRight className="w-4 h-4 text-slate-300 hidden sm:block" />
                ) : null}
              </div>
            ))}
          </div>

          {/* Who does what */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                Who does what
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ['dbe', 'DBE / PEU'],
                    ['school', 'Schools'],
                    ['sp', 'Service providers'],
                  ] as const
                ).map(([key, label]) => (
                  <span
                    key={key}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${ROLE_STYLES[key].card} ${ROLE_STYLES[key].title}`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${ROLE_STYLES[key].swatch}`}
                      aria-hidden
                    />
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid lg:grid-cols-3 gap-3">
              {ROLE_CARDS.map((card) => (
                <RoleCard
                  key={card.title}
                  {...card}
                  highlighted={audience === card.audienceKey}
                />
              ))}
            </div>
          </div>

          {/* Full process phases */}
          <div className="space-y-6">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Full process (start → children fed)
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Read top to bottom. Highlighted steps are yours for this
                workspace.
              </p>
            </div>
            {PHASES.map((phase) => (
              <div key={phase.id}>
                <div className="mb-2">
                  <h4 className="text-sm font-black text-slate-900">
                    {phase.title}
                  </h4>
                  <p className="text-[11px] text-slate-500">{phase.subtitle}</p>
                </div>
                <div className="flex flex-col xl:flex-row xl:items-stretch gap-2 xl:gap-1">
                  {phase.steps.map((step, i) => (
                    <div key={step.id} className="contents">
                      <PhaseStepCard
                        step={step}
                        mine={audienceMatchesRole(audience, step.role)}
                      />
                      {i < phase.steps.length - 1 ? (
                        <>
                          <div className="hidden xl:flex items-center justify-center px-0.5 text-slate-300">
                            <ArrowRight className="w-4 h-4 shrink-0" />
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
            ))}
          </div>

          {/* Compliance */}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              <h3 className="text-sm font-black text-emerald-950">
                Guardrails — children get what was authorised
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

          {/* Outcome */}
          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex items-start gap-2 text-sky-950 min-w-0 flex-1">
                <Users className="w-5 h-5 shrink-0 text-[#0077b6] mt-0.5" />
                <p className="text-sm leading-snug">
                  <strong className="font-black">One sentence:</strong> DBE sets
                  catalogue, menus and calendar → schools check stock and order
                  from SPs when short → SPs procure and deliver → schools GRN and
                  serve → PEU verifies → DBE pays claims and rewards compliance.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link
                  href="/dashboard/schools"
                  className="text-[11px] font-bold rounded-full bg-[#0077b6] text-white px-3 py-1.5"
                >
                  Command home
                </Link>
                <Link
                  href="/dashboard/schools/ops"
                  className="text-[11px] font-bold rounded-full bg-white border border-sky-200 px-3 py-1.5 text-[#0077b6]"
                >
                  Ops cockpit
                </Link>
                <Link
                  href="/dashboard/schools/menu"
                  className="text-[11px] font-bold rounded-full bg-white border border-sky-200 px-3 py-1.5 text-[#0077b6]"
                >
                  Menu
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Role colour codes — distinct in light and dark for “Who does what”. */
const ROLE_STYLES = {
  dbe: {
    // Sky / SA blue — DBE / PEU
    card:
      'border-sky-300 bg-sky-50/50 dark:border-sky-400 dark:bg-sky-950 dark:ring-1 dark:ring-sky-500/40',
    badge: 'bg-sky-600 dark:bg-sky-500',
    chip: 'bg-sky-600 text-white dark:bg-sky-500 dark:text-sky-950',
    title: 'text-slate-900 dark:text-sky-50',
    subtitle: 'text-slate-500 dark:text-sky-200/80',
    doesLabel: 'text-sky-700 dark:text-sky-300',
    doesText: 'text-slate-700 dark:text-sky-50/90',
    link: 'text-[#0077b6] dark:text-sky-300',
    swatch: 'bg-sky-500 dark:bg-sky-400',
    label: 'DBE / PEU',
  },
  school: {
    // Emerald — schools
    card:
      'border-emerald-300 bg-emerald-50/50 dark:border-emerald-400 dark:bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40',
    badge: 'bg-emerald-600 dark:bg-emerald-500',
    chip:
      'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950',
    title: 'text-slate-900 dark:text-emerald-50',
    subtitle: 'text-slate-500 dark:text-emerald-200/80',
    doesLabel: 'text-emerald-700 dark:text-emerald-300',
    doesText: 'text-slate-700 dark:text-emerald-50/90',
    link: 'text-emerald-800 dark:text-emerald-300',
    swatch: 'bg-emerald-500 dark:bg-emerald-400',
    label: 'School',
  },
  sp: {
    // Amber — service providers
    card:
      'border-amber-300 bg-amber-50/50 dark:border-amber-400 dark:bg-amber-950 dark:ring-1 dark:ring-amber-500/40',
    badge: 'bg-amber-600 dark:bg-amber-500',
    chip:
      'bg-amber-600 text-white dark:bg-amber-500 dark:text-amber-950',
    title: 'text-slate-900 dark:text-amber-50',
    subtitle: 'text-slate-500 dark:text-amber-200/80',
    doesLabel: 'text-amber-800 dark:text-amber-300',
    doesText: 'text-slate-700 dark:text-amber-50/90',
    link: 'text-amber-800 dark:text-amber-300',
    swatch: 'bg-amber-500 dark:bg-amber-400',
    label: 'SP',
  },
} as const;

function roleToneFromStepRole(
  role: PhaseStep['role']
): keyof typeof ROLE_STYLES {
  if (role === 'school') return 'school';
  if (role === 'sp') return 'sp';
  // dbe, peu, shared → programme / DBE colour for shared control
  return 'dbe';
}

function RoleCard({
  tone,
  icon: Icon,
  title,
  subtitle,
  does,
  doesNot,
  href,
  highlighted,
}: {
  tone: 'dbe' | 'school' | 'sp';
  icon: typeof Landmark;
  title: string;
  subtitle: string;
  does: string[];
  doesNot: string[];
  href: string;
  highlighted?: boolean;
}) {
  const s = ROLE_STYLES[tone];
  return (
    <div
      className={`rounded-2xl border p-4 flex flex-col ${s.card} ${
        highlighted
          ? 'ring-2 ring-[#00b4d8] shadow-md dark:ring-sky-400'
          : ''
      }`}
    >
      {highlighted ? (
        <p className="text-[10px] font-black uppercase tracking-wider text-[#0077b6] dark:text-sky-300 mb-2">
          Your role
        </p>
      ) : null}
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-9 h-9 rounded-xl ${s.badge} text-white flex items-center justify-center shadow-sm`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-black text-sm ${s.title}`}>{title}</p>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${s.chip}`}
            >
              {s.label}
            </span>
          </div>
          <p
            className={`text-[10px] font-bold uppercase tracking-wider ${s.subtitle}`}
          >
            {subtitle}
          </p>
        </div>
      </div>
      <p
        className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${s.doesLabel}`}
      >
        Does
      </p>
      <ul className="space-y-1 flex-1 mb-2">
        {does.map((p) => (
          <li
            key={p}
            className={`text-[12px] leading-snug flex gap-1.5 ${s.doesText}`}
          >
            <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
              ✓
            </span>
            {p}
          </li>
        ))}
      </ul>
      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 mb-1">
        Does not
      </p>
      <ul className="space-y-1 mb-3">
        {doesNot.map((p) => (
          <li
            key={p}
            className="text-[12px] text-slate-600 dark:text-neutral-300 leading-snug flex gap-1.5"
          >
            <span className="text-rose-500 dark:text-rose-400 font-bold shrink-0">
              ✗
            </span>
            {p}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={`text-[11px] font-bold inline-flex items-center gap-1 ${s.link}`}
      >
        Open workspace <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function PhaseStepCard({
  step,
  mine,
}: {
  step: PhaseStep;
  mine: boolean;
}) {
  const Icon = step.icon;
  const s = ROLE_STYLES[roleToneFromStepRole(step.role)];
  return (
    <Link
      href={step.href}
      className={`flex-1 min-w-0 rounded-2xl border px-3 py-3 transition-all hover:shadow-sm group dark:hover:bg-neutral-900 ${
        mine
          ? 'border-[#00b4d8] bg-[#e8f8fc] ring-1 ring-[#00b4d8]/40 dark:border-sky-500 dark:bg-sky-950/60 dark:ring-sky-500/40'
          : 'border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`w-7 h-7 rounded-full text-white text-[10px] font-black flex items-center justify-center ${s.badge}`}
        >
          {step.n}
        </span>
        <Icon className={`w-4 h-4 ${s.doesLabel}`} />
        {mine ? (
          <span className="ml-auto text-[9px] font-black uppercase tracking-wider text-[#0077b6] dark:text-sky-300">
            You
          </span>
        ) : null}
      </div>
      <p className="text-xs font-black text-slate-900 group-hover:text-[#0077b6] dark:text-neutral-100 dark:group-hover:text-sky-300">
        {step.title}
      </p>
      <span
        className={`inline-flex mt-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${s.chip}`}
      >
        {step.who}
      </span>
      <p className="text-[11px] text-slate-600 dark:text-neutral-400 mt-1 leading-snug">
        {step.desc}
      </p>
    </Link>
  );
}
