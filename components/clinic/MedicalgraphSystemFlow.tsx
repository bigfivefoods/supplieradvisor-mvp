'use client';

/**
 * End-to-end MedicalAdvisor® process design:
 * People → Packs · plans → Diary (rooms) → Waitlist · floor → Messages → Marketplace · reports
 *
 * Expandable on the MedicalAdvisor command hub; downloadable A4 PDF
 * (landscape + portrait) — same pattern as FitAdvisor / CropAdvisor.
 * Content kept in sync with lib/clinic/medicalgraph-process-guide.ts
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
import MedicalgraphProcessPdfButtons from '@/components/clinic/MedicalgraphProcessPdfButtons';

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
    title: '1 · People (clinicians & patients)',
    subtitle: 'Who treats · POPIA · People dual-write · invite',
    steps: [
      {
        id: 'staff',
        n: '1a',
        title: 'Practitioners',
        who: 'Owner',
        desc: 'GPs, specialists, nursing — disciplines, rates. Permanent staff → People (HR).',
        href: '/dashboard/medicalgraph/practitioners',
        icon: UserRound,
      },
      {
        id: 'patients',
        n: '1b',
        title: 'Patients · POPIA',
        who: 'Owner / desk',
        desc: 'Patient book with POPIA consent; assign clinician/pack; family dependents.',
        href: '/dashboard/medicalgraph/patients',
        icon: Users,
      },
      {
        id: 'clinical',
        n: '1c',
        title: 'Clinical, chart & identity',
        who: 'Practitioner',
        desc: 'Clinical profile; medical aid, docs, claims, scripts; visit notes. Optional identity verify on portal.',
        href: '/dashboard/medicalgraph/patients',
        icon: FileText,
      },
      {
        id: 'invite',
        n: '1d',
        title: 'Patient invite & portal',
        who: 'Owner / desk',
        desc: 'Email invite; portal for open slots, waitlist, family booking, shared care.',
        href: '/dashboard/medicalgraph/patients',
        icon: Globe,
      },
    ],
  },
  {
    id: 'services',
    title: '2 · Services, packs & treatment plans',
    subtitle: 'What you sell · entitlement · one-click book next',
    steps: [
      {
        id: 'catalogue',
        n: '2a',
        title: 'Services',
        who: 'Owner',
        desc: 'Consults and procedures — duration & price.',
        href: '/dashboard/medicalgraph/services',
        icon: Sparkles,
      },
      {
        id: 'packages',
        n: '2b',
        title: 'Care packages',
        who: 'Owner',
        desc: 'Multi-visit packs with session ledger (fees outside SA).',
        href: '/dashboard/medicalgraph/packages',
        icon: CreditCard,
      },
      {
        id: 'plans',
        n: '2c',
        title: 'Treatment plans',
        who: 'Owner / desk / clinician',
        desc: 'Step plans on the patient record; Book next books the next open diary slot.',
        href: '/dashboard/medicalgraph/patients',
        icon: Package,
      },
    ],
  },
  {
    id: 'diary',
    title: '3 · Diary (rooms · practice · clinician)',
    subtitle: 'Parallel practice floor · exclusive clinician books',
    steps: [
      {
        id: 'schedule',
        n: '3a',
        title: 'Rooms & schedule',
        who: 'Owner / desk',
        desc: 'Define rooms on Website; schedule date, time, service, room; assign clinician.',
        href: '/dashboard/medicalgraph/calendar',
        icon: CalendarDays,
      },
      {
        id: 'views',
        n: '3b',
        title: 'Practice vs clinician diary',
        who: 'Owner / desk',
        desc: 'Practice view runs all clinicians in parallel; each clinician cannot be double-booked.',
        href: '/dashboard/medicalgraph/calendar',
        icon: CalendarDays,
      },
      {
        id: 'public',
        n: '3c',
        title: 'Public flag',
        who: 'Owner',
        desc: 'Mark public so the slot can appear for portal / online booking.',
        href: '/dashboard/medicalgraph/calendar',
        icon: Globe,
      },
    ],
  },
  {
    id: 'floor',
    title: '4 · Floor (waitlist · attend · recall)',
    subtitle: 'Book · queue · reminders · outcomes · feedback',
    steps: [
      {
        id: 'book',
        n: '4a',
        title: 'Book · family · other clinician',
        who: 'Desk / portal',
        desc: 'Book patient or family; if preferred clinician full, book another or join waitlist.',
        href: '/dashboard/medicalgraph/bookings',
        icon: ClipboardCheck,
      },
      {
        id: 'waitlist',
        n: '4b',
        title: 'Waitlist desk',
        who: 'Desk',
        desc: 'Slot waitlists + next-available practice queue; contact, promote, book when free.',
        href: '/dashboard/medicalgraph/bookings',
        icon: ClipboardCheck,
      },
      {
        id: 'attend',
        n: '4c',
        title: 'Remind · attend · plan · feedback',
        who: 'Clinician / desk',
        desc: '24h reminders; attended / no-show; care plan progresses; feedback token; recalls board.',
        href: '/dashboard/medicalgraph/bookings',
        icon: Sparkles,
      },
    ],
  },
  {
    id: 'messages',
    title: '5 · Messages (system ID · care · trade)',
    subtitle: 'In-app first when patient is on SupplierAdvisor',
    steps: [
      {
        id: 'internal',
        n: '5a',
        title: 'Internal team threads',
        who: 'Desk / team',
        desc: 'Colleague chat for hand-offs, schedule notes and practice ops.',
        href: '/dashboard/medicalgraph/messages',
        icon: MessageSquare,
      },
      {
        id: 'care',
        n: '5b',
        title: 'Care · patient threads',
        who: 'Desk / clinician',
        desc: 'Deliver to company inbox by platform system user ID when linked; email optional.',
        href: '/dashboard/medicalgraph/messages',
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
    title: '6 · Website, marketplace & insights',
    subtitle: 'Rooms · ops · public list · utilisation',
    steps: [
      {
        id: 'profile',
        n: '6a',
        title: 'Profile · rooms · ops',
        who: 'Owner',
        desc: 'Brand bio, room list, reschedule policy. SA only bills platform subscription.',
        href: '/dashboard/medicalgraph/website',
        icon: FileText,
      },
      {
        id: 'publish',
        n: '6b',
        title: 'Publish & marketplace',
        who: 'Owner',
        desc: 'Enable website/booking; list on /marketplace/advisors (city + blurb).',
        href: '/dashboard/medicalgraph/website',
        icon: Globe,
      },
      {
        id: 'report',
        n: '6c',
        title: 'Reports · staff Today',
        who: 'Owner / desk',
        desc: 'Utilisation and outcomes; mobile staff PWA for today’s board.',
        href: '/dashboard/medicalgraph/report',
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
    subtitle: 'Team · diary · waitlist · marketplace',
    does: [
      'Register clinicians; permanent staff dual-write to People',
      'Patients with POPIA consent; invites, portals, family',
      'Services, care packs, treatment plans; one-click book next',
      'Practice + exclusive clinician diaries; rooms as resources',
      'Waitlist desk, reminders, outcomes, recalls, staff Today PWA',
      'In-app messages (system user ID); marketplace listing',
    ],
    doesNot: [
      'Does not double-book the same clinician diary',
      'Does not take patient fees through SupplierAdvisor',
    ],
    href: '/dashboard/medicalgraph/calendar',
  },
  {
    tone: 'clinician' as const,
    icon: Stethoscope,
    title: 'Practitioner',
    subtitle: 'Diary · clinical · attend · care plans',
    does: [
      'Keep bio current; clinical notes and medical chart',
      'Treatment plan steps; visit notes and outcome scores',
      'Mark attended / no-show (progresses care plans)',
      'Care threads; patients get in-app when on-system',
      'Request post-visit feedback after attendance',
    ],
    doesNot: [
      'Does not change other clinicians’ rates or double-book own diary',
      'Does not publish the whole practice website alone',
    ],
    href: '/dashboard/medicalgraph/practitioners',
  },
  {
    tone: 'patient' as const,
    icon: Users,
    title: 'Patient / public',
    subtitle: 'Portal · book · family · feedback',
    does: [
      'Book open slots (preferred or other clinician when allowed)',
      'Join slot waitlist or next-available practice queue',
      'Book household members; identity verify when asked',
      'In-app messages once on SupplierAdvisor',
      'After visit: feedback; shared care when enabled',
    ],
    doesNot: [
      'Does not see private slots or other patients’ charts',
      'Does not pay practice fees through the SA platform',
    ],
    href: '/dashboard/medicalgraph/website',
  },
];

const GUARDRAILS = [
  {
    title: 'No double-book per clinician',
    desc: 'Each clinician diary is exclusive; the practice can still run many clinicians in parallel.',
  },
  {
    title: 'Public = published',
    desc: 'Only public slots and an enabled website profile are ready for online booking.',
  },
  {
    title: 'POPIA on create',
    desc: 'Desk confirms lawful processing when creating a patient; portals show a privacy notice.',
  },
  {
    title: 'Care packs & treatment plans',
    desc: 'Session packs and step plans live on the patient — Book next from the plan.',
  },
  {
    title: 'Waitlist is a desk queue',
    desc: 'Slot waitlist plus next-available practice queue with notify when a place opens.',
  },
  {
    title: 'Messages: system ID first',
    desc: 'Once the patient is on SupplierAdvisor, care threads deliver in-app by platform user ID.',
  },
  {
    title: 'SA does not bill patients',
    desc: 'SupplierAdvisor only bills the company platform subscription; clinic fees stay off-platform.',
  },
  {
    title: 'Permanent staff → People',
    desc: 'Permanent clinicians dual-write into People; casuals stay on the Advisor book only.',
  },
  {
    title: 'Tokenised public surfaces',
    desc: 'Website and portals use secret tokens — no private charts on open calendars.',
  },
];

export default function MedicalgraphSystemFlow({
  compact,
  defaultCollapsed = false,
}: Props) {
  const [open, setOpen] = useState(!defaultCollapsed);

  return (
    <section
      className={`rounded-3xl border border-slate-200 bg-white overflow-hidden ${
        compact ? 'mb-4' : 'mb-6'
      }`}
      aria-label="MedicalAdvisor full process design"
      id="medicalgraph-system-flow"
    >
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-800 to-cyan-700 px-5 py-4 text-white">
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
              People → Packs · plans → Diary (rooms) → Waitlist · floor → Messages →
              Marketplace · reports
            </h2>
            <p className="text-sm text-white/90 mt-1.5 max-w-3xl leading-snug">
              POPIA-aware patient book; exclusive clinician diaries with rooms; waitlist
              desk and treatment-plan book next; in-app care by system user ID;
              marketplace listing — SA bills platform subscription only.
            </p>
          </button>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <MedicalgraphProcessPdfButtons variant="map" />
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
                sub: 'Practitioners · POPIA · People',
                tone: 'teal',
              },
              {
                label: 'Services · packs',
                sub: 'Packs · treatment plans',
                tone: 'emerald',
              },
              { label: 'Diary', sub: 'Rooms · practice · clinician', tone: 'violet' },
              {
                label: 'Floor',
                sub: 'Waitlist · attend · recall',
                tone: 'amber',
              },
              { label: 'Messages', sub: 'System ID · in-app', tone: 'fuchsia' },
              {
                label: 'Website · reports',
                sub: 'Marketplace · rooms · ops',
                tone: 'sky',
              },
            ].map((node, i, arr) => (
              <div key={node.label} className="contents">
                <div
                  className={`rounded-2xl border px-3 py-2 min-w-[6rem] ${
                    node.tone === 'teal'
                      ? 'border-emerald-200 bg-emerald-50'
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

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              <h3 className="text-sm font-black text-emerald-950">
                Guardrails — one clinic book of truth
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

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex items-start gap-2 text-emerald-950 min-w-0 flex-1">
                <Sparkles className="w-5 h-5 shrink-0 text-emerald-700 mt-0.5" />
                <p className="text-sm leading-snug">
                  <strong className="font-black">One sentence:</strong> Register
                  practitioners and patients → define services and rehab packs →
                  schedule diary with practitioners → book and mark attended →
                  message team, patients and trade partners in-app → publish the clinic website and review
                  utilisation.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link
                  href="/dashboard/medicalgraph/calendar"
                  className="text-[11px] font-bold rounded-full bg-emerald-800 text-white px-3 py-1.5"
                >
                  Diary
                </Link>
                <Link
                  href="/dashboard/medicalgraph/website"
                  className="text-[11px] font-bold rounded-full bg-white border border-emerald-200 px-3 py-1.5 text-emerald-800"
                >
                  Website
                </Link>
                <Link
                  href="/dashboard/medicalgraph/report"
                  className="text-[11px] font-bold rounded-full bg-white border border-emerald-200 px-3 py-1.5 text-emerald-800"
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
            <MedicalgraphProcessPdfButtons variant="inline" />
          </div>
        </div>
      ) : null}
    </section>
  );
}

const ROLE_STYLES = {
  owner: {
    card:
      'border-emerald-300 bg-emerald-50/50 dark:border-emerald-400 dark:bg-emerald-950 dark:ring-1 dark:ring-emerald-500/40',
    badge: 'bg-emerald-700 dark:bg-emerald-500',
    chip: 'bg-emerald-700 text-white dark:bg-emerald-500 dark:text-white',
    title: 'text-slate-900 dark:text-emerald-100',
    subtitle: 'text-slate-500 dark:text-emerald-300/80',
    doesLabel: 'text-emerald-700 dark:text-emerald-300',
    doesText: 'text-slate-700 dark:text-emerald-50/90',
    link: 'text-emerald-800 dark:text-emerald-300',
    swatch: 'bg-emerald-600 dark:bg-emerald-500',
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
      className="flex-1 min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-3 hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-emerald-500/40 dark:hover:bg-neutral-900"
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
