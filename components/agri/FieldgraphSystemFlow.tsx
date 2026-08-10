'use client';

/**
 * End-to-end CropAdvisor® process design:
 * Fields → Estimates → Harvest → Ops → Messages → Trade → Sold & proven
 *
 * Expandable on the CropAdvisor command hub; downloadable A4 PDF
 * (landscape + portrait) — same pattern as NSNP schools flow.
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  CalendarRange,
  ChevronDown,
  FlaskConical,
  Leaf,
  MapPinned,
  MessageSquare,
  ShoppingCart,
  ShieldCheck,
  Sparkles,
  Tractor,
  Users,
  Warehouse,
} from 'lucide-react';
import FieldgraphProcessPdfButtons from '@/components/agri/FieldgraphProcessPdfButtons';

type Props = {
  compact?: boolean;
  /** Start collapsed (default: open on command hub) */
  defaultCollapsed?: boolean;
};

type PhaseStep = {
  id: string;
  n: string;
  title: string;
  who: string;
  desc: string;
  href: string;
  icon: typeof MapPinned;
};

type Phase = {
  id: string;
  title: string;
  subtitle: string;
  steps: PhaseStep[];
};

const PHASES: Phase[] = [
  {
    id: 'fields',
    title: '1 · Field & agronomic data (shared master)',
    subtitle: 'One field book feeds every module',
    steps: [
      {
        id: 'register',
        n: '1a',
        title: 'Register fields',
        who: 'Farm office',
        desc: 'Code, name, crop, variety, hectares, irrigation, soil, geo.',
        href: '/dashboard/fieldgraph/fields',
        icon: MapPinned,
      },
      {
        id: 'agronomy',
        n: '1b',
        title: 'Agronomic attributes',
        who: 'Farm office',
        desc: 'Plant date, spacing, population, ratoon, mill group, district.',
        href: '/dashboard/fieldgraph/fields',
        icon: Leaf,
      },
      {
        id: 'yield-analysis',
        n: '1c',
        title: 'Yield analysis',
        who: 'Farm office',
        desc: 'Across-season estimate vs actual graphs per field and estate.',
        href: '/dashboard/fieldgraph/fields',
        icon: BarChart3,
      },
    ],
  },
  {
    id: 'estimates',
    title: '2 · Estimates (manager + mill board)',
    subtitle: 'Create · revise · submit · report',
    steps: [
      {
        id: 'est-create',
        n: '2a',
        title: 'Field estimates',
        who: 'Farm office',
        desc: 'Tonnes, quality (RV / moisture), t/ha, status draft → final.',
        href: '/dashboard/fieldgraph/estimates',
        icon: BarChart3,
      },
      {
        id: 'est-rev',
        n: '2b',
        title: 'Revisions',
        who: 'Farm office',
        desc: 'Auto snapshot history before each material update.',
        href: '/dashboard/fieldgraph/estimates',
        icon: Sparkles,
      },
      {
        id: 'est-board',
        n: '2c',
        title: 'Board submission',
        who: 'Farm office',
        desc: 'Mill Group Board status, board refs, revision report CSV.',
        href: '/dashboard/fieldgraph/estimates',
        icon: Warehouse,
      },
      {
        id: 'est-actual',
        n: '2d',
        title: 'Actuals',
        who: 'Farm office',
        desc: 'Record delivered yield for across-season decision support.',
        href: '/dashboard/fieldgraph/estimates',
        icon: BarChart3,
      },
    ],
  },
  {
    id: 'harvest',
    title: '3 · Harvest Planner',
    subtitle: 'Sequence + estimates + daily allocation → cut dates',
    steps: [
      {
        id: 'seq',
        n: '3a',
        title: 'Cutting sequence',
        who: 'Farm office',
        desc: 'Order fields for the season; reorder as conditions change.',
        href: '/dashboard/fieldgraph/harvest',
        icon: CalendarRange,
      },
      {
        id: 'alloc',
        n: '3b',
        title: 'Daily allocation',
        who: 'Farm office',
        desc: 'Set tonnes per day the mill / harvest capacity can take.',
        href: '/dashboard/fieldgraph/harvest',
        icon: CalendarRange,
      },
      {
        id: 'project',
        n: '3c',
        title: 'Project cut dates',
        who: 'System',
        desc: 'Expected start/end date and days-to-cut per field from estimates.',
        href: '/dashboard/fieldgraph/harvest',
        icon: CalendarRange,
      },
      {
        id: 'dest',
        n: '3d',
        title: 'Destinations',
        who: 'Trade',
        desc: 'Mill, silo or network buyer on each plan row.',
        href: '/dashboard/fieldgraph/harvest',
        icon: ShoppingCart,
      },
    ],
  },
  {
    id: 'ops',
    title: '4 · Season ops (inputs · vehicles · labour rates)',
    subtitle: 'Cost and utilisation against the same fields',
    steps: [
      {
        id: 'inputs',
        n: '4a',
        title: 'Inputs',
        who: 'Field ops',
        desc: 'Fertiliser, chem, seed with N-P-K / ha and cost.',
        href: '/dashboard/fieldgraph/inputs',
        icon: FlaskConical,
      },
      {
        id: 'fleet',
        n: '4b',
        title: 'Vehicle management',
        who: 'Field ops',
        desc: 'Registry, daily activity by field, fuel and utilisation reports.',
        href: '/dashboard/fieldgraph/fleet',
        icon: Tractor,
      },
      {
        id: 'labour',
        n: '4c',
        title: 'Gangs & rates',
        who: 'Field ops',
        desc: 'Permanent / temporary / contractor rates; log cost by field.',
        href: '/dashboard/fieldgraph/labour',
        icon: Users,
      },
    ],
  },
  {
    id: 'regen',
    title: '5 · Regen & proof',
    subtitle: 'Soil · water · cover beside yield',
    steps: [
      {
        id: 'samples',
        n: '5a',
        title: 'Regen samples',
        who: 'Field ops',
        desc: 'Soil organic carbon, moisture, cover, water use, biodiversity notes.',
        href: '/dashboard/fieldgraph/regen',
        icon: Leaf,
      },
      {
        id: 'buyer-metrics',
        n: '5b',
        title: 'Buyer-ready metrics',
        who: 'Trade',
        desc: 'Same truth for farm office and ESG / buyer packs.',
        href: '/dashboard/fieldgraph/regen',
        icon: ShieldCheck,
      },
    ],
  },
  {
    id: 'messages',
    title: '6 · Messages (internal & trade)',
    subtitle: 'Farm office · field ops · mill / buyer partners',
    steps: [
      {
        id: 'office-field',
        n: '6a',
        title: 'Office · field threads',
        who: 'Farm office / Field ops',
        desc: 'In-app colleague chat for cut plans, inputs and harvest hand-offs.',
        href: '/dashboard/messages',
        icon: MessageSquare,
      },
      {
        id: 'trade-msg',
        n: '6b',
        title: 'Trade partner messages',
        who: 'Trade',
        desc: 'Message mills, silos and buyers on the platform company inbox.',
        href: '/dashboard/messages',
        icon: MessageSquare,
      },
      {
        id: 'close-msg',
        n: '6c',
        title: 'Close the loop',
        who: 'Team',
        desc: 'Keep operational decisions on threads next to the field book.',
        href: '/dashboard/messages',
        icon: MessageSquare,
      },
    ],
  },
  {
    id: 'trade',
    title: '7 · Trade · lots · insights',
    subtitle: 'Farm to mill / buyer on the network',
    steps: [
      {
        id: 'trade',
        n: '7a',
        title: 'Trade destinations',
        who: 'Trade',
        desc: 'Hand harvest into mills, silos and buyers with trust and OTIF.',
        href: '/dashboard/fieldgraph/trade',
        icon: ShoppingCart,
      },
      {
        id: 'lots',
        n: '7b',
        title: 'Origin lots',
        who: 'Trade',
        desc: 'Field origin into Inventory lots for chain of custody.',
        href: '/dashboard/inventory/lots',
        icon: Warehouse,
      },
      {
        id: 'insights',
        n: '7c',
        title: 'Season insights',
        who: 'Farm office',
        desc: 'Yield, nutrients, fleet, labour cost and regen on one scorecard.',
        href: '/dashboard/fieldgraph/report',
        icon: Sparkles,
      },
    ],
  },
];

