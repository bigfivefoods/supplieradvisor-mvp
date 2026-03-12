import type { Metadata } from 'next'
import './globals.css'
import { PrivyWrapper } from '@/lib/privy-provider'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'SupplierAdvisor MVP',
  description: 'On-chain B2B/B2C supply chain platform',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="antialiased bg-black text-white">
        <PrivyWrapper>{children}</PrivyWrapper>

        {/* Global toast notifications */}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 6000,
            style: {
              background: '#1a1a1a',
              color: '#ffffff',
              border: '1px solid #333333',
              borderRadius: '12px',
              padding: '16px 24px',
              fontSize: '16px',
              maxWidth: '500px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
            },
            success: {
              style: {
                border: '1px solid #22c55e',
              },
              iconTheme: {
                primary: '#22c55e',
                secondary: '#ffffff',
              },
            },
            error: {
              style: {
                border: '1px solid #ef4444',
              },
              iconTheme: {
                primary: '#ef4444',
                secondary: '#ffffff',
              },
            },
          }}
        />
      </body>
    </html>
  )
}
