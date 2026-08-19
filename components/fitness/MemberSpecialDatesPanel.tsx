'use client';

import Link from 'next/link';
import type { MemberSpecialDate } from '@/lib/fitness/member-special-dates';

function whenCopy(row: MemberSpecialDate): string {
  if (row.kind === 'joined') {
    if (row.days_until === 0) return 'Today';
    const n = Math.abs(row.days_until);
    return n === 1 ? 'Yesterday' : `${n} days ago`;
  }
  if (row.days_until === 0) return 'Today';
  if (row.days_until === 1) return 'Tomorrow';
  return `In ${row.days_until} days · ${row.on.slice(5)}`;
}

export function MemberSpecialDatesPanel({
  rows,
  title = 'Member dates',
  description = 'Birthdays, gym anniversaries, and new joiners.',
  hrefFor,
  tone = 'owner',
}: {
  rows: MemberSpecialDate[];
  title?: string;
  description?: string;
  hrefFor?: (row: MemberSpecialDate) => string | null;
  tone?: 'owner' | 'coach';
}) {
  const today = rows.filter(
    (r) => r.days_until === 0 && r.kind !== 'joined'
  );
  const upcoming = rows.filter(
    (r) => r.kind !== 'joined' && r.days_until > 0
  );
  const joined = rows.filter((r) => r.kind === 'joined');
  const dark = tone === 'coach';

  return (
    <div
      className={
        dark
          ? 'rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3'
          : 'rounded-3xl border border-yellow-200 bg-white p-4 sm:p-5 space-y-3 dark:border-yellow-800 dark:bg-slate-950'
      }
    >
      <div>
        <p
          className={
            dark
              ? 'text-sm font-black text-yellow-50'
              : 'text-sm font-black text-slate-900 dark:text-white'
          }
        >
          {title}
        </p>
        <p
          className={
            dark
              ? 'text-[11px] text-slate-400'
              : 'text-[11px] text-slate-500'
          }
        >
          {description}
        </p>
      </div>
      {rows.length === 0 ? (
        <p
          className={
            dark
              ? 'py-3 text-center text-sm text-slate-500'
              : 'py-4 text-center text-sm text-slate-500'
          }
        >
          No birthdays or gym anniversaries in the next two weeks.
        </p>
      ) : (
        <ul className="space-y-2 max-h-80 overflow-y-auto">
          {[...today, ...upcoming, ...joined].map((r) => {
            const href = hrefFor?.(r);
            const inner = (
              <>
                <div className="min-w-0">
                  <p
                    className={
                      dark
                        ? 'truncate text-sm font-bold text-yellow-50'
                        : 'truncate text-sm font-bold text-slate-900 dark:text-white'
                    }
                  >
                    {r.name}
                  </p>
                  <p
                    className={
                      dark
                        ? 'text-[11px] text-slate-400'
                        : 'text-[11px] text-slate-500'
                    }
                  >
                    {r.label} · {whenCopy(r)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                    r.days_until === 0 && r.kind !== 'joined'
                      ? 'bg-yellow-300 text-yellow-950'
                      : dark
                        ? 'bg-white/10 text-yellow-100'
                        : 'bg-yellow-50 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-100'
                  }`}
                >
                  {r.kind === 'birthday'
                    ? 'Birthday'
                    : r.kind === 'membership_anniversary'
                      ? 'Anniversary'
                      : 'New'}
                </span>
              </>
            );
            return (
              <li key={r.id}>
                {href ? (
                  <Link
                    href={href}
                    className={
                      dark
                        ? 'flex items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2'
                        : 'flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800'
                    }
                  >
                    {inner}
                  </Link>
                ) : (
                  <div
                    className={
                      dark
                        ? 'flex items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2'
                        : 'flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800'
                    }
                  >
                    {inner}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
