'use client';

/**
 * Invite accept landing — email invite → onboarding with claim + referral attribution.
 * Query: email, companyId|claim, name, ref, message
 */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Building2, Sparkles, Loader2 } from 'lucide-react';

export default function InviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      }
    >
      <InviteInner />
    </Suspense>
  );
}

function InviteInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const email = sp.get('email') || '';
  const claim = sp.get('claim') || sp.get('companyId') || '';
  const name = sp.get('name') || '';
  const ref = sp.get('ref') || sp.get('referral') || '';
  const message = sp.get('message') || '';

  const [seconds, setSeconds] = useState(4);

  const target = useMemo(() => {
    const q = new URLSearchParams();
    q.set('type', 'business');
    if (claim) q.set('claim', claim);
    if (name) q.set('name', name);
    if (ref) q.set('ref', ref);
    if (email) q.set('email', email);
    return `/onboarding?${q.toString()}`;
  }, [claim, name, ref, email]);

  useEffect(() => {
    if (ref && typeof window !== 'undefined') {
      try {
        localStorage.setItem('sa_referral_code', ref);
      } catch {
        /* */
      }
    }
    // Soft: mark invite opened for referrer CRM
    if (ref || email) {
      void fetch('/api/public/invite-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'opened',
          ref: ref || undefined,
          email: email || undefined,
          claim: claim || undefined,
        }),
      }).catch(() => undefined);
    }
  }, [ref, email, claim]);

  useEffect(() => {
    if (seconds <= 0) {
      router.replace(target);
      return;
    }
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [seconds, router, target]);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4">
      <div className="max-w-lg w-full rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-[#00b4d8] mb-4">
          <Sparkles className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          You&apos;re invited to SupplierAdvisor
        </h1>
        <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
          {name
            ? `Join the network${claim ? ` and claim ${name}` : ''}.`
            : 'Join the verified B2B trade network.'}
          {email ? (
            <>
              {' '}
              Invite sent to <strong>{email}</strong>.
            </>
          ) : null}
        </p>
        {message ? (
          <p className="mt-3 text-xs text-slate-500 italic">“{message}”</p>
        ) : null}
        {claim ? (
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-left text-xs text-emerald-950">
            <Building2 className="w-4 h-4 inline mr-1.5" />
            Claim listing #{claim}
            {name ? ` · ${name}` : ''}
            {ref ? ` · referred by ${ref}` : ''}
          </div>
        ) : null}
        <Link
          href={target}
          className="mt-6 btn-primary !py-3 !px-6 text-sm inline-flex items-center gap-2"
        >
          Continue to register
          <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="mt-3 text-[11px] text-neutral-400">
          Redirecting in {seconds}s…
        </p>
        <Link
          href="/directory"
          className="mt-4 block text-xs font-semibold text-[#0077b6] hover:underline"
        >
          Browse directory first
        </Link>
      </div>
    </div>
  );
}
