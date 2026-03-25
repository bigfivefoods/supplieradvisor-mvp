'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { Wallet, ChevronDown } from "lucide-react";

const modules = [
  { id: 'home', name: 'Home', icon: '📊', href: '/dashboard', sub: [] },
  { 
    id: 'suppliers', 
    name: 'Suppliers', 
    icon: '🔍', 
    href: '/dashboard/suppliers', 
    sub: [
      { name: 'Search Suppliers', href: '/dashboard/suppliers/search' },
      { name: 'Connect', href: '/dashboard/suppliers/connect' },
      { name: 'Raise PO', href: '/dashboard/procurement/po' },
      { name: 'OTIFEF Metrics', href: '/otifef' }
    ]
  },
  { 
    id: 'procurement', 
    name: 'Procurement', 
    icon: '📋', 
    href: '/dashboard/procurement', 
    sub: [
      { name: 'Requisitions', href: '/dashboard/procurement/requisitions' },
      { name: 'Purchase Orders', href: '/dashboard/procurement/po' }
    ]
  },
  { id: 'inventory', name: 'Inventory', icon: '📦', href: '/dashboard/inventory', sub: [] },
  { id: 'manufacturing', name: 'Manufacturing', icon: '🏭', href: '/dashboard/manufacturing', sub: [] },
  { id: 'logistics', name: 'Logistics', icon: '🚚', href: '/dashboard/logistics', sub: [] },
  { id: 'quality', name: 'Quality', icon: '✅', href: '/dashboard/quality', sub: [] },
  { id: 'finance', name: 'Finance', icon: '💰', href: '/dashboard/finance', sub: [] },
  { id: 'projects', name: 'Projects', icon: '📋', href: '/dashboard/projects', sub: [] },
  { id: 'people', name: 'People', icon: '👥', href: '/dashboard/people', sub: [] },
  { 
    id: 'governance', 
    name: 'Governance', 
    icon: '🛡️', 
    href: '/dashboard/governance', 
    sub: [
      { name: 'RIAD Dashboard', href: '/dashboard/governance/riad' },
      { name: 'PESTLE Analysis', href: '/dashboard/governance/pestle' }
    ]
  },
  { id: 'ai-lab', name: 'AI Lab', icon: '🧠', href: '/dashboard/ai-lab', sub: [] },
  { id: 'sustainability', name: 'Sustainability', icon: '🌱', href: '/dashboard/sustainability', sub: [] },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith('/dashboard');
  const { user, logout } = usePrivy();
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const toggleModule = (id: string) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isModuleActive = (mod: any) => {
    if (pathname === mod.href) return true;
    if (mod.sub) return mod.sub.some((sub: any) => pathname === sub.href);
    return false;
  };

  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased bg-[#f8fafc] text-[#0f172a] min-h-screen font-sans">
        <div className="flex min-h-screen">
          {isDashboard && (
            <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 flex-shrink-0 shadow-sm overflow-hidden">
              <div className="px-6 pt-5 pb-2 flex justify-center">
                <Image src="/sa-logo.png" alt="SupplierAdvisor" width={140} height={48} priority />
              </div>
              <div className="px-6 pb-4 text-3xl font-black tracking-[-2px] text-[#00b4d8] text-center">SupplierAdvisor</div>

              <div className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5 custom-scrollbar">
                {modules.map(mod => (
                  <div key={mod.id} className="mb-0.5">
                    <div className="flex items-center">
                      <Link
                        href={mod.href}
                        className={`flex-1 flex items-center gap-3 px-5 py-2.5 rounded-3xl text-lg font-medium transition-all hover:bg-slate-100 ${isModuleActive(mod) ? 'bg-[#00b4d8] text-white' : 'text-slate-800'}`}
                      >
                        <span className="text-2xl">{mod.icon}</span>
                        <span className="flex-1 text-left">{mod.name}</span>
                      </Link>

                      {mod.sub?.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            toggleModule(mod.id);
                          }}
                          className="px-3 py-2.5 text-slate-400 hover:text-slate-600"
                        >
                          <ChevronDown className={`transition-transform ${expandedModules[mod.id] ? 'rotate-180' : ''}`} size={18} />
                        </button>
                      )}
                    </div>

                    {mod.sub?.length > 0 && expandedModules[mod.id] && (
                      <div className="ml-11 mt-1 space-y-0.5 mb-2">
                        {mod.sub.map((sub: any, i: number) => (
                          <Link
                            key={i}
                            href={sub.href}
                            className={`block px-6 py-2 rounded-3xl text-[16px] transition-all ${pathname === sub.href ? 'text-[#00b4d8] bg-blue-50 font-medium' : 'text-slate-600 hover:text-slate-900'}`}
                          >
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

          <div className={`flex-1 overflow-auto ${isDashboard ? 'pl-[25px] pr-12 py-12' : 'min-h-screen'}`}>
            {children}
          </div>
        </div>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
