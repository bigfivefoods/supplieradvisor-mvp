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
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  extractEmailFromPrivyUser,
  getCanonicalUserId,
} from '@/lib/auth/identity';
import {
  BILLING_TERMS,
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
  formatZar,
  getBillingTerm,
  type BillingTermId,
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
  const [termId, setTermId] = useState<BillingTermId>('1y');
  const selectedTerm = getBillingTerm(termId);
  type ReferralState = {
    code?: string | null;
    invitePath?: string;
    ratesSummary?: string;
    suggestedCopy?: string;
    pendingZar?: number;
    approvedZar?: number;
    payoutRequestedZar?: number;
    paidZar?: number;
    totalZar?: number;
    availableToRequestZar?: number;
    directReferrals?: number;
    rates?: readonly number[];
    levelLabels?: readonly string[];
    totalCapPct?: number;
    recent?: Array<{
      id: number;
      level: number;
      rate_pct: number;
      commission_amount_zar: number;
      base_amount_zar: number;
      status: string;
      source_name?: string | null;
      notes?: string | null;
      created_at?: string;
      paid_ref?: string | null;
    }>;
    payouts?: Array<Record<string, unknown>>;
  };
  const [referral, setReferral] = useState<ReferralState | null>(null);
  const [referralBusy, setReferralBusy] = useState(false);
  const [paidRefInput, setPaidRefInput] = useState('');

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
      setReferral(data.referral || null);
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

  const runReferralAction = async (
    action: 'request_payout' | 'approve' | 'mark_paid' | 'void',
    extra?: Record<string, unknown>
  ) => {
    if (!companyId) return;
    setReferralBusy(true);
    try {
      const res = await fetch('/api/business/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      if (data.summary) {
        setReferral((prev) => ({
          ...(prev || {}),
          ...data.summary,
          code: prev?.code,
          invitePath: prev?.invitePath,
          ratesSummary: data.summary.ratesSummary || prev?.ratesSummary,
          suggestedCopy: data.summary.suggestedCopy || prev?.suggestedCopy,
        }));
      } else {
        void load();
      }
      if (action === 'request_payout') {
        toast.success(
          `Payout requested: ${formatZar(Number(data.amountZar || 0))} (${data.count} items)`
        );
      } else if (action === 'mark_paid') {
        toast.success(
          `Marked paid: ${formatZar(Number(data.amountZar || 0))}`
        );
        setPaidRefInput('');
      } else if (action === 'approve') {
        toast.success(`Approved ${data.count || 0} earning(s)`);
      } else {
        toast.success('Updated');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Referral action failed');
    } finally {
      setReferralBusy(false);
    }
  };

  const activate = async (paystackReference: string, paidTermId: BillingTermId) => {
    try {
      const res = await fetch('/api/business/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          action: 'activate',
          paystackReference,
          termId: paidTermId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Activation failed');
      const termLabel = data.term?.label || getBillingTerm(paidTermId).label;
      toast.success(`Subscription active (${termLabel}) — thank you!`);
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

    const term = getBillingTerm(termId);
    setPaying(true);
    const ref = `sa-co-sub-${term.id}-${companyId}-${Date.now()}`;
    try {
      const handler = window.PaystackPop.setup({
        key,
        email: payEmail,
        amount: term.payCents,
        currency: 'ZAR',
        ref,
        metadata: {
          custom_fields: [
            {
              display_name: 'Product',
              variable_name: 'product',
              value: 'company_saas',
            },
            {
              display_name: 'Company ID',
              variable_name: 'company_id',
              value: String(companyId),
            },
            {
              display_name: 'Term',
              variable_name: 'term_id',
              value: term.id,
            },
            {
              display_name: 'Plan',
              variable_name: 'plan',
              value: term.planCode,
            },
            {
              display_name: 'Months',
              variable_name: 'months',
              value: String(term.months),
            },
            {
              display_name: 'Discount %',
              variable_name: 'discount_percent',
              value: String(term.discountPercent),
            },
          ],
        },
        callback: (response: { reference?: string }) => {
          void activate(response.reference || ref, term.id);
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
        description={`Company plan for ${companyName || 'your business'} — ${COMPANY_TRIAL_DAYS}-day free trial, then from R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month. Save up to 30% with multi-year prepaid.`}
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
                  From
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
                Prepaid multi-year: 15% (1y) · 25% (2y) · 30% (3y)
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                Secure Paystack checkout in ZAR
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                Early renewals extend your access period
              </li>
            </ul>

            {sub?.isLifetime ? (
              <div className="mt-6 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-amber-50 px-4 py-4 text-sm text-violet-950">
                <div className="font-bold flex items-center gap-2 text-base">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  Lifetime complimentary access
                </div>
                <p className="mt-2 text-violet-900">
                  This company has free access for life
                  {sub.plan === 'founder_lifetime'
                    ? ' as a founder company'
                    : sub.plan === 'founding_50'
                      ? ' as one of the first 50 founding partners'
                      : ''}
                  . No payment required — ever.
                </p>
              </div>
            ) : sub?.hasAccess && !sub.isExpired ? (
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

            {!sub?.isLifetime && (
              <>
                <div className="mt-6">
                  <div className="text-sm font-bold text-slate-900 mb-3">
                    Choose billing term
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {BILLING_TERMS.map((t) => {
                      const selected = termId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTermId(t.id)}
                          className={`text-left rounded-2xl border px-4 py-3 transition ${
                            selected
                              ? 'border-[#00b4d8] bg-sky-50 ring-2 ring-[#00b4d8]/30'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {t.label}
                            </span>
                            {t.badge && (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 bg-emerald-100 border border-emerald-200 rounded-full px-2 py-0.5">
                                {t.discountPercent > 0
                                  ? `−${t.discountPercent}%`
                                  : t.badge}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-lg font-black text-slate-900">
                            {formatZar(t.payZar)}
                            <span className="text-xs font-semibold text-slate-500 ml-1">
                              {t.months === 1 ? '/mo' : ` prepaid`}
                            </span>
                          </div>
                          {t.discountPercent > 0 ? (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              <span className="line-through">
                                {formatZar(t.listZar)}
                              </span>
                              {' · '}
                              save {formatZar(t.savingsZar)} · ~R
                              {t.effectiveMonthlyZar}/mo
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Flexible month-to-month
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

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
                  {sub?.isActive ? 'Renew' : 'Pay'} · {formatZar(selectedTerm.payZar)}
                  {selectedTerm.months > 1
                    ? ` · ${selectedTerm.label}`
                    : ' / month'}
                </button>

                <p className="mt-3 text-[11px] text-center text-neutral-500 flex items-center justify-center gap-1">
                  <Shield className="w-3 h-3" />
                  Secure Paystack checkout · fees paid to SupplierAdvisor
                </p>
              </>
            )}
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
              <Users className="w-4 h-4 text-[#00b4d8]" />
              Supply-chain referral
            </h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              {referral?.suggestedCopy ||
                'When companies you invite pay for SupplierAdvisor, you earn a share of their subscription — up to 10% across 3 levels.'}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
              {(referral?.rates || [6, 3, 1]).map((rate, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-sky-100 bg-sky-50/60 px-1.5 py-2"
                >
                  <div className="text-lg font-black text-[#0077b6]">{rate}%</div>
                  <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                    L{i + 1}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-center text-slate-400 font-semibold">
              {referral?.ratesSummary || 'L1 6% · L2 3% · L3 1% (max 10%)'}
            </p>

            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Direct referrals</dt>
                <dd className="font-semibold">{referral?.directReferrals ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Pending review</dt>
                <dd className="font-semibold text-amber-700">
                  {formatZar(Number(referral?.pendingZar || 0))}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Ready / approved</dt>
                <dd className="font-semibold text-emerald-700">
                  {formatZar(Number(referral?.approvedZar || 0))}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Payout requested</dt>
                <dd className="font-semibold text-sky-800">
                  {formatZar(Number(referral?.payoutRequestedZar || 0))}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Paid out</dt>
                <dd className="font-semibold">
                  {formatZar(Number(referral?.paidZar || 0))}
                </dd>
              </div>
            </dl>

            {/* Workflow steps */}
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-[10px] text-slate-600 leading-relaxed">
              <strong className="text-slate-800">Payout flow:</strong> Pending →
              (auto/finance) Approved → <em>Request payout</em> → Finance marks{' '}
              <em>Paid</em> with a bank/Paystack ref.
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                disabled={
                  referralBusy ||
                  Number(referral?.availableToRequestZar || 0) <= 0
                }
                onClick={() => void runReferralAction('request_payout')}
                className="w-full rounded-xl bg-gradient-to-r from-[#00b4d8] to-[#0077b6] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40"
              >
                {referralBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />
                ) : null}
                Request payout{' '}
                {Number(referral?.availableToRequestZar || 0) > 0
                  ? `(${formatZar(Number(referral?.availableToRequestZar))})`
                  : ''}
              </button>
              <button
                type="button"
                disabled={
                  referralBusy || Number(referral?.pendingZar || 0) <= 0
                }
                onClick={() => void runReferralAction('approve')}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Approve pending (finance)
              </button>
              <div className="flex gap-1.5">
                <input
                  className="flex-1 min-w-0 rounded-xl border border-slate-200 px-2.5 py-2 text-[11px]"
                  placeholder="Paid ref (EFT / batch id)"
                  value={paidRefInput}
                  onChange={(e) => setPaidRefInput(e.target.value)}
                />
                <button
                  type="button"
                  disabled={
                    referralBusy ||
                    Number(referral?.payoutRequestedZar || 0) <= 0
                  }
                  onClick={() =>
                    void runReferralAction('mark_paid', {
                      paidRef: paidRefInput || undefined,
                    })
                  }
                  className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-900 disabled:opacity-40"
                >
                  Mark paid
                </button>
              </div>
            </div>

            {referral?.invitePath ? (
              <div className="mt-3 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Your invite link
                </div>
                <input
                  readOnly
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-mono"
                  value={
                    typeof window !== 'undefined'
                      ? `${window.location.origin}${referral.invitePath}`
                      : referral.invitePath
                  }
                />
                <button
                  type="button"
                  className="text-xs font-bold text-[#0077b6] hover:underline"
                  onClick={() => {
                    const url =
                      typeof window !== 'undefined'
                        ? `${window.location.origin}${referral.invitePath}`
                        : referral.invitePath || '';
                    void navigator.clipboard.writeText(url);
                    toast.success('Referral link copied');
                  }}
                >
                  Copy link · code {referral.code || companyId}
                </button>
              </div>
            ) : null}

            {referral?.recent && referral.recent.length > 0 ? (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Recent earnings
                </div>
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {referral.recent.slice(0, 12).map((e) => (
                    <li
                      key={e.id}
                      className="text-[11px] flex justify-between gap-2 border-b border-slate-50 pb-1.5"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">
                          {e.source_name || `Company #${e.id}`}
                        </div>
                        <div className="text-slate-500">
                          L{e.level} · {e.rate_pct}% ·{' '}
                          <span className="capitalize">
                            {e.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                      <div className="font-bold text-slate-900 shrink-0">
                        {formatZar(Number(e.commission_amount_zar || 0))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="mt-3 text-[10px] text-slate-400 leading-relaxed">
              Separate from sales-contractor product commission (personal sales
              only). Referral fees are only on platform subscription payments in
              your invite chain.
            </p>
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
                Pay from R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/mo via Paystack —
                or prepay 1–3 years and save up to 30%.
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
  if (sub.isLifetime) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 border border-violet-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-900">
        <Sparkles className="w-3.5 h-3.5" />
        Lifetime free
      </span>
    );
  }
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
