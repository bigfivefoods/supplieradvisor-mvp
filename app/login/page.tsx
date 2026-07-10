'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { ArrowRight, Loader2, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const claimed = searchParams.get('claimed');
  const next = searchParams.get('next') || '';
  const prefillEmail = searchParams.get('email') || '';
  const isContractorFlow =
    next.startsWith('/contractor') || next.includes('contractor');
  const { login, ready, authenticated, user } = usePrivy();
  const [navigating, setNavigating] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated || !user) return;
    setNavigating(true);

    const t = setTimeout(async () => {
      // Prefer explicit next for invite flows (preserve full query string)
      if (
        next.startsWith('/contractor/invite') ||
        next.startsWith('/onboarding') ||
        next.startsWith('/invite')
      ) {
        router.replace(next);
        return;
      }

      try {
        const res = await fetch('/api/contractor/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privyUserId: getCanonicalUserId(user.id),
            email: extractEmailFromPrivyUser(user),
          }),
        });
        const data = await res.json();

        // Pure operators → contractor portal only
        if (data.isContractor && !data.isBusinessUser) {
          router.replace(next.startsWith('/contractor') ? next : '/contractor');
          return;
        }
        // Explicit contractor next
        if (next.startsWith('/contractor')) {
          router.replace(next);
          return;
        }
        // Business users (or dual role) → company select / requested next
        router.replace(next || '/dashboard/select-company');
      } catch {
        router.replace(next || '/dashboard/select-company');
      }
    }, 300);

    return () => clearTimeout(t);
  }, [ready, authenticated, user, router, next]);

  const handleLogin = async () => {
    if (!ready) return;
    setLoginError(null);
    try {
      // Contractors / invite flows: email + social only (no wallet) for reliability
      if (isContractorFlow) {
        await login({
          loginMethods: ['email', 'google', 'apple'],
          ...(prefillEmail
            ? { prefill: { type: 'email' as const, value: prefillEmail } }
            : {}),
        });
      } else {
        await login({
          loginMethods: ['email', 'google', 'apple'],
          ...(prefillEmail
            ? { prefill: { type: 'email' as const, value: prefillEmail } }
            : {}),
        });
      }
    } catch (e: unknown) {
      console.error('Privy login error:', e);
      setLoginError(
        e instanceof Error
          ? e.message
          : 'Sign-in failed. Check that this site is allowed in Privy (www.supplieradvisor.com) and try email one-time code again.'
      );
    }
  };

  if (authenticated || navigating) {
    return (
      <div className="w-full max-w-md text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8] mx-auto mb-4" />
        <p className="text-neutral-600 font-medium">You&apos;re signed in</p>
        <p className="text-sm text-neutral-500 mt-2">Opening your workspace…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8 sm:mb-10">
        <Link href="/" className="inline-flex items-center gap-3 mb-6 sm:mb-8">
          <Image
            src="/sa-logo.png"
            alt="SupplierAdvisor"
            width={48}
            height={48}
            className="rounded-2xl"
            priority
          />
          <span className="font-black text-2xl tracking-[-1px] text-slate-900">
            SupplierAdvisor®
          </span>
        </Link>
        <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-[#00b4d8] mb-2">
          Welcome back
        </h1>
        <p className="text-neutral-600 text-sm sm:text-base px-2">
          {isContractorFlow
            ? 'Independent contractor operator portal'
            : 'Business workspace or contractor operator portal'}
        </p>
      </div>

      {claimed && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-sm">
          Account ready. Sign in with the same email you used for your invitation.
        </div>
      )}

      {isContractorFlow && prefillEmail && (
        <div className="mb-6 p-4 bg-sky-50 border border-sky-200 rounded-2xl text-sky-900 text-sm">
          Operator invite — sign in with <strong>{prefillEmail}</strong>
        </div>
      )}

      {loginError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
          {loginError}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 shadow-sm space-y-5 sm:space-y-6">
        <ul className="space-y-3 text-sm text-neutral-700">
          <li className="flex gap-3 items-start">
            <Sparkles className="w-4 h-4 text-[#00b4d8] mt-0.5 flex-shrink-0" />
            Email one-time code — works great on mobile
          </li>
          <li className="flex gap-3 items-start">
            <Smartphone className="w-4 h-4 text-[#00b4d8] mt-0.5 flex-shrink-0" />
            Operators land on their container portal only
          </li>
          <li className="flex gap-3 items-start">
            <ShieldCheck className="w-4 h-4 text-[#00b4d8] mt-0.5 flex-shrink-0" />
            Business users select a company workspace
          </li>
        </ul>

        <button
          type="button"
          onClick={() => void handleLogin()}
          disabled={!ready}
          className="w-full min-h-[52px] py-4 bg-[#00b4d8] hover:bg-[#0099b8] active:bg-[#0088a6] text-white text-lg font-semibold rounded-2xl disabled:bg-neutral-400 flex items-center justify-center gap-2 transition-colors touch-manipulation"
        >
          {!ready ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Continue securely <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        <p className="text-center text-xs sm:text-sm text-neutral-500 leading-relaxed">
          Contractors: use the email from your invitation. Business teams: use your company login.
        </p>

        <p className="text-center text-sm text-neutral-500">
          New business?{' '}
          <Link href="/onboarding?type=business" className="text-[#00b4d8] font-medium hover:underline">
            Start onboarding
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4 sm:px-6 py-10">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-neutral-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading…
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