const ROLE_CARDS = [
  {
    tone: 'office' as const,
    icon: MapPinned,
    title: 'Farm office',
    subtitle: 'Master data · estimates · plan',
    does: [
      'Maintain field & agronomic book',
      'Create and revise season estimates',
      'Submit mill / board estimate packs',
      'Set harvest sequence & daily allocation',
      'Review season scorecard & yield graphs',
      'Message field ops and trade partners in-app',
    ],
    doesNot: [
      'Does not invent mill board rules alone',
      'Does not replace statutory payroll (People)',
    ],
    href: '/dashboard/fieldgraph/fields',
  },
  {
    tone: 'ops' as const,
    icon: Tractor,
    title: 'Field ops',
    subtitle: 'Inputs · fleet · gangs',
    does: [
      'Log fertiliser / chem applications',
      'Register vehicles and log fuel/hours',
      'Register gangs with labour rates',
      'Log daily labour cost by field',
      'Capture regen samples (SOC, cover, water)',
      'Message farm office on ops and cut plan threads',
    ],
    doesNot: [
      'Does not change shared field codes casually',
      'Does not skip rate snapshot on labour logs',
    ],
    href: '/dashboard/fieldgraph/fleet',
  },
  {
    tone: 'trade' as const,
    icon: ShoppingCart,
    title: 'Trade & network',
    subtitle: 'Mill · silo · buyer · lots',
    does: [
      'Set harvest destinations (mill / silo / buyer)',
      'Hand lots into Inventory with field origin',
      'Trade on SupplierAdvisor network',
      'Carry OTIFEF / trust into settlement',
      'Show regen proof next to yield',
      'Message mill / buyer partners on company inbox',
    ],
    doesNot: [
      'Does not farm offline in a private island',
      'Does not drop origin when stock moves',
    ],
    href: '/dashboard/fieldgraph/trade',
  },
];

