'use client';

import { resolveAdvisorEngagement } from '@/lib/services/advisor-workforce';

export function AdvisorEngagementField({
  value,
  onChange,
  disabled,
  compact,
}: {
  value?: string | null;
  onChange: (v: 'employed' | 'contractor') => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const current = resolveAdvisorEngagement({ engagement: value });
  return (
    <fieldset className={compact ? 'space-y-1' : 'space-y-2 col-span-full'}>
      <legend className="text-[10px] font-black uppercase tracking-wider text-slate-500">
        How they work here
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <label
          className={`flex cursor-pointer gap-2 rounded-xl border p-3 text-sm ${
            current === 'contractor'
              ? 'border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/40'
              : 'border-slate-200 dark:border-slate-700'
          }`}
        >
          <input
            type="radio"
            className="mt-0.5"
            disabled={disabled}
            checked={current === 'contractor'}
            onChange={() => onChange('contractor')}
          />
          <span>
            <span className="block font-bold">Contract</span>
            <span className="mt-0.5 block text-[11px] text-slate-500">
              Independent contractor. They use the phone work app to run
              their diary, see booked slots, and book members with them.
            </span>
          </span>
        </label>
        <label
          className={`flex cursor-pointer gap-2 rounded-xl border p-3 text-sm ${
            current === 'employed'
              ? 'border-sky-400 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/40'
              : 'border-slate-200 dark:border-slate-700'
          }`}
        >
          <input
            type="radio"
            className="mt-0.5"
            disabled={disabled}
            checked={current === 'employed'}
            onChange={() => onChange('employed')}
          />
          <span>
            <span className="block font-bold">Permanent</span>
            <span className="mt-0.5 block text-[11px] text-slate-500">
              Permanent / employed staff. They join the company desktop (B2B)
              and People.
            </span>
          </span>
        </label>
      </div>
    </fieldset>
  );
}
