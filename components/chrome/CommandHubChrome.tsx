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

const ACCENTS: Record<TelemetryAccent, string> = {
  cyan: 'from-cyan-50 to-white border-cyan-100',
  emerald: 'from-emerald-50 to-white border-emerald-100',
  amber: 'from-amber-50 to-white border-amber-100',
  rose: 'from-rose-50 to-white border-rose-100',
  slate: 'from-slate-50 to-white border-slate-200',
  violet: 'from-violet-50 to-white border-violet-100',
  sky: 'from-sky-50 to-white border-sky-100',
};

const DEFAULT_MODULE_ACCENTS = [
  'from-violet-50 to-white border-violet-100',
  'from-sky-50 to-white border-sky-100',
  'from-cyan-50 to-white border-cyan-100',
  'from-emerald-50 to-white border-emerald-100',
  'from-amber-50 to-white border-amber-100',
  'from-rose-50 to-white border-rose-100',
  'from-slate-50 to-white border-slate-200',
] as const;

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
      className={`rounded-2xl border bg-gradient-to-br ${ACCENTS[accent]} px-4 py-3.5 shadow-sm h-full ${
        href ? 'hover:border-[#00b4d8]/50 hover:shadow-md transition-all' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
          {label}
        </div>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-white/80 border border-white flex items-center justify-center text-[#00b4d8]">
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      <div className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-slate-900">
        {value}
      </div>
      {sub && <div className="text-[11px] text-neutral-500 mt-0.5 font-medium">{sub}</div>}
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
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
    <section className="relative overflow-hidden rounded-[2rem] border border-cyan-100 bg-gradient-to-br from-white via-sky-50/90 to-cyan-50 p-6 sm:p-8 mb-8 shadow-sm">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#00b4d8]/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/4 bottom-0 h-32 w-32 rounded-full bg-violet-200/20 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#0077b6] mb-4 shadow-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            {pill}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mb-2">
            {title}
            {titleAccent ? (
              <span className="block text-[#00b4d8]">{titleAccent}</span>
            ) : null}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
        </div>
        {stats && stats.length > 0 && (
          <div
            className={`grid gap-3 min-w-[260px] ${
              stats.length >= 3 ? 'grid-cols-3' : stats.length === 2 ? 'grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-white border border-cyan-100 px-3 py-3 text-center shadow-sm"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  {s.label}
                </div>
                <div
                  className={`text-2xl font-black tabular-nums ${
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
}: {
  module: HubModule;
  accent?: string;
}) {
  const Icon = m.icon;
  const gradient = m.accent || accent || DEFAULT_MODULE_ACCENTS[0];
  return (
    <Link
      href={m.href}
      className={`group rounded-3xl border bg-gradient-to-br ${gradient} p-6 shadow-sm hover:shadow-md hover:border-[#00b4d8]/40 transition-all`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-2xl bg-white border border-cyan-50 flex items-center justify-center shadow-sm text-[#0077b6]">
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black tracking-widest text-neutral-400 font-mono">
            {m.code}
          </div>
          {m.metric !== undefined && (
            <>
              <div className="text-lg font-black tabular-nums text-slate-800 mt-0.5">
                {m.metric}
              </div>
              {m.metricLabel && (
                <div className="text-[9px] font-bold uppercase text-neutral-400">
                  {m.metricLabel}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <h3 className="text-lg font-black text-slate-800 mb-1.5 group-hover:text-[#0077b6] transition-colors">
        {m.title}
      </h3>
      <p className="text-sm text-neutral-500 leading-relaxed mb-3">{m.desc}</p>
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#00b4d8]">
        Open{' '}
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </Link>
  );
}

export function HubModuleGrid({
  modules,
  className = 'mb-8',
}: {
  modules: HubModule[];
  className?: string;
}) {
  return (
    <div className={`grid md:grid-cols-2 xl:grid-cols-3 gap-4 ${className}`}>
      {modules.map((m, i) => (
        <HubModuleCard
          key={m.href + m.code}
          module={m}
          accent={m.accent || DEFAULT_MODULE_ACCENTS[i % DEFAULT_MODULE_ACCENTS.length]}
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
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>{children}</div>
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
