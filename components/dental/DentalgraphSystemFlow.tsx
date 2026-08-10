'use client';

/**
 * End-to-end DentalAdvisor® process design:
 * People → Services · care plans → Diary → Floor → Messages → Website · reports
 *
 * Expandable on the DentalAdvisor command hub; downloadable A4 PDF
 * (landscape + portrait) — same pattern as FitAdvisor / PhysioAdvisor.
 * Content kept in sync with lib/dental/dentalgraph-process-guide.ts
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
  FileText,
  Globe,
  MessageSquare,
  Package,
  ShieldCheck,
  Smile,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';
import DentalgraphProcessPdfButtons from '@/components/dental/DentalgraphProcessPdfButtons';

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
    title: '1 · People (staff & patients)',
    subtitle: 'Who treats · who is in care · assignment',
    steps: [
      {
        id: 'staff',
        n: '1a',
        title: 'Staff register',
        who: 'Owner',
        desc: 'Dentists, hygienists, assistants — roles, rates, bios.',
        href: '/dashboard/dentalgraph/staff',
        icon: UserRound,
      },
      {
        id: 'patients',
        n: '1b',
        title: 'Patients',
        who: 'Owner / reception',
        desc: 'Patient book; status; assign clinician and care plan.',
        href: '/dashboard/dentalgraph/patients',
        icon: Users,
      },
      {
        id: 'clinical',
        n: '1c',
        title: 'Clinical & medical chart',
        who: 'Clinician',
        desc: 'Tooth/site, goals, mods; medical aid, docs, claims.',
        href: '/dashboard/dentalgraph/patients',
        icon: FileText,
      },
    ],
  },
  {
    id: 'services',
    title: '2 · Services & care plans',
    subtitle: 'What you sell · multi-visit entitlement',
    steps: [
      {
        id: 'catalogue',
        n: '2a',
        title: 'Services',
        who: 'Owner',
        desc: 'Check-ups, hygiene, restorative — duration & price.',
        href: '/dashboard/dentalgraph/services',
        icon: Sparkles,
      },
      {
        id: 'packages',
        n: '2b',
        title: 'Care plans',
        who: 'Owner',
        desc: 'Multi-visit packages with sessions total and price.',
        href: '/dashboard/dentalgraph/packages',
        icon: CreditCard,
      },
      {
        id: 'assign',
        n: '2c',
        title: 'Assign plan',
        who: 'Owner / reception',
        desc: 'Link care plan on the patient so entitlement is clear.',
        href: '/dashboard/dentalgraph/patients',
        icon: Package,
      },
    ],
  },
  {
    id: 'diary',
    title: '3 · Diary (schedule · assign)',
    subtitle: 'Slots with clinician and service',
    steps: [
      {
        id: 'schedule',
        n: '3a',
        title: 'Schedule appointment',
        who: 'Owner / reception',
        desc: 'Date, time, service, chair; assign clinician.',
        href: '/dashboard/dentalgraph/calendar',
        icon: CalendarDays,
      },
      {
        id: 'public',
        n: '3b',
        title: 'Public flag',
        who: 'Owner',
        desc: 'Mark public so the slot can appear for online booking.',
        href: '/dashboard/dentalgraph/calendar',
        icon: Globe,
      },
      {
        id: 'reassign',
        n: '3c',
        title: 'Reassign',
        who: 'Owner / reception',
        desc: 'Change clinician anytime; diary is system of record.',
        href: '/dashboard/dentalgraph/calendar',
        icon: CalendarDays,
      },
    ],
  },
  {
    id: 'floor',
    title: '4 · Floor (book · attend · feedback)',
    subtitle: 'Capacity, attendance, post-visit pulse',
    steps: [
      {
        id: 'book',
        n: '4a',
        title: 'Book patient',
        who: 'Reception / website',
        desc: 'Book onto slot; waitlist when full; desk or public booking.',
        href: '/dashboard/dentalgraph/bookings',
        icon: ClipboardCheck,
      },
      {
        id: 'attend',
        n: '4b',
        title: 'Mark attended',
        who: 'Clinician / reception',
        desc: 'Attended or no-show; triggers feedback when attended.',
        href: '/dashboard/dentalgraph/bookings',
        icon: ClipboardCheck,
      },
      {
        id: 'feedback',
        n: '4c',
        title: 'Visit feedback',
        who: 'Patient',
        desc: 'Patient rates the visit via token link after attendance.',
        href: '/dashboard/dentalgraph/bookings',
        icon: Sparkles,
      },
    ],
  },
  {
    id: 'messages',
    title: '5 · Messages (internal · care · trade)',
    subtitle: 'Desk · clinicians · patients · company inbox',
    steps: [
      {
        id: 'internal',
        n: '5a',
        title: 'Internal team threads',
        who: 'Desk / team',
        desc: 'Colleague chat for hand-offs, schedule notes and practice ops.',
        href: '/dashboard/dentalgraph/messages',
        icon: MessageSquare,
      },
      {
        id: 'care',
        n: '5b',
        title: 'Care · patient threads',
        who: 'Desk / clinician',
        desc: 'Patient care messages so the whole team stays aligned.',
        href: '/dashboard/dentalgraph/messages',
        icon: MessageSquare,
      },
      {
        id: 'company-inbox',
        n: '5c',
        title: 'Company inbox (external)',
        who: 'Owner',
        desc: 'Trade partners on the platform company inbox.',
        href: '/dashboard/messages',
        icon: MessageSquare,
      },
    ],
  },
  {
    id: 'web',
    title: '6 · Website & insights',
    subtitle: 'Public profile · publish · utilisation',
    steps: [
      {
        id: 'profile',
        n: '6a',
        title: 'Practice profile',
        who: 'Owner',
        desc: 'Brand name, bio, contact; show staff / pricing.',
        href: '/dashboard/dentalgraph/website',
        icon: FileText,
      },
      {
        id: 'publish',
        n: '6b',
        title: 'Publish & booking',
        who: 'Owner',
        desc: 'Enable website and public booking; copy public token.',
        href: '/dashboard/dentalgraph/website',
        icon: Globe,
      },
      {
        id: 'report',
        n: '6c',
        title: 'Reports',
        who: 'Owner',
        desc: 'Utilisation by clinician, service, appointments.',
        href: '/dashboard/dentalgraph/report',
        icon: Package,
      },
    ],
  },
];

const ROLE_CARDS = [
  {
    tone: 'owner' as const,
    icon: UserRound,
    title: 'Practice owner / manager',
    subtitle: 'Team · catalogue · diary · insight',
    does: [
      'Register dentists, hygienists, assistants; roles & rates',
      'Patient register; assign clinician + care plan',
      'Define services and multi-visit care plans',
      'Schedule diary; assign clinicians; public slots',
      'Practice bio, website publish and booking flags',
      'Messages with desk/staff; utilisation reports',
    ],
    doesNot: [
      'Does not leave public slots without a clinician',
      'Does not publish without website settings enabled',
    ],
    href: '/dashboard/dentalgraph/calendar',
  },
  {
    tone: 'clinician' as const,
    icon: Smile,
    title: 'Dentist / hygienist',
    subtitle: 'Diary · clinical · attend · feedback',
    does: [
      'Keep own bio / roles current for website',
      'Update oral-health clinical notes (site, goals, mods)',
      'Medical chart: medical aid, documents, claims',
      'Run appointments; mark attended / no-show',
      'Reply on care threads with desk and patients',
      'Request post-visit feedback after attendance',
    ],
    doesNot: [
      'Does not change other clinicians’ rates',
      'Does not publish the whole practice website alone',
    ],
    href: '/dashboard/dentalgraph/staff',
  },
  {
    tone: 'patient' as const,
    icon: Users,
    title: 'Patient / public',
    subtitle: 'Book · attend · feedback',
    does: [
      'See published practice profile and public diary',
      'Book via desk or website when enabled',
      'Hold care plan entitlement across visits',
      'Receive care messages from the practice',
      'After visit: give feedback when prompted',
    ],
    doesNot: [
      'Does not see private / unpublished slots',
      'Does not access clinician rates or other patients’ charts',
    ],
    href: '/dashboard/dentalgraph/website',
  },
];

const GUARDRAILS = [
  {
    title: 'Clinician on every public slot',
    desc: 'Diary assigns a dentist or hygienist; public slots without one are incomplete.',
  },
  {
    title: 'Public = published',
    desc: 'Only public slots and an enabled website profile are ready for online booking.',
  },
  {
    title: 'Care plans track entitlement',
    desc: 'Multi-visit plans live on the patient — not a side spreadsheet.',
  },
  {
    title: 'Clinical notes travel with the patient',
    desc: 'Site, status, mods and goals keep every visit safe and progressive.',
  },
  {
    title: 'Medical chart is first-class',
    desc: 'Medical aid, documents and claims sit on the patient record.',
  },
  {
    title: 'Attend then feedback',
    desc: 'Mark attended before the post-visit feedback token is issued.',
  },
  {
    title: 'Tokenised public surfaces',
    desc: 'Website uses a secret public token — no private PII on open calendars.',
  },
  {
    title: 'One practice book',
    desc: 'People, diary, bookings, messages and website share one DentalAdvisor store.',
  },
];

export default function DentalgraphSystemFlow({
  compact,
  defaultCollapsed = false,
}: Props) {
  const [open, setOpen] = useState(!defaultCollapsed);

  return (
    <section
      className={`rounded-3xl border border-slate-200 bg-white overflow-hidden ${
        compact ? 'mb-4' : 'mb-6'
      }`}
      aria-label="DentalAdvisor full process design"
      id="dentalgraph-system-flow"
    >
      <div className="bg-gradient-to-r from-sky-950 via-sky-800 to-cyan-700 px-5 py-4 text-white">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-left min-w-0 flex-1"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              Full dental practice OS — process design
            </p>
            <h2 className="text-lg sm:text-xl font-black mt-0.5 leading-tight">
              People → Services · care plans → Diary → Floor → Messages →
              Website · reports
            </h2>
            <p className="text-sm text-white/90 mt-1.5 max-w-3xl leading-snug">
              Owner manages staff, patients, services and care plans; clinicians
              run oral-health notes, attendance and care threads; patients book
              and give post-visit feedback; reports show utilisation end to end.
            </p>
          </button>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <DentalgraphProcessPdfButtons variant="map" />
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
              { label: 'People', sub: 'Staff · patients', tone: 'sky' },
              {
                label: 'Services · plans',
                sub: 'Catalogue · care plans',
                tone: 'emerald',
              },
              { label: 'Diary', sub: 'Schedule · assign', tone: 'violet' },
              {
                label: 'Floor',
                sub: 'Book · attend · feedback',
                tone: 'amber',
              },
              { label: 'Messages', sub: 'Internal · care · trade', tone: 'fuchsia' },
              {
                label: 'Website · reports',
                sub: 'Publish · utilisation',
                tone: 'cyan',
              },
            ].map((node, i, arr) => (
              <div key={node.label} className="contents">
                <div
                  className={`rounded-2xl border px-3 py-2 min-w-[6rem] ${
                    node.tone === 'sky'
                      ? 'border-sky-200 bg-sky-50'
                      : node.tone === 'emerald'
                        ? 'border-emerald-200 bg-emerald-50'
                        : node.tone === 'violet'
                          ? 'border-violet-200 bg-violet-50'
                          : node.tone === 'amber'
                            ? 'border-amber-200 bg-amber-50'
                            : node.tone === 'fuchsia'
                              ? 'border-fuchsia-200 bg-fuchsia-50'
                              : 'border-cyan-200 bg-cyan-50'
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
                    ['clinician', 'Clinician'],
                    ['patient', 'Patient'],
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

          <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-sky-700" />
              <h3 className="text-sm font-black text-sky-950">
                Guardrails — one practice book of truth
              </h3>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {GUARDRAILS.map((g) => (
                <div
                  key={g.title}
                  className="rounded-xl bg-white border border-sky-100 px-3 py-2.5"
                >
                  <p className="text-xs font-bold text-slate-900">{g.title}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    {g.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex items-start gap-2 text-sky-950 min-w-0 flex-1">
                <Sparkles className="w-5 h-5 shrink-0 text-sky-700 mt-0.5" />
                <p className="text-sm leading-snug">
                  <strong className="font-black">One sentence:</strong> Register
                  staff and patients → define services and care plans → schedule
                  diary with clinicians → book and mark attended → message the
                  care team → publish the practice website and review
                  utilisation.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link
                  href="/dashboard/dentalgraph/calendar"
                  className="text-[11px] font-bold rounded-full bg-sky-800 text-white px-3 py-1.5"
                >
                  Diary
                </Link>
                <Link
                  href="/dashboard/dentalgraph/website"
                  className="text-[11px] font-bold rounded-full bg-white border border-sky-200 px-3 py-1.5 text-sky-800"
                >
                  Website
                </Link>
                <Link
                  href="/dashboard/dentalgraph/report"
                  className="text-[11px] font-bold rounded-full bg-white border border-sky-200 px-3 py-1.5 text-sky-800"
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
            <DentalgraphProcessPdfButtons variant="inline" />
          </div>
        </div>
      ) : null}
    </section>
  );
}

const ROLE_STYLES = {
  owner: {
    card:
      'border-sky-300 bg-sky-50/50 dark:border-sky-400 dark:bg-sky-950 dark:ring-1 dark:ring-sky-500/40',
    badge: 'bg-sky-700 dark:bg-sky-500',
    chip: 'bg-sky-700 text-white dark:bg-sky-500 dark:text-white',
    title: 'text-slate-900 dark:text-sky-100',
    subtitle: 'text-slate-500 dark:text-sky-300/80',
    doesLabel: 'text-sky-700 dark:text-sky-300',
    doesText: 'text-slate-700 dark:text-sky-50/90',
    link: 'text-sky-800 dark:text-sky-300',
    swatch: 'bg-sky-600 dark:bg-sky-500',
    label: 'Owner',
  },
  clinician: {
    card:
      'border-amber-300 bg-amber-50/50 dark:border-amber-400 dark:bg-amber-950 dark:ring-1 dark:ring-amber-500/40',
    badge: 'bg-amber-600 dark:bg-amber-500',
    chip: 'bg-amber-600 text-white dark:bg-amber-500 dark:text-amber-950',
    title: 'text-slate-900 dark:text-amber-50',
    subtitle: 'text-slate-500 dark:text-amber-200/80',
    doesLabel: 'text-amber-800 dark:text-amber-300',
    doesText: 'text-slate-700 dark:text-amber-50/90',
    link: 'text-amber-800 dark:text-amber-300',
    swatch: 'bg-amber-500 dark:bg-amber-400',
    label: 'Clinician',
  },
  patient: {
    card:
      'border-cyan-300 bg-cyan-50/50 dark:border-cyan-400 dark:bg-cyan-950 dark:ring-1 dark:ring-cyan-500/40',
    badge: 'bg-cyan-600 dark:bg-cyan-500',
    chip: 'bg-cyan-600 text-white dark:bg-cyan-500 dark:text-cyan-950',
    title: 'text-slate-900 dark:text-cyan-50',
    subtitle: 'text-slate-500 dark:text-cyan-200/80',
    doesLabel: 'text-cyan-700 dark:text-cyan-300',
    doesText: 'text-slate-700 dark:text-cyan-50/90',
    link: 'text-cyan-800 dark:text-cyan-300',
    swatch: 'bg-cyan-500 dark:bg-cyan-400',
    label: 'Patient',
  },
} as const;

function roleToneFromWho(who: string): keyof typeof ROLE_STYLES {
  const w = who.toLowerCase();
  if (
    w.includes('clinician') ||
    w.includes('dentist') ||
    w.includes('hygienist') ||
    w.includes('team')
  ) {
    return 'clinician';
  }
  if (
    w.includes('patient') ||
    w.includes('reception') ||
    w.includes('website')
  ) {
    return 'patient';
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
  tone: 'owner' | 'clinician' | 'patient';
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
      className="flex-1 min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-3 hover:border-sky-300 hover:bg-sky-50/30 transition-colors dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-sky-500/40 dark:hover:bg-neutral-900"
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
