'use client';

import { useSearchParams } from 'next/navigation';
import InviteClaimFlow from '@/components/onboarding/InviteClaimFlow';
import BusinessOnboardingWizard from '@/components/onboarding/BusinessOnboardingWizard';

/**
 * /onboarding
 * - ?invite=TOKEN  → claim business/supplier invitation (Privy)
 * - ?type=...      → self-serve multi-step business registration (Privy)
 * - default        → self-serve wizard
 */
export default function OnboardingContent() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite') || searchParams.get('token');

  if (inviteToken) {
    return <InviteClaimFlow token={inviteToken} kind="business" />;
  }

  return <BusinessOnboardingWizard />;
}
