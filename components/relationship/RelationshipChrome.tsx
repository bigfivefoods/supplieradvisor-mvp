'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';

/** Shared chrome for CRM + SRM + My Business — light white/blue inventory language. */

export type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

export type ModuleCard = {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  badge?: string;
};

export type ProcessStep = {
  label: string;
  href: string;
  /** Short explanation of this stage in the lifecycle */
  desc?: string;
  /** When true, only highlight on exact path match (module command hubs) */
  exact?: boolean;
};

const BRAND = '#00b4d8';
const BRAND_DEEP = '#0077b6';

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  const base = href.split('?')[0];
  return pathname === base || pathname.startsWith(base + '/');
}

export function CompanyGate({
  children,
  noun = 'this module',
}: {
  children: React.ReactNode;
  noun?: string;
}) {
  // Read company once per render — do not use focus listeners that remount trees
  // (remounts wipe form state and feel like "fields don't work").
  const companyId = getSelectedCompanyId();

  if (!companyId) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4 relative z-10 pointer-events-auto">
        <div className="max-w-md w-full text-center rounded-3xl border border-neutral-200 bg-white p-10 shadow-sm">
          <div className="mx-auto mb-5 h-12 w-12 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center">
            <span className="text-[#00b4d8] font-black text-lg">SA</span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-slate-800 mb-2">
            Select a company
          </h2>
          <p className="text-sm text-neutral-500 mb-6">
            Choose a workspace to open {noun}.
          </p>
          <Link href="/dashboard/select-company" className="btn-primary !py-3 !px-8 text-sm">
            Select company
          </Link>
        </div>
      </div>
    );
  }
  return <div className="relative z-10 pointer-events-auto">{children}</div>;
}

