/**
 * Single source of truth for dashboard module navigation.
 * - One unique Lucide icon per module
 * - Nested items = critical process steps only (short verb labels)
 * - Process rail + Sidebar both read from here (no duplicate process trees)
 *
 * Restored full module set after accidental slim wipe; Order chains kept under Operations.
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
  Stethoscope,
  Smile,
  Sprout,
  Mountain,
  Dumbbell,
  Shield,
  BrainCircuit,
  Hospital,
  PawPrint,
  BriefcaseBusiness,
  Store,
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
    steps: [
      { name: 'Messages', href: '/dashboard/messages?from=home', desc: 'Team · trade · care inbox', section: 'Home', rail: false },
      { name: 'Calendar', href: '/dashboard/calendar', desc: 'Company week · leave · deliveries', section: 'Home', rail: false },
    ],
    resource: 'dashboard',
  },
  {
    id: 'platform',
    name: 'Platform',
    icon: Shield,
    href: '/dashboard/platform',
    resource: 'platform',
    steps: [
      {
        name: 'Console',
        href: '/dashboard/platform',
        exact: true,
        desc: 'SupplierAdvisor admin console',
        section: 'Control',
      },
      {
        name: 'System',
        href: '/dashboard/platform/system',
        desc: 'Health, integrations, schema, deploy',
        section: 'Reports',
      },
      {
        name: 'Management',
        href: '/dashboard/platform/management',
        desc: 'Companies · trade · A4 landscape pack',
        section: 'Reports',
      },
      {
        name: 'SA Members',
        href: '/dashboard/platform/members',
        desc: 'B2C logins · last seen · PWA / site · duration',
        section: 'Reports',
      },
      {
        name: 'Gov control',
        href: '/dashboard/my-business/platform',
        desc: 'Activate government departments',
        section: 'Ops',
      },
      {
        name: 'Ops board',
        href: '/dashboard/my-business/ops',
        desc: 'Paystack · CIPC · settle readiness',
        section: 'Ops',
      },
      {
        name: 'Referrals',
        href: '/dashboard/my-business/referral-ops',
        desc: 'Referral earnings ops',
        section: 'Ops',
      },
    ],
  },
  {
    id: 'sales-portal',
    name: 'Sales',
    icon: Handshake,
    href: '/sales',
    resource: 'sales_portal',
    steps: [
      { name: 'Sell', href: '/sales', exact: true, desc: 'Command centre', section: 'Home' },
      { name: 'Pipeline', href: '/sales/pipeline', section: 'Pipeline' },
      { name: 'Quote', href: '/sales/quotes', section: 'Pipeline' },
      { name: 'Order', href: '/sales/orders', section: 'Trade' },
      { name: 'Invoice', href: '/sales/invoices', section: 'Trade' },
      { name: 'Earn', href: '/sales/earnings', section: 'Money' },
      { name: 'Subscribe', href: '/sales/subscribe', section: 'Money' },

      { name: 'Messages', href: '/dashboard/messages?from=sales&channel=customer', desc: 'Message customers & team', section: 'Trade', rail: false },
    ],
  },
  {
    id: 'my-business',
    name: 'Company',
    icon: Building2,
    href: '/dashboard/my-business',
    resource: 'profile',
    steps: [
      {
        name: 'Overview',
        href: '/dashboard/my-business',
        exact: true,
        desc: 'Company command tower',
        section: 'Home',
      },
      {
        name: 'Profile',
        href: '/dashboard/my-business/profile',
        desc: 'Legal identity, banking, certs',
        section: 'Identity',
      },
      {
        name: 'Documents',
        href: '/dashboard/my-business/documents',
        desc: 'Company vault',
        section: 'Identity',
        rail: false,
      },
      {
        name: 'Group',
        href: '/dashboard/my-business/group',
        desc: 'Holding company, subsidiaries, associations',
        section: 'Identity',
        rail: false,
      },
      {
        name: 'Modules',
        href: '/dashboard/my-business/modules',
        desc: 'Sector · packs · sidebar hubs',
        section: 'Workspace',
      },
      {
        name: 'Settings',
        href: '/dashboard/my-business/settings',
        desc: 'FY, currency, terms, discoverability',
        section: 'Workspace',
        rail: false,
      },
      {
        name: 'Team',
        href: '/dashboard/my-business/team',
        desc: 'Invite people with roles',
        section: 'People',
      },
      {
        name: 'Messages',
        href: '/dashboard/messages?from=company&channel=colleague',
        desc: 'Team & partner inbox',
        section: 'People',
        rail: false,
      },
      {
        name: 'Trust',
        href: '/dashboard/my-business/trust',
        desc: 'Trust score & OTIFEF story',
        section: 'Trust',
      },
      {
        name: 'Verify',
        href: '/dashboard/my-business/verifications',
        desc: 'CIPC / bank verification',
        section: 'Trust',
        rail: false,
      },
      {
        name: 'Billing',
        href: '/dashboard/my-business/billing',
        desc: 'Trial & subscription',
        section: 'Money',
      },
      {
        name: 'Sales',
        href: '/dashboard/my-business/sales-program',
        desc: 'Contractor sales program',
        section: 'Money',
        rail: false,
      },
      {
        name: 'Referrals',
        href: '/dashboard/my-business/referral-ops',
        desc: 'Referral earnings ops',
        section: 'Money',
        rail: false,
      },
      {
        name: 'Risks',
        href: '/dashboard/my-business/riad-log',
        desc: 'Company RIAD register',
        section: 'Govern',
        rail: false,
      },
      {
        name: 'Ops',
        href: '/dashboard/my-business/ops',
        desc: 'P0 readiness + settle health',
        section: 'Govern',
        rail: false,
      },
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
      {
        name: 'Messages',
        href: '/dashboard/messages',
        desc: 'Colleagues · suppliers · customers',
        section: 'Home',
      },
      {
        name: 'Open trade',
        href: '/dashboard/connections/discover',
        desc: 'Ranked open-to-trade partners',
        section: 'Discover',
      },
      { name: 'Market', href: '/dashboard/connections/marketplace', section: 'Discover' },
      { name: 'Price', href: '/dashboard/connections/pricing', section: 'Connect' },
      { name: 'Invite', href: '/dashboard/invite-business', section: 'Connect' },
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
      { name: 'Source', href: '/dashboard/suppliers/discover', desc: 'Find & search network suppliers', section: 'Source' },
      { name: 'Connect', href: '/dashboard/suppliers/connect', desc: 'Connect / shortlist partners', section: 'Source' },
      { name: 'Profiles', href: '/dashboard/suppliers/network', desc: 'Your supplier profiles', section: 'Source' },
      { name: 'Invite', href: '/dashboard/suppliers/invites', desc: 'Invite off-platform suppliers', section: 'Source' },
      {
        name: 'Portal',
        href: '/dashboard/suppliers/portal',
        desc: 'Guest portal for suppliers who have not joined',
        section: 'Source',
      },
      { name: 'Order', href: '/dashboard/suppliers/po', desc: 'All POs — raise, receive, settle', section: 'Trade' },
      {
        name: 'Projects',
        href: '/dashboard/suppliers/projects',
        desc: 'Joint waterfall projects with suppliers',
        section: 'Trade',
      },
      {
        name: 'Escrow',
        href: '/dashboard/escrow',
        desc: 'USDC / ETH PO escrow rails',
        section: 'Trade',
      },
      { name: 'Score', href: '/dashboard/suppliers/performance', desc: 'OTIFEF performance', section: 'Score' },
      { name: 'Rate', href: '/dashboard/suppliers/ratings', desc: 'Peer ratings after trade', section: 'Score' },
      {
        name: 'Report',
        href: '/dashboard/suppliers/report',
        desc: 'Slice & dice — spend, OTIFEF, risk, PO ledger',
        section: 'Score',
      },

      { name: 'Messages', href: '/dashboard/messages?from=suppliers&channel=supplier', desc: 'Message connected suppliers', section: 'Trade', rail: false },
    ],
  },
  {
    id: 'customers',
    name: 'Customers',
    icon: UsersRound,
    href: '/dashboard/customers',
    resource: 'customers',
    steps: [
      { name: 'Overview', href: '/dashboard/customers', exact: true, desc: 'CRM command · Advisor members', section: 'Home' },
      { name: '360', href: '/dashboard/customers/360', desc: 'Member · patient · hirer · debit · invoices', section: 'Home' },
      { name: 'Source', href: '/dashboard/customers/leads', desc: 'Leads & pipeline', section: 'Source' },
      { name: 'Profiles', href: '/dashboard/customers/profiles', desc: 'Customer profiles', section: 'Source' },
      { name: 'Invite', href: '/dashboard/customers/invites', desc: 'Invite buyers to platform', section: 'Source' },
      {
        name: 'Portal',
        href: '/dashboard/customers/portal',
        desc: 'Guest portal for buyers who have not joined',
        section: 'Source',
      },
      { name: 'Quote', href: '/dashboard/customers/quotes', desc: 'Quotes', section: 'Trade' },
      { name: 'Order', href: '/dashboard/customers/orders', desc: 'Sales orders & inbound POs', section: 'Trade' },
      { name: 'Invoice', href: '/dashboard/customers/invoices', desc: 'Bill customers', section: 'Trade' },
      {
        name: 'Projects',
        href: '/dashboard/customers/projects',
        desc: 'Joint waterfall projects with buyers',
        section: 'Trade',
      },
      { name: 'Money', href: '/dashboard/customers/money', desc: 'Collect, claims, AR, settle', section: 'Money' },
      { name: 'Rate', href: '/dashboard/customers/ratings', desc: 'Peer ratings after trade', section: 'Score' },
      {
        name: 'Report',
        href: '/dashboard/customers/report',
        desc: 'Slice & dice — revenue, AR, pipeline, OTIFEF, risk',
        section: 'Score',
      },

      { name: 'Messages', href: '/dashboard/messages?from=customers&channel=customer', desc: 'Message connected customers', section: 'Trade', rail: false },
    ],
  },
  {
    id: 'containers',
    name: 'ContainerAdvisor',
    icon: Container,
    href: '/dashboard/containers',
    resource: 'containers',
    steps: [
      { name: 'Command', href: '/dashboard/containers', exact: true, section: 'Home' },
      { name: 'Manage', href: '/dashboard/containers/manage', section: 'Network' },
      { name: 'Map', href: '/dashboard/containers/map', section: 'Network' },
      { name: 'Add', href: '/dashboard/containers/add', section: 'Network' },
      { name: 'Contractors', href: '/dashboard/containers/contractors', section: 'Partners' },
      { name: 'Resellers', href: '/dashboard/containers/resellers', section: 'Partners' },
      { name: 'Train', href: '/dashboard/containers/training', section: 'Partners' },
      { name: 'Impact', href: '/dashboard/containers/impact', section: 'Insights' },
      { name: 'Feasibility', href: '/dashboard/containers/feasibility', section: 'Insights' },
      { name: 'Metrics', href: '/dashboard/containers/metrics', section: 'Insights' },
      { name: 'Reports', href: '/dashboard/containers/reports', section: 'Insights' },
      { name: 'Share', href: '/dashboard/containers/settings', section: 'Govern' },
      { name: 'RIAD', href: '/dashboard/containers/riad-log', section: 'Govern' },

      { name: 'Messages', href: '/dashboard/messages?from=containers&channel=connection', desc: 'Contractors · resellers · team', section: 'Partners', rail: false },
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
      { name: 'Shared SKUs', href: '/dashboard/inventory/shared', desc: 'Gym · retail · hire · clinic', section: 'Catalog' },
      { name: 'Stock', href: '/dashboard/inventory/stock', section: 'Stock' },
      {
        name: 'Report',
        href: '/dashboard/inventory/report',
        desc: 'Inventory metrics & one-pager',
        section: 'Stock',
      },
      { name: 'Lots', href: '/dashboard/inventory/lots', section: 'Stock' },
      { name: 'Receive', href: '/dashboard/inventory/scan', section: 'Move' },
      { name: 'Move', href: '/dashboard/inventory/stock-transfers', section: 'Move' },
      { name: 'Count', href: '/dashboard/inventory/counts', section: 'Move' },

      { name: 'Messages', href: '/dashboard/messages?from=inventory&channel=colleague', desc: 'Team stock & warehouse notes', section: 'Home', rail: false },
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
      { name: 'Plan', href: '/dashboard/manufacturing/master-production-schedules', section: 'Plan' },
      { name: 'Explode', href: '/dashboard/manufacturing/mrp', section: 'Plan' },
      { name: 'BOM', href: '/dashboard/manufacturing/bills-of-materials', section: 'Plan' },
      { name: 'Run', href: '/dashboard/manufacturing/production-orders', section: 'Run' },
      { name: 'Cells', href: '/dashboard/manufacturing/work-centers', section: 'Run' },
      {
        name: 'Costs',
        href: '/dashboard/manufacturing/cost-centres',
        desc: 'BUs, stations, assets & cost centres',
        section: 'Cost',
      },

      { name: 'Messages', href: '/dashboard/messages?from=manufacturing&channel=colleague', desc: 'Floor & planning team', section: 'Home', rail: false },
    ],
  },
  {
    id: 'distribution',
    name: 'Ship',
    icon: Ship,
    href: '/dashboard/distribution',
    resource: 'distribution',
    steps: [
      { name: 'Overview', href: '/dashboard/distribution', exact: true, section: 'Home' },
      { name: 'Inbound', href: '/dashboard/distribution/inbound', section: 'Flow' },
      { name: 'Outbound', href: '/dashboard/distribution/outbound', section: 'Flow' },
      { name: 'Track', href: '/dashboard/distribution/tracking', section: 'Track' },
      { name: 'Carrier', href: '/dashboard/distribution/carriers', section: 'Fleet' },
      { name: 'Fleet', href: '/dashboard/distribution/fleet-drivers', section: 'Fleet' },

      { name: 'Messages', href: '/dashboard/messages?from=distribution&channel=connection', desc: 'Carriers · fleet · partners', section: 'Home', rail: false },
    ],
  },
  {
    id: 'accounting',
    name: 'Finance',
    icon: Landmark,
    href: '/dashboard/accounting',
    resource: 'accounting',
    steps: [
      { name: 'Overview', href: '/dashboard/accounting', exact: true, desc: 'Books · Advisor fees', section: 'Home' },
      { name: 'Chart', href: '/dashboard/accounting/chart-of-accounts', desc: 'Chart of accounts', section: 'Books' },
      {
        name: 'Parties',
        href: '/dashboard/accounting/parties',
        desc: 'Customers (AR) vs suppliers (AP)',
        section: 'Books',
      },
      {
        name: 'Journals',
        href: '/dashboard/accounting/journal-entries',
        desc: 'Post · review likely mis-posts',
        section: 'Books',
      },
      { name: 'Ledger', href: '/dashboard/accounting/general-ledger', desc: 'General ledger', section: 'Books' },
      { name: 'AR', href: '/dashboard/accounting/accounts-receivable', desc: 'Collect', section: 'Trade' },
      {
        name: 'ECL',
        href: '/dashboard/accounting/ecl',
        desc: 'IFRS 9 credit-loss worksheet',
        section: 'Trade',
      },
      { name: 'AP', href: '/dashboard/accounting/accounts-payable', desc: 'Bills', section: 'Trade' },
      { name: 'Payments', href: '/dashboard/accounting/payments', section: 'Trade' },
      {
        name: 'Debit orders',
        href: '/dashboard/accounting/debit-orders',
        desc: 'Member debit file · VAT incl.',
        section: 'Trade',
      },
      { name: 'Bank', href: '/dashboard/accounting/bank-reconciliation', section: 'Bank' },
      {
        name: 'Assets',
        href: '/dashboard/accounting/fixed-assets',
        desc: 'PPE register · IAS 16',
        section: 'Registers',
      },
      { name: 'VAT', href: '/dashboard/accounting/tax', desc: 'VAT return box', section: 'Registers' },
      { name: 'Budget', href: '/dashboard/accounting/budget', desc: '12-month plan by COA', section: 'Plan' },
      {
        name: 'Management',
        href: '/dashboard/accounting/management',
        desc: 'Period P&L · budget vs actual',
        section: 'Statements',
      },
      {
        name: 'Balance sheet',
        href: '/dashboard/accounting/balance-sheet',
        desc: 'IAS 1 statement of financial position',
        section: 'Statements',
      },
      {
        name: 'Cash flow',
        href: '/dashboard/accounting/cash-flow',
        desc: 'IAS 7 / ASC 230 statement',
        section: 'Statements',
      },
      {
        name: 'AFS',
        href: '/dashboard/accounting/afs',
        desc: 'Annual financial statements',
        section: 'Statements',
      },
      {
        name: 'Reports',
        href: '/dashboard/accounting/reports',
        desc: 'P&L · aging · forecast · ratios',
        section: 'Statements',
      },
      { name: 'Entities', href: '/dashboard/accounting/entities', section: 'Govern' },
      { name: 'Settings', href: '/dashboard/accounting/settings', desc: 'Close / periods', section: 'Govern' },
      { name: 'Messages', href: '/dashboard/messages?from=accounting&channel=colleague', desc: 'Finance team notes', section: 'Home', rail: false },
    ],
  },
  {
    id: 'people',
    name: 'People',
    icon: IdCard,
    href: '/dashboard/people',
    resource: 'people',
    steps: [
      { name: 'Overview', href: '/dashboard/people', exact: true, desc: 'HR · Advisor staff', section: 'Home' },
      { name: 'Directory', href: '/dashboard/people/directory', section: 'Book' },
      { name: 'Calendar', href: '/dashboard/calendar', desc: 'Leave blocks Advisor diaries', section: 'Book' },
      { name: 'Org', href: '/dashboard/people/org-chart', desc: 'BU organogram + reporting lines', section: 'Book' },
      { name: 'Structure', href: '/dashboard/people/organisation', desc: 'Business units · centres · stations · assets', section: 'Book' },
      { name: 'Rate', href: '/dashboard/people/performance', section: 'Rate' },
      { name: 'Discipline', href: '/dashboard/people/disciplinary', section: 'Rate' },
      { name: 'Payroll', href: '/dashboard/people/payroll', section: 'Pay' },
      { name: 'Leave', href: '/dashboard/people/leave', section: 'Pay' },
      { name: 'Train', href: '/dashboard/people/training', section: 'Grow' },
      { name: 'Onboard', href: '/dashboard/people/onboarding', section: 'Grow' },

      { name: 'Messages', href: '/dashboard/messages?from=people&channel=colleague', desc: 'Internal team messages', section: 'Book', rail: false },
    ],
  },
  {
    id: 'sheq',
    name: 'SHEQ',
    icon: HardHat,
    href: '/dashboard/sheq',
    resource: 'sheq',
    steps: [
      { name: 'Overview', href: '/dashboard/sheq', exact: true, section: 'Home' },
      { name: 'Incidents', href: '/dashboard/sheq/incidents', section: 'Field' },
      { name: 'Hazards', href: '/dashboard/sheq/hazards', section: 'Field' },
      { name: 'NCR', href: '/dashboard/sheq/ncrs', section: 'Assure' },
      { name: 'CAPA', href: '/dashboard/sheq/capas', section: 'Assure' },
      { name: 'Quality', href: '/dashboard/quality', section: 'Link' },

      { name: 'Messages', href: '/dashboard/messages?from=sheq&channel=colleague', desc: 'SHEQ team & site notes', section: 'Home', rail: false },
    ],
  },
  {
    id: 'quality',
    name: 'Quality',
    icon: ClipboardCheck,
    href: '/dashboard/quality',
    resource: 'sheq',
    steps: [
      { name: 'Overview', href: '/dashboard/quality', exact: true, section: 'Home' },
      { name: 'Inspect', href: '/dashboard/quality/inspections', section: 'Field' },
      { name: 'HACCP', href: '/dashboard/quality/haccp', section: 'Field' },
      { name: 'Trace', href: '/dashboard/quality/traceability-graph', section: 'Trace' },
      { name: 'Recall', href: '/dashboard/quality/recall-simulator', section: 'Trace' },
      { name: 'Export', href: '/dashboard/quality/regulatory-reports', section: 'Report' },
      { name: 'SHEQ', href: '/dashboard/sheq', section: 'Link' },

      { name: 'Messages', href: '/dashboard/messages?from=quality&channel=colleague', desc: 'Quality team & suppliers', section: 'Home', rail: false },
    ],
  },
  {
    id: 'projects',
    name: 'Projects',
    icon: FolderKanban,
    href: '/dashboard/projects',
    resource: 'projects',
    steps: [
      { name: 'Overview', href: '/dashboard/projects', exact: true, section: 'Home' },
      { name: 'Portfolio', href: '/dashboard/projects/portfolio', section: 'Portfolio' },
      { name: 'Programmes', href: '/dashboard/projects/programmes', section: 'Portfolio' },
      { name: 'DMAIC', href: '/dashboard/projects/dmaic', section: 'Method' },
      { name: 'SDG', href: '/dashboard/projects/sdg', section: 'Method' },
      { name: 'Kanban', href: '/dashboard/projects/kanban-boards', section: 'Method' },
      { name: 'Gantt', href: '/dashboard/projects/gantt', desc: 'Waterfall Gantt', section: 'Method' },
      { name: 'RIAD', href: '/dashboard/projects/risk-register', section: 'Risk' },
      { name: 'Time', href: '/dashboard/projects/timesheets', section: 'Time' },

      { name: 'Messages', href: '/dashboard/messages?from=projects&channel=colleague', desc: 'Project team threads', section: 'Home', rail: false },
    ],
  },
  {
    id: 'sustainability',
    name: 'Impact',
    icon: Leaf,
    href: '/dashboard/sustainability',
    resource: 'operations',
    steps: [
      { name: 'Overview', href: '/dashboard/sustainability', exact: true, section: 'Home' },
      { name: 'GHG', href: '/dashboard/sustainability/carbon-tracking', section: 'Measure' },
      { name: 'Resources', href: '/dashboard/sustainability/water-waste', section: 'Measure' },
      { name: 'Targets', href: '/dashboard/sustainability/regenerative-dashboard', section: 'Targets' },
      { name: 'Material', href: '/dashboard/sustainability/materiality', section: 'Targets' },
      { name: 'Certs', href: '/dashboard/sustainability/green-certificates', section: 'Prove' },
      { name: 'Actions', href: '/dashboard/sustainability/initiatives', section: 'Act' },
      { name: 'Pack', href: '/dashboard/sustainability/reports', section: 'Report' },

      { name: 'Messages', href: '/dashboard/messages?from=sustainability&channel=colleague', desc: 'Impact team notes', section: 'Home', rail: false },
    ],
  },
  {
    id: 'intelligence',
    name: 'Insights',
    icon: Brain,
    href: '/dashboard/intelligence',
    resource: 'intelligence',
    steps: [
      { name: 'Overview', href: '/dashboard/intelligence', exact: true, section: 'Home' },
      { name: 'Pulse', href: '/dashboard/intelligence/pulse-dashboard', section: 'Sense' },
      { name: 'Insights', href: '/dashboard/intelligence/neural-insights', section: 'Sense' },
      { name: 'Forecast', href: '/dashboard/intelligence/predictive-forecasts', section: 'Plan' },
      { name: 'Score', href: '/dashboard/intelligence/custom-scorecards', section: 'Score' },
      { name: 'Lab', href: '/dashboard/intelligence/simulation-lab', section: 'Lab' },
      { name: 'Lead', href: '/dashboard/intelligence/leadership-development', section: 'Lead' },

      { name: 'Messages', href: '/dashboard/messages?from=intelligence&channel=colleague', desc: 'Insights team notes', section: 'Home', rail: false },
    ],
  },
  {
    id: 'fieldgraph',
    name: 'CropAdvisor',
    icon: Sprout,
    href: '/dashboard/fieldgraph',
    resource: 'operations',
    steps: [
      { name: 'Command', href: '/dashboard/fieldgraph', exact: true, desc: 'Process design · workbenches', section: 'Home' },
      { name: 'Field & agronomic', href: '/dashboard/fieldgraph/fields', desc: 'Shared field master · yield analysis', section: 'Core' },
      { name: 'Estimates', href: '/dashboard/fieldgraph/estimates', desc: 'Estimate manager · mill board', section: 'Core' },
      { name: 'Harvest Planner', href: '/dashboard/fieldgraph/harvest', desc: 'Sequence · allocation · cut dates', section: 'Core' },
      { name: 'Vehicles', href: '/dashboard/fieldgraph/fleet', desc: 'Fuel util · R/km', section: 'Core' },
      { name: 'Inputs', href: '/dashboard/fieldgraph/inputs', desc: 'Fert · chem · N-P-K / ha', section: 'Season' },
      { name: 'Labour & rates', href: '/dashboard/fieldgraph/labour', desc: 'Gangs · rates · field costs', section: 'Season' },
      { name: 'Regen', href: '/dashboard/fieldgraph/regen', desc: 'Soil · water · cover', section: 'Regen' },
      { name: 'Trade', href: '/dashboard/fieldgraph/trade', desc: 'Mill · buyer · lots', section: 'Trade' },
      { name: 'Management report', href: '/dashboard/fieldgraph/management', desc: 'A4 landscape PDF · key metrics', section: 'Insights' },

      { name: 'Messages', href: '/dashboard/messages?from=fieldgraph&channel=connection', desc: 'Farm · mill · buyer threads', section: 'Trade', rail: false },
    ],
  },
  {
    id: 'quarrygraph',
    name: 'QuarryAdvisor',
    icon: Mountain,
    href: '/dashboard/quarrygraph',
    resource: 'operations',
    steps: [
      { name: 'Command', href: '/dashboard/quarrygraph', exact: true, desc: 'Process design · workbenches', section: 'Home' },
      { name: 'Quarries', href: '/dashboard/quarrygraph/quarries', desc: 'Multi-quarry · GPS', section: 'Core' },
      { name: 'Sites & faces', href: '/dashboard/quarrygraph/sites', desc: 'Pits · temp pads', section: 'Core' },
      { name: 'Locations', href: '/dashboard/quarrygraph/locations', desc: 'Temp · batch · allocate · km', section: 'Core' },
      { name: 'Products', href: '/dashboard/quarrygraph/products', desc: 'Grades · G1–G7 · stone', section: 'Core' },
      { name: 'Reserves', href: '/dashboard/quarrygraph/reserves', desc: 'Survey · approved tonnes', section: 'Core' },
      { name: 'Production', href: '/dashboard/quarrygraph/production', desc: 'Plan · blasts · dates', section: 'Core' },
      { name: 'Plant & stock', href: '/dashboard/quarrygraph/plant', desc: 'Crush · pads', section: 'Ops' },
      { name: 'Dispatch', href: '/dashboard/quarrygraph/dispatch', desc: 'Weighbridge tickets', section: 'Ops' },
      { name: 'Vehicles', href: '/dashboard/quarrygraph/fleet', desc: 'Fuel util · R/km · R/t', section: 'Ops' },
      { name: 'Labour & rates', href: '/dashboard/quarrygraph/labour', desc: 'Crews · cost', section: 'Ops' },
      { name: 'Quality', href: '/dashboard/quarrygraph/quality', desc: 'Lab · CS · grading', section: 'Assure' },
      { name: 'Compliance', href: '/dashboard/quarrygraph/compliance', desc: 'Rights · WUL · EMP', section: 'Assure' },
      { name: 'Management report', href: '/dashboard/quarrygraph/management', desc: 'A4 landscape PDF · key metrics', section: 'Insights' },

      { name: 'Messages', href: '/dashboard/messages?from=quarrygraph&channel=connection', desc: 'Office · pit · trade threads', section: 'Ops', rail: false },
    ],
  },
  {
    id: 'fitgraph',
    name: 'GymAdvisor',
    icon: Dumbbell,
    href: '/dashboard/fitgraph',
    resource: 'gym_owner',
    steps: [
      { name: 'Command', href: '/dashboard/fitgraph', exact: true, desc: 'Gym OS · People · CRM · Finance', section: 'Home' },
      { name: 'Coaches', href: '/dashboard/fitgraph/coaches', desc: 'Trainers · contract or permanent', section: 'People' },
      { name: 'Clients', href: '/dashboard/fitgraph/clients', desc: 'Member book · member / private · classes', section: 'People' },
      { name: 'Classes', href: '/dashboard/fitgraph/classes', desc: 'Class · coach · calendar · booked members', section: 'Services' },
      { name: 'Movements', href: '/dashboard/fitgraph/movements', desc: 'Exercise library · video', section: 'Services' },
      { name: 'Programmes', href: '/dashboard/fitgraph/programmes', desc: 'Build, sell and follow training plans', section: 'Services' },
      { name: 'Leadership', href: '/dashboard/fitgraph/leaderboard', desc: 'Activities · age/sex benchmarks · gym board', section: 'Floor' },
      { name: 'Calendar', href: '/dashboard/fitgraph/calendar', desc: 'Schedule coaches · public', section: 'Floor' },
      { name: 'Rooms', href: '/dashboard/fitgraph/rooms', desc: 'Studios · courts · spin · diary resources', section: 'Floor' },
      { name: 'Plan', href: '/dashboard/fitgraph/bookings', desc: 'Call in the plan · today · week', section: 'Floor' },
      { name: 'Check-ins', href: '/dashboard/fitgraph/checkins', desc: 'Phone QR · paid/unpaid alerts', section: 'Floor' },
      { name: 'Tasks', href: '/dashboard/fitgraph/tasks', desc: 'Today · assigned · follow-ups', section: 'Floor' },
      { name: 'Messages', href: '/dashboard/fitgraph/messages', desc: 'Desk · coaches · members', section: 'Floor' },
      { name: 'Accounts', href: '/dashboard/fitgraph/accounts', desc: 'Member fees · debit banks · proof', section: 'Money' },
      { name: 'Comms', href: '/dashboard/fitgraph/comms', desc: 'Ads · notices to all members', section: 'Grow' },
      { name: 'Website & apps', href: '/dashboard/fitgraph/website', desc: 'Publish site · member app · preview', section: 'Grow' },
      { name: 'Reports', href: '/dashboard/fitgraph/management', desc: 'Slice & dice · pack · trends · A4 PDF', section: 'Insights' },
    ],
  },
  {
    id: 'physiograph',
    name: 'PhysioAdvisor',
    icon: Stethoscope,
    href: '/dashboard/physiograph',
    resource: 'operations',
    steps: [
      { name: 'Command', href: '/dashboard/physiograph', exact: true, desc: 'Clinic home', section: 'Home' },
      { name: 'Practitioners', href: '/dashboard/physiograph/practitioners', desc: 'Physios · OT · biokinetics', section: 'People' },
      { name: 'Patients', href: '/dashboard/physiograph/patients', desc: 'Patient register', section: 'People' },
      { name: 'Services', href: '/dashboard/physiograph/services', desc: 'Assessments · treatments', section: 'Services' },
      { name: 'Packages', href: '/dashboard/physiograph/packages', desc: 'Rehab packs', section: 'Services' },
      { name: 'Rooms', href: '/dashboard/physiograph/rooms', desc: 'Add rooms · assets · assign physios', section: 'Floor' },
      { name: 'Movements', href: '/dashboard/physiograph/movements', desc: 'Rehab library · share with clients', section: 'Floor' },
      { name: 'Calendar', href: '/dashboard/physiograph/calendar', desc: 'Diary · assign practitioners', section: 'Floor' },
      { name: 'Bookings', href: '/dashboard/physiograph/bookings', desc: 'Book · attend', section: 'Floor' },
      { name: 'Messages', href: '/dashboard/physiograph/messages', desc: 'Desk · physios · patients', section: 'Floor' },
      { name: 'Claims', href: '/dashboard/physiograph/claims', desc: 'Medical-aid packs · submit', section: 'Money' },
      { name: 'Accounts', href: '/dashboard/physiograph/accounts', desc: 'Patient fees · pay · proof', section: 'Money' },
      { name: 'Comms', href: '/dashboard/physiograph/comms', desc: 'Ads · notices to all patients', section: 'Grow' },
      { name: 'View portal', href: '/dashboard/physiograph/portal', desc: 'Patient PWA · website preview · pick sections', section: 'Grow' },
      { name: 'Website', href: '/dashboard/physiograph/website', desc: 'Optional public site · patient app QR · booking', section: 'Grow' },
      { name: 'Reports', href: '/dashboard/physiograph/management', desc: 'Slice & dice · pack · trends · A4 PDF', section: 'Insights' },
    ],
  },
  {
    id: 'dentalgraph',
    name: 'DentalAdvisor',
    icon: Smile,
    href: '/dashboard/dentalgraph',
    resource: 'operations',
    steps: [
      { name: 'Command', href: '/dashboard/dentalgraph', exact: true, desc: 'Practice home', section: 'Home' },
      { name: 'Staff', href: '/dashboard/dentalgraph/staff', desc: 'Dentists · hygienists · team', section: 'People' },
      { name: 'Patients', href: '/dashboard/dentalgraph/patients', desc: 'Patient register', section: 'People' },
      { name: 'Services', href: '/dashboard/dentalgraph/services', desc: 'Check-ups · treatments', section: 'Services' },
      { name: 'Packages', href: '/dashboard/dentalgraph/packages', desc: 'Care plans', section: 'Services' },
      { name: 'Rooms', href: '/dashboard/dentalgraph/rooms', desc: 'Add rooms · assets · assign clinicians', section: 'Floor' },
      { name: 'Calendar', href: '/dashboard/dentalgraph/calendar', desc: 'Diary · assign clinicians', section: 'Floor' },
      { name: 'Bookings', href: '/dashboard/dentalgraph/bookings', desc: 'Book · attend', section: 'Floor' },
      { name: 'Messages', href: '/dashboard/dentalgraph/messages', desc: 'Desk · staff · patients', section: 'Floor' },
      { name: 'Claims', href: '/dashboard/dentalgraph/claims', desc: 'Medical-aid packs · submit', section: 'Money' },
      { name: 'Accounts', href: '/dashboard/dentalgraph/accounts', desc: 'Patient fees · pay · proof', section: 'Money' },
      { name: 'Comms', href: '/dashboard/dentalgraph/comms', desc: 'Ads · notices to all patients', section: 'Grow' },
      { name: 'View portal', href: '/dashboard/dentalgraph/portal', desc: 'Patient PWA · website preview · pick sections', section: 'Grow' },
      { name: 'Website', href: '/dashboard/dentalgraph/website', desc: 'Optional public site · patient app QR · booking', section: 'Grow' },
      { name: 'Reports', href: '/dashboard/dentalgraph/management', desc: 'Slice & dice · pack · trends · A4 PDF', section: 'Insights' },
    ],
  },
  {
    id: 'psychiatrygraph',
    name: 'PsychiatryAdvisor',
    icon: BrainCircuit,
    href: '/dashboard/psychiatrygraph',
    resource: 'operations',
    steps: [
      { name: 'Command', href: '/dashboard/psychiatrygraph', exact: true, desc: 'Practice home', section: 'Home' },
      { name: 'Practitioners', href: '/dashboard/psychiatrygraph/practitioners', desc: 'Psychiatrists · psychologists', section: 'People' },
      { name: 'Patients', href: '/dashboard/psychiatrygraph/patients', desc: 'Patient register', section: 'People' },
      { name: 'Services', href: '/dashboard/psychiatrygraph/services', desc: 'Assessments · therapy', section: 'Services' },
      { name: 'Packages', href: '/dashboard/psychiatrygraph/packages', desc: 'Care packs', section: 'Services' },
      { name: 'Rooms', href: '/dashboard/psychiatrygraph/rooms', desc: 'Add rooms · assets · assign clinicians', section: 'Floor' },
      { name: 'Calendar', href: '/dashboard/psychiatrygraph/calendar', desc: 'Diary · assign clinicians', section: 'Floor' },
      { name: 'Bookings', href: '/dashboard/psychiatrygraph/bookings', desc: 'Book · attend', section: 'Floor' },
      { name: 'Messages', href: '/dashboard/psychiatrygraph/messages', desc: 'Desk · clinicians · patients', section: 'Floor' },
      { name: 'Claims', href: '/dashboard/psychiatrygraph/claims', desc: 'Medical-aid packs · submit', section: 'Money' },
      { name: 'Accounts', href: '/dashboard/psychiatrygraph/accounts', desc: 'Patient fees · pay · proof', section: 'Money' },
      { name: 'Comms', href: '/dashboard/psychiatrygraph/comms', desc: 'Ads · notices to all patients', section: 'Grow' },
      { name: 'View portal', href: '/dashboard/psychiatrygraph/portal', desc: 'Patient PWA · website preview · pick sections', section: 'Grow' },
      { name: 'Website', href: '/dashboard/psychiatrygraph/website', desc: 'Optional public site · patient app QR · booking', section: 'Grow' },
      { name: 'Reports', href: '/dashboard/psychiatrygraph/management', desc: 'Slice & dice · pack · trends · A4 PDF', section: 'Insights' },
    ],
  },
  {
    id: 'medicalgraph',
    name: 'MedicalAdvisor',
    icon: Hospital,
    href: '/dashboard/medicalgraph',
    resource: 'operations',
    steps: [
      { name: 'Command', href: '/dashboard/medicalgraph', exact: true, desc: 'Practice home', section: 'Home' },
      { name: 'Practitioners', href: '/dashboard/medicalgraph/practitioners', desc: 'GPs · nurses · specialists', section: 'People' },
      { name: 'Patients', href: '/dashboard/medicalgraph/patients', desc: 'Patient register', section: 'People' },
      { name: 'Services', href: '/dashboard/medicalgraph/services', desc: 'Consults · procedures', section: 'Services' },
      { name: 'Packages', href: '/dashboard/medicalgraph/packages', desc: 'Care packs', section: 'Services' },
      { name: 'Rooms', href: '/dashboard/medicalgraph/rooms', desc: 'Add rooms · assets · assign medical advisors', section: 'Floor' },
      { name: 'Calendar', href: '/dashboard/medicalgraph/calendar', desc: 'Diary · assign clinicians', section: 'Floor' },
      { name: 'Bookings', href: '/dashboard/medicalgraph/bookings', desc: 'Book · attend', section: 'Floor' },
      { name: 'Tasks', href: '/dashboard/medicalgraph/tasks', desc: 'Today · assigned · follow-ups', section: 'Floor' },
      { name: 'Messages', href: '/dashboard/medicalgraph/messages', desc: 'Desk · clinicians · patients', section: 'Floor' },
      { name: 'Claims', href: '/dashboard/medicalgraph/claims', desc: 'Medical-aid packs · submit', section: 'Money' },
      { name: 'Accounts', href: '/dashboard/medicalgraph/accounts', desc: 'Patient fees · pay · proof', section: 'Money' },
      { name: 'Comms', href: '/dashboard/medicalgraph/comms', desc: 'Ads · notices to all patients', section: 'Grow' },
      { name: 'View portal', href: '/dashboard/medicalgraph/portal', desc: 'Patient PWA · website preview · pick sections', section: 'Grow' },
      { name: 'Website', href: '/dashboard/medicalgraph/website', desc: 'Optional public site · patient app QR · booking', section: 'Grow' },
      { name: 'Reports', href: '/dashboard/medicalgraph/management', desc: 'Slice & dice · pack · trends · A4 PDF', section: 'Insights' },
    ],
  },
  {
    id: 'vetgraph',
    name: 'VetAdvisor',
    icon: PawPrint,
    href: '/dashboard/vetgraph',
    resource: 'operations',
    steps: [
      { name: 'Command', href: '/dashboard/vetgraph', exact: true, desc: 'Practice home', section: 'Home' },
      { name: 'Vets', href: '/dashboard/vetgraph/practitioners', desc: 'Vets · nurses · specialists', section: 'People' },
      { name: 'Clients', href: '/dashboard/vetgraph/patients', desc: 'Client register · animals', section: 'People' },
      { name: 'Services', href: '/dashboard/vetgraph/services', desc: 'Consults · vaccines · procedures', section: 'Services' },
      { name: 'Packages', href: '/dashboard/vetgraph/packages', desc: 'Wellness packs', section: 'Services' },
      { name: 'Rooms', href: '/dashboard/vetgraph/rooms', desc: 'Add rooms · assets · assign vets', section: 'Floor' },
      { name: 'Calendar', href: '/dashboard/vetgraph/calendar', desc: 'Diary · assign vets', section: 'Floor' },
      { name: 'Bookings', href: '/dashboard/vetgraph/bookings', desc: 'Book · attend', section: 'Floor' },
      { name: 'Messages', href: '/dashboard/vetgraph/messages', desc: 'Desk · vets · clients', section: 'Floor' },
      { name: 'Claims', href: '/dashboard/vetgraph/claims', desc: 'Pet medical-aid packs · submit', section: 'Money' },
      { name: 'Accounts', href: '/dashboard/vetgraph/accounts', desc: 'Client fees · pay · proof', section: 'Money' },
      { name: 'Comms', href: '/dashboard/vetgraph/comms', desc: 'Ads · notices to all clients', section: 'Grow' },
      { name: 'View portal', href: '/dashboard/vetgraph/portal', desc: 'Client PWA · website preview · pick sections', section: 'Grow' },
      { name: 'Website', href: '/dashboard/vetgraph/website', desc: 'Optional public site · client app QR · booking', section: 'Grow' },
      { name: 'Reports', href: '/dashboard/vetgraph/management', desc: 'Slice & dice · pack · trends · A4 PDF', section: 'Insights' },
    ],
  },
  {
    id: 'hiregraph',
    name: 'HireAdvisor',
    icon: BriefcaseBusiness,
    href: '/dashboard/hiregraph',
    resource: 'operations',
    steps: [
      { name: 'Command', href: '/dashboard/hiregraph', exact: true, desc: 'Hire marketplace home', section: 'Home' },
      { name: 'Suppliers', href: '/dashboard/hiregraph/suppliers', desc: 'Core SRM bridge · gear owners', section: 'Supply' },
      { name: 'Categories', href: '/dashboard/hiregraph/categories', desc: 'Requirement stacks', section: 'Supply' },
      { name: 'Catalogue', href: '/dashboard/hiregraph/catalogue', desc: 'Items linked to core suppliers', section: 'Supply' },
      { name: 'Customers', href: '/dashboard/hiregraph/customers', desc: 'B2C portal · CRM · hire KYC', section: 'Demand' },
      { name: 'Bookings', href: '/dashboard/hiregraph/bookings', desc: 'Duration · extend if free', section: 'Demand' },
      { name: 'Calendar', href: '/dashboard/hiregraph/calendar', desc: 'Hired items · category views', section: 'Demand' },
      { name: 'Handover', href: '/dashboard/hiregraph/handover', desc: 'Out · return · condition', section: 'Ops' },
      { name: 'Settlements', href: '/dashboard/hiregraph/settlements', desc: '2.5% + 2.5% on marketplace hire', section: 'Money' },
      { name: 'Accounts', href: '/dashboard/hiregraph/accounts', desc: 'Hirer fees · pay · proof', section: 'Money' },
      { name: 'Comms', href: '/dashboard/hiregraph/comms', desc: 'Ads · notices to all hirers', section: 'Grow' },
      { name: 'View portal', href: '/dashboard/hiregraph/portal', desc: 'Customer PWA · Search · Hire · You · Track', section: 'Grow' },
      { name: 'Website', href: '/dashboard/hiregraph/website', desc: 'Optional public site · hirer app QR · catalogue', section: 'Grow' },
      { name: 'Management report', href: '/dashboard/hiregraph/management', desc: 'A4 landscape PDF · GMV', section: 'Insights' },
      { name: 'Messages', href: '/dashboard/messages?from=hiregraph&channel=connection', desc: 'Supplier · renter threads', section: 'Ops', rail: false },
    ],
  },
  {
    id: 'retailgraph',
    name: 'RetailAdvisor',
    icon: Store,
    href: '/dashboard/retailgraph',
    resource: 'operations',
    steps: [
      { name: 'Command', href: '/dashboard/retailgraph', exact: true, desc: 'Retail till home', section: 'Home' },
      { name: 'Till', href: '/dashboard/retailgraph/till', desc: 'Basket · QR · NFC · cash', section: 'Floor' },
      { name: 'Catalogue', href: '/dashboard/retailgraph/catalogue', desc: 'SKUs · prices', section: 'Floor' },
      { name: 'Sales', href: '/dashboard/retailgraph/sales', desc: 'Paid baskets', section: 'Money' },
      { name: 'Customers', href: '/dashboard/retailgraph/customers', desc: 'Walk-in book', section: 'People' },
      { name: 'Accounts', href: '/dashboard/retailgraph/accounts', desc: 'Bills · present at till', section: 'Money' },
      { name: 'Comms', href: '/dashboard/retailgraph/comms', desc: 'Ads · notices to shoppers', section: 'Grow' },
      { name: 'View portal', href: '/dashboard/retailgraph/portal', desc: 'Shopper PWA · website preview · pick sections', section: 'Grow' },
      { name: 'Website', href: '/dashboard/retailgraph/website', desc: 'Optional public site · shopper app QR · shop', section: 'Grow' },
    ],
  },
  {
    id: 'schools',
    name: 'SchoolAdvisor',
    icon: School,
    href: '/dashboard/schools',
    resource: 'schools',
    steps: [
      { name: 'Home', href: '/dashboard/schools', exact: true, desc: 'Programme command', group: 'DBE', section: 'Set up' },
      { name: 'Department', href: '/dashboard/schools/agency', desc: 'Profile, tariffs, associations', group: 'DBE', section: 'Set up' },
      { name: 'Schools', href: '/dashboard/schools/registry-report', desc: 'Register · import · enrolments · RIAD', group: 'DBE', section: 'Set up' },
      { name: 'SPs', href: '/dashboard/schools/sp-register', desc: 'Directory · import · CSD · RIAD', group: 'DBE', section: 'Set up' },
      { name: 'Onboard', href: '/dashboard/schools/join', desc: 'Approve school and SP joins', group: 'DBE', section: 'Set up' },
      { name: 'Foods', href: '/dashboard/schools/approved-list', desc: 'Approved catalogue', group: 'DBE', section: 'Programme' },
      { name: 'Recipes', href: '/dashboard/schools/recipes', desc: 'Meal plan · quantities', group: 'DBE', section: 'Programme' },
      { name: 'Menu', href: '/dashboard/schools/menu', desc: 'Assign recipes to the week', group: 'DBE', section: 'Programme' },
      { name: 'Nutrition', href: '/dashboard/schools/nutrition-agency', desc: 'Programme nutrition', group: 'DBE', section: 'Programme' },
      { name: 'Calendar', href: '/dashboard/schools/feeding-calendar', desc: 'Feeding days · terms', group: 'DBE', section: 'Programme' },
      { name: 'Safety', href: '/dashboard/schools/kitchen-safety', desc: 'CoA · R638 · claim gate', group: 'DBE', section: 'Programme' },
      { name: 'Visits', href: '/dashboard/schools/visits', desc: 'PEU circuits · planned vs actual · open form from a stop', group: 'DBE', section: 'Field' },
      { name: 'Monitoring', href: '/dashboard/schools/monitoring-report', desc: 'KPIs · graphs · analytics', group: 'DBE', section: 'Field' },
      { name: 'Pack', href: '/dashboard/schools/report', desc: 'A4 management pack', group: 'DBE', section: 'Results' },
      { name: 'Analyse', href: '/dashboard/schools/agency-report', desc: 'Slice · RIAD · claims · risks', group: 'DBE', section: 'Results' },
      { name: 'Exceptions', href: '/dashboard/schools/ops', desc: 'Districts · clusters · exceptions', group: 'DBE', section: 'Results' },
      { name: 'School score', href: '/dashboard/schools/prizes', desc: 'Headmaster prize · 0–100 ranking', group: 'DBE', section: 'Results' },
      { name: 'SP score', href: '/dashboard/schools/isp-sla', desc: 'Supplier performance', group: 'DBE', section: 'Results' },
      { name: 'Map', href: '/dashboard/schools/map', desc: 'School locations', group: 'DBE', section: 'Results' },
      { name: 'Home', href: '/dashboard/schools', exact: true, desc: 'Readiness & next action', group: 'School', section: 'Set up' },
      { name: 'Profile', href: '/dashboard/schools/profile', desc: 'EMIS · kitchen · principal', group: 'School', section: 'Set up' },
      { name: 'Join DBE', href: '/dashboard/schools/join', desc: 'Request department link', group: 'School', section: 'Set up' },
      { name: 'Learners', href: '/dashboard/schools/learners', desc: 'NSNP register', group: 'School', section: 'Set up' },
      { name: 'Staff', href: '/dashboard/schools/staff', desc: 'Kitchen team', group: 'School', section: 'Set up' },
      { name: 'Foods', href: '/dashboard/schools/approved-list', desc: 'What you may order', group: 'School', section: 'Programme' },
      { name: 'Recipes', href: '/dashboard/schools/recipes', desc: 'Learner-scaled meal plan', group: 'School', section: 'Programme' },
      { name: 'Menu', href: '/dashboard/schools/menu', desc: 'Department week', group: 'School', section: 'Programme' },
      { name: 'Calendar', href: '/dashboard/schools/feeding-calendar', desc: 'Feeding days · terms', group: 'School', section: 'Programme' },
      { name: 'SPs', href: '/dashboard/schools/isps', desc: 'Directory · OTIF · rate', group: 'School', section: 'Kitchen' },
      { name: 'Orders', href: '/dashboard/schools/orders', desc: 'Purchase orders', group: 'School', section: 'Kitchen' },
      { name: 'Deliveries', href: '/dashboard/schools/deliveries', desc: 'Receive POD', group: 'School', section: 'Kitchen' },
      { name: 'Stock', href: '/dashboard/schools/kitchen', desc: 'GRN · issue · waste · pack', group: 'School', section: 'Kitchen' },
      { name: 'Serve', href: '/dashboard/schools/serve-day', desc: 'Meals today · attendance', group: 'School', section: 'Kitchen' },
      { name: 'Safety', href: '/dashboard/schools/kitchen-safety', desc: 'CoA · R638 · PIC · self-audit', group: 'School', section: 'Kitchen' },
      { name: 'Pack', href: '/dashboard/schools/report', desc: 'A4 management pack', group: 'School', section: 'Results' },
      { name: 'Claims', href: '/dashboard/schools/claims', desc: 'Submit to DBE', group: 'School', section: 'Results' },
      { name: 'Nutrition', href: '/dashboard/schools/nutrition', desc: 'Meal scores', group: 'School', section: 'Results' },
      { name: 'Prizes', href: '/dashboard/schools/prizes', desc: 'Headmaster prize score', group: 'School', section: 'Results' },
      { name: 'Visits', href: '/dashboard/schools/visits', desc: 'PEU planned · results · monitoring', group: 'School', section: 'Results' },
      { name: 'Home', href: '/dashboard/schools', exact: true, desc: 'SP command · next action', group: 'SP', section: 'Set up' },
      { name: 'Profile', href: '/dashboard/schools/isps', desc: 'Register · claim schools', group: 'SP', section: 'Set up' },
      { name: 'Join DBE', href: '/dashboard/schools/join', desc: 'Associate with department', group: 'SP', section: 'Set up' },
      { name: 'Foods', href: '/dashboard/schools/approved-list', desc: 'Approved catalogue', group: 'SP', section: 'Programme' },
      { name: 'Recipes', href: '/dashboard/schools/recipes', desc: 'Product needs for schools you supply', group: 'SP', section: 'Programme' },
      { name: 'Menu', href: '/dashboard/schools/menu', desc: 'Department week', group: 'SP', section: 'Programme' },
      { name: 'Calendar', href: '/dashboard/schools/feeding-calendar', desc: 'Feeding days for supply planning', group: 'SP', section: 'Programme' },
      { name: 'Orders', href: '/dashboard/schools/orders', desc: 'School POs · fulfil queue', group: 'SP', section: 'Ops' },
      { name: 'Deliver', href: '/dashboard/schools/deliveries', desc: 'Dispatch · POD', group: 'SP', section: 'Ops' },
      { name: 'Score', href: '/dashboard/schools/isp-sla', desc: 'OTIFEF · SLA', group: 'SP', section: 'Ops' },
      { name: 'Buy', href: '/dashboard/suppliers', desc: 'Wholesalers · book · POs', group: 'SP', section: 'Trade' },
      { name: 'Invite', href: '/dashboard/invite-business?type=supplier&from=nsnp-sp', desc: 'Invite wholesalers', group: 'SP', section: 'Trade' },
      { name: 'Pack', href: '/dashboard/schools/report', desc: 'A4 management pack', group: 'SP', section: 'Results' },
      { name: 'Messages', href: '/dashboard/messages?from=schools&channel=colleague', desc: 'DBE · school · SP threads', section: 'Home', rail: false },
    ],
  },
  {
    id: 'health',
    name: 'HealthAdvisor',
    icon: HeartPulse,
    href: '/dashboard/health',
    resource: 'schools',
    steps: [
      { name: 'Command', href: '/dashboard/health', exact: true, desc: 'Health programme home', group: 'DoH', section: 'Govern' },
      { name: 'DoH desk', href: '/dashboard/health/agency', desc: 'Register department · approve facilities', group: 'DoH', section: 'Govern' },
      { name: 'Join & add', href: '/dashboard/health/join', desc: 'Add clinics, hospitals & SPs', group: 'DoH', section: 'Govern' },
      { name: 'Facilities', href: '/dashboard/health/agency', desc: 'All clinics & hospitals on your programme', group: 'DoH', section: 'Insights' },
      { name: 'Management report', href: '/dashboard/health/report', desc: 'A4 landscape PDF · coverage · key metrics', group: 'DoH', section: 'Insights' },
      { name: 'Map', href: '/dashboard/health/map', desc: 'Facility locations', group: 'DoH', section: 'Insights' },
      { name: 'Catalogue', href: '/dashboard/schools/approved-list', desc: 'Approved foods for health facilities', group: 'DoH', section: 'Programme' },
      { name: 'Nutrition', href: '/dashboard/schools/nutrition-agency', desc: 'Programme nutrition roll-up', group: 'DoH', section: 'Programme' },
      { name: 'Command', href: '/dashboard/health', exact: true, desc: 'Clinic / hospital home', group: 'Facility', section: 'Home' },
      { name: 'Join DoH', href: '/dashboard/health/join', desc: 'Request to join Department of Health', group: 'Facility', section: 'Home' },
      { name: 'Profile', href: '/dashboard/schools/profile', desc: 'Facility profile & kitchen', group: 'Facility', section: 'Home' },
      { name: 'Approved foods', href: '/dashboard/schools/approved-list', desc: 'What you may order', group: 'Facility', section: 'Supply' },
      { name: 'Orders', href: '/dashboard/schools/orders', desc: 'Order from DoH-approved SPs', group: 'Facility', section: 'Supply' },
      { name: 'Kitchen', href: '/dashboard/schools/kitchen', desc: 'GRN · issue · waste', group: 'Facility', section: 'Kitchen' },
      { name: 'Nutrition', href: '/dashboard/schools/nutrition', desc: 'Meal nutrition vs norms', group: 'Facility', section: 'Kitchen' },
      { name: 'Join DoH', href: '/dashboard/health/join', desc: 'Associate with Department of Health', group: 'SP', section: 'Home' },
      { name: 'Deliver', href: '/dashboard/schools/deliveries', desc: 'Dispatch to clinics & hospitals', group: 'SP', section: 'Ops' },
      { name: 'Catalogue', href: '/dashboard/schools/approved-list', desc: 'Approved foods you must supply', group: 'SP', section: 'Supply' },

      { name: 'Messages', href: '/dashboard/messages?from=health&channel=colleague', desc: 'DoH · facility · SP threads', section: 'Govern', rail: false },
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
      { name: 'Company', href: '/dashboard/guide/company', section: 'Govern' },
      { name: 'Network', href: '/dashboard/guide/network', section: 'Trade' },
      { name: 'Buy', href: '/dashboard/guide/suppliers', section: 'Trade' },
      { name: 'Sell', href: '/dashboard/guide/customers', section: 'Trade' },
      { name: 'Stock', href: '/dashboard/guide/inventory', section: 'Operate' },
      { name: 'Ops', href: '/dashboard/guide/operations', section: 'Operate' },
      { name: 'Make', href: '/dashboard/guide/make', section: 'Operate' },
      { name: 'Ship', href: '/dashboard/guide/ship', section: 'Operate' },
      { name: 'Assure', href: '/dashboard/guide/quality', section: 'Assure' },
      { name: 'Money', href: '/dashboard/guide/finance', section: 'Money' },
      { name: 'Secure', href: '/dashboard/guide/roles-security', section: 'Secure' },
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
