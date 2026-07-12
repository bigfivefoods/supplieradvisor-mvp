/**
 * Single source of truth for dashboard module navigation.
 * - One unique Lucide icon per module
 * - Nested items = critical process steps only (short verb labels)
 * - Process rail + Sidebar both read from here (no duplicate process trees)
 */
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Handshake,
  Building2,
  Network,
  ContactRound,
  UsersRound,
  Container,
  Warehouse,
  Workflow,
  Factory,
  Ship,
  Landmark,
  ClipboardCheck,
  HardHat,
  FolderKanban,
  Leaf,
  Brain,
  BookOpen,
} from 'lucide-react';
import type { ProcessStep } from '@/components/relationship/RelationshipChrome';
import type { PermissionResource } from '@/lib/business/permissions';

export type ModuleNavItem = {
  name: string;
  href: string;
  /** When true, only active on exact path (hub roots) */
  exact?: boolean;
  desc?: string;
};

export type ModuleNav = {
  id: string;
  name: string;
  icon: LucideIcon;
  href: string;
  /** Critical process steps under this module (verb-style names) */
  steps: readonly ModuleNavItem[];
  /** Permission resource for role filtering (optional) */
  resource?: PermissionResource;
};

/**
 * Unique icons only — never reuse an icon across modules.
 *
 * home LayoutDashboard · sales Handshake · business Building2 · network Network
 * suppliers ContactRound · customers UsersRound · containers Container
 * inventory Warehouse · operations Workflow · manufacturing Factory
 * distribution Ship · accounting Landmark · quality ClipboardCheck
 * projects FolderKanban · sustainability Leaf · intelligence Brain · guide BookOpen
 */
