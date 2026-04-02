'use client';

import { useState } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { Wallet, ChevronDown, Menu, X } from "lucide-react";

const modules = [
  { id: 'home', name: 'Home', icon: '📊', href: '/dashboard', sub: [] },
  { id: 'profile', name: 'Profile', icon: '👤', href: '/dashboard/profile', sub: [] },
  { id: 'suppliers', name: 'Suppliers', icon: '🔍', href: '/dashboard/suppliers', sub: [ /* your modules */ ] },
  { id: 'customers', name: 'Customers', icon: '🤝', href: '/dashboard/customers', sub: [ /* your modules */ ] },
  { id: 'procurement', name: 'Procurement', icon: '📋', href: '/dashboard/procurement', sub: [ /* your modules */ ] },
  { id: 'inventory', name: 'Inventory', icon: '📦', href: '/dashboard/inventory', sub: [ /* your modules */ ] },
  { id: 'manufacturing', name: 'Manufacturing', icon: '🏭', href: '/dashboard/manufacturing', sub: [ /* your modules */ ] },
  { id: 'logistics', name: 'Logistics', icon: '🚚', href: '/dashboard/logistics', sub: [ /* your modules */ ] },
  { id: 'finance', name: 'Finance', icon: '💰', href: '/dashboard/finance', sub: [ /* your modules */ ] },
  { id: 'projects', name: 'Projects', icon: '📋', href: '/dashboard/projects', sub: [ /* your modules */ ] },
  { id: 'people', name: 'People', icon: '👥', href: '/dashboard/people', sub: [ /* your modules */ ] },
  { id: 'quality', name: 'Quality', icon: '🛡️', href: '/dashboard/quality', sub: [ /* your modules */ ] },
  { id: 'sustainability', name: 'Sustainability', icon: '🌱', href: '/dashboard/sustainability', sub: [ /* your modules */ ] },
  { id: 'ai-lab', name: 'AI Lab', icon: '🤖', href: '/dashboard/ai-lab', sub: [
    { name: 'Pulse Dashboard', href: '/dashboard/ai-lab/pulse-dashboard' },
    { name: 'Predictive Forecasts', href: '/dashboard/ai-lab/predictive-forecasts' },
    { name: 'Neural Insights', href: '/dashboard/ai-lab/neural-insights' },
    { name: 'Simulation Lab', href: '/dashboard/ai-lab/simulation-lab' },
    { name: 'Custom Scorecards', href: '/dashboard/ai-lab/custom-scorecards' }
  ]},
  { id: 'governance', name: 'Governance', icon: '🏛️', href: '/dashboard/governance', sub: [ /* your modules */ ] }
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/sa-logo.png" type="image/png" />
      </head>
      <body>
        <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!} config={{ loginMethods: ['email', 'wallet'], appearance: { theme: 'light' } }}>
          <RootLayoutContent>{children}</RootLayoutContent>
        </PrivyProvider>
      </body>
    </html>
  );
}

function RootLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = usePrivy();
  const pathname = usePathname();
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleModule = (id: string) => setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  const showSidebar = pathname?.startsWith('/dashboard');

  return (
    <div className="flex h-screen">
      {showSidebar && (
        <div className="hidden md:flex w-72 bg-white border-r border-slate-200 flex-col overflow-y-auto">
          {/* your unchanged sidebar code */}
          <div className="p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#00b4d8] rounded-2xl flex items-center justify-center text-white font-black text-3xl">S</div>
              <div className="text-3xl font-black tracking-[-2px]">SupplierAdvisor®</div>
            </div>
          </div>
          <div className="flex-1 p-4">
            {modules.map((mod) => (
              <div key={mod.id} className="mb-1">
                <button onClick={() => toggleModule(mod.id)} className={`w-full flex items-center gap-3 px-6 py-4 rounded-3xl text-left transition-all ${pathname === mod.href ? 'bg-[#00b4d8] text-white' : 'hover:bg-slate-100'}`}>
                  <span className="text-2xl">{mod.icon}</span>
                  <span className="font-semibold text-lg">{mod.name}</span>
                  {mod.sub && mod.sub.length > 0 && <ChevronDown className={`ml-auto transition ${expandedModules[mod.id] ? 'rotate-180' : ''}`} />}
                </button>
                {mod.sub && mod.sub.length > 0 && expandedModules[mod.id] && (
                  <div className="ml-12 mt-1 space-y-0.5">
                    {mod.sub.map((sub, i) => (
                      <Link key={i} href={sub.href} className={`block px-6 py-3 rounded-3xl text-[15px] transition-all ${pathname === sub.href ? 'text-[#00b4d8] bg-blue-50 font-medium' : 'text-slate-600 hover:text-slate-900'}`}>
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="p-4 border-t mt-auto">
            <button onClick={logout} className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-black text-white font-medium py-3.5 rounded-3xl transition-all text-sm">
              <Wallet size={18} /> {user ? 'Disconnect Wallet' : 'Connect Wallet'}
            </button>
          </div>
        </div>
      )}

      {showSidebar && (
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden fixed top-6 left-6 z-50 p-3 bg-white rounded-3xl shadow-lg">
          {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      )}

      <div className={`flex-1 overflow-auto ${showSidebar ? 'pl-0 pr-12 py-12 md:pl-72' : 'min-h-screen'}`}>
        {children}
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
