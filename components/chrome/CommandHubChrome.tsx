'use client';

import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import {
  OperatingPrinciples,
  type OperatingPrincipleItem,
} from '@/components/relationship/RelationshipChrome';

/** Shared command-hub chrome — same look as Operations / Manufacturing / Distribution. */

export type HubHeroStat = {
  label: string;
  value: string | number;
  /** Tailwind text color class for the value */
  valueClass?: string;
};

export type HubModule = {
  href: string;
  icon: LucideIcon;
  code: string;
  title: string;
  desc: string;
  accent?: string;
  metric?: string | number;
  metricLabel?: string;
};

export type TelemetryAccent =
  | 'cyan'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'slate'
  | 'violet'
  | 'sky';

/** Light pastel + dark deep→bright gradients (never pale grey in dark). */
const ACCENTS: Record<TelemetryAccent, string> = {
  cyan: 'from-cyan-50 to-white border-cyan-100 dark:from-[#042f2e] dark:via-[#0e7490] dark:to-[#22d3ee] dark:border-cyan-400/35',
  emerald:
    'from-emerald-50 to-white border-emerald-100 dark:from-[#022c22] dark:via-[#047857] dark:to-[#34d399] dark:border-emerald-400/35',
  amber:
    'from-amber-50 to-white border-amber-100 dark:from-[#451a03] dark:via-[#b45309] dark:to-[#fbbf24] dark:border-amber-400/35',
  rose: 'from-rose-50 to-white border-rose-100 dark:from-[#4c0519] dark:via-[#be123c] dark:to-[#fb7185] dark:border-rose-400/35',
  slate:
    'from-slate-50 to-white border-slate-200 dark:from-[#0b1e33] dark:via-[#0c4a6e] dark:to-[#0891b2] dark:border-cyan-400/30',
  violet:
    'from-violet-50 to-white border-violet-100 dark:from-[#2e1065] dark:via-[#6d28d9] dark:to-[#a78bfa] dark:border-violet-400/35',
  sky: 'from-sky-50 to-white border-sky-100 dark:from-[#0c4a6e] dark:via-[#0284c7] dark:to-[#38bdf8] dark:border-sky-400/35',
};

const DEFAULT_MODULE_ACCENTS = [
  'from-violet-50 to-white border-violet-100 dark:from-[#2e1065] dark:via-[#6d28d9] dark:to-[#a78bfa] dark:border-violet-400/35',
  'from-sky-50 to-white border-sky-100 dark:from-[#0c4a6e] dark:via-[#0284c7] dark:to-[#38bdf8] dark:border-sky-400/35',
  'from-cyan-50 to-white border-cyan-100 dark:from-[#042f2e] dark:via-[#0e7490] dark:to-[#22d3ee] dark:border-cyan-400/35',
  'from-emerald-50 to-white border-emerald-100 dark:from-[#022c22] dark:via-[#047857] dark:to-[#34d399] dark:border-emerald-400/35',
  'from-amber-50 to-white border-amber-100 dark:from-[#451a03] dark:via-[#b45309] dark:to-[#fbbf24] dark:border-amber-400/35',
  'from-rose-50 to-white border-rose-100 dark:from-[#4c0519] dark:via-[#be123c] dark:to-[#fb7185] dark:border-rose-400/35',
  'from-slate-50 to-white border-slate-200 dark:from-[#0b1e33] dark:via-[#0c4a6e] dark:to-[#0891b2] dark:border-cyan-400/30',
] as const;

/** Uniform dark workbench cards: brand blue gradient (not flat charcoal) */
const UNIFORM_DARK_MODULE =
  'from-slate-50 to-white border-slate-200 dark:from-[#061825] dark:via-[#0b3a4f] dark:to-[#0e7490] dark:border-cyan-400/30';

