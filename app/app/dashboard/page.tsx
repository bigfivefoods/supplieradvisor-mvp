'use client'

import { useState } from 'react'
import Link from 'next/link'

// Mock data (replace with real fetch later)
const mockProfile = {
  user_id: 'did:privy:cmmkpm8vy02710cjx930ju861',
  address: '123 Main Road, Durban, KwaZulu-Natal',
  bank_account: 'FNB | Acc: 12345678901 | Branch: 250655',
  vat_number: '4123456789',
  business_type: 'Foods',
  npo_number: null,
  created_at: '2026-03-12T10:00:00Z',
  updated_at: '2026-03-12T10:00:00Z',
}

export default function Dashboard() {
  const [profile] = useState(mockProfile) // replace with real state + fetch later

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white">
              Your Dashboard
            </h1>
            <p className="text-xl text-gray-400 mt-3">
              Wallet: {profile.user_id.slice(0, 10)}...{profile.user_id.slice(-6)}
            </p>
          </div>

          <div className="flex gap-4">
            <Link
              href="/onboarding"
              className="px-8 py-4 bg-green-600 hover:bg-green-700 rounded-2xl text-white font-medium transition shadow-lg"
            >
              Edit Profile
            </Link>
            <button
              onClick={() => alert('Logout coming soon – currently bypassed')}
              className="px-8 py-4 bg-red-600/80 hover:bg-red-700 rounded-2xl text-white font-medium transition shadow-lg"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-10 backdrop-blur-xl shadow-2xl">
          <div className="flex justify-between items-start mb-8">
            <h2 className="text-4xl font-bold text-green-400">Business Profile</h2>
            <div className="inline-block px-6 py-3 bg-yellow-600/30 border border-yellow-500 rounded-2xl text-yellow-300 font-medium">
              Self-Verified (Pending Third-Party)
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-lg">
            <div>
              <p className="text-gray-400 mb-1 font-medium">User ID</p>
              <p className="text-white break-all">{profile.user_id}</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1 font-medium">Address</p>
              <p className="text-white">{profile.address}</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1 font-medium">Bank Account</p>
              <p className="text-white">{profile.bank_account}</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1 font-medium">VAT Number</p>
              <p className="text-white">{profile.vat_number || 'None'}</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1 font-medium">Business Type</p>
              <p className="text-white font-semibold">{profile.business_type}</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1 font-medium">NPO Number</p>
              <p className="text-white">{profile.npo_number || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1 font-medium">Created</p>
              <p className="text-white">{new Date(profile.created_at).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Placeholder sections for future content */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-10 backdrop-blur-xl shadow-2xl">
            <h3 className="text-2xl font-bold mb-6 text-green-400">Certificates</h3>
            <p className="text-gray-400">No certificates uploaded yet.</p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-10 backdrop-blur-xl shadow-2xl">
            <h3 className="text-2xl font-bold mb-6 text-green-400">Recent Activity</h3>
            <p className="text-gray-400">No activity yet — start connecting with suppliers.</p>
          </div>
        </div>
      </div>
    </div>
  )
}