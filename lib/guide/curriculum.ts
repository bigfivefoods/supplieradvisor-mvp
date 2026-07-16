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
  /** Design principles for this module */
  principles?: Array<{ title: string; body: string }>;
  /** Outcomes after training */
  outcomes?: string[];
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
  /** Related guide slugs */
  related?: string[];
};

/** OS-wide design principles (shown on guide home) */
export const OS_PRINCIPLES = [
  {
    title: 'Company-scoped always',
    body: 'Every screen and API is bound to the selected company. Wrong company → empty data. Switch workspace first.',
  },
  {
    title: 'Network before trade',
    body: 'Linked platform companies unlock catalogues, pricing agreements, and POs. Free-text is fallback—not the integration story.',
  },
  {
    title: 'Catalogue direction matters',
    body: 'Buy: pick from the supplier’s sellable products. Sell: pick from your finished goods. Never reverse that mental model.',
  },
  {
    title: 'Physical truth first',
    body: 'Lots, holds, and transfers beat spreadsheet stock. Ship is blocked when QA fails—by design.',
  },
  {
    title: 'Money follows commerce',
    body: 'Quotes → orders → invoices → bank allocation → journals → period lock. Don’t post inventively around the flow.',
  },
  {
    title: 'Trust is a loop',
    body: 'OTIFEF (objective) + peer ratings (subjective) after delivery. Trust packs and scorecards make reputation portable.',
  },
  {
    title: 'Roles over hero accounts',
    body: 'Owner / admin / finance / ops / sales / viewer. Period lock, QA override, and company delete are intentionally gated.',
  },
  {
    title: 'Honest roadmap',
    body: 'Live modules have real APIs. Coming-soon screens bridge without over-claiming ESG or PM depth.',
  },
];

