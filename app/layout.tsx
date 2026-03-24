'use client'

import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import "./globals.css";
import { Toaster } from "react-hot-toast";

const modules = [
  { id: 'home', name: 'Home', icon: '📊', href: '/dashboard', sub: [] },
  { id: 'finance', name: 'Finance', icon: '💰', href: '/dashboard/finance', sub: [] },
  { id: 'crm', name: 'CRM', icon: '🤝', href: '/dashboard/crm', sub: [{ name: 'Search Customers', href: '/dashboard/crm/search' }, { name: 'Quote', href: '/dashboard/crm/quote' }, { name: 'Review', href: '/dashboard/crm/review' }] },
  { id: 'srm', name: 'SRM', icon: '🔍', href: '/dashboard/srm', sub: [{ name: 'Search Suppliers', href: '/dashboard/srm/search' }, { name: 'Connect', href: '/dashboard/srm/connect' }, { name: 'Raise PO', href: '/dashboard/srm/po' }, { name: 'OTIFEF Metrics', href: '/dashboard/srm/otifef' }] },
  { id: 'inventory', name: 'Inventory', icon: '📦', href: '/dashboard/inventory', sub: [{ name: 'Raw Materials', href: '/dashboard/inventory/raw-materials' }, { name: 'Finished Goods', href: '/dashboard/inventory/finished-goods' }, { name: 'Warehouses & Containers', href: '/dashboard/inventory/warehouses' }, { name: 'Transfers', href: '/dashboard/inventory/transfer' }, { name: 'Stock Take', href: '/dashboard/inventory/stock-take' }] },
  { id: 'manufacturing', name: 'Manufacturing', icon: '🏭', href: '/dashboard/manufacturing', sub: [] },
  { id: 'logistics', name: 'Logistics', icon: '🚛', href: '/dashboard/logistics', sub: [{ name: 'Inbound', href: '/dashboard/logistics/inbound' }, { name: 'Live Tracking', href: '/dashboard/logistics/tracking' }, { name: 'Outbound', href: '/dashboard/logistics/outbound' }, { name: 'Fleet & Vehicles', href: '/dashboard/logistics/vehicles' }, { name: 'Drivers', href: '/dashboard/logistics/drivers' }] },
  { id: 'leadership', name: 'Leadership', icon: '👑', href: '/dashboard/leadership-lab', sub: [{ name: 'Assessment', href: '/dashboard/leadership-lab/assessment' }, { name: 'Choices', href: '/dashboard/leadership-lab/modules/choices' }, { name: 'Principles', href: '/dashboard/leadership-lab/modules/principles' }, { name: 'Mind', href: '/dashboard/leadership-lab/modules/mind' }, { name: 'Heart', href: '/dashboard/leadership-lab/modules/heart' }, { name: 'Body', href: '/dashboard/leadership-lab/modules/body' }, { name: 'Spirit', href: '/dashboard/leadership-lab/modules/spirit' }, { name: 'Progress Dashboard', href: '/dashboard/leadership-lab/dashboard' }] },
  { id: 'projects', name: 'Projects', icon: '📋', href: '/dashboard/projects', sub: [] },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = usePrivy()
  const pathname = usePathname()
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({})

  const toggleModule = (id: string) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased bg-[#f8fafc] text-[#0f172a] min-h-screen">
        <div className="flex min-h-screen">
          
          {/* Sticky Vertical Sidebar */}
          <div className="w-80 bg-white border-r border-slate-200 flex flex-col h-screen flex-shrink-0 shadow-sm sticky top-0 overflow-y-auto">
            
            {/* Logo */}
            <div className="px-8 pt-8 pb-4 flex justify-center">
              <Image 
                src="/sa-logo.png" 
                alt="SupplierAdvisor" 
                width={180} 
                height={80} 
                priority 
                className="drop-shadow-sm"
              />
            </div>

            <div className="px-8 pb-8 text-4xl font-black tracking-tighter text-[#00b4d8] text-center">SupplierAdvisor</div>
            
            {modules.map(mod => (
              <div key={mod.id} className="px-4">
                <div className="flex items-center">
                  <Link 
                    href={mod.href}
                    className={`flex-1 flex items-center gap-4 px-6 py-5 rounded-2xl text-xl font-medium transition-all ${
                      pathname === mod.href 
                        ? 'bg-[#00b4d8] text-white' 
                        : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <span className="text-3xl">{mod.icon}</span>
                    {mod.name}
                  </Link>

                  {mod.sub.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        toggleModule(mod.id)
                      }}
                      className="px-4 py-5 text-3xl text-slate-400 hover:text-slate-600 transition-all"
                    >
                      {expandedModules[mod.id] ? '▼' : '▶'}
                    </button>
                  )}
                </div>

                {mod.sub.length > 0 && expandedModules[mod.id] && (
                  <div className="ml-12 mt-1 space-y-1">
                    {mod.sub.map((sub, i) => (
                      <Link 
                        key={i} 
                        href={sub.href}
                        className={`block px-6 py-3 rounded-2xl text-lg transition-all ${
                          pathname === sub.href ? 'text-[#00b4d8]' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-auto pl-[25px] pr-12 py-12 bg-[#f8fafc]">
            {children}
          </div>
        </div>
        <Toaster position="top-center" />
      </body>
    </html>
  )
}