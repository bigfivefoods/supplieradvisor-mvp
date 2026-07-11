/**
 * System How-to Guide — training curriculum for every module & process.
 * Linked from /dashboard/guide and nested under the Guide sidebar module.
 */

export type FlowNode = {
  id: string;
  label: string;
  /** short verb / stage */
  hint?: string;
  tone?: 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';
};

export type GuideSection = {
  slug: string;
  /** Matches module-nav id when applicable */
  moduleId?: string;
  title: string;
  tagline: string;
  /** Why this module exists */
  purpose: string;
  /** Who typically uses it */
  who: string[];
  /** End-to-end process stages */
  flow: FlowNode[];
  /** Step-by-step how-to for critical processes */
  processes: Array<{
    name: string;
    href?: string;
    summary: string;
    steps: string[];
    tip?: string;
  }>;
  /** Key concepts */
  concepts?: Array<{ term: string; meaning: string }>;
  /** Checklist to “graduate” the module */
  checklist: string[];
};

export const SYSTEM_OVERVIEW = {
  title: 'How SupplierAdvisor works',
  subtitle: 'One company workspace · trusted network · physical ops · money · quality · insight',
  pillars: [
    {
      title: 'Identity',
      body: 'You sign in, pick a company, and your role (owner, finance, operations…) unlocks the right modules.',
    },
    {
      title: 'Network',
      body: 'Companies connect as suppliers and customers. Pricing, POs, and escrow ride on those links.',
    },
    {
      title: 'Flow of goods',
      body: 'Inventory, operations, manufacturing, distribution, and containers move product with lots and holds.',
    },
    {
      title: 'Flow of money',
      body: 'Quotes → orders → invoices → bank allocate → journals → period close. Escrow is optional on POs.',
    },
    {
      title: 'Trust',
      body: 'Quality inspections, HACCP, OTIFEF scores, and RIAD risks keep the story auditable.',
    },
  ],
  masterFlow: [
    { id: '1', label: 'Company', hint: 'Select workspace', tone: 'slate' as const },
    { id: '2', label: 'Connect', hint: 'Network & trade partners', tone: 'cyan' as const },
    { id: '3', label: 'Buy / Sell', hint: 'POs, quotes, orders', tone: 'violet' as const },
    { id: '4', label: 'Move', hint: 'Receive · make · ship', tone: 'emerald' as const },
    { id: '5', label: 'Assure', hint: 'QA · hold · release', tone: 'amber' as const },
    { id: '6', label: 'Account', hint: 'Bank · post · close', tone: 'cyan' as const },
    { id: '7', label: 'Learn', hint: 'Scores · forecasts', tone: 'violet' as const },
  ],
};

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    slug: 'company',
    moduleId: 'my-business',
    title: 'Company',
    tagline: 'Your workspace identity, team, and controls',
    purpose:
      'Everything in SupplierAdvisor is company-scoped. Profile, team roles, documents, and risk logs define who you are and who can act.',
    who: ['Owner', 'Admin', 'Anyone setting up a new workspace'],
    flow: [
      { id: 'a', label: 'Select', hint: 'Pick company', tone: 'slate' },
      { id: 'b', label: 'Profile', hint: 'Trading identity', tone: 'cyan' },
      { id: 'c', label: 'Team', hint: 'Roles & invites', tone: 'violet' },
      { id: 'd', label: 'Docs', hint: 'Certificates & files', tone: 'emerald' },
      { id: 'e', label: 'Risks', hint: 'RIAD log', tone: 'amber' },
      { id: 'f', label: 'Settings', hint: 'Workspace prefs', tone: 'slate' },
    ],
    processes: [
      {
        name: 'Select a company',
        href: '/dashboard/select-company',
        summary: 'One login can own or join many companies. Always confirm the active workspace first.',
        steps: [
          'Open Switch company (sidebar) or /dashboard/select-company',
          'Choose the trading entity you want to operate',
          'Sidebar modules and process rails now scope to that company',
        ],
        tip: 'If data looks empty, you are probably on the wrong company.',
      },
      {
        name: 'Invite your team',
        href: '/dashboard/my-business/team',
        summary: 'Roles control write access (finance locks periods; ops runs QA and ships).',
        steps: [
          'Company → Team → invite by email',
          'Assign owner, admin, finance, operations, sales, or viewer',
          'Member accepts invite and lands in the right home module',
        ],
      },
      {
        name: 'Log a company risk (RIAD)',
        href: '/dashboard/my-business/riad-log',
        summary: 'Risks, Issues, Actions, Decisions — lightweight governance without a separate GRC tool.',
        steps: [
          'Open Risks under Company',
          'Capture the item, owner, and status',
          'Review in team stand-ups or audits',
        ],
      },
    ],
    concepts: [
      { term: 'Company / profile', meaning: 'The legal or trading entity you operate in the app.' },
      { term: 'Role', meaning: 'Permission matrix for modules (e.g. finance can post; viewer cannot).' },
    ],
    checklist: [
      'Company selected and profile complete',
      'At least one admin/owner active',
      'Team roles match real jobs',
    ],
  },
  {
    slug: 'network',
    moduleId: 'network',
    title: 'Network',
    tagline: 'Graph of companies, pricing, and marketplace',
    purpose:
      'The network is how two companies become able to trade. Pricing agreements and marketplace listings sit on top of connections.',
    who: ['Commercial leads', 'Procurement', 'Sales'],
    flow: [
      { id: 'a', label: 'Graph', hint: 'See links', tone: 'cyan' },
      { id: 'b', label: 'Price', hint: 'Agreements', tone: 'violet' },
      { id: 'c', label: 'Market', hint: 'List & inquire', tone: 'emerald' },
      { id: 'd', label: 'Invite', hint: 'Bring a company', tone: 'amber' },
    ],
    processes: [
      {
        name: 'Invite a company',
        href: '/dashboard/invite-business',
        summary: 'On-platform connection is required before linked supplier POs.',
        steps: [
          'Network → Invite',
          'Send invite email / link',
          'Counterparty joins and accepts',
          'They appear in Suppliers book or Customers book',
        ],
      },
      {
        name: 'Set pricing',
        href: '/dashboard/connections/pricing',
        summary: 'Agreed list prices flow into PO line pickers.',
        steps: [
          'Open Price under Network',
          'Create or import agreement with a connected company',
          'Activate list prices for products',
        ],
        tip: 'On Suppliers → Order, list prices appear as quick-add chips when linked.',
      },
    ],
    checklist: [
      'At least one live connection',
      'Pricing agreement for a key trade partner (optional but powerful)',
    ],
  },
  {
    slug: 'suppliers',
    moduleId: 'suppliers',
    title: 'Suppliers',
    tagline: 'Find, book, order — standard or escrow PO',
    purpose:
      'SRM path: discover trusted suppliers, maintain your book, raise purchase orders (standard or on-chain escrow), and score delivery.',
    who: ['Buyer', 'Procurement', 'Ops'],
    flow: [
      { id: 'a', label: 'Find', hint: 'Discover', tone: 'cyan' },
      { id: 'b', label: 'Book', hint: 'My network', tone: 'slate' },
      { id: 'c', label: 'Invite', hint: 'Pending links', tone: 'violet' },
      { id: 'd', label: 'Order', hint: 'Standard / escrow', tone: 'emerald' },
      { id: 'e', label: 'Score', hint: 'OTIFEF', tone: 'amber' },
      { id: 'f', label: 'Rate', hint: 'Reviews', tone: 'rose' },
    ],
    processes: [
      {
        name: 'Raise a standard PO',
        href: '/dashboard/suppliers/po',
        summary: 'Off-chain PO: send, accept, record delivery, rate. No wallet required.',
        steps: [
          'Suppliers → Order',
          'Select a connected supplier and line items',
          'Choose type: Standard PO',
          'Send standard PO (or Save draft)',
          'Track in pipeline; record delivery for OTIFEF',
        ],
      },
      {
        name: 'Raise an escrow PO',
        href: '/dashboard/suppliers/po',
        summary: 'On-chain funds lock until delivery confirm. Wallet + supplier 0x required.',
        steps: [
          'Connect wallet on the PO page',
          'Choose Escrow PO · USDC (recommended) or ETH (dev)',
          'Enter supplier wallet (0x…)',
          'Send escrow PO → confirm createPO in wallet',
          'Fund → supplier markShipped → buyer confirmDelivery',
        ],
        tip: 'Roles allowed for on-chain attach: owner, admin, finance, operations.',
      },
      {
        name: 'Score supplier performance',
        href: '/dashboard/suppliers/performance',
        summary: 'OTIFEF uses delivery capture from completed POs.',
        steps: [
          'Record actual delivery on the PO',
          'Open Score to review OTIFEF',
          'Rate quality / delivery / communication under Rate',
        ],
      },
    ],
    concepts: [
      { term: 'Standard PO', meaning: 'Commercial document only — no chain funds.' },
      { term: 'Escrow PO', meaning: 'Same commercial PO + client-signed on-chain lifecycle.' },
      { term: 'OTIFEF', meaning: 'On-time, in-full, error-free style delivery performance.' },
    ],
    checklist: [
      'Supplier connected on-platform',
      'One standard PO completed end-to-end',
      'Optional: one escrow demo on testnet',
    ],
  },
  {
    slug: 'customers',
    moduleId: 'customers',
    title: 'Customers',
    tagline: 'Lead → quote → order → invoice → claim',
    purpose:
      'CRM and commercial pipeline for demand-side work. Keep the funnel tight: lead, quote, convert, fulfill cash, handle claims.',
    who: ['Sales', 'Account managers', 'Finance (invoices)'],
    flow: [
      { id: 'a', label: 'Lead', hint: 'Opportunity', tone: 'violet' },
      { id: 'b', label: 'Add', hint: 'Onboard', tone: 'cyan' },
      { id: 'c', label: 'Quote', hint: 'Offer', tone: 'emerald' },
      { id: 'd', label: 'Order', hint: 'Confirm', tone: 'amber' },
      { id: 'e', label: 'Invoice', hint: 'Bill', tone: 'cyan' },
      { id: 'f', label: 'Claim', hint: 'Exceptions', tone: 'rose' },
    ],
    processes: [
      {
        name: 'Win a deal',
        href: '/dashboard/customers/leads',
        summary: 'Capture opportunity, quote, convert to order and invoice.',
        steps: [
          'Lead — create opportunity with contact',
          'Quote — commercial offer with lines',
          'Order — convert when customer accepts',
          'Invoice — bill and push into accounting AR',
        ],
      },
      {
        name: 'Handle a claim',
        href: '/dashboard/customers/claims',
        summary: 'Quality or delivery exceptions stay linked to the commercial story.',
        steps: [
          'Open Claim with order reference',
          'Document evidence (lots, photos, notes)',
          'Resolve commercially and update QA if needed',
        ],
      },
    ],
    checklist: [
      'Customer profile exists',
      'One quote → order path practiced',
      'Know where invoices land in Finance',
    ],
  },
  {
    slug: 'inventory',
    moduleId: 'inventory',
    title: 'Inventory',
    tagline: 'Catalog, stock, receive, move, count, lots',
    purpose:
      'Physical truth of what you hold. Lots feed quality holds and recalls. Transfers ship between warehouses with QA gates.',
    who: ['Warehouse', 'Ops', 'Quality'],
    flow: [
      { id: 'a', label: 'Catalog', hint: 'Products', tone: 'slate' },
      { id: 'b', label: 'Stock', hint: 'On hand', tone: 'cyan' },
      { id: 'c', label: 'Receive', hint: 'Scan in', tone: 'emerald' },
      { id: 'd', label: 'Move', hint: 'Transfer', tone: 'violet' },
      { id: 'e', label: 'Count', hint: 'Cycle', tone: 'amber' },
      { id: 'f', label: 'Lots', hint: 'Pedigree', tone: 'rose' },
    ],
    processes: [
      {
        name: 'Receive stock with a lot',
        href: '/dashboard/inventory/scan',
        summary: 'Inbound goods should always carry a lot for QA and recall.',
        steps: [
          'Inventory → Receive',
          'Product, warehouse, qty, lot number',
          'If QA open on that lot, stock can still receive with a warning',
          'Open Quality → Inspect when sampling is required',
        ],
      },
      {
        name: 'Transfer / ship between sites',
        href: '/dashboard/inventory/stock-transfers',
        summary: 'Ship deducts source; receive adds destination. QA holds block ship.',
        steps: [
          'Create draft transfer with lines + lots',
          'Ship — blocked if lot has open/failed inspection',
          'Owner/admin may override hold (audited) if policy allows',
          'Receive at destination to complete',
        ],
        tip: 'Clear inspections before ship whenever possible — overrides are exceptional.',
      },
    ],
    checklist: [
      'Products and warehouses defined',
      'One receive with lot number',
      'One transfer ship/receive cycle',
    ],
  },
  {
    slug: 'operations',
    moduleId: 'operations',
    title: 'Operations',
    tagline: 'Inbound → store → make → outbound → fulfill → fix',
    purpose:
      'Control tower for end-to-end physical flow. Use it to see exceptions and jump into the right workbench.',
    who: ['COO / ops leads', 'Shift supervisors'],
    flow: [
      { id: 'a', label: 'Inbound', hint: 'Goods in', tone: 'cyan' },
      { id: 'b', label: 'Store', hint: 'Warehouse', tone: 'slate' },
      { id: 'c', label: 'Make', hint: 'Production', tone: 'violet' },
      { id: 'd', label: 'Outbound', hint: 'Dispatch', tone: 'emerald' },
      { id: 'e', label: 'Fulfill', hint: 'Customer orders', tone: 'amber' },
      { id: 'f', label: 'Fix', hint: 'Exceptions', tone: 'rose' },
    ],
    processes: [
      {
        name: 'Run the daily board',
        href: '/dashboard/operations',
        summary: 'Start at Overview, chase red items in Fix, deep-link into Inventory / Make / Ship.',
        steps: [
          'Operations → Overview telemetry',
          'Fix — open exceptions',
          'Inbound / Outbound for today’s movements',
          'Fulfill customer orders due',
        ],
      },
    ],
    checklist: [
      'Know which sub-step owns your bottleneck',
      'Exceptions reviewed daily',
    ],
  },
  {
    slug: 'make',
    moduleId: 'manufacturing',
    title: 'Make',
    tagline: 'Plan, explode, BOM, run work orders, cells',
    purpose:
      'Turn demand into manufacturing work: master schedule, MRP, bills of materials, work orders on cells.',
    who: ['Production planners', 'Plant managers'],
    flow: [
      { id: 'a', label: 'Plan', hint: 'MPS', tone: 'cyan' },
      { id: 'b', label: 'Explode', hint: 'MRP', tone: 'violet' },
      { id: 'c', label: 'BOM', hint: 'Recipe', tone: 'slate' },
      { id: 'd', label: 'Run', hint: 'Work orders', tone: 'emerald' },
      { id: 'e', label: 'Cells', hint: 'Capacity', tone: 'amber' },
    ],
    processes: [
      {
        name: 'Release a work order',
        href: '/dashboard/manufacturing/production-orders',
        summary: 'BOM + cell + schedule → release and track hold/progress.',
        steps: [
          'Ensure BOM exists for the product',
          'Plan MPS demand if used',
          'Explode MRP for material needs',
          'Run — create/release work order on a cell',
        ],
      },
    ],
    checklist: ['BOM for a key SKU', 'One work order lifecycle practiced'],
  },
  {
    slug: 'ship',
    moduleId: 'distribution',
    title: 'Ship',
    tagline: 'Inbound/outbound logistics, track, carrier, fleet',
    purpose:
      'Distribution moves product outside the four walls: carriers, fleet, tracking, and logistics legs.',
    who: ['Logistics', 'Fleet coordinators'],
    flow: [
      { id: 'a', label: 'Inbound', hint: 'Legs in', tone: 'cyan' },
      { id: 'b', label: 'Outbound', hint: 'Legs out', tone: 'emerald' },
      { id: 'c', label: 'Track', hint: 'Live status', tone: 'violet' },
      { id: 'd', label: 'Carrier', hint: 'Partners', tone: 'slate' },
      { id: 'e', label: 'Fleet', hint: 'Own assets', tone: 'amber' },
    ],
    processes: [
      {
        name: 'Track a movement',
        href: '/dashboard/distribution/tracking',
        summary: 'Use Track for live status; pair with Inventory transfers for stock truth.',
        steps: [
          'Create outbound/inbound logistics record',
          'Assign carrier or fleet',
          'Monitor Track until delivered',
          'Close warehouse receive if stock lands',
        ],
      },
    ],
    checklist: ['Carrier or fleet defined', 'One tracked outbound'],
  },
  {
    slug: 'containers',
    moduleId: 'containers',
    title: 'Containers',
    tagline: 'Manage outlets, map, staff, score',
    purpose:
      'Physical container / micro-outlet network: where they are, who runs them, how they perform.',
    who: ['Network ops', 'Franchise / outlet managers'],
    flow: [
      { id: 'a', label: 'Manage', hint: 'List', tone: 'slate' },
      { id: 'b', label: 'Map', hint: 'Geo', tone: 'cyan' },
      { id: 'c', label: 'Add', hint: 'Onboard', tone: 'emerald' },
      { id: 'd', label: 'Staff', hint: 'Contractors', tone: 'violet' },
      { id: 'e', label: 'Score', hint: 'Metrics', tone: 'amber' },
    ],
    processes: [
      {
        name: 'Add and place a container',
        href: '/dashboard/containers/add',
        summary: 'Register asset, put it on the map, assign operators.',
        steps: [
          'Containers → Add',
          'Set location so Map shows it',
          'Staff — link contractors',
          'Score — review metrics over time',
        ],
      },
    ],
    checklist: ['At least one container on the map', 'Operator assigned'],
  },
  {
    slug: 'quality',
    moduleId: 'quality',
    title: 'Quality',
    tagline: 'Inspect → HACCP → trace → recall → export',
    purpose:
      'Food-safety and release gates. Open/failed inspections hold lots; ship respects those holds. Regulatory packs export evidence.',
    who: ['QA', 'Food safety', 'Compliance'],
    flow: [
      { id: 'a', label: 'Inspect', hint: 'Pass / fail', tone: 'amber' },
      { id: 'b', label: 'HACCP', hint: 'CCP logs', tone: 'emerald' },
      { id: 'c', label: 'Trace', hint: 'Pedigree graph', tone: 'cyan' },
      { id: 'd', label: 'Recall', hint: 'Drill', tone: 'rose' },
      { id: 'e', label: 'Export', hint: 'Audit pack', tone: 'violet' },
    ],
    processes: [
      {
        name: 'Release path (hero flow)',
        href: '/dashboard/quality/inspections',
        summary: 'Receive → inspect → hold/clear → ship → export pack.',
        steps: [
          'Inventory → Receive with lot',
          'Quality → Inspect — create open check on that lot',
          'Pass & release or Fail / hold',
          'Inventory → Move — ship blocked while held',
          'Export regulatory pack for auditors',
        ],
        tip: 'Action centre surfaces open/failed QA so holds never hide.',
      },
      {
        name: 'Recall drill',
        href: '/dashboard/quality/recall-simulator',
        summary: 'Search a lot; see inventory, holds, HACCP breaches before you need it live.',
        steps: [
          'Recall — enter lot number',
          'Review pedigree and open holds',
          'Practice communication list from graph nodes',
        ],
      },
    ],
    checklist: [
      'One inspection pass and one fail practiced',
      'Know where ship blocks show QA_HOLD',
      'Exported one regulatory pack',
    ],
  },
  {
    slug: 'finance',
    moduleId: 'accounting',
    title: 'Finance',
    tagline: 'Chart, post, collect, pay, bank, report, close',
    purpose:
      'Books of record: chart of accounts, journals, AR/AP, bank allocation, reports, and period locks.',
    who: ['Finance', 'Owner', 'Admin'],
    flow: [
      { id: 'a', label: 'Chart', hint: 'CoA', tone: 'slate' },
      { id: 'b', label: 'Post', hint: 'Journals', tone: 'cyan' },
      { id: 'c', label: 'Collect', hint: 'AR', tone: 'emerald' },
      { id: 'd', label: 'Pay', hint: 'AP', tone: 'violet' },
      { id: 'e', label: 'Bank', hint: 'Allocate', tone: 'amber' },
      { id: 'f', label: 'Manage', hint: 'Mgmt accounts', tone: 'violet' },
      { id: 'g', label: 'VAT', hint: 'Return box', tone: 'amber' },
      { id: 'h', label: 'Report', hint: 'P&L / TB', tone: 'cyan' },
      { id: 'i', label: 'Close', hint: 'Period lock', tone: 'rose' },
    ],
    processes: [
      {
        name: 'Allocate a bank line',
        href: '/dashboard/accounting/bank-reconciliation',
        summary: 'Import or sync bank → allocate to GL or match invoice.',
        steps: [
          'Bank — import PDF/CSV or sync feed',
          'Allocate / auto-match',
          'Review unmatched in Action centre',
        ],
      },
      {
        name: 'Review management accounts',
        href: '/dashboard/accounting/management',
        summary: 'Slice-and-dice management pack — P&L-style views, ratios, and period slicers for leadership.',
        steps: [
          'Finance → Manage',
          'Pick period range with the slicer',
          'Review visual pack and key ratios',
          'Drill to Report for full statements when needed',
        ],
        tip: 'Bank allocations and posted journals feed these numbers — keep bank and Post current first.',
      },
      {
        name: 'Close a period',
        href: '/dashboard/accounting/settings',
        summary: 'Owner/admin/finance only. Unbalanced TB can block lock.',
        steps: [
          'Report — check trial balance',
          'Close — period close checklist',
          'Lock month — journals cannot post into locked period',
          'Audit feed records who locked',
        ],
        tip: 'Viewers can read but cannot lock — UI explains role limits.',
      },
    ],
    concepts: [
      { term: 'Period lock', meaning: 'Hard stop on posting into a closed month.' },
      { term: 'Service role + API auth', meaning: 'Browser never talks to DB with open RLS for tenants; APIs gate membership.' },
    ],
    checklist: [
      'CoA seeded',
      'One journal posted',
      'One bank allocation',
      'Know who can lock periods',
    ],
  },
  {
    slug: 'projects',
    moduleId: 'projects',
    title: 'Projects',
    tagline: 'Plan, board, gate, log time, risk',
    purpose: 'Initiatives that are not pure ERP transactions — portfolio, kanban, milestones, timesheets, risks.',
    who: ['PMO', 'Cross-functional leads'],
    flow: [
      { id: 'a', label: 'Plan', hint: 'Portfolio', tone: 'violet' },
      { id: 'b', label: 'Board', hint: 'Kanban', tone: 'cyan' },
      { id: 'c', label: 'Gate', hint: 'Milestones', tone: 'emerald' },
      { id: 'd', label: 'Log', hint: 'Time', tone: 'amber' },
      { id: 'e', label: 'Risk', hint: 'Register', tone: 'rose' },
    ],
    processes: [
      {
        name: 'Run a project week',
        href: '/dashboard/projects/kanban-boards',
        summary: 'Board for work-in-progress; Gate for stage decisions; Log hours against the project.',
        steps: [
          'Plan — confirm portfolio health',
          'Board — move cards',
          'Gate — mark milestone complete',
          'Log — timesheets',
          'Risk — update register',
        ],
      },
    ],
    checklist: ['One project with board + milestone'],
  },
  {
    slug: 'impact',
    moduleId: 'sustainability',
    title: 'Impact',
    tagline: 'Measure carbon, report ESG packs',
    purpose:
      'Honest sustainability lite: estimate CO₂e from distribution, export ESG-style packs from live ops data — no greenwash.',
    who: ['ESG owners', 'Leadership'],
    flow: [
      { id: 'a', label: 'Measure', hint: 'Carbon', tone: 'emerald' },
      { id: 'b', label: 'Report', hint: 'ESG pack', tone: 'cyan' },
    ],
    processes: [
      {
        name: 'Estimate shipment carbon',
        href: '/dashboard/sustainability/carbon-tracking',
        summary: 'Factors × distance × weight style estimates from logistics you already record.',
        steps: [
          'Ensure distribution shipments exist',
          'Impact → Measure',
          'Review totals and method notes',
          'Report — export pack for stakeholders',
        ],
      },
    ],
    checklist: ['Understand estimate limits', 'Export one pack'],
  },
  {
    slug: 'insights',
    moduleId: 'intelligence',
    title: 'Insights',
    tagline: 'Pulse, forecast, score, lead',
    purpose:
      'Decision support on top of live data — pulse dashboards, forecasts, scorecards, leadership Super-Cube views.',
    who: ['Leadership', 'Analysts'],
    flow: [
      { id: 'a', label: 'Pulse', hint: 'Now', tone: 'cyan' },
      { id: 'b', label: 'Forecast', hint: 'Ahead', tone: 'violet' },
      { id: 'c', label: 'Score', hint: 'KPIs', tone: 'emerald' },
      { id: 'd', label: 'Lead', hint: 'Super-Cube', tone: 'amber' },
    ],
    processes: [
      {
        name: 'Weekly leadership review',
        href: '/dashboard/intelligence/pulse-dashboard',
        summary: 'Pulse for exceptions; Forecast for capacity/demand; Score for OTIFEF/QA; Lead for development narrative.',
        steps: [
          'Pulse — what is red today',
          'Forecast — where demand is going',
          'Score — supplier and ops KPIs',
          'Lead — Super-Cube conversation',
        ],
      },
    ],
    checklist: ['Bookmark Pulse', 'Know which scorecard is source of truth'],
  },
  {
    slug: 'sales',
    moduleId: 'sales-portal',
    title: 'Sales portal',
    tagline: 'Independent contractor sell path',
    purpose:
      'Limited role workspace for sales contractors: pipeline and documents without full ERP access.',
    who: ['Sales contractor'],
    flow: [
      { id: 'a', label: 'Sell', hint: 'Home', tone: 'violet' },
      { id: 'b', label: 'Pipeline', hint: 'Deals', tone: 'cyan' },
      { id: 'c', label: 'Quote', hint: 'Offer', tone: 'emerald' },
      { id: 'd', label: 'Order', hint: 'Win', tone: 'amber' },
      { id: 'e', label: 'Invoice', hint: 'Bill', tone: 'slate' },
      { id: 'f', label: 'Earn', hint: 'Commission', tone: 'emerald' },
    ],
    processes: [
      {
        name: 'Contractor day path',
        href: '/sales',
        summary: 'Contractors only see Sales module. Company still owns CRM data.',
        steps: [
          'Sell — command centre',
          'Pipeline — advance stages',
          'Quote / Order / Invoice as allowed',
          'Earn — commission view',
          'Subscribe / Agreement when required',
        ],
      },
    ],
    checklist: ['Agreement understood', 'Pipeline hygiene weekly'],
  },
  {
    slug: 'action-centre',
    title: 'Action centre',
    tagline: 'Live signals next to the process rail',
    purpose:
      'The bell on the sticky top rail aggregates holds, unmatched bank, open POs, period locks, and sync errors — so you act without hunting modules.',
    who: ['Everyone'],
    flow: [
      { id: 'a', label: 'Scan', hint: 'Open bell', tone: 'amber' },
      { id: 'b', label: 'Jump', hint: 'Follow href', tone: 'cyan' },
      { id: 'c', label: 'Clear', hint: 'Resolve source', tone: 'emerald' },
    ],
    processes: [
      {
        name: 'Triage the morning',
        summary: 'Critical and warning badges first; info items later.',
        steps: [
          'Open Actions on the top rail',
          'Clear QA fails and bank errors first',
          'Work open POs and period-lock notices',
          'Refresh — list is derived from live data (no separate inbox table)',
        ],
      },
    ],
    checklist: ['Know what turns the red badge on', 'Never leave failed QA unowned'],
  },
  {
    slug: 'roles-security',
    title: 'Roles & security',
    tagline: 'JWT membership, permissions, audit',
    purpose:
      'APIs verify Privy access tokens, check company membership, then use service-role Supabase. Sensitive writes need roles (period lock, escrow, QA override).',
    who: ['Owner', 'Admin', 'IT'],
    flow: [
      { id: 'a', label: 'Auth', hint: 'Privy JWT', tone: 'slate' },
      { id: 'b', label: 'Member', hint: 'business_users', tone: 'cyan' },
      { id: 'c', label: 'Permit', hint: 'Role matrix', tone: 'violet' },
      { id: 'd', label: 'Act', hint: 'API write', tone: 'emerald' },
      { id: 'e', label: 'Audit', hint: 'activity_log', tone: 'amber' },
    ],
    processes: [
      {
        name: 'Understand a 403',
        href: '/dashboard/accounting/settings',
        summary: 'UI banners explain when your role cannot lock or ship-override.',
        steps: [
          'Check role under Company → Team',
          'Finance critical: owner / admin / finance',
          'QA override ship: owner / admin only',
          'Escrow attach: owner / admin / finance / operations',
          'Review audit under Finance → Close',
        ],
      },
    ],
    concepts: [
      { term: 'AUTH_STRICT', meaning: 'Production requires Bearer tokens on APIs.' },
      { term: 'Audit feed', meaning: 'Soft-written activity_log for critical mutations.' },
    ],
    checklist: [
      'Team roles documented for your org',
      'No shared owner accounts',
    ],
  },
];

export function getGuideSection(slug: string): GuideSection | undefined {
  return GUIDE_SECTIONS.find((s) => s.slug === slug);
}

export function guideIndex() {
  return GUIDE_SECTIONS.map((s) => ({
    slug: s.slug,
    title: s.title,
    tagline: s.tagline,
    moduleId: s.moduleId,
  }));
}
