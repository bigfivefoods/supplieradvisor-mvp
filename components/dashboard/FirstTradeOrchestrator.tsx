'use client';

/**
 * 30-minute first-trade golden path — live plan + one-click bootstrap.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Rocket,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';

type Step = {
  id: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  done: boolean;
  minutes: number;
};

type Plan = {
  targetMinutes: number;
  steps: Step[];
  progressPercent: number;
  nextStep: Step | null;
  complete: boolean;
  bootstrapReady: boolean;
};

export default function FirstTradeOrchestrator({
  compact,
}: {
  compact?: boolean;
}) {
  const companyId = getSelectedCompanyId();
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/business/first-trade?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.plan) setPlan(data.plan as Plan);
      else setPlan(null);
    } catch {
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!companyId || loading) return null;
  if (!plan || plan.complete) return null;

  const bootstrap = async () => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    setBusy(true);
    toast.loading('Creating customer + draft invoice…', { id: 'ft-boot' });
    try {
      const res = await fetch('/api/business/first-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'bootstrap',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Bootstrap failed');
      toast.success(data.message || 'Starter ready', { id: 'ft-boot' });
      if (data.plan) setPlan(data.plan as Plan);
      if (data.openHref) {
        window.location.href = data.openHref as string;
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed', { id: 'ft-boot' });
    } finally {
      setBusy(false);
    }
  };

  const remainingMin = plan.steps
    .filter((s) => !s.done)
    .reduce((a, s) => a + (s.minutes || 0), 0);

  return (
    <div
      className={`mb-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 shadow-sm ${
        compact ? 'px-3 py-3' : 'px-4 py-4'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-4 h-4 text-violet-600 shrink-0" />
            <p className="text-sm font-black text-violet-950">
              First trade in ~{plan.targetMinutes} minutes
            </p>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">
              <Clock className="w-3 h-3" />
              ~{remainingMin}m left
            </span>
            <span className="text-[11px] font-bold text-slate-500">
              {plan.progressPercent}%
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            {plan.nextStep
              ? `Next: ${plan.nextStep.title}`
              : 'Almost there — close the loop.'}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-violet-100 overflow-hidden max-w-md">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-500 transition-all"
              style={{ width: `${plan.progressPercent}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {plan.bootstrapReady ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void bootstrap()}
              className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-3 py-2 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Rocket className="w-3.5 h-3.5" />
              )}
              Start for me
            </button>
          ) : null}
          {plan.nextStep ? (
            <Link
              href={plan.nextStep.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white text-violet-900 text-xs font-bold px-3 py-2 hover:bg-violet-50"
            >
              {plan.nextStep.cta}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : null}
        </div>
      </div>

      {!compact ? (
        <ol className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {plan.steps.map((s, i) => (
            <li
              key={s.id}
              className={`rounded-xl border px-3 py-2.5 text-xs ${
                s.done
                  ? 'border-emerald-200 bg-emerald-50/80'
                  : plan.nextStep?.id === s.id
                    ? 'border-violet-300 bg-white shadow-sm'
                    : 'border-slate-100 bg-white/70'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                {s.done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <span className="text-[10px] text-slate-400">{i + 1}</span>
                )}
                {s.title}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
