'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { 
  Home, Building2, Users, Truck, Factory, Package, 
  ShoppingCart, Calculator, Brain, ChevronDown 
} from 'lucide-react';

const modules = [
  { id: 'home', name: 'Dashboard', icon: Home, href: '/dashboard', sub: [] },

  { 
    id: 'my-business', 
    name: 'My Business', 
    icon: Building2, 
    href: '/dashboard/my-business/profile', 
    sub: [
      { name: 'Profile & Legal', href: '/dashboard/my-business/profile' },
      { name: 'Team & Roles', href: '/dashboard/my-business/team' },
      { name: 'Projects', href: '/dashboard/business/projects' },
      { name: 'Settings', href: '/dashboard/business/settings' },
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

  // ✅ Suppliers - Correct sub-pages
  { 
    id: 'suppliers', 
    name: 'Suppliers', 
    icon: Truck, 
    href: '/dashboard/suppliers', 
    sub: [
      { name: 'Supplier Directory', href: '/dashboard/suppliers/directory' },
      { name: 'Add New Supplier', href: '/dashboard/suppliers/add' },
      { name: 'Profiles', href: '/dashboard/suppliers/profiles' },
      { name: 'Purchase Orders', href: '/dashboard/suppliers/po' },
      { name: 'Contracts', href: '/dashboard/suppliers/contracts' },
      { name: 'Risk Alerts', href: '/dashboard/suppliers/risk-alerts' },
      { name: 'Portal', href: '/dashboard/suppliers/portal' },
    ]
  },

  // ✅ Customers - Correct sub-pages
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

  // Containers
  { 
    id: 'containers', 
    name: 'Containers', 
    icon: Package, 
    href: '/dashboard/containers', 
    sub: [
      { name: 'Manage Containers', href: '/dashboard/containers' },
      { name: 'Container Metrics', href: '/dashboard/containers/metrics' },
    ]
  },

  // Inventory
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

  // Operations
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

  { id: 'manufacturing', name: 'Manufacturing', icon: Factory, href: '/dashboard/manufacturing', sub: [
    { name: 'Recipes & Formulations', href: '/dashboard/manufacturing/recipes' },
    { name: 'Work Orders & Routing', href: '/dashboard/manufacturing/work-orders' },
    { name: 'Capacity Planning', href: '/dashboard/manufacturing/capacity' },
    { name: 'Costing & Yield', href: '/dashboard/manufacturing/costing' },
    { name: 'Quality Control', href: '/dashboard/manufacturing/quality' },
  ]},

  { id: 'distribution', name: 'Distribution', icon: Truck, href: '/dashboard/distribution', sub: [
    { name: 'Logistics', href: '/dashboard/distribution/logistics' },
    { name: 'Micro-Franchise', href: '/dashboard/distribution/franchise' },
  ]},

  { id: 'accounting', name: 'Accounting', icon: Calculator, href: '/dashboard/accounting', sub: [
    { name: 'Invoices & POs', href: '/dashboard/accounting/invoices' },
    { name: 'Ledger & Bank', href: '/dashboard/accounting/ledger' },
    { name: 'Tax & Compliance', href: '/dashboard/accounting/tax' },
    { name: 'Reports', href: '/dashboard/accounting/reports' },
  ]},

  { id: 'intelligence', name: 'Intelligence', icon: Brain, href: '/dashboard/intelligence', sub: [
    { name: 'Grok AI Assistant', href: '/dashboard/intelligence/grok' },
    { name: 'Analytics & BI', href: '/dashboard/intelligence/analytics' },
    { name: 'Sustainability', href: '/dashboard/intelligence/sustainability' },
    { name: 'Blockchain Explorer', href: '/dashboard/intelligence/blockchain' },
    { name: 'Leadership Development', href: '/dashboard/ai-lab/leadership-development' },
  ]},
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
          <div className="font-black text-2xl tracking-[-1px] leading-none">SupplierAdvisor® ERP</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        {modules.map((mod) => {
          const isActive = pathname?.startsWith(mod.href) || false;
          const isExpanded = expandedModules[mod.id] ?? false;
          const Icon = mod.icon;

          return (
            <div key={mod.id} className="mb-1">
              <div 
                className={`flex items-center justify-between px-6 py-4 rounded-3xl transition-all cursor-pointer ${
                  isActive ? 'bg-[#00b4d8] text-white' : 'hover:bg-neutral-100'
                }`}
                onClick={() => mod.sub.length > 0 && toggleModule(mod.id)}
              >
                <Link href={mod.href} className="flex items-center gap-3 flex-1">
                  <Icon className="w-5 h-5" />
                  <span className="font-semibold">{mod.name}</span>
                </Link>

                {mod.sub && mod.sub.length > 0 && (
                  <button className="text-neutral-400">
                    <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {mod.sub && mod.sub.length > 0 && isExpanded && (
                <div className="ml-8 mt-1 space-y-0.5">
                  {mod.sub.map((sub, i) => (
                    <Link
                      key={i}
                      href={sub.href}
                      className={`block px-6 py-3 rounded-3xl text-sm transition-all ${
                        pathname === sub.href ? 'text-[#00b4d8] bg-blue-50 font-medium' : 'text-slate-600 hover:text-slate-900'
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

      {/* Grok Button */}
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