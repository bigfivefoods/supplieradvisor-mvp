'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  CreditCard,
  CheckCircle2,
  Shield,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';
import {
  SALES_SUBSCRIPTION_MONTHLY_ZAR,
  SALES_SUBSCRIPTION_TERM_MONTHS,
  SALES_SUBSCRIPTION_TOTAL_CENTS,
  SALES_SUBSCRIPTION_TOTAL_ZAR,
  type SalesSubscriptionInfo,
} from '@/lib/sales-contractor/subscription';

declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

export default function SalesSubscribePage() {
  const router = useRouter();
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const email = extractEmailFromPrivyUser(user);
  const companyId = getSelectedCompanyId();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [agreementSigned, setAgreementSigned] = useState(false);
  const [subscription, setSubscription] = useState<SalesSubscriptionInfo | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !privyUserId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        privyUserId,
      });
      const res = await fetch(`/api/sales/subscription?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load subscription');
      setCompanyName(data.companyName || '');
      setAgreementSigned(Boolean(data.agreementSigned));
      setSubscription(data.subscription || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activate = async (paystackReference: string) => {
    try {
      const res = await fetch('/api/sales/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          paystackReference,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Activation failed');
      toast.success('Subscription active — welcome to the portal!');
      setSubscription(data.subscription);
      router.push('/sales');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Activation failed');
    } finally {
      setPaying(false);
    }
  };

  const startPayment = () => {
    if (!agreementSigned) {
      toast.error('Sign the contractor agreement first');
      router.push('/sales/agreement');
      return;
    }
    if (!email) {
      toast.error('Your account needs an email for Paystack checkout');
      return;
    }
    const key = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!key) {
      toast.error(
        'Paystack is not configured. Set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY.'
      );
      return;
    }
    if (!window.PaystackPop) {
      toast.error('Paystack is still loading — try again in a moment');
      return;
    }

    setPaying(true);
    const ref = `sa-sales-sub-${companyId}-${privyUserId?.slice(-8) || 'u'}-${Date.now()}`;
    try {
      const handler = window.PaystackPop.setup({
        key,
        email,
        amount: SALES_SUBSCRIPTION_TOTAL_CENTS,
        currency: 'ZAR',
        ref,
        metadata: {
          custom_fields: [
            {
              display_name: 'Product',
              variable_name: 'product',
              value: 'sales_contractor_portal',
            },
            {
              display_name: 'Company ID',
              variable_name: 'company_id',
              value: String(companyId),
            },
            {
              display_name: 'Term',
              variable_name: 'term',
              value: `${SALES_SUBSCRIPTION_TERM_MONTHS}_months`,
            },
            {
              display_name: 'Monthly ZAR',
              variable_name: 'monthly_zar',
              value: String(SALES_SUBSCRIPTION_MONTHLY_ZAR),
            },
          ],
        },
        callback: (response: { reference?: string }) => {
          void activate(response.reference || ref);
        },
        onClose: () => {
          setPaying(false);
        },
      });
      handler.openIframe();
    } catch (e: unknown) {
      setPaying(false);
      toast.error(e instanceof Error ? e.message : 'Could not open Paystack');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (subscription?.isActive) {
    return (
      <div className="max-w-lg mx-auto rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
        <h1 className="text-2xl font-black text-slate-900">Subscription active</h1>
        <p className="text-sm text-emerald-800 mt-2">
          Access until{' '}
          {subscription.endsAt
            ? new Date(subscription.endsAt).toLocaleDateString('en-ZA', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            : '—'}
          {subscription.daysRemaining != null
            ? ` · ${subscription.daysRemaining} days left`
            : ''}
        </p>
        <button
          type="button"
          onClick={() => router.push('/sales')}
          className="mt-6 px-6 py-3 rounded-2xl bg-[#00b4d8] hover:bg-[#0096c7] text-white font-bold text-sm"
        >
          Open command centre
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 border border-amber-200 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-3">
          <CreditCard className="w-3.5 h-3.5" />
          Platform subscription
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Unlock your sales portal
        </h1>
        <p className="mt-2 text-neutral-500 text-sm sm:text-base max-w-md mx-auto">
          Sell for <strong className="text-slate-700">{companyName || 'your company'}</strong> with
          full access — commission tools, pipeline, and forecasts.
        </p>
      </div>

      <div className="rounded-[2rem] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-amber-50 p-6 sm:p-8 relative overflow-hidden shadow-sm">
        <Sparkles className="absolute top-4 right-4 w-8 h-8 text-amber-400/50" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm text-amber-800 font-semibold">Monthly rate</div>
            <div className="text-5xl font-black text-slate-900 tracking-tight">
              R{SALES_SUBSCRIPTION_MONTHLY_ZAR}
              <span className="text-lg font-semibold text-neutral-500">/mo</span>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-orange-800 bg-orange-50 border border-orange-200 rounded-full px-3 py-1">
              <Calendar className="w-3.5 h-3.5" />
              {SALES_SUBSCRIPTION_TERM_MONTHS}-month subscription
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">
              R{SALES_SUBSCRIPTION_TOTAL_ZAR.toLocaleString('en-ZA')}
            </div>
            <div className="text-xs text-neutral-600">
              prepaid · R{SALES_SUBSCRIPTION_MONTHLY_ZAR} × {SALES_SUBSCRIPTION_TERM_MONTHS} months
            </div>
          </div>
        </div>

        <ul className="mt-6 space-y-2 text-sm text-slate-700">
          <li className="flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            Full Sales Contractor portal for {SALES_SUBSCRIPTION_TERM_MONTHS} months
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            Live commission preview — rates <strong>4% · 5% · 6%</strong> (super-link at 6%)
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            Pipeline, earnings charts &amp; 90-day forecast
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            Secure Paystack checkout (ZAR)
          </li>
        </ul>

        {!agreementSigned && (
          <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            Sign the Independent Sales Contractor Agreement before subscribing.
          </p>
        )}

        <button
          type="button"
          disabled={paying || !agreementSigned}
          onClick={() => startPayment()}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-[#00b4d8] to-[#0077b6] text-white font-black text-base shadow-xl shadow-sky-200/50 disabled:opacity-50"
        >
          {paying ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <CreditCard className="w-5 h-5" />
          )}
          Pay R{SALES_SUBSCRIPTION_TOTAL_ZAR.toLocaleString('en-ZA')} · start {SALES_SUBSCRIPTION_TERM_MONTHS} months
        </button>

        <p className="mt-3 text-[11px] text-center text-neutral-500 flex items-center justify-center gap-1">
          <Shield className="w-3 h-3" />
          Payment processed securely by Paystack · subscription fees paid to SupplierAdvisor
        </p>
      </div>
    </div>
  );
}
