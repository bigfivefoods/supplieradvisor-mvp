'use client';

/**
 * End-to-end Physiograph® process design:
 * People → Services · packs → Diary → Floor → Messages → Website · reports
 *
 * Expandable on the Physiograph command hub; downloadable A4 PDF
 * (landscape + portrait) — same pattern as Fitgraph / Fieldgraph.
 * Content kept in sync with lib/clinic/physiograph-process-guide.ts
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
  HeartPulse,
  MessageSquare,
  Package,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  Users,
} from 'lucide-react';
import PhysiographProcessPdfButtons from '@/components/clinic/PhysiographProcessPdfButtons';

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
    title: '1 · People (practitioners & patients)',
    subtitle: 'Who treats · who is in care · assignment',
    steps: [
      {
        id: 'practitioners',
        n: '1a',
        title: 'Practitioners',
        who: 'Owner',
        desc: 'Physios, OT, biokinetics — disciplines, rates, bios.',
        href: '/dashboard/physiograph/practitioners',
        icon: Stethoscope,
      },
      {
        id: 'patients',
        n: '1b',
        title: 'Patients',
        who: 'Owner / desk',
        desc: 'Patient book; status; assign practitioner and package.',
        href: '/dashboard/physiograph/patients',
        icon: Users,
      },
      {
        id: 'clinical',
        n: '1c',
        title: 'Clinical & medical chart',
        who: 'Practitioner',
        desc: 'Region, goals, cautions; medical aid, docs, claims.',
        href: '/dashboard/physiograph/patients',
        icon: FileText,
      },
    ],
  },
  {
    id: 'services',
    title: '2 · Services & packages',
    subtitle: 'What you sell · rehab entitlement',
    steps: [
      {
        id: 'catalogue',
        n: '2a',
        title: 'Services',
        who: 'Owner',
        desc: 'Assessments, treatments, home visits — duration & price.',
        href: '/dashboard/physiograph/services',
        icon: HeartPulse,
      },
      {
        id: 'packages',
        n: '2b',
        title: 'Rehab packages',
        who: 'Owner',
        desc: 'Multi-session packs with sessions total and price.',
        href: '/dashboard/physiograph/packages',
        icon: CreditCard,
      },
      {
        id: 'assign',
        n: '2c',
        title: 'Assign pack',
        who: 'Owner / desk',
        desc: 'Link package on the patient so entitlement is clear.',
        href: '/dashboard/physiograph/patients',
        icon: Package,
      },
    ],
  },
  {
    id: 'diary',
    title: '3 · Diary (schedule · assign)',
    subtitle: 'Slots with practitioner and service',
    steps: [
      {
        id: 'schedule',
        n: '3a',
        title: 'Schedule appointment',
        who: 'Owner / desk',
        desc: 'Date, time, service, location; assign practitioner.',
        href: '/dashboard/physiograph/calendar',
        icon: CalendarDays,
      },
      {
        id: 'public',
        n: '3b',
        title: 'Public flag',
        who: 'Owner',
        desc: 'Mark public so the slot can appear for online booking.',
        href: '/dashboard/physiograph/calendar',
        icon: Globe,
      },
      {
        id: 'reassign',
        n: '3c',
        title: 'Reassign',
        who: 'Owner / desk',
        desc: 'Change practitioner anytime; diary is system of record.',
        href: '/dashboard/physiograph/calendar',
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
        who: 'Desk / website',
        desc: 'Book onto slot; waitlist when full; desk or public booking.',
        href: '/dashboard/physiograph/bookings',
        icon: ClipboardCheck,
      },
      {
        id: 'attend',
        n: '4b',
        title: 'Mark attended',
        who: 'Practitioner / desk',
        desc: 'Attended or no-show; triggers feedback when attended.',
        href: '/dashboard/physiograph/bookings',
        icon: ClipboardCheck,
      },
      {
        id: 'feedback',
        n: '4c',
        title: 'Visit feedback',
        who: 'Patient',
        desc: 'Patient rates the visit via token link after attendance.',
        href: '/dashboard/physiograph/bookings',
        icon: Sparkles,
      },
    ],
  },
  {
    id: 'messages',
    title: '5 · Messages',
    subtitle: 'Desk · practitioners · patients',
    steps: [
      {
        id: 'threads',
        n: '5a',
        title: 'Care threads',
        who: 'Desk / practitioner',
        desc: 'Colleague and patient care messages for hand-offs.',
        href: '/dashboard/physiograph/messages',
        icon: MessageSquare,
      },
      {
        id: 'close',
        n: '5b',
        title: 'Close the loop',
        who: 'Team',
        desc: 'Reply and archive when the episode of care is done.',
        href: '/dashboard/physiograph/messages',
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
        title: 'Clinic profile',
        who: 'Owner',
        desc: 'Brand name, bio, contact; show practitioners / pricing.',
        href: '/dashboard/physiograph/website',
        icon: FileText,
      },
      {
        id: 'publish',
        n: '6b',
        title: 'Publish & booking',
        who: 'Owner',
        desc: 'Enable website and public booking; copy public token.',
        href: '/dashboard/physiograph/website',
        icon: Globe,
      },
      {
        id: 'report',
        n: '6c',
        title: 'Reports',
        who: 'Owner',
        desc: 'Utilisation by practitioner, service, appointments.',
        href: '/dashboard/physiograph/report',
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
      'Register practitioners; disciplines, rates, bios',
      'Patient register; assign clinician + rehab pack',
      'Define services and multi-session packages',
      'Schedule diary; assign practitioners; public slots',
      'Clinic bio, website publish and booking flags',
      'Messages with desk/practitioners; utilisation reports',
    ],
    doesNot: [
      'Does not leave public slots without a practitioner',
      'Does not publish without website settings enabled',
    ],
    href: '/dashboard/physiograph/calendar',
  },
  {
    tone: 'clinician' as const,
    icon: Stethoscope,
    title: 'Practitioner',
    subtitle: 'Diary · clinical · attend · feedback',
    does: [
      'Keep own bio / disciplines current for website',
      'Update patient clinical notes (region, goals, cautions)',
      'Medical chart: medical aid, documents, claims',
      'Run sessions; mark attended / no-show',
      'Reply on care threads with desk and patients',
      'Request post-visit feedback after attendance',
    ],
    doesNot: [
      'Does not change other practitioners’ rates',
      'Does not publish the whole clinic website alone',
    ],
    href: '/dashboard/physiograph/practitioners',
  },
  {
    tone: 'patient' as const,
    icon: Users,
    title: 'Patient / public',
    subtitle: 'Book · attend · feedback',
    does: [
      'See published clinic profile and public diary',
      'Book via desk or website when enabled',
      'Hold rehab package entitlement across sessions',
      'Receive care messages from the clinic',
      'After visit: give feedback when prompted',
    ],
    doesNot: [
      'Does not see private / unpublished slots',
      'Does not access clinician rates or other patients’ charts',
    ],
    href: '/dashboard/physiograph/website',
  },
];

const GUARDRAILS = [
  {
    title: 'Practitioner on every public slot',
    desc: 'Diary assigns a clinician; public slots without one are incomplete.',
  },
  {
    title: 'Public = published',
    desc: 'Only public slots and an enabled website profile are ready for online booking.',
  },
  {
    title: 'Packages track entitlement',
    desc: 'Rehab packs live on the patient — not a side spreadsheet.',
  },
  {
    title: 'Clinical notes travel with the patient',
    desc: 'Region, goals and cautions keep every visit safe and progressive.',
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
    title: 'One clinic book',
    desc: 'People, diary, bookings, messages and website share one Physiograph store.',
  },
];

export default function PhysiographSystemFlow({
  compact,
  defaultCollapsed = false,
}: Props) {
  const [open, setOpen] = useState(!defaultCollapsed);

  return (
    <section
      className={`rounded-3xl border border-slate-200 bg-white overflow-hidden ${
        compact ? 'mb-4' : 'mb-6'
      }`}
      aria-label="Physiograph full process design"
      id="physiograph-system-flow"
    >
      <div className="bg-gradient-to-r from-teal-950 via-teal-800 to-cyan-700 px-5 py-4 text-white">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-left min-w-0 flex-1"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              Full clinic OS — process design
            </p>
            <h2 className="text-lg sm:text-xl font-black mt-0.5 leading-tight">
              People → Services · packs → Diary → Floor → Messages → Website ·
              reports
            </h2>
            <p className="text-sm text-white/90 mt-1.5 max-w-3xl leading-snug">
              Owner manages practitioners, patients, services and packages;
              practitioners run clinical notes, attendance and care threads;
              patients book and give post-visit feedback; reports show
              utilisation end to end.
            </p>
          </button>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <PhysiographProcessPdfButtons variant="map" />
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
                sub: 'Practitioners · patients',
                tone: 'teal',
              },
              {
                label: 'Services · packs',
                sub: 'Catalogue · rehab',
                tone: 'emerald',
              },
              { label: 'Diary', sub: 'Schedule · assign', tone: 'violet' },
              {
                label: 'Floor',
                sub: 'Book · attend · feedback',
                tone: 'amber',
              },
              { label: 'Messages', sub: 'Desk · care', tone: 'fuchsia' },
              {
                label: 'Website · reports',
                sub: 'Publish · utilisation',
                tone: 'sky',
              },
            ].map((node, i, arr) => (
              <div key={node.label} className="contents">
                <div
                  className={`rounded-2xl border px-3 py-2 min-w-[6rem] ${
                    node.tone === 'teal'
                      ? 'border-teal-200 bg-teal-50'
                      : node.tone === 'emerald'
                        ? 'border-emerald-200 bg-emerald-50'
                        : node.tone === 'violet'
                          ? 'border-violet-200 bg-violet-50'
                          : node.tone === 'amber'
                            ? 'border-amber-200 bg-amber-50'
                            : node.tone === 'fuchsia'
                              ? 'border-fuchsia-200 bg-fuchsia-50'
                              : 'border-sky-200 bg-sky-50'
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
                    ['clinician', 'Practitioner'],
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

          <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-teal-700" />
              <h3 className="text-sm font-black text-teal-950">
                Guardrails — one clinic book of truth
              </h3>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {GUARDRAILS.map((g) => (
                <div
                  key={g.title}
                  className="rounded-xl bg-white border border-teal-100 px-3 py-2.5"
                >
                  <p className="text-xs font-bold text-slate-900">{g.title}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    {g.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-teal-100 bg-teal-50/60 px-4 py-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex items-start gap-2 text-teal-950 min-w-0 flex-1">
                <Sparkles className="w-5 h-5 shrink-0 text-teal-700 mt-0.5" />
                <p className="text-sm leading-snug">
                  <strong className="font-black">One sentence:</strong> Register
                  practitioners and patients → define services and rehab packs →
                  schedule diary with practitioners → book and mark attended →
                  message the care team → publish the clinic website and review
                  utilisation.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link
                  href="/dashboard/physiograph/calendar"
                  className="text-[11px] font-bold rounded-full bg-teal-800 text-white px-3 py-1.5"
                >
                  Diary
                </Link>
                <Link
                  href="/dashboard/physiograph/website"
                  className="text-[11px] font-bold rounded-full bg-white border border-teal-200 px-3 py-1.5 text-teal-800"
                >
                  Website
                </Link>
                <Link
                  href="/dashboard/physiograph/report"
                  className="text-[11px] font-bold rounded-full bg-white border border-teal-200 px-3 py-1.5 text-teal-800"
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
            <PhysiographProcessPdfButtons variant="inline" />
          </div>
        </div>
      ) : null}
    </section>
  );
}

const ROLE_STYLES = {
  owner: {
    card:
      'border-teal-300 bg-teal-50/50 dark:border-teal-400 dark:bg-teal-950 dark:ring-1 dark:ring-teal-500/40',
    badge: 'bg-teal-700 dark:bg-teal-500',
    chip: 'bg-teal-700 text-white dark:bg-teal-500 dark:text-white',
    title: 'text-slate-900 dark:text-teal-100',
    subtitle: 'text-slate-500 dark:text-teal-300/80',
    doesLabel: 'text-teal-700 dark:text-teal-300',
    doesText: 'text-slate-700 dark:text-teal-50/90',
    link: 'text-teal-800 dark:text-teal-300',
    swatch: 'bg-teal-600 dark:bg-teal-500',
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
    label: 'Practitioner',
  },
  patient: {
    card:
      'border-cyan-300 bg-sky-50/50 dark:border-cyan-400 dark:bg-cyan-950 dark:ring-1 dark:ring-cyan-500/40',
    badge: 'bg-sky-600 dark:bg-cyan-500',
    chip: 'bg-sky-600 text-white dark:bg-cyan-500 dark:text-cyan-950',
    title: 'text-slate-900 dark:text-cyan-50',
    subtitle: 'text-slate-500 dark:text-cyan-200/80',
    doesLabel: 'text-sky-700 dark:text-cyan-300',
    doesText: 'text-slate-700 dark:text-cyan-50/90',
    link: 'text-sky-800 dark:text-cyan-300',
    swatch: 'bg-sky-500 dark:bg-cyan-400',
    label: 'Patient',
  },
} as const;

function roleToneFromWho(who: string): keyof typeof ROLE_STYLES {
  const w = who.toLowerCase();
  if (
    w.includes('practitioner') ||
    w.includes('clinician') ||
    w.includes('team')
  ) {
    return 'clinician';
  }
  if (
    w.includes('patient') ||
    w.includes('desk') ||
    w.includes('website') ||
    w.includes('reception')
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
      className="flex-1 min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-3 hover:border-teal-300 hover:bg-teal-50/30 transition-colors dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-teal-500/40 dark:hover:bg-neutral-900"
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
