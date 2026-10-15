'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { formatRandFromCents, formatSastDate } from '@/lib/fleet/format';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  MinusCircle,
  XCircle,
} from 'lucide-react';

/** FleetAdvisor® brand. Fills stay this cyan. Text on those fills stays navy. */
export const FLEET_CYAN = '#00b4d8';
export const FLEET_NAVY = '#0f172a';
export const FLEET_DEEP = '#0077b6';
export const FLEET_SURFACE = '#f8fafc';
export const FLEET_LINE = '#e2e8f0';

export const fleetCard =
  'overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm';
export const fleetCardPad = `${fleetCard} p-4 sm:p-5`;
export const fleetNested =
  'rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm';
export const fleetBtn =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99] disabled:opacity-50';
export const fleetBtnSm =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-2xl bg-[#00b4d8] px-3 text-xs font-black text-[#0f172a] shadow-sm transition active:scale-[0.99] disabled:opacity-50';
export const fleetGhost =
  'inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 shadow-sm transition hover:border-slate-300 active:scale-[0.99]';
export const fleetGhostSm =
  'inline-flex min-h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 shadow-sm transition hover:border-slate-300';
export const fleetField =
  'mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30';
export const fleetLabel = 'block text-xs font-bold text-slate-700';
/** Deep cyan on white. Cyan #00b4d8 text on white is 2.46:1. */
export const fleetLink = 'text-sm font-bold text-[#0077b6]';
export const fleetChipOn =
  'shrink-0 rounded-2xl bg-[#00b4d8] px-3 py-2 text-xs font-black text-[#0f172a] shadow-sm';
export const fleetChipOff =
  'shrink-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300';
export const fleetFocus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00b4d8] focus-visible:ring-offset-2';

export function FleetKicker({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0077b6]">
      {children}
    </p>
  );
}

