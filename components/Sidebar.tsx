'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { 
  Home, User, Search, Users, Package, Box, Factory, 
  Truck, DollarSign, FolderTree, Users2, ShieldCheck, 
  Leaf, Bot, Landmark, ChevronDown 
} from 'lucide-react';

const modules = [
  { id: 'home', name: 'Home', icon: Home, href: '/dashboard', sub: [] },
  { id: 'profile', name: 'Profile', icon: User, href: '/dashboard/profile', sub: [] },
  { id: 'suppliers', name: 'Suppliers', icon: Search, href: '/dashboard/suppliers', sub: [
    { name: 'Search Suppliers', href: '/dashboard/suppliers/search' },
    { name: 'Onboard Suppliers', href: '/dashboard/suppliers/onboard' },
    { name: 'Supplier Profiles', href: '/dashboard/suppliers/profiles' },
    { name: 'Connect', href: '/dashboard/suppliers/connect' },
    { name: 'Raise PO', href: '/dashboard/procurement/po' },
    { name: 'Contracts', href: '/dashboard/suppliers/contracts' },
    { name: 'Supplier Portal', href: '/dashboard/suppliers/portal' },
    { name: 'Risk Alerts', href: '/dashboard/suppliers/risk-alerts' }
  ]},
  { id: 'customers', name: 'Customers', icon: Users, href: '/dashboard/customers', sub: [
    { name: 'Search Customers', href: '/dashboard/customers/search' },
    { name: 'Onboard', href: '/dashboard/customers/onboard' },
    { name: 'Profiles', href: '/dashboard/customers/profiles' },
    { name: 'Quotes', href: '/dashboard/customers/quotes' },
    { name: 'Orders', href: '/dashboard/customers/orders' },
    { name: 'Loyalty', href: '/dashboard/customers/loyalty' },
    { name: 'Customer Portal', href: '/dashboard/customers/portal' },
    { name: 'Claims', href: '/dashboard/customers/claims' }
  ]},
  { id: 'procurement', name: 'Procurement', icon: Package, href: '/dashboard/procurement', sub: [
    { name: 'Requisitions', href: '/dashboard/procurement/requisitions' },
    { name: 'Bids', href: '/dashboard/procurement/bids' },
    { name: 'Purchase Orders', href: '/dashboard/procurement/po' },
    { name: 'Receipts', href: '/dashboard/procurement/receipts' },
    { name: 'Invoices', href: '/dashboard/procurement/invoices' },
    { name: 'Analytics', href: '/dashboard/procurement/analytics' }
  ]},
  { id: 'inventory', name: 'Inventory', icon: Box, href: '/dashboard/inventory', sub: [
    { name: 'Raw Materials', href: '/dashboard/inventory/raw-materials' },
    { name: 'Finished Goods', href: '/dashboard/inventory/finished-goods' },
    { name: 'Transfers', href: '/dashboard/inventory/transfers' },
    { name: 'Warehousing', href: '/dashboard/inventory/warehousing' },
    { name: 'Stock Takes', href: '/dashboard/inventory/stock-take' },
    { name: 'Cycle Counts', href: '/dashboard/inventory/cycle-counts' }
  ]},
  { id: 'manufacturing', name: 'Manufacturing', icon: Factory, href: '/dashboard/manufacturing', sub: [
    { name: 'Bills of Materials', href: '/dashboard/manufacturing/bills-of-materials' },
    { name: 'Master Production Schedules', href: '/dashboard/manufacturing/master-production-schedules' },
    { name: 'MRP', href: '/dashboard/manufacturing/mrp' },
    { name: 'Production Orders', href: '/dashboard/manufacturing/production-orders' }
  ]},
  { id: 'logistics', name: 'Logistics', icon: Truck, href: '/dashboard/logistics', sub: [
    { name: 'Shipments', href: '/dashboard/logistics/shipments' },
    { name: 'Live Tracking', href: '/dashboard/logistics/tracking' },
    { name: 'Fleet & Drivers', href: '/dashboard/logistics/fleet-drivers' },
    { name: 'Carriers', href: '/dashboard/logistics/carriers' },
    { name: 'Incoterms', href: '/dashboard/logistics/incoterms' }
  ]},
  { id: 'finance', name: 'Finance', icon: DollarSign, href: '/dashboard/finance', sub: [
    { name: 'Budgets', href: '/dashboard/finance/budgets' },
    { name: 'Invoices & Payments', href: '/dashboard/finance/invoices' },
    { name: 'Reports', href: '/dashboard/finance/reports' },
    { name: 'Forecasting', href: '/dashboard/finance/forecasting' },
    { name: 'Cash Flow', href: '/dashboard/finance/cashflow' }
  ]},
  { id: 'projects', name: 'Projects', icon: FolderTree, href: '/dashboard/projects', sub: [
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
  { id: 'people', name: 'People', icon: Users2, href: '/dashboard/people', sub: [
    { name: 'Employee Directory', href: '/dashboard/people/employee-directory' },
    { name: 'Onboarding', href: '/dashboard/people/onboarding' },
    { name: 'Org Chart', href: '/dashboard/people/org-chart' },
    { name: 'Payroll', href: '/dashboard/people/payroll' },
    { name: 'Performance Reviews', href: '/dashboard/people/performance-reviews' },
    { name: 'Training', href: '/dashboard/people/training' }
  ]},
  { id: 'quality', name: 'Quality', icon: ShieldCheck, href: '/dashboard/quality', sub: [
    { name: 'Inspections', href: '/dashboard/quality/inspections' },
    { name: 'HACCP', href: '/dashboard/quality/haccp' },
    { name: 'Traceability', href: '/dashboard/quality/traceability' },
    { name: 'Recall Simulator', href: '/dashboard/quality/recall-simulator' },
    { name: 'Regulatory Reports', href: '/dashboard/quality/regulatory-reports' }
  ]},
  { id: 'sustainability', name: 'Sustainability', icon: Leaf, href: '/dashboard/sustainability', sub: [
    { name: 'Carbon Tracking', href: '/dashboard/sustainability/carbon-tracking' },
    { name: 'Ethical Sourcing', href: '/dashboard/sustainability/ethical-sourcing' },
    { name: 'Water & Waste', href: '/dashboard/sustainability/water-waste' },
    { name: 'Regenerative Dashboard', href: '/dashboard/sustainability/regenerative-dashboard' },
    { name: 'Reports', href: '/dashboard/sustainability/reports' },
    { name: 'Green Certificates', href: '/dashboard/sustainability/green-certificates' }
  ]},
  { id: 'ai-lab', name: 'AI Lab', icon: Bot, href: '/dashboard/ai-lab', sub: [
    { name: 'Leadership Development', href: '/dashboard/ai-lab/leadership-development' },
    { name: 'Pulse Dashboard', href: '/dashboard/ai-lab/pulse-dashboard' },
    { name: 'Predictive Forecasts', href: '/dashboard/ai-lab/predictive-forecasts' },
    { name: 'Neural Insights', href: '/dashboard/ai-lab/neural-insights' },
    { name: 'Simulation Lab', href: '/dashboard/ai-lab/simulation-lab' },
    { name: 'Custom Scorecards', href: '/dashboard/ai-lab/custom-scorecards' }
  ]},
  { id: 'governance', name: 'Governance', icon: Landmark, href: '/dashboard/governance', sub: [
    { name: 'Enterprise RIAD', href: '/dashboard/governance/raid' },
    { name: 'PESTLE Analysis', href: '/dashboard/governance/pestle' }
  ]}
];

export default function Sidebar() {
  const pathname = usePathname();
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const toggleModule = (id: string) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="w-full min-h-screen bg-white flex flex-col border-r border-neutral-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-neutral-100">
        <div className="flex items-center gap-3">
          <Image 
            src="/sa-logo.png" 
            alt="SupplierAdvisor" 
            width={40} 
            height={40} 
            className="rounded-xl flex-shrink-0" 
            priority 
          />
          <div className="font-black text-2xl tracking-[-1px] leading-none">SupplierAdvisor®</div>
        </div>
      </div>

      {/* Navigation - now expands vertically when modules are opened */}
      <nav className="flex-1 p-4 overflow-y-auto">
        {modules.map((mod) => {
          const isActive = mod.id === 'home' 
            ? pathname === '/dashboard' 
            : pathname?.startsWith(mod.href);

          const isExpanded = expandedModules[mod.id] ?? false;
          const Icon = mod.icon;

          return (
            <div key={mod.id} className="mb-1">
              <div className={`flex items-center justify-between px-6 py-4 rounded-3xl transition-all ${
                isActive ? 'bg-[#00b4d8] text-white' : 'hover:bg-neutral-100'
              }`}>
                <Link href={mod.href} className="flex items-center gap-3 flex-1">
                  <Icon className="w-6 h-6" />
                  <span className="font-semibold text-lg">{mod.name}</span>
                </Link>

                {mod.sub && mod.sub.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleModule(mod.id);
                    }}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {mod.sub && mod.sub.length > 0 && isExpanded && (
                <div className="ml-8 mt-1 space-y-0.5">
                  {mod.sub.map((sub, i) => {
                    const subActive = pathname === sub.href;
                    return (
                      <Link
                        key={i}
                        href={sub.href}
                        className={`block px-6 py-3 rounded-3xl text-[15px] transition-all ${
                          subActive ? 'text-[#00b4d8] bg-blue-50 font-medium' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {sub.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}