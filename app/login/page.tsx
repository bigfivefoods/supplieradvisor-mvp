'use client';

import { Suspense, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { ArrowRight, Loader2 } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const claimed = searchParams.get('claimed');
  const { login, ready, authenticated } = usePrivy();

  useEffect(() => {
    if (ready && authenticated) {
      router.replace('/dashboard/select-company');
    }
  }, [ready, authenticated, router]);

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
        <h1 className="text-4xl font-black tracking-[-2px] text-[#00b4d8] mb-2">Welcome Back</h1>
        <p className="text-neutral-600">Sign in to manage your supply chain workspace</p>
      </div>

      {claimed && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-sm">
          Account created successfully! Sign in to continue.
        </div>
      )}

      <div className="bg-white rounded-3xl border border-neutral-200 p-8 shadow-sm space-y-6">
        <p className="text-neutral-600 text-center">
          Use email, Google, Apple, or your wallet — the same secure login used across SupplierAdvisor.
        </p>

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
              Continue <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        <p className="text-center text-sm text-neutral-500">
          New here?{' '}
          <Link href="/onboarding" className="text-[#00b4d8] font-medium hover:underline">
            Join the beta
          </Link>
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
