'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'

export default function Home() {
  const router = useRouter()
  const { ready, authenticated, login } = usePrivy()

  // Redirect to onboarding after login
  useEffect(() => {
    if (ready && authenticated) {
      router.push('/onboarding')
    }
  }, [ready, authenticated, router])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-2xl text-white bg-gradient-to-b from-gray-900 to-black">
        Loading...
      </div>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 md:p-24 bg-gradient-to-b from-gray-900 via-gray-950 to-black text-white">
      <h1 className="text-5xl md:text-6xl font-bold mb-6 text-center tracking-tight">
        SupplierAdvisor MVP
      </h1>

      <p className="text-xl md:text-2xl mb-6 text-center text-gray-300 max-w-3xl">
        On-chain B2B/B2C supply chain platform – Built for trust, transparency, and impact.
      </p>

      <p className="text-lg md:text-xl mb-12 text-center text-green-400 font-medium">
        Day 1 complete. Ready for wallet login & onboarding.
      </p>

      {!authenticated ? (
        <button
          onClick={login}
          className="px-10 py-5 md:px-12 md:py-6 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold rounded-2xl text-xl md:text-2xl shadow-2xl transition-all transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-500"
        >
          Connect Wallet to Continue
        </button>
      ) : (
        <p className="text-xl md:text-2xl text-green-400 font-medium animate-pulse">
          Logged in! Redirecting to onboarding...
        </p>
      )}
    </main>
  )
}
