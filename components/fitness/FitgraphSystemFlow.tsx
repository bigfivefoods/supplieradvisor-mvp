'use client';

/**
 * End-to-end Fitgraph® process design:
 * Coaches → Members → Plans → Calendar → Bookings → Website
 *
 * Expandable on the Fitgraph command hub; downloadable A4 PDF
 * (landscape + portrait) — same pattern as NSNP / Fieldgraph.
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  Dumbbell,
  Globe,
  Repeat,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';
import FitgraphProcessPdfButtons from '@/components/fitness/FitgraphProcessPdfButtons';

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
  icon: typeof UserRound;
};

type Phase = {
  id: string;
  title: string;
  subtitle: string;
  steps: PhaseStep[];
};

const PHASES: Phase[] = [
  {
    id: 'people',
    title: '1 · People (coaches & members)',
    subtitle: 'Who trains · who attends',
    steps: [
      {
        id: 'coaches',
        n: '1a',
        title: 'Coach register',
        who: 'Owner',
        desc: 'Specialties, public bio; issue coach portal token.',
        href: '/dashboard/fitgraph/coaches',
        icon: UserRound,
      },
      {
        id: 'clients',
        n: '1b',
        title: 'Clients / members',
        who: 'Owner',
        desc: 'Member book, status, assigned coach.',
        href: '/dashboard/fitgraph/clients',
        icon: Users,
      },
      {
        id: 'portal',
        n: '1c',
        title: 'Coach portal link',
        who: 'Owner',
        desc: 'Copy private URL so coaches share and manage classes.',
        href: '/dashboard/fitgraph/coaches',
        icon: Globe,
      },
    ],
  },
  {
    id: 'money',
    title: '2 · Memberships & subscriptions',
    subtitle: 'Plans sell · subs track entitlement',
    steps: [
      {
        id: 'plans',
        n: '2a',
        title: 'Membership plans',
        who: 'Owner',
        desc: 'Unlimited, packs, drop-in; public pricing flag.',
        href: '/dashboard/fitgraph/memberships',
        icon: CreditCard,
      },
      {
        id: 'subs',
        n: '2b',
        title: 'Subscriptions',
        who: 'Owner',
        desc: 'Active / trial / paused; remaining class credits.',
        href: '/dashboard/fitgraph/subscriptions',
        icon: Repeat,
      },
      {
        id: 'pt',
        n: '2c',
        title: 'PT packs',
        who: 'Owner',
        desc: 'Personal-training packs per client and coach.',
        href: '/dashboard/fitgraph/memberships',
        icon: Dumbbell,
      },
    ],
  },
  {
    id: 'classes',
    title: '3 · Class types',
    subtitle: 'What you sell on the floor',
    steps: [
      {
        id: 'types',
        n: '3a',
        title: 'Define classes',
        who: 'Owner',
        desc: 'HIIT, strength, yoga — duration and capacity.',
        href: '/dashboard/fitgraph/classes',
        icon: Dumbbell,
      },
      {
        id: 'cat',
        n: '3b',
        title: 'Categories',
        who: 'Owner',
        desc: 'Group types for calendar filters and reports.',
        href: '/dashboard/fitgraph/classes',
        icon: Sparkles,
      },
    ],
  },
  {
    id: 'calendar',
    title: '4 · Calendar (schedule coaches)',
    subtitle: 'Owner puts coaches on the grid',
    steps: [
      {
        id: 'sched',
        n: '4a',
        title: 'Schedule session',
        who: 'Owner',
        desc: 'Date, time, room, class type, assign coach.',
        href: '/dashboard/fitgraph/calendar',
        icon: CalendarDays,
      },
      {
        id: 'public',
        n: '4b',
        title: 'Publish public',
        who: 'Owner',
        desc: 'Mark public + notes for website embed.',
        href: '/dashboard/fitgraph/calendar',
        icon: Globe,
      },
      {
        id: 'reassign',
        n: '4c',
        title: 'Reassign coach',
        who: 'Owner',
        desc: 'Change coach; portal reflects ownership.',
        href: '/dashboard/fitgraph/calendar',
        icon: UserRound,
      },
    ],
  },
  {
    id: 'floor',
    title: '5 · Floor (bookings · check-ins · coach share)',
    subtitle: 'Capacity, waitlist, attendance',
    steps: [
      {
        id: 'book',
        n: '5a',
        title: 'Book members',
        who: 'Desk / coach',
        desc: 'Book session; auto-waitlist when full.',
        href: '/dashboard/fitgraph/bookings',
        icon: ClipboardCheck,
      },
      {
        id: 'checkin',
        n: '5b',
        title: 'Check-ins',
        who: 'Desk',
        desc: 'Front-desk or class attendance log.',
        href: '/dashboard/fitgraph/checkins',
        icon: ClipboardCheck,
      },
      {
        id: 'share',
        n: '5c',
        title: 'Coach share',
        who: 'Coach',
        desc: 'Portal: share class, book guests, mark attended.',
        href: '/dashboard/fitgraph/coaches',
        icon: UserRound,
      },
    ],
  },
  {
    id: 'web',
    title: '6 · Website, embed & insights',
    subtitle: 'Customer-facing gym on SupplierAdvisor®',
    steps: [
      {
        id: 'settings',
        n: '6a',
        title: 'Website settings',
        who: 'Owner',
        desc: 'Publish calendar, brand, booking on/off, token.',
        href: '/dashboard/fitgraph/website',
        icon: Globe,
      },
      {
        id: 'embed',
        n: '6b',
        title: 'Embed / API',
        who: 'Owner',
        desc: 'Iframe page or JSON for the gym’s own website.',
        href: '/dashboard/fitgraph/website',
        icon: Globe,
      },
      {
        id: 'report',
        n: '6c',
        title: 'Reports',
        who: 'Owner',
        desc: 'Attendance by class, members, PT remaining.',
        href: '/dashboard/fitgraph/report',
        icon: Sparkles,
      },
    ],
  },
];

const ROLE_CARDS = [
  {
    tone: 'owner' as const,
    icon: UserRound,
    title: 'Gym owner / manager',
    subtitle: 'Brand · schedule · money',
    does: [
      'Register coaches and issue portal links',
      'Define membership plans & subscriptions',
      'Schedule classes and assign coaches',
      'Publish public calendar & website embed',
      'Review attendance and utilisation reports',
    ],
    doesNot: [
      'Does not leave coaches unassigned on public classes',
      'Does not publish without website settings on',
    ],
    href: '/dashboard/fitgraph/calendar',
  },
  {
    tone: 'coach' as const,
    icon: Dumbbell,
    title: 'Coach',
    subtitle: 'Classes · roster · share',
    does: [
      'Open coach portal with private token',
      'Share / unshare classes publicly',
      'Book walk-in guests onto sessions',
      'Mark attendance on roster',
      'Update capacity and public notes',
    ],
    doesNot: [
      'Does not manage other coaches’ sessions',
      'Does not change membership billing',
    ],
    href: '/dashboard/fitgraph/coaches',
  },
  {
    tone: 'member' as const,
    icon: Users,
    title: 'Member / customer',
    subtitle: 'Book · attend · subscribe',
    does: [
      'See public schedule on website / embed',
      'Book online (or join waitlist when full)',
      'Hold active subscription or class pack',
      'Check in at front desk or class',
      'Buy PT packs with a preferred coach',
    ],
    doesNot: [
      'Does not see private / unpublished sessions',
      'Does not access coach portal tokens',
    ],
    href: '/dashboard/fitgraph/website',
  },
];

const GUARDRAILS = [
  {
    title: 'Coach on every public class',
    desc: 'Sessions assign a coach; portal only shows their roster.',
  },
  {
    title: 'Public = published',
    desc: 'Only public sessions appear on website embed and calendar API.',
  },
  {
    title: 'Capacity & waitlist',
    desc: 'Bookings auto-waitlist when full — desk, coach or website.',
  },
  {
    title: 'Subscriptions sync status',
    desc: 'Sub pause/cancel updates client membership for floor truth.',
  },
  {
    title: 'Tokenised portals',
    desc: 'Website and coach portals use secret tokens — no private PII on public calendar.',
  },
  {
    title: 'One gym book',
    desc: 'Coaches, classes, bookings and website share the same Fitgraph store.',
  },
];

export default function FitgraphSystemFlow({
  compact,
  defaultCollapsed = false,
}: Props) {
  const [open, setOpen] = useState(!defaultCollapsed);

  return (
    <section
      className={`rounded-3xl border border-slate-200 bg-white overflow-hidden ${
        compact ? 'mb-4' : 'mb-6'
      }`}
      aria-label="Fitgraph full process design"
      id="fitgraph-system-flow"
    >
      <div className="bg-gradient-to-r from-violet-950 via-violet-800 to-fuchsia-700 px-5 py-4 text-white">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-left min-w-0 flex-1"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              Full gym OS — process design
            </p>
            <h2 className="text-lg sm:text-xl font-black mt-0.5 leading-tight">
              Coaches → Members → Plans → Calendar → Bookings → Website
            </h2>
            <p className="text-sm text-white/90 mt-1.5 max-w-3xl leading-snug">
              Owner schedules coaches, coach portal shares classes with
              customers, subscriptions track entitlement, and the public
              calendar embeds on the gym website.
            </p>
          </button>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <FitgraphProcessPdfButtons variant="map" />
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
              { label: 'People', sub: 'Coaches · members', tone: 'violet' },
              { label: 'Plans · subs', sub: 'Memberships', tone: 'emerald' },
              { label: 'Class types', sub: 'Capacity', tone: 'amber' },
              { label: 'Calendar', sub: 'Schedule coaches', tone: 'sky' },
              { label: 'Floor', sub: 'Book · check-in', tone: 'rose' },
              { label: 'Website', sub: 'Embed · portal', tone: 'fuchsia' },
            ].map((node, i, arr) => (
              <div key={node.label} className="contents">
                <div
                  className={`rounded-2xl border px-3 py-2 min-w-[6rem] ${
                    node.tone === 'violet'
                      ? 'border-violet-200 bg-violet-50'
                      : node.tone === 'emerald'
                        ? 'border-emerald-200 bg-emerald-50'
                        : node.tone === 'amber'
                          ? 'border-amber-200 bg-amber-50'
                          : node.tone === 'sky'
                            ? 'border-sky-200 bg-sky-50'
                            : node.tone === 'rose'
                              ? 'border-rose-200 bg-rose-50'
                              : 'border-fuchsia-200 bg-fuchsia-50'
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
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Who does what
            </h3>
            <div className="grid lg:grid-cols-3 gap-3">
              {ROLE_CARDS.map((card) => (
                <RoleCard key={card.title} {...card} />
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Full process (people → website)
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

          <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-violet-700" />
              <h3 className="text-sm font-black text-violet-950">
                Guardrails — one gym book of truth
              </h3>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {GUARDRAILS.map((g) => (
                <div
                  key={g.title}
                  className="rounded-xl bg-white border border-violet-100 px-3 py-2.5"
                >
                  <p className="text-xs font-bold text-slate-900">{g.title}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    {g.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex items-start gap-2 text-violet-950 min-w-0 flex-1">
                <Sparkles className="w-5 h-5 shrink-0 text-violet-700 mt-0.5" />
                <p className="text-sm leading-snug">
                  <strong className="font-black">One sentence:</strong> Register
                  coaches and members → sell plans and track subscriptions →
                  define class types → schedule coaches onto sessions and
                  publish → book and check in on the floor (or coach portal) →
                  embed the public calendar on the gym website.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link
                  href="/dashboard/fitgraph/calendar"
                  className="text-[11px] font-bold rounded-full bg-violet-800 text-white px-3 py-1.5"
                >
                  Calendar
                </Link>
                <Link
                  href="/dashboard/fitgraph/website"
                  className="text-[11px] font-bold rounded-full bg-white border border-violet-200 px-3 py-1.5 text-violet-800"
                >
                  Website
                </Link>
                <Link
                  href="/dashboard/fitgraph/report"
                  className="text-[11px] font-bold rounded-full bg-white border border-violet-200 px-3 py-1.5 text-violet-800"
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
            <FitgraphProcessPdfButtons variant="inline" />
          </div>
        </div>
      ) : null}
    </section>
  );
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
  tone: 'owner' | 'coach' | 'member';
  icon: typeof UserRound;
  title: string;
  subtitle: string;
  does: string[];
  doesNot: string[];
  href: string;
}) {
  const ring =
    tone === 'owner'
      ? 'border-violet-200 bg-violet-50/40'
      : tone === 'coach'
        ? 'border-amber-200 bg-amber-50/40'
        : 'border-sky-200 bg-sky-50/40';
  const badge =
    tone === 'owner'
      ? 'bg-violet-700'
      : tone === 'coach'
        ? 'bg-amber-600'
        : 'bg-sky-600';
  return (
    <div className={`rounded-2xl border p-4 flex flex-col ${ring}`}>
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
      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700 mb-1">
        Does
      </p>
      <ul className="space-y-1 flex-1 mb-2">
        {does.map((p) => (
          <li
            key={p}
            className="text-[12px] text-slate-700 leading-snug flex gap-1.5"
          >
            <span className="text-emerald-600 font-bold shrink-0">✓</span>
            {p}
          </li>
        ))}
      </ul>
      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 mb-1">
        Does not
      </p>
      <ul className="space-y-1 mb-3">
        {doesNot.map((p) => (
          <li
            key={p}
            className="text-[12px] text-slate-600 leading-snug flex gap-1.5"
          >
            <span className="text-rose-500 font-bold shrink-0">✗</span>
            {p}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className="text-[11px] font-bold text-violet-800 inline-flex items-center gap-1"
      >
        Open workspace <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function PhaseStepCard({ step }: { step: PhaseStep }) {
  const Icon = step.icon;
  return (
    <Link
      href={step.href}
      className="flex-1 min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-3 hover:border-violet-300 hover:bg-violet-50/30 transition-colors"
    >
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-900 flex items-center justify-center shrink-0 text-[10px] font-black">
          {step.n}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5 text-violet-700 shrink-0" />
            <p className="text-xs font-black text-slate-900 truncate">
              {step.title}
            </p>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700/80 mt-0.5">
            {step.who}
          </p>
          <p className="text-[11px] text-slate-600 mt-1 leading-snug">
            {step.desc}
          </p>
        </div>
      </div>
    </Link>
  );
}