export function RelationshipPage({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // No absolute overlay layers — they have blocked clicks in production.
  // Soft wash is a background on this element only (never a covering child).
  return (
    <div className={`sa-page ${className}`}>
      <div className="px-0 sm:px-1 max-w-screen-2xl mx-auto pt-1 relative z-10 pointer-events-auto">
        {children}
      </div>
    </div>
  );
}

export function RelationshipNav({
  items,
}: {
  items: readonly NavItem[];
  /** @deprecated accent kept for API compat — always cyan/light now */
  accent?: 'cyan' | 'slate';
}) {
  const pathname = usePathname() || '';

  return (
    <div className="mb-6 -mx-1">
      <div className="flex gap-1.5 overflow-x-auto pb-1 px-1 scrollbar-thin">
        {items.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-shrink-0 inline-flex items-center px-3 py-2 rounded-full text-xs font-semibold border transition-all ${
                active
                  ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/40 hover:text-[#0077b6]'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function RelationshipHeader({
  eyebrow,
  title,
  titleAccent,
  description,
  action,
  backHref,
  backLabel,
  nav,
}: {
  eyebrow?: string;
  title: string;
  /** Optional second word; rendered in brand cyan when title is dark, or reverse */
  titleAccent?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  nav?: React.ReactNode;
}) {
  return (
    <div className="mb-6 sm:mb-8">
      {nav}
      {backHref && (
        <Link
          href={backHref}
          className="group mb-3 inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-[#0077b6]"
        >
          <ArrowLeft className="h-4 w-4 text-[#00b4d8] transition-transform group-hover:-translate-x-0.5" />
          {backLabel || 'Command'}
        </Link>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow && (
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400 sm:text-xs">
              {eyebrow}
            </p>
          )}
          <h1 className="text-3xl font-black leading-[1.1] tracking-tight text-slate-900 sm:text-4xl sm:tracking-[-1.5px]">
            {titleAccent ? (
              <>
                <span className="text-slate-800">{title}</span>{' '}
                <span className="text-[#00b4d8]">{titleAccent}</span>
              </>
            ) : (
              <span className="text-[#00b4d8]">{title}</span>
            )}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600 sm:text-[15px]">
              {description}
            </p>
          )}
        </div>
        {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

/** Light command band for sub-module workbenches — same language as hub heroes. */
export function CommandWorkbenchBand({
  pill,
  title,
  description,
  stats,
}: {
  pill?: string;
  title: React.ReactNode;
  description?: string;
  stats?: Array<{ label: string; value: string | number; valueClass?: string }>;
}) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-[1.5rem] border border-cyan-100 bg-gradient-to-br from-white via-sky-50/90 to-cyan-50 p-4 shadow-sm sm:mb-8 sm:rounded-[2rem] sm:p-6">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-[#00b4d8]/10 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          {pill && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#0077b6] shadow-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              {pill}
            </div>
          )}
          <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
          {description && (
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{description}</p>
          )}
        </div>
        {stats && stats.length > 0 && (
          <div
            className={`grid min-w-0 gap-2 sm:min-w-[240px] ${
              stats.length >= 3 ? 'grid-cols-3' : stats.length === 2 ? 'grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-cyan-100 bg-white px-2.5 py-2.5 text-center shadow-sm sm:px-3"
              >
                <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 sm:text-[10px]">
                  {s.label}
                </div>
                <div
                  className={`text-lg font-black tabular-nums sm:text-xl ${
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

export function ProcessRail({
  steps,
  showNumbers = true,
}: {
  steps: readonly ProcessStep[];
  /** When false, step labels render without the 1/2/3 cycle badges. */
  showNumbers?: boolean;
}) {
  return (
    <div className="mb-4 overflow-x-auto">
      <div className="flex items-center gap-0 min-w-max">
        {steps.map((step, i) => (
          <div key={step.href + step.label} className="flex items-center">
            <Link
              href={step.href}
              className="group flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3.5 py-2.5 hover:border-[#00b4d8] hover:shadow-sm transition-all"
              title={step.desc}
            >
              {showNumbers && (
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#00b4d8]/10 text-[10px] font-black text-[#00b4d8] group-hover:bg-[#00b4d8] group-hover:text-white transition-colors">
                  {i + 1}
                </span>
              )}
              <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                {step.label}
              </span>
            </Link>
            {i < steps.length - 1 && (
              <div className="w-4 sm:w-6 h-px bg-gradient-to-r from-[#00b4d8]/30 to-neutral-200 mx-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Full process lifecycle: title, intro, clickable rail, and explained stages.
 * Built into module hubs so the operating process is explicit and navigable.
 */
export function ProcessLifecycle({
  title = 'Process lifecycle',
  intro,
  steps,
  showNumbers = true,
  className = '',
}: {
  title?: string;
  intro?: string;
  steps: readonly ProcessStep[];
  showNumbers?: boolean;
  className?: string;
}) {
  const hasDesc = steps.some((s) => s.desc);
  return (
    <div className={`mb-8 ${className}`}>
      <SectionLabel>{title}</SectionLabel>
      {intro && (
        <p className="text-sm text-neutral-500 mb-3 max-w-2xl leading-relaxed -mt-1">
          {intro}
        </p>
      )}
      <ProcessRail steps={steps} showNumbers={showNumbers} />
      {hasDesc && (
        <div
          className={`grid gap-3 mt-1 ${
            steps.length <= 3
              ? 'sm:grid-cols-3'
              : steps.length <= 4
                ? 'sm:grid-cols-2 lg:grid-cols-4'
                : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          }`}
        >
          {steps.map((step, i) => (
            <Link
              key={step.href + step.label + i}
              href={step.href}
              className="group rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 hover:border-[#00b4d8]/50 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#00b4d8]/10 text-[10px] font-black text-[#00b4d8] group-hover:bg-[#00b4d8] group-hover:text-white transition-colors">
                  {i + 1}
                </span>
                <span className="text-xs font-bold text-slate-800 group-hover:text-[#0077b6]">
                  {step.label}
                </span>
                <ArrowRight className="w-3 h-3 text-neutral-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {step.desc && (
                <p className="text-[11px] text-neutral-500 leading-relaxed pl-8">
                  {step.desc}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const KPI_TONES = {
  neutral: {
    ring: 'border-neutral-200',
    icon: 'bg-[#00b4d8]/10 text-[#00b4d8]',
    value: 'text-slate-800',
  },
  cyan: {
    ring: 'border-[#00b4d8]/25',
    icon: 'bg-[#00b4d8]/10 text-[#0077b6]',
    value: 'text-slate-800',
  },
  emerald: {
    ring: 'border-emerald-200/80',
    icon: 'bg-emerald-50 text-emerald-600',
    value: 'text-emerald-900',
  },
  amber: {
    ring: 'border-amber-200/80',
    icon: 'bg-amber-50 text-amber-600',
    value: 'text-amber-950',
  },
  violet: {
    ring: 'border-violet-200/80',
    icon: 'bg-violet-50 text-violet-600',
    value: 'text-slate-800',
  },
} as const;

export function KpiCard({
  label,
  value,
  sub,
  href,
  icon: Icon,
  tone = 'neutral',
  loading,
}: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  icon?: LucideIcon;
  tone?: keyof typeof KPI_TONES;
  loading?: boolean;
}) {
  const t = KPI_TONES[tone];
  const inner = (
    <div
      className={`relative h-full rounded-3xl border ${t.ring} bg-white p-4 sm:p-5 transition-all duration-200 ${
        href ? 'hover:shadow-md hover:border-[#00b4d8]' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        {Icon ? (
          <div className={`p-2 rounded-xl ${t.icon}`}>
            <Icon className="w-4 h-4" />
          </div>
        ) : (
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            {label}
          </span>
        )}
        {href && (
          <ArrowRight className="w-3.5 h-3.5 text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      {Icon && (
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400 mb-1">
          {label}
        </div>
      )}
      <div className={`text-2xl sm:text-3xl font-black tracking-tighter tabular-nums ${t.value}`}>
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
        ) : (
          value
        )}
      </div>
      {sub && <div className="text-[11px] text-neutral-500 mt-1.5 leading-snug">{sub}</div>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function ModuleGrid({ modules }: { modules: readonly ModuleCard[] }) {
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
      {modules.map((m) => {
        const Icon = m.icon;
        return (
          <Link
            key={m.href}
            href={m.href}
            className="group relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6 transition-all duration-200 hover:border-[#00b4d8] hover:shadow-md"
          >
            <div className="relative flex items-start justify-between mb-4">
              <div className="w-9 h-9 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#00b4d8]" />
              </div>
              <div className="flex items-center gap-2">
                {m.badge && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#00b4d8]/10 text-[#0077b6] border border-[#00b4d8]/20">
                    {m.badge}
                  </span>
                )}
                <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-[#00b4d8] group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
            <h3 className="relative font-bold text-[15px] sm:text-base tracking-tight text-slate-800 mb-1.5 group-hover:text-[#0077b6] transition-colors">
              {m.title}
            </h3>
            <p className="relative text-xs sm:text-[13px] text-neutral-500 leading-relaxed">
              {m.desc}
            </p>
            <div className="mt-3 text-xs font-semibold text-[#00b4d8] inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Open <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function SectionLabel({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <h2 className="text-sm font-bold text-slate-800">{children}</h2>
      {action}
    </div>
  );
}

export function Panel({
  children,
  className = '',
  title,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-3xl border border-neutral-200 bg-white overflow-hidden ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-100">
          {title && (
            <h3 className="text-xs font-bold text-slate-700 tracking-wide">{title}</h3>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export type OperatingPrincipleItem = {
  title: string;
  body: string;
};

/**
 * Shared “Operating principle” panel used on module hubs
 * (same pattern as Suppliers: 3 numbered principles).
 */
export function OperatingPrinciples({
  items,
  className = '',
}: {
  items: readonly OperatingPrincipleItem[];
  className?: string;
}) {
  return (
    <div className={`mt-10 ${className}`}>
      <Panel title="Operating principle">
        <div className="px-5 py-6 sm:px-8 sm:py-8 grid sm:grid-cols-3 gap-6 text-sm">
          {items.map((item, i) => (
            <div key={item.title}>
              <div className="text-[10px] font-black tracking-[0.2em] text-[#00b4d8] mb-2">
                {String(i + 1).padStart(2, '0')}
              </div>
              <div className="font-bold text-slate-900 mb-1.5">{item.title}</div>
              <p className="text-xs text-neutral-500 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function AlertBanner({
  children,
  tone = 'amber',
}: {
  children: React.ReactNode;
  tone?: 'amber' | 'sky' | 'red';
}) {
  const cls =
    tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-900'
      : tone === 'sky'
        ? 'border-sky-200 bg-sky-50 text-sky-900'
        : 'border-amber-200 bg-amber-50 text-amber-950';
  return (
    <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${cls}`}>{children}</div>
  );
}

/** Light metric highlight — white card with cyan accent (no black panels). */
export function MetricHero({
  label,
  value,
  unit,
  badge,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  unit?: string;
  badge?: React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#00b4d8]/25 bg-gradient-to-br from-white to-[#00b4d8]/[0.06] p-6 sm:p-7">
      <div
        aria-hidden
        className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[#00b4d8]/10 blur-2xl"
      />
      <div className="relative flex items-start justify-between mb-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
          {label}
        </span>
        {Icon && (
          <div className="p-2 rounded-xl bg-[#00b4d8]/10">
            <Icon className="w-5 h-5 text-[#00b4d8]" />
          </div>
        )}
      </div>
      <div className="relative flex items-baseline gap-1">
        <span className="text-5xl sm:text-6xl font-black tracking-tighter tabular-nums text-slate-800">
          {value}
        </span>
        {unit && <span className="text-2xl font-bold text-[#00b4d8]">{unit}</span>}
      </div>
      {badge && <div className="relative mt-3">{badge}</div>}
      {hint && <p className="relative mt-3 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

// Export brand tokens for page-level consistency (optional use)
export const RELATIONSHIP_BRAND = { BRAND, BRAND_DEEP } as const;
