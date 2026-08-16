'use client';

import {
  GAAP_DISCLAIMER_LONG,
  GAAP_DISCLAIMER_SHORT,
  GAAP_DISCLAIMER_TITLE,
} from '@/lib/accounting/gaap-disclaimer';

export function GaapDisclaimer({
  variant = 'short',
  className = '',
}: {
  variant?: 'short' | 'long';
  className?: string;
}) {
  const body = variant === 'long' ? GAAP_DISCLAIMER_LONG : GAAP_DISCLAIMER_SHORT;
  return (
    <aside
      className={`rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:px-5 sm:py-3.5 ${className}`}
      role="note"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
        {GAAP_DISCLAIMER_TITLE}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-700">{body}</p>
    </aside>
  );
}
