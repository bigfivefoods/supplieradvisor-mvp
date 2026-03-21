'use client'

import { useState, useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const modules = [
  { id: 'home', name: 'Home (Operations)', icon: '📊' },
  { id: 'srm', name: 'SRM', icon: '🔍' },
  { id: 'crm', name: 'CRM', icon: '🤝' },
  { id: 'finance', name: 'Finance', icon: '💰' },
  { id: 'logistics', name: 'Logistics', icon: '🚛' },
  { id: 'projects', name: 'Projects', icon: '📋' },
  { id: 'leadership', name: 'Leadership', icon: '👑' },
  { id: 'inventory', name: 'Inventory', icon: '📦' },
  { id: 'manufacturing', name: 'Manufacturing', icon: '🏭' },
] as const

type ModuleId = typeof modules[number]['id']

export default function Dashboard() {
  const { user, logout } = usePrivy()
  const [profile, setProfile] = useState<any>(null)
  const [activeModule, setActiveModule] = useState<ModuleId>('home')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('id', { ascending: false })
        .limit(1)
        .single()
      setProfile(data)
      setLoading(false)
    }
    fetchProfile()
  }, [user?.id])

  const renderModule = () => {
    switch (activeModule) {
      case 'home':
        return (
          <div>
            <h2 className="text-7xl font-black tracking-[-3px] mb-12 text-white">Operations Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { label: 'Active POs', value: '12', icon: '📦' },
                { label: 'Avg Rating', value: '4.98', icon: '⭐' },
                { label: 'New Connections', value: '7', icon: '🔗' },
                { label: 'Revenue This Month', value: 'R 248k', icon: '📈' },
              ].map((stat, i) => (
                <div key={i} className="group bg-zinc-900/80 backdrop-blur-3xl border border-emerald-500/30 hover:border-emerald-400 rounded-3xl p-10 hover:-translate-y-3 transition-all shadow-[0_0_80px_-20px] shadow-emerald-500/30">
                  <div className="text-7xl mb-6 opacity-80">{stat.icon}</div>
                  <div className="text-7xl font-black text-emerald-400">{stat.value}</div>
                  <div className="text-zinc-400 mt-3 text-2xl">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-16">
              <p className="uppercase text-emerald-400 text-xs tracking-[4px] mb-6">PINNED WIDGET — X FEED</p>
              <div className="bg-black/70 backdrop-blur-3xl border border-emerald-500/30 rounded-3xl p-20 text-center text-zinc-400 text-2xl">
                Real-time X/Twitter news from @SANTACO or xe.com will appear here
              </div>
            </div>
          </div>
        )
      default:
        return <div className="text-6xl font-light text-emerald-400">Module: {activeModule.toUpperCase()} (coming soon)</div>
    }
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-3xl">Loading Tesla Console...</div>

  return (
    <div className="min-h-screen bg-[#050505] text-white flex overflow-hidden">
      <div className="w-80 bg-black/95 backdrop-blur-3xl border-r border-white/10 flex flex-col">
        <div className="p-10 border-b border-white/10">
          <div className="text-5xl font-black tracking-[-2px] text-emerald-400">SupplierAdvisor</div>
          <div className="text-xs text-zinc-500 mt-1">MVP v1.0</div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          {modules.map(mod => (
            <button
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className={`w-full flex items-center gap-5 px-8 py-6 rounded-3xl mb-2 text-left transition-all text-xl font-medium ${
                activeModule === mod.id ? 'bg-emerald-600 text-white shadow-[0_0_60px_-10px] shadow-emerald-500' : 'hover:bg-white/5 text-zinc-300'
              }`}
            >
              <span className="text-4xl opacity-80">{mod.icon}</span>
              {mod.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-12 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-16">
            <div>
              <div className="text-7xl font-black tracking-[-3px]">Console</div>
              <div className="text-emerald-400 text-sm mt-1">Logged in as {user?.wallet?.address?.slice(0,6)}...{user?.wallet?.address?.slice(-4)}</div>
            </div>
            <div className="flex gap-4">
              <Link href="/onboarding" className="px-10 py-5 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl transition">Edit Profile</Link>
              <button onClick={logout} className="px-10 py-5 bg-red-600/80 hover:bg-red-700 rounded-3xl transition">Log Out</button>
            </div>
          </div>

          {renderModule()}
        </div>
      </div>
    </div>
  )
}