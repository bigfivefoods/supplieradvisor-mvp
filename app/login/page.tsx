'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { ArrowRight, Loader2, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const claimed = searchParams.get('claimed');
  const next = searchParams.get('next') || '/dashboard/select-company';
  const { login, ready, authenticated } = usePrivy();
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    if (!ready || !authenticated) return;
    setNavigating(true);
    // Delay slightly so mobile session storage is fully written before navigation
    const t = setTimeout(() => {
      router.replace(next);
    }, 250);
    return () => clearTimeout(t);
  }, [ready, authenticated, router, next]);

  const handleLogin = () => {
    if (!ready) return;
    try {
      login();
    } catch (e) {
      console.error('Privy login error:', e);
    }
  };

  if (authenticated || navigating) {
    return (
      <div className="w-full max-w-md text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8] mx-auto mb-4" />
        <p className="text-neutral-600 font-medium">You&apos;re signed in</p>
        <p className="text-sm text-neutral-500 mt-2">Taking you to select a company…</p>
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
          Sign in to choose a company linked to your profile
        </p>
      </div>

      {claimed && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-sm">
          Account ready. Sign in with the same email you used for your invitation.
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
            Google &amp; Apple (use the same account as your other devices)
          </li>
          <li className="flex gap-3 items-start">
            <ShieldCheck className="w-4 h-4 text-[#00b4d8] mt-0.5 flex-shrink-0" />
            Then pick your company from your profile
          </li>
        </ul>

        <button
          type="button"
          onClick={handleLogin}
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
          Tip on phone: prefer <strong>email code</strong> if Google/Apple popups are blocked. Use the{' '}
          <strong>same email</strong> as on your laptop/iPad.
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
