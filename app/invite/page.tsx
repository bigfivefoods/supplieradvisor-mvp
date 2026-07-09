'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import InviteClaimFlow from '@/components/onboarding/InviteClaimFlow';
import Link from 'next/link';

/**
 * /invite?token= or /invite?invite=
 * Unified entry for team invites (also supports business tokens via kind query).
 */
function InviteRouter() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('invite');
  const kindParam = searchParams.get('kind');
  const kind = kindParam === 'business' ? 'business' : 'team';

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="max-w-md text-center bg-white border border-neutral-200 rounded-3xl p-10">
          <h1 className="text-3xl font-bold mb-3">Missing invitation</h1>
          <p className="text-neutral-600 mb-8">This link is incomplete.</p>
          <Link href="/" className="btn-primary py-3 px-8 inline-flex">
            Home
          </Link>
        </div>
      </div>
    );
  }

  return <InviteClaimFlow token={token} kind={kind} />;
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      }
    >
      <InviteRouter />
    </Suspense>
  );
}
