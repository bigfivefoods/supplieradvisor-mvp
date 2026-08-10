'use client';

import { BadgeCheck } from 'lucide-react';

type Props = {
  verified?: boolean;
  provider?: string | null;
  name?: string | null;
  className?: string;
};

/** Compact trust badge for portals / desk lists */
export function VerifiedBadge({
  verified,
  provider,
  name,
  className = '',
}: Props) {
  if (!verified) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${className}`}
      title={
        name
          ? `Verified${provider ? ` via ${provider}` : ''}: ${name}`
          : `Identity verified${provider ? ` via ${provider}` : ''}`
      }
    >
      <BadgeCheck className="w-3 h-3" />
      Verified
    </span>
  );
}
