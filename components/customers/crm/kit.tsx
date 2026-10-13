'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Search, type LucideIcon } from 'lucide-react';
import { CRM_SAMPLE_FLAG, type CrmTimelineItem } from '@/lib/customers/crm-preview';

export function useCrmSampleBook() {
  const enabled = () => {
    try {
      return sessionStorage.getItem(CRM_SAMPLE_FLAG) === '1';
    } catch {
      return false;
    }
  };
  const enable = () => {
    try {
      sessionStorage.setItem(CRM_SAMPLE_FLAG, '1');
    } catch {
      /* ignore */
    }
    window.location.reload();
  };
  const disable = () => {
    try {
      sessionStorage.removeItem(CRM_SAMPLE_FLAG);
    } catch {
      /* ignore */
    }
    window.location.reload();
  };
  return { enabled, enable, disable };
}

export function useCrmKeys(handlers: {
  onSearch?: () => void;
  onCreate?: () => void;
  onEscape?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const current = handlersRef.current;
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (event.key === 'Escape') {
        current.onEscape?.();
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === '/' && current.onSearch) {
        event.preventDefault();
        current.onSearch();
      } else if ((event.key === 'n' || event.key === 'N') && current.onCreate) {
        event.preventDefault();
        current.onCreate();
      } else if (event.key === 'ArrowDown' && current.onNext) {
        event.preventDefault();
        current.onNext();
      } else if (event.key === 'ArrowUp' && current.onPrev) {
        event.preventDefault();
        current.onPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function CrmKeysHint() {
  return (
    <p className="mb-3 text-xs text-slate-600">
      <kbd className="crm-kbd">/</kbd> search
      <span className="mx-2 text-slate-300">·</span>
      <kbd className="crm-kbd">n</kbd> new
      <span className="mx-2 text-slate-300">·</span>
      <kbd className="crm-kbd">esc</kbd> close
    </p>
  );
}

export function CrmSampleBanner({ onHide }: { onHide: () => void }) {
  return (
    <div
      className="crm-rise mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#00b4d8]/40 bg-[#00b4d8]/10 px-4 py-3"
      role="status"
    >
      <p className="text-sm font-semibold text-slate-900">
        Sample book for the walkthrough. Nothing is written to SupplierAdvisor®.
      </p>
      <button type="button" className="btn-secondary !min-h-11 !px-4 !py-2 text-sm" onClick={onHide}>
        Hide sample
      </button>
    </div>
  );
}

export function CrmSkeleton({
  variant = 'rows',
}: {
  variant?: 'rows' | 'metrics' | 'kanban';
}) {
  if (variant === 'metrics') {
    return (
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="crm-skeleton h-24 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (variant === 'kanban') {
    return (
      <div className="flex gap-3 overflow-hidden" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="crm-skeleton h-80 w-[280px] shrink-0 rounded-3xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="crm-skeleton h-16 rounded-2xl" />
      ))}
    </div>
  );
}

export function CrmEmpty({
  icon: Icon,
  title,
  body,
  action,
  onSample,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
  onSample?: () => void;
}) {
  return (
    <div className="crm-rise rounded-3xl border border-dashed border-[#00b4d8]/40 bg-white px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00b4d8]/10 text-[#0077b6]">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="text-lg font-black tracking-tight text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">{body}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {action}
        {onSample ? (
          <button type="button" className="btn-secondary !px-4 !py-2.5 text-sm" onClick={onSample}>
            Preview a sample book
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function CrmSearch({
  value,
  onChange,
  placeholder,
  label,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  inputRef?: React.Ref<HTMLInputElement | null>;
}) {
  const id = useId();
  return (
    <div className="relative min-w-[200px] flex-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        aria-hidden
      />
      <input
        ref={inputRef as React.Ref<HTMLInputElement> | undefined}
        id={id}
        className="input min-h-11 w-full !py-2.5 !pl-9 !text-sm"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
    </div>
  );
}

export function CrmTimeline({ items }: { items: CrmTimelineItem[] }) {
  if (!items.length) {
    return <p className="text-sm text-slate-600">No activity on this record yet.</p>;
  }
  return (
    <ol className="crm-timeline">
      {items.map((item) => (
        <li key={item.id} className={`crm-timeline-item is-${item.tone}`}>
          <time className="text-xs font-semibold text-slate-500">{item.at}</time>
          <p className="text-sm font-bold text-slate-900">{item.title}</p>
          {item.detail ? <p className="text-sm leading-snug text-slate-600">{item.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function customerTimelineFrom360(row: {
  name: string;
  events?: Array<{ at: string; type: string; summary: string }>;
  invoices?: Array<{ number: string; status: string; total: number; due?: string | null }>;
  last_visit?: { date: string; title: string } | null;
  next_session?: { date: string; title: string } | null;
}): CrmTimelineItem[] {
  const items: CrmTimelineItem[] = [];
  for (const event of row.events || []) {
    items.push({
      id: `e-${event.at}-${event.summary}`,
      at: String(event.at).slice(0, 10),
      title: event.type.replace(/_/g, ' '),
      detail: event.summary,
      tone: 'neutral',
    });
  }
  if (row.last_visit) {
    items.push({
      id: 'visit',
      at: row.last_visit.date,
      title: 'Last visit',
      detail: row.last_visit.title,
      tone: 'brand',
    });
  }
  if (row.next_session) {
    items.push({
      id: 'next',
      at: row.next_session.date,
      title: 'Next on the diary',
      detail: row.next_session.title,
      tone: 'good',
    });
  }
  for (const inv of (row.invoices || []).slice(0, 4)) {
    items.push({
      id: `inv-${inv.number}`,
      at: inv.due || '—',
      title: `${inv.number} · ${inv.status}`,
      detail: `Invoice on the SupplierAdvisor® book`,
      tone: inv.status === 'overdue' ? 'warn' : 'neutral',
    });
  }
  items.sort((a, b) => b.at.localeCompare(a.at));
  return items;
}
