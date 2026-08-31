'use client';

import type { ReactNode } from 'react';
import { ChevronLeft, X } from 'lucide-react';

export function GymPwaSheet({
  title,
  onBack,
  onClose,
  children,
}: {
  title: ReactNode;
  onBack?: () => void;
  onClose?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-black text-slate-700 dark:border-white/15 dark:text-slate-200"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      ) : (
        <span />
      )}
      <h3 className="text-lg font-black text-slate-900 dark:text-white">{title}</h3>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg border border-slate-200 p-1 text-slate-700 dark:border-white/15 dark:text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>
      ) : (
        <span />
      )}
      {children}
    </div>
  );
}
