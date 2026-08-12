'use client';

import { CalendarPlus } from 'lucide-react';
import Link from 'next/link';

type Props = {
  title?: string;
  description?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  onPrimaryClick?: () => void;
  accentClass?: string;
};

export function AdvisorEmptyDiary({
  title = 'Nothing on the diary yet',
  description = 'Create your first slot, or open the full calendar to plan the week.',
  primaryHref,
  primaryLabel = 'Open calendar',
  secondaryHref,
  secondaryLabel,
  onPrimaryClick,
  accentClass = 'border-slate-200',
}: Props) {
  return (
    <div
      className={`rounded-3xl border border-dashed ${accentClass} bg-slate-50/80 dark:bg-slate-900/50 px-6 py-10 text-center`}
    >
      <CalendarPlus className="w-8 h-8 mx-auto text-slate-400 mb-3" />
      <p className="text-sm font-black text-slate-800 dark:text-white">
        {title}
      </p>
      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
        {description}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {onPrimaryClick ? (
          <button
            type="button"
            onClick={onPrimaryClick}
            className="rounded-full bg-violet-600 text-white px-4 py-2 text-xs font-black"
          >
            {primaryLabel}
          </button>
        ) : primaryHref ? (
          <Link
            href={primaryHref}
            className="rounded-full bg-violet-600 text-white px-4 py-2 text-xs font-black"
          >
            {primaryLabel}
          </Link>
        ) : null}
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="rounded-full border border-slate-300 dark:border-slate-600 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
