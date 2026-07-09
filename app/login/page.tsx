'use client';

import { Suspense, useEffect } from 'react';
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

  useEffect(() => {
    if (ready && authenticated) {
      router.replace(next);
    }
  }, [ready, authenticated, router, next]);

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-10">
        <Link href="/" className="inline-flex items-center gap-3 mb-8">
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
        <h1 className="text-4xl font-black tracking-[-2px] text-[#00b4d8] mb-2">Welcome back</h1>
        <p className="text-neutral-600">Secure sign-in for your supply-chain workspace</p>
      </div>

      {claimed && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-sm">
          Account ready. Sign in with the same email you used for your invitation.
        </div>
      )}

      <div className="bg-white rounded-3xl border border-neutral-200 p-8 shadow-sm space-y-6">
        <ul className="space-y-3 text-sm text-neutral-700">
          <li className="flex gap-3 items-start">
            <Sparkles className="w-4 h-4 text-[#00b4d8] mt-0.5" />
            Email one-time code — stronger than passwords
          </li>
          <li className="flex gap-3 items-start">
            <Smartphone className="w-4 h-4 text-[#00b4d8] mt-0.5" />
            Google &amp; Apple in one tap
          </li>
          <li className="flex gap-3 items-start">
            <ShieldCheck className="w-4 h-4 text-[#00b4d8] mt-0.5" />
            Wallet-ready for on-chain verification
          </li>
        </ul>

        <button
          type="button"
          onClick={() => login()}
          disabled={!ready}
          className="w-full py-4 bg-[#00b4d8] hover:bg-[#0099b8] text-white text-lg font-semibold rounded-2xl disabled:bg-neutral-400 flex items-center justify-center gap-2 transition-colors"
        >
          {!ready ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Continue securely <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        <p className="text-center text-sm text-neutral-500">
          New business?{' '}
          <Link href="/onboarding?type=business" className="text-[#00b4d8] font-medium hover:underline">
            Start onboarding
          </Link>
        </p>
        <p className="text-center text-sm text-neutral-500">
          Have an invite link? Open it from your email to join automatically.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
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