export function FleetPageHead({
  title,
  detail,
  actions,
  illustration = false,
  testId,
}: {
  title: string;
  detail?: string;
  actions?: ReactNode;
  illustration?: boolean;
  testId?: string;
}) {
  return (
    <header
      className="sticky top-0 z-20 -mx-4 border-b border-[#e2e8f0] bg-[#f8fafc]/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-3xl sm:border sm:bg-white sm:px-5 sm:py-4 sm:shadow-sm lg:sticky"
      data-testid={testId}
    >
      <div className="mb-3 h-1.5 rounded-full bg-[#00b4d8]" aria-hidden />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <FleetKicker>FleetAdvisor®</FleetKicker>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[#0f172a]">{title}</h1>
          {detail ? (
            <p className="mt-1 max-w-2xl text-sm leading-snug text-slate-600">{detail}</p>
          ) : null}
          {illustration ? (
            <p className="mt-2 inline-flex rounded-full bg-[#00b4d8] px-2.5 py-1 text-[11px] font-black text-[#0f172a]">
              Illustration · sample data
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function FleetStat({
  value,
  label,
  hint,
  testId,
}: {
  value: ReactNode;
  label: string;
  hint?: string;
  testId?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm" data-testid={testId}>
      <p className="truncate text-xl font-black tabular-nums text-slate-900">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function FleetSection({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-black text-slate-900">{title}</h2>
          {hint ? <p className="mt-0.5 text-xs leading-snug text-slate-600">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

export function FleetEmpty({
  title,
  hint,
  icon,
  action,
  illustration,
  testId,
}: {
  title: string;
  hint: string;
  icon?: ReactNode;
  action: ReactNode;
  illustration?: ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center shadow-sm"
      data-testid={testId}
    >
      {icon ? (
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-black text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-snug text-slate-500">{hint}</p>
      {illustration ? <div className="mx-auto mt-4 max-w-lg text-left">{illustration}</div> : null}
      <div className="mt-4 flex justify-center">{action}</div>
    </div>
  );
}

export function FleetLoading({ label = 'Loading FleetAdvisor®…' }: { label?: string }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite" data-testid="fleet-loading">
      <span className="sr-only">{label}</span>
      <div className="h-24 animate-pulse rounded-3xl bg-slate-200 motion-reduce:animate-none" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="h-20 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none" />
        <div className="h-20 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none" />
        <div className="h-20 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none" />
        <div className="h-20 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none" />
      </div>
      <div className="h-40 animate-pulse rounded-3xl bg-slate-200 motion-reduce:animate-none" />
    </div>
  );
}

export function FleetError({
  title = 'FleetAdvisor® could not load this page',
  hint = 'Reload the page. If this keeps happening, the desk will show database setup pending until the fleet tables exist.',
  action,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-red-200 bg-white px-4 py-8 text-center shadow-sm" role="alert" data-testid="fleet-error">
      <p className="inline-flex items-center gap-2 text-sm font-black text-red-800">
        <XCircle className="h-4 w-4" aria-hidden />
        {title}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-snug text-slate-600">{hint}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

const PILL_TONE = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warn: 'border-orange-200 bg-orange-50 text-orange-950',
  bad: 'border-red-200 bg-red-50 text-red-900',
  muted: 'border-slate-200 bg-slate-50 text-slate-700',
} as const;

export function FleetStatusPill({
  tone,
  children,
}: {
  tone: keyof typeof PILL_TONE;
  children: ReactNode;
}) {
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'warn' ? AlertTriangle : tone === 'bad' ? XCircle : CircleDashed;
  return (
    <span className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${PILL_TONE[tone]}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

export function FleetSoonChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
      <CircleDashed className="h-3.5 w-3.5" aria-hidden />
      Launching soon
    </span>
  );
}

export function FleetCompletenessChip({
  completeness,
  missing,
}: {
  completeness: 'complete' | 'partial' | 'none';
  missing?: string[];
}) {
  if (completeness === 'none') {
    return <FleetStatusPill tone="muted">Not enough data</FleetStatusPill>;
  }
  const text = missing?.length ? missing.join(', ') : '';
  if (completeness === 'partial') {
    return (
      <span title={text || 'Some cost layers are missing'}>
        <FleetStatusPill tone="warn">Partial</FleetStatusPill>
      </span>
    );
  }
  return <FleetStatusPill tone="ok">Complete</FleetStatusPill>;
}

export function FleetVariancePill({
  status,
}: {
  status: 'on_target' | 'over' | 'under' | 'no_target';
}) {
  if (status === 'over') return <FleetStatusPill tone="bad">Over target</FleetStatusPill>;
  if (status === 'under') return <FleetStatusPill tone="ok">Under target</FleetStatusPill>;
  if (status === 'on_target') return <FleetStatusPill tone="ok">On target</FleetStatusPill>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600">
      <MinusCircle className="h-3.5 w-3.5" aria-hidden />
      No target
    </span>
  );
}

export function FleetIllustration({ children }: { children: ReactNode }) {
  return (
    <figure className="overflow-hidden rounded-3xl border border-[#e2e8f0] bg-[#f8fafc]">
      <figcaption className="border-b border-[#e2e8f0] bg-[#00b4d8] px-3 py-2 text-xs font-black text-[#0f172a]">
        Illustration · sample data
      </figcaption>
      <div className="p-3">{children}</div>
    </figure>
  );
}

export function FleetMoney({ cents }: { cents: number | null | undefined }) {
  return <span className="tabular-nums">{formatRandFromCents(cents)}</span>;
}

export function FleetDate({ value }: { value: string | null | undefined }) {
  return <span className="tabular-nums">{formatSastDate(value)}</span>;
}

export function FleetSegmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string) => void;
}) {
  return (
    <div className="min-w-0" role="tablist" aria-label={label}>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {options.map((option) => {
          const on = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={`${on ? fleetChipOn : fleetChipOff} ${fleetFocus} min-h-11`}
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FleetTable({
  columns,
  rows,
  testId,
}: {
  columns: string[];
  rows: Array<{ id: string; cells: ReactNode[]; card: ReactNode }>;
  testId?: string;
}) {
  return (
    <div data-testid={testId}>
      <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm sm:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                {row.cells.map((cell, index) => (
                  <td key={index} className="px-3 py-3 align-middle tabular-nums text-slate-800">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <article key={row.id} className={fleetCardPad}>
            {row.card}
          </article>
        ))}
      </div>
    </div>
  );
}

export function FleetDrawer({
  open,
  title,
  onClose,
  children,
  testId,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previous = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>('button, [href], input, select, textarea');
    focusable?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-stretch sm:justify-end" data-testid={testId}>
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 shadow-xl sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-black text-[#0f172a]">
            {title}
          </h2>
          <button type="button" className={`${fleetGhost} ${fleetFocus}`} onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FleetBanner({
  tone,
  children,
  testId,
}: {
  tone: 'info' | 'pending';
  children: ReactNode;
  testId?: string;
}) {
  const cls =
    tone === 'pending'
      ? 'border-slate-200 bg-white text-slate-800'
      : 'border-[#0077b6]/30 bg-white text-[#0f172a]';
  return (
    <p role="status" className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold ${cls}`} data-testid={testId}>
      {children}
    </p>
  );
}