const GUARDRAILS = [
  {
    title: 'Shared field master',
    desc: 'Estimates, harvest, inputs, fleet and labour all key off the same field codes and hectares.',
  },
  {
    title: 'Estimate revision trail',
    desc: 'Material changes snapshot prior tonnes, quality and status for board reports.',
  },
  {
    title: 'Cut dates from truth',
    desc: 'Projection uses non-draft estimates and daily allocation — not guesswork calendars.',
  },
  {
    title: 'Labour rate on the log',
    desc: 'Each labour day stores rate unit and computed cost for field profitability.',
  },
  {
    title: 'Fuel by vehicle',
    desc: 'Fleet logs link to the vehicle register for utilisation and L/hour.',
  },
  {
    title: 'Origin never drops',
    desc: 'Lots inherit field origin so mill / buyer traceability stays intact.',
  },
];

export default function FieldgraphSystemFlow({
  compact,
  defaultCollapsed = false,
}: Props) {
  const [open, setOpen] = useState(!defaultCollapsed);

  return (
    <section
      className={`rounded-3xl border border-slate-200 bg-white overflow-hidden ${
        compact ? 'mb-4' : 'mb-6'
      }`}
      aria-label="CropAdvisor full process design: fields to estimates to harvest to trade"
      id="fieldgraph-system-flow"
    >
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-700 to-teal-600 px-5 py-4 text-white">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-left min-w-0 flex-1"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              CropAdvisor® — process design
            </p>
            <h2 className="text-lg sm:text-xl font-black mt-0.5 leading-tight">
              Fields → Estimates → Harvest → Ops → Messages → Trade → Sold &
              proven
            </h2>
            <p className="text-sm text-white/90 mt-1.5 max-w-3xl leading-snug">
              Shared field master feeds estimates and harvest planning; vehicles
              and labour rates cost the season; office, field and trade partners
              message in-app; regen and lots carry proof into mill and buyer
              trade. Multi-crop — not cane-only.
            </p>
          </button>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <FieldgraphProcessPdfButtons variant="map" />
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
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2 text-center">
            {[
              { label: 'Field & agronomic', sub: 'Shared master', tone: 'emerald' },
              { label: 'Estimates', sub: 'Season · board', tone: 'sky' },
              { label: 'Harvest Planner', sub: 'Cut dates', tone: 'amber' },
              { label: 'Ops · regen', sub: 'Fleet · rates', tone: 'violet' },
              { label: 'Messages', sub: 'Office · field · trade', tone: 'fuchsia' },
              { label: 'Sold & proven', sub: 'Trade · lots', tone: 'rose' },
            ].map((node, i, arr) => (
              <div key={node.label} className="contents">
                <div
                  className={`rounded-2xl border px-3 py-2 min-w-[6.5rem] ${
                    node.tone === 'emerald'
                      ? 'border-emerald-200 bg-emerald-50'
                      : node.tone === 'sky'
                        ? 'border-sky-200 bg-sky-50'
                        : node.tone === 'amber'
                          ? 'border-amber-200 bg-amber-50'
                          : node.tone === 'violet'
                            ? 'border-violet-200 bg-violet-50'
                            : node.tone === 'fuchsia'
                              ? 'border-fuchsia-200 bg-fuchsia-50'
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
                    ['office', 'Farm office'],
                    ['ops', 'Field ops'],
                    ['trade', 'Trade'],
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
                <RoleCard key={card.title} {...card} />
              ))}
            </div>
          </div>

          {/* Full process phases */}
          <div className="space-y-6">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Full process (land → sold & proven)
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Read top to bottom. Each step opens the live workbench.
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
                      <PhaseStepCard step={step} />
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

          {/* Guardrails */}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700 dark:text-white" />
              <h3 className="text-sm font-black text-emerald-950 dark:text-white">
                Guardrails — one book of truth from field to buyer
              </h3>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {GUARDRAILS.map((g) => (
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
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex items-start gap-2 text-emerald-950 dark:text-white min-w-0 flex-1">
                <Sparkles className="w-5 h-5 shrink-0 text-emerald-700 dark:text-white mt-0.5" />
                <p className="text-sm leading-snug">
                  <strong className="font-black">One sentence:</strong> Register
                  shared fields → estimate and revise for the board → plan
                  harvest cut dates from sequence and daily allocation → run
                  inputs, fleet and labour rates → prove regen → trade to
                  mill/buyer with origin lots and season insights.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link
                  href="/dashboard/fieldgraph/fields"
                  className="text-[11px] font-bold rounded-full bg-emerald-800 text-white px-3 py-1.5"
                >
                  Fields
                </Link>
                <Link
                  href="/dashboard/fieldgraph/harvest"
                  className="text-[11px] font-bold rounded-full bg-white border border-emerald-200 px-3 py-1.5 text-emerald-800 dark:text-emerald-950"
                >
                  Harvest
                </Link>
                <Link
                  href="/dashboard/fieldgraph/report"
                  className="text-[11px] font-bold rounded-full bg-white border border-emerald-200 px-3 py-1.5 text-emerald-800 dark:text-emerald-950"
                >
                  Insights
                </Link>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
            <p className="text-[11px] text-slate-500">
              Download the same design as a 2-page A4 PDF for training packs.
            </p>
            <FieldgraphProcessPdfButtons variant="inline" />
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Role colour codes — distinct in light and dark for “Who does what”. */
const ROLE_STYLES = {
  office: {
    // Emerald — farm office (dark: tinted gradient + white type)
    card:
      'border-emerald-300 bg-emerald-50/50 dark:border-emerald-400 dark:bg-gradient-to-br dark:from-emerald-950 dark:via-[#0a1a14] dark:to-black dark:ring-1 dark:ring-emerald-500/40 dark:text-white',
    badge: 'bg-emerald-700 dark:bg-emerald-500',
    chip:
      'bg-emerald-700 text-white dark:bg-emerald-500 dark:text-white',
    title: 'text-slate-900 dark:text-white',
    subtitle: 'text-slate-500 dark:text-white/75',
    doesLabel: 'text-emerald-700 dark:text-white',
    doesText: 'text-slate-700 dark:text-white/90',
    link: 'text-emerald-800 dark:text-white',
    swatch: 'bg-emerald-600 dark:bg-emerald-400',
    label: 'Farm office',
  },
  ops: {
    // Amber — field ops
    card:
      'border-amber-300 bg-amber-50/50 dark:border-amber-400 dark:bg-gradient-to-br dark:from-amber-950 dark:via-[#1a1408] dark:to-black dark:ring-1 dark:ring-amber-500/40 dark:text-white',
    badge: 'bg-amber-600 dark:bg-amber-500',
    chip:
      'bg-amber-600 text-white dark:bg-amber-500 dark:text-white',
    title: 'text-slate-900 dark:text-white',
    subtitle: 'text-slate-500 dark:text-white/75',
    doesLabel: 'text-amber-800 dark:text-white',
    doesText: 'text-slate-700 dark:text-white/90',
    link: 'text-amber-800 dark:text-white',
    swatch: 'bg-amber-500 dark:bg-amber-400',
    label: 'Field ops',
  },
  trade: {
    // Cyan — trade & network
    card:
      'border-cyan-300 bg-sky-50/50 dark:border-cyan-400 dark:bg-gradient-to-br dark:from-cyan-950 dark:via-[#061820] dark:to-black dark:ring-1 dark:ring-cyan-500/40 dark:text-white',
    badge: 'bg-sky-600 dark:bg-cyan-500',
    chip:
      'bg-sky-600 text-white dark:bg-cyan-500 dark:text-white',
    title: 'text-slate-900 dark:text-white',
    subtitle: 'text-slate-500 dark:text-white/75',
    doesLabel: 'text-sky-700 dark:text-white',
    doesText: 'text-slate-700 dark:text-white/90',
    link: 'text-sky-800 dark:text-white',
    swatch: 'bg-sky-500 dark:bg-cyan-400',
    label: 'Trade',
  },
} as const;

function roleToneFromWho(who: string): keyof typeof ROLE_STYLES {
  const w = who.toLowerCase();
  if (
    w.includes('ops') ||
    w.includes('fleet') ||
    w.includes('gang') ||
    w.includes('field ops') ||
    w.includes('labour') ||
    w.includes('input')
  ) {
    return 'ops';
  }
  if (
    w.includes('trade') ||
    w.includes('mill') ||
    w.includes('buyer') ||
    w.includes('network') ||
    w.includes('silo')
  ) {
    return 'trade';
  }
  return 'office';
}

function RoleCard({
  tone,
  icon: Icon,
  title,
  subtitle,
  does,
  doesNot,
  href,
}: {
  tone: 'office' | 'ops' | 'trade';
  icon: typeof MapPinned;
  title: string;
  subtitle: string;
  does: string[];
  doesNot: string[];
  href: string;
}) {
  const s = ROLE_STYLES[tone];
  return (
    <div className={`rounded-2xl border p-4 flex flex-col ${s.card}`}>
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
            <span className="text-emerald-600 dark:text-white font-bold shrink-0">
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

function PhaseStepCard({ step }: { step: PhaseStep }) {
  const Icon = step.icon;
  const tone = roleToneFromWho(step.who);
  const s = ROLE_STYLES[tone];
  return (
    <Link
      href={step.href}
      className="flex-1 min-w-0 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 transition-all hover:shadow-sm hover:bg-white hover:border-emerald-300 group dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-emerald-500/40 dark:hover:bg-neutral-900"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`w-7 h-7 rounded-full text-white text-[10px] font-black flex items-center justify-center ${s.badge}`}
        >
          {step.n}
        </span>
        <Icon className={`w-4 h-4 ${s.doesLabel}`} />
      </div>
      <p className="text-xs font-black text-slate-900 group-hover:text-emerald-800 dark:text-neutral-100 dark:group-hover:text-white">
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
