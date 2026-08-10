'use client';

/**
 * End-to-end QuarryAdvisor® process design:
 * Locations → Sites → Reserves → Plant → Dispatch → Messages → Sold & compliant
 *
 * Expandable on the QuarryAdvisor command hub; downloadable A4 PDF
 * (landscape + portrait) — same pattern as NSNP / FieldAdvisor.
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ChevronDown,
  Factory,
  HardHat,
  MapPin,
  MessageSquare,
  Mountain,
  Scale,
  ShieldCheck,
  Sparkles,
  Tractor,
  Users,
} from 'lucide-react';
import QuarrygraphProcessPdfButtons from '@/components/quarry/QuarrygraphProcessPdfButtons';

type Props = {
  compact?: boolean;
  defaultCollapsed?: boolean;
};

type PhaseStep = {
  id: string;
  n: string;
  title: string;
  who: string;
  desc: string;
  href: string;
  icon: typeof MapPin;
};

type Phase = {
  id: string;
  title: string;
  subtitle: string;
  steps: PhaseStep[];
};

const PHASES: Phase[] = [
  {
    id: 'locations',
    title: '1 · Locations (permanent · temporary · batching)',
    subtitle: 'Multi-quarry estate + project plants with GPS',
    steps: [
      {
        id: 'perm',
        n: '1a',
        title: 'Permanent quarries',
        who: 'Quarry office',
        desc: 'Estates with district, rights, target t/day, lat/lng.',
        href: '/dashboard/quarrygraph/quarries',
        icon: Mountain,
      },
      {
        id: 'temp',
        n: '1b',
        title: 'Temporary & batching',
        who: 'Quarry office',
        desc: 'Project borrow pits and ready-mix plants with dates.',
        href: '/dashboard/quarrygraph/locations',
        icon: MapPin,
      },
      {
        id: 'gps',
        n: '1c',
        title: 'Distance matrix',
        who: 'System',
        desc: 'Haversine + road estimate + Google Maps directions.',
        href: '/dashboard/quarrygraph/locations',
        icon: MapPin,
      },
      {
        id: 'alloc',
        n: '1d',
        title: 'Allocate resources',
        who: 'Quarry office',
        desc: 'Vehicles, crews, mobile plant to a site or project.',
        href: '/dashboard/quarrygraph/locations',
        icon: Tractor,
      },
    ],
  },
  {
    id: 'master',
    title: '2 · Sites, products & compliance',
    subtitle: 'Shared master under each operation',
    steps: [
      {
        id: 'sites',
        n: '2a',
        title: 'Pits · faces · pads',
        who: 'Quarry office',
        desc: 'Site type, material, hectares, GPS under parent quarry.',
        href: '/dashboard/quarrygraph/sites',
        icon: HardHat,
      },
      {
        id: 'products',
        n: '2b',
        title: 'Products & grades',
        who: 'Quarry office',
        desc: 'G1–G7, stone, sand, density t/m³.',
        href: '/dashboard/quarrygraph/products',
        icon: Factory,
      },
      {
        id: 'permits',
        n: '2c',
        title: 'Permits',
        who: 'Quarry office',
        desc: 'Mining right, WUL, EMP/EA with expiry flags.',
        href: '/dashboard/quarrygraph/compliance',
        icon: ShieldCheck,
      },
    ],
  },
  {
    id: 'plan',
    title: '3 · Reserves & production plan',
    subtitle: 'Survey → sequence → daily allocation → blast',
    steps: [
      {
        id: 'reserves',
        n: '3a',
        title: 'Reserve estimates',
        who: 'Quarry office',
        desc: 'Recoverable tonnes and quality by site / season.',
        href: '/dashboard/quarrygraph/reserves',
        icon: Mountain,
      },
      {
        id: 'sequence',
        n: '3b',
        title: 'Production sequence',
        who: 'Quarry office',
        desc: 'Order work; daily t allocation → projected dates.',
        href: '/dashboard/quarrygraph/production',
        icon: HardHat,
      },
      {
        id: 'blasts',
        n: '3c',
        title: 'Blast logs',
        who: 'Pit ops',
        desc: 'Holes, explosives, estimated vs measured tonnes.',
        href: '/dashboard/quarrygraph/production',
        icon: HardHat,
      },
    ],
  },
  {
    id: 'plant',
    title: '4 · Plant, stockpiles & dispatch',
    subtitle: 'Crush → pad → weighbridge',
    steps: [
      {
        id: 'runs',
        n: '4a',
        title: 'Plant runs',
        who: 'Plant ops',
        desc: 'Hours, feed t, output t by product and site.',
        href: '/dashboard/quarrygraph/plant',
        icon: Factory,
      },
      {
        id: 'stock',
        n: '4b',
        title: 'Stockpiles',
        who: 'Plant ops',
        desc: 'Book balances by product pad; survey dates.',
        href: '/dashboard/quarrygraph/plant',
        icon: Factory,
      },
      {
        id: 'dispatch',
        n: '4c',
        title: 'Weighbridge',
        who: 'Dispatch',
        desc: 'Tickets, customer, destination, net t; stock deduct.',
        href: '/dashboard/quarrygraph/dispatch',
        icon: Scale,
      },
    ],
  },
  {
    id: 'ops',
    title: '5 · Fleet, labour & cost',
    subtitle: 'Fuel util · R/km · gangs',
    steps: [
      {
        id: 'fleet',
        n: '5a',
        title: 'Fleet metrics',
        who: 'Plant ops',
        desc: 'L/h, L/km, fuel util %, cost R/km, util %.',
        href: '/dashboard/quarrygraph/fleet',
        icon: Tractor,
      },
      {
        id: 'labour',
        n: '5b',
        title: 'Labour rates',
        who: 'Plant ops',
        desc: 'Permanent / temporary / contractor costed day logs.',
        href: '/dashboard/quarrygraph/labour',
        icon: Users,
      },
      {
        id: 'qa',
        n: '5c',
        title: 'Lab QA',
        who: 'Dispatch',
        desc: 'CS / grading pass-fail linked to site and product.',
        href: '/dashboard/quarrygraph/quality',
        icon: ShieldCheck,
      },
    ],
  },
  {
    id: 'messages',
    title: '6 · Messages (internal & trade)',
    subtitle: 'Quarry office · plant · dispatch · customers',
    steps: [
      {
        id: 'office-pit',
        n: '6a',
        title: 'Office · pit threads',
        who: 'Quarry office / Plant',
        desc: 'In-app colleague chat for blasts, plant runs and stock hand-offs.',
        href: '/dashboard/messages',
        icon: MessageSquare,
      },
      {
        id: 'dispatch-cust',
        n: '6b',
        title: 'Dispatch · customer messages',
        who: 'Dispatch / Trade',
        desc: 'Coordinate tickets and deliveries with customers on company inbox.',
        href: '/dashboard/messages',
        icon: MessageSquare,
      },
      {
        id: 'close-msg',
        n: '6c',
        title: 'Close the loop',
        who: 'Team',
        desc: 'Keep operational decisions on threads next to the quarry book.',
        href: '/dashboard/messages',
        icon: MessageSquare,
      },
    ],
  },
  {
    id: 'outcome',
    title: '7 · Reports & sold & compliant',
    subtitle: 'Management pack next to every tonne',
    steps: [
      {
        id: 'report',
        n: '7a',
        title: 'Key reports',
        who: 'Quarry office',
        desc: 'By quarry, vehicle KPIs, product balance, labour.',
        href: '/dashboard/quarrygraph/report',
        icon: Sparkles,
      },
      {
        id: 'sold',
        n: '7b',
        title: 'Sold & compliant',
        who: 'Trade',
        desc: 'Dispatch with permits valid and QA on the trail.',
        href: '/dashboard/quarrygraph/dispatch',
        icon: Scale,
      },
    ],
  },
];

const ROLE_CARDS = [
  {
    tone: 'office' as const,
    icon: Mountain,
    title: 'Quarry office',
    subtitle: 'Master data · plan · compliance',
    does: [
      'Register permanent / temporary / batching ops',
      'Maintain sites, products, permits',
      'Survey reserves and production sequence',
      'Allocate fleet / crews to project locations',
      'Review management pack (t, fuel util, R/km)',
      'Message plant, dispatch and trade partners in-app',
    ],
    doesNot: [
      'Does not invent pit codes mid-blast',
      'Does not skip GPS when haul distance matters',
    ],
    href: '/dashboard/quarrygraph/quarries',
  },
  {
    tone: 'ops' as const,
    icon: HardHat,
    title: 'Plant & pit ops',
    subtitle: 'Blast · crush · fleet · labour',
    does: [
      'Log blasts and plant runs against sites',
      'Keep stockpile balances current',
      'Log fleet hours, fuel, km (L/h · R/km)',
      'Cost labour gangs with rates',
      'Feed hoppers and pads for dispatch',
      'Message office on plant and blast threads',
    ],
    doesNot: [
      'Does not dispatch without product / site link',
      'Does not ignore book fuel burn targets',
    ],
    href: '/dashboard/quarrygraph/fleet',
  },
  {
    tone: 'trade' as const,
    icon: Scale,
    title: 'Dispatch & trade',
    subtitle: 'Weighbridge · customer · QA',
    does: [
      'Issue weighbridge tickets (net t, destination)',
      'Deduct stock when ticketed',
      'Attach lab QA to product and site',
      'Serve permanent yards and project plants',
      'Export key reports for management',
      'Message customers on company inbox for tickets',
    ],
    doesNot: [
      'Does not ship without permits in view',
      'Does not drop site origin on tickets',
    ],
    href: '/dashboard/quarrygraph/dispatch',
  },
];

const GUARDRAILS = [
  {
    title: 'One site code',
    desc: 'Reserves, blasts, plant, stock and dispatch key off the same site master.',
  },
  {
    title: 'GPS for haul truth',
    desc: 'Lat/lng enable distance matrix and Google Maps between ops.',
  },
  {
    title: 'Temp has an end date',
    desc: 'Temporary quarries and batch plants carry project window.',
  },
  {
    title: 'Fuel util is first-class',
    desc: 'L/h, L/km and R/km from shift logs — not spreadsheet afterthoughts.',
  },
  {
    title: 'Stock follows tickets',
    desc: 'Dispatch can deduct stockpile balance when tickets post.',
  },
  {
    title: 'Permits auto-flag',
    desc: 'Expiring / expired rights and WUL visible next to production.',
  },
];

export default function QuarrygraphSystemFlow({
  compact,
  defaultCollapsed = false,
}: Props) {
  const [open, setOpen] = useState(!defaultCollapsed);

  return (
    <section
      className={`rounded-3xl border border-slate-200 bg-white overflow-hidden ${
        compact ? 'mb-4' : 'mb-6'
      }`}
      aria-label="QuarryAdvisor full process design"
      id="quarrygraph-system-flow"
    >
      <div className="bg-gradient-to-r from-stone-900 via-amber-900 to-orange-700 px-5 py-4 text-white">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-left min-w-0 flex-1"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              Full quarry OS — process design
            </p>
            <h2 className="text-lg sm:text-xl font-black mt-0.5 leading-tight">
              Locations → Sites → Reserves → Plant → Dispatch → Messages → Sold
              & compliant
            </h2>
            <p className="text-sm text-white/90 mt-1.5 max-w-3xl leading-snug">
              Permanent and temporary quarries, batching plants, GPS distances,
              fuel util and weighbridge — with in-app office, pit and trade
              messaging — one process from pit to ticket.
            </p>
          </button>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <QuarrygraphProcessPdfButtons variant="map" />
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
          <div className="flex flex-wrap items-center justify-center gap-2 text-center">
            {[
              { label: 'Locations', sub: 'Perm · temp · batch', tone: 'amber' },
              { label: 'Sites · products', sub: 'Pits · grades', tone: 'stone' },
              { label: 'Reserves · plan', sub: 'Blast · allocate', tone: 'sky' },
              { label: 'Plant · stock', sub: 'Crush · pads', tone: 'violet' },
              { label: 'Dispatch · ops', sub: 'Ticket · fleet', tone: 'emerald' },
              { label: 'Messages', sub: 'Office · pit · trade', tone: 'fuchsia' },
              { label: 'Sold & compliant', sub: 'QA · report', tone: 'rose' },
            ].map((node, i, arr) => (
              <div key={node.label} className="contents">
                <div
                  className={`rounded-2xl border px-3 py-2 min-w-[6rem] ${
                    node.tone === 'amber'
                      ? 'border-amber-200 bg-amber-50'
                      : node.tone === 'stone'
                        ? 'border-stone-200 bg-stone-50'
                        : node.tone === 'sky'
                          ? 'border-sky-200 bg-sky-50'
                          : node.tone === 'violet'
                            ? 'border-violet-200 bg-violet-50'
                            : node.tone === 'emerald'
                              ? 'border-emerald-200 bg-emerald-50'
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

          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                Who does what
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ['office', 'Quarry office'],
                    ['ops', 'Plant & pit'],
                    ['trade', 'Dispatch'],
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

          <div className="space-y-6">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Full process (location → sold & compliant)
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

          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-amber-800" />
              <h3 className="text-sm font-black text-amber-950">
                Guardrails — one book of truth from pit to ticket
              </h3>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {GUARDRAILS.map((g) => (
                <div
                  key={g.title}
                  className="rounded-xl bg-white border border-amber-100 px-3 py-2.5"
                >
                  <p className="text-xs font-bold text-slate-900">{g.title}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    {g.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex items-start gap-2 text-amber-950 min-w-0 flex-1">
                <Sparkles className="w-5 h-5 shrink-0 text-amber-700 mt-0.5" />
                <p className="text-sm leading-snug">
                  <strong className="font-black">One sentence:</strong> Register
                  permanent, temporary and batching locations with GPS → sites
                  and products → survey reserves and plan blasts → crush to
                  stockpiles → allocate fleet/labour → weighbridge dispatch with
                  QA and valid permits → report fuel util, R/km and tonnes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link
                  href="/dashboard/quarrygraph/locations"
                  className="text-[11px] font-bold rounded-full bg-amber-900 text-white px-3 py-1.5"
                >
                  Locations
                </Link>
                <Link
                  href="/dashboard/quarrygraph/fleet"
                  className="text-[11px] font-bold rounded-full bg-white border border-amber-200 px-3 py-1.5 text-amber-900"
                >
                  Fleet
                </Link>
                <Link
                  href="/dashboard/quarrygraph/report"
                  className="text-[11px] font-bold rounded-full bg-white border border-amber-200 px-3 py-1.5 text-amber-900"
                >
                  Reports
                </Link>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
            <p className="text-[11px] text-slate-500">
              Download the same design as a 2-page A4 PDF for training packs.
            </p>
            <QuarrygraphProcessPdfButtons variant="inline" />
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Role colour codes — distinct in light and dark for “Who does what”. */
const ROLE_STYLES = {
  office: {
    // Amber — quarry office
    card:
      'border-amber-300 bg-amber-50/50 dark:border-amber-400 dark:bg-amber-950 dark:ring-1 dark:ring-amber-500/40',
    badge: 'bg-amber-800 dark:bg-amber-500',
    chip:
      'bg-amber-800 text-white dark:bg-amber-500 dark:text-amber-950',
    title: 'text-slate-900 dark:text-amber-50',
    subtitle: 'text-slate-500 dark:text-amber-200/80',
    doesLabel: 'text-amber-800 dark:text-amber-300',
    doesText: 'text-slate-700 dark:text-amber-50/90',
    link: 'text-amber-900 dark:text-amber-300',
    swatch: 'bg-amber-600 dark:bg-amber-400',
    label: 'Quarry office',
  },
  ops: {
    // Violet — plant & pit ops (distinct from amber office)
    card:
      'border-violet-300 bg-violet-50/50 dark:border-violet-400 dark:bg-violet-950 dark:ring-1 dark:ring-violet-500/40',
    badge: 'bg-violet-700 dark:bg-violet-500',
    chip:
      'bg-violet-700 text-white dark:bg-violet-500 dark:text-white',
    title: 'text-slate-900 dark:text-violet-50',
    subtitle: 'text-slate-500 dark:text-violet-200/80',
    doesLabel: 'text-violet-700 dark:text-violet-300',
    doesText: 'text-slate-700 dark:text-violet-50/90',
    link: 'text-violet-800 dark:text-violet-300',
    swatch: 'bg-violet-600 dark:bg-violet-400',
    label: 'Plant & pit',
  },
  trade: {
    // Cyan — dispatch & trade
    card:
      'border-cyan-300 bg-sky-50/50 dark:border-cyan-400 dark:bg-cyan-950 dark:ring-1 dark:ring-cyan-500/40',
    badge: 'bg-sky-600 dark:bg-cyan-500',
    chip:
      'bg-sky-600 text-white dark:bg-cyan-500 dark:text-cyan-950',
    title: 'text-slate-900 dark:text-cyan-50',
    subtitle: 'text-slate-500 dark:text-cyan-200/80',
    doesLabel: 'text-sky-700 dark:text-cyan-300',
    doesText: 'text-slate-700 dark:text-cyan-50/90',
    link: 'text-sky-800 dark:text-cyan-300',
    swatch: 'bg-sky-500 dark:bg-cyan-400',
    label: 'Dispatch',
  },
} as const;

