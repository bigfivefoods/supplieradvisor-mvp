/**
 * Single source of truth for dashboard module navigation.
 * Restored core modules after accidental wipe; includes Order chains under Operations.
 */
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Building2,
  Network,
  ContactRound,
  UsersRound,
  Warehouse,
  Workflow,
  Factory,
  Landmark,
  BookOpen,
} from 'lucide-react';
import type { ProcessStep } from '@/components/relationship/RelationshipChrome';
import type { PermissionResource } from '@/lib/business/permissions';

export type ModuleNavItem = {
  name: string;
  href: string;
  exact?: boolean;
  desc?: string;
  group?: string;
  section?: string;
  rail?: boolean;
};

export type ModuleNav = {
  id: string;
  name: string;
  icon: LucideIcon;
  href: string;
  steps: readonly ModuleNavItem[];
  resource?: PermissionResource;
};

export const MODULE_NAV: readonly ModuleNav[] = [
  {
    id: 'home',
    name: 'Home',
    icon: LayoutDashboard,
    href: '/dashboard',
    steps: [
      { name: 'Messages', href: '/dashboard/messages?from=home', desc: 'Team · trade · care inbox', section: 'Home', rail: false },
      { name: 'Calendar', href: '/dashboard/calendar', desc: 'Company week · leave · deliveries', section: 'Home', rail: false },
    ],
    resource: 'dashboard',
  },
  {
    id: 'my-business',
    name: 'Company',
    icon: Building2,
    href: '/dashboard/my-business',
    resource: 'profile',
    steps: [
      { name: 'Overview', href: '/dashboard/my-business', exact: true, desc: 'Company command tower', section: 'Home' },
      { name: 'Modules', href: '/dashboard/my-business/modules', desc: 'Sector · packs · sidebar hubs', section: 'Workspace' },
      { name: 'Team', href: '/dashboard/my-business/team', desc: 'Invite people with roles', section: 'People' },
    ],
  },
  {
    id: 'network',
    name: 'Network',
    icon: Network,
    href: '/dashboard/connections',
    resource: 'network',
    steps: [
      { name: 'Graph', href: '/dashboard/connections', exact: true, section: 'Home' },
      { name: 'Messages', href: '/dashboard/messages', desc: 'Colleagues · suppliers · customers', section: 'Home' },
    ],
  },
  {
    id: 'suppliers',
    name: 'Suppliers',
    icon: ContactRound,
    href: '/dashboard/suppliers',
    resource: 'suppliers',
    steps: [
      { name: 'Overview', href: '/dashboard/suppliers', exact: true, desc: 'SRM command tower', section: 'Home' },
      { name: 'Book', href: '/dashboard/suppliers/network', desc: 'Your supplier book', section: 'Source' },
      { name: 'Order', href: '/dashboard/suppliers/po', desc: 'All POs — raise, receive, settle', section: 'Trade' },
    ],
  },
  {
    id: 'customers',
    name: 'Customers',
    icon: UsersRound,
    href: '/dashboard/customers',
    resource: 'customers',
    steps: [
      { name: 'Overview', href: '/dashboard/customers', exact: true, desc: 'CRM command', section: 'Home' },
      { name: 'Book', href: '/dashboard/customers/profiles', desc: 'Customer accounts', section: 'Source' },
      { name: 'Order', href: '/dashboard/customers/orders', desc: 'Sales orders', section: 'Trade' },
      { name: 'Invoice', href: '/dashboard/customers/invoices', desc: 'Bill customers', section: 'Trade' },
    ],
  },
  {
    id: 'inventory',
    name: 'Inventory',
    icon: Warehouse,
    href: '/dashboard/inventory',
    resource: 'inventory',
    steps: [
      { name: 'Overview', href: '/dashboard/inventory', exact: true, section: 'Home' },
      { name: 'Catalog', href: '/dashboard/inventory/products', section: 'Catalog' },
      { name: 'Stock', href: '/dashboard/inventory/stock', section: 'Stock' },
    ],
  },
  {
    id: 'operations',
    name: 'Operations',
    icon: Workflow,
    href: '/dashboard/operations',
    resource: 'operations',
    steps: [
      { name: 'Overview', href: '/dashboard/operations', exact: true, section: 'Home' },
      { name: 'Calendar', href: '/dashboard/calendar', desc: 'Advisor · leave · deliveries', section: 'Home' },
      { name: 'Chains', href: '/dashboard/operations/chains', desc: 'SO <-> PO · margin · production cascade', section: 'Flow' },
      { name: 'Inbound', href: '/dashboard/operations/inbound', section: 'Flow' },
      { name: 'Store', href: '/dashboard/operations/warehouse', section: 'Flow' },
      { name: 'Make', href: '/dashboard/operations/production', section: 'Flow' },
      { name: 'Outbound', href: '/dashboard/operations/outbound', section: 'Flow' },
      { name: 'Fulfill', href: '/dashboard/operations/customer-orders', section: 'Flow' },
      { name: 'Fix', href: '/dashboard/operations/exceptions', section: 'Fix' },
      { name: 'Messages', href: '/dashboard/messages?from=operations&channel=colleague', desc: 'Ops team coordination', section: 'Home', rail: false },
    ],
  },
  {
    id: 'manufacturing',
    name: 'Make',
    icon: Factory,
    href: '/dashboard/manufacturing',
    resource: 'manufacturing',
    steps: [
      { name: 'Overview', href: '/dashboard/manufacturing', exact: true, section: 'Home' },
      { name: 'Run', href: '/dashboard/manufacturing/production-orders', section: 'Run' },
    ],
  },
  {
    id: 'accounting',
    name: 'Finance',
    icon: Landmark,
    href: '/dashboard/accounting',
    resource: 'accounting',
    steps: [
      { name: 'Overview', href: '/dashboard/accounting', exact: true, section: 'Home' },
      { name: 'AR', href: '/dashboard/accounting/accounts-receivable', desc: 'Collect', section: 'Trade' },
      { name: 'AP', href: '/dashboard/accounting/accounts-payable', desc: 'Bills', section: 'Trade' },
    ],
  },
  {
    id: 'guide',
    name: 'Guide',
    icon: BookOpen,
    href: '/dashboard/guide',
    resource: 'dashboard',
    steps: [
      { name: 'Start', href: '/dashboard/guide', exact: true, desc: 'System overview', section: 'Start' },
    ],
  },
] as const;

