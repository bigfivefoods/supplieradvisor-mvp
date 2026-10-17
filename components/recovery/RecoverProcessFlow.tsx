'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  ArrowDown,
  ArrowRight,
  Building2,
  ChevronDown,
  ClipboardList,
  Clock3,
  FileSpreadsheet,
  HandCoins,
  Landmark,
  Mail,
  Receipt,
  ShieldCheck,
  Smartphone,
  UserSearch,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { RECOVER_BRAND, RECOVER_PRODUCT_NAME } from '@/lib/recovery/brand';
import {
  resolveProcessFlow,
  type FlowChip,
  type FlowIcon,
  type FlowNodeView,
  type FlowPreviewKind,
} from '@/lib/recovery/process-flow';
import type { RecoverDeskPayload } from '@/lib/recovery/types';
import { useIsRecoverPreview, useRecoverHref, useRecoverHrefBase, useRecoverIllustration, useRecoverLinks } from './useRecoverDesk';

const ICONS: Record<FlowIcon, LucideIcon> = {
  Building2,
  ShieldCheck,
  FileSpreadsheet,
  UserSearch,
  Mail,
  HandCoins,
  Landmark,
  Archive,
  Receipt,
  ClipboardList,
  Users,
  Smartphone,
};

type Props = {
  desk: RecoverDeskPayload;
  defaultCollapsed?: boolean;
};

