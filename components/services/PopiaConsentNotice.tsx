'use client';

import Link from 'next/link';
import { Shield } from 'lucide-react';

type Props = {
  /** compact banner for portals; field for desk forms */
  variant?: 'banner' | 'field';
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  required?: boolean;
  className?: string;
  brand?: string;
};

/**
 * Light POPIA notice for Advisor desks and patient portals.
 * Not legal advice — points to platform privacy policy.
 */
export function PopiaConsentNotice({
  variant = 'banner',
  checked,
  onChange,
  required,
  className = '',
  brand,
}: Props) {
  if (variant === 'field') {
    return (
      <label
        className={`flex items-start gap-2 text-[12px] text-slate-600 dark:text-slate-300 ${className}`}
      >
        <input
          type="checkbox"
          className="mt-0.5"
          checked={!!checked}
          onChange={(e) => onChange?.(e.target.checked)}
          required={required}
        />
        <span>
          {required ? <span className="text-rose-600 font-bold">* </span> : null}
          I confirm this person has been informed that their personal
          information will be processed for care, scheduling and messaging under
          POPIA, and they consent (or a lawful basis applies). See{' '}
          <Link
            href="/privacy"
            className="font-semibold text-sky-700 dark:text-sky-300 underline"
            target="_blank"
          >
            Privacy
          </Link>
          .
        </span>
      </label>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60 px-3 py-2.5 flex gap-2 text-[11px] text-slate-600 dark:text-slate-300 ${className}`}
    >
      <Shield className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
      <p>
        <strong className="text-slate-800 dark:text-slate-100">
          Privacy (POPIA)
        </strong>
        {brand ? ` · ${brand}` : ''}: your details are used to run bookings,
        care notes and messages for this practice. You can ask the practice
        about access or correction. Platform policy:{' '}
        <Link
          href="/privacy"
          className="font-semibold text-sky-700 dark:text-sky-300 underline"
        >
          /privacy
        </Link>
        .
      </p>
    </div>
  );
}
