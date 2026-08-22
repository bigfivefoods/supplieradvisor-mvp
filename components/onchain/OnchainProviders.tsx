'use client';

import { useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia, sepolia } from 'wagmi/chains';
import '@rainbow-me/rainbowkit/styles.css';

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  '00000000000000000000000000000000';

const wagmiConfig = getDefaultConfig({
  appName: 'SupplierAdvisor — Onchain Trust Layer for African Food Security',
  projectId: walletConnectProjectId,
  chains: [sepolia, baseSepolia, base],
  ssr: true,
});

/** Wallet/RainbowKit only on PO / escrow pages — not on gym, PWA or marketing. */
export function OnchainProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
