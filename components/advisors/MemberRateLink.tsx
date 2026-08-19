'use client';

import Link from 'next/link';
import { MessageSquareHeart } from 'lucide-react';

export function MemberRateLink({
  href,
  submitted,
  label = 'Rate (optional)',
  className = 'text-emerald-800',
}: {
  href?: string | null;
  submitted?: boolean;
  label?: string;
  className?: string;
}) {
  if (submitted) {
    return (
      <p className="mt-1 text-[11px] font-semibold text-emerald-700">
        Thanks — rating sent
      </p>
    );
  }
  if (!href) return null;
  return (
    <Link
      href={href}
      className={`mt-1 inline-flex items-center gap-1 text-[11px] font-bold underline ${className}`}
    >
      <MessageSquareHeart className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

export function publicRatePath(
  module: string,
  companyId: number | null | undefined,
  token?: string | null
): string | null {
  if (!token || companyId == null || !Number.isFinite(Number(companyId))) {
    return null;
  }
  return `/f/${module}/${companyId}/${encodeURIComponent(token)}`;
}
