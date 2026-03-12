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
        // Login methods – 'wallet' enables injected (MetaMask)
        loginMethods: ['wallet', 'email', 'google'],

        appearance: {
          theme: 'dark',
          accentColor: '#10b981',
          logo: '/logo.png', // optional
        },

        // Full Chain objects – required to avoid TS errors
        supportedChains: [
          // Ethereum Mainnet (optional)
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
          // Polygon Amoy testnet
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

        // Use embeddedWallets to avoid external SDKs (Coinbase/WalletConnect crash)
        embeddedWallets: {
          createOnLogin: 'users-without-wallets', // auto-create if no wallet
          noPromptOnSignature: false,
        },

        // Do NOT include externalWallets – omitting disables them
        // This stops Coinbase SDK from loading → no COOP 404 crash
      }}
    >
      {children}
    </PrivyProvider>
  )
}