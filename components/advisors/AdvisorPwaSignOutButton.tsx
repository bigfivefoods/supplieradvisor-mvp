'use client';

import {
  signOutAdvisorPwa,
  type AdvisorPwaModule,
} from '@/lib/advisors/member-pwa';

export function AdvisorPwaSignOutButton({
  module,
  publicToken,
  className,
  label = 'Sign out',
  hint = 'Sign in again as a member or coach.',
}: {
  module: AdvisorPwaModule;
  publicToken?: string | null;
  className?: string;
  label?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <button
        type="button"
        className={
          className ||
          'w-full min-h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 dark:border-white/15 dark:bg-neutral-900 dark:text-slate-100'
        }
        onClick={() => signOutAdvisorPwa({ module, publicToken })}
      >
        {label}
      </button>
      {hint ? (
        <p className="text-center text-[11px] text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
