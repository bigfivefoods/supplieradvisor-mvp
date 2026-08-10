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
  Stethoscope,
  Sprout,
  Mountain,
  Dumbbell,
  Shield,
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
        desc: 'Companies, people, trade, commercial',
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
    ],
  },
  {
    id: 'my-business',
    name: 'Company',
    icon: Building2,
    href: '/dashboard/my-business',
    resource: 'profile',
    steps: [
      // Section headers render like Schools-DBE (Govern · People · Trust …)
      {
        name: 'Overview',
        href: '/dashboard/my-business',
        exact: true,
        desc: 'Company command tower',
        section: 'Govern',
      },
      {
        name: 'Identity',
        href: '/dashboard/my-business/profile',
        desc: 'Profile, legal, banking, certs',
        section: 'Govern',
      },
      {
        name: 'Modules',
        href: '/dashboard/my-business/modules',
        // Platform control: /dashboard/my-business/platform (authorised accounts only)
        desc: 'Sector · packs · sidebar hubs in one place',
        section: 'Govern',
      },
      {
        name: 'Settings',
        href: '/dashboard/my-business/settings',
        desc: 'Currency, terms, notifications',
        section: 'Govern',
      },
      {
        name: 'Group',
        href: '/dashboard/my-business/group',
        desc: 'Holding company, subsidiaries, associations',
        section: 'Govern',
      },
      {
        name: 'Team',
        href: '/dashboard/my-business/team',
        desc: 'Invite people with roles',
        section: 'People',
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
        desc: 'CIPC / bank verification ops',
        section: 'Trust',
      },
      {
        name: 'Docs',
        href: '/dashboard/my-business/documents',
        desc: 'Company vault',
        section: 'Trust',
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
        section: 'Grow',
      },
      {
        name: 'Referrals',
        href: '/dashboard/my-business/referral-ops',
        desc: 'Referral earnings ops',
        section: 'Grow',
      },
      {
        name: 'Ops',
        href: '/dashboard/my-business/ops',
        desc: 'P0 readiness + settle health',
        section: 'Field',
      },
      {
        name: 'Risks',
        href: '/dashboard/my-business/riad-log',
        desc: 'Company RIAD register',
        section: 'Field',
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
      { name: 'Book', href: '/dashboard/suppliers/network', desc: 'Your supplier book', section: 'Source' },
      { name: 'Invite', href: '/dashboard/suppliers/invites', desc: 'Invite off-platform suppliers', section: 'Source' },
      { name: 'Order', href: '/dashboard/suppliers/po', desc: 'All POs — raise, receive, settle', section: 'Trade' },
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
    ],
  },
  {
    id: 'customers',
    name: 'Customers',
    icon: UsersRound,
    href: '/dashboard/customers',
    resource: 'customers',
    steps: [
      { name: 'Overview', href: '/dashboard/customers', exact: true, desc: 'CRM command tower', section: 'Home' },
      { name: 'Source', href: '/dashboard/customers/leads', desc: 'Leads & pipeline', section: 'Source' },
      { name: 'Book', href: '/dashboard/customers/profiles', desc: 'Customer accounts', section: 'Source' },
      { name: 'Invite', href: '/dashboard/customers/invites', desc: 'Invite buyers to platform', section: 'Source' },
      { name: 'Quote', href: '/dashboard/customers/quotes', desc: 'Quotes', section: 'Trade' },
      { name: 'Order', href: '/dashboard/customers/orders', desc: 'Sales orders & inbound POs', section: 'Trade' },
      { name: 'Invoice', href: '/dashboard/customers/invoices', desc: 'Bill customers', section: 'Trade' },
      { name: 'Money', href: '/dashboard/customers/money', desc: 'Collect, claims, AR, settle', section: 'Money' },
      { name: 'Rate', href: '/dashboard/customers/ratings', desc: 'Peer ratings after trade', section: 'Score' },
      {
        name: 'Report',
        href: '/dashboard/customers/report',
        desc: 'Slice & dice — revenue, AR, pipeline, risk',
        section: 'Score',
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
      { name: 'Lots', href: '/dashboard/inventory/lots', section: 'Stock' },
      { name: 'Receive', href: '/dashboard/inventory/scan', section: 'Move' },
      { name: 'Move', href: '/dashboard/inventory/stock-transfers', section: 'Move' },
      { name: 'Count', href: '/dashboard/inventory/counts', section: 'Move' },
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
      { name: 'Inbound', href: '/dashboard/operations/inbound', section: 'Flow' },
      { name: 'Store', href: '/dashboard/operations/warehouse', section: 'Flow' },
      { name: 'Make', href: '/dashboard/operations/production', section: 'Flow' },
      { name: 'Outbound', href: '/dashboard/operations/outbound', section: 'Flow' },
      { name: 'Fulfill', href: '/dashboard/operations/customer-orders', section: 'Flow' },
      { name: 'Fix', href: '/dashboard/operations/exceptions', section: 'Fix' },
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
      { name: 'Chart', href: '/dashboard/accounting/chart-of-accounts', section: 'Books' },
      { name: 'Journals', href: '/dashboard/accounting/journal-entries', section: 'Books' },
      { name: 'AR', href: '/dashboard/accounting/accounts-receivable', desc: 'Collect', section: 'Trade' },
      { name: 'AP', href: '/dashboard/accounting/accounts-payable', desc: 'Bills', section: 'Trade' },
      { name: 'Payments', href: '/dashboard/accounting/payments', section: 'Trade' },
      { name: 'Bank', href: '/dashboard/accounting/bank-reconciliation', section: 'Bank' },
      { name: 'Budget', href: '/dashboard/accounting/budget', desc: '12-month plan by COA', section: 'Plan' },
      { name: 'Manage', href: '/dashboard/accounting/management', section: 'Plan' },
      { name: 'Reports', href: '/dashboard/accounting/reports', section: 'Report' },
      { name: 'VAT', href: '/dashboard/accounting/tax', section: 'Report' },
      { name: 'Assets', href: '/dashboard/accounting/fixed-assets', section: 'Report' },
      { name: 'Entities', href: '/dashboard/accounting/entities', section: 'Govern' },
      { name: 'Settings', href: '/dashboard/accounting/settings', desc: 'Close / periods', section: 'Govern' },
    ],
  },
  {
    id: 'people',
    name: 'People',
    icon: IdCard,
    href: '/dashboard/people',
    resource: 'people',
    steps: [
      { name: 'Overview', href: '/dashboard/people', exact: true, section: 'Home' },
      { name: 'Directory', href: '/dashboard/people/directory', section: 'Book' },
      { name: 'Org', href: '/dashboard/people/org-chart', desc: 'BU organogram + reporting lines', section: 'Book' },
      { name: 'Rate', href: '/dashboard/people/performance', section: 'Rate' },
      { name: 'Discipline', href: '/dashboard/people/disciplinary', section: 'Rate' },
      { name: 'Payroll', href: '/dashboard/people/payroll', section: 'Pay' },
      { name: 'Leave', href: '/dashboard/people/leave', section: 'Pay' },
      { name: 'Train', href: '/dashboard/people/training', section: 'Grow' },
      { name: 'Onboard', href: '/dashboard/people/onboarding', section: 'Grow' },
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
      { name: 'RIAD', href: '/dashboard/projects/risk-register', section: 'Risk' },
      { name: 'Time', href: '/dashboard/projects/timesheets', section: 'Time' },
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
    ],
  },
  {
    id: 'fieldgraph',
    name: 'Fieldgraph',
    icon: Sprout,
    href: '/dashboard/fieldgraph',
    resource: 'operations',
    /**
     * Fieldgraph® — multi-crop primary production OS.
     * Core agri: Field & agronomic data, Estimates, Harvest Planner, Vehicle Management.
     * Plus inputs, labour, regen, farm-to-buyer trade.
     */
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
      { name: 'Reports', href: '/dashboard/fieldgraph/report', desc: 'Slice & dice · yield · fleet · labour', section: 'Insights' },
    ],
  },
  {
    id: 'quarrygraph',
    name: 'Quarrygraph',
    icon: Mountain,
    href: '/dashboard/quarrygraph',
    resource: 'operations',
    /**
     * Quarrygraph® — primary sector quarrying & aggregates OS.
     * Sites, products, reserves, production, plant, dispatch, fleet, labour, QA, permits.
     */
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
      { name: 'Reports', href: '/dashboard/quarrygraph/report', desc: 'Key management pack', section: 'Insights' },
    ],
  },
  {
    id: 'fitgraph',
    name: 'Fitgraph',
    icon: Dumbbell,
    href: '/dashboard/fitgraph',
    resource: 'operations',
    /**
     * Fitgraph® — tertiary / services gym OS
     * (coaches, clients, memberships, subscriptions, classes, calendar,
     * website embed, coach portal, bookings, check-ins).
     */
    steps: [
      { name: 'Command', href: '/dashboard/fitgraph', exact: true, desc: 'Gym services home', section: 'Home' },
      { name: 'Coaches', href: '/dashboard/fitgraph/coaches', desc: 'Trainers · portal links', section: 'People' },
      { name: 'Coach calendar', href: '/dashboard/fitgraph/coach-calendar', desc: 'Plan · actual · series', section: 'People' },
      { name: 'Clients', href: '/dashboard/fitgraph/clients', desc: 'Members & status', section: 'People' },
      { name: 'Memberships', href: '/dashboard/fitgraph/memberships', desc: 'Plans & PT packs', section: 'Services' },
      { name: 'Subscriptions', href: '/dashboard/fitgraph/subscriptions', desc: 'Member billing status', section: 'Services' },
      { name: 'Classes', href: '/dashboard/fitgraph/classes', desc: 'Class types', section: 'Services' },
      { name: 'Calendar', href: '/dashboard/fitgraph/calendar', desc: 'Schedule coaches · public', section: 'Floor' },
      { name: 'Bookings', href: '/dashboard/fitgraph/bookings', desc: 'Class bookings', section: 'Floor' },
      { name: 'Check-ins', href: '/dashboard/fitgraph/checkins', desc: 'Front desk', section: 'Floor' },
      { name: 'Messages', href: '/dashboard/fitgraph/messages', desc: 'Desk · coaches · members', section: 'Floor' },
      { name: 'Website', href: '/dashboard/fitgraph/website', desc: 'Embed · public calendar', section: 'Grow' },
      { name: 'Reports', href: '/dashboard/fitgraph/report', desc: 'Attendance · members', section: 'Insights' },
    ],
  },
  {
    id: 'physiograph',
    name: 'Physiograph',
    icon: Stethoscope,
    href: '/dashboard/physiograph',
    resource: 'operations',
    /**
     * Physiograph® — tertiary / services clinic OS
     * (physio, OT, biokinetics: practitioners, patients, services,
     * packages, diary, bookings, website).
     */
    steps: [
      { name: 'Command', href: '/dashboard/physiograph', exact: true, desc: 'Clinic home', section: 'Home' },
      { name: 'Practitioners', href: '/dashboard/physiograph/practitioners', desc: 'Physios · OT · biokinetics', section: 'People' },
      { name: 'Patients', href: '/dashboard/physiograph/patients', desc: 'Patient register', section: 'People' },
      { name: 'Services', href: '/dashboard/physiograph/services', desc: 'Assessments · treatments', section: 'Services' },
      { name: 'Packages', href: '/dashboard/physiograph/packages', desc: 'Rehab packs', section: 'Services' },
      { name: 'Calendar', href: '/dashboard/physiograph/calendar', desc: 'Diary · assign practitioners', section: 'Floor' },
      { name: 'Bookings', href: '/dashboard/physiograph/bookings', desc: 'Book · attend', section: 'Floor' },
      { name: 'Messages', href: '/dashboard/physiograph/messages', desc: 'Desk · physios · patients', section: 'Floor' },
      { name: 'Website', href: '/dashboard/physiograph/website', desc: 'Clinic profile · booking', section: 'Grow' },
      { name: 'Reports', href: '/dashboard/physiograph/report', desc: 'Utilisation · load', section: 'Insights' },
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
        name: 'Trip calendar',
        href: '/dashboard/schools/visits',
        desc: 'Plan PEU circuits · calendar · planned vs actual',
        group: 'DBE',
        section: 'Field',
      },
      {
        name: 'Monitoring form',
        href: '/dashboard/schools/monitoring',
        desc: 'Full KZN tool · open from planned stops',
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
        desc: 'GRN · issue · waste · substitutions',
        group: 'School',
        section: 'Kitchen',
      },
      {
        name: 'Kitchen pack',
        href: '/dashboard/schools/kitchen-pack',
        desc: 'Mobile · POD · serve offline',
        group: 'School',
        section: 'Kitchen',
      },
      {
        name: 'Serve day',
        href: '/dashboard/schools/serve-day',
        desc: 'Meals today · attendance scale',
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
        // school view of planned/completed department visits
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
        section: 'Govern',
      },
      {
        name: 'DoH desk',
        href: '/dashboard/health/agency',
        desc: 'Register department · approve facilities',
        group: 'DoH',
        section: 'Govern',
      },
      {
        name: 'Join & add',
        href: '/dashboard/health/join',
        desc: 'Add clinics, hospitals & SPs',
        group: 'DoH',
        section: 'Govern',
      },
      {
        name: 'Facilities',
        href: '/dashboard/health/agency',
        desc: 'All clinics & hospitals on your programme',
        group: 'DoH',
        section: 'Insights',
      },
      {
        name: 'Coverage',
        href: '/dashboard/health/report',
        desc: 'By district & facility type',
        group: 'DoH',
        section: 'Insights',
      },
      {
        name: 'Map',
        href: '/dashboard/health/map',
        desc: 'Facility locations',
        group: 'DoH',
        section: 'Insights',
      },
      {
        name: 'Catalogue',
        href: '/dashboard/schools/approved-list',
        desc: 'Approved foods for health facilities',
        group: 'DoH',
        section: 'Programme',
      },
      {
        name: 'Nutrition',
        href: '/dashboard/schools/nutrition-agency',
        desc: 'Programme nutrition roll-up',
        group: 'DoH',
        section: 'Programme',
      },
      {
        name: 'Command',
        href: '/dashboard/health',
        exact: true,
        desc: 'Clinic / hospital home',
        group: 'Facility',
        section: 'Home',
      },
      {
        name: 'Join DoH',
        href: '/dashboard/health/join',
        desc: 'Request to join Department of Health',
        group: 'Facility',
        section: 'Home',
      },
      {
        name: 'Profile',
        href: '/dashboard/schools/profile',
        desc: 'Facility profile & kitchen',
        group: 'Facility',
        section: 'Home',
      },
      {
        name: 'Approved foods',
        href: '/dashboard/schools/approved-list',
        desc: 'What you may order',
        group: 'Facility',
        section: 'Supply',
      },
      {
        name: 'Orders',
        href: '/dashboard/schools/orders',
        desc: 'Order from DoH-approved SPs',
        group: 'Facility',
        section: 'Supply',
      },
      {
        name: 'Kitchen',
        href: '/dashboard/schools/kitchen',
        desc: 'GRN · issue · waste',
        group: 'Facility',
        section: 'Kitchen',
      },
      {
        name: 'Nutrition',
        href: '/dashboard/schools/nutrition',
        desc: 'Meal nutrition vs norms',
        group: 'Facility',
        section: 'Kitchen',
      },
      {
        name: 'Join DoH',
        href: '/dashboard/health/join',
        desc: 'Associate with Department of Health',
        group: 'SP',
        section: 'Home',
      },
      {
        name: 'Deliver',
        href: '/dashboard/schools/deliveries',
        desc: 'Dispatch to clinics & hospitals',
        group: 'SP',
        section: 'Ops',
      },
      {
        name: 'Catalogue',
        href: '/dashboard/schools/approved-list',
        desc: 'Approved foods you must supply',
        group: 'SP',
        section: 'Supply',
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
