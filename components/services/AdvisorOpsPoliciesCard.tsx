'use client';

import { useState } from 'react';
import { Loader2, CalendarClock, Store } from 'lucide-react';
import type { ReschedulePolicy } from '@/lib/services/advisor-reschedule';
import {
  DEFAULT_RESCHEDULE_POLICY,
  normalizeReschedulePolicy,
} from '@/lib/services/advisor-reschedule';

type Props = {
  reschedule?: Partial<ReschedulePolicy> | null;
  marketplace?: {
    listed?: boolean;
    city?: string;
    blurb?: string;
  } | null;
  saving?: boolean;
  /** Fit: concurrent coaches allowed (default true) */
  allowConcurrent?: boolean;
  onSave: (payload: {
    reschedule_policy: ReschedulePolicy;
    marketplace: { listed: boolean; city: string; blurb: string };
    allow_concurrent_coach_sessions?: boolean;
  }) => Promise<void>;
  accentClass?: string;
};

/**
 * Desk ops: reschedule rules + marketplace.
 * Client payments (deposits, packs paid online) stay off-platform —
 * practices arrange money with members themselves.
 */
export function AdvisorOpsPoliciesCard({
  reschedule,
  marketplace,
  saving,
  allowConcurrent = true,
  onSave,
  accentClass = 'border-violet-200',
}: Props) {
  const [res, setRes] = useState(
    normalizeReschedulePolicy(reschedule || DEFAULT_RESCHEDULE_POLICY)
  );
  const [listed, setListed] = useState(marketplace?.listed === true);
  const [city, setCity] = useState(marketplace?.city || '');
  const [blurb, setBlurb] = useState(marketplace?.blurb || '');
  const [concurrent, setConcurrent] = useState(allowConcurrent !== false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        reschedule_policy: res,
        marketplace: { listed, city, blurb },
        allow_concurrent_coach_sessions: concurrent,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`rounded-3xl border ${accentClass} bg-white dark:bg-slate-950 p-4 sm:p-5 space-y-4`}
    >
      <div>
        <p className="text-sm font-black text-slate-900 dark:text-white">
          Ops policies · marketplace
        </p>
        <p className="text-[11px] text-slate-500">
          Reschedule rules and public listing. Member payments stay your own
          arrangement — SupplierAdvisor does not collect client fees for the
          gym.
        </p>
      </div>

      <section className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
          Floor capacity
        </p>
        <label className="flex items-start gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="mt-1"
            checked={concurrent}
            onChange={(e) => setConcurrent(e.target.checked)}
          />
          <span>
            Allow coaches to schedule at the same time
            <span className="block text-[11px] font-normal text-slate-500">
              Large floors / multiple stations — concurrent sessions are normal,
              not conflicts.
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400 flex items-center gap-1">
          <CalendarClock className="w-3.5 h-3.5" /> Reschedule
        </p>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={res.allow_self_serve}
            onChange={(e) =>
              setRes({ ...res, allow_self_serve: e.target.checked })
            }
          />
          Allow self-serve reschedule
        </label>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="text-[11px] font-bold text-slate-500">
            Free change window (hours)
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm"
              value={res.free_change_hours}
              onChange={(e) =>
                setRes({
                  ...res,
                  free_change_hours: Number(e.target.value) || 0,
                })
              }
            />
          </label>
          <label className="text-[11px] font-bold text-slate-500">
            Late fee note (ZAR, 0 = block)
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm"
              value={res.late_change_fee_zar}
              onChange={(e) =>
                setRes({
                  ...res,
                  late_change_fee_zar: Number(e.target.value) || 0,
                })
              }
            />
          </label>
        </div>
        <p className="text-[10px] text-slate-400">
          Late fee is a desk policy note only — collect outside SupplierAdvisor.
        </p>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400 flex items-center gap-1">
          <Store className="w-3.5 h-3.5" /> Marketplace
        </p>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={listed}
            onChange={(e) => setListed(e.target.checked)}
          />
          List on /marketplace/advisors
        </label>
        <input
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm"
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <textarea
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm min-h-[64px]"
          placeholder="Public blurb"
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
        />
      </section>

      <button
        type="button"
        disabled={busy || saving}
        onClick={() => void save()}
        className="rounded-xl bg-violet-600 text-white px-4 py-2 text-xs font-bold disabled:opacity-50 inline-flex items-center gap-2"
      >
        {busy || saving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : null}
        Save policies
      </button>
    </div>
  );
}
