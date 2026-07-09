'use client';

import { useState } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { Toaster } from 'sonner';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';
import '@rainbow-me/rainbowkit/styles.css';

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '00000000000000000000000000000000';

const wagmiConfig = getDefaultConfig({
  appName: 'SupplierAdvisor — Onchain Trust Layer for African Food Security',
  projectId: walletConnectProjectId,
  chains: [baseSepolia, base],
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        // Email first — most reliable on mobile browsers (no popup blockers)
        loginMethods: ['email', 'google', 'apple', 'wallet'],
        appearance: {
          theme: 'light',
          accentColor: '#00b4d8',
          logo: '/sa-logo.png',
          showWalletLoginFirst: false,
        },
        // Improve session restore across mobile Safari / in-app browsers
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            {/* Ensure app content is always interactive above wallet portals */}
            <div className="relative z-0 min-h-screen pointer-events-auto">{children}</div>
            <Toaster position="top-center" richColors closeButton expand={false} />
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