export function sidebarModulesFromNav() {
  return MODULE_NAV.map((m) => ({
    id: m.id,
    name: m.name,
    icon: m.icon,
    href: m.href,
    sub: m.steps.map((s) => ({
      name: s.name,
      href: s.href,
      exact: Boolean(s.exact),
      group: s.group,
      section: s.section,
      rail: s.rail !== false,
      desc: s.desc,
    })),
  }));
}

export function groupNavSteps<
  T extends { group?: string; name: string; href: string },
>(steps: readonly T[]): Array<{ group: string | null; steps: T[] }> {
  const out: Array<{ group: string | null; steps: T[] }> = [];
  for (const s of steps) {
    const g = s.group || null;
    const last = out[out.length - 1];
    if (last && last.group === g) last.steps.push(s as T);
    else out.push({ group: g, steps: [s as T] });
  }
  return out;
}

const EXTRA_LIFECYCLE_PREFIXES: Record<string, readonly string[]> = {
  customers: ['/dashboard/settle'],
  suppliers: ['/dashboard/escrow'],
  network: ['/dashboard/invite-business'],
};

export function lifecyclesFromNav(): Array<{
  id: string;
  prefixes: string[];
  title: string;
  steps: Array<ProcessStep & { group?: string; rail?: boolean }>;
}> {
  return MODULE_NAV.filter((m) => m.id !== 'home' && m.steps.length > 0).map((m) => ({
    id: m.id,
    prefixes: [m.href, ...(EXTRA_LIFECYCLE_PREFIXES[m.id] || [])],
    title: m.name,
    steps: m.steps.map((s) => ({
      label: s.name,
      href: s.href,
      exact: s.exact,
      desc: s.desc,
      group: s.group,
      section: s.section,
      rail: s.rail !== false,
    })),
  }));
}

export const BUYER_LIFECYCLE = {
  id: 'buyer',
  prefixes: ['/dashboard/buyer'],
  title: 'Buy',
  steps: [
    { label: 'Overview', href: '/dashboard/buyer', exact: true },
    { label: 'Source', href: '/dashboard/buyer/suppliers' },
    { label: 'Order', href: '/dashboard/buyer/pos' },
    { label: 'Docs', href: '/dashboard/buyer/documents' },
    { label: 'Money', href: '/dashboard/buyer/money' },
    { label: 'Rate', href: '/dashboard/buyer/reviews' },
  ] as ProcessStep[],
};
