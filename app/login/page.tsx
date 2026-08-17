'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { AuthLoginActions } from '@/components/auth/AuthLoginActions';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const claimed = searchParams.get('claimed');
  const next = searchParams.get('next') || '';
  const prefillEmail = searchParams.get('email') || '';
  const isContractorFlow =
    next.startsWith('/contractor') || next.includes('contractor');
  const { ready, authenticated, user } = usePrivy();
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    if (!ready || !authenticated || !user) return;
    setNavigating(true);

    const t = setTimeout(async () => {
      // Prefer explicit next for invite / storefront return paths
      if (
        next.startsWith('/contractor/invite') ||
        next.startsWith('/onboarding') ||
        next.startsWith('/invite') ||
        next.startsWith('/store')
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
        // Explicit B2C member hub
        if (next.startsWith('/me') || next.startsWith('/hire/') || next.startsWith('/member/')) {
          router.replace(next || '/me');
          return;
        }
        // Business users (or dual role) → company select / requested next
        // Pure B2C (no business membership) → consumer hub
        if (!data.isBusinessUser && !data.isContractor) {
          router.replace(next || '/me');
          return;
        }
        router.replace(next || '/dashboard/select-company');
      } catch {
        // Prefer B2C hub when next is consumer-ish; otherwise company select
        if (next.startsWith('/me') || next.startsWith('/hire') || next.startsWith('/member')) {
          router.replace(next);
        } else {
          router.replace(next || '/dashboard/select-company');
        }
      }
    }, 300);

    return () => clearTimeout(t);
  }, [ready, authenticated, user, router, next]);

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
            width={140}
            height={60}
            className="h-12 w-auto object-contain"
            priority
          />
          <span className="font-black text-2xl tracking-[-1px] text-slate-900">
            SupplierAdvisor®
          </span>
        </Link>
        <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-[#00b4d8] mb-2">
          {next.startsWith('/me') ? 'SA Member' : 'Welcome back'}
        </h1>
        <p className="text-neutral-600 text-sm sm:text-base px-2">
          {isContractorFlow
            ? 'Independent contractor operator portal'
            : next.startsWith('/me')
              ? 'Create a free personal account, or sign in if you already have one'
              : 'Company workspace, or SA Member if you are a customer'}
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

      <div className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 shadow-sm space-y-5 sm:space-y-6">
        <ul className="space-y-3 text-sm text-neutral-700">
          <li className="flex gap-3 items-start">
            <Sparkles className="w-4 h-4 text-[#00b4d8] mt-0.5 flex-shrink-0" />
            Google, Apple, or email one-time code
          </li>
          <li className="flex gap-3 items-start">
            <Smartphone className="w-4 h-4 text-[#00b4d8] mt-0.5 flex-shrink-0" />
            Operators land on their container portal only
          </li>
          <li className="flex gap-3 items-start">
            <ShieldCheck className="w-4 h-4 text-[#00b4d8] mt-0.5 flex-shrink-0" />
            Same login can run a company and still keep a personal SA Member wallet
          </li>
        </ul>

        {!ready ? (
          <div className="flex min-h-[52px] items-center justify-center text-neutral-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <AuthLoginActions prefillEmail={prefillEmail || undefined} />
        )}

        <p className="text-center text-xs sm:text-sm text-neutral-500 leading-relaxed">
          Contractors: use the email from your invitation. Customers and members: the same login
          opens SA Member. Running a company does not replace your personal wallet.
        </p>

        <p className="text-center text-sm text-neutral-500">
          New customer or member?{' '}
          <Link href="/me" className="text-[#00b4d8] font-medium hover:underline">
            Create a free SA Member account
          </Link>
        </p>
        <p className="text-center text-sm text-neutral-500">
          New business?{' '}
          <Link href="/join" className="text-[#00b4d8] font-medium hover:underline">
            Choose company or government
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-sa-bg px-4 sm:px-6 py-10">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
        <ThemeToggle />
      </div>
      <Suspense
        fallback={
          <div className="w-full max-w-md text-center text-neutral-500">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-3 text-[#00b4d8]" />
            <p className="font-medium text-slate-700">SupplierAdvisor®</p>
            <p className="text-sm mt-1">Loading secure login…</p>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
