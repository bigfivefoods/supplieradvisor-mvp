'use client';

import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function AdvisorExpandablePanel({
  title,
  description,
  open,
  onToggle,
  children,
  accentClass = 'border-slate-200 bg-white dark:border-slate-700 dark:bg-neutral-950',
  titleClass = 'text-slate-900 dark:text-white',
  hintClass = 'text-slate-500',
}: {
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  accentClass?: string;
  titleClass?: string;
  hintClass?: string;
}) {
  return (
    <div className={`rounded-2xl border ${accentClass}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-black ${titleClass}`}>{title}</p>
          {description ? (
            <p className={`mt-0.5 text-[11px] ${hintClass}`}>{description}</p>
          ) : null}
        </div>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          } ${titleClass}`}
        />
      </button>
      {open ? <div className="space-y-3 border-t border-black/5 px-4 pb-4 pt-3 dark:border-white/10">{children}</div> : null}
    </div>
  );
}
