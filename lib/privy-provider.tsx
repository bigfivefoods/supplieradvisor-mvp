'use client'

import { PrivyProvider } from '@privy-io/react-auth'

export function PrivyWrapper({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  if (!appId) {
    console.error('Missing NEXT_PUBLIC_PRIVY_APP_ID in .env.local')
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Privy App ID missing</div>
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['wallet', 'email', 'google'], // 'wallet' = injected/MetaMask

        appearance: {
          theme: 'dark',
          accentColor: '#10b981',
        },

        // Full chains (fixes previous TS errors)
        supportedChains: [
          {
            id: 1,
            name: 'Ethereum',
            network: 'homestead',
            nativeCurrency: {
              name: 'Ether',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: {
              default: { http: ['https://cloudflare-eth.com'] },
              public: { http: ['https://cloudflare-eth.com'] },
            },
            blockExplorers: {
              default: { name: 'Etherscan', url: 'https://etherscan.io' },
            },
          },
          {
            id: 80002,
            name: 'Polygon Amoy',
            network: 'amoy',
            nativeCurrency: {
              name: 'MATIC',
              symbol: 'MATIC',
              decimals: 18,
            },
            rpcUrls: {
              default: { http: ['https://rpc-amoy.polygon.technology'] },
              public: { http: ['https://rpc-amoy.polygon.technology'] },
            },
            blockExplorers: {
              default: { name: 'PolygonScan Amoy', url: 'https://amoy.polygonscan.com' },
            },
          },
        ],

        // Explicitly disable embedded wallets if not needed (optional)
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },

        // The key fix: do NOT enable Coinbase or WalletConnect
        // Omitting externalWallets prevents Coinbase SDK from loading → no 404 COOP error
      }}
    >
      {children}
    </PrivyProvider>
  )
}
