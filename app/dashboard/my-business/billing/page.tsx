'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  CreditCard,
  CheckCircle2,
  Shield,
  Sparkles,
  Calendar,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  extractEmailFromPrivyUser,
  getCanonicalUserId,
} from '@/lib/auth/identity';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_CENTS,
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
  type CompanySubscriptionInfo,
} from '@/lib/billing/company-subscription';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

export default function BusinessBillingPage() {
  return (
    <CompanyRequired>
      <BillingInner />
    </CompanyRequired>
  );
}

function BillingInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const email = extractEmailFromPrivyUser(user);

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [billingEmail, setBillingEmail] = useState<string | null>(null);
  const [subscription, setSubscription] =
    useState<CompanySubscriptionInfo | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        autoTrial: '1',
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/business/subscription?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed to load billing');
      setCompanyName(data.companyName || '');
      setBillingEmail(data.billingEmail || null);
      setSubscription(data.subscription || null);
      if (data.trialJustStarted) {
        toast.success(`${COMPANY_TRIAL_DAYS}-day free trial started`);
      }
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
      const res = await fetch('/api/business/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'activate',
          paystackReference,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Activation failed');
      toast.success('Subscription active — thank you!');
      setSubscription(data.subscription);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Activation failed');
    } finally {
      setPaying(false);
    }
  };

  const startPayment = () => {
    const payEmail = email || billingEmail;
    if (!payEmail) {
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
    const ref = `sa-co-sub-${companyId}-${Date.now()}`;
    try {
      const handler = window.PaystackPop.setup({
        key,
        email: payEmail,
        amount: COMPANY_SUBSCRIPTION_MONTHLY_CENTS,
        currency: 'ZAR',
        ref,
        metadata: {
          custom_fields: [
            {
              display_name: 'Product',
              variable_name: 'product',
              value: 'company_saas_monthly',
            },
            {
              display_name: 'Company ID',
              variable_name: 'company_id',
              value: String(companyId),
            },
            {
              display_name: 'Plan',
              variable_name: 'plan',
              value: 'company_monthly',
            },
            {
              display_name: 'Monthly ZAR',
              variable_name: 'monthly_zar',
              value: String(COMPANY_SUBSCRIPTION_MONTHLY_ZAR),
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
      <BusinessPage>
        <div className="py-24 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      </BusinessPage>
    );
  }

  const sub = subscription;
  const accessEnd = sub?.isActive
    ? sub.endsAt
    : sub?.isTrial
      ? sub.trialEndsAt
      : sub?.endsAt || sub?.trialEndsAt;

  return (
    <BusinessPage>
      <BusinessHeader
        title="Billing & subscription"
        description={`Company plan for ${companyName || 'your business'} — ${COMPANY_TRIAL_DAYS}-day free trial, then R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month via Paystack.`}
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          <Panel className="p-6 sm:p-8 relative overflow-hidden">
            <Sparkles className="absolute top-4 right-4 w-8 h-8 text-amber-400/40" />
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-sm text-slate-500 font-semibold">
                  Monthly plan
                </div>
                <div className="text-5xl font-black text-slate-900 tracking-tight">
                  R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}
                  <span className="text-lg font-semibold text-neutral-500">
                    /mo
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Per company · unlimited users · full ERP
                </p>
              </div>
              <StatusBadge sub={sub} />
            </div>

            <ul className="mt-6 space-y-2 text-sm text-slate-700">
              <li className="flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                {COMPANY_TRIAL_DAYS}-day free trial on signup — no card required
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                Full platform: procurement, CRM, finance, inventory, quality
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                Billed monthly in ZAR via secure Paystack checkout
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                Renew anytime — paid months stack if you renew early
              </li>
            </ul>

            {sub?.hasAccess && !sub.isExpired ? (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <div className="font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {sub.isTrial ? 'Trial active' : 'Subscription active'}
                </div>
                <p className="mt-1 text-emerald-800">
                  Access until{' '}
                  {accessEnd
                    ? new Date(accessEnd).toLocaleDateString('en-ZA', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : '—'}
                  {sub.daysRemaining != null
                    ? ` · ${sub.daysRemaining} day${sub.daysRemaining === 1 ? '' : 's'} left`
                    : ''}
                </p>
                {sub.isTrial && (
                  <p className="mt-2 text-emerald-800/90 text-xs">
                    Subscribe before the trial ends to keep uninterrupted access
                    at R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <div className="font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {sub?.status === 'none'
                    ? 'No active plan'
                    : 'Access expired'}
                </div>
                <p className="mt-1">
                  Subscribe for R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month to
                  restore full company access.
                </p>
              </div>
            )}

            <button
              type="button"
              disabled={paying}
              onClick={() => startPayment()}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-[#00b4d8] to-[#0077b6] text-white font-black text-base shadow-xl shadow-sky-200/50 disabled:opacity-50"
            >
              {paying ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CreditCard className="w-5 h-5" />
              )}
              {sub?.isActive
                ? `Renew · R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}`
                : sub?.isTrial
                  ? `Subscribe · R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/mo`
                  : `Pay R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR} · start plan`}
            </button>

            <p className="mt-3 text-[11px] text-center text-neutral-500 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" />
              Secure Paystack checkout · fees paid to SupplierAdvisor
            </p>
          </Panel>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Panel className="p-5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#00b4d8]" />
              Plan details
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Status</dt>
                <dd className="font-semibold capitalize text-slate-900">
                  {sub?.status || 'none'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Trial ends</dt>
                <dd className="font-medium text-slate-800">
                  {sub?.trialEndsAt
                    ? new Date(sub.trialEndsAt).toLocaleDateString('en-ZA')
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Paid until</dt>
                <dd className="font-medium text-slate-800">
                  {sub?.endsAt
                    ? new Date(sub.endsAt).toLocaleDateString('en-ZA')
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Price</dt>
                <dd className="font-medium text-slate-800">
                  R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR} / month
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Last payment ref</dt>
                <dd
                  className="font-mono text-[11px] text-slate-600 max-w-[140px] truncate"
                  title={sub?.paystackReference || ''}
                >
                  {sub?.paystackReference || '—'}
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel className="p-5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#00b4d8]" />
              How billing works
            </h3>
            <ol className="mt-3 space-y-2 text-sm text-slate-600 list-decimal list-inside">
              <li>
                Free trial for {COMPANY_TRIAL_DAYS} days when you register a
                company.
              </li>
              <li>
                Pay R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR} via Paystack for one
                month of access.
              </li>
              <li>
                Renew from this page before expiry — early renewals extend your
                current end date.
              </li>
            </ol>
            <Link
              href="/pricing"
              className="mt-4 inline-flex text-sm font-semibold text-[#00b4d8] hover:underline"
            >
              View public pricing →
            </Link>
          </Panel>
        </div>
      </div>
    </BusinessPage>
  );
}

function StatusBadge({ sub }: { sub: CompanySubscriptionInfo | null }) {
  if (!sub) return null;
  if (sub.isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Active
      </span>
    );
  }
  if (sub.isTrial) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 border border-sky-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-800">
        <Sparkles className="w-3.5 h-3.5" />
        Free trial
        {sub.daysRemaining != null ? ` · ${sub.daysRemaining}d` : ''}
      </span>
    );
  }
  if (sub.isExpired) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-900">
        <AlertTriangle className="w-3.5 h-3.5" />
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
      No plan
    </span>
  );
}
