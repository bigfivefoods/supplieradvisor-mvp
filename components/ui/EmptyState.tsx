'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

/**
 * Teaching empty state — one primary action.
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-neutral-200 bg-white px-6 py-14 text-center">
      <Icon className="w-10 h-10 mx-auto text-neutral-300 mb-3" />
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      <p className="mt-1.5 text-sm text-neutral-500 max-w-md mx-auto leading-relaxed">
        {description}
      </p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="btn-primary !py-2.5 !px-5 text-sm mt-5 inline-flex"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
