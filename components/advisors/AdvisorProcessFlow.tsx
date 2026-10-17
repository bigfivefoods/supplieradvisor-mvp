'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  GitBranch,
  Globe,
  Hammer,
  HardHat,
  ListChecks,
  MapPin,
  MessageSquare,
  Package,
  Receipt,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { FLOW_BRAND } from '@/lib/advisors/process-flows/brand';
import { getAdvisorFlow, resolveAdvisorFlow } from '@/lib/advisors/process-flows';
import type {
  AdvisorFlowModuleId,
  AdvisorFlowView,
  FlowCaps,
  FlowChip,
  FlowIconName,
  FlowNodeView,
  FlowSecondaryView,
} from '@/lib/advisors/process-flows/types';

const ICONS: Record<FlowIconName, LucideIcon> = {
  users: Users,
  'clipboard-list': ClipboardList,
  'file-text': FileText,
  'calendar-days': CalendarDays,
  'calendar-range': CalendarRange,
  package: Package,
  'hard-hat': HardHat,
  receipt: Receipt,
  'shield-check': ShieldCheck,
  'bar-chart-3': BarChart3,
  'building-2': Building2,
  hammer: Hammer,
  'book-open': BookOpen,
  'git-branch': GitBranch,
  wallet: Wallet,
  'clipboard-check': ClipboardCheck,
  'map-pin': MapPin,
  'message-square': MessageSquare,
  'list-checks': ListChecks,
  globe: Globe,
  clock: Clock,
};

const CHIP_TONE: Record<FlowChip['tone'], string> = {
  slate: 'bg-slate-100 text-slate-700',
  emerald: 'bg-emerald-50 text-emerald-800',
  rose: 'bg-rose-50 text-rose-800',
  indigo: 'bg-indigo-50 text-indigo-800',
  violet: 'bg-violet-50 text-violet-800',
  cyan: 'bg-cyan-50 text-[#0f172a]',
  sky: 'bg-sky-50 text-sky-800',
};

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0077b6]';

type FlowProps = {
  role?: string;
  caps?: FlowCaps;
  hrefBase?: string;
  audience?: string;
  chips?: Readonly<Record<string, readonly FlowChip[]>>;
};

type Props = FlowProps & ({ module: AdvisorFlowModuleId; view?: undefined } | { view: AdvisorFlowView; module?: undefined });

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function ChipRow({ chips, mine }: { chips: FlowChip[]; mine: boolean }) {
  if (!chips.length && !mine) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {mine ? (
        <span className="inline-flex min-h-6 items-center rounded-full bg-cyan-50 px-2 text-[11px] font-black text-[#0f172a] ring-1 ring-[#00b4d8]/40">
          You
        </span>
      ) : null}
      {chips.map((chip) => {
        const Icon = chip.id === 'soon' ? Clock : null;
        const partial = chip.id === 'note';
        const className = partial
          ? 'bg-white text-slate-700 ring-1 ring-slate-200'
          : CHIP_TONE[chip.tone];
        return (
          <span key={chip.id} className={`inline-flex min-h-6 max-w-full items-center gap-1 rounded-full px-2 text-[11px] font-bold ${className}`}>
            {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
            <span className="break-words">{chip.label}</span>
          </span>
        );
      })}
    </div>
  );
}

function StepBody({ step }: { step: FlowNodeView }) {
  const Icon = ICONS[step.icon];
  return (
    <>
      <div className="flex items-start gap-2">
        <span
          data-flow-badge
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black"
          style={{ backgroundColor: FLOW_BRAND.accent, color: FLOW_BRAND.ink }}
        >
          {pad(step.n)}
        </span>
        <Icon className="mt-2 h-4 w-4 shrink-0 text-[#0f172a]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-black text-[#0f172a]">{step.title}</p>
          <p className="mt-1 inline-flex max-w-full break-words rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">
            {step.who}
          </p>
        </div>
      </div>
      <p className="mt-2 break-words text-sm text-slate-700">{step.desc}</p>
      <ChipRow chips={step.chips} mine={step.mine} />
    </>
  );
}

function StepCard({ step }: { step: FlowNodeView }) {
  const mine = step.mine ? 'bg-cyan-50 ring-1 ring-[#00b4d8]/40' : 'bg-[#f8fafc]';
  const shared = `block min-h-11 w-full min-w-0 rounded-2xl border border-[#e2e8f0] p-3 text-left ${mine} ${focusRing}`;
  if (step.linkHref) {
    return (
      <Link href={step.linkHref} className={`${shared} hover:border-[#00b4d8]`} prefetch={false}>
        <StepBody step={step} />
      </Link>
    );
  }
  return (
    <div aria-disabled="true" className={shared}>
      <StepBody step={step} />
    </div>
  );
}

