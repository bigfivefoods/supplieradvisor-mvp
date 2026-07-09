'use client';

import { Star } from 'lucide-react';

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readOnly?: boolean;
  className?: string;
  /** Accessible label prefix */
  label?: string;
};

const SIZE_CLASS = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
} as const;

/**
 * Interactive or display-only 1–5 star rating.
 */
export function StarRating({
  value,
  onChange,
  size = 'md',
  readOnly = false,
  className = '',
  label = 'Rating',
}: StarRatingProps) {
  const interactive = !readOnly && typeof onChange === 'function';
  const stars = [1, 2, 3, 4, 5];
  const iconClass = SIZE_CLASS[size];

  return (
    <div
      className={`inline-flex items-center gap-0.5 ${className}`}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={
        interactive ? label : `${label}: ${value} out of 5`
      }
    >
      {stars.map((n) => {
        const filled = n <= Math.round(value);
        if (interactive) {
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              onClick={() => onChange?.(n)}
              className="p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00b4d8]"
            >
              <Star
                className={`${iconClass} transition-colors ${
                  filled
                    ? 'fill-amber-400 text-amber-400'
                    : 'fill-none text-neutral-300'
                }`}
              />
            </button>
          );
        }
        return (
          <Star
            key={n}
            className={`${iconClass} ${
              filled
                ? 'fill-amber-400 text-amber-400'
                : 'fill-none text-neutral-300'
            }`}
          />
        );
      })}
    </div>
  );
}

export function formatAvgRating(avg: number | null | undefined): string {
  if (avg == null || !Number.isFinite(avg)) return '—';
  return avg.toFixed(1);
}
