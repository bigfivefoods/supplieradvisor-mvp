import type { ProcessStep } from '@/components/relationship/RelationshipChrome';

/** Sticky process rail — key functions for every module (navbar source of truth). */
export type ModuleLifecycle = {
  id: string;
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
      { label: 'Command', href: '/dashboard/operations', exact: true, desc: 'Control tower' },
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
      { label: 'Command', href: '/dashboard/manufacturing', exact: true },
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
      { label: 'Command', href: '/dashboard/distribution', exact: true },
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
      { label: 'Command', href: '/dashboard/inventory', exact: true },
      { label: 'Products', href: '/dashboard/inventory/products' },
      { label: 'Locations', href: '/dashboard/inventory/warehouses' },
      { label: 'Stock', href: '/dashboard/inventory/stock' },
      { label: 'Receive', href: '/dashboard/inventory/scan' },
      { label: 'Transfers', href: '/dashboard/inventory/stock-transfers' },
      { label: 'Tracking', href: '/dashboard/inventory/tracking' },
      { label: 'Counts', href: '/dashboard/inventory/counts' },
      { label: 'Lots', href: '/dashboard/inventory/lots' },
      { label: 'EDI', href: '/dashboard/inventory/edi' },
    ],
  },
  {
    id: 'suppliers',
    prefixes: ['/dashboard/suppliers'],
    title: 'Suppliers',
    steps: [
      { label: 'Command', href: '/dashboard/suppliers', exact: true },
      { label: 'Discover', href: '/dashboard/suppliers/discover' },
      { label: 'Book', href: '/dashboard/suppliers/network' },
      { label: 'Add', href: '/dashboard/suppliers/add' },
      { label: 'Invites', href: '/dashboard/suppliers/invites' },
      { label: 'POs', href: '/dashboard/suppliers/po' },
      { label: 'OTIFEF', href: '/dashboard/suppliers/performance' },
      { label: 'Ratings', href: '/dashboard/suppliers/ratings' },
      { label: 'Docs', href: '/dashboard/suppliers/documents' },
      { label: 'Contracts', href: '/dashboard/suppliers/contracts' },
      { label: 'RIAD', href: '/dashboard/suppliers/riad-log' },
    ],
  },
  {
    id: 'customers',
    prefixes: ['/dashboard/customers'],
    title: 'Customers',
    steps: [
      { label: 'Command', href: '/dashboard/customers', exact: true },
      { label: 'Leads', href: '/dashboard/customers/leads' },
      { label: 'Profiles', href: '/dashboard/customers/profiles' },
      { label: 'Onboard', href: '/dashboard/customers/onboard' },
      { label: 'Invites', href: '/dashboard/customers/invites' },
      { label: 'Quotes', href: '/dashboard/customers/quotes' },
      { label: 'Orders', href: '/dashboard/customers/orders' },
      { label: 'Invoices', href: '/dashboard/customers/invoices' },
      { label: 'Loyalty', href: '/dashboard/customers/loyalty' },
      { label: 'Claims', href: '/dashboard/customers/claims' },
      { label: 'Contracts', href: '/dashboard/customers/contracts' },
      { label: 'Reviews', href: '/dashboard/customers/reviews' },
      { label: 'RIAD', href: '/dashboard/customers/riad-log' },
    ],
  },
  {
    id: 'connections',
    prefixes: ['/dashboard/connections'],
    title: 'Network',
    steps: [
      { label: 'Graph', href: '/dashboard/connections', exact: true },
      { label: 'Discover', href: '/dashboard/suppliers/discover' },
      { label: 'Pricing', href: '/dashboard/connections/pricing' },
      { label: 'Market', href: '/dashboard/connections/marketplace' },
      { label: 'Trade', href: '/dashboard/suppliers/po' },
    ],
  },
  {
    id: 'accounting',
    prefixes: ['/dashboard/accounting'],
    title: 'Accounting',
    steps: [
      { label: 'Command', href: '/dashboard/accounting', exact: true },
      { label: 'CoA', href: '/dashboard/accounting/chart-of-accounts' },
      { label: 'Journals', href: '/dashboard/accounting/journal-entries' },
      { label: 'AR', href: '/dashboard/accounting/accounts-receivable' },
      { label: 'AP', href: '/dashboard/accounting/accounts-payable' },
      { label: 'Pay', href: '/dashboard/accounting/payments' },
      { label: 'Bank', href: '/dashboard/accounting/bank-reconciliation' },
      { label: 'Mgmt', href: '/dashboard/accounting/management' },
      { label: 'Reports', href: '/dashboard/accounting/reports' },
      { label: 'Tax', href: '/dashboard/accounting/tax' },
      { label: 'Assets', href: '/dashboard/accounting/fixed-assets' },
      { label: 'Entities', href: '/dashboard/accounting/entities' },
      { label: 'Settings', href: '/dashboard/accounting/settings' },
    ],
  },
  {
    id: 'containers',
    prefixes: ['/dashboard/containers'],
    title: 'Containers',
    steps: [
      { label: 'Command', href: '/dashboard/containers', exact: true },
      { label: 'Manage', href: '/dashboard/containers/manage' },
      { label: 'Map', href: '/dashboard/containers/map' },
      { label: 'Add', href: '/dashboard/containers/add' },
      { label: 'Contractors', href: '/dashboard/containers/contractors' },
      { label: 'Train', href: '/dashboard/containers/training' },
      { label: 'Metrics', href: '/dashboard/containers/metrics' },
      { label: 'RIAD', href: '/dashboard/containers/riad-log' },
      { label: 'Reports', href: '/dashboard/containers/reports' },
    ],
  },
  {
    id: 'quality',
    prefixes: ['/dashboard/quality'],
    title: 'Quality',
    steps: [
      { label: 'Command', href: '/dashboard/quality', exact: true },
      { label: 'HACCP', href: '/dashboard/quality/haccp' },
      { label: 'Inspect', href: '/dashboard/quality/inspections' },
      { label: 'Trace', href: '/dashboard/quality/traceability' },
      { label: 'Graph', href: '/dashboard/quality/traceability-graph' },
      { label: 'Recall', href: '/dashboard/quality/recall-simulator' },
      { label: 'Reports', href: '/dashboard/quality/regulatory-reports' },
    ],
  },
  {
    id: 'intelligence',
    prefixes: ['/dashboard/intelligence'],
    title: 'Intelligence',
    steps: [
      { label: 'Command', href: '/dashboard/intelligence', exact: true },
      { label: 'Pulse', href: '/dashboard/intelligence/pulse-dashboard' },
      { label: 'Insights', href: '/dashboard/intelligence/neural-insights' },
      { label: 'Forecast', href: '/dashboard/intelligence/predictive-forecasts' },
      { label: 'Scorecards', href: '/dashboard/intelligence/custom-scorecards' },
      { label: 'Leadership', href: '/dashboard/intelligence/leadership-development' },
      { label: 'Lab', href: '/dashboard/intelligence/simulation-lab' },
    ],
  },
  {
    id: 'my-business',
    prefixes: ['/dashboard/my-business'],
    title: 'My Business',
    steps: [
      { label: 'Command', href: '/dashboard/my-business', exact: true },
      { label: 'Profile', href: '/dashboard/my-business/profile' },
      { label: 'Team', href: '/dashboard/my-business/team' },
      { label: 'Settings', href: '/dashboard/my-business/settings' },
      { label: 'Legal', href: '/dashboard/my-business/legal' },
      { label: 'Documents', href: '/dashboard/my-business/documents' },
      { label: 'Projects', href: '/dashboard/my-business/projects' },
      { label: 'RIAD', href: '/dashboard/my-business/riad-log' },
    ],
  },
  {
    id: 'projects',
    prefixes: ['/dashboard/projects'],
    title: 'Projects',
    steps: [
      { label: 'Command', href: '/dashboard/projects', exact: true },
      { label: 'Portfolio', href: '/dashboard/projects/portfolio' },
      { label: 'Kanban', href: '/dashboard/projects/kanban-boards' },
      { label: 'Gantt', href: '/dashboard/projects/gantt' },
      { label: 'Resources', href: '/dashboard/projects/resource-allocation' },
      { label: 'Milestones', href: '/dashboard/projects/milestones' },
      { label: 'Budget', href: '/dashboard/projects/budgeting' },
      { label: 'Risk', href: '/dashboard/projects/risk-register' },
      { label: 'Time', href: '/dashboard/projects/timesheets' },
      { label: 'Reports', href: '/dashboard/projects/reporting' },
    ],
  },
  {
    id: 'sustainability',
    prefixes: ['/dashboard/sustainability'],
    title: 'Sustainability',
    steps: [
      { label: 'Command', href: '/dashboard/sustainability', exact: true },
      { label: 'Carbon', href: '/dashboard/sustainability/carbon-tracking' },
      { label: 'Water', href: '/dashboard/sustainability/water-waste' },
      { label: 'Ethics', href: '/dashboard/sustainability/ethical-sourcing' },
      { label: 'Certs', href: '/dashboard/sustainability/green-certificates' },
      { label: 'Regen', href: '/dashboard/sustainability/regenerative-dashboard' },
      { label: 'Reports', href: '/dashboard/sustainability/reports' },
    ],
  },
  {
    id: 'buyer',
    prefixes: ['/dashboard/buyer'],
    title: 'Buyer',
    steps: [
      { label: 'Command', href: '/dashboard/buyer', exact: true },
      { label: 'Suppliers', href: '/dashboard/buyer/suppliers' },
      { label: 'POs', href: '/dashboard/buyer/pos' },
      { label: 'Documents', href: '/dashboard/buyer/documents' },
      { label: 'Reviews', href: '/dashboard/buyer/reviews' },
    ],
  },
] as const;

export function lifecycleForPath(pathname: string | null | undefined): ModuleLifecycle | null {
  if (!pathname) return null;
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
  if (exact) return pathname === href;
  if (pathname === href) return true;
  // Hub command roots: only exact unless path is deeper under another step
  const parts = href.split('/').filter(Boolean);
  if (parts.length === 2 && parts[0] === 'dashboard') {
    return pathname === href;
  }
  return pathname.startsWith(href + '/');
}
