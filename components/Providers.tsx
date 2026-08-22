'use client';

import { PrivyProvider, useLoginWithOAuth } from '@privy-io/react-auth';
import { Toaster } from 'sonner';
import ApiAuthBridge from '@/components/auth/ApiAuthBridge';
import SchemaHealthBanner from '@/components/system/SchemaHealthBanner';

import InstallAppBanner from '@/components/pwa/InstallAppBanner';
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister';
import { ThemeProvider, useTheme } from '@/components/theme/ThemeProvider';

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

function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      expand={false}
      theme={resolved}
    />
  );
}

/** Complete Google/Apple redirect on any path (gym PWA may land the callback). */
function PrivyOauthCompleter() {
  useLoginWithOAuth();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

  if (!privyAppId) {
    console.error(
      'NEXT_PUBLIC_PRIVY_APP_ID is missing — authentication will fail'
    );
  }

  return (
    <ThemeProvider>
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
          <ServiceWorkerRegister />
          <SchemaHealthBanner />
          <div className="min-h-dvh pointer-events-auto isolate bg-sa-bg text-sa-text">
            {children}
          </div>
          <InstallAppBanner />
        </ApiAuthBridge>
        <ThemedToaster />
      </PrivyProvider>
    </ThemeProvider>
  );
}
