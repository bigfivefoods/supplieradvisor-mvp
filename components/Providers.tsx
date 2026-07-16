'use client';

import { useState } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { Toaster } from 'sonner';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia, sepolia } from 'wagmi/chains';
import ApiAuthBridge from '@/components/auth/ApiAuthBridge';
import InstallAppBanner from '@/components/pwa/InstallAppBanner';
import '@rainbow-me/rainbowkit/styles.css';

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '00000000000000000000000000000000';

const hasRealWalletConnect =
  Boolean(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) &&
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID !== '00000000000000000000000000000000';

/**
 * Chains: Base (inventory passport) + Ethereum Sepolia (POEscrowV2 default).
 * Escrow chain must match NEXT_PUBLIC_PO_ESCROW_CHAIN_ID (default 11155111).
 */
const wagmiConfig = getDefaultConfig({
  appName: 'SupplierAdvisor — Onchain Trust Layer for African Food Security',
  projectId: walletConnectProjectId,
  chains: [sepolia, baseSepolia, base],
  ssr: true,
});

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

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

  if (!privyAppId) {
    console.error('NEXT_PUBLIC_PRIVY_APP_ID is missing — authentication will fail');
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: LOGIN_METHODS as ('email' | 'google' | 'apple' | 'wallet')[],
        appearance: {
          theme: 'light',
          accentColor: '#00b4d8',
          logo: '/sa-logo.png',
          showWalletLoginFirst: false,
          landingHeader: 'Sign in to SupplierAdvisor',
          loginMessage: 'Use the email address your invitation was sent to.',
        },
        // Do NOT auto-create embedded wallets on email login.
        // Wallet creation failures surface as "Something went wrong / Try again later"
        // and block contractor email OTP sign-in. Business users can link wallets later.
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'off',
          },
        },
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            {/*
              Do not use overflow/transform/z-0 wrappers that trap position:fixed
              (landing header must stay viewport-fixed). Isolation is fine.
            */}
            <ApiAuthBridge>
              <div className="min-h-dvh pointer-events-auto isolate">{children}</div>
              <InstallAppBanner />
            </ApiAuthBridge>
            <Toaster position="top-center" richColors closeButton expand={false} />
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
