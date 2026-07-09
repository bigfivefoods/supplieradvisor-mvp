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

/** Shared chrome for CRM + SRM — one product language, two domains. */

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

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  // strip query for match
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
  const companyId = getSelectedCompanyId();
  if (!companyId) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center rounded-[2rem] border border-neutral-200/80 bg-white p-10 shadow-sm">
          <div className="mx-auto mb-5 h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center">
            <span className="text-[#00b4d8] font-black text-lg">SA</span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 mb-2">
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
  return <>{children}</>;
}

export function RelationshipPage({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative min-h-screen pb-16 ${className}`}
    >
      {/* subtle industrial grid wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 0%, rgba(0,180,216,0.08), transparent 45%), radial-gradient(circle at 80% 20%, rgba(15,23,42,0.04), transparent 40%)',
        }}
      />
      <div className="px-3 sm:px-4 md:px-6 max-w-screen-2xl mx-auto pt-2">{children}</div>
    </div>
  );
}

export function RelationshipNav({
  items,
  accent = 'cyan',
}: {
  items: readonly NavItem[];
  accent?: 'cyan' | 'slate';
}) {
  const pathname = usePathname() || '';
  const activeCls =
    accent === 'cyan'
      ? 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/10'
      : 'bg-slate-900 text-white border-slate-900';

  return (
    <div className="mb-8 -mx-1">
      <div className="flex gap-1 overflow-x-auto pb-1 px-1 scrollbar-thin">
        {items.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-shrink-0 px-3.5 py-2 rounded-full text-[11px] font-semibold tracking-wide uppercase border transition-all duration-200 ${
                active
                  ? activeCls
                  : 'border-neutral-200/90 bg-white/80 backdrop-blur text-neutral-500 hover:border-neutral-400 hover:text-slate-900'
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
  /** Optional accent word rendered in brand cyan */
  titleAccent?: string;
  description?: string;
  action?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  nav?: React.ReactNode;
}) {
  return (
    <div className="mb-8 sm:mb-10">
      {nav}
      {backHref && (
        <Link
          href={backHref}
          className="group inline-flex items-center gap-2 text-xs font-medium text-neutral-400 mb-4 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          {backLabel || 'Overview'}
        </Link>
      )}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div className="max-w-3xl">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-2">
              {eyebrow}
            </p>
          )}
          <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-black tracking-[-0.04em] text-slate-900 leading-[1.05]">
            {titleAccent ? (
              <>
                {title}{' '}
                <span className="text-[#00b4d8]">{titleAccent}</span>
              </>
            ) : (
              title
            )}
          </h1>
          {description && (
            <p className="text-neutral-500 mt-3 text-sm sm:text-[15px] leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {action && <div className="flex flex-wrap gap-2 shrink-0">{action}</div>}
      </div>
    </div>
  );
}

export function ProcessRail({ steps }: { steps: ProcessStep[] }) {
  return (
    <div className="mb-8 overflow-x-auto">
      <div className="flex items-center gap-0 min-w-max">
        {steps.map((step, i) => (
          <div key={step.href + step.label} className="flex items-center">
            <Link
              href={step.href}
              className="group flex items-center gap-2 rounded-2xl border border-neutral-200/80 bg-white px-3.5 py-2.5 hover:border-slate-900 hover:shadow-sm transition-all"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-black text-white group-hover:bg-[#00b4d8] transition-colors">
                {i + 1}
              </span>
              <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                {step.label}
              </span>
            </Link>
            {i < steps.length - 1 && (
              <div className="w-4 sm:w-6 h-px bg-gradient-to-r from-neutral-300 to-neutral-200 mx-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const KPI_TONES = {
  neutral: {
    ring: 'border-neutral-200/90',
    icon: 'bg-neutral-100 text-slate-700',
    value: 'text-slate-900',
  },
  cyan: {
    ring: 'border-[#00b4d8]/25',
    icon: 'bg-[#00b4d8]/10 text-[#0077b6]',
    value: 'text-slate-900',
  },
  emerald: {
    ring: 'border-emerald-200/80',
    icon: 'bg-emerald-50 text-emerald-700',
    value: 'text-emerald-900',
  },
  amber: {
    ring: 'border-amber-200/80',
    icon: 'bg-amber-50 text-amber-800',
    value: 'text-amber-950',
  },
  violet: {
    ring: 'border-violet-200/80',
    icon: 'bg-violet-50 text-violet-700',
    value: 'text-slate-900',
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
      className={`relative h-full rounded-[1.25rem] border ${t.ring} bg-white/90 backdrop-blur p-4 sm:p-5 transition-all duration-200 ${
        href ? 'hover:shadow-lg hover:shadow-slate-900/5 hover:-translate-y-0.5 hover:border-slate-300' : ''
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
      <div className={`text-2xl sm:text-3xl font-black tracking-[-0.03em] tabular-nums ${t.value}`}>
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin text-neutral-300" />
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
            className="group relative overflow-hidden rounded-[1.35rem] border border-neutral-200/90 bg-white p-5 sm:p-6 transition-all duration-300 hover:border-slate-900 hover:shadow-xl hover:shadow-slate-900/5"
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-[#00b4d8]/[0.04] to-transparent pointer-events-none" />
            <div className="relative flex items-start justify-between mb-4">
              <div className="p-2.5 rounded-2xl bg-slate-50 text-slate-800 border border-neutral-100 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all duration-300">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                {m.badge && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-900 text-white">
                    {m.badge}
                  </span>
                )}
                <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-[#00b4d8] group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
            <h3 className="relative font-bold text-[15px] sm:text-base tracking-tight text-slate-900 mb-1.5">
              {m.title}
            </h3>
            <p className="relative text-xs sm:text-[13px] text-neutral-500 leading-relaxed">
              {m.desc}
            </p>
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
    <div className="flex items-end justify-between gap-3 mb-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
        {children}
      </h2>
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
      className={`rounded-[1.35rem] border border-neutral-200/90 bg-white overflow-hidden ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-100">
          {title && (
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
              {title}
            </h3>
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
    <div className="relative overflow-hidden rounded-[1.35rem] border border-slate-900 bg-slate-900 text-white p-6 sm:p-7">
      <div
        aria-hidden
        className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[#00b4d8]/20 blur-2xl"
      />
      <div className="relative flex items-start justify-between mb-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
          {label}
        </span>
        {Icon && <Icon className="w-5 h-5 text-[#00b4d8]" />}
      </div>
      <div className="relative flex items-baseline gap-1">
        <span className="text-5xl sm:text-6xl font-black tracking-[-0.05em] tabular-nums">
          {value}
        </span>
        {unit && <span className="text-2xl font-bold text-neutral-400">{unit}</span>}
      </div>
      {badge && <div className="relative mt-3">{badge}</div>}
      {hint && <p className="relative mt-3 text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}
