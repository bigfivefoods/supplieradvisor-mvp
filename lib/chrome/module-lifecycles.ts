import type { ProcessStep } from '@/components/relationship/RelationshipChrome';

/** Sticky process rail definitions — one source of truth per module. */
export type ModuleLifecycle = {
  id: string;
  /** Path prefixes that activate this lifecycle (longest match wins) */
  prefixes: string[];
  title: string;
  steps: readonly ProcessStep[];
};

export const MODULE_LIFECYCLES: readonly ModuleLifecycle[] = [
  {
    id: 'operations',
    prefixes: ['/dashboard/operations'],
    title: 'Operations',
    steps: [
      { label: 'Procure', href: '/dashboard/operations/supplier-orders' },
      { label: 'Inbound', href: '/dashboard/operations/inbound' },
      { label: 'Warehouse', href: '/dashboard/operations/warehouse' },
      { label: 'Make', href: '/dashboard/operations/production' },
      { label: 'Outbound', href: '/dashboard/operations/outbound' },
      { label: 'Fulfill', href: '/dashboard/operations/customer-orders' },
      { label: 'Exceptions', href: '/dashboard/operations/exceptions' },
    ],
  },
  {
    id: 'manufacturing',
    prefixes: ['/dashboard/manufacturing'],
    title: 'Manufacturing',
    steps: [
      { label: 'Command', href: '/dashboard/manufacturing' },
      { label: 'MPS', href: '/dashboard/manufacturing/master-production-schedules' },
      { label: 'MRP', href: '/dashboard/manufacturing/mrp' },
      { label: 'BOM', href: '/dashboard/manufacturing/bills-of-materials' },
      { label: 'Work orders', href: '/dashboard/manufacturing/production-orders' },
      { label: 'Cells', href: '/dashboard/manufacturing/work-centers' },
    ],
  },
  {
    id: 'distribution',
    prefixes: ['/dashboard/distribution'],
    title: 'Distribution',
    steps: [
      { label: 'Command', href: '/dashboard/distribution' },
      { label: 'Inbound', href: '/dashboard/distribution/inbound' },
      { label: 'Outbound', href: '/dashboard/distribution/outbound' },
      { label: 'Track', href: '/dashboard/distribution/tracking' },
      { label: 'Carriers', href: '/dashboard/distribution/carriers' },
      { label: 'Fleet', href: '/dashboard/distribution/fleet-drivers' },
      { label: 'Incoterms', href: '/dashboard/distribution/incoterms' },
    ],
  },
  {
    id: 'inventory',
    prefixes: ['/dashboard/inventory'],
    title: 'Inventory',
    steps: [
      { label: 'Products', href: '/dashboard/inventory/products' },
      { label: 'Locations', href: '/dashboard/inventory/warehouses' },
      { label: 'Stock', href: '/dashboard/inventory/stock' },
      { label: 'Receive', href: '/dashboard/inventory/scan' },
      { label: 'Transfers', href: '/dashboard/inventory/stock-transfers' },
      { label: 'Counts', href: '/dashboard/inventory/counts' },
    ],
  },
  {
    id: 'suppliers',
    prefixes: ['/dashboard/suppliers'],
    title: 'Suppliers',
    steps: [
      { label: 'Discover', href: '/dashboard/suppliers/discover' },
      { label: 'Invite', href: '/dashboard/suppliers/add' },
      { label: 'Connect', href: '/dashboard/suppliers/network' },
      { label: 'PO', href: '/dashboard/suppliers/po' },
      { label: 'OTIFEF', href: '/dashboard/suppliers/performance' },
      { label: 'Rate', href: '/dashboard/suppliers/ratings' },
    ],
  },
  {
    id: 'customers',
    prefixes: ['/dashboard/customers', '/dashboard/buyer'],
    title: 'Customers',
    steps: [
      { label: 'Lead', href: '/dashboard/customers/leads' },
      { label: 'Quote', href: '/dashboard/customers/quotes' },
      { label: 'Order', href: '/dashboard/customers/orders' },
      { label: 'Invoice', href: '/dashboard/customers/invoices' },
      { label: 'Loyalty', href: '/dashboard/customers/loyalty' },
      { label: 'RIAD', href: '/dashboard/customers/riad-log' },
    ],
  },
  {
    id: 'connections',
    prefixes: ['/dashboard/connections'],
    title: 'Network',
    steps: [
      { label: 'Discover', href: '/dashboard/suppliers/discover' },
      { label: 'Connect', href: '/dashboard/connections' },
      { label: 'Pricing', href: '/dashboard/connections/pricing' },
      { label: 'Trade', href: '/dashboard/suppliers/po' },
      { label: 'Market', href: '/dashboard/connections/marketplace' },
    ],
  },
  {
    id: 'accounting',
    prefixes: ['/dashboard/accounting'],
    title: 'Accounting',
    steps: [
      { label: 'CoA', href: '/dashboard/accounting/chart-of-accounts' },
      { label: 'Journal', href: '/dashboard/accounting/journal-entries' },
      { label: 'AR', href: '/dashboard/accounting/accounts-receivable' },
      { label: 'AP', href: '/dashboard/accounting/accounts-payable' },
      { label: 'Pay', href: '/dashboard/accounting/payments' },
      { label: 'Bank', href: '/dashboard/accounting/bank-reconciliation' },
      { label: 'Reports', href: '/dashboard/accounting/reports' },
    ],
  },
  {
    id: 'containers',
    prefixes: ['/dashboard/containers'],
    title: 'Containers',
    steps: [
      { label: 'Add', href: '/dashboard/containers/add' },
      { label: 'Map', href: '/dashboard/containers/map' },
      { label: 'Contractors', href: '/dashboard/containers/contractors' },
      { label: 'Train', href: '/dashboard/containers/training' },
      { label: 'Manage', href: '/dashboard/containers/manage' },
      { label: 'Metrics', href: '/dashboard/containers/metrics' },
    ],
  },
  {
    id: 'manufacturing-quality',
    prefixes: ['/dashboard/quality'],
    title: 'Quality',
    steps: [
      { label: 'HACCP', href: '/dashboard/quality/haccp' },
      { label: 'Inspect', href: '/dashboard/quality/inspections' },
      { label: 'Trace', href: '/dashboard/quality/traceability' },
      { label: 'Recall', href: '/dashboard/quality/recall-simulator' },
    ],
  },
  {
    id: 'intelligence',
    prefixes: ['/dashboard/intelligence'],
    title: 'Intelligence',
    steps: [
      { label: 'Pulse', href: '/dashboard/intelligence/pulse-dashboard' },
      { label: 'Insights', href: '/dashboard/intelligence/neural-insights' },
      { label: 'Forecast', href: '/dashboard/intelligence/predictive-forecasts' },
      { label: 'Scorecards', href: '/dashboard/intelligence/custom-scorecards' },
      { label: 'Leadership', href: '/dashboard/intelligence/leadership-development' },
    ],
  },
  {
    id: 'my-business',
    prefixes: ['/dashboard/my-business'],
    title: 'My Business',
    steps: [
      { label: 'Profile', href: '/dashboard/my-business/profile' },
      { label: 'Team', href: '/dashboard/my-business/team' },
      { label: 'Settings', href: '/dashboard/my-business/settings' },
      { label: 'Legal', href: '/dashboard/my-business/legal' },
      { label: 'Documents', href: '/dashboard/my-business/documents' },
      { label: 'RIAD', href: '/dashboard/my-business/riad-log' },
    ],
  },
] as const;

export function lifecycleForPath(pathname: string | null | undefined): ModuleLifecycle | null {
  if (!pathname) return null;
  // Prefer longest prefix match
  let best: ModuleLifecycle | null = null;
  let bestLen = -1;
  for (const life of MODULE_LIFECYCLES) {
    for (const prefix of life.prefixes) {
      if (
        (pathname === prefix || pathname.startsWith(prefix + '/')) &&
        prefix.length > bestLen
      ) {
        best = life;
        bestLen = prefix.length;
      }
    }
  }
  return best;
}

export function isStepActive(pathname: string, href: string, exact?: boolean) {
  if (exact || href.split('/').length <= 3) {
    // For shallow hubs like /dashboard/manufacturing treat exact or child
    if (pathname === href) return true;
  }
  if (pathname === href) return true;
  // Prefer most specific step: active if path starts with href and no longer sibling match needed
  return pathname.startsWith(href + '/');
}
