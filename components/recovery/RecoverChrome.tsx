'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Shield } from 'lucide-react';
import { ModuleCrumbs } from '@/components/chrome/ModuleCrumbs';
import { RECOVER_BRAND, RECOVER_PRODUCT_NAME } from '@/lib/recovery/brand';
import { recoverRoleLabel, type RecoverRole } from '@/lib/recovery/roles';

export function RecoverFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 min-w-0 w-full pointer-events-auto">
      <style>{`
        .recover-fill {
          background-color: ${RECOVER_BRAND.accent};
          color: ${RECOVER_BRAND.ink};
        }
        .recover-fill:hover {
          background-color: ${RECOVER_BRAND.accentHover};
          color: ${RECOVER_BRAND.ink};
        }
        .recover-link { color: ${RECOVER_BRAND.accentDeep}; }
        .recover-focus:focus-visible {
          outline: 2px solid ${RECOVER_BRAND.accentDeep};
          outline-offset: 2px;
        }
      `}</style>
      {children}
    </div>
  );
}

export function RecoverButton({
  children,
  href,
  type = 'button',
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  href?: string;
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
}) {
  const className =
    'recover-fill recover-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold shadow-sm transition-colors motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60';
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={className} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function RecoverQuietButton({
  children,
  type = 'button',
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="recover-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function RecoverScreen({
  testId,
  eyebrow = RECOVER_PRODUCT_NAME,
  title,
  description,
  action,
  children,
}: {
  testId?: string;
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <RecoverFrame>
      <div data-testid={testId} className="min-w-0">
        <header
          data-testid="recover-page-header"
          className="z-30 mb-5 min-w-0 w-full bg-[#f8fafc]/90 py-1 backdrop-blur sm:mb-6 md:sticky md:top-14 md:mb-8"
        >
          <ModuleCrumbs />
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400 sm:text-xs">
                {eyebrow}
              </p>
              <h1 className="text-pretty text-2xl font-black leading-[1.15] tracking-tight text-slate-900 sm:text-3xl sm:tracking-[-1.5px] md:text-4xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 sm:text-[15px]">
                  {description}
                </p>
              ) : null}
            </div>
            {action ? <div className="flex min-w-0 flex-wrap gap-2">{action}</div> : null}
          </div>
        </header>
        {children}
      </div>
    </RecoverFrame>
  );
}

export function RecoverRoleChip({ role }: { role: RecoverRole }) {
  return (
    <span
      data-testid="recover-role-chip"
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#e2e8f0] bg-white px-3 text-xs font-bold text-slate-900 shadow-sm"
    >
      <Shield className="h-4 w-4 text-[#0077b6]" aria-hidden />
      {recoverRoleLabel(role)}
    </span>
  );
}

export function RecoverBanner({
  testId,
  tone,
  children,
}: {
  testId: string;
  tone: 'demo' | 'pending' | 'cfdc' | 'error';
  children: React.ReactNode;
}) {
  const toneClass =
    tone === 'error'
      ? 'border-rose-200 bg-rose-50'
      : tone === 'cfdc'
        ? 'border-amber-200 bg-amber-50'
        : tone === 'pending'
          ? 'border-slate-200 bg-slate-50'
          : 'border-cyan-100 bg-gradient-to-r from-cyan-50 to-white';
  return (
    <div
      data-testid={testId}
      role="status"
      className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-medium leading-relaxed text-slate-900 shadow-sm ${toneClass}`}
    >
      {children}
    </div>
  );
}

export function RecoverKpi({
  testId,
  label,
  value,
  sub,
  icon: Icon,
}: {
  testId: string;
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
}) {
  return (
    <div
      data-testid={testId}
      className="sa-metric-card h-full min-w-0 rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white px-3 py-3 shadow-sm sm:px-4 sm:py-3.5"
    >
      <div className="mb-1 flex min-w-0 items-start justify-between gap-2">
        <div className="sa-metric-label min-w-0 flex-1">{label}</div>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white bg-white/80 text-[#0077b6]">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </div>
      </div>
      <div className="sa-metric-value tabular-nums text-slate-900">{value}</div>
      <div className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-snug text-neutral-500 sm:text-[11px]">
        {sub}
      </div>
    </div>
  );
}

export function RecoverModuleCard({
  href,
  icon: Icon,
  code,
  title,
  desc,
  metric,
  metricLabel,
  accent = 'from-cyan-50 to-white border-cyan-100',
}: {
  href: string;
  icon: LucideIcon;
  code: string;
  title: string;
  desc: string;
  metric?: string;
  metricLabel?: string;
  accent?: string;
}) {
  return (
    <Link
      href={href}
      className={`sa-metric-card group min-w-0 rounded-3xl border bg-gradient-to-br p-4 shadow-sm transition-all hover:border-[#0077b6]/40 hover:shadow-md sm:p-6 ${accent}`}
    >
      <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-50 bg-white text-[#0077b6] shadow-sm">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 max-w-[55%] text-right">
          <div className="font-mono text-[10px] font-black tracking-widest text-neutral-400">{code}</div>
          {metric !== undefined ? (
            <>
              <div className="sa-metric-value-sm mt-0.5 tabular-nums text-slate-800">{metric}</div>
              {metricLabel ? (
                <div className="text-[9px] font-bold uppercase text-neutral-400">{metricLabel}</div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      <h3 className="mb-1.5 text-base font-black text-slate-800 transition-colors group-hover:text-[#0077b6] sm:text-lg">
        {title}
      </h3>
      <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-neutral-500">{desc}</p>
      <span className="recover-link inline-flex items-center gap-1 text-xs font-bold">
        Open
        <ArrowRight className="h-3.5 w-3.5 transition-transform motion-safe:group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export function RecoverEmpty({
  testId,
  icon: Icon,
  title,
  body,
  action,
  legend,
}: {
  testId: string;
  icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
  legend?: string[];
}) {
  return (
    <div
      data-testid={testId}
      className="overflow-hidden rounded-3xl border border-[#e2e8f0] bg-white shadow-sm"
    >
      <div className="relative bg-gradient-to-br from-cyan-50 via-white to-white p-6 sm:p-8">
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full blur-3xl"
          style={{ background: 'var(--sa-page-glow-1, rgba(0,180,216,0.14))' }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-50 bg-white text-[#0077b6] shadow-sm">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">{body}</p>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </div>
      {legend && legend.length > 0 ? (
        <div
          className={`grid border-t border-[#e2e8f0] bg-[#f8fafc] ${
            legend.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'
          }`}
        >
          {legend.map((label) => (
            <div key={label} className="min-w-0 px-4 py-3.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-neutral-400">{label}</div>
              <div className="mt-1 text-lg font-black tabular-nums text-slate-900">—</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function RecoverPanel({
  title,
  action,
  children,
  testId,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className="rounded-3xl border border-[#e2e8f0] bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-black text-slate-800">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function RecoverField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-neutral-400">
        {label}
      </span>
      {children}
    </label>
  );
}

export const recoverInputClass =
  'recover-focus min-h-11 w-full rounded-2xl border border-[#e2e8f0] bg-white px-3 text-sm text-slate-900 shadow-sm';

export function dash(value: number | null | undefined): string {
  if (value == null) return '—';
  return String(value);
}

export function formatRand(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
