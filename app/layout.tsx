'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import "./globals.css";
import { Toaster } from "react-hot-toast";

// Onchain providers
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

const config = getDefaultConfig({
  appName: "SupplierAdvisor — Onchain Trust Layer for African Food Security",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [baseSepolia, base],
  ssr: true,
});

const queryClient = new QueryClient();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/sa-logo.png" type="image/png" />
        {/* Paystack Inline Script - Kept for payments */}
        <script src="https://js.paystack.co/v1/inline.js" async />
      </head>
      <body className="antialiased">
        <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
          config={{
            loginMethods: ['email', 'wallet', 'google', 'apple'],
            appearance: { theme: 'light' },
            embeddedWallets: {
              ethereum: {
                createOnLogin: 'users-without-wallets', // Creates embedded wallet automatically
              },
            },
          }}
        >
          <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
              <RainbowKitProvider>
                {children}
                <Toaster position="top-center" />
              </RainbowKitProvider>
            </QueryClientProvider>
          </WagmiProvider>
        </PrivyProvider>
      </body>
    </html>
  );
}