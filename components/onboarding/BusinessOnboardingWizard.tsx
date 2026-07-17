'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Factory,
  Globe2,
  GraduationCap,
  Landmark,
  Leaf,
  Loader2,
  ShieldCheck,
  Users2,
} from 'lucide-react';
import { toast } from 'sonner';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';

const BUSINESS_TYPES = [
  {
    id: 'business',
    label: 'Business',
    description: 'Manufacturer, distributor, retailer, or service provider',
    icon: Building2,
  },
  {
    id: 'supplier',
    label: 'Supplier',
    description: 'Farm, raw materials, packaging, or logistics supplier',
    icon: Factory,
  },
  {
    id: 'government',
    label: 'Government',
    description: 'Public sector entity or programme',
    icon: Landmark,
  },
  {
    id: 'school',
    label: 'School / Education',
    description: 'School, college, or training institution',
    icon: GraduationCap,
  },
  {
    id: 'association',
    label: 'Association',
    description: 'Co-op, industry body, or member group',
    icon: Users2,
  },
  {
    id: 'consumer_org',
    label: 'Impact / NGO',
    description: 'Non-profit or regenerative initiative',
    icon: Leaf,
  },
] as const;

type FormState = {
  business_type: string;
  trading_name: string;
  legal_name: string;
  registration_number: string;
  industry: string;
  country: string;
  city: string;
  website: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  short_description: string;
};

const STEPS = ['Account', 'Organisation', 'Details', 'Contact', 'Review'] as const;

