'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import {
  Home,
  Building2,
  Users,
  Truck,
  Factory,
  Package,
  Calculator,
  Brain,
  ChevronDown,
  ArrowLeftRight,
  Sparkles,
  ShieldCheck,
  Leaf,
  FolderKanban,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import { SIDEBAR_MODULE_RESOURCE } from '@/lib/business/permissions';
import SystemHealthBadge from '@/components/system/SystemHealthBadge';
import { useSidebarChrome } from '@/components/chrome/SidebarContext';

const modules = [
  { id: 'home', name: 'Dashboard', icon: Home, href: '/dashboard', sub: [] as { name: string; href: string }[] },

  {
    id: 'sales-portal',
    name: 'Sales portal',
    icon: Sparkles,
    href: '/sales',
    sub: [
      { name: 'Command centre', href: '/sales' },
      { name: 'Pipeline', href: '/sales/pipeline' },
      { name: 'Customers', href: '/sales/customers' },
      { name: 'Quotes', href: '/sales/quotes' },
      { name: 'Orders', href: '/sales/orders' },
      { name: 'Invoices', href: '/sales/invoices' },
      { name: 'Earnings', href: '/sales/earnings' },
      { name: 'Forecast', href: '/sales/forecast' },
      { name: 'Agreement', href: '/sales/agreement' },
      { name: 'Subscribe', href: '/sales/subscribe' },
    ],
  },

  {
    id: 'my-business',
    name: 'My Business',
    icon: Building2,
    href: '/dashboard/my-business',
    sub: [
      { name: 'Overview', href: '/dashboard/my-business' },
      { name: 'Profile', href: '/dashboard/my-business/profile' },
      { name: 'Team', href: '/dashboard/my-business/team' },
      { name: 'Settings', href: '/dashboard/my-business/settings' },
      { name: 'Legal', href: '/dashboard/my-business/legal' },
      { name: 'Documents', href: '/dashboard/my-business/documents' },
      { name: 'Projects', href: '/dashboard/my-business/projects' },
      { name: 'RIAD', href: '/dashboard/my-business/riad-log' },
    ],
  },

  {
    id: 'network',
    name: 'Network',
    icon: Users,
    href: '/dashboard/connections',
    sub: [
      { name: 'Connection graph', href: '/dashboard/connections' },
      { name: 'Discover companies', href: '/dashboard/suppliers/discover' },
      { name: 'Pricing agreements', href: '/dashboard/connections/pricing' },
      { name: 'Marketplace', href: '/dashboard/connections/marketplace' },
      { name: 'Sell on marketplace', href: '/dashboard/connections/marketplace/sell' },
      { name: 'Invite company', href: '/dashboard/invite-business' },
    ],
  },

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
    ],
  },

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
      { name: 'Platform invites', href: '/dashboard/customers/invites' },
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
    ],
  },

  {
    id: 'containers',
    name: 'Containers',
    icon: Package,
    href: '/dashboard/containers',
    sub: [
      { name: 'Overview', href: '/dashboard/containers' },
      { name: 'Manage containers', href: '/dashboard/containers/manage' },
      { name: 'Map', href: '/dashboard/containers/map' },
      { name: 'Add container', href: '/dashboard/containers/add' },
      { name: 'Contractors', href: '/dashboard/containers/contractors' },
      { name: 'Training hub', href: '/dashboard/containers/training' },
      { name: 'Container RIAD', href: '/dashboard/containers/riad-log' },
      { name: 'Metrics', href: '/dashboard/containers/metrics' },
    ],
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
    ],
  },

  {
    id: 'operations',
    name: 'Operations',
    icon: Truck,
    href: '/dashboard/operations',
    sub: [
      { name: 'Command Center', href: '/dashboard/operations' },
      { name: 'Supplier Orders', href: '/dashboard/operations/supplier-orders' },
      { name: 'Inbound', href: '/dashboard/operations/inbound' },
      { name: 'Warehouse', href: '/dashboard/operations/warehouse' },
      { name: 'Production', href: '/dashboard/operations/production' },
      { name: 'Outbound', href: '/dashboard/operations/outbound' },
      { name: 'Customer Fulfillment', href: '/dashboard/operations/customer-orders' },
      { name: 'Exceptions', href: '/dashboard/operations/exceptions' },
    ],
  },

  {
    id: 'manufacturing',
    name: 'Manufacturing',
    icon: Factory,
    href: '/dashboard/manufacturing',
    sub: [
      { name: 'Command Center', href: '/dashboard/manufacturing' },
      { name: 'Work Orders', href: '/dashboard/manufacturing/production-orders' },
      { name: 'Bills of Materials', href: '/dashboard/manufacturing/bills-of-materials' },
      { name: 'Master Schedule (MPS)', href: '/dashboard/manufacturing/master-production-schedules' },
      { name: 'MRP', href: '/dashboard/manufacturing/mrp' },
      { name: 'Work Cells', href: '/dashboard/manufacturing/work-centers' },
    ],
  },

  {
    id: 'distribution',
    name: 'Distribution',
    icon: Truck,
    href: '/dashboard/distribution',
    sub: [
      { name: 'Command Center', href: '/dashboard/distribution' },
      { name: 'Inbound Logistics', href: '/dashboard/distribution/inbound' },
      { name: 'Outbound Logistics', href: '/dashboard/distribution/outbound' },
      { name: 'Live Tracking', href: '/dashboard/distribution/tracking' },
      { name: 'Carriers', href: '/dashboard/distribution/carriers' },
      { name: 'Fleet & Drivers', href: '/dashboard/distribution/fleet-drivers' },
      { name: 'Incoterms 2020', href: '/dashboard/distribution/incoterms' },
    ],
  },

  {
    id: 'accounting',
    name: 'Accounting',
    icon: Calculator,
    href: '/dashboard/accounting',
    sub: [
      { name: 'Overview', href: '/dashboard/accounting' },
      { name: 'Chart of accounts', href: '/dashboard/accounting/chart-of-accounts' },
      { name: 'AP', href: '/dashboard/accounting/accounts-payable' },
      { name: 'AR', href: '/dashboard/accounting/accounts-receivable' },
      { name: 'Bank', href: '/dashboard/accounting/bank-reconciliation' },
      { name: 'Journals', href: '/dashboard/accounting/journal-entries' },
      { name: 'Reports', href: '/dashboard/accounting/reports' },
      { name: 'Tax', href: '/dashboard/accounting/tax' },
      { name: 'Settings', href: '/dashboard/accounting/settings' },
    ],
  },

  {
    id: 'quality',
    name: 'Quality',
    icon: ShieldCheck,
    href: '/dashboard/quality',
    sub: [
      { name: 'Overview', href: '/dashboard/quality' },
      { name: 'Inspections', href: '/dashboard/quality/inspections' },
      { name: 'HACCP', href: '/dashboard/quality/haccp' },
      { name: 'Traceability', href: '/dashboard/quality/traceability' },
    ],
  },

  {
    id: 'projects',
    name: 'Projects',
    icon: FolderKanban,
    href: '/dashboard/projects',
    sub: [
      { name: 'Overview', href: '/dashboard/projects' },
      { name: 'Portfolio', href: '/dashboard/projects/portfolio' },
      { name: 'Kanban', href: '/dashboard/projects/kanban-boards' },
      { name: 'Milestones', href: '/dashboard/projects/milestones' },
    ],
  },

  {
    id: 'sustainability',
    name: 'Sustainability',
    icon: Leaf,
    href: '/dashboard/sustainability',
    sub: [
      { name: 'Overview', href: '/dashboard/sustainability' },
      { name: 'Carbon', href: '/dashboard/sustainability/carbon-tracking' },
      { name: 'Ethical sourcing', href: '/dashboard/sustainability/ethical-sourcing' },
    ],
  },

  {
    id: 'intelligence',
    name: 'Intelligence',
    icon: Brain,
    href: '/dashboard/intelligence',
    sub: [
      { name: 'Overview', href: '/dashboard/intelligence' },
      { name: 'Pulse', href: '/dashboard/intelligence/pulse-dashboard' },
      { name: 'Insights', href: '/dashboard/intelligence/neural-insights' },
      { name: 'Forecasts', href: '/dashboard/intelligence/predictive-forecasts' },
      { name: 'Scorecards', href: '/dashboard/intelligence/custom-scorecards' },
      { name: 'Leadership Super-Cube®', href: '/dashboard/intelligence/leadership-development' },
    ],
  },
];

