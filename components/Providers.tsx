'use client';

import { PrivyProvider, useLoginWithOAuth } from '@privy-io/react-auth';
import ApiAuthBridge from '@/components/auth/ApiAuthBridge';

const hasRealWalletConnect =
  Boolean(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) &&
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID !==
    '00000000000000000000000000000000';

/**
 * Privy login methods. Prefer email/social for contractors & mobile.
 * Wallet is optional and only advertised when WalletConnect is configured —
 * a dummy WC project id often causes "Something went wrong" in the modal.
 */
const LOGIN_METHODS = (
  hasRealWalletConnect
    ? (['email', 'google', 'apple', 'wallet'] as const)
    : (['email', 'google', 'apple'] as const)
).slice();

/** Complete Google/Apple redirect on app routes. */
function PrivyOauthCompleter() {
  useLoginWithOAuth();
  return null;
}

/** Privy only — theme/PWA live on PublicProviders (root). */
export function Providers({ children }: { children: React.ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

  if (!privyAppId) {
    console.error(
      'NEXT_PUBLIC_PRIVY_APP_ID is missing — authentication will fail'
    );
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: LOGIN_METHODS as (
          | 'email'
          | 'google'
          | 'apple'
          | 'wallet'
        )[],
        allowOAuthInEmbeddedBrowsers: true,
        appearance: {
          theme: 'light',
          accentColor: '#00b4d8',
          logo: '/sa-logo.png',
          showWalletLoginFirst: false,
          landingHeader: 'Sign in to SupplierAdvisor',
          loginMessage: 'Google, Apple, or the email on your invitation.',
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'off',
          },
        },
      }}
    >
      <ApiAuthBridge>
        <PrivyOauthCompleter />
        {children}
      </ApiAuthBridge>
    </PrivyProvider>
  );
}