function roleToneFromWho(who: string): keyof typeof ROLE_STYLES {
  const w = who.toLowerCase();
  if (
    w.includes('plant') ||
    w.includes('pit') ||
    w.includes('ops') ||
    w.includes('fleet') ||
    w.includes('crew') ||
    w.includes('blast') ||
    w.includes('crush') ||
    w.includes('labour')
  ) {
    return 'ops';
  }
  if (
    w.includes('dispatch') ||
    w.includes('trade') ||
    w.includes('weigh') ||
    w.includes('ticket') ||
    w.includes('qa') ||
    w.includes('customer')
  ) {
    return 'trade';
  }
  // System / office default
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
  icon: typeof MapPin;
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

function PhaseStepCard({ step }: { step: PhaseStep }) {
  const Icon = step.icon;
  const tone = roleToneFromWho(step.who);
  const s = ROLE_STYLES[tone];
  return (
    <Link
      href={step.href}
      className="flex-1 min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-3 hover:border-amber-300 hover:bg-amber-50/30 transition-colors dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-amber-500/40 dark:hover:bg-neutral-900"
    >
      <div className="flex items-start gap-2">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black text-white ${s.badge}`}
        >
          {step.n}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon className={`w-3.5 h-3.5 shrink-0 ${s.doesLabel}`} />
            <p className="text-xs font-black text-slate-900 dark:text-neutral-100 truncate">
              {step.title}
            </p>
          </div>
          <span
            className={`inline-flex mt-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${s.chip}`}
          >
            {step.who}
          </span>
          <p className="text-[11px] text-slate-600 dark:text-neutral-400 mt-1 leading-snug">
            {step.desc}
          </p>
        </div>
      </div>
    </Link>
  );
}
