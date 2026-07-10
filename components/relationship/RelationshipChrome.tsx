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
          className="group inline-flex items-center gap-2 text-sm text-neutral-500 mb-3 hover:text-[#0077b6] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5 text-[#00b4d8]" />
          {backLabel || 'Overview'}
        </Link>
      )}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="max-w-3xl">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
              {eyebrow}
            </p>
          )}
          <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-[#00b4d8] leading-[1.1]">
            {titleAccent ? (
              <>
                <span className="text-slate-800">{title}</span>{' '}
                <span className="text-[#00b4d8]">{titleAccent}</span>
              </>
            ) : (
              title
            )}
          </h1>
          {description && (
            <p className="text-neutral-600 mt-2 text-sm max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {action && <div className="flex flex-wrap gap-2 shrink-0">{action}</div>}
      </div>
    </div>
  );
}

export function ProcessRail({
  steps,
  showNumbers = true,
}: {
  steps: ProcessStep[];
  /** When false, step labels render without the 1/2/3 cycle badges. */
  showNumbers?: boolean;
}) {
  return (
    <div className="mb-8 overflow-x-auto">
      <div className="flex items-center gap-0 min-w-max">
        {steps.map((step, i) => (
          <div key={step.href + step.label} className="flex items-center">
            <Link
              href={step.href}
              className="group flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3.5 py-2.5 hover:border-[#00b4d8] hover:shadow-sm transition-all"
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
