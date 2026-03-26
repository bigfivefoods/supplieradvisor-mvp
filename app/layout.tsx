'use client';

import { useState } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { Wallet, ChevronDown } from "lucide-react";

const modules = [
  { id: 'home', name: 'Home', icon: '📊', href: '/dashboard', sub: [] },
  { id: 'suppliers', name: 'Suppliers', icon: '🔍', href: '/dashboard/suppliers', sub: [
    { name: 'Search Suppliers', href: '/dashboard/suppliers/search' },
    { name: 'Onboard Suppliers', href: '/dashboard/suppliers/onboard' },
    { name: 'Supplier Profiles', href: '/dashboard/suppliers/profiles' },
    { name: 'Connect', href: '/dashboard/suppliers/connect' },
    { name: 'Raise PO', href: '/dashboard/procurement/po' },
    { name: 'Contracts', href: '/dashboard/suppliers/contracts' },
    { name: 'Supplier Portal', href: '/dashboard/suppliers/portal' },
    { name: 'Risk Alerts', href: '/dashboard/suppliers/risk-alerts' }
  ]},
  { id: 'customers', name: 'Customers', icon: '🤝', href: '/dashboard/customers', sub: [
    { name: 'Search Customers', href: '/dashboard/customers/search' },
    { name: 'Onboard', href: '/dashboard/customers/onboard' },
    { name: 'Profiles', href: '/dashboard/customers/profiles' },
    { name: 'Quotes', href: '/dashboard/customers/quotes' },
    { name: 'Orders', href: '/dashboard/customers/orders' },
    { name: 'Loyalty', href: '/dashboard/customers/loyalty' },
    { name: 'Customer Portal', href: '/dashboard/customers/portal' },
    { name: 'Claims', href: '/dashboard/customers/claims' }
  ]},
  { id: 'procurement', name: 'Procurement', icon: '📋', href: '/dashboard/procurement', sub: [
    { name: 'Requisitions', href: '/dashboard/procurement/requisitions' },
    { name: 'Bids', href: '/dashboard/procurement/bids' },
    { name: 'Purchase Orders', href: '/dashboard/procurement/po' },
    { name: 'Receipts', href: '/dashboard/procurement/receipts' },
    { name: 'Invoices', href: '/dashboard/procurement/invoices' },
    { name: 'Analytics', href: '/dashboard/procurement/analytics' }
  ]},
  { id: 'inventory', name: 'Inventory', icon: '📦', href: '/dashboard/inventory', sub: [
    { name: 'Raw Materials', href: '/dashboard/inventory/raw-materials' },
    { name: 'Finished Goods', href: '/dashboard/inventory/finished-goods' },
    { name: 'Transfers', href: '/dashboard/inventory/transfers' },
    { name: 'Warehousing', href: '/dashboard/inventory/warehousing' },
    { name: 'Stock Takes', href: '/dashboard/inventory/stock-takes' },
    { name: 'Cycle Counts', href: '/dashboard/inventory/cycle-counts' }
  ]},
  { id: 'manufacturing', name: 'Manufacturing', icon: '🏭', href: '/dashboard/manufacturing', sub: [
    { name: 'Bills of Materials', href: '/dashboard/manufacturing/bills-of-materials' },
    { name: 'Master Production Schedules', href: '/dashboard/manufacturing/master-production-schedules' },
    { name: 'MRP', href: '/dashboard/manufacturing/mrp' },
    { name: 'Production Orders', href: '/dashboard/manufacturing/production-orders' }
  ]},
  { id: 'logistics', name: 'Logistics', icon: '🚚', href: '/dashboard/logistics', sub: [
    { name: 'Shipments', href: '/dashboard/logistics/shipments' },
    { name: 'Live Tracking', href: '/dashboard/logistics/tracking' },
    { name: 'Fleet & Drivers', href: '/dashboard/logistics/fleet-drivers' },
    { name: 'Carriers', href: '/dashboard/logistics/carriers' },
    { name: 'Incoterms', href: '/dashboard/logistics/incoterms' }
  ]},
  { id: 'finance', name: 'Finance', icon: '💰', href: '/dashboard/finance', sub: [
    { name: 'Budgets', href: '/dashboard/finance/budgets' },
    { name: 'Invoices & Payments', href: '/dashboard/finance/invoices' },
    { name: 'Reports', href: '/dashboard/finance/reports' },
    { name: 'Forecasting', href: '/dashboard/finance/forecasting' },
    { name: 'Cash Flow', href: '/dashboard/finance/cashflow' }
  ]},
  { id: 'projects', name: 'Projects', icon: '📋', href: '/dashboard/projects', sub: [
    { name: 'Portfolio', href: '/dashboard/projects/portfolio' },
    { name: 'Kanban Boards', href: '/dashboard/projects/kanban-boards' },
    { name: 'Gantt Charts', href: '/dashboard/projects/gantt' },
    { name: 'Resource Allocation', href: '/dashboard/projects/resource-allocation' },
    { name: 'Milestones', href: '/dashboard/projects/milestones' },
    { name: 'Budgeting', href: '/dashboard/projects/budgeting' },
    { name: 'Risk Register', href: '/dashboard/projects/risk-register' },
    { name: 'Timesheets', href: '/dashboard/projects/timesheets' },
    { name: 'Reporting', href: '/dashboard/projects/reporting' },
    { name: 'Active Projects', href: '/dashboard/projects/active' }
  ]},
  { id: 'people', name: 'People', icon: '👥', href: '/dashboard/people', sub: [
    { name: 'Employee Directory', href: '/dashboard/people/employee-directory' },
    { name: 'Onboarding', href: '/dashboard/people/onboarding' },
    { name: 'Org Chart', href: '/dashboard/people/org-chart' },
    { name: 'Payroll', href: '/dashboard/people/payroll' },
    { name: 'Performance Reviews', href: '/dashboard/people/performance-reviews' },
    { name: 'Training', href: '/dashboard/people/training' }
  ]},
  { id: 'quality', name: 'Quality', icon: '🛡️', href: '/dashboard/quality', sub: [
    { name: 'Inspections', href: '/dashboard/quality/inspections' },
    { name: 'HACCP', href: '/dashboard/quality/haccp' },
    { name: 'Traceability', href: '/dashboard/quality/traceability' },
    { name: 'Recall Simulator', href: '/dashboard/quality/recall-simulator' },
    { name: 'Regulatory Reports', href: '/dashboard/quality/regulatory-reports' }
  ]},
  { id: 'sustainability', name: 'Sustainability', icon: '🌱', href: '/dashboard/sustainability', sub: [
    { name: 'Carbon Tracking', href: '/dashboard/sustainability/carbon-tracking' },
    { name: 'Ethical Sourcing', href: '/dashboard/sustainability/ethical-sourcing' },
    { name: 'Water & Waste', href: '/dashboard/sustainability/water-waste' },
    { name: 'Regenerative Dashboard', href: '/dashboard/sustainability/regenerative-dashboard' },
    { name: 'Reports', href: '/dashboard/sustainability/reports' },
    { name: 'Green Certificates', href: '/dashboard/sustainability/green-certificates' }
  ]},
  { id: 'risks', name: 'Risks', icon: '⚠️', href: '/dashboard/risks', sub: [] },
  { id: 'ai-lab', name: 'AI Lab', icon: '🤖', href: '/dashboard/ai-lab', sub: [
    { name: 'Pulse Dashboard', href: '/dashboard/ai-lab/pulse-dashboard' },
    { name: 'Predictive Forecasts', href: '/dashboard/ai-lab/predictive-forecasts' },
    { name: 'Neural Insights', href: '/dashboard/ai-lab/neural-insights' },
    { name: 'Simulation Lab', href: '/dashboard/ai-lab/simulation-lab' },
    { name: 'Custom Scorecards', href: '/dashboard/ai-lab/custom-scorecards' }
  ]},
  { id: 'governance', name: 'Governance', icon: '🏛️', href: '/dashboard/governance', sub: [
    { name: 'Enterprise RIAD', href: '/dashboard/governance/raid' },
    { name: 'PESTLE Analysis', href: '/dashboard/governance/pestle' }
  ]}
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ['email', 'wallet'],
        appearance: { theme: 'light' }
      }}
    >
      <RootLayoutContent>{children}</RootLayoutContent>
    </PrivyProvider>
  );
}

function RootLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = usePrivy();
  const pathname = usePathname();
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const toggleModule = (id: string) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isDashboard = pathname.startsWith('/dashboard') || pathname === '/';

  return (
    <body>
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-72 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
          <div className="p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#00b4d8] rounded-2xl flex items-center justify-center text-white font-black text-3xl">S</div>
              <div className="text-3xl font-black tracking-[-2px]">SupplierAdvisor</div>
            </div>
          </div>

          <div className="flex-1 p-4">
            {modules.map((mod) => (
              <div key={mod.id} className="mb-1">
                <button
                  onClick={() => toggleModule(mod.id)}
                  className={`w-full flex items-center gap-3 px-6 py-4 rounded-3xl text-left transition-all ${pathname === mod.href ? 'bg-[#00b4d8] text-white' : 'hover:bg-slate-100'}`}
                >
                  <span className="text-2xl">{mod.icon}</span>
                  <span className="font-semibold text-lg">{mod.name}</span>
                  {mod.sub && mod.sub.length > 0 && (
                    <ChevronDown className={`ml-auto transition ${expandedModules[mod.id] ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {mod.sub && mod.sub.length > 0 && expandedModules[mod.id] && (
                  <div className="ml-12 mt-1 space-y-0.5">
                    {mod.sub.map((sub, i) => (
                      <Link
                        key={i}
                        href={sub.href}
                        className={`block px-6 py-3 rounded-3xl text-[15px] transition-all ${pathname === sub.href ? 'text-[#00b4d8] bg-blue-50 font-medium' : 'text-slate-600 hover:text-slate-900'}`}
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

        {/* Main Content */}
        <div className={`flex-1 overflow-auto ${isDashboard ? 'pl-[25px] pr-12 py-12' : 'min-h-screen'}`}>
          {children}
        </div>
      </div>
      <Toaster position="top-center" />
    </body>
  );
}
