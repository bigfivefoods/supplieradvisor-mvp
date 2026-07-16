'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  Loader2,
  Rocket,
  X,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';

type Step = {
  id: string;
  day: number;
  title: string;
  body: string;
  href: string;
  cta: string;
  done: boolean;
  inferred?: boolean;
};

const DISMISS_KEY = 'sa_golden_path_dismissed';

export default function GoldenPathChecklist() {
  const { user } = usePrivy();
  const companyId = getSelectedCompanyId();
  const [steps, setSteps] = useState<Step[]>([]);
  const [pct, setPct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    let locallyDismissed = false;
    try {
      try {
        locallyDismissed =
          localStorage.getItem(`${DISMISS_KEY}_${companyId}`) === '1';
      } catch {
        /* private mode */
      }

      const res = await fetch(
        `/api/business/onboarding?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (res.ok) {
        setSteps(data.steps || []);
        setPct(Number(data.progressPercent) || 0);
        setWarning(data.warning || null);
        const done =
          (data.completedAt && Number(data.progressPercent) >= 100) ||
          Number(data.progressPercent) >= 100;
        // Keep full card hidden if 100% or user dismissed; still load for resume strip
        setHidden(Boolean(done || locallyDismissed));
      }
    } catch {
      /* optional */
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markDone = async (stepId: string) => {
    if (!companyId) return;
    try {
      const res = await fetch('/api/business/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          stepId,
          done: true,
          privyUserId: getCanonicalUserId(user?.id),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSteps(data.steps || []);
        setPct(Number(data.progressPercent) || 0);
        if (data.completedAt || Number(data.progressPercent) >= 100) {
          setHidden(true);
        }
      }
    } catch {
      /* ignore */
    }
  };

  const sync = async () => {
    if (!companyId) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/business/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'sync',
          privyUserId: getCanonicalUserId(user?.id),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSteps(data.steps || []);
        setPct(Number(data.progressPercent) || 0);
        if (Number(data.progressPercent) >= 100) setHidden(true);
      }
    } catch {
      /* ignore */
    } finally {
      setSyncing(false);
    }
  };

  const dismiss = async () => {
    setHidden(true);
    if (!companyId) return;
    try {
      localStorage.setItem(`${DISMISS_KEY}_${companyId}`, '1');
    } catch {
      /* ignore */
    }
    try {
      await fetch('/api/business/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'dismiss',
          privyUserId: getCanonicalUserId(user?.id),
        }),
      });
    } catch {
      /* ignore */
    }
  };

  const restore = () => {
    if (!companyId) return;
    try {
      localStorage.removeItem(`${DISMISS_KEY}_${companyId}`);
    } catch {
      /* ignore */
    }
    setHidden(false);
    setLoading(true);
    void load();
  };

  if (!companyId || loading) {
    if (loading && companyId) {
      return (
        <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading setup path…
        </div>
      );
    }
    return null;
  }

  // Dismissed but not finished — compact resume strip
  if (hidden && steps.length && pct < 100) {
    const next = steps.find((s) => !s.done);
    return (
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-sm text-slate-600">
          <span className="font-bold text-slate-900">Setup {pct}% complete.</span>{' '}
          {next ? (
            <>
              Next: <span className="font-semibold">{next.title}</span>
            </>
          ) : (
            'Almost done — sync to refresh.'
          )}
        </p>
        <div className="flex flex-wrap gap-2 shrink-0">
          {next && (
            <Link
              href={next.href}
              className="text-xs font-bold rounded-full bg-[#00b4d8] text-white px-3 py-1.5 hover:bg-[#0077b6]"
            >
              {next.cta}
            </Link>
          )}
          <button
            type="button"
            onClick={restore}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 underline underline-offset-2"
          >
            Show checklist
          </button>
          <Link
            href="/dashboard/guide/golden-path"
            className="text-xs font-bold text-sky-700 hover:underline"
          >
            Guide
          </Link>
        </div>
      </div>
    );
  }

  if (hidden || !steps.length) return null;

  const byDay = [1, 2, 3].map((day) => ({
    day,
    items: steps.filter((s) => s.day === day),
  }));

  return (
    <div className="mb-6 rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-white p-5 sm:p-6 shadow-sm relative">
      <button
        type="button"
        onClick={() => void dismiss()}
        className="absolute right-3 top-3 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3 mb-4 pr-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#00b4d8]/10 text-[#00b4d8]">
          <Rocket className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black text-slate-900">
            Get live in 3 days
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Golden path: profile → partners → first trade → rate → billing.
            Progress auto-detects when you complete real work.{' '}
            <Link
              href="/dashboard/guide/golden-path"
              className="font-semibold text-sky-700 hover:underline"
            >
              Full walkthrough →
            </Link>
          </p>
          <div className="mt-2 h-2 w-full max-w-xs rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00b4d8] to-[#0077b6] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <p className="text-[11px] font-semibold text-slate-500">
              {pct}% complete
            </p>
            <button
              type="button"
              onClick={() => void sync()}
              disabled={syncing}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:underline disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`}
              />
              Sync from activity
            </button>
          </div>
          {warning && (
            <p className="text-[11px] text-amber-700 mt-1">{warning}</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {byDay.map(
          ({ day, items }) =>
            items.length > 0 && (
              <div key={day}>
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 mb-2">
                  Day {day}
                </div>
                <ul className="space-y-2">
                  {items.map((s) => (
                    <li
                      key={s.id}
                      className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-2xl border px-3 py-3 ${
                        s.done
                          ? 'border-emerald-100 bg-emerald-50/40'
                          : 'border-slate-100 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {s.done ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-300 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-sm flex flex-wrap items-center gap-2">
                            {s.title}
                            {s.done && s.inferred && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 bg-sky-50 border border-sky-100 px-1.5 py-0.5 rounded-full">
                                <Sparkles className="w-2.5 h-2.5" />
                                Auto
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            {s.body}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 sm:shrink-0 pl-7 sm:pl-0">
                        <Link
                          href={s.href}
                          className="text-xs font-bold text-[#0077b6] hover:underline"
                        >
                          {s.cta}
                        </Link>
                        {!s.done && (
                          <button
                            type="button"
                            onClick={() => void markDone(s.id)}
                            className="text-xs font-bold text-slate-500 hover:text-slate-800"
                          >
                            Mark done
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
        )}
      </div>
    </div>
  );
}
