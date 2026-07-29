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
  IdCard,
  School,
  HeartPulse,
} from 'lucide-react';
import type { ProcessStep } from '@/components/relationship/RelationshipChrome';
import type { PermissionResource } from '@/lib/business/permissions';

export type ModuleNavItem = {
  name: string;
  href: string;
  /** When true, only active on exact path (hub roots) */
  exact?: boolean;
  desc?: string;
  /**
   * Role tool filter: "DBE" | "School" | "SP" (first-seen order).
   */
  group?: string;
  /**
   * Optional subsection label inside a role tool (e.g. Govern · Reports).
   * Rendered as a small sticky header in the sidebar submenu.
   */
  section?: string;
  /**
   * When false, step appears in sidebar only (not the top process rail).
   */
  rail?: boolean;
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
 * people IdCard · schools School
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
      { name: 'Overview', href: '/dashboard/my-business', exact: true, desc: 'Company command tower' },
      { name: 'Identity', href: '/dashboard/my-business/profile', desc: 'Profile, legal, banking, certs' },
      {
        name: 'Modules',
        href: '/dashboard/my-business/modules',
        // Platform control: /dashboard/my-business/platform (authorised accounts only)
        desc: 'Enable trade, ops, finance modules',
      },
      { name: 'Team', href: '/dashboard/my-business/team', desc: 'Invite people with roles' },
      {
        name: 'Group',
        href: '/dashboard/my-business/group',
        desc: 'Holding company, subsidiaries, associations',
      },
      { name: 'Trust', href: '/dashboard/my-business/trust', desc: 'Trust score & OTIFEF story' },
      { name: 'Verify', href: '/dashboard/my-business/verifications', desc: 'CIPC / bank verification ops' },
      { name: 'Billing', href: '/dashboard/my-business/billing', desc: 'Trial & subscription' },
      { name: 'Docs', href: '/dashboard/my-business/documents', desc: 'Company vault' },
      { name: 'Settings', href: '/dashboard/my-business/settings', desc: 'Currency, terms, notifications' },
      { name: 'Ops', href: '/dashboard/my-business/ops', desc: 'P0 readiness + settle health' },
      { name: 'Sales', href: '/dashboard/my-business/sales-program', desc: 'Contractor sales program' },
      { name: 'Referrals', href: '/dashboard/my-business/referral-ops', desc: 'Referral earnings ops' },
      { name: 'Risks', href: '/dashboard/my-business/riad-log', desc: 'Company RIAD register' },
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
      {
        name: 'Open trade',
        href: '/dashboard/connections/discover',
        desc: 'Ranked open-to-trade partners',
      },
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
      { name: 'Overview', href: '/dashboard/suppliers', exact: true, desc: 'SRM command tower' },
      { name: 'Source', href: '/dashboard/suppliers/discover', desc: 'Find & search network suppliers' },
      { name: 'Connect', href: '/dashboard/suppliers/connect', desc: 'Connect / shortlist partners' },
      { name: 'Book', href: '/dashboard/suppliers/network', desc: 'Your supplier book' },
      { name: 'Invite', href: '/dashboard/suppliers/invites', desc: 'Invite off-platform suppliers' },
      { name: 'Order', href: '/dashboard/suppliers/po', desc: 'All POs — raise, receive, settle' },
      {
        name: 'Escrow',
        href: '/dashboard/escrow',
        desc: 'USDC / ETH PO escrow rails',
      },
      { name: 'Score', href: '/dashboard/suppliers/performance', desc: 'OTIFEF performance' },
      { name: 'Rate', href: '/dashboard/suppliers/ratings', desc: 'Peer ratings after trade' },
      {
        name: 'Report',
        href: '/dashboard/suppliers/report',
        desc: 'Slice & dice — spend, OTIFEF, risk, PO ledger',
      },
    ],
  },
  {
    id: 'customers',
    name: 'Customers',
    icon: UsersRound,
    href: '/dashboard/customers',
    resource: 'customers',
    steps: [
      { name: 'Overview', href: '/dashboard/customers', exact: true, desc: 'CRM command tower' },
      { name: 'Source', href: '/dashboard/customers/leads', desc: 'Leads & pipeline' },
      { name: 'Book', href: '/dashboard/customers/profiles', desc: 'Customer accounts' },
      { name: 'Invite', href: '/dashboard/customers/invites', desc: 'Invite buyers to platform' },
      { name: 'Quote', href: '/dashboard/customers/quotes', desc: 'Quotes' },
      { name: 'Order', href: '/dashboard/customers/orders', desc: 'Sales orders & inbound POs' },
      { name: 'Invoice', href: '/dashboard/customers/invoices', desc: 'Bill customers' },
      { name: 'Money', href: '/dashboard/customers/money', desc: 'Collect, claims, AR, settle' },
      { name: 'Rate', href: '/dashboard/customers/ratings', desc: 'Peer ratings after trade' },
      {
        name: 'Report',
        href: '/dashboard/customers/report',
        desc: 'Slice & dice — revenue, AR, pipeline, risk',
      },
    ],
  },
  {
    id: 'containers',
    name: 'Containers',
    icon: Container,
    href: '/dashboard/containers',
    resource: 'containers',
    steps: [
      { name: 'Command', href: '/dashboard/containers', exact: true },
      { name: 'Manage', href: '/dashboard/containers/manage' },
      { name: 'Map', href: '/dashboard/containers/map' },
      { name: 'Impact', href: '/dashboard/containers/impact' },
      { name: 'Feasibility', href: '/dashboard/containers/feasibility' },
      { name: 'Add', href: '/dashboard/containers/add' },
      { name: 'Contractors', href: '/dashboard/containers/contractors' },
      { name: 'Resellers', href: '/dashboard/containers/resellers' },
      { name: 'Train', href: '/dashboard/containers/training' },
      { name: 'Metrics', href: '/dashboard/containers/metrics' },
      { name: 'Share', href: '/dashboard/containers/settings' },
      { name: 'RIAD', href: '/dashboard/containers/riad-log' },
      { name: 'Reports', href: '/dashboard/containers/reports' },
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
      {
        name: 'Costs',
        href: '/dashboard/manufacturing/cost-centres',
        desc: 'BUs, stations, assets & cost centres',
      },
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
      { name: 'AR', href: '/dashboard/accounting/accounts-receivable', desc: 'Collect' },
      { name: 'AP', href: '/dashboard/accounting/accounts-payable', desc: 'Bills' },
      { name: 'Payments', href: '/dashboard/accounting/payments' },
      { name: 'Bank', href: '/dashboard/accounting/bank-reconciliation' },
      { name: 'Budget', href: '/dashboard/accounting/budget', desc: '12-month plan by COA' },
      { name: 'Manage', href: '/dashboard/accounting/management' },
      { name: 'Reports', href: '/dashboard/accounting/reports' },
      { name: 'VAT', href: '/dashboard/accounting/tax' },
      { name: 'Assets', href: '/dashboard/accounting/fixed-assets' },
      { name: 'Entities', href: '/dashboard/accounting/entities' },
      { name: 'Settings', href: '/dashboard/accounting/settings', desc: 'Close / periods' },
    ],
  },
  {
    id: 'people',
    name: 'People',
    icon: IdCard,
    href: '/dashboard/people',
    resource: 'people',
    steps: [
      { name: 'Overview', href: '/dashboard/people', exact: true },
      { name: 'Directory', href: '/dashboard/people/directory' },
      { name: 'Org', href: '/dashboard/people/org-chart', desc: 'BU organogram + reporting lines' },
      { name: 'Rate', href: '/dashboard/people/performance' },
      { name: 'Discipline', href: '/dashboard/people/disciplinary' },
      { name: 'Payroll', href: '/dashboard/people/payroll' },
      { name: 'Leave', href: '/dashboard/people/leave' },
      { name: 'Train', href: '/dashboard/people/training' },
      { name: 'Onboard', href: '/dashboard/people/onboarding' },
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
      { name: 'Portfolio', href: '/dashboard/projects/portfolio' },
      { name: 'Programmes', href: '/dashboard/projects/programmes' },
      { name: 'DMAIC', href: '/dashboard/projects/dmaic' },
      { name: 'SDG', href: '/dashboard/projects/sdg' },
      { name: 'Kanban', href: '/dashboard/projects/kanban-boards' },
      { name: 'RIAD', href: '/dashboard/projects/risk-register' },
      { name: 'Time', href: '/dashboard/projects/timesheets' },
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
      { name: 'GHG', href: '/dashboard/sustainability/carbon-tracking' },
      { name: 'Resources', href: '/dashboard/sustainability/water-waste' },
      { name: 'Targets', href: '/dashboard/sustainability/regenerative-dashboard' },
      { name: 'Certs', href: '/dashboard/sustainability/green-certificates' },
      { name: 'Actions', href: '/dashboard/sustainability/initiatives' },
      { name: 'Material', href: '/dashboard/sustainability/materiality' },
      { name: 'Pack', href: '/dashboard/sustainability/reports' },
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
      { name: 'Insights', href: '/dashboard/intelligence/neural-insights' },
      { name: 'Forecast', href: '/dashboard/intelligence/predictive-forecasts' },
      { name: 'Score', href: '/dashboard/intelligence/custom-scorecards' },
      { name: 'Lab', href: '/dashboard/intelligence/simulation-lab' },
      { name: 'Lead', href: '/dashboard/intelligence/leadership-development' },
    ],
  },
  {
    id: 'schools',
    name: 'Schools',
    icon: School,
    href: '/dashboard/schools',
    resource: 'schools',
    /**
     * Education / NSNP only (filtered by company role):
     * 1) DBE / PEU — department governs programme
     * 2) School — kitchen & learners
     * 3) SP — service provider
     */
    steps: [
      // ── DBE / PEU (concise, sectioned) ───────────────────────────────
      {
        name: 'Command',
        href: '/dashboard/schools',
        exact: true,
        desc: 'Programme home',
        group: 'DBE',
        section: 'Govern',
      },
      {
        name: 'Desk',
        href: '/dashboard/schools/agency',
        desc: 'Profile · tariffs · associations',
        group: 'DBE',
        section: 'Govern',
      },
      {
        name: 'Join & add',
        href: '/dashboard/schools/join',
        desc: 'Schools & SPs · approve joins',
        group: 'DBE',
        section: 'Govern',
      },
      {
        name: 'Import schools',
        href: '/dashboard/schools/registry-import',
        desc: 'Bulk provincial school register',
        group: 'DBE',
        section: 'Govern',
      },
      {
        name: 'Import SPs',
        href: '/dashboard/schools/sp-registry-import',
        desc: 'District · cluster · CSD · SP name',
        group: 'DBE',
        section: 'Govern',
      },
      {
        name: 'School register',
        href: '/dashboard/schools/registry-report',
        desc: 'Full school list · geo · enrolments · RIAD',
        group: 'DBE',
        section: 'Insights',
      },
      {
        name: 'Service providers',
        href: '/dashboard/schools/sp-register',
        desc: 'SP directory · district · CSD · RIAD',
        group: 'DBE',
        section: 'Insights',
      },
      {
        name: 'Ops cockpit',
        href: '/dashboard/schools/ops',
        desc: 'Exceptions · districts · clusters',
        group: 'DBE',
        section: 'Insights',
      },
      {
        name: 'Reports',
        href: '/dashboard/schools/agency-report',
        desc: 'Slice & dice · RIAD log · claims · risks',
        group: 'DBE',
        section: 'Insights',
      },
      {
        name: 'Map',
        href: '/dashboard/schools/map',
        desc: 'School locations',
        group: 'DBE',
        section: 'Insights',
      },
      {
        name: 'Catalogue',
        href: '/dashboard/schools/approved-list',
        desc: 'Approved foods list',
        group: 'DBE',
        section: 'Programme',
      },
      {
        name: 'Menu',
        href: '/dashboard/schools/menu',
        desc: 'Breakfast + lunch cycle',
        group: 'DBE',
        section: 'Programme',
      },
      {
        name: 'Recipes',
        href: '/dashboard/schools/recipes',
        desc: 'BOM · MPS · MRP · category budgets',
        group: 'DBE',
        section: 'Programme',
      },
      {
        name: 'Feeding calendar',
        href: '/dashboard/schools/feeding-calendar',
        desc: 'Annual feeding days · terms · months',
        group: 'DBE',
        section: 'Programme',
      },
      {
        name: 'Nutrition',
        href: '/dashboard/schools/nutrition-agency',
        desc: 'Programme nutrition',
        group: 'DBE',
        section: 'Programme',
      },
      {
        name: 'SP SLA',
        href: '/dashboard/schools/isp-sla',
        desc: 'Supplier performance',
        group: 'DBE',
        section: 'Field',
      },
      {
        name: 'Visits',
        href: '/dashboard/schools/visits',
        desc: 'Plan · field pack · planned vs actual',
        group: 'DBE',
        section: 'Field',
      },
      {
        name: 'Monitoring tool',
        href: '/dashboard/schools/monitoring',
        desc: 'KZN NSNP form · KPI · RKMP · gardens',
        group: 'DBE',
        section: 'Field',
      },
      {
        name: 'Monitoring report',
        href: '/dashboard/schools/monitoring-report',
        desc: 'Filters · graphs · KPI analytics',
        group: 'DBE',
        section: 'Field',
      },
      {
        name: 'Prizes',
        href: '/dashboard/schools/prizes',
        desc: 'Headmaster prizes',
        group: 'DBE',
        section: 'Field',
      },

      // ── School (concise, sectioned) ──────────────────────────────────
      {
        name: 'Command',
        href: '/dashboard/schools',
        exact: true,
        desc: 'Readiness & next action',
        group: 'School',
        section: 'Home',
      },
      {
        name: 'Supply ops',
        href: '/dashboard/schools/ops',
        desc: 'Match · funding sim · audit pack',
        group: 'School',
        section: 'Home',
      },
      {
        name: 'Profile',
        href: '/dashboard/schools/profile',
        desc: 'EMIS · kitchen · principal',
        group: 'School',
        section: 'Home',
      },
      {
        name: 'Join DBE',
        href: '/dashboard/schools/join',
        desc: 'Request department link',
        group: 'School',
        section: 'Home',
      },
      {
        name: 'Learners',
        href: '/dashboard/schools/learners',
        desc: 'NSNP register',
        group: 'School',
        section: 'People',
      },
      {
        name: 'Staff',
        href: '/dashboard/schools/staff',
        desc: 'Kitchen team',
        group: 'School',
        section: 'People',
      },
      {
        name: 'Menu',
        href: '/dashboard/schools/menu',
        desc: 'Department menu',
        group: 'School',
        section: 'Supply',
      },
      {
        name: 'Recipes / MRP',
        href: '/dashboard/schools/recipes',
        desc: 'Learner-scaled meal product plan',
        group: 'School',
        section: 'Supply',
      },
      {
        name: 'Feeding calendar',
        href: '/dashboard/schools/feeding-calendar',
        desc: 'DBE feeding days · terms · months',
        group: 'School',
        section: 'Supply',
      },
      {
        name: 'Approved foods',
        href: '/dashboard/schools/approved-list',
        desc: 'What you may order',
        group: 'School',
        section: 'Supply',
      },
      {
        name: 'SPs',
        href: '/dashboard/schools/isps',
        desc: 'Service providers',
        group: 'School',
        section: 'Supply',
      },
      {
        name: 'SP OTIFEF',
        href: '/dashboard/schools/isp-sla',
        desc: 'On-time · in-full · error-free',
        group: 'School',
        section: 'Supply',
      },
      {
        name: 'Rate SP & food',
        href: '/dashboard/schools/ratings',
        desc: 'Rate suppliers · meal feedback',
        group: 'School',
        section: 'Supply',
      },
      {
        name: 'Orders',
        href: '/dashboard/schools/orders',
        desc: 'Purchase orders',
        group: 'School',
        section: 'Kitchen',
      },
      {
        name: 'Deliveries',
        href: '/dashboard/schools/deliveries',
        desc: 'Receive POD',
        group: 'School',
        section: 'Kitchen',
      },
      {
        name: 'Kitchen',
        href: '/dashboard/schools/kitchen',
        desc: 'GRN · issue · waste',
        group: 'School',
        section: 'Kitchen',
      },
      {
        name: 'Serve day',
        href: '/dashboard/schools/serve-day',
        desc: 'Meals today',
        group: 'School',
        section: 'Kitchen',
      },
      {
        name: 'Claims',
        href: '/dashboard/schools/claims',
        desc: 'Submit to DBE',
        group: 'School',
        section: 'Fund',
      },
      {
        name: 'Nutrition',
        href: '/dashboard/schools/nutrition',
        desc: 'Meal scores',
        group: 'School',
        section: 'Fund',
      },
      {
        name: 'Prizes',
        href: '/dashboard/schools/prizes',
        desc: 'Prize score',
        group: 'School',
        section: 'Fund',
      },
      {
        name: 'PEU visits',
        href: '/dashboard/schools/visits',
        desc: 'Planned · audit results · RIAD',
        group: 'School',
        section: 'Fund',
      },
      {
        name: 'Monitoring reports',
        href: '/dashboard/schools/monitoring',
        desc: 'DBE field monitoring KPI results',
        group: 'School',
        section: 'Fund',
      },

      // ── SP (concise) ─────────────────────────────────────────────────
      {
        name: 'Workspace',
        href: '/dashboard/schools/isp',
        desc: 'SP home',
        group: 'SP',
        section: 'Home',
      },
      {
        name: 'Fulfil queue',
        href: '/dashboard/schools/ops',
        desc: 'POs · DN · dispatch order',
        group: 'SP',
        section: 'Home',
      },
      {
        name: 'School orders report',
        href: '/dashboard/schools/sp-orders-report',
        desc: 'Linked schools · required delivery dates',
        group: 'SP',
        section: 'Home',
      },
      {
        name: 'Orders inbox',
        href: '/dashboard/schools/orders',
        desc: 'Incoming school POs',
        group: 'SP',
        section: 'Home',
      },
      {
        name: 'Profile',
        href: '/dashboard/schools/isps',
        desc: 'Register · profile',
        group: 'SP',
        section: 'Home',
      },
      {
        name: 'Join DBE',
        href: '/dashboard/schools/join',
        desc: 'Associate with DBE',
        group: 'SP',
        section: 'Home',
      },
      {
        name: 'Catalogue',
        href: '/dashboard/schools/approved-list',
        desc: 'Approved foods',
        group: 'SP',
        section: 'Supply',
      },
      {
        name: 'Menu',
        href: '/dashboard/schools/menu',
        desc: 'Department menu',
        group: 'SP',
        section: 'Supply',
      },
      {
        name: 'MPS / MRP plan',
        href: '/dashboard/schools/recipes',
        desc: 'Product needs for schools you supply',
        group: 'SP',
        section: 'Supply',
      },
      {
        name: 'Feeding calendar',
        href: '/dashboard/schools/feeding-calendar',
        desc: 'DBE feeding days for supply planning',
        group: 'SP',
        section: 'Supply',
      },
      {
        name: 'Deliver',
        href: '/dashboard/schools/deliveries',
        desc: 'Dispatch · POD',
        group: 'SP',
        section: 'Ops',
      },
      {
        name: 'SLA',
        href: '/dashboard/schools/isp-sla',
        desc: 'Performance score',
        group: 'SP',
        section: 'Ops',
      },
      {
        name: 'Invite supplier',
        href: '/dashboard/invite-business?type=supplier&from=nsnp-sp',
        desc: 'Business invite · wholesalers',
        group: 'SP',
        section: 'Trade',
      },
      {
        name: 'Trade / POs',
        href: '/dashboard/suppliers',
        desc: 'Buy from wholesalers · book',
        group: 'SP',
        section: 'Trade',
      },
    ],
  },
  {
    id: 'health',
    name: 'Health',
    icon: HeartPulse,
    href: '/dashboard/health',
    resource: 'schools',
    /**
     * Standalone DoH programme (not DBE):
     * 1) DoH — department
     * 2) Facility — clinic / hospital
     * 3) SP — service provider for health
     */
    steps: [
      {
        name: 'Command',
        href: '/dashboard/health',
        exact: true,
        desc: 'Health programme home',
        group: 'DoH',
      },
      {
        name: 'DoH desk',
        href: '/dashboard/health/agency',
        desc: 'Register department · approve facilities',
        group: 'DoH',
      },
      {
        name: 'Join & add',
        href: '/dashboard/health/join',
        desc: 'Add clinics, hospitals & SPs',
        group: 'DoH',
      },
      {
        name: 'Facilities',
        href: '/dashboard/health/agency',
        desc: 'All clinics & hospitals on your programme',
        group: 'DoH',
      },
      {
        name: 'Coverage',
        href: '/dashboard/health/report',
        desc: 'By district & facility type',
        group: 'DoH',
      },
      {
        name: 'Catalogue',
        href: '/dashboard/schools/approved-list',
        desc: 'Approved foods for health facilities',
        group: 'DoH',
      },
      {
        name: 'Nutrition',
        href: '/dashboard/schools/nutrition-agency',
        desc: 'Programme nutrition roll-up',
        group: 'DoH',
      },
      {
        name: 'Map',
        href: '/dashboard/health/map',
        desc: 'Facility locations',
        group: 'DoH',
      },
      {
        name: 'Command',
        href: '/dashboard/health',
        exact: true,
        desc: 'Clinic / hospital home',
        group: 'Facility',
      },
      {
        name: 'Join DoH',
        href: '/dashboard/health/join',
        desc: 'Request to join Department of Health',
        group: 'Facility',
      },
      {
        name: 'Profile',
        href: '/dashboard/schools/profile',
        desc: 'Facility profile & kitchen',
        group: 'Facility',
      },
      {
        name: 'Approved foods',
        href: '/dashboard/schools/approved-list',
        desc: 'What you may order',
        group: 'Facility',
      },
      {
        name: 'Orders',
        href: '/dashboard/schools/orders',
        desc: 'Order from DoH-approved SPs',
        group: 'Facility',
      },
      {
        name: 'Kitchen',
        href: '/dashboard/schools/kitchen',
        desc: 'GRN · issue · waste',
        group: 'Facility',
      },
      {
        name: 'Nutrition',
        href: '/dashboard/schools/nutrition',
        desc: 'Meal nutrition vs norms',
        group: 'Facility',
      },
      {
        name: 'Join DoH',
        href: '/dashboard/health/join',
        desc: 'Associate with Department of Health',
        group: 'SP',
      },
      {
        name: 'Deliver',
        href: '/dashboard/schools/deliveries',
        desc: 'Dispatch to clinics & hospitals',
        group: 'SP',
      },
      {
        name: 'Catalogue',
        href: '/dashboard/schools/approved-list',
        desc: 'Approved foods you must supply',
        group: 'SP',
      },
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

/** Group consecutive nav steps by `group` (first-seen order). */
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

/**
 * Extra path prefixes that belong to a module but live outside its hub href
 * (e.g. Settle/Escrow command centres under Customers).
 */
const EXTRA_LIFECYCLE_PREFIXES: Record<string, readonly string[]> = {
  customers: ['/dashboard/settle'],
  suppliers: ['/dashboard/escrow'],
  network: ['/dashboard/invite-business'],
};

/** Process rail lifecycles from the same critical steps */
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
    { label: 'Money', href: '/dashboard/buyer/money' },
    { label: 'Rate', href: '/dashboard/buyer/reviews' },
  ] as ProcessStep[],
};