export default function BusinessOnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type') || 'business';
  const claimId = Number(searchParams.get('claim') || 0) || null;
  const claimName = searchParams.get('name') || '';
  const prefillEmail = searchParams.get('email') || '';
  const { ready, authenticated, user, login } = usePrivy();

  const initialType = BUSINESS_TYPES.some((t) => t.id === typeParam) ? typeParam : 'business';

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [doneProfileId, setDoneProfileId] = useState<number | null>(null);
  const [doneLifetime, setDoneLifetime] = useState(false);
  const [claimConflict, setClaimConflict] = useState<{
    profileId: number;
    connectHref?: string;
  } | null>(null);
  const [form, setForm] = useState<FormState>({
    business_type: initialType,
    trading_name: claimName || '',
    legal_name: claimName || '',
    registration_number: '',
    industry: '',
    country: 'South Africa',
    city: '',
    website: '',
    contact_name: '',
    contact_email: prefillEmail || '',
    contact_phone: '',
    short_description: '',
  });

  const progress = ((step + 1) / STEPS.length) * 100;

  const canNext = useMemo(() => {
    if (step === 0) return authenticated;
    if (step === 1) return Boolean(form.business_type);
    if (step === 2) return form.trading_name.trim().length >= 2;
    if (step === 3) {
      return (
        form.contact_name.trim().length >= 2 &&
        form.contact_email.includes('@')
      );
    }
    return true;
  }, [step, authenticated, form]);

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const ensureAuthPrefill = () => {
    if (!user) return;
    const email = extractEmailFromPrivyUser(user);
    if (email && !form.contact_email) {
      update('contact_email', email);
    }
  };

  const goNext = () => {
    if (step === 0 && !authenticated) {
      login();
      return;
    }
    if (step === 0) ensureAuthPrefill();
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const submit = async () => {
    if (!authenticated || !user) {
      login();
      return;
    }

    const privyUserId = getCanonicalUserId(user.id);
    if (!privyUserId) {
      toast.error('Session not ready. Please sign in again.');
      return;
    }

    setSubmitting(true);
    try {
      // Supply-chain referrer from ?ref= on /onboarding (company id or code)
      let referralCode =
        searchParams.get('ref') || searchParams.get('referral') || null;
      if (referralCode && typeof window !== 'undefined') {
        try {
          localStorage.setItem('sa_referral_code', referralCode);
        } catch {
          /* ignore */
        }
      } else if (typeof window !== 'undefined') {
        try {
          referralCode = localStorage.getItem('sa_referral_code');
        } catch {
          /* ignore */
        }
      }

      const res = await fetch('/api/onboarding/register-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privyUserId,
          ...form,
          contact_email: form.contact_email || extractEmailFromPrivyUser(user),
          referralCode: referralCode || undefined,
          claimProfileId: claimId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'ALREADY_CLAIMED' && (data.profileId || claimId)) {
          const pid = Number(data.profileId || claimId);
          setClaimConflict({
            profileId: pid,
            connectHref: data.connectHref || `/c/${pid}`,
          });
          toast.message('Listing already has an owner', {
            description: 'Connect as a partner or sign in with the owner account.',
          });
        } else {
          toast.error(data.error || 'Registration failed');
        }
        setSubmitting(false);
        return;
      }

      if (data.profileId) {
        localStorage.setItem('selectedCompanyId', String(data.profileId));
        if (data.tradingName) {
          localStorage.setItem('selectedCompanyName', data.tradingName);
        }
        setDoneProfileId(Number(data.profileId));
      }
      setDoneLifetime(Boolean(data.lifetime?.status === 'lifetime' || data.claimed));

      // Soft: notify referrer CRM that invite was accepted
      if (referralCode && /^\d+$/.test(String(referralCode))) {
        void fetch('/api/public/invite-track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'accepted',
            ref: referralCode,
            email: form.contact_email || extractEmailFromPrivyUser(user),
            claim: claimId || data.profileId,
          }),
        }).catch(() => undefined);
      }

      setDone(true);
      toast.success(
        data.claimed ? 'Listing claimed — workspace ready!' : 'Your business is ready!'
      );
      setTimeout(() => router.push('/dashboard/select-company'), 2800);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (claimConflict) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="max-w-md w-full rounded-3xl border border-amber-200 bg-white p-8 shadow-sm text-center">
          <h1 className="text-2xl font-black text-slate-900 mb-2">
            Listing already claimed
          </h1>
          <p className="text-sm text-neutral-600 mb-6 leading-relaxed">
            Company #{claimConflict.profileId} already has an owner on
            SupplierAdvisor. You can connect as a trade partner, or sign in with
            the owner account to manage the listing.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href={claimConflict.connectHref || `/c/${claimConflict.profileId}`}
              className="btn-primary !py-3 text-sm"
            >
              View listing & connect
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(`/c/${claimConflict.profileId}`)}`}
              className="btn-secondary !py-3 text-sm"
            >
              Sign in as owner
            </Link>
            <Link href="/onboarding?type=business" className="text-xs font-semibold text-[#0077b6] hover:underline mt-2">
              Register a new company instead
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/onboarding?type=business&ref=${doneProfileId || ''}`
        : `https://www.supplieradvisor.com/onboarding?type=business&ref=${doneProfileId || ''}`;
    const shareText = doneLifetime
      ? `We just claimed our SupplierAdvisor founding seat — join the verified B2B trade network: ${shareUrl}`
      : `We joined SupplierAdvisor — the B2B trade OS: ${shareUrl}`;
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="text-center max-w-md">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
          <h1 className="text-4xl font-black tracking-[-2px] text-[#00b4d8] mb-3">
            {claimId ? 'Listing claimed' : 'Welcome aboard'}
          </h1>
          <p className="text-lg text-neutral-600 mb-4">
            Your workspace is ready. Redirecting…
          </p>
          {doneProfileId ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-left">
              <p className="text-xs font-black text-violet-950 mb-1">
                Share your referral link
              </p>
              <p className="text-[11px] text-violet-900/90 mb-2 leading-relaxed">
                Invite partners — they join via your ref code.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary !py-1.5 !px-3 text-xs"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      toast.success('Referral link copied');
                    } catch {
                      toast.message(shareUrl);
                    }
                  }}
                >
                  Copy link
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary !py-1.5 !px-3 text-xs"
                >
                  WhatsApp
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-3xl mx-auto px-6 py-10 md:py-14">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/sa-logo.png" alt="SupplierAdvisor" width={40} height={40} className="rounded-xl" />
            <span className="font-black text-xl tracking-[-1px] text-slate-900">SupplierAdvisor®</span>
          </Link>
          <Link href="/login" className="text-sm font-medium text-[#00b4d8] hover:underline">
            Already have an account?
          </Link>
        </div>

        {/* Progress */}
        <div className="mb-10">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">
            {STEPS.map((label, i) => (
              <span key={label} className={i <= step ? 'text-[#00b4d8]' : ''}>
                {label}
              </span>
            ))}
          </div>
          <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00b4d8] transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-3xl p-8 md:p-10 shadow-sm">
          {claimId ? (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
              <p className="font-black">Claiming directory listing</p>
              <p className="text-xs mt-0.5 opacity-90">
                Company #{claimId}
                {claimName ? ` · ${claimName}` : ''} — you will become owner
                without creating a duplicate company.
              </p>
            </div>
          ) : null}
          {step === 0 && (
            <div>
              <div className="inline-flex items-center gap-2 bg-[#00b4d8]/10 text-[#0077b6] px-3 py-1.5 rounded-full text-sm font-semibold mb-4">
                <ShieldCheck className="w-4 h-4" /> Secure account
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-[-1.5px] text-[#00b4d8] mb-3">
                {claimId ? 'Claim your listing' : 'Create your SupplierAdvisor account'}
              </h1>
              <p className="text-neutral-600 text-lg mb-8 leading-relaxed">
                We use enterprise-grade authentication via Privy — email one-time codes, Google, Apple, or wallet.
                Stronger than passwords, faster for your team.
              </p>

              {authenticated ? (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100 mb-8">
                  <div className="font-semibold text-emerald-800">You&apos;re signed in</div>
                  <div className="text-sm text-emerald-700 mt-1">
                    {extractEmailFromPrivyUser(user) || user?.id}
                  </div>
                </div>
              ) : (
                <ul className="space-y-3 mb-8 text-neutral-700">
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-[#00b4d8] flex-shrink-0" /> Email verification codes (no weak passwords)</li>
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-[#00b4d8] flex-shrink-0" /> Google &amp; Apple social sign-in</li>
                  <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-[#00b4d8] flex-shrink-0" /> Optional wallet for on-chain features</li>
                </ul>
              )}
            </div>
          )}

          {step === 1 && (
            <div>
              <h1 className="text-3xl font-black tracking-[-1.5px] text-[#00b4d8] mb-3">What are you registering?</h1>
              <p className="text-neutral-600 mb-8">Choose the option that best describes your organisation.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {BUSINESS_TYPES.map((type) => {
                  const Icon = type.icon;
                  const selected = form.business_type === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => update('business_type', type.id)}
                      className={`text-left p-5 rounded-2xl border transition-all ${
                        selected
                          ? 'border-[#00b4d8] bg-[#00b4d8]/5 shadow-sm'
                          : 'border-neutral-200 hover:border-neutral-300 bg-white'
                      }`}
                    >
                      <Icon className={`w-6 h-6 mb-3 ${selected ? 'text-[#00b4d8]' : 'text-neutral-500'}`} />
                      <div className="font-semibold text-slate-900">{type.label}</div>
                      <div className="text-sm text-neutral-600 mt-1">{type.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="text-3xl font-black tracking-[-1.5px] text-[#00b4d8] mb-3">Organisation details</h1>
              <p className="text-neutral-600 mb-8">These details appear on your verified company profile.</p>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2">Trading name *</label>
                  <input className="input w-full" value={form.trading_name} onChange={(e) => update('trading_name', e.target.value)} placeholder="Acme Fresh" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Legal name</label>
                  <input className="input w-full" value={form.legal_name} onChange={(e) => update('legal_name', e.target.value)} placeholder="Acme Fresh (Pty) Ltd" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Registration number</label>
                    <input className="input w-full" value={form.registration_number} onChange={(e) => update('registration_number', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Industry</label>
                    <input className="input w-full" value={form.industry} onChange={(e) => update('industry', e.target.value)} placeholder="Food & beverage" />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Country</label>
                    <input className="input w-full" value={form.country} onChange={(e) => update('country', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">City</label>
                    <input className="input w-full" value={form.city} onChange={(e) => update('city', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Website</label>
                  <div className="relative">
                    <Globe2 className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input className="input w-full pl-11" value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="https://" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Short description</label>
                  <textarea
                    className="input w-full min-h-[100px]"
                    value={form.short_description}
                    onChange={(e) => update('short_description', e.target.value)}
                    placeholder="What does your organisation do?"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="text-3xl font-black tracking-[-1.5px] text-[#00b4d8] mb-3">Primary contact</h1>
              <p className="text-neutral-600 mb-8">This person will be the account owner for the company.</p>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2">Full name *</label>
                  <input className="input w-full" value={form.contact_name} onChange={(e) => update('contact_name', e.target.value)} placeholder="Thandi Nkosi" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Work email *</label>
                  <input type="email" className="input w-full" value={form.contact_email} onChange={(e) => update('contact_email', e.target.value)} placeholder="you@company.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Phone</label>
                  <input type="tel" className="input w-full" value={form.contact_phone} onChange={(e) => update('contact_phone', e.target.value)} placeholder="+27 …" />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h1 className="text-3xl font-black tracking-[-1.5px] text-[#00b4d8] mb-3">Review &amp; launch</h1>
              <p className="text-neutral-600 mb-8">Confirm everything looks right. You can edit your profile later.</p>
              <div className="rounded-2xl border border-neutral-200 divide-y bg-neutral-50">
                {[
                  ['Organisation type', BUSINESS_TYPES.find((t) => t.id === form.business_type)?.label],
                  ['Trading name', form.trading_name],
                  ['Legal name', form.legal_name || form.trading_name],
                  ['Location', [form.city, form.country].filter(Boolean).join(', ')],
                  ['Contact', form.contact_name],
                  ['Email', form.contact_email],
                  ['Phone', form.contact_phone || '—'],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between gap-4 px-5 py-4 text-sm">
                    <span className="text-neutral-500">{label}</span>
                    <span className="font-medium text-slate-900 text-right">{value || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-neutral-100">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-neutral-600 disabled:opacity-30 hover:bg-neutral-50"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!canNext && step !== 0}
                className="btn-primary py-3 px-8 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {step === 0 && !authenticated ? 'Sign in to continue' : 'Continue'}
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !canNext}
                className="btn-primary py-3 px-8 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Creating workspace…
                  </>
                ) : (
                  <>
                    Create my workspace <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
