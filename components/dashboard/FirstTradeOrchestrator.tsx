'use client';

/**
 * 30-minute first-trade finish line — bootstrap → send → collect → rate.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Rocket,
  Send,
  Sparkles,
  PartyPopper,
  Star,
  Wallet,
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
  activeInvoiceId?: number | null;
  activeInvoiceNumber?: string | null;
  activeInvoiceStatus?: string | null;
  finishHint?: string | null;
  signals?: {
    paidInvoiceCount?: number;
    rated?: boolean;
  };
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
  const [busy, setBusy] = useState<'boot' | 'send' | null>(null);
  const [dismissedDone, setDismissedDone] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/business/first-trade?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.plan) {
        setPlan(data.plan as Plan);
      } else setPlan(null);
      try {
        if (sessionStorage.getItem(`ft-done-${companyId}`) === '1') {
          setDismissedDone(true);
        }
      } catch {
        /* soft */
      }
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
  if (!plan) return null;

  // Success strip after complete (dismissible via session)
  if (plan.complete) {
    if (dismissedDone) return null;
    return (
      <div className="mb-4 rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-4 py-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-start gap-2 min-w-0">
            <PartyPopper className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-emerald-950">
                First trade loop closed
              </p>
              <p className="text-xs text-emerald-900/85 mt-0.5 leading-relaxed">
                Document sent, payment path live
                {plan.signals?.rated ? ', and a peer rating recorded' : ''}.
                Keep inviting partners and running the same loop.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/dashboard?ratePrompt=open"
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 text-white text-xs font-bold px-3 py-2"
            >
              <Star className="w-3.5 h-3.5" />
              Rate partners
            </Link>
            <button
              type="button"
              className="text-xs font-bold text-emerald-900/70 px-2"
              onClick={() => {
                try {
                  sessionStorage.setItem(`ft-done-${companyId}`, '1');
                } catch {
                  /* soft */
                }
                setDismissedDone(true);
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  const bootstrap = async () => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    setBusy('boot');
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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed', { id: 'ft-boot' });
    } finally {
      setBusy(null);
    }
  };

  const sendNow = async () => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    setBusy('send');
    toast.loading('Marking invoice sent…', { id: 'ft-send' });
    try {
      const res = await fetch('/api/business/first-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'send',
          invoiceId: plan.activeInvoiceId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Send failed');
      toast.success(data.message || 'Invoice sent', { id: 'ft-send' });
      if (data.plan) setPlan(data.plan as Plan);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed', { id: 'ft-send' });
    } finally {
      setBusy(null);
    }
  };

  const remainingMin = plan.steps
    .filter((s) => !s.done)
    .reduce((a, s) => a + (s.minutes || 0), 0);

  const canSend =
    plan.activeInvoiceId &&
    (plan.activeInvoiceStatus === 'draft' ||
      plan.steps.find((s) => s.id === 'send' && !s.done));

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
              Close the loop · ~{plan.targetMinutes} min first trade
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
            {plan.finishHint ||
              (plan.nextStep
                ? `Next: ${plan.nextStep.title}`
                : 'Almost there — close the loop.')}
            {plan.activeInvoiceNumber
              ? ` · ${plan.activeInvoiceNumber} (${plan.activeInvoiceStatus || '—'})`
              : ''}
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
              disabled={busy != null}
              onClick={() => void bootstrap()}
              className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-3 py-2 disabled:opacity-50"
            >
              {busy === 'boot' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Rocket className="w-3.5 h-3.5" />
              )}
              Start for me
            </button>
          ) : null}
          {canSend ? (
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void sendNow()}
              className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-2 disabled:opacity-50"
            >
              {busy === 'send' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Send invoice now
            </button>
          ) : null}
          {plan.steps.find((s) => s.id === 'send')?.done &&
          !plan.signals?.paidInvoiceCount ? (
            <Link
              href="/dashboard/customers/money"
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-950 text-xs font-bold px-3 py-2"
            >
              <Wallet className="w-3.5 h-3.5" />
              Collect on Money hub
            </Link>
          ) : null}
          {plan.nextStep && !canSend ? (
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
