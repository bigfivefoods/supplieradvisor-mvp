'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Legacy invite links used /supplier/complete-profile?token=
 * Redirect to the unified Privy claim flow.
 */
function Redirector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('invite');

  useEffect(() => {
    if (token) {
      router.replace(`/onboarding?invite=${encodeURIComponent(token)}`);
    } else {
      router.replace('/onboarding');
    }
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8] mx-auto mb-4" />
        <p className="text-neutral-600">Opening secure onboarding…</p>
      </div>
    </div>
  );
}

export default function CompleteProfileRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      }
    >
      <Redirector />
    </Suspense>
  );
}
