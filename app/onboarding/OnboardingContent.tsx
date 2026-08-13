'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import InviteClaimFlow from '@/components/onboarding/InviteClaimFlow';
import BusinessOnboardingWizard from '@/components/onboarding/BusinessOnboardingWizard';

const PERSONAL_TYPES = new Set(['consumer', 'b2c', 'member', 'personal']);

/**
 * /onboarding
 * - ?invite=TOKEN&kind=business|customer|team → claim invitation (Privy)
 * - ?type=consumer|b2c|member|personal → personal SA Member wallet (no company)
 * - ?type=...      → self-serve multi-step business registration (Privy)
 * - default        → self-serve wizard
 */
export default function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite') || searchParams.get('token');
  const typeParam = String(searchParams.get('type') || '').trim().toLowerCase();
  const kindParam = searchParams.get('kind');
  const kind =
    kindParam === 'customer' ? 'customer' : kindParam === 'team' ? 'team' : 'business';

  useEffect(() => {
    if (inviteToken) return;
    if (PERSONAL_TYPES.has(typeParam)) {
      router.replace('/me');
    }
  }, [inviteToken, typeParam, router]);

  if (!inviteToken && PERSONAL_TYPES.has(typeParam)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <p className="text-sm font-medium text-neutral-600">Opening SA Member…</p>
      </div>
    );
  }

  if (inviteToken) {
    return <InviteClaimFlow token={inviteToken} kind={kind} />;
  }

  return <BusinessOnboardingWizard />;
}
