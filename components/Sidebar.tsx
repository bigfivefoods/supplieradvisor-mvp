'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { 
  Home, Building2, Users, Truck, Factory, Package, 
  Calculator, Brain, ChevronDown 
} from 'lucide-react';

const modules = [
  { id: 'home', name: 'Dashboard', icon: Home, href: '/dashboard', sub: [] },

  { 
    id: 'my-business', 
    name: 'My Business', 
    icon: Building2, 
    href: '/dashboard/my-business',
    sub: [
      { name: 'Company Profile', href: '/dashboard/my-business/profile' },
      { name: 'Team & Roles', href: '/dashboard/my-business/team' },
      { name: 'Projects', href: '/dashboard/my-business/projects' },
      { name: 'Legal & Compliance', href: '/dashboard/my-business/legal' },
      { name: 'Documents', href: '/dashboard/my-business/documents' },
      { name: 'Settings', href: '/dashboard/my-business/settings' },
    ]
  },

  { 
    id: 'network', 
    name: 'Network', 
    icon: Users, 
    href: '/dashboard/network',
    sub: [
      { name: 'Business Directory', href: '/dashboard/suppliers/directory' },
      { name: 'Connections', href: '/dashboard/connections' },
      { name: 'Invite Business', href: '/dashboard/invite-business' },
    ]
  },

  {  
  id: 'suppliers', 
  name: 'Suppliers', 
  icon: Truck, 
  href: '/dashboard/suppliers',
  sub: [
    { name: 'Supplier Directory', href: '/dashboard/suppliers/directory' },
    { name: 'Sent Invitations', href: '/dashboard/suppliers/invites' },
    { name: 'Profiles', href: '/dashboard/suppliers/profiles' },
    { name: 'Add New Supplier', href: '/dashboard/suppliers/add' },
    { name: 'Purchase Orders', href: '/dashboard/suppliers/po' },
    { name: 'Contracts', href: '/dashboard/suppliers/contracts' },
    { name: 'Risk Alerts', href: '/dashboard/suppliers/risk-alerts' },
    { name: 'Portal', href: '/dashboard/suppliers/portal' },
  ]
  },

  { 
    id: 'customers', 
    name: 'Customers', 
    icon: Users, 
    href: '/dashboard/customers',
    sub: [
      { name: 'Profiles', href: '/dashboard/customers/profiles' },
      { name: 'Onboard Customer', href: '/dashboard/customers/onboard' },
      { name: 'Orders', href: '/dashboard/customers/orders' },
      { name: 'Quotes', href: '/dashboard/customers/quotes' },
      { name: 'Claims', href: '/dashboard/customers/claims' },
      { name: 'Loyalty', href: '/dashboard/customers/loyalty' },
      { name: 'Portal', href: '/dashboard/customers/portal' },
    ]
  },

  { 
    id: 'containers', 
    name: 'Containers', 
    icon: Package, 
    href: '/dashboard/containers',
    sub: [
      { name: 'Overview', href: '/dashboard/containers' },
      { name: 'Manage Containers', href: '/dashboard/containers/list' },
      { name: 'Add New Container', href: '/dashboard/containers/add' },
      { name: 'Contractors', href: '/dashboard/containers/contractors' },
      { name: 'Metrics', href: '/dashboard/containers/metrics' },
      { name: 'Reports', href: '/dashboard/containers/reports' },
      { name: 'Settings', href: '/dashboard/containers/settings' },
    ]
  },

  { 
    id: 'inventory', 
    name: 'Inventory', 
    icon: Package, 
    href: '/dashboard/inventory',
    sub: [
      { name: 'Raw Materials', href: '/dashboard/inventory/raw-materials' },
      { name: 'Finished Goods', href: '/dashboard/inventory/finished-goods' },
      { name: 'Warehouses', href: '/dashboard/inventory/warehouses' },
      { name: 'Stock Take', href: '/dashboard/inventory/stock-take' },
      { name: 'Cycle Counts', href: '/dashboard/inventory/cycle-counts' },
      { name: 'Transfers', href: '/dashboard/inventory/stock-transfers' },
    ]
  },

  { 
    id: 'operations', 
    name: 'Operations', 
    icon: Truck, 
    href: '/dashboard/operations',
    sub: [
      { name: 'Supplier Orders', href: '/dashboard/operations/supplier-orders' },
      { name: 'Inbound', href: '/dashboard/operations/inbound' },
      { name: 'Production', href: '/dashboard/operations/production' },
      { name: 'Outbound', href: '/dashboard/operations/outbound' },
      { name: 'Customer Orders', href: '/dashboard/operations/customer-orders' },
    ]
  },

  { 
    id: 'manufacturing', 
    name: 'Manufacturing', 
    icon: Factory, 
    href: '/dashboard/manufacturing',
    sub: [
      { name: 'Production Orders', href: '/dashboard/manufacturing/production-orders' },
      { name: 'Bills of Materials', href: '/dashboard/manufacturing/bills-of-materials' },
      { name: 'Master Production Schedules', href: '/dashboard/manufacturing/master-production-schedules' },
      { name: 'MRP', href: '/dashboard/manufacturing/mrp' },
    ]
  },

  { 
    id: 'distribution', 
    name: 'Distribution', 
    icon: Truck, 
    href: '/dashboard/distribution',
    sub: [
      { name: 'Carriers', href: '/dashboard/distribution/carriers' },
      { name: 'Fleet & Drivers', href: '/dashboard/distribution/fleet-drivers' },
      { name: 'Inbound Logistics', href: '/dashboard/distribution/inbound' },
      { name: 'Outbound Logistics', href: '/dashboard/distribution/outbound' },
      { name: 'Tracking & Visibility', href: '/dashboard/distribution/tracking' },
      { name: 'Incoterms', href: '/dashboard/distribution/incoterms' },
    ]
  },

  { 
    id: 'accounting', 
    name: 'Accounting', 
    icon: Calculator, 
    href: '/dashboard/accounting',
    sub: [
      { name: 'Chart of Accounts', href: '/dashboard/accounting/chart-of-accounts' },
      { name: 'Legal Entities', href: '/dashboard/accounting/entities' },
      { name: 'Journal Entries', href: '/dashboard/accounting/journal-entries' },
      { name: 'Accounts Payable', href: '/dashboard/accounting/accounts-payable' },
      { name: 'Accounts Receivable', href: '/dashboard/accounting/accounts-receivable' },
      { name: 'Bank & Reconciliation', href: '/dashboard/accounting/bank-reconciliation' },
      { name: 'Payments', href: '/dashboard/accounting/payments' },
      { name: 'Reports & Analytics', href: '/dashboard/accounting/reports' },
      { name: 'Tax & Compliance', href: '/dashboard/accounting/tax' },
      { name: 'Fixed Assets', href: '/dashboard/accounting/fixed-assets' },
      { name: 'Settings', href: '/dashboard/accounting/settings' },
    ]
  },

  { 
    id: 'intelligence', 
    name: 'Intelligence', 
    icon: Brain, 
    href: '/dashboard/intelligence',
    sub: [
      { name: 'Pulse Dashboard', href: '/dashboard/intelligence/pulse-dashboard' },
      { name: 'Neural Insights', href: '/dashboard/intelligence/neural-insights' },
      { name: 'Predictive Forecasts', href: '/dashboard/intelligence/predictive-forecasts' },
      { name: 'Simulation Lab', href: '/dashboard/intelligence/simulation-lab' },
      { name: 'Custom Scorecards', href: '/dashboard/intelligence/custom-scorecards' },
      { name: 'Leadership Development', href: '/dashboard/intelligence/leadership-development' },
    ]
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const toggleModule = (id: string) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-6 border-b border-neutral-100">
        <div className="flex items-center gap-3">
          <Image 
            src="/sa-logo.png" 
            alt="SupplierAdvisor" 
            width={40} 
            height={40} 
            className="rounded-xl" 
            priority 
          />
          <div className="font-black text-2xl tracking-[-1px] leading-none">
            SupplierAdvisor® ERP
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        {modules.map((mod) => {
          const Icon = mod.icon;
          const isActive = pathname?.startsWith(mod.href);
          const isExpanded = expandedModules[mod.id] ?? false;

          return (
            <div key={mod.id} className="mb-1">
              <div 
                onClick={() => mod.sub.length > 0 && toggleModule(mod.id)}
                className={`flex items-center justify-between px-5 py-3.5 rounded-3xl cursor-pointer transition-all ${
                  isActive ? 'bg-[#00b4d8] text-white' : 'hover:bg-neutral-100'
                }`}
              >
                <Link href={mod.href} className="flex items-center gap-3 flex-1">
                  <Icon className="w-5 h-5" />
                  <span className="font-semibold">{mod.name}</span>
                </Link>

                {mod.sub.length > 0 && (
                  <ChevronDown 
                    className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                  />
                )}
              </div>

              {/* Submenu */}
              {mod.sub.length > 0 && isExpanded && (
                <div className="ml-7 mt-1 space-y-0.5">
                  {mod.sub.map((sub, index) => (
                    <Link
                      key={index}
                      href={sub.href}
                      className={`block px-5 py-2.5 rounded-3xl text-sm transition-all ${
                        pathname === sub.href 
                          ? 'text-[#00b4d8] bg-blue-50 font-medium' 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-neutral-50'
                      }`}
                    >
                      {sub.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Button */}
      <div className="p-4 border-t">
        <button className="w-full bg-black text-white py-3 rounded-2xl flex items-center justify-center gap-2 font-medium hover:bg-neutral-800 transition-colors">
          <Brain className="w-5 h-5" />
          Ask Grok AI Assistant
        </button>
        <p className="text-xs text-center text-neutral-500 mt-2">Internal AI • Context Aware</p>
      </div>
    </div>
  );
}