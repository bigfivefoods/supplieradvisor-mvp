'use client';

/**
 * End-to-end GymAdvisor® process design:
 * People → Plans → Classes → Calendar (rooms) → Floor → Messages → Marketplace · reports
 *
 * Expandable on the GymAdvisor command hub; downloadable A4 PDF
 * (landscape + portrait) — same pattern as NSNP / CropAdvisor.
 * Content kept in sync with lib/fitness/fitgraph-process-guide.ts
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
  FileText,
  Globe,
  MessageSquare,
  Package,
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
  /** When false, process copy is coach–member led (no front desk). Default true. */
  hasFrontDesk?: boolean;
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
    subtitle: 'Who trains · People dual-write · invite · family',
    steps: [
      {
        id: 'specialties',
        n: '1a',
        title: 'Specialty catalogue',
        who: 'Owner',
        desc: 'Create, rename, remove coach specialties gym-wide.',
        href: '/dashboard/fitgraph/coaches',
        icon: Sparkles,
      },
      {
        id: 'coaches',
        n: '1b',
        title: 'Coach register · People',
        who: 'Owner',
        desc: 'Bio, photo, portal link; permanent coaches dual-write to People (HR).',
        href: '/dashboard/fitgraph/coaches',
        icon: UserRound,
      },
      {
        id: 'tenure',
        n: '1c',
        title: 'Engagement · rates · contracts',
        who: 'Owner',
        desc: 'Start/end dates, ZAR rate, PDF contracts; history on rehire.',
        href: '/dashboard/fitgraph/coaches',
        icon: FileText,
      },
      {
        id: 'clients',
        n: '1d',
        title: 'Members · invite · family',
        who: 'Owner / desk',
        desc: 'Member book or bulk .xlsx; email invite & portal; family; POPIA-aware desk.',
        href: '/dashboard/fitgraph/clients',
        icon: Users,
      },
      {
        id: 'invite',
        n: '1e',
        title: 'Email invite & portal',
        who: 'Owner / desk',
        desc: 'Invite members; portal for open classes, waitlist, feedback, identity verify.',
        href: '/dashboard/fitgraph/clients',
        icon: Globe,
      },
    ],
  },
  {
    id: 'money',
    title: '2 · Memberships & subscriptions',
    subtitle: 'Plans · packs · freeze (fees outside SA)',
    steps: [
      {
        id: 'plans',
        n: '2a',
        title: 'Membership plans',
        who: 'Owner',
        desc: 'Unlimited, packs, drop-in; public pricing flag. Fees not charged via SA.',
        href: '/dashboard/fitgraph/memberships',
        icon: CreditCard,
      },
      {
        id: 'subs',
        n: '2b',
        title: 'Subscriptions · freeze',
        who: 'Owner',
        desc: 'Active / trial / paused; remaining credits; freeze periods.',
        href: '/dashboard/fitgraph/subscriptions',
        icon: Repeat,
      },
      {
        id: 'pt',
        n: '2c',
        title: 'PT & class packs',
        who: 'Owner',
        desc: 'Session packs / ledger; remaining sessions and expiry.',
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
    title: '4 · Calendar (rooms · plan · join)',
    subtitle: 'Owner grid + coach week + resources',
    steps: [
      {
        id: 'sched',
        n: '4a',
        title: 'Rooms & schedule',
        who: 'Owner',
        desc: 'Named studios under Website; schedule date, time, room, class; assign coach.',
        href: '/dashboard/fitgraph/calendar',
        icon: CalendarDays,
      },
      {
        id: 'coach-cal',
        n: '4b',
        title: 'Coach calendar · concurrent',
        who: 'Owner / coach',
        desc: 'Week plan, series, class plan text; optional concurrent coaches on large floors.',
        href: '/dashboard/fitgraph/coach-calendar',
        icon: CalendarDays,
      },
      {
        id: 'join',
        n: '4c',
        title: 'Publish & join links',
        who: 'Owner / coach',
        desc: 'Public session + B2C join URL for book & .ics calendar.',
        href: '/dashboard/fitgraph/calendar',
        icon: Globe,
      },
    ],
  },
  {
    id: 'floor',
    title: '5 · Floor (waitlist · actual · recall)',
    subtitle: 'Capacity, attendance, outcomes, feedback',
    steps: [
      {
        id: 'book',
        n: '5a',
        title: 'Book · waitlist · family',
        who: 'Desk / coach / web',
        desc: 'Book session; auto-waitlist when full; household attendees; plan book next.',
        href: '/dashboard/fitgraph/bookings',
        icon: ClipboardCheck,
      },
      {
        id: 'actual',
        n: '5b',
        title: 'Remind · plan vs actual',
        who: 'Coach / desk',
        desc: '24h reminders; mark attended / no-show; soft-block high no-show risk.',
        href: '/dashboard/fitgraph/coach-calendar',
        icon: ClipboardCheck,
      },
      {
        id: 'feedback',
        n: '5c',
        title: 'Feedback · outcomes · recalls',
        who: 'Member · coach · owner',
        desc: 'Class feedback; outcomes board; re-engage overdue members.',
        href: '/dashboard/fitgraph/feedback',
        icon: Sparkles,
      },
      {
        id: 'checkin',
        n: '5d',
        title: 'Check-ins · staff Today',
        who: 'Desk',
        desc: 'Front-desk log; mobile staff PWA for today’s board.',
        href: '/dashboard/fitgraph/checkins',
        icon: ClipboardCheck,
      },
    ],
  },
  {
    id: 'messages',
    title: '6 · Messages (system ID · care · trade)',
    subtitle: 'In-app first when member is on SupplierAdvisor',
    steps: [
      {
        id: 'desk-coach',
        n: '6a',
        title: 'Desk · coach threads',
        who: 'Desk / coach',
        desc: 'Internal colleague chat for schedule hand-offs and floor notes.',
        href: '/dashboard/fitgraph/messages',
        icon: MessageSquare,
      },
      {
        id: 'member-care',
        n: '6b',
        title: 'Member care & class groups',
        who: 'Desk / coach · members',
        desc: '1:1 care or whole class group; deliver by platform system user ID when linked.',
        href: '/dashboard/fitgraph/messages',
        icon: MessageSquare,
      },
      {
        id: 'company-inbox',
        n: '6c',
        title: 'Company inbox (trade)',
        who: 'Owner',
        desc: 'External partners on the platform company inbox.',
        href: '/dashboard/messages',
        icon: MessageSquare,
      },
    ],
  },
  {
    id: 'web',
    title: '7 · Website, marketplace & insights',
    subtitle: 'Embed · ops · public list · slice & dice',
    steps: [
      {
        id: 'profile',
        n: '7a',
        title: 'Gym profile · rooms · contracts',
        who: 'Owner',
        desc: 'Brand bio, public PDF contracts, room list, reschedule policy.',
        href: '/dashboard/fitgraph/website',
        icon: FileText,
      },
      {
        id: 'publish',
        n: '7b',
        title: 'Embed · marketplace',
        who: 'Owner',
        desc: 'Publish calendar/booking; list on /marketplace/advisors (city + blurb).',
        href: '/dashboard/fitgraph/website',
        icon: Globe,
      },
      {
        id: 'report',
        n: '7c',
        title: 'Reports (slice & dice)',
        who: 'Owner',
        desc: 'Coaches, classes, plan vs actual, feedback, utilisation CSV.',
        href: '/dashboard/fitgraph/report',
        icon: Package,
      },
    ],
  },
];

const ROLE_CARDS = [
  {
    tone: 'owner' as const,
    icon: UserRound,
    title: 'Gym owner / manager',
    subtitle: 'Brand · people · floor · marketplace',
    does: [
      'Register coaches; permanent staff dual-write to People',
      'Members with invites, family, freezes and packs',
      'Schedule with rooms; concurrent coaches when floor allows',
      'Waitlist, reminders, outcomes; staff Today PWA',
      'In-app messages by system user ID; delivery status',
      'Website embed, marketplace listing, reschedule ops',
    ],
    doesNot: [
      'Does not surcharge members — 1% admin comes from card / Apple Pay settlement',
      'Does not publish without website settings on',
    ],
    href: '/dashboard/fitgraph/calendar',
  },
  {
    tone: 'coach' as const,
    icon: Dumbbell,
    title: 'Coach',
    subtitle: 'Classes · plan · actual · care threads',
    does: [
      'Portal: own profile, bio, specialties',
      'Class plan, one-off or weekly series; rooms when set',
      'Share classes; book walk-ins and members',
      'Mark plan vs actual (attended / no-show)',
      'Message desk and members (in-app when on-system)',
      'Post-class coach feedback (feel · RPE)',
    ],
    doesNot: [
      'Does not manage other coaches’ sessions',
      'Does not change membership billing or rates',
    ],
    href: '/dashboard/fitgraph/coaches',
  },
  {
    tone: 'member' as const,
    icon: Users,
    title: 'Member / customer',
    subtitle: 'Portal · book · family · feedback',
    does: [
      'Accept email invite; portal book or waitlist',
      'Book household family members; identity verify when asked',
      'Public schedule on embed; add to phone calendar',
      'In-app messages once on SupplierAdvisor',
      'Post-class feel & intensity feedback',
    ],
    doesNot: [
      'Does not see private / unpublished sessions',
      'Does not pay gym fees through the SA platform',
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
    desc: 'Bookings auto-waitlist when full — desk, coach, portal or website.',
  },
  {
    title: 'Concurrent coaches optional',
    desc: 'Large floors may allow coaches at the same time; toggle under Website ops.',
  },
  {
    title: 'Plan then actual',
    desc: 'Roster plan then mark attended / no-show; soft-block chronic no-shows.',
  },
  {
    title: 'Messages: system ID first',
    desc: 'Once the member is on SupplierAdvisor, care threads deliver in-app by platform user ID.',
  },
  {
    title: 'SA does not bill members',
    desc: 'SupplierAdvisor only bills the company platform subscription; gym fees stay off-platform.',
  },
  {
    title: 'Permanent coaches → People',
    desc: 'Permanent coaches dual-write into People; casuals stay on the GymAdvisor book only.',
  },
  {
    title: 'Tokenised portals',
    desc: 'Website and coach portals use secret tokens — no private PII public.',
  },
  {
    title: 'One gym book',
    desc: 'Coaches, classes, bookings, messages, feedback and website share one store.',
  },
];

function adaptWho(who: string, hasFrontDesk: boolean): string {
  if (hasFrontDesk) return who;
  return who
    .replace(/Owner \/ desk/gi, 'Owner / coach')
    .replace(/Desk \/ coach \/ web/gi, 'Coach / web')
    .replace(/Desk \/ coach/gi, 'Coach')
    .replace(/Coach \/ desk/gi, 'Coach')
    .replace(/^Desk$/i, 'Coach');
}

function adaptDesc(desc: string, hasFrontDesk: boolean): string {
  if (hasFrontDesk) return desc;
  return desc
    .replace(/desk, portal or join link/gi, 'coach portal, member portal or join link')
    .replace(/Front-desk or class attendance log/gi, 'Coach or member portal check-in')
    .replace(/desk, coach or website/gi, 'coach, portal or website')
    .replace(
      /1:1 care threads, or coach → whole class\/session group \(everyone booked on the roster\)\./gi,
      'Coach ↔ member care threads and coach → whole class/session groups (everyone booked on the roster).'
    )
    .replace(
      /Internal colleague chat for schedule hand-offs and floor notes\./gi,
      'Coach-to-coach threads for schedule hand-offs and floor notes (no front desk).'
    );
}

export default function FitgraphSystemFlow({
  compact,
  defaultCollapsed = false,
  hasFrontDesk = true,
}: Props) {
  const [open, setOpen] = useState(!defaultCollapsed);

  const phases = PHASES.map((ph) => ({
    ...ph,
    title:
      !hasFrontDesk && ph.id === 'messages'
        ? '6 · Messages (coach · members · classes)'
        : ph.title,
    subtitle:
      !hasFrontDesk && ph.id === 'messages'
        ? 'Coach ↔ member · class groups — in-app'
        : !hasFrontDesk && ph.id === 'floor'
          ? 'Coach-led capacity, attendance, post-class pulse'
          : ph.subtitle,
    steps: ph.steps.map((st) => ({
      ...st,
      who: adaptWho(st.who, hasFrontDesk),
      desc: adaptDesc(st.desc, hasFrontDesk),
      title:
        !hasFrontDesk && st.id === 'desk-coach'
          ? 'Coach · coach threads'
          : !hasFrontDesk && st.id === 'member-care'
            ? 'Coach ↔ member & class groups'
            : st.title,
    })),
  }));

  const roleCards = ROLE_CARDS.map((card) => {
    if (hasFrontDesk) return card;
    if (card.tone === 'owner') {
      return {
        ...card,
        subtitle: 'Brand · coaches · schedule · insight',
        does: [
          'Register & edit coaches; specialty catalogue',
          'Engagement dates, rates, PDF contracts; rehire history',
          'Member book, invites & portal; bulk .xlsx',
          'Schedule, coach calendar, B2C join links',
          'Coach-led messages: coach ↔ member · class groups',
          'Gym bio, public contracts, website embed',
          'Slice-and-dice reports (plan vs actual · feedback)',
        ],
      };
    }
    if (card.tone === 'coach') {
      return {
        ...card,
        subtitle: 'Classes · members · plan · actual · messages',
        does: [
          'Portal: own profile, bio, specialties',
          'Class plan, one-off or weekly series',
          'Share classes; book walk-ins and members',
          'Mark plan vs actual (attended / no-show)',
          'Message members 1:1 and whole class groups',
          'Post-class coach feedback (feel · RPE)',
          'See member feedback averages on sessions',
        ],
      };
    }
    return {
      ...card,
      does: [
        'Accept email invite to join as a member',
        'Member portal: open vacancies, book or waitlist, update profile',
        'Public schedule, gym bio & contracts on embed',
        'Book online or class join link; add to phone calendar',
        'Subscription or pack; coach or portal check-in',
        'Message your coach; post-class feel & intensity feedback',
      ],
    };
  });

  return (
    <section
      className={`rounded-3xl border border-slate-200 bg-white overflow-hidden ${
        compact ? 'mb-4' : 'mb-6'
      }`}
      aria-label="GymAdvisor full process design"
      id="fitgraph-system-flow"
    >
      <div className="bg-gradient-to-r from-neutral-950 via-neutral-900 to-[#E8E830] px-5 py-4 text-white">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-left min-w-0 flex-1"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              Full gym OS — process design
              {!hasFrontDesk ? ' · coach-led (no front desk)' : ''}
            </p>
            <h2 className="text-lg sm:text-xl font-black mt-0.5 leading-tight">
              People → Plans → Classes → Calendar (rooms) → Floor → Messages → Marketplace ·
              reports
            </h2>
            <p className="text-sm text-white/90 mt-1.5 max-w-3xl leading-snug">
              {hasFrontDesk
                ? 'Permanent coaches dual-write to People; rooms on the calendar; waitlist, reminders and recalls; in-app care by system user ID; marketplace listing — SA bills company SaaS plus 1% on card / Apple Pay collections.'
                : 'Coach-led gym: owner sets brand and coaches; coaches own the floor with rooms, waitlist and care threads (system user ID when on-platform); members book via portal. No front-desk persona. SA does not bill member fees.'}
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
              {
                label: 'People',
                sub: 'Coaches · POPIA · People',
                tone: 'yellow',
              },
              { label: 'Plans · subs', sub: 'Packs · freeze', tone: 'emerald' },
              { label: 'Class types', sub: 'Capacity', tone: 'amber' },
              {
                label: 'Calendar',
                sub: 'Rooms · series · join',
                tone: 'sky',
              },
              {
                label: 'Floor',
                sub: 'Waitlist · actual · recall',
                tone: 'rose',
              },
              {
                label: 'Messages',
                sub: 'System ID · in-app',
                tone: 'fuchsia',
              },
              {
                label: 'Website · reports',
                sub: 'Marketplace · embed · ops',
                tone: 'sky',
              },
            ].map((node, i, arr) => (
              <div key={node.label} className="contents">
                <div
                  className={`rounded-2xl border px-3 py-2 min-w-[6rem] ${
                    node.tone === 'yellow'
                      ? 'border-yellow-200 bg-yellow-50'
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                Who does what
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ['owner', 'Owner'],
                    ['coach', 'Coach'],
                    ['member', 'Member'],
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
              {roleCards.map((card) => (
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
            {phases.map((phase) => (
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

          <div className="rounded-2xl border border-yellow-100 bg-yellow-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-yellow-700" />
              <h3 className="text-sm font-black text-yellow-950">
                Guardrails — one gym book of truth
              </h3>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {GUARDRAILS.map((g) => (
                <div
                  key={g.title}
                  className="rounded-xl bg-white border border-yellow-100 px-3 py-2.5"
                >
                  <p className="text-xs font-bold text-slate-900">{g.title}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    {g.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-yellow-100 bg-yellow-50/60 px-4 py-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex items-start gap-2 text-yellow-950 min-w-0 flex-1">
                <Sparkles className="w-5 h-5 shrink-0 text-yellow-700 mt-0.5" />
                <p className="text-sm leading-snug">
                  <strong className="font-black">One sentence:</strong> Register
                  coaches and members → sell plans and track subscriptions →
                  define class types → schedule coaches onto sessions and
                  publish → book and check in on the floor → message desk,
                  coaches and members in-app → embed the public calendar on the
                  gym website.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link
                  href="/dashboard/fitgraph/calendar"
                  className="text-[11px] font-bold rounded-full bg-yellow-800 text-white px-3 py-1.5"
                >
                  Calendar
                </Link>
                <Link
                  href="/dashboard/fitgraph/messages"
                  className="text-[11px] font-bold rounded-full bg-white border border-yellow-200 px-3 py-1.5 text-yellow-800"
                >
                  Messages
                </Link>
                <Link
                  href="/dashboard/fitgraph/website"
                  className="text-[11px] font-bold rounded-full bg-white border border-yellow-200 px-3 py-1.5 text-yellow-800"
                >
                  Website
                </Link>
                <Link
                  href="/dashboard/fitgraph/report"
                  className="text-[11px] font-bold rounded-full bg-white border border-yellow-200 px-3 py-1.5 text-yellow-800"
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

/** Role colour codes — distinct in light and dark for “Who does what”. */
const ROLE_STYLES = {
  owner: {
    // Violet — gym owner / manager
    card:
      'border-yellow-300 bg-yellow-50/50 dark:border-yellow-400 dark:bg-yellow-950 dark:ring-1 dark:ring-yellow-500/40',
    badge: 'bg-yellow-700 dark:bg-yellow-500',
    chip:
      'bg-[#E8E830] text-slate-900 dark:bg-yellow-500 dark:text-white',
    title: 'text-slate-900 dark:text-yellow-100',
    subtitle: 'text-slate-500 dark:text-yellow-300/80',
    doesLabel: 'text-yellow-700 dark:text-yellow-300',
    doesText: 'text-slate-700 dark:text-yellow-50/90',
    link: 'text-yellow-800 dark:text-yellow-300',
    swatch: 'bg-yellow-600 dark:bg-yellow-500',
    label: 'Owner',
  },
  coach: {
    // Amber — coach
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
    label: 'Coach',
  },
  member: {
    // Cyan — members / customers
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
    label: 'Member',
  },
} as const;

function roleToneFromWho(who: string): keyof typeof ROLE_STYLES {
  const w = who.toLowerCase();
  // Coach first (e.g. "Desk / coach", "Coach")
  if (w.includes('coach')) return 'coach';
  // Floor desk / members / customers
  if (
    w.includes('member') ||
    w.includes('customer') ||
    w.includes('desk')
  ) {
    return 'member';
  }
  return 'owner';
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
      className="flex-1 min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-3 hover:border-yellow-300 hover:bg-yellow-50/30 transition-colors dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-yellow-500/40 dark:hover:bg-neutral-900"
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