export const SYSTEM_OVERVIEW = {
  title: 'How SupplierAdvisor works',
  subtitle:
    'The world’s most trusted supply-chain OS — one company workspace, a verified network, physical ops, money, quality, and insight on one canvas.',
  pillars: [
    {
      title: 'Identity',
      body: 'You sign in, pick a company, and your role (owner, finance, operations…) unlocks the right modules. Owners can soft-delete a company from Settings.',
    },
    {
      title: 'Network',
      body: 'Companies connect as suppliers and customers. Pricing agreements and sellable catalogues ride on those links.',
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
      body: 'QA inspections, HACCP, OTIFEF scores, peer ratings, and RIAD risks keep the story auditable.',
    },
    {
      title: 'Activation',
      body: 'Golden path (3 days), founding free cohort (first 25), billing trial/prepaid, and SAM for in-app how-to.',
    },
  ],
  layers: [
    {
      name: 'Identity & access',
      body: 'Privy auth · company select · roles · settings · soft-delete · founding / billing',
      tone: 'slate',
    },
    {
      name: 'Network graph',
      body: 'Connections · invites · pricing agreements · marketplace · discoverability',
      tone: 'cyan',
    },
    {
      name: 'Trade (buy & sell)',
      body: 'Supplier catalogue POs · inbound accept · quotes/orders/invoices from your products',
      tone: 'violet',
    },
    {
      name: 'Physical ops',
      body: 'Inventory lots · transfers · make · ship · containers · ops control tower',
      tone: 'emerald',
    },
    {
      name: 'Assure & account',
      body: 'QA holds · OTIFEF · bank · journals · period lock · trust pack',
      tone: 'amber',
    },
    {
      name: 'Insight & leadership',
      body: 'Pulse · forecast · score · Super-Cube · SAM · Action centre bell',
      tone: 'rose',
    },
  ],
  masterFlow: [
    { id: '1', label: 'Company', hint: 'Select workspace', tone: 'slate' as const },
    { id: '2', label: 'Connect', hint: 'Network & partners', tone: 'cyan' as const },
    { id: '3', label: 'Buy / Sell', hint: 'Catalogue POs & CRM', tone: 'violet' as const },
    { id: '4', label: 'Move', hint: 'Receive · make · ship', tone: 'emerald' as const },
    { id: '5', label: 'Assure', hint: 'QA · hold · release', tone: 'amber' as const },
    { id: '6', label: 'Account', hint: 'Bank · post · close', tone: 'cyan' as const },
    { id: '7', label: 'Trust', hint: 'OTIFEF · rate', tone: 'rose' as const },
    { id: '8', label: 'Learn', hint: 'Pulse · SAM', tone: 'violet' as const },
  ],
};

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    slug: 'golden-path',
    moduleId: 'my-business',
    title: 'Get live in 3 days',
    tagline: 'Golden path — profile → partners → trade → rate → billing',
    purpose:
      'New companies get a measurable activation path on the dashboard. Steps auto-complete when you do real work (save profile, invite partners, create a quote/PO, rate a peer, open billing). Founding free seats (first 25) apply automatically when eligible.',
    who: ['Owner', 'Admin', 'Anyone onboarding a new workspace'],
    principles: [
      {
        title: 'Do real work, don’t tick boxes',
        body: 'Auto-complete fires from live mutations (profile save, invites, PO, rate). Manual Mark done is emergency only.',
      },
      {
        title: 'Three partners beats one',
        body: 'First partner unlocks Day 2; three partners complete the network goal and deepen the trade graph.',
      },
      {
        title: 'Trade before polish',
        body: 'One quote or PO on Day 3 is worth more than perfect branding. Billing visit clarifies the commercial plan.',
      },
    ],
    outcomes: [
      'Company is discoverable and staffed',
      'At least one network edge exists',
      'One commercial document or PO created',
      'Trust loop and billing are visible',
    ],
    flow: [
      { id: 'd1a', label: 'Profile', hint: 'Day 1', tone: 'cyan' },
      { id: 'd1b', label: 'Team', hint: 'Day 1', tone: 'violet' },
      { id: 'd2', label: 'Partners', hint: 'Day 2', tone: 'emerald' },
      { id: 'd3a', label: 'Trade', hint: 'Day 3', tone: 'amber' },
      { id: 'd3b', label: 'Rate', hint: 'Day 3', tone: 'rose' },
      { id: 'd3c', label: 'Billing', hint: 'Day 3', tone: 'slate' },
    ],
    processes: [
      {
        name: 'Day 1 — Identity & team',
        href: '/dashboard/my-business/profile',
        summary: 'Make the company findable and staffed.',
        steps: [
          'Company → Profile — trading name, industry, contacts (completeness ≥ 60% auto-ticks)',
          'Company → Team — invite at least one colleague',
          'Return to Dashboard — golden path shows Auto badges when detected',
        ],
        tip: 'Dismiss hides the card; use Sync from activity to re-check progress.',
      },
      {
        name: 'Day 2 — Trading partners',
        href: '/dashboard/invite-business',
        summary: 'Grow the verified network you actually trade with.',
        steps: [
          'Invite business / Invite supplier / Customers onboard',
          'Or accept an incoming connection in Network',
          'First partner ticks Day 2 “first partner”; three partners completes the network goal',
        ],
      },
      {
        name: 'Day 3 — First trade, rate, billing',
        href: '/dashboard/customers/quotes',
        summary: 'Commerce + trust loop + plan clarity.',
        steps: [
          'Create a quote, sales order, invoice, or purchase order',
          'After delivery/paid events, rate the partner (or open Ratings from the amber banner)',
          'Company → Billing — review trial / prepaid (visit marks the step)',
        ],
        tip: 'Rating prompts appear on the dashboard after PO delivered, invoice paid, shipment delivered, or connection accept.',
      },
    ],
    concepts: [
      {
        term: 'Golden path',
        meaning: 'Six steps across three days that get a company operational without a manual.',
      },
      {
        term: 'Auto vs Mark done',
        meaning: 'Auto means the platform inferred the step from live data; Mark done is manual override.',
      },
      {
        term: 'Trust loop',
        meaning: 'Suppliers and customers rate each other after trade; OTIFEF is objective PO performance.',
      },
    ],
    checklist: [
      'Profile saved with trading name',
      'At least one partner invited or connected',
      'One quote or PO created',
      'Billing page opened once',
    ],
  },
  {
    slug: 'company',
    moduleId: 'my-business',
    title: 'Company',
    tagline: 'Your workspace identity, team, and controls',
    purpose:
      'Everything in SupplierAdvisor is company-scoped. Profile, team roles, billing, documents, risk logs, and Settings (including owner soft-delete) define who you are and who can act.',
    who: ['Owner', 'Admin', 'Anyone setting up a new workspace'],
    principles: [
      {
        title: 'One active workspace',
        body: 'Switch company before troubleshooting empty modules. Data never crosses company boundaries.',
      },
      {
        title: 'Least privilege',
        body: 'Finance locks periods; ops runs ships; viewers read. Don’t share the owner login.',
      },
      {
        title: 'Delete is soft and rare',
        body: 'Owners can soft-delete from Settings (name + type DELETE). History stays for audit; membership dies.',
      },
    ],
    outcomes: [
      'Profile completeness high enough for discovery',
      'Team roles match real jobs',
      'Billing / founding status understood',
    ],
    flow: [
      { id: 'a', label: 'Select', hint: 'Pick company', tone: 'slate' },
      { id: 'b', label: 'Profile', hint: 'Trading identity', tone: 'cyan' },
      { id: 'c', label: 'Team', hint: 'Roles & invites', tone: 'violet' },
      { id: 'd', label: 'Billing', hint: 'Trial / founding', tone: 'amber' },
      { id: 'e', label: 'Docs', hint: 'Certificates', tone: 'emerald' },
      { id: 'f', label: 'Risks', hint: 'RIAD log', tone: 'rose' },
      { id: 'g', label: 'Settings', hint: 'Prefs · delete', tone: 'slate' },
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
        name: 'Billing, trial & founding free',
        href: '/dashboard/my-business/billing',
        summary: 'Trial starts on first visit; earliest 25 companies may auto-grant free-for-life.',
        steps: [
          'Company → Billing — review status and prepaid terms',
          'If founding-eligible, Refresh to claim free-for-life',
          'Paystack checkout for monthly or multi-year prepaid',
        ],
        tip: 'Founding seats use registration order — not waitlist alone. Ops can Grant lifetime from Founding waitlist.',
      },
      {
        name: 'Soft-delete a company (owner)',
        href: '/dashboard/my-business/settings',
        summary: 'Danger zone removes access; keeps audit history. Requires exact name + DELETE.',
        steps: [
          'Company → Settings → Danger zone',
          'Type the exact trading name',
          'Type DELETE and optional reason',
          'Confirm — you land on select-company; company vanishes from the list',
        ],
        tip: 'Requires migration 20260716_company_soft_delete.sql on the database.',
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
      { term: 'Soft-delete', meaning: 'deleted_at set; members deactivated; network hide; not a hard wipe.' },
    ],
    checklist: [
      'Company selected and profile complete',
      'At least one admin/owner active',
      'Team roles match real jobs',
      'Billing page visited once',
    ],
    related: ['golden-path', 'roles-security', 'network'],
  },
  {
    slug: 'network',
    moduleId: 'network',
    title: 'Network',
    tagline: 'Graph of companies, pricing, and marketplace',
    purpose:
      'The network is how two companies become able to trade. Pricing agreements and marketplace listings sit on top of connections. Without a link, catalogues stay dark.',
    who: ['Commercial leads', 'Procurement', 'Sales'],
    principles: [
      {
        title: 'Connect before you commerce',
        body: 'Accepted connection (or SRM linked profile) is the gate for supplier catalogues and clean POs.',
      },
      {
        title: 'Price is a shared object',
        body: 'Agreements are bidirectional commercial truth—buyers see list chips on Order; sellers stay in control of list prices.',
      },
      {
        title: 'Invite is a product',
        body: 'Bring partners onto the platform; book-only free-text POs are a temporary bridge.',
      },
    ],
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
      'SRM path: discover trusted suppliers, maintain your book, raise purchase orders from the supplier’s catalogue (or free-text), track pipeline next-steps, record OTIFEF, and rate partners.',
    who: ['Buyer', 'Procurement', 'Ops'],
    principles: [
      {
        title: 'Buy their catalogue',
        body: 'PO lines load the linked supplier’s agreed list prices and sellable inventory (finished goods/services)—not your stock.',
      },
      {
        title: 'Free-text is fallback',
        body: 'Custom lines remain for exceptions. Empty catalogue? Connect them or ask them to publish products / share pricing.',
      },
      {
        title: 'Close the loop',
        body: 'Send → wait accept → Receive+OTIFEF → Rate. Pipeline cards tell you the next step.',
      },
    ],
    outcomes: [
      'Linked supplier with sellable products or price list',
      'One standard PO accepted and received',
      'OTIFEF + rating recorded',
    ],
    flow: [
      { id: 'a', label: 'Find', hint: 'Discover', tone: 'cyan' },
      { id: 'b', label: 'Book', hint: 'My network', tone: 'slate' },
      { id: 'c', label: 'Invite', hint: 'Pending links', tone: 'violet' },
      { id: 'd', label: 'Order', hint: 'Catalogue PO', tone: 'emerald' },
      { id: 'e', label: 'Accept', hint: 'Supplier inbox', tone: 'amber' },
      { id: 'f', label: 'Receive', hint: 'OTIFEF', tone: 'cyan' },
      { id: 'g', label: 'Rate', hint: 'Trust', tone: 'rose' },
    ],
    processes: [
      {
        name: 'Raise a standard PO from supplier catalogue',
        href: '/dashboard/suppliers/po',
        summary: 'Off-chain PO: pick their products, send, wait for accept, receive, rate. No wallet required.',
        steps: [
          'Suppliers → Order · select a linked supplier',
          'Supplier catalogue panel: search agreed list + their inventory',
          'Add lines (or Custom free text) · promised date · currency',
          'Send standard PO (not draft)',
          'Pipeline shows next step: wait for accept',
        ],
        tip: 'Empty catalogue soft-emails the supplier to publish finished goods (once per session).',
      },
      {
        name: 'Receive + OTIFEF + rate',
        href: '/dashboard/suppliers/po',
        summary: 'One-tap receive defaults delivered qty to ordered; complete and jump to rate.',
        steps: [
          'Pipeline → Receive + OTIFEF on accepted/sent PO',
          'Fill = ordered for in-full · set actual date · damaged qty',
          'Complete OTIFEF + rate supplier (deep-link) or Save OTIFEF only',
          'Score card under Performance uses the same delivery fields',
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
        tip: 'Roles for on-chain attach: owner, admin, finance, operations.',
      },
    ],
    concepts: [
      { term: 'Supplier catalogue', meaning: 'Agreed pricing lines + supplier sellable products exposed to you as buyer.' },
      { term: 'Standard PO', meaning: 'Commercial document only — no chain funds.' },
      { term: 'Escrow PO', meaning: 'Same commercial PO + client-signed on-chain lifecycle.' },
      { term: 'OTIFEF', meaning: 'On-time, in-full, error-free delivery performance from capture fields.' },
    ],
    checklist: [
      'Supplier connected on-platform',
      'One catalogue-based PO sent',
      'Supplier accepted (or you practiced free-text)',
      'OTIFEF + rate completed once',
    ],
    related: ['network', 'customers', 'quality', 'action-centre'],
  },
  {
    slug: 'customers',
    moduleId: 'customers',
    title: 'Customers',
    tagline: 'Lead → quote → order → invoice → claim',
    purpose:
      'CRM and commercial pipeline for demand-side work. Keep the funnel tight: lead, quote (your catalogue), convert, fulfill cash, inbound POs when you are the seller, handle claims.',
    who: ['Sales', 'Account managers', 'Finance (invoices)', 'Ops (inbound POs)'],
    principles: [
      {
        title: 'Sell your catalogue',
        body: 'Quotes, orders, and invoices add lines from your sellable finished goods/services—search by type/SKU.',
      },
      {
        title: 'Inbound is the mirror of Order',
        body: 'When buyers raise POs against you, Customers → Inbound is your accept/decline and fulfilment cue board.',
      },
      {
        title: 'Cash closes the story',
        body: 'Invoice → AR → bank allocate. Claims stay linked to commercial docs and quality evidence.',
      },
    ],
    outcomes: [
      'Customer onboarded',
      'Quote from finished goods',
      'Inbound PO accepted once (as seller)',
    ],
    flow: [
      { id: 'a', label: 'Lead', hint: 'Opportunity', tone: 'violet' },
      { id: 'b', label: 'Add', hint: 'Onboard', tone: 'cyan' },
      { id: 'c', label: 'Quote', hint: 'Your products', tone: 'emerald' },
      { id: 'd', label: 'Order', hint: 'Confirm', tone: 'amber' },
      { id: 'e', label: 'Inbound', hint: 'Accept PO', tone: 'amber' },
      { id: 'f', label: 'Invoice', hint: 'Bill', tone: 'cyan' },
      { id: 'g', label: 'Claim', hint: 'Exceptions', tone: 'rose' },
    ],
    processes: [
      {
        name: 'Win a deal with catalogue lines',
        href: '/dashboard/customers/quotes',
        summary: 'Capture opportunity, quote from your finished goods, convert to order and invoice.',
        steps: [
          'Lead — create opportunity with contact',
          'Quote — Add from catalogue (search finished goods / services)',
          'Order — convert when customer accepts',
          'Invoice — bill and push into accounting AR',
        ],
        tip: 'Document currency re-prices product lines from catalogue when you change it.',
      },
      {
        name: 'Inbound PO inbox (you are the supplier)',
        href: '/dashboard/customers/orders?tab=inbound',
        summary: 'Accept, decline, mark paid/complete. Bell notifies awaiting-accept POs.',
        steps: [
          'Customers → Inbound (or Action centre badge)',
          'Open PO — review buyer, lines, promise date',
          'Accept (buyer is notified) or Decline',
          'Fulfil — prepare/ship; buyer will record OTIFEF',
        ],
        tip: 'Publish sellable products so buyers can pick lines instead of free-text only.',
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
      'One quote with catalogue lines',
      'Inbound path known (as seller)',
      'Know where invoices land in Finance',
    ],
    related: ['suppliers', 'inventory', 'finance', 'action-centre'],
  },
  {
    slug: 'inventory',
    moduleId: 'inventory',
    title: 'Inventory',
    tagline: 'Catalog, stock, receive, move, count, lots',
    purpose:
      'Physical truth of what you hold. Lots feed quality holds and recalls. Transfers ship between warehouses with QA gates. Sellable finished goods power customer quotes and network catalogues.',
    who: ['Warehouse', 'Ops', 'Quality', 'Commercial (catalogue)'],
    principles: [
      {
        title: 'Lots or regret',
        body: 'Receive with lot numbers whenever QA or recall matters. Pedigree starts at the dock.',
      },
      {
        title: 'Sellable flag is public face',
        body: 'is_sellable finished goods/services appear to connected buyers on POs and power your quotes.',
      },
      {
        title: 'Holds beat heroics',
        body: 'Open/failed inspections block ship. Override is audited and rare.',
      },
    ],
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
    tagline: 'Add → map → staff → stock → impact → share',
    purpose:
      'Retail container / micro-outlet network: GPS map, independent contractors, stock, food-security impact, and public embed.',
    who: ['Network ops', 'Franchise / outlet managers', 'Impact partners'],
    flow: [
      { id: 'a', label: 'Add', hint: 'Onboard', tone: 'emerald' },
      { id: 'b', label: 'Map', hint: 'GPS', tone: 'cyan' },
      { id: 'c', label: 'Staff', hint: 'Contractors', tone: 'violet' },
      { id: 'd', label: 'Stock', hint: 'Inventory', tone: 'amber' },
      { id: 'e', label: 'Impact', hint: 'Jobs & meals', tone: 'emerald' },
      { id: 'f', label: 'Share', hint: 'Embed', tone: 'slate' },
    ],
    processes: [
      {
        name: 'Add and place a container',
        href: '/dashboard/containers/add',
        summary: 'Register outlet, pin GPS, appear on live map.',
        steps: [
          'Containers → Add',
          'Set address + GPS so Map shows it',
          'Open outlet → Inventory when ready to stock',
        ],
      },
      {
        name: 'Appoint and verify an operator',
        href: '/dashboard/containers/contractors',
        summary: 'Invite contractor, VerifyNow ID, training status.',
        steps: [
          'Contractors — invite or appoint',
          'VerifyNow for SA ID when required',
          'Track training / certified on Training hub',
        ],
        tip: 'Resellers draw stock with dynamic commission — see Resellers.',
      },
      {
        name: 'Impact + public share',
        href: '/dashboard/containers/impact',
        summary: 'Jobs and people-fed metrics; embed map for partners.',
        steps: [
          'Impact — review jobs & people fed assumptions',
          'Feasibility — model a new region before deploy',
          'Settings → Share — public link / iframe for website',
        ],
      },
    ],
    checklist: [
      'At least one container on the map',
      'Operator assigned (or reseller path tried)',
      'Know where Share / embed link lives',
    ],
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
      'The bell on the sticky top rail aggregates holds, unmatched bank, open POs, inbound POs awaiting accept, period locks, rating prompts, and sync errors — so you act without hunting modules.',
    who: ['Everyone'],
    principles: [
      {
        title: 'Derived, not a second inbox',
        body: 'Signals are computed from live tables. Clearing the source clears the badge.',
      },
      {
        title: 'Critical first',
        body: 'QA fails and bank errors outrank info. Inbound POs and rating prompts keep the trade loop moving.',
      },
    ],
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
          'Inbound PO awaiting accept → Customers → Inbound',
          'Open buyer POs / period-lock notices / rating prompts',
          'Refresh — list is derived from live data (no separate inbox table)',
        ],
      },
    ],
    checklist: [
      'Know what turns the red badge on',
      'Never leave failed QA unowned',
      'Inbound PO path known if you sell',
    ],
  },
  {
    slug: 'sam',
    title: 'SAM · AI guide',
    tagline: 'Supplier Advisor Messenger (Grok) in the corner',
    purpose:
      'Floating Grok-powered assistant for how-to, navigation, and workflow coaching. Path-aware suggestion chips change on PO, inbound, quotes, and products screens.',
    who: ['Everyone learning the OS'],
    principles: [
      {
        title: 'SAM is how-to, not a second ERP',
        body: 'Ask where screens live and how processes run. Execute still happens in modules.',
      },
      {
        title: 'Context chips',
        body: 'On /suppliers/po, /customers/orders, inventory products, etc., chips suggest trade-loop questions.',
      },
    ],
    flow: [
      { id: 'a', label: 'Open', hint: 'Corner FAB', tone: 'cyan' },
      { id: 'b', label: 'Ask', hint: 'Chip or type', tone: 'violet' },
      { id: 'c', label: 'Act', hint: 'Follow links', tone: 'emerald' },
      { id: 'd', label: 'History', hint: 'Prior chats', tone: 'slate' },
    ],
    processes: [
      {
        name: 'Learn a module with SAM',
        summary: 'Open SAM on any dashboard page; use a chip; click /dashboard links in the reply.',
        steps: [
          'Click SAM (bottom-right)',
          'Pick a suggestion chip for the current page',
          'Follow Open links into the real workbench',
          'History tab to resume earlier coaching',
        ],
        tip: 'Requires XAI_API_KEY on the server. Health check: GET /api/sam/chat.',
      },
    ],
    concepts: [
      {
        term: 'SAM',
        meaning: 'Supplier Advisor Messenger — Grok via xAI Responses API.',
      },
    ],
    checklist: ['SAM opens and answers once', 'Used a path-specific chip'],
    related: ['golden-path', 'action-centre'],
  },
  {
    slug: 'roles-security',
    title: 'Roles & security',
    tagline: 'JWT membership, permissions, audit, delete',
    purpose:
      'APIs verify Privy access tokens, check company membership (and block soft-deleted companies), then use service-role Supabase. Sensitive writes need roles (period lock, escrow, QA override, company delete).',
    who: ['Owner', 'Admin', 'IT'],
    principles: [
      {
        title: 'Service role never in the browser',
        body: 'Tenant data is gated in Next.js APIs after Privy JWT + business_users checks.',
      },
      {
        title: 'Owner keys for irreversible-ish acts',
        body: 'Company soft-delete is owner-only with typed confirmation. Period lock is finance-critical roles.',
      },
    ],
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
          'Company delete: owner only (Settings → Danger zone)',
          'Review audit under Finance → Close',
        ],
      },
    ],
    concepts: [
      { term: 'AUTH_STRICT', meaning: 'Production requires Bearer tokens on APIs.' },
      { term: 'Audit feed', meaning: 'Soft-written activity_log for critical mutations.' },
      { term: '410 Gone', meaning: 'Membership APIs return 410 when the company is soft-deleted.' },
    ],
    checklist: [
      'Team roles documented for your org',
      'No shared owner accounts',
      'Know who can delete a company',
    ],
    related: ['company', 'action-centre'],
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
