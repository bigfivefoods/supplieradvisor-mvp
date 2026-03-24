'use client'

import { PrivyProvider } from '@privy-io/react-auth'

export function PrivyWrapper({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  if (!appId) {
    console.error('Missing NEXT_PUBLIC_PRIVY_APP_ID in .env.local')
    return <div className="min-h-screen bg-black text-white flex items-center justify-center text-2xl">Privy App ID missing — check .env.local</div>
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['wallet'], // ← Only MetaMask (injected)
        appearance: {
          theme: 'dark',
          accentColor: '#10b981',
        },
        supportedChains: [{
          id: 80002,
          name: 'Polygon Amoy',
          network: 'amoy',
          nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
          rpcUrls: { default: { http: ['https://rpc-amoy.polygon.technology'] } }
        }]
        // No walletConnectors or externalWallets = no Coinbase SDK = no 404 error
      }}
    >
      {children}
    </PrivyProvider>
  )
}