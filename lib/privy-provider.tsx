'use client'

import { PrivyProvider } from '@privy-io/react-auth'

export function PrivyWrapper({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ['wallet', 'email', 'google'],
        appearance: {
          theme: 'dark',
          accentColor: '#10b981',
        },
        // Add Polygon Amoy later when we do wagmi
      }}
    >
      {children}
    </PrivyProvider>
  )
}