export function TelemetryCard({
  label,
  value,
  sub,
  accent = 'cyan',
  icon: Icon,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: TelemetryAccent;
  icon?: LucideIcon;
  href?: string;
}) {
  const inner = (
    <div
      className={`sa-metric-card h-full min-w-0 rounded-2xl border bg-gradient-to-br px-3 py-3 shadow-sm sm:px-4 sm:py-3.5 ${ACCENTS[accent]} ${
        href ? 'transition-all hover:border-[#00b4d8]/50 hover:shadow-md' : ''
      }`}
    >
      <div className="mb-1 flex min-w-0 items-start justify-between gap-2">
        <div className="sa-metric-label min-w-0 flex-1 dark:text-white/75">
          {label}
        </div>
        {Icon && (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white bg-white/80 text-[#00b4d8] dark:border-cyan-300/40 dark:bg-cyan-500/30 dark:text-cyan-100">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      <div
        className="sa-metric-value text-slate-900 dark:text-white"
        title={String(value)}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-snug text-neutral-500 dark:text-white/75 sm:text-[11px]">
          {sub}
        </div>
      )}
    </div>
  );
  if (href) return <Link href={href} className="min-w-0 block h-full">{inner}</Link>;
  return inner;
}

export function HubHero({
  pill,
  title,
  titleAccent,
  description,
  stats,
}: {
  pill: string;
  title: React.ReactNode;
  titleAccent?: string;
  description: string;
  stats?: HubHeroStat[];
}) {
  return (
    <section className="relative mb-8 overflow-hidden rounded-[2rem] border border-cyan-100 bg-gradient-to-br from-white via-sky-50/90 to-cyan-50 p-6 shadow-sm dark:border-cyan-400/30 dark:from-[#061825] dark:via-[#0b3a4f] dark:to-[#0e7490] sm:p-8">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#00b4d8]/10 blur-3xl dark:bg-cyan-400/20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/4 h-32 w-32 rounded-full bg-violet-200/20 blur-3xl dark:bg-teal-300/15"
        aria-hidden
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#0077b6] shadow-sm dark:border-cyan-300/40 dark:bg-cyan-500/25 dark:text-cyan-50">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            {pill}
          </div>
          <h2 className="mb-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {title}
            {titleAccent ? (
              <span className="block text-[#00b4d8] dark:text-cyan-200">
                {titleAccent}
              </span>
            ) : null}
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-cyan-50/85">
            {description}
          </p>
        </div>
        {stats && stats.length > 0 && (
          <div
            className={`grid w-full min-w-0 gap-2 sm:gap-3 lg:min-w-[240px] lg:max-w-md ${
              stats.length >= 3
                ? 'grid-cols-2 sm:grid-cols-3'
                : stats.length === 2
                  ? 'grid-cols-2'
                  : 'grid-cols-1'
            }`}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                className="sa-metric-card min-w-0 rounded-2xl border border-cyan-100 bg-white px-2.5 py-2.5 text-center shadow-sm dark:border-cyan-300/30 dark:bg-gradient-to-br dark:from-[#0b1e33] dark:to-[#0e7490] sm:px-3 sm:py-3"
              >
                <div className="line-clamp-2 text-[9px] font-bold uppercase tracking-wider text-neutral-400 dark:text-cyan-100/70 sm:text-[10px]">
                  {s.label}
                </div>
                <div
                  className={`sa-metric-value text-lg sm:text-2xl font-black tabular-nums ${
                    s.valueClass || 'text-[#00b4d8]'
                  }`}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function HubModuleCard({
  module: m,
  accent,
  uniformDark = false,
}: {
  module: HubModule;
  accent?: string;
  /** When true, all cards share one brand-blue gradient surface in dark. */
  uniformDark?: boolean;
}) {
  const Icon = m.icon;
  const gradient = uniformDark
    ? UNIFORM_DARK_MODULE
    : m.accent || accent || DEFAULT_MODULE_ACCENTS[0];
  return (
    <Link
      href={m.href}
      className={`sa-metric-card group min-w-0 rounded-3xl border bg-gradient-to-br p-4 shadow-sm transition-all hover:border-[#00b4d8]/40 hover:shadow-md sm:p-6 ${gradient}`}
    >
      <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-50 bg-white text-[#0077b6] shadow-sm dark:border-cyan-300/40 dark:bg-gradient-to-br dark:from-cyan-600 dark:to-teal-400 dark:text-slate-950">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 max-w-[55%] text-right">
          <div className="font-mono text-[10px] font-black tracking-widest text-neutral-400 dark:text-white/70">
            {m.code}
          </div>
          {m.metric !== undefined && (
            <>
              <div
                className="sa-metric-value-sm mt-0.5 text-slate-800 dark:text-white"
                title={String(m.metric)}
              >
                {m.metric}
              </div>
              {m.metricLabel && (
                <div className="text-[9px] font-bold uppercase text-neutral-400 dark:text-white/65">
                  {m.metricLabel}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <h3 className="mb-1.5 text-base font-black text-slate-800 transition-colors group-hover:text-[#0077b6] dark:text-white dark:group-hover:text-cyan-100 sm:text-lg">
        {m.title}
      </h3>
      <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-neutral-500 dark:text-white/80">
        {m.desc}
      </p>
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#00b4d8] dark:text-cyan-100">
        Open{' '}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export function HubModuleGrid({
  modules,
  className = 'mb-8',
  uniformDark = false,
}: {
  modules: HubModule[];
  className?: string;
  /** Dark theme: every card the same charcoal surface (FitAdvisor workbenches). */
  uniformDark?: boolean;
}) {
  return (
    <div className={`grid md:grid-cols-2 xl:grid-cols-3 gap-4 ${className}`}>
      {modules.map((m, i) => (
        <HubModuleCard
          key={m.href + m.code}
          module={m}
          accent={
            uniformDark
              ? UNIFORM_DARK_MODULE
              : m.accent || DEFAULT_MODULE_ACCENTS[i % DEFAULT_MODULE_ACCENTS.length]
          }
          uniformDark={uniformDark}
        />
      ))}
    </div>
  );
}

export function HubTelemetryGrid({
  children,
  className = 'mb-8',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3 min-w-0 ${className}`}
    >
      {children}
    </div>
  );
}

export function HubPrinciples({
  items,
}: {
  items: readonly OperatingPrincipleItem[];
}) {
  return <OperatingPrinciples items={items} />;
}

export function HubLoading() {
  return (
    <div className="py-20 flex justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#00b4d8] border-t-transparent animate-spin" />
    </div>
  );
}

export function HubPanel({
  title,
  action,
  children,
  className = '',
  variant = 'white',
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  variant?: 'white' | 'cyan';
}) {
  const shell =
    variant === 'cyan'
      ? 'rounded-3xl border border-cyan-100 bg-gradient-to-br from-white to-sky-50/80 p-5 shadow-sm'
      : 'rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm';
  return (
    <div className={`${shell} ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black text-slate-800">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
