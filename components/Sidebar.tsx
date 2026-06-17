'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { 
  Home, Building2, Users, Truck, Factory, Package, 
  ShoppingCart, Calculator, Brain, BarChart3, ChevronDown 
} from 'lucide-react';

const modules = [
  { id: 'home', name: 'Dashboard', icon: Home, href: '/dashboard', sub: [] },

  // ✅ UPDATED: My Business now correctly points to the new profile location
  { 
    id: 'my-business', 
    name: 'My Business', 
    icon: Building2, 
    href: '/dashboard/my-business/profile', 
    sub: [
      { name: 'Profile & Legal', href: '/dashboard/my-business/profile' },
      { name: 'Team & Roles', href: '/dashboard/business/team' },
      { name: 'Projects', href: '/dashboard/business/projects' },
      { name: 'Settings', href: '/dashboard/business/settings' },
    ]
  },

  { id: 'ecosystem', name: 'Ecosystem', icon: Users, href: '/dashboard/ecosystem', sub: [
    { name: 'Suppliers', href: '/dashboard/ecosystem/suppliers' },
    { name: 'Customers', href: '/dashboard/ecosystem/customers' },
    { name: 'Partners', href: '/dashboard/ecosystem/partners' },
  ]},

  { id: 'supplychain', name: 'Supply Chain', icon: Truck, href: '/dashboard/supplychain', sub: [
    { name: 'Procurement & POs', href: '/dashboard/supplychain/procurement' },
    { name: 'Bill of Materials', href: '/dashboard/supplychain/bom' },
    { name: 'Traceability', href: '/dashboard/supplychain/traceability' },
  ]},

  { id: 'manufacturing', name: 'Manufacturing', icon: Factory, href: '/dashboard/manufacturing', sub: [
    { name: 'Recipes & Formulations', href: '/dashboard/manufacturing/recipes' },
    { name: 'Work Orders & Routing', href: '/dashboard/manufacturing/work-orders' },
    { name: 'Capacity Planning', href: '/dashboard/manufacturing/capacity' },
    { name: 'Costing & Yield', href: '/dashboard/manufacturing/costing' },
    { name: 'Quality Control', href: '/dashboard/manufacturing/quality' },
  ]},

  { id: 'inventory', name: 'Warehouse', icon: Package, href: '/dashboard/inventory', sub: [
    { name: 'Stock Management', href: '/dashboard/inventory/stock' },
    { name: 'Receipts & Issues', href: '/dashboard/inventory/receipts' },
    { name: 'Stock Take', href: '/dashboard/inventory/counts' },
  ]},

  { id: 'distribution', name: 'Distribution', icon: Truck, href: '/dashboard/distribution', sub: [
    { name: 'Containers', href: '/dashboard/containers' },
    { name: 'Logistics', href: '/dashboard/distribution/logistics' },
    { name: 'Micro-Franchise', href: '/dashboard/distribution/franchise' },
  ]},

  { id: 'commercial', name: 'Commercial', icon: ShoppingCart, href: '/dashboard/commercial', sub: [
    { name: 'Sales & CRM', href: '/dashboard/commercial/sales' },
    { name: 'Orders', href: '/dashboard/commercial/orders' },
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