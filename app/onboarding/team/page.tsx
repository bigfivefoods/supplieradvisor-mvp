'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import InviteClaimFlow from '@/components/onboarding/InviteClaimFlow';
import Link from 'next/link';

function TeamInviteInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('invite') || searchParams.get('token');

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="max-w-md text-center bg-white border border-neutral-200 rounded-3xl p-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Missing invitation</h1>
          <p className="text-neutral-600 mb-8">
            This team invitation link is incomplete. Ask your admin to resend the invite email.
          </p>
          <Link href="/login" className="btn-primary inline-flex py-3 px-8">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return <InviteClaimFlow token={token} kind="team" />;
}

export default function TeamOnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      }
    >
      <TeamInviteInner />
    </Suspense>
  );
}
