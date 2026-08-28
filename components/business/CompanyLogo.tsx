'use client';

import { useState } from 'react';
import { Building2, User } from 'lucide-react';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const SIZE: Record<
  Size,
  { box: string; icon: string; text: string }
> = {
  xs: { box: 'h-7 w-7 rounded-lg', icon: 'h-3.5 w-3.5', text: 'text-[10px]' },
  sm: { box: 'h-9 w-9 rounded-xl', icon: 'h-4 w-4', text: 'text-xs' },
  md: { box: 'h-11 w-11 rounded-xl', icon: 'h-5 w-5', text: 'text-sm' },
  lg: { box: 'h-14 w-14 rounded-2xl', icon: 'h-6 w-6', text: 'text-base' },
};

function initialsFromName(name?: string | null): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

/**
 * Company mark for cards / lists / directory.
 * Always prefers `logo_url` when present; falls back to initials, then icon.
 */
export default function CompanyLogo({
  logoUrl,
  name,
  size = 'md',
  className = '',
  alt,
  variant = 'company',
}: {
  logoUrl?: string | null;
  name?: string | null;
  size?: Size;
  className?: string;
  alt?: string;
  variant?: 'company' | 'person';
}) {
  const [broken, setBroken] = useState(false);
  const dims = SIZE[size];
  const person = variant === 'person';
  const shape = person ? dims.box.replace(/rounded-\w+/g, 'rounded-full') : dims.box;
  const src = logoUrl && String(logoUrl).trim() && !broken ? String(logoUrl).trim() : null;
  const label = alt || name || (person ? 'Person' : 'Company');

  if (src) {
    return (
      <div
        className={`${shape} shrink-0 overflow-hidden border border-neutral-200 bg-white flex items-center justify-center ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          className="h-full w-full object-contain p-0.5"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      </div>
    );
  }

  const initials = initialsFromName(name);
  if (initials && initials !== '?') {
    return (
      <div
        className={`${shape} shrink-0 border border-[#00b4d8]/20 bg-gradient-to-br from-[#00b4d8]/10 to-[#0077b6]/5 flex items-center justify-center font-black text-[#0077b6] ${dims.text} ${className}`}
        aria-label={label}
        title={label}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`${shape} shrink-0 border border-neutral-200 bg-neutral-50 flex items-center justify-center ${className}`}
      aria-label={label}
    >
      {person ? (
        <User className={`${dims.icon} text-[#00b4d8]`} />
      ) : (
        <Building2 className={`${dims.icon} text-[#00b4d8]`} />
      )}
    </div>
  );
}