function SecondaryLinks({ links }: { links: FlowSecondaryView[] }) {
  if (!links.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {links.map((link) =>
        link.href ? (
          <Link
            key={link.label}
            href={link.href}
            prefetch={false}
            className={`inline-flex min-h-11 items-center text-sm font-bold text-[#0077b6] underline-offset-2 hover:underline ${focusRing}`}
          >
            {link.label}
          </Link>
        ) : (
          <span key={link.label} className="inline-flex min-h-11 items-center text-sm font-bold text-slate-600">
            {link.label}
            {link.note ? <span className="ml-1 font-semibold text-slate-500">({link.note})</span> : null}
          </span>
        )
      )}
    </div>
  );
}

function PhaseSteps({ steps }: { steps: FlowNodeView[] }) {
  return (
    <ol className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap xl:flex-nowrap xl:items-stretch">
      {steps.map((step, index) => (
        <li key={step.id} className="flex w-full min-w-0 flex-col sm:w-[calc(50%-0.25rem)] xl:w-auto xl:min-w-0 xl:flex-1 xl:flex-row xl:items-stretch" data-flow-state={step.state}>
          <div className="min-w-0 flex-1">
            <StepCard step={step} />
            <SecondaryLinks links={step.secondary} />
          </div>
          {index < steps.length - 1 ? (
            <>
              <span aria-hidden className="flex justify-center py-1 text-[#0077b6] sm:hidden">
                <ArrowDown className="h-4 w-4" />
              </span>
              <span aria-hidden className="hidden shrink-0 items-center pl-2 text-[#0077b6] xl:flex">
                <ArrowRight className="h-4 w-4" />
              </span>
            </>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function modelFromProps(props: Props): AdvisorFlowView | null {
  if (props.view) return props.view;
  const def = getAdvisorFlow(props.module);
  if (!def) return null;
  return resolveAdvisorFlow(def, {
    role: props.role,
    caps: props.caps,
    hrefBase: props.hrefBase,
    audience: props.audience,
    chips: props.chips,
  });
}

export function AdvisorProcessFlow(props: Props) {
  const model = modelFromProps(props);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  if (!model) return null;
  const panelId = `${model.anchorId}-panel`;
  const titleId = `${model.anchorId}-title`;
  return (
    <section
      id={model.anchorId}
      aria-labelledby={titleId}
      data-testid={`advisor-flow-${model.module}`}
      data-flow-ready={hydrated ? '1' : '0'}
      className="max-w-full rounded-3xl border border-slate-200 bg-white"
    >
      <div
        data-flow-header
        className={`flex flex-col gap-4 p-4 sm:p-6 ${open ? 'rounded-t-3xl' : 'rounded-3xl'}`}
        style={{ backgroundColor: FLOW_BRAND.accent, color: FLOW_BRAND.ink }}
      >
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em]">{model.product}</p>
            <h2 id={titleId} className="mt-1 break-words text-2xl font-black tracking-tight sm:text-3xl">
              {model.title}
            </h2>
            <p className="mt-2 max-w-3xl break-words text-sm font-semibold">{model.lead}</p>
          </div>
          <button
            type="button"
            className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-white px-4 text-sm font-black text-[#0f172a] ${focusRing}`}
            aria-expanded={open}
            aria-controls={panelId}
            data-testid="advisor-flow-toggle"
            onClick={() => {
              setOpen((value) => !value);
            }}
          >
            {open ? 'Hide full process' : 'Show full process'}
            <ChevronDown className={`h-4 w-4 motion-safe:transition ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {model.roleLabel ? (
            <span className="inline-flex min-h-8 items-center rounded-full bg-[#0f172a]/10 px-3">{model.roleLabel}</span>
          ) : null}
          <span>{model.statusLine}</span>
        </div>
      </div>
      <div id={panelId} hidden={!open} className="min-w-0 p-4 sm:p-6">
        <p className="sr-only">{model.srSummary}</p>
        {model.phases.map((phase) => (
          <div key={phase.id} className="mt-6 first:mt-0">
            <h3 className="break-words text-lg font-black text-[#0f172a]">{phase.title}</h3>
            <p className="mt-1 break-words text-sm text-slate-600">{phase.subtitle}</p>
            <PhaseSteps steps={phase.steps} />
          </div>
        ))}
        {model.around ? (
          <div className="mt-6">
            <h3 className="text-lg font-black text-[#0f172a]">{model.around.title}</h3>
            <SecondaryLinks links={model.around.links} />
          </div>
        ) : null}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {model.guardrails.map((item) => (
            <article key={item.title} className="min-w-0 rounded-2xl border border-slate-200 bg-[#f8fafc] p-3">
              <p className="break-words text-sm font-black text-[#0f172a]">{item.title}</p>
              <p className="mt-1 break-words text-sm text-slate-700">{item.body}</p>
            </article>
          ))}
        </div>
        <p className="mt-6 break-words text-sm font-semibold text-[#0f172a]">{model.outcome}</p>
      </div>
    </section>
  );
}
