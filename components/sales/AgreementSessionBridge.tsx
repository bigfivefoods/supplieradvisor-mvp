'use client';

import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { AgreementSessionProvider } from '@/components/sales/agreement-session';

/**
 * Reports the live Privy session to the agreement page.
 * Rendered only under the existing Providers tree (same app id and config).
 */
export function AgreementSessionBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  return (
    <AgreementSessionProvider
      ready={ready}
      authenticated={Boolean(authenticated)}
      privyUserId={privyUserId}
      ensurePrivy={() => {}}
    >
      {children}
    </AgreementSessionProvider>
  );
}