export function RecoverProcessFlow({ desk, defaultCollapsed }: Props) {
  const illustration = useRecoverIllustration();
  const previewing = useIsRecoverPreview();
  const links = useRecoverLinks();
  const preview: FlowPreviewKind = illustration ? 'illustration' : previewing && desk.book ? 'harbour' : 'live';
  const view = resolveProcessFlow({
    role: desk.role,
    capabilities: desk.capabilities,
    counts: desk.counts,
    mandates: desk.mandates,
    book: desk.book,
    ready: desk.ready,
    sample: preview !== 'live',
    preview,
  });
  const collapsed = defaultCollapsed ?? view.defaultCollapsed;
  const [open, setOpen] = useState(!collapsed);
  const demo =
    preview === 'harbour'
      ? 'Demo data. No messages are sent.'
      : preview === 'illustration' || (desk.ready && desk.workspace && desk.workspace.real_data_enabled === false && !previewing)
        ? 'Demo data'
        : null;

  return (
    <section
      id="recover-process-flow"
      aria-labelledby="recover-process-flow-title"
      data-testid="recover-process-flow"
      className="mb-8 min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white"
    >
      <div
        className="recover-fill rounded-t-3xl px-4 py-4 sm:px-6 sm:py-5"
        style={{ backgroundColor: RECOVER_BRAND.accent, color: RECOVER_BRAND.ink }}
      >
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest">{RECOVER_PRODUCT_NAME}</p>
            <h2 id="recover-process-flow-title" className="mt-0.5 text-lg font-black leading-tight sm:text-xl">
              From placement to payment
            </h2>
            <p className="mt-1.5 max-w-3xl text-sm leading-snug">{view.lead}</p>
            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
              <span className="inline-flex min-h-7 items-center rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#0f172a]">
                {view.roleLabel}
              </span>
              {demo ? (
                <span className="inline-flex min-h-7 items-center rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#0f172a]">
                  {demo}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm font-semibold leading-snug">{view.summary}</p>
          </div>
          <button
            type="button"
            className="recover-focus inline-flex min-h-11 shrink-0 items-center justify-center gap-1 self-start rounded-full bg-white px-3 text-sm font-bold text-[#0f172a]"
            aria-expanded={open}
            aria-controls="recover-process-flow-body"
            data-testid="recover-flow-toggle"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? 'Hide full process' : 'Show full process'}
            <ChevronDown className={`h-4 w-4 motion-safe:transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        </div>
      </div>
      <div id="recover-process-flow-body" hidden={!open} className="min-w-0 space-y-6 p-4 sm:p-6">
        {open ? (
          <>
          <p className="sr-only">{view.srSummary}</p>
          <ExtraCard node={quiet(view.foundation, links)} />
          {view.phases.map((phase) => (
            <div key={phase.id} className="min-w-0">
              <h3 className="text-sm font-black text-[#0f172a]">{phase.title}</h3>
              <p className="mt-0.5 text-xs text-slate-600">{phase.subtitle}</p>
              <ol className="mt-2 flex min-w-0 list-none flex-col gap-2 p-0 sm:flex-row sm:flex-wrap xl:flex-nowrap xl:items-stretch xl:gap-1">
                {phase.nodes.map((step, index) => (
                  <li
                    key={step.id}
                    data-testid={`recover-flow-step-${step.id}`}
                    className="flex min-w-0 w-full flex-col sm:w-[calc(50%-0.25rem)] xl:w-auto xl:min-w-0 xl:flex-1 xl:flex-row xl:items-stretch"
                  >
                    <StepCard node={quiet(step, links)} />
                    {index < phase.nodes.length - 1 ? (
                      <>
                        <div className="flex justify-center py-0.5 text-slate-300 sm:hidden" aria-hidden>
                          <ArrowDown className="h-4 w-4" />
                        </div>
                        <div className="hidden items-center justify-center px-0.5 text-slate-300 xl:flex" aria-hidden>
                          <ArrowRight className="h-4 w-4 shrink-0" />
                        </div>
                      </>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <RunsCard node={quiet(view.runs, links)} allowInstalled={desk.ready && desk.reason !== 'migration_pending'} />
          <div>
            <h3 className="text-sm font-black text-[#0f172a]">Guardrails</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {view.guardrails.map((guard) => (
                <div key={guard.title} className="min-w-0 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3">
                  <p className="flex items-start gap-2 text-sm font-black text-[#0f172a]">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0077b6]" aria-hidden />
                    <span className="min-w-0 break-words">{guard.title}</span>
                  </p>
                  <p className="mt-1 break-words text-xs leading-snug text-slate-600">{guard.body}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="min-w-0 break-words rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3 text-sm leading-relaxed text-[#0f172a]">
            {view.outcome}
          </p>
          </>
        ) : null}
      </div>
    </section>
  );
}

function quiet(node: FlowNodeView, links: 'live' | 'soon'): FlowNodeView {
  if (links !== 'soon') return node;
  const chips = node.chips.some((chip) => chip.text === 'Launching soon')
    ? node.chips
    : [...node.chips, { text: 'Launching soon', tone: 'soon' as const }];
  return { ...node, linkHref: null, secondary: [], chips };
}

function StepCard({ node }: { node: FlowNodeView }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <StepSurface node={node} />
      {node.secondary.length ? (
        <div className="mt-1 flex min-w-0 flex-wrap gap-2">
          {node.secondary.map((item) => (
            <StepLink key={item.href} href={item.href} className="recover-focus inline-flex min-h-11 items-center text-sm font-semibold text-[#0077b6]">
              {item.label}
            </StepLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ExtraCard({ node }: { node: FlowNodeView }) {
  return (
    <div data-testid="recover-flow-foundation" className="min-w-0">
      <StepSurface node={node} />
    </div>
  );
}

function RunsCard({ node, allowInstalled }: { node: FlowNodeView; allowInstalled: boolean }) {
  const base = useRecoverHrefBase();
  const installed =
    allowInstalled && base
      ? `${base.split('?')[0]}/installed${base.includes('?') ? `?${base.slice(base.indexOf('?') + 1)}` : ''}`
      : null;
  return (
    <div data-testid="recover-flow-runs" className="min-w-0">
      <StepSurface node={node} />
      {installed ? (
        <StepLink href={installed} className="recover-focus mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-[#0077b6]">
          Open the install preview
        </StepLink>
      ) : null}
    </div>
  );
}

function StepSurface({ node }: { node: FlowNodeView }) {
  const Icon = ICONS[node.icon];
  const className = `recover-focus flex min-h-11 min-w-0 flex-1 flex-col rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3 ${
    node.linkHref ? 'hover:border-[#00b4d8]' : ''
  } ${node.mine ? 'bg-cyan-50 ring-1 ring-[#00b4d8]/40' : ''}`;
  const body = (
    <>
      <div className="flex min-w-0 items-start gap-2">
        {node.n > 0 ? (
          <span
            className="recover-fill inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
            style={{ backgroundColor: RECOVER_BRAND.accent, color: RECOVER_BRAND.ink }}
          >
            {String(node.n).padStart(2, '0')}
          </span>
        ) : (
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: RECOVER_BRAND.accent, color: RECOVER_BRAND.ink }}
            aria-hidden
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-1.5">
            {node.n > 0 ? <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0077b6]" aria-hidden /> : null}
            <p className="min-w-0 break-words text-sm font-black leading-snug text-[#0f172a]">{node.title}</p>
          </div>
          <span className="mt-1 inline-flex max-w-full break-words rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200">
            {node.who}
          </span>
          {node.mine ? (
            <span className="ml-1 inline-flex rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#0f172a] ring-1 ring-[#00b4d8]">
              You
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-2 break-words text-xs leading-snug text-slate-600">{node.desc}</p>
      <ChipRow chips={node.chips} />
    </>
  );
  if (!node.linkHref) {
    return (
      <div className={className} aria-disabled="true">
        {body}
      </div>
    );
  }
  return (
    <StepLink href={node.linkHref} className={className}>
      {body}
    </StepLink>
  );
}

function ChipRow({ chips }: { chips: FlowChip[] }) {
  if (!chips.length) return null;
  return (
    <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span
          key={`${chip.tone}-${chip.text}`}
          className={
            chip.tone === 'count'
              ? 'inline-flex min-h-7 max-w-full items-center break-words rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-900 ring-1 ring-slate-200 tabular-nums'
              : chip.tone === 'soon'
                ? 'inline-flex min-h-7 max-w-full items-center gap-1 break-words rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700'
                : chip.tone === 'sample'
                  ? 'inline-flex min-h-7 max-w-full items-center break-words rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-sky-100'
                  : 'inline-flex min-h-7 max-w-full items-center break-words rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200'
          }
          aria-label={chip.ariaLabel}
        >
          {chip.tone === 'soon' ? <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
          {chip.text}
        </span>
      ))}
    </div>
  );
}

function StepLink({
  href,
  className,
  children,
  label,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
  label?: string;
}) {
  const mapped = useRecoverHref(href);
  if (mapped.startsWith('/preview/') || mapped.startsWith('/dashboard/')) {
    if (mapped.startsWith('/preview/')) {
      return (
        <a href={mapped} className={className} aria-label={label}>
          {children}
        </a>
      );
    }
  }
  if (href.startsWith('/preview/')) {
    return (
      <a href={href} className={className} aria-label={label}>
        {children}
      </a>
    );
  }
  return (
    <Link href={mapped} className={className} aria-label={label}>
      {children}
    </Link>
  );
}