export default function Sidebar({ forceExpanded = false }: { forceExpanded?: boolean }) {
  const pathname = usePathname();
  const { collapsed, toggle, setCollapsed } = useSidebarChrome();
  const isCollapsed = forceExpanded ? false : collapsed;
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const { role, canViewModule, homePath, roleLabel, rights, loading } = useCompanyRole();

  const visibleModules = useMemo(() => {
    if (role === 'sales_contractor') {
      return modules.filter((mod) => mod.id === 'sales-portal');
    }
    return modules.filter((mod) => {
      const resource = SIDEBAR_MODULE_RESOURCE[mod.id];
      if (!resource) return true;
      if (!role) return true;
      return canViewModule(resource);
    });
  }, [role, canViewModule]);

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (!pathname) return;
    const active = visibleModules.find((mod) => {
      if (mod.href === '/dashboard') return pathname === '/dashboard';
      if (mod.href === '/sales') {
        return pathname === '/sales' || pathname.startsWith('/sales/');
      }
      return pathname === mod.href || pathname.startsWith(`${mod.href}/`);
    });
    if (!active || active.sub.length === 0) return;
    setExpandedModules((prev) => {
      if (prev[active.id]) return prev;
      return { ...prev, [active.id]: true };
    });
  }, [pathname, visibleModules]);

  const isModuleActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/dashboard') return pathname === '/dashboard';
    if (href === '/sales') return pathname === '/sales' || pathname.startsWith('/sales/');
    // Network uses /dashboard/connections
    if (href === '/dashboard/connections') {
      return (
        pathname === '/dashboard/connections' ||
        pathname.startsWith('/dashboard/connections/') ||
        pathname.startsWith('/dashboard/invite-business')
      );
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  /** Icon-only rail (desktop collapsed) */
  if (isCollapsed) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-3 border-b border-neutral-100 flex flex-col items-center gap-2">
          <Link href={homePath || '/dashboard'} title="Dashboard" className="block">
            <Image
              src="/sa-logo.png"
              alt="SupplierAdvisor"
              width={36}
              height={36}
              className="rounded-xl"
              priority
            />
          </Link>
          <button
            type="button"
            onClick={toggle}
            className="p-2 rounded-xl border border-neutral-200 text-neutral-500 hover:border-[#00b4d8] hover:text-[#00b4d8] transition-colors"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-2 overflow-y-auto flex flex-col items-center gap-1">
          {visibleModules.map((mod) => {
            const Icon = mod.icon;
            const isActive = isModuleActive(mod.href);
            return (
              <Link
                key={mod.id}
                href={mod.href}
                title={mod.name}
                onClick={() => {
                  // Expanding makes sub-nav usable after landing in the module
                  if (mod.sub.length > 0) {
                    setCollapsed(false);
                    setExpandedModules((prev) => ({ ...prev, [mod.id]: true }));
                  }
                }}
                className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all ${
                  isActive
                    ? 'bg-[#00b4d8] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-neutral-100 hover:text-[#0077b6]'
                }`}
              >
                <Icon className="w-5 h-5" />
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-neutral-100 flex flex-col items-center gap-2">
          <Link
            href="/dashboard/select-company"
            title="Switch company"
            className="w-11 h-11 flex items-center justify-center rounded-2xl text-neutral-500 hover:bg-neutral-100 hover:text-[#00b4d8]"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </Link>
          <button
            type="button"
            title="Ask Grok"
            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-[#00b4d8] text-white hover:bg-[#0096c7]"
            onClick={() =>
              toast.message('Grok AI Assistant', {
                description: 'Context-aware help across CRM, SRM, inventory, and operations.',
              })
            }
          >
            <Brain className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-5 border-b border-neutral-100">
        <div className="flex items-start justify-between gap-2">
          <Link href={homePath || '/dashboard'} className="flex items-center gap-3 min-w-0">
            <Image
              src="/sa-logo.png"
              alt="SupplierAdvisor"
              width={40}
              height={40}
              className="rounded-xl shrink-0"
              priority
            />
            <div className="font-black text-lg tracking-[-1px] leading-none text-slate-900 truncate">
              SupplierAdvisor®
            </div>
          </Link>
          {!forceExpanded && (
            <button
              type="button"
              onClick={toggle}
              className="p-2 rounded-xl border border-neutral-200 text-neutral-500 hover:border-[#00b4d8] hover:text-[#00b4d8] shrink-0"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
        <Link
          href="/dashboard/select-company"
          className="mt-4 flex items-center gap-2 text-sm text-neutral-500 hover:text-[#00b4d8] transition-colors"
        >
          <ArrowLeftRight className="w-4 h-4" />
          Switch company
        </Link>
        {!loading && role && (
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            {roleLabel || role}
            {rights ? ` · ${rights}` : ''}
          </p>
        )}
      </div>

      <nav className="flex-1 p-3 overflow-y-auto">
        {visibleModules.map((mod) => {
          const Icon = mod.icon;
          const isActive = isModuleActive(mod.href);
          const isExpanded = expandedModules[mod.id] ?? false;

          return (
            <div key={mod.id} className="mb-1">
              <div
                className={`flex items-center justify-between px-3 py-2.5 rounded-2xl transition-all ${
                  isActive ? 'bg-[#00b4d8] text-white' : 'hover:bg-neutral-100 text-slate-800'
                }`}
              >
                <Link href={mod.href} className="flex items-center gap-3 flex-1 min-w-0">
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-semibold truncate text-sm">{mod.name}</span>
                </Link>

                {mod.sub.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleModule(mod.id);
                    }}
                    className="p-1.5 -mr-1 rounded-xl hover:bg-white/20 transition-colors"
                    aria-label={`Toggle ${mod.name} submenu`}
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                )}
              </div>

              {mod.sub.length > 0 && isExpanded && (
                <div className="ml-5 mt-0.5 space-y-0.5 border-l border-neutral-100 pl-2">
                  {mod.sub.map((sub, index) => (
                    <Link
                      key={index}
                      href={sub.href}
                      className={`block px-3 py-2 rounded-xl text-xs transition-all ${
                        pathname === sub.href
                          ? 'text-[#00b4d8] bg-sky-50 font-semibold'
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

      <div className="p-3 border-t border-neutral-100 space-y-2">
        <SystemHealthBadge />
        <button
          type="button"
          className="w-full bg-[#00b4d8] text-white py-2.5 rounded-2xl flex items-center justify-center gap-2 font-medium hover:bg-[#0096c7] transition-colors shadow-sm cursor-pointer text-sm"
          title="AI assistant"
          onClick={() =>
            toast.message('Grok AI Assistant', {
              description: 'Context-aware help across CRM, SRM, inventory, and operations.',
            })
          }
        >
          <Brain className="w-4 h-4" />
          Ask Grok
        </button>
        <p className="text-[10px] text-center text-neutral-400 font-medium">
          Light workspace · on-chain ready
        </p>
      </div>
    </div>
  );
}
