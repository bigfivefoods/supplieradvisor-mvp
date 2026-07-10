'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';

type InviteKind = 'business' | 'team' | 'customer';

interface InviteClaimFlowProps {
  token: string;
  kind: InviteKind;
}

type BusinessInvite = {
  profileId: string | number;
  tradingName: string;
  legalName?: string | null;
  email: string;
  contactName?: string | null;
  contactPhone?: string | null;
  invitedBy?: string | null;
};

type TeamInvite = {
  email: string;
  name?: string | null;
  role: string;
  companyName: string;
  profileId: string | number;
};

type CustomerInvite = {
  email: string;
  fullName?: string | null;
  contactName?: string | null;
  customerName?: string | null;
  sellerName?: string | null;
  companyName?: string | null;
  targetProfileId?: number | null;
  customerId?: number;
  sellerProfileId?: number;
  invitedBy?: string | null;
};

export default function InviteClaimFlow({ token, kind }: InviteClaimFlowProps) {
  const router = useRouter();
  const { ready, authenticated, user, login } = usePrivy();

  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [businessInvite, setBusinessInvite] = useState<BusinessInvite | null>(null);
  const [teamInvite, setTeamInvite] = useState<TeamInvite | null>(null);
  const [customerInvite, setCustomerInvite] = useState<CustomerInvite | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const validate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invites/validate?token=${encodeURIComponent(token)}&kind=${kind}`);
      const data = await res.json();
      if (!data.valid) {
        setError(data.error || 'Invalid invitation');
        setLoading(false);
        return;
      }

      if (kind === 'team') {
        setTeamInvite(data.invitation);
        setName(data.invitation.name || '');
      } else if (kind === 'customer') {
        setCustomerInvite(data.invitation);
        setName(data.invitation.contactName || data.invitation.fullName || '');
      } else {
        setBusinessInvite(data.invitation);
        setName(data.invitation.contactName || '');
        setPhone(data.invitation.contactPhone || '');
      }
    } catch {
      setError('Could not validate this invitation. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token, kind]);

  useEffect(() => {
    validate();
  }, [validate]);

  const expectedEmail =
    kind === 'team'
      ? teamInvite?.email
      : kind === 'customer'
        ? customerInvite?.email
        : businessInvite?.email;

  const hasInviteMeta = Boolean(businessInvite || teamInvite || customerInvite);

  const claim = useCallback(async () => {
    if (!authenticated || !user) return;

    const privyUserId = getCanonicalUserId(user.id);
    if (!privyUserId) {
      toast.error('Could not read your secure session. Please sign in again.');
      return;
    }

    const sessionEmail = extractEmailFromPrivyUser(user);

    // Hard email match for customer invites (client-side guard; server also enforces)
    if (kind === 'customer') {
      if (!sessionEmail) {
        setError('Sign in with the invited email to accept this customer invitation.');
        return;
      }
      if (expectedEmail && sessionEmail !== expectedEmail.toLowerCase()) {
        setError(
          `Please sign in with the invited email (${expectedEmail}). You are currently signed in as ${sessionEmail}.`
        );
        return;
      }
    } else if (expectedEmail && sessionEmail && sessionEmail !== expectedEmail.toLowerCase()) {
      setError(
        `Please sign in with the invited email (${expectedEmail}). You are currently signed in as ${sessionEmail}.`
      );
      return;
    }

    setClaiming(true);
    setError(null);

    try {
      const res = await fetch('/api/invites/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          kind,
          privyUserId,
          email: sessionEmail || expectedEmail,
          name: name || undefined,
          phone: phone || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to accept invitation');
        setClaiming(false);
        return;
      }

      const companyId = data.buyerProfileId ?? data.profileId;
      if (companyId) {
        localStorage.setItem('selectedCompanyId', String(companyId));
        try {
          window.dispatchEvent(new Event('sa:company-changed'));
        } catch {
          /* ignore */
        }
      }

      setSuccess(true);
      const role = String(data.role || '').toLowerCase();
      const isSalesContractor =
        role === 'sales_contractor' || role.includes('sales contractor');
      toast.success(
        isSalesContractor
          ? 'Welcome to the customer sales team!'
          : data.message || 'Invitation accepted'
      );
      setTimeout(() => {
        if (isSalesContractor && companyId) {
          router.push('/sales/agreement');
        } else {
          router.push('/dashboard/select-company');
        }
      }, 1400);
    } catch {
      setError('Something went wrong while accepting the invitation.');
    } finally {
      setClaiming(false);
    }
  }, [authenticated, user, expectedEmail, token, kind, name, phone, router]);

  const handleContinue = async () => {
    if (!ready) return;
    if (!authenticated) {
      login();
      return;
    }
    await claim();
  };

  // After Privy login, prefill name from Privy if empty
  useEffect(() => {
    if (ready && authenticated && user && hasInviteMeta && !success && !claiming) {
      if (!name) {
        const fromPrivy =
          (user as { google?: { name?: string } }).google?.name ||
          extractEmailFromPrivyUser(user)?.split('@')[0] ||
          '';
        if (fromPrivy) setName(fromPrivy);
      }
    }
  }, [ready, authenticated, user, hasInviteMeta, success, claiming, name]);

  if (loading || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8] mx-auto mb-4" />
          <p className="text-neutral-600">Validating your invitation…</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="max-w-md text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
          <h1 className="text-4xl font-black tracking-[-2px] text-[#00b4d8] mb-3">You&apos;re in!</h1>
          <p className="text-lg text-neutral-600">Taking you to your workspace…</p>
        </div>
      </div>
    );
  }

  if (error && !hasInviteMeta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="max-w-md text-center bg-white border border-neutral-200 rounded-3xl p-10">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Invitation unavailable</h1>
          <p className="text-neutral-600 mb-8">{error}</p>
          <div className="flex flex-col gap-3">
            <Link href="/login" className="btn-primary py-3">
              Go to login
            </Link>
            <Link href="/" className="btn-secondary py-3">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const title =
    kind === 'team'
      ? `Join ${teamInvite?.companyName || 'the team'}`
      : kind === 'customer'
        ? `Connect with ${customerInvite?.sellerName || customerInvite?.companyName || 'your supplier'}`
        : `Claim ${businessInvite?.tradingName || 'your business'}`;

  const subtitle =
    kind === 'team'
      ? `You've been invited as ${teamInvite?.role || 'a team member'}. Sign in securely to accept.`
      : kind === 'customer'
        ? `Accept the invitation for ${customerInvite?.customerName || 'your company'} to collaborate with ${customerInvite?.sellerName || 'your supplier'} on SupplierAdvisor.`
        : `Complete secure sign-in to activate ${businessInvite?.tradingName || 'this company'} on SupplierAdvisor.`;

  const showPhone = kind === 'business' || kind === 'customer';

  const contextLabel =
    kind === 'team' ? 'Your role' : kind === 'customer' ? 'Your company' : 'Invited by';

  const contextValue =
    kind === 'team'
      ? teamInvite?.role || 'Team member'
      : kind === 'customer'
        ? customerInvite?.customerName || 'Customer'
        : businessInvite?.invitedBy || 'SupplierAdvisor network';

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-5xl mx-auto px-6 py-10 md:py-16">
        <div className="flex items-center gap-3 mb-10">
          <Image src="/sa-logo.png" alt="SupplierAdvisor" width={40} height={40} className="rounded-xl" />
          <span className="font-black text-xl tracking-[-1px] text-slate-900">SupplierAdvisor®</span>
        </div>

        <div className="grid lg:grid-cols-5 gap-8 items-start">
          {/* Left: context */}
          <div className="lg:col-span-2 space-y-6">
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold border border-emerald-100">
              <ShieldCheck className="w-4 h-4" />
              Secure invitation
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-[-2px] text-[#00b4d8] leading-tight">
              {title}
            </h1>
            <p className="text-lg text-neutral-600 leading-relaxed">{subtitle}</p>

            <div className="bg-white border border-neutral-200 rounded-3xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-[#00b4d8] mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-900">World-class authentication</div>
                  <p className="text-sm text-neutral-600 mt-1">
                    Email one-time code, Google, Apple, or wallet — powered by Privy. No weak shared passwords.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-[#00b4d8] mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-900">Invited email</div>
                  <p className="text-sm text-neutral-600 mt-1 break-all">
                    {expectedEmail || '—'}
                  </p>
                  {kind === 'customer' && (
                    <p className="text-xs text-amber-700 mt-1">
                      You must sign in with this exact email to accept.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                {kind === 'team' ? (
                  <Users className="w-5 h-5 text-[#00b4d8] mt-0.5" />
                ) : (
                  <Building2 className="w-5 h-5 text-[#00b4d8] mt-0.5" />
                )}
                <div>
                  <div className="font-semibold text-slate-900">{contextLabel}</div>
                  <p className="text-sm text-neutral-600 mt-1">{contextValue}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: action card */}
          <div className="lg:col-span-3 bg-white border border-neutral-200 rounded-3xl p-8 md:p-10 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {authenticated ? 'Confirm & accept' : 'Step 1 — Create or access your account'}
            </h2>
            <p className="text-neutral-600 mb-8">
              {authenticated
                ? 'Confirm your details, then accept the invitation to join this workspace.'
                : 'Use the invited email for the smoothest experience. You will receive a secure one-time code (or continue with Google / Apple).'}
            </p>

            {authenticated && (
              <div className="space-y-5 mb-8">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Full name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input w-full"
                    placeholder="Your full name"
                    required
                  />
                </div>
                {showPhone && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Phone (optional)</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input w-full"
                      placeholder="+27 …"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Signed in as</label>
                  <input
                    type="email"
                    value={extractEmailFromPrivyUser(user) || expectedEmail || ''}
                    disabled
                    className="input w-full bg-neutral-50 text-neutral-500"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleContinue}
              disabled={claiming || (authenticated && !name.trim())}
              className="w-full btn-primary py-4 text-lg disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {claiming ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Accepting…
                </>
              ) : authenticated ? (
                <>
                  Accept invitation <ArrowRight className="w-5 h-5" />
                </>
              ) : (
                <>
                  Continue securely <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <p className="text-xs text-neutral-500 text-center mt-6 leading-relaxed">
              By continuing you agree to join this organisation on SupplierAdvisor. Invitations expire after 14 days
              and can only be used once.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