export const MODULE_NAV: readonly ModuleNav[] = [
  {
    id: 'home',
    name: 'Home',
    icon: LayoutDashboard,
    href: '/dashboard',
    steps: [],
    resource: 'dashboard',
  },
  {
    id: 'sales-portal',
    name: 'Sales',
    icon: Handshake,
    href: '/sales',
    resource: 'sales_portal',
    steps: [
      { name: 'Sell', href: '/sales', exact: true, desc: 'Command centre' },
      { name: 'Pipeline', href: '/sales/pipeline' },
      { name: 'Quote', href: '/sales/quotes' },
      { name: 'Order', href: '/sales/orders' },
      { name: 'Invoice', href: '/sales/invoices' },
      { name: 'Earn', href: '/sales/earnings' },
      { name: 'Subscribe', href: '/sales/subscribe' },
    ],
  },
  {
    id: 'my-business',
    name: 'Company',
    icon: Building2,
    href: '/dashboard/my-business',
    resource: 'profile',
    steps: [
      { name: 'Overview', href: '/dashboard/my-business', exact: true },
      { name: 'Profile', href: '/dashboard/my-business/profile' },
      { name: 'Team', href: '/dashboard/my-business/team' },
      { name: 'Billing', href: '/dashboard/my-business/billing' },
      { name: 'Docs', href: '/dashboard/my-business/documents' },
      { name: 'Risks', href: '/dashboard/my-business/riad-log' },
      { name: 'Settings', href: '/dashboard/my-business/settings' },
    ],
  },
  {
    id: 'network',
    name: 'Network',
    icon: Network,
    href: '/dashboard/connections',
    resource: 'network',
    steps: [
      { name: 'Graph', href: '/dashboard/connections', exact: true },
      { name: 'Price', href: '/dashboard/connections/pricing' },
      { name: 'Market', href: '/dashboard/connections/marketplace' },
      { name: 'Invite', href: '/dashboard/invite-business' },
    ],
  },
  {
    id: 'suppliers',
    name: 'Suppliers',
    icon: ContactRound,
    href: '/dashboard/suppliers',
    resource: 'suppliers',
    steps: [
      { name: 'Overview', href: '/dashboard/suppliers', exact: true },
      { name: 'Find', href: '/dashboard/suppliers/discover' },
      { name: 'Book', href: '/dashboard/suppliers/network' },
      { name: 'Invite', href: '/dashboard/suppliers/invites' },
      { name: 'Order', href: '/dashboard/suppliers/po' },
      { name: 'Score', href: '/dashboard/suppliers/performance' },
      { name: 'Rate', href: '/dashboard/suppliers/ratings' },
    ],
  },
  {
    id: 'customers',
    name: 'Customers',
    icon: UsersRound,
    href: '/dashboard/customers',
    resource: 'customers',
    steps: [
      { name: 'Overview', href: '/dashboard/customers', exact: true },
      { name: 'Lead', href: '/dashboard/customers/leads' },
      { name: 'Add', href: '/dashboard/customers/onboard' },
      { name: 'Quote', href: '/dashboard/customers/quotes' },
      { name: 'Order', href: '/dashboard/customers/orders' },
      { name: 'Invoice', href: '/dashboard/customers/invoices' },
      { name: 'Claim', href: '/dashboard/customers/claims' },
    ],
  },
  {
    id: 'containers',
    name: 'Containers',
    icon: Container,
    href: '/dashboard/containers',
    resource: 'containers',
    steps: [
      { name: 'Overview', href: '/dashboard/containers', exact: true },
      { name: 'Manage', href: '/dashboard/containers/manage' },
      { name: 'Map', href: '/dashboard/containers/map' },
      { name: 'Add', href: '/dashboard/containers/add' },
      { name: 'Staff', href: '/dashboard/containers/contractors' },
      { name: 'Score', href: '/dashboard/containers/metrics' },
    ],
  },
  {
    id: 'inventory',
    name: 'Inventory',
    icon: Warehouse,
    href: '/dashboard/inventory',
    resource: 'inventory',
    steps: [
      { name: 'Overview', href: '/dashboard/inventory', exact: true },
      { name: 'Catalog', href: '/dashboard/inventory/products' },
      { name: 'Stock', href: '/dashboard/inventory/stock' },
      { name: 'Receive', href: '/dashboard/inventory/scan' },
      { name: 'Move', href: '/dashboard/inventory/stock-transfers' },
      { name: 'Count', href: '/dashboard/inventory/counts' },
      { name: 'Lots', href: '/dashboard/inventory/lots' },
    ],
  },
  {
    id: 'operations',
    name: 'Operations',
    icon: Workflow,
    href: '/dashboard/operations',
    resource: 'operations',
    steps: [
      { name: 'Overview', href: '/dashboard/operations', exact: true },
      { name: 'Inbound', href: '/dashboard/operations/inbound' },
      { name: 'Store', href: '/dashboard/operations/warehouse' },
      { name: 'Make', href: '/dashboard/operations/production' },
      { name: 'Outbound', href: '/dashboard/operations/outbound' },
      { name: 'Fulfill', href: '/dashboard/operations/customer-orders' },
      { name: 'Fix', href: '/dashboard/operations/exceptions' },
    ],
  },
  {
    id: 'manufacturing',
    name: 'Make',
    icon: Factory,
    href: '/dashboard/manufacturing',
    resource: 'manufacturing',
    steps: [
      { name: 'Overview', href: '/dashboard/manufacturing', exact: true },
      { name: 'Plan', href: '/dashboard/manufacturing/master-production-schedules' },
      { name: 'Explode', href: '/dashboard/manufacturing/mrp' },
      { name: 'BOM', href: '/dashboard/manufacturing/bills-of-materials' },
      { name: 'Run', href: '/dashboard/manufacturing/production-orders' },
      { name: 'Cells', href: '/dashboard/manufacturing/work-centers' },
    ],
  },
  {
    id: 'distribution',
    name: 'Ship',
    icon: Ship,
    href: '/dashboard/distribution',
    resource: 'distribution',
    steps: [
      { name: 'Overview', href: '/dashboard/distribution', exact: true },
      { name: 'Inbound', href: '/dashboard/distribution/inbound' },
      { name: 'Outbound', href: '/dashboard/distribution/outbound' },
      { name: 'Track', href: '/dashboard/distribution/tracking' },
      { name: 'Carrier', href: '/dashboard/distribution/carriers' },
      { name: 'Fleet', href: '/dashboard/distribution/fleet-drivers' },
    ],
  },
  {
    id: 'accounting',
    name: 'Finance',
    icon: Landmark,
    href: '/dashboard/accounting',
    resource: 'accounting',
    steps: [
      { name: 'Overview', href: '/dashboard/accounting', exact: true },
      { name: 'Chart', href: '/dashboard/accounting/chart-of-accounts' },
      { name: 'Journals', href: '/dashboard/accounting/journal-entries' },
      { name: 'Collect', href: '/dashboard/accounting/accounts-receivable' },
      { name: 'Pay', href: '/dashboard/accounting/accounts-payable' },
      { name: 'Bank', href: '/dashboard/accounting/bank-reconciliation' },
      { name: 'Manage', href: '/dashboard/accounting/management' },
      { name: 'VAT', href: '/dashboard/accounting/tax' },
      { name: 'Report', href: '/dashboard/accounting/reports' },
      { name: 'Close', href: '/dashboard/accounting/settings' },
    ],
  },
  {
    id: 'sheq',
    name: 'SHEQ',
    icon: HardHat,
    href: '/dashboard/sheq',
    resource: 'sheq',
    steps: [
      { name: 'Overview', href: '/dashboard/sheq', exact: true },
      { name: 'Incidents', href: '/dashboard/sheq/incidents' },
      { name: 'Hazards', href: '/dashboard/sheq/hazards' },
      { name: 'NCR', href: '/dashboard/sheq/ncrs' },
      { name: 'CAPA', href: '/dashboard/sheq/capas' },
      { name: 'Quality', href: '/dashboard/quality' },
    ],
  },
  {
    id: 'quality',
    name: 'Quality',
    icon: ClipboardCheck,
    href: '/dashboard/quality',
    resource: 'sheq',
    steps: [
      { name: 'Overview', href: '/dashboard/quality', exact: true },
      { name: 'Inspect', href: '/dashboard/quality/inspections' },
      { name: 'HACCP', href: '/dashboard/quality/haccp' },
      { name: 'Trace', href: '/dashboard/quality/traceability-graph' },
      { name: 'Recall', href: '/dashboard/quality/recall-simulator' },
      { name: 'Export', href: '/dashboard/quality/regulatory-reports' },
      { name: 'SHEQ', href: '/dashboard/sheq' },
    ],
  },
  {
    id: 'projects',
    name: 'Projects',
    icon: FolderKanban,
    href: '/dashboard/projects',
    resource: 'projects',
    steps: [
      { name: 'Overview', href: '/dashboard/projects', exact: true },
      { name: 'Plan', href: '/dashboard/projects/portfolio' },
      { name: 'Board', href: '/dashboard/projects/kanban-boards' },
      { name: 'Gate', href: '/dashboard/projects/milestones' },
      { name: 'Log', href: '/dashboard/projects/timesheets' },
      { name: 'Risk', href: '/dashboard/projects/risk-register' },
    ],
  },
  {
    id: 'sustainability',
    name: 'Impact',
    icon: Leaf,
    href: '/dashboard/sustainability',
    resource: 'operations',
    steps: [
      { name: 'Overview', href: '/dashboard/sustainability', exact: true },
      { name: 'Measure', href: '/dashboard/sustainability/carbon-tracking' },
      { name: 'Report', href: '/dashboard/sustainability/reports' },
    ],
  },
  {
    id: 'intelligence',
    name: 'Insights',
    icon: Brain,
    href: '/dashboard/intelligence',
    resource: 'intelligence',
    steps: [
      { name: 'Overview', href: '/dashboard/intelligence', exact: true },
      { name: 'Pulse', href: '/dashboard/intelligence/pulse-dashboard' },
      { name: 'Forecast', href: '/dashboard/intelligence/predictive-forecasts' },
      { name: 'Score', href: '/dashboard/intelligence/custom-scorecards' },
      { name: 'Lead', href: '/dashboard/intelligence/leadership-development' },
    ],
  },
  /**
   * Last module — system training. Always available (dashboard resource).
   * Nested steps = curriculum chapters (verb-ish short names).
   */
  {
    id: 'guide',
    name: 'Guide',
    icon: BookOpen,
    href: '/dashboard/guide',
    resource: 'dashboard',
    steps: [
      { name: 'Start', href: '/dashboard/guide', exact: true, desc: 'System overview' },
      { name: 'Company', href: '/dashboard/guide/company' },
      { name: 'Network', href: '/dashboard/guide/network' },
      { name: 'Buy', href: '/dashboard/guide/suppliers' },
      { name: 'Sell', href: '/dashboard/guide/customers' },
      { name: 'Stock', href: '/dashboard/guide/inventory' },
      { name: 'Ops', href: '/dashboard/guide/operations' },
      { name: 'Make', href: '/dashboard/guide/make' },
      { name: 'Ship', href: '/dashboard/guide/ship' },
      { name: 'Assure', href: '/dashboard/guide/quality' },
      { name: 'Money', href: '/dashboard/guide/finance' },
      { name: 'Secure', href: '/dashboard/guide/roles-security' },
    ],
  },
] as const;

