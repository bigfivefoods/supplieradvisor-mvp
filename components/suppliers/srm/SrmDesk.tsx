'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpDown,
  Columns3,
  Inbox,
  LayoutList,
  List,
  Search,
  type LucideIcon,
} from 'lucide-react';
import {
  formatWhen,
  SRM_VIEWS,
  type SrmView,
  type TimelineEvent,
} from '@/lib/suppliers/srm-desk';

/** Visible focus ring. Brand cyan stays #00b4d8 — it is the ring, not a darkened fill. */
export const srmFocus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00b4d8] focus-visible:ring-offset-2';

const VIEW_ICON: Record<SrmView, LucideIcon> = {
  list: List,
  table: LayoutList,
  board: Columns3,
};

export function SrmViewSwitch({
  value,
  onChange,
  views = ['list', 'table', 'board'],
  label = 'Layout',
}: {
  value: SrmView;
  onChange: (view: SrmView) => void;
  views?: readonly SrmView[];
  label?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-2xl border border-slate-200 bg-white p-1"
    >
      {SRM_VIEWS.filter((view) => views.includes(view.id)).map((view) => {
        const Icon = VIEW_ICON[view.id];
        const active = value === view.id;
        return (
          <button
            key={view.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(view.id)}
            className={`${srmFocus} inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors ${
              active
                ? 'bg-[#00b4d8] text-slate-950'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {view.label}
          </button>
        );
      })}
    </div>
  );
}

export function SrmSearch({
  value,
  onChange,
  placeholder = 'Search',
  label = 'Search',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  const id = useId();
  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${srmFocus} input w-full !py-2.5 !pl-10 !text-sm`}
        type="search"
        autoComplete="off"
      />
    </div>
  );
}

export function SrmSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div className="min-w-[9.5rem]">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${srmFocus} input !w-auto !py-2.5 !text-sm`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SrmToolbar({
  children,
  meta,
}: {
  children: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">{children}</div>
      {meta ? <div className="text-xs font-medium text-slate-600">{meta}</div> : null}
    </div>
  );
}

export function SrmEmpty({
  icon: Icon = Inbox,
  title,
  description,
  actionHref,
  actionLabel,
  onAction,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="srm-rise rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
      <Icon className="mx-auto mb-3 h-10 w-10 text-slate-400" aria-hidden />
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">
        {description}
      </p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className={`${srmFocus} btn-primary mt-5 !px-5 !py-2.5 text-sm`}>
          {actionLabel}
        </Link>
      ) : null}
      {onAction && actionLabel && !actionHref ? (
        <button
          type="button"
          onClick={onAction}
          className={`${srmFocus} btn-primary mt-5 !px-5 !py-2.5 text-sm`}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function SrmSkeleton({
  rows = 4,
  variant = 'list',
}: {
  rows?: number;
  variant?: 'list' | 'cards' | 'table';
}) {
  const items = Array.from({ length: rows }, (_, i) => i);
  if (variant === 'cards') {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading</span>
        {items.map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-3xl bg-slate-200/80" />
        ))}
      </div>
    );
  }
  if (variant === 'table') {
    return (
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white" aria-busy="true">
        <span className="sr-only">Loading</span>
        {items.map((i) => (
          <div key={i} className="flex gap-3 border-b border-slate-100 px-4 py-4 last:border-0">
            <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-1/5 animate-pulse rounded bg-slate-100" />
            <div className="ml-auto h-4 w-16 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white" aria-busy="true">
      <span className="sr-only">Loading</span>
      {items.map((i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-4">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-slate-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-40 max-w-full animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-56 max-w-full animate-pulse rounded bg-slate-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SrmPanel({
  title,
  description,
  action,
  children,
  className = '',
  id,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`srm-rise min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {title || action || description ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-black text-slate-900">{title}</h2> : null}
            {description ? (
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function SrmTimeline({
  events,
  title = 'Activity',
  empty = 'Nothing recorded on this record yet.',
}: {
  events: readonly TimelineEvent[];
  title?: string;
  empty?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
      <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      {events.length === 0 ? (
        <p className="text-xs text-slate-600">{empty}</p>
      ) : (
        <ol className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="relative pl-4">
              <span
                className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-[#00b4d8]"
                aria-hidden
              />
              <p className="text-xs font-semibold text-slate-900">{event.title}</p>
              <p className="text-[11px] text-slate-600">
                <time dateTime={event.at}>{formatWhen(event.at)}</time>
                {event.detail ? ` · ${event.detail}` : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function SrmMenu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={`${srmFocus} inline-flex min-h-9 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-[#00b4d8]`}
      >
        {label}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-[11rem] rounded-2xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          <div
            onClick={() => setOpen(false)}
            className="flex flex-col"
          >
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SrmMenuItem({
  children,
  onClick,
  href,
  tone = 'default',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: 'default' | 'danger';
}) {
  const cls = `${srmFocus} flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold ${
    tone === 'danger'
      ? 'text-rose-700 hover:bg-rose-50'
      : 'text-slate-800 hover:bg-slate-50'
  }`;
  if (href) {
    return (
      <Link href={href} role="menuitem" className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" role="menuitem" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export function SrmBoard<T>({
  columns,
  items,
  columnOf,
  renderItem,
  keyOf,
  labelOf,
}: {
  columns: readonly { id: string; label: string }[];
  items: readonly T[];
  columnOf: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  keyOf?: (item: T) => string | number;
  labelOf?: (column: { id: string; label: string }, count: number) => string;
}) {
  return (
    <div className="srm-scroll flex gap-3 overflow-x-auto pb-2" role="list">
      {columns.map((column) => {
        const rows = items.filter((item) => columnOf(item) === column.id);
        return (
          <section
            key={column.id}
            className="w-[min(100%,18.5rem)] shrink-0 rounded-3xl border border-slate-200 bg-slate-50/70"
            aria-label={labelOf ? labelOf(column, rows.length) : `${column.label}, ${rows.length}`}
          >
            <header className="flex items-center justify-between gap-2 px-3 py-3">
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-700">
                {column.label}
              </h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black tabular-nums text-slate-700">
                {rows.length}
              </span>
            </header>
            <div className="space-y-2 px-2 pb-3">
              {rows.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-slate-500">Clear</p>
              ) : (
                rows.map((item, index) => (
                  <div key={keyOf ? keyOf(item) : index}>{renderItem(item)}</div>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function SrmSortButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${srmFocus} inline-flex min-h-10 items-center gap-1.5 rounded-2xl border px-3 text-xs font-bold ${
        active
          ? 'border-[#00b4d8] bg-[#00b4d8]/10 text-slate-900'
          : 'border-slate-200 bg-white text-slate-700 hover:border-[#00b4d8]'
      }`}
    >
      <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}
