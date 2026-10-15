'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock3,
  Hammer,
  Info,
  Loader2,
  X,
} from 'lucide-react';
import { formatRand, formatSastDate } from '@/lib/construction/format';

/** Same strings as TradeAdvisor® so the modules cannot drift. */
export const constructionCard =
  'overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm';
export const constructionCardPad = `${constructionCard} p-4 sm:p-5`;
export const constructionNested =
  'rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm';
export const constructionBtn =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] shadow-sm transition active:scale-[0.99] disabled:opacity-50';
export const constructionBtnSm =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-2xl bg-[#00b4d8] px-3 text-xs font-black text-[#0f172a] shadow-sm transition active:scale-[0.99] disabled:opacity-50';
export const constructionGhost =
  'inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 shadow-sm transition hover:border-slate-300 active:scale-[0.99]';
export const constructionGhostSm =
  'inline-flex min-h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 shadow-sm transition hover:border-slate-300';
export const constructionField =
  'mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00b4d8] focus:ring-2 focus:ring-[#00b4d8]/30';
export const constructionLabel = 'block text-xs font-bold text-slate-700';
export const constructionChipOn =
  'shrink-0 rounded-2xl bg-[#00b4d8] px-3 py-2 text-xs font-black text-[#0f172a] shadow-sm';
export const constructionChipOff =
  'shrink-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300';

export function ConstructionKicker({ children }: { children?: ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0f172a]">
      {children || 'ConstructionAdvisor®'}
    </p>
  );
}

