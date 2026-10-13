'use client';

import type { ReactNode } from 'react';
import CompanyLogo from '@/components/business/CompanyLogo';

export type ProfileCardChip = {
  label: string;
  className: string;
};

export type ProfileCardStat = {
  label: string;
  value: string;
};

const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00b4d8] focus-visible:ring-offset-2';

/** Selectable profile card. The button opens the record; footer actions stay outside it. */
export function ProfileCard({
  name,
  detail,
  meta,
  chips,
  stats,
  logoUrl,
  selected,
  onSelect,
  footer,
}: {
  name: string;
  detail?: string | null;
  meta?: string | null;
  chips: ProfileCardChip[];
  stats: ProfileCardStat[];
  logoUrl?: string | null;
  selected: boolean;
  onSelect: () => void;
  footer?: ReactNode;
}) {
  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition-shadow ${
        selected
          ? 'border-[#00b4d8] shadow-[0_0_0_3px_rgba(0,180,216,0.28)]'
          : 'border-slate-200 hover:border-[#00b4d8]/70'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={selected}
        aria-controls="party-profile-sheet"
        className={`${focus} flex w-full flex-col gap-3 p-4 text-left`}
      >
        <span className="flex items-start gap-3">
          <CompanyLogo logoUrl={logoUrl} name={name} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-black tracking-tight text-slate-950">
              {name}
            </span>
            {detail ? (
              <span className="mt-0.5 block truncate text-sm text-slate-600">{detail}</span>
            ) : (
              <span className="mt-0.5 block text-sm text-slate-400">Legal name not on file</span>
            )}
            <span className="mt-0.5 block truncate text-xs text-slate-500">
              {meta || 'Place not on file'}
            </span>
          </span>
        </span>
        {chips.length ? (
          <span className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <span
                key={chip.label}
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${chip.className}`}
              >
                {chip.label}
              </span>
            ))}
          </span>
        ) : null}
        <span className="grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <span key={stat.label} className="min-w-0 rounded-2xl bg-slate-50 px-2.5 py-2">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {stat.label}
              </span>
              <span className="mt-0.5 block truncate text-sm font-black text-slate-950">
                {stat.value}
              </span>
            </span>
          ))}
        </span>
      </button>
      {footer ? <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">{footer}</div> : null}
    </article>
  );
}
