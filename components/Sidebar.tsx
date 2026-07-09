'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { 
  Home, Building2, Users, Truck, Factory, Package, 
  Calculator, Brain, ChevronDown, ArrowLeftRight
} from 'lucide-react';

const modules = [
  { id: 'home', name: 'Dashboard', icon: Home, href: '/dashboard', sub: [] },

  { 
    id: 'my-business', 
    name: 'My Business', 
    icon: Building2, 
    href: '/dashboard/my-business',
    sub: [
      { name: 'Company profile', href: '/dashboard/my-business/profile' },
      { name: 'Team & roles', href: '/dashboard/my-business/team' },
      { name: 'Settings', href: '/dashboard/my-business/settings' },
      { name: 'Legal & compliance', href: '/dashboard/my-business/legal' },
      { name: 'Documents', href: '/dashboard/my-business/documents' },
      { name: 'Projects', href: '/dashboard/my-business/projects' },
      { name: 'Company RIAD', href: '/dashboard/my-business/riad-log' },
    ]
  },

  // ==================== NETWORK ====================
  { 
    id: 'network', 
    name: 'Network', 
    icon: Users, 
    href: '/dashboard/network',
    sub: [
      { name: 'My Connections', href: '/dashboard/network' },
      { name: 'Invite Company', href: '/dashboard/invite-business' },
    ]
  },

  // ==================== SUPPLIERS ====================
  {  
    id: 'suppliers', 
    name: 'Suppliers', 
    icon: Truck, 
    href: '/dashboard/suppliers',
    sub: [
      { name: 'Discover (trust search)', href: '/dashboard/suppliers/discover' },
      { name: 'My network', href: '/dashboard/suppliers/network' },
      { name: 'Add / invite', href: '/dashboard/suppliers/add' },
      { name: 'Invitations', href: '/dashboard/suppliers/invites' },
      { name: 'OTIFEF performance', href: '/dashboard/suppliers/performance' },
      { name: 'Ratings', href: '/dashboard/suppliers/ratings' },
      { name: 'Documents', href: '/dashboard/suppliers/documents' },
      { name: 'Purchase orders', href: '/dashboard/suppliers/po' },
      { name: 'Ops board', href: '/dashboard/suppliers/portal' },
      { name: 'Contracts', href: '/dashboard/suppliers/contracts' },
      { name: 'Supplier RIAD', href: '/dashboard/suppliers/riad-log' },
    ]
  },

  // ==================== CUSTOMERS (UPDATED) ====================
  { 
    id: 'customers', 
    name: 'Customers', 
    icon: Users, 
    href: '/dashboard/customers',
    sub: [
      { name: 'Overview', href: '/dashboard/customers' },
      { name: 'Leads & opportunities', href: '/dashboard/customers/leads' },
      { name: 'Profiles', href: '/dashboard/customers/profiles' },
      { name: 'Add customer', href: '/dashboard/customers/onboard' },
      { name: 'Quotes', href: '/dashboard/customers/quotes' },
      { name: 'Orders', href: '/dashboard/customers/orders' },
      { name: 'Invoices', href: '/dashboard/customers/invoices' },
      { name: 'Peer reviews', href: '/dashboard/customers/reviews' },
      { name: 'Loyalty', href: '/dashboard/customers/loyalty' },
      { name: 'Claims', href: '/dashboard/customers/claims' },
      { name: 'Contracts', href: '/dashboard/customers/contracts' },
      { name: 'Customer RIAD', href: '/dashboard/customers/riad-log' },
      { name: 'Portal', href: '/dashboard/customers/portal' },
      { name: 'Buyer POs', href: '/dashboard/buyer/pos' },
      { name: 'Buyer reviews', href: '/dashboard/buyer/reviews' },
    ]
  },

  // ==================== CONTAINERS ====================
  { 
    id: 'containers', 
    name: 'Containers', 
    icon: Package, 
    href: '/dashboard/containers',
    sub: [
      { name: 'Overview', href: '/dashboard/containers' },
      { name: 'Manage Containers', href: '/dashboard/containers/manage' },
      { name: 'Map', href: '/dashboard/containers/map' },
      { name: 'Add Container', href: '/dashboard/containers/add' },
      { name: 'Contractors', href: '/dashboard/containers/contractors' },
      { name: 'Training Hub', href: '/dashboard/containers/training' },
      { name: 'Container RIAD Log', href: '/dashboard/containers/riad-log' },
      { name: 'Metrics', href: '/dashboard/containers/metrics' },
    ]
  },

  { 
    id: 'inventory', 
    name: 'Inventory', 
    icon: Package, 
    href: '/dashboard/inventory',
    sub: [
      { name: 'Overview', href: '/dashboard/inventory' },
      { name: 'Products', href: '/dashboard/inventory/products' },
      { name: 'Locations', href: '/dashboard/inventory/warehouses' },
      { name: 'Live stock', href: '/dashboard/inventory/stock' },
      { name: 'Receive', href: '/dashboard/inventory/scan' },
      { name: 'Transfers', href: '/dashboard/inventory/stock-transfers' },
      { name: 'Live tracking', href: '/dashboard/inventory/tracking' },
      { name: 'Counts', href: '/dashboard/inventory/counts' },
      { name: 'Lots & serials', href: '/dashboard/inventory/lots' },
      { name: 'GS1 & EDI', href: '/dashboard/inventory/edi' },
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

  // Auto-expand the module matching the current route
  useEffect(() => {
    if (!pathname) return;
    const active = modules.find((mod) => {
      if (mod.href === '/dashboard') return pathname === '/dashboard';
      return pathname === mod.href || pathname.startsWith(`${mod.href}/`);
    });
    if (active && active.sub.length > 0) {
      setExpandedModules((prev) => ({ ...prev, [active.id]: true }));
    }
  }, [pathname]);

  const isModuleActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-6 border-b border-neutral-100">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image 
            src="/sa-logo.png" 
            alt="SupplierAdvisor" 
            width={40} 
            height={40} 
            className="rounded-xl" 
            priority 
          />
          <div className="font-black text-xl tracking-[-1px] leading-none text-slate-900">
            SupplierAdvisor®
          </div>
        </Link>
        <Link
          href="/dashboard/select-company"
          className="mt-4 flex items-center gap-2 text-sm text-neutral-500 hover:text-[#00b4d8] transition-colors"
        >
          <ArrowLeftRight className="w-4 h-4" />
          Switch company
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        {modules.map((mod) => {
          const Icon = mod.icon;
          const isActive = isModuleActive(mod.href);
          const isExpanded = expandedModules[mod.id] ?? false;

          return (
            <div key={mod.id} className="mb-1">
              <div className={`flex items-center justify-between px-5 py-3.5 rounded-3xl transition-all ${
                isActive ? 'bg-[#00b4d8] text-white' : 'hover:bg-neutral-100 text-slate-800'
              }`}>
                
                <Link href={mod.href} className="flex items-center gap-3 flex-1 min-w-0">
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-semibold truncate">{mod.name}</span>
                </Link>

                {mod.sub.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleModule(mod.id);
                    }}
                    className="p-2 -mr-2 rounded-xl hover:bg-white/20 transition-colors"
                    aria-label={`Toggle ${mod.name} submenu`}
                  >
                    <ChevronDown 
                      className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                    />
                  </button>
                )}
              </div>

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

      {/* Bottom */}
      <div className="p-4 border-t space-y-3">
        <button
          type="button"
          className="w-full bg-slate-900 text-white py-3 rounded-2xl flex items-center justify-center gap-2 font-medium hover:bg-neutral-800 transition-colors"
          title="AI assistant coming soon"
        >
          <Brain className="w-5 h-5" />
          Ask Grok AI Assistant
        </button>
        <p className="text-xs text-center text-neutral-500">Internal AI • Context Aware</p>
      </div>
    </div>
  );
}