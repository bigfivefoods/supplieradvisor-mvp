'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, CreditCard, Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useApiAuth } from '@/lib/client/use-api-auth';

type Hosted = {
  url: string;
  status?: number;
  contentType?: string | null;
  bytes?: number;
  startsOk?: boolean;
  matchesLocal?: boolean;
  error?: string;
};

type ApplePaySnap = {
  payout_ready?: boolean;
  hostingOk?: boolean;
  applePayReady?: boolean;
  cert?: { expired?: boolean; note?: string; notAfter?: string };
  hosted?: Hosted[];
  paystack?: {
    secretConfigured?: boolean;
    registeredDomains?: string[];
    listError?: string | null;
  };
  nextSteps?: string[];
};

export function AdvisorApplePaySetup() {
  const { companyId, withAuthJson } = useApiAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [snap, setSnap] = useState<ApplePaySnap | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    const data = await withAuthJson<ApplePaySnap>(
      `/api/advisors/apple-pay?companyId=${companyId}`
    );
    setSnap(data);
  }, [companyId, withAuthJson]);

  useEffect(() => {
    let cancelled = false;
    void load()
      .catch((e) => {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : 'Could not load Apple Pay');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const register = async () => {
    if (!companyId) return;
    setBusy(true);
    try {
      const data = await withAuthJson<ApplePaySnap>('/api/advisors/apple-pay', {
        method: 'POST',
        jsonBody: { companyId, action: 'register' },
      });
      setSnap(data);
      if (data.applePayReady) {
        toast.success('Apple Pay domain registered');
      } else {
        toast.message(
          data.cert?.expired
            ? 'Hosting is fine — Paystack must renew the Apple certificate'
            : 'Register attempted. Check the steps below.'
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Register failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-white p-5 dark:border-yellow-500/30 dark:from-yellow-950/40 dark:to-slate-950">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[#E8E830] p-2 text-slate-900">
          <Smartphone className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-yellow-800 dark:text-yellow-300">
            Apple Pay · Paystack
          </p>
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            Members pay on Safari / iPhone
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Card, EFT and Apple Pay all go through Paystack. Money settles to
            your connected payout bank (1% admin from the settlement — members
            pay the listed price). Apple Pay only appears on Apple devices over
            HTTPS on supplieradvisor.com.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking Apple Pay…
        </p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm">
          <Step
            ok={snap?.payout_ready === true}
            label="Payout bank connected"
            detail="Required before any card or Apple Pay sale. Set this on Accounts."
          />
          <Step
            ok={snap?.hostingOk === true}
            label="Domain association file hosted"
            detail="Apple checks /.well-known/apple-developer-merchantid-domain-association"
          />
          <Step
            ok={(snap?.paystack?.registeredDomains || []).length > 0}
            label="Domain registered with Paystack"
            detail={
              (snap?.paystack?.registeredDomains || []).join(', ') ||
              snap?.paystack?.listError ||
              'Not listed yet'
            }
          />
          <Step
            ok={snap?.cert?.expired !== true}
            label="Apple broker certificate"
            detail={snap?.cert?.note || '—'}
          />
        </ul>
      )}

      {(snap?.nextSteps || []).length ? (
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">
          {snap!.nextSteps!.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !companyId}
          onClick={() => void register()}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CreditCard className="h-3.5 w-3.5" />
          )}
          Register domains with Paystack
        </button>
        <a
          href="https://dashboard.paystack.com/#/settings/apple-pay"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        >
          Paystack Apple Pay settings
        </a>
        <a
          href="https://dashboard.paystack.com/#/settings/preferences"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        >
          Enable in Preferences
        </a>
      </div>
    </section>
  );
}

function Step({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
      <span
        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
          ok ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
        }`}
      >
        {ok ? <Check className="h-3 w-3" /> : null}
      </span>
      <span>
        <span className="font-bold text-slate-900 dark:text-white">{label}</span>
        <span className="mt-0.5 block text-[12px] text-slate-500">{detail}</span>
      </span>
    </li>
  );
}