/** Sidebar shape: hub + nested critical steps only */
export function sidebarModulesFromNav() {
  return MODULE_NAV.map((m) => ({
    id: m.id,
    name: m.name,
    icon: m.icon,
    href: m.href,
    sub: m.steps.map((s) => ({ name: s.name, href: s.href })),
  }));
}

/** Process rail lifecycles from the same critical steps */
export function lifecyclesFromNav(): Array<{
  id: string;
  prefixes: string[];
  title: string;
  steps: ProcessStep[];
}> {
  return MODULE_NAV.filter((m) => m.id !== 'home' && m.steps.length > 0).map((m) => ({
    id: m.id,
    prefixes: [m.href],
    title: m.name,
    steps: m.steps.map((s) => ({
      label: s.name,
      href: s.href,
      exact: s.exact,
      desc: s.desc,
    })),
  }));
}

/** Buyer portal is nested under customers product-wise but keeps its own rail when deep-linked */
export const BUYER_LIFECYCLE = {
  id: 'buyer',
  prefixes: ['/dashboard/buyer'],
  title: 'Buy',
  steps: [
    { label: 'Overview', href: '/dashboard/buyer', exact: true },
    { label: 'Source', href: '/dashboard/buyer/suppliers' },
    { label: 'Order', href: '/dashboard/buyer/pos' },
    { label: 'Docs', href: '/dashboard/buyer/documents' },
    { label: 'Rate', href: '/dashboard/buyer/reviews' },
  ] as ProcessStep[],
};