export function ConstructionButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" data-primary="1" className={`${constructionBtn} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function ConstructionGhostButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`${constructionGhost} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function ConstructionPageHead({
  title,
  detail,
  actions,
  badge,
  testId,
}: {
  title: string;
  detail: string;
  actions?: ReactNode;
  badge?: string;
  testId?: string;
}) {
  return (
    <header
      className="sticky top-0 z-20 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200"
      data-testid={testId}
    >
      <div className="h-1.5 bg-[#00b4d8] text-[#0f172a]" />
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div className="min-w-0">
          <ConstructionKicker />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
            {badge ? (
              <span className="rounded-full bg-[#00b4d8] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#0f172a]">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-snug text-slate-600">{detail}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function ConstructionKpi({
  value,
  label,
  sub,
  icon,
  tint = 'bg-sky-50',
}: {
  value: ReactNode;
  label: string;
  sub?: string;
  icon?: ReactNode;
  tint?: string;
}) {
  return (
    <article className={`rounded-3xl border border-sky-100 ${tint} p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0f172a]/70">{label}</p>
        {icon ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#00b4d8] text-[#0f172a] [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-black tabular-nums text-[#0f172a]">{value}</p>
      {sub ? <p className="mt-1 text-xs font-semibold text-slate-600">{sub}</p> : null}
    </article>
  );
}

/** Bars from amounts already stored. A missing figure stays an em dash. */
export function ConstructionMoneyBars({
  rows,
}: {
  rows: Array<{ label: string; value: number | null }>;
}) {
  const finite = rows.map((row) => (row.value == null || !Number.isFinite(row.value) ? 0 : Math.max(0, row.value)));
  const peak = Math.max(1, ...finite);
  return (
    <div className="space-y-3" data-testid="money-chart">
      {rows.map((row, index) => {
        const missing = row.value == null || !Number.isFinite(row.value);
        const width = missing ? 0 : Math.max(row.value! > 0 ? 4 : 0, (finite[index] / peak) * 100);
        return (
          <div key={row.label}>
            <div className="flex items-baseline justify-between gap-3 text-xs font-bold text-[#0f172a]">
              <span>{row.label}</span>
              <span className="tabular-nums">{missing ? '—' : formatRand(row.value)}</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#00b4d8] text-[#0f172a]" style={{ width: `${Math.min(100, width)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ConstructionStat({
  value,
  label,
  tone = 'default',
  testId,
}: {
  value: ReactNode;
  label: string;
  tone?: 'default' | 'warn';
  testId?: string;
}) {
  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm"
      data-testid={testId}
    >
      <p className={`truncate text-xl font-black tabular-nums ${tone === 'warn' ? 'text-orange-800' : 'text-slate-900'}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

export function ConstructionSection({
  title,
  hint,
  icon,
  action,
  children,
  testId,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <section data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {icon ? <span className="mt-0.5 shrink-0 text-slate-800 [&>svg]:h-4 [&>svg]:w-4">{icon}</span> : null}
          <div className="min-w-0">
            <h2 className="text-base font-black text-slate-900">{title}</h2>
            {hint ? <p className="mt-0.5 text-xs leading-snug text-slate-600">{hint}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

export function ConstructionEmpty({
  title,
  hint,
  icon,
  action,
  testId,
}: {
  title: string;
  hint: string;
  icon?: ReactNode;
  action?: ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center shadow-sm"
      data-testid={testId}
    >
      {icon ? (
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-black text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-snug text-slate-500">{hint}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ConstructionLoading({
  label = 'Loading the book…',
  testId,
}: {
  label?: string;
  testId?: string;
}) {
  return (
    <div className="space-y-3" data-testid={testId} aria-busy="true">
      <div className="h-24 animate-pulse rounded-3xl bg-slate-200 motion-reduce:animate-none" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-20 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none" />
        <div className="h-20 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none" />
        <div className="h-20 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none" />
      </div>
      <p className="flex items-center justify-center gap-2 text-sm font-bold text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin text-[#0f172a] motion-reduce:animate-none" />
        {label}
      </p>
    </div>
  );
}

export function ConstructionError({
  onRetry,
  testId,
  message = 'The book could not be loaded.',
}: {
  onRetry?: () => void;
  testId?: string;
  message?: string;
}) {
  return (
    <div className={constructionCardPad} data-testid={testId} role="alert">
      <p className="flex items-center gap-2 text-sm font-black text-slate-900">
        <AlertTriangle className="h-4 w-4 text-red-700" aria-hidden />
        Something went wrong
      </p>
      <p className="mt-1 text-sm text-slate-600">{message}</p>
      {onRetry ? (
        <ConstructionButton className="mt-3" onClick={onRetry}>
          Retry
        </ConstructionButton>
      ) : null}
    </div>
  );
}

const PILL: Record<string, { label: string; className: string; icon: 'ok' | 'wait' | 'bad' | 'info' | 'neutral' }> = {
  tender: { label: 'Tender', className: 'bg-slate-100 text-slate-700', icon: 'neutral' },
  awarded: { label: 'Awarded', className: 'bg-sky-50 text-sky-950', icon: 'ok' },
  on_site: { label: 'On site', className: 'bg-emerald-50 text-emerald-900', icon: 'ok' },
  practical_completion: { label: 'Practical completion', className: 'bg-sky-50 text-sky-950', icon: 'ok' },
  final_account: { label: 'Final account', className: 'bg-orange-50 text-orange-950', icon: 'wait' },
  closed: { label: 'Closed', className: 'bg-slate-100 text-slate-700', icon: 'ok' },
  planned: { label: 'Planned', className: 'bg-slate-100 text-slate-700', icon: 'wait' },
  in_progress: { label: 'In progress', className: 'bg-sky-50 text-sky-950', icon: 'wait' },
  complete: { label: 'Complete', className: 'bg-emerald-50 text-emerald-900', icon: 'ok' },
  delayed: { label: 'Delayed', className: 'bg-orange-50 text-orange-950', icon: 'bad' },
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700', icon: 'neutral' },
  issued: { label: 'Issued', className: 'bg-sky-50 text-sky-950', icon: 'info' },
  accepted: { label: 'Accepted', className: 'bg-emerald-50 text-emerald-900', icon: 'ok' },
  declined: { label: 'Lost', className: 'bg-slate-100 text-slate-700', icon: 'neutral' },
  submitted: { label: 'Submitted', className: 'bg-orange-50 text-orange-950', icon: 'wait' },
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-900', icon: 'ok' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-900', icon: 'bad' },
  queried: { label: 'Queried', className: 'bg-orange-50 text-orange-950', icon: 'wait' },
  claimed: { label: 'Claimed', className: 'bg-sky-50 text-sky-950', icon: 'wait' },
  certified: { label: 'Certified', className: 'bg-sky-50 text-sky-950', icon: 'ok' },
  paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-900', icon: 'ok' },
  overdue: { label: 'Overdue', className: 'bg-red-50 text-red-900', icon: 'bad' },
  open: { label: 'Open', className: 'bg-orange-50 text-orange-950', icon: 'wait' },
  appointed: { label: 'Appointed', className: 'bg-emerald-50 text-emerald-900', icon: 'ok' },
  tendering: { label: 'Tendering', className: 'bg-slate-100 text-slate-700', icon: 'wait' },
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-900', icon: 'ok' },
  revoked: { label: 'Revoked', className: 'bg-slate-100 text-slate-700', icon: 'bad' },
  expired: { label: 'Expired', className: 'bg-red-50 text-red-900', icon: 'bad' },
  legacy: { label: 'Old format', className: 'bg-orange-50 text-orange-950', icon: 'wait' },
  superseded: { label: 'Superseded', className: 'bg-slate-100 text-slate-500', icon: 'info' },
  for_construction: { label: 'For construction', className: 'bg-emerald-50 text-emerald-900', icon: 'ok' },
  low: { label: 'Low', className: 'bg-slate-100 text-slate-700', icon: 'info' },
  normal: { label: 'Normal', className: 'bg-sky-50 text-sky-950', icon: 'info' },
  high: { label: 'High', className: 'bg-red-50 text-red-900', icon: 'bad' },
  near_miss: { label: 'Near miss', className: 'bg-orange-50 text-orange-950', icon: 'wait' },
  first_aid: { label: 'First aid', className: 'bg-orange-50 text-orange-950', icon: 'bad' },
  lost_time: { label: 'Lost time', className: 'bg-red-50 text-red-900', icon: 'bad' },
  property: { label: 'Property', className: 'bg-orange-50 text-orange-950', icon: 'wait' },
};

function PillIcon({ name }: { name: 'ok' | 'wait' | 'bad' | 'info' | 'neutral' }) {
  if (name === 'ok') return <CheckCircle2 className="h-3 w-3" aria-hidden />;
  if (name === 'bad') return <AlertTriangle className="h-3 w-3" aria-hidden />;
  if (name === 'wait') return <Clock3 className="h-3 w-3" aria-hidden />;
  if (name === 'info') return <Info className="h-3 w-3" aria-hidden />;
  return <Circle className="h-3 w-3" aria-hidden />;
}

export function ConstructionStatusPill({ status }: { status?: string | null }) {
  const key = String(status || 'draft').toLowerCase();
  const spec = PILL[key] || {
    label: key.replace(/_/g, ' '),
    className: 'bg-slate-100 text-slate-700',
    icon: 'neutral' as const,
  };
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${spec.className}`}>
      <PillIcon name={spec.icon} />
      {spec.label}
    </span>
  );
}

export function ConstructionMoney({ value }: { value?: number | null }) {
  return <span className="tabular-nums">{formatRand(value)}</span>;
}

export function ConstructionDate({ value }: { value?: string | null }) {
  const label = formatSastDate(value);
  return <time dateTime={value ? String(value).slice(0, 10) : undefined}>{label}</time>;
}

export function ConstructionSegmented<T extends string>({
  value,
  options,
  onChange,
  testId,
  label = 'Filter',
}: {
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (id: T) => void;
  testId?: string;
  label?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2" data-testid={testId}>
      {options.map((option) => {
        const on = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={on}
            className={on ? constructionChipOn : constructionChipOff}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ConstructionTable<T>({
  rows,
  columns,
  rowKey,
  testId,
  onRow,
}: {
  rows: T[];
  columns: Array<{ key: string; header: string; render: (row: T) => ReactNode }>;
  rowKey: (row: T) => string;
  testId?: string;
  onRow?: (row: T) => void;
}) {
  return (
    <div data-testid={testId}>
      <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm sm:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-2 font-black">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                data-row-id={rowKey(row)}
                className={onRow ? 'cursor-pointer border-t border-slate-100 hover:bg-slate-50' : 'border-t border-slate-100'}
                onClick={onRow ? () => onRow(row) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-3 align-top text-slate-800">
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 sm:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} data-row-id={rowKey(row)}>
            <button
              type="button"
              className="w-full rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm"
              onClick={onRow ? () => onRow(row) : undefined}
            >
              {columns.map((column) => (
                <div key={column.key} className="mt-1 first:mt-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{column.header}</p>
                  <div className="text-sm text-slate-900">{column.render(row)}</div>
                </div>
              ))}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ConstructionDrawer({
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
    previous.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const nodes = Array.from(
        panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ).filter((node) => !node.hasAttribute('disabled'));
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end" data-testid={testId}>
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-[#f8fafc] p-4 shadow-xl sm:h-full sm:max-h-none sm:max-w-lg sm:rounded-none sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 id={titleId} className="text-lg font-black text-slate-900">
            {title}
          </h3>
          <button type="button" className={constructionGhostSm} onClick={onClose} aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConstructionNotice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'ok' | 'warn';
}) {
  const toneClass =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'warn'
        ? 'border-orange-200 bg-orange-50 text-orange-950'
        : 'border-sky-200 bg-sky-50 text-sky-950';
  return (
    <p role="status" className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold ${toneClass}`}>
      {children}
    </p>
  );
}

export function ConstructionUnavailable({ testId }: { testId?: string }) {
  return (
    <div className={constructionCardPad} data-testid={testId || 'role-unavailable'}>
      <p className="flex items-center gap-2 text-sm font-black text-slate-900">
        <Hammer className="h-4 w-4" aria-hidden />
        Not available for your role
      </p>
      <p className="mt-1 text-sm text-slate-600">
        This screen is hidden for your role. The book you can open does not include it.
      </p>
    </div>
  );
}

export function ConstructionProgress({
  planned,
  actual,
}: {
  planned?: number | null;
  actual?: number | null;
}) {
  const plan = Math.max(0, Math.min(100, Number(planned) || 0));
  const act = Math.max(0, Math.min(100, Number(actual) || 0));
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-slate-500">
        <span>Plan {Math.round(plan)}%</span>
        <span className="tabular-nums">Actual {Math.round(act)}%</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="absolute inset-y-0 left-0 rounded-full bg-slate-300" style={{ width: `${plan}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-[#00b4d8] text-[#0f172a]" style={{ width: `${act}%` }} />
      </div>
    </div>
  );
}
