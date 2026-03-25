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
      { name: 'Onboard Suppliers', href: '/dashboard/suppliers/onboard' },
      { name: 'Supplier Profiles', href: '/dashboard/suppliers/profiles' },
      { name: 'Connect', href: '/dashboard/suppliers/connect' },
      { name: 'Raise PO', href: '/dashboard/procurement/po' },
      { name: 'Supplier Contracts', href: '/dashboard/suppliers/contracts' },
      { name: 'Supplier Metrics', href: '/dashboard/suppliers/metrics' },
      { name: 'Performance Scorecards', href: '/dashboard/suppliers/scorecards' },
      { name: 'Supplier Portal', href: '/dashboard/suppliers/portal' },
      { name: 'Risk Alerts', href: '/dashboard/suppliers/risks' },
      { name: 'OTIFEF Metrics', href: '/otifef' }
    ]
  },
  { 
    id: 'customers', 
    name: 'Customers', 
    icon: '🤝', 
    href: '/dashboard/customers', 
    sub: [
      { name: 'Search Customers', href: '/dashboard/customers/search' },
      { name: 'Profiles', href: '/dashboard/customers' },
      { name: 'Quotes & Orders', href: '/dashboard/customers/orders' }
    ]
  },
  { 
    id: 'procurement', 
    name: 'Procurement', 
    icon: '📋', 
    href: '/dashboard/procurement', 
    sub: [
      { name: 'Requisitions', href: '/dashboard/procurement/requisitions' },
      { name: 'Bids & Negotiation', href: '/dashboard/procurement/bids' },
      { name: 'Purchase Orders', href: '/dashboard/procurement/po' }
    ]
  },
  { 
    id: 'inventory', 
    name: 'Inventory', 
    icon: '📦', 
    href: '/dashboard/inventory', 
    sub: [
      { name: 'Raw Materials', href: '/dashboard/inventory/raw-materials' },
      { name: 'Finished Goods', href: '/dashboard/inventory/finished-goods' },
      { name: 'Warehouses & Containers', href: '/dashboard/inventory/warehouses' },
      { name: 'Transfers', href: '/dashboard/inventory/transfers' },
      { name: 'Cycle Counts', href: '/dashboard/inventory/cycle-counts' }
    ]
  },
  { 
    id: 'manufacturing', 
    name: 'Manufacturing', 
    icon: '🏭', 
    href: '/dashboard/manufacturing', 
    sub: [
      { name: 'Master Production Schedule (MPS)', href: '/dashboard/manufacturing/mps' },
      { name: 'Materials Requirements Planning (MRP)', href: '/dashboard/manufacturing/mrp' },
      { name: 'BOM / Recipes', href: '/dashboard/manufacturing/bom' },
      { name: 'Batch Creation & Traceability', href: '/dashboard/manufacturing/batches' },
      { name: 'Yield & Waste Analytics', href: '/dashboard/manufacturing/yield' }
    ]
  },
  { 
    id: 'logistics', 
    name: 'Logistics', 
    icon: '🚚', 
    href: '/dashboard/logistics', 
    sub: [
      { name: 'Inbound / Outbound Shipments', href: '/dashboard/logistics/shipments' },
      { name: 'Live Tracking Dashboard', href: '/dashboard/logistics/tracking' },
      { name: 'Fleet & Driver Management', href: '/dashboard/logistics/fleet' },
      { name: 'Incoterms & Cross-Border', href: '/dashboard/logistics/incoterms' },
      { name: 'Proof-of-Delivery', href: '/dashboard/logistics/pod' }
    ]
  },
  { 
    id: 'quality', 
    name: 'Quality', 
    icon: '✅', 
    href: '/dashboard/quality', 
    sub: [
      { name: 'Inspections & Checklists', href: '/dashboard/quality/inspections' },
      { name: 'HACCP / Food Safety Records', href: '/dashboard/quality/haccp' },
      { name: 'Traceability Graph', href: '/dashboard/quality/traceability' },
      { name: 'Regulatory Reports', href: '/dashboard/quality/reports' }
    ]
  },
  { 
    id: 'finance', 
    name: 'Finance', 
    icon: '💰', 
    href: '/dashboard/finance', 
    sub: [
      { name: 'Invoices & Payments', href: '/dashboard/finance/invoices' },
      { name: 'Ledgers', href: '/dashboard/finance/ledgers' },
      { name: 'Budgeting & Forecasting', href: '/dashboard/finance/budget' },
      { name: 'Supply-Chain Finance', href: '/dashboard/finance/supply-finance' }
    ]
  },
  { 
    id: 'projects', 
    name: 'Projects', 
    icon: '📋', 
    href: '/dashboard/projects', 
    sub: [
      { name: 'Project Portfolio', href: '/dashboard/projects/portfolio' },
      { name: 'Kanban Boards', href: '/dashboard/projects/kanban' },
      { name: 'Gantt Charts', href: '/dashboard/projects/gantt' },
      { name: 'Milestones', href: '/dashboard/projects/milestones' }
    ]
  },
  { 
    id: 'people', 
    name: 'People', 
    icon: '👥', 
    href: '/dashboard/people', 
    sub: [
      { name: 'Employee Directory', href: '/dashboard/people/employees' },
      { name: 'Performance Reviews', href: '/dashboard/people/performance' },
      { name: 'Onboarding', href: '/dashboard/people/onboarding' }
    ]
  },
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
  { 
    id: 'ai-lab', 
    name: 'AI Lab', 
    icon: '🧠', 
    href: '/dashboard/ai-lab', 
    sub: [
      { name: 'Assessment', href: '/dashboard/ai-lab/assessment' },
      { name: 'Neural Insights', href: '/dashboard/ai-lab/insights' },
      { name: 'Simulations', href: '/dashboard/ai-lab/simulations' },
      { name: 'Leadership Scorecards', href: '/dashboard/ai-lab/scorecards' }
    ]
  },
  { 
    id: 'sustainability', 
    name: 'Sustainability', 
    icon: '🌱', 
    href: '/dashboard/sustainability', 
    sub: [
      { name: 'Carbon Footprint Tracking', href: '/dashboard/sustainability/carbon' },
      { name: 'Ethical Sourcing', href: '/dashboard/sustainability/ethical' },
      { name: 'Reports', href: '/dashboard/sustainability/reports' }
    ]
  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = true;   // ← CHANGED: Sidebar now shows on ALL pages (including app/page.tsx)

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
          {/* Sidebar now shows on every page */}
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

          <div className="flex-1 overflow-auto pl-[25px] pr-12 py-12">
            {children}
          </div>
        </div>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}