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
  kicker,
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
  kicker?: string | null;
  chips: ProfileCardChip[];
  stats: ProfileCardStat[];
  logoUrl?: string | null;
  selected: boolean;
  onSelect: () => void;
  footer?: ReactNode;
}) {
  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-white transition duration-200 motion-safe:hover:-translate-y-0.5 ${
        selected
          ? 'border-[#00b4d8] shadow-[0_10px_30px_rgba(0,180,216,0.16)]'
          : 'border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] motion-safe:hover:border-[#00b4d8]/60 motion-safe:hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)]'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={selected}
        aria-controls="party-profile-sheet"
        aria-label={`${selected ? 'Close' : 'Open'} ${name}`}
        className={`${focus} flex w-full flex-col gap-4 p-4 text-left sm:p-5`}
      >
        <span className="flex items-start gap-3.5">
          <CompanyLogo logoUrl={logoUrl} name={name} size="lg" />
          <span className="min-w-0 flex-1">
            {kicker ? (
              <span className="block truncate text-[11px] font-bold uppercase tracking-[0.14em] text-[#0077b6]">
                {kicker}
              </span>
            ) : null}
            <span className="block truncate text-lg font-black tracking-tight text-slate-950">{name}</span>
            <span className={`mt-0.5 block truncate text-sm ${detail ? 'text-slate-600' : 'text-slate-400'}`}>
              {detail || 'Legal name not on file'}
            </span>
            <span className="mt-1 block truncate text-sm text-slate-500">{meta || 'Place not on file'}</span>
          </span>
        </span>
        {chips.length ? (
          <span className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <span
                key={chip.label}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${chip.className}`}
              >
                {chip.label}
              </span>
            ))}
          </span>
        ) : null}
        <span className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-slate-200/80">
          {stats.map((stat, index) => (
            <span key={stat.label} className="min-w-0 bg-slate-50 px-2.5 py-2.5">
              <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {stat.label}
              </span>
              <span
                className={`mt-0.5 block truncate font-black text-slate-950 ${
                  index === 0 ? 'text-base' : 'text-sm'
                }`}
              >
                {stat.value}
              </span>
            </span>
          ))}
        </span>
      </button>
      {footer ? (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3 sm:px-5">{footer}</div>
      ) : null}
    </article>
  );
}
