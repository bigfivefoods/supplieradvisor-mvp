/**
 * Copy for the SupplierAdvisor® company profile. Nothing here is invented:
 * each block is lifted (lightly trimmed for print) from the source named above
 * it. Prices, trial days, referral rates, contact details and the industry
 * catalogue are NOT here; build.mjs reads them from lib/ so they stay in sync.
 *
 * Sources:
 *  [BFG]   bigfivegroup.africa/updates/supplieradvisor-system-for-empowerment (7 Oct 2026)
 *  [HOME]  components/marketing/HomeBelowFold.tsx, HeroAudienceStage.tsx,
 *          ComparePlatforms.tsx, ProductMocks.tsx, HomePricing.tsx (live home page)
 *  [PRICE] app/pricing/page.tsx + lib/marketing/pricing-plans.ts
 *  [SLA]   app/verification-sla (live /verification-sla)
 *  [JOIN]  live /join and /me
 *  [PRIV]  live /privacy
 *  [BFGP]  Big Five Group company profile (bigfivegroup-africa PR 49): KZN case-study scope
 */

// [BFG]
export const whatItIs =
  "SupplierAdvisor® is a supply-chain operating system built around a verified network of companies. It is designed to help African SMEs, suppliers and buyers do four things that decide whether a business grows: get found, get verified, get trusted and get paid.";

// [BFG]
export const fourVerbs = [
  { title: "Get found", body: "Company-to-company connections, marketplace reach and supplier discovery, so buyers who need exactly what you do can find you." },
  { title: "Get verified", body: "Company verification and certificate metadata let counterparties know who they are trading with." },
  { title: "Get trusted", body: "Buyers score every delivery on OTIFEF and peer ratings follow the relationship: a reputation you carry into the next deal." },
  { title: "Get paid", body: "POs, quotes, orders and invoices sit on the same books, with payments and accounts receivable in the same workspace." },
];

// [HOME] stats strip ("BUILT FOR OPERATORS ACROSS SECTORS")
export const stats = [
  { value: "14+", label: "Systems in one OS" },
  { value: "3", label: "Markets: B2B · B2G · B2C" },
  { value: "30d", label: "Full-platform trial" },
  { value: "1", label: "Workspace per company" },
  { value: "∞", label: "Team seats on the plan" },
];

// [BFG] "Why this matters to the Group"
export const whoWeAre =
  "Big Five Connect, part of the Empower side of Big Five Group™, runs SupplierAdvisor®. When an SME can be found, verified, trusted and paid, it can hire, grow and supply with confidence: empowerment in its most practical form, a fair chance to compete.";
export const pillars = [
  { k: "Feed", title: "Food on the plate", body: "Feed puts food on the plate." },
  { k: "Educate", title: "Big Five Learn", body: "Big Five Learn develops leaders." },
  { k: "Empower", title: "Big Five Connect", body: "Empower opens doors to opportunity. Big Five Connect runs SupplierAdvisor®.", us: true },
];

// [HOME] "WHO THE NETWORK SERVES" + HeroAudienceStage
export const fabricLede =
  "Most platforms pick one market. SupplierAdvisor® is built so private trade, public procurement and consumer trust share the same verification, traceability and operating discipline.";
export const audiences = [
  {
    id: "b2b", code: "B2B", title: "Business to business",
    body: "Manufacturers, distributors, traders and brands run the full OS: network, buy and sell, inventory, make, ship, finance, SHEQ and quality, with counterparties you can score and prove.",
    points: ["Verified company graph and OTIFEF ratings", "POs, quotes, orders, invoices on the same books", "Lot holds that stop the ship when QA fails"],
    href: "/onboarding?lane=b2b", cta: "Register your company",
    alt: "Warehouse operations beside a glass control room", pos: "30% 50%",
  },
  {
    id: "b2g", code: "B2G", title: "Business to government",
    body: "Public entities and suppliers need transparent procurement, accountable spend and audit-ready trails, not email chains and disconnected spreadsheets.",
    points: ["Transparent supplier discovery and handshakes", "Documented trade and performance scores", "SHEQ, NCR/CAPA and export packs for scrutiny"],
    href: "/onboarding?lane=b2g", cta: "Request government access",
    alt: "Civic plaza and public-sector offices at dusk", pos: "40% 50%",
  },
  {
    id: "b2c", code: "B2C", title: "Business to consumer",
    body: "One free personal wallet. Link any business on the platform to manage that account: shop, subscriptions, bookings, check-in, family, waitlist and medical records. No company needed.",
    points: ["Free app: shop, book, check in, hire, subscriptions", "Family book, waitlist, .ics calendar, gym door QR", "Pay or send proof of payment"],
    href: "/me", cta: "Create free SA Member account",
    alt: "Member using SA Member on their phone", pos: "22% 30%",
  },
];
// [HOME] "WHY JOIN"
export const whyTrust =
  "Verification, peer stars, OTIFEF and RIAD risk live where you buy and sell, so bad counterparties show up before the next PO. Invite suppliers and customers, connect public buyers, and give consumers a path into verified brands: the same fabric of trust.";
export const whyGroups =
  "Separate company workspaces, team roles and membership-scoped data: groups and brands stay clean, not tangled in one login. The same login can run a B2B or B2G company and keep a personal SA Member wallet; they never mix.";

// [HOME] trust layer + [BFG]
export const otifef =
  "Score every delivery On-Time, In-Full, Error-Free. Peer stars and RIAD risk logs follow the relationship, and ratings are bilateral after trade, not vanity reviews.";
export const otifefSme =
  "For a small supplier, that record becomes a reputation it can carry into the next conversation, rather than starting from zero every time.";
// [HOME] sample data from the Suppliers product mock (labelled as a mock in the PDF)
export const sampleSuppliers = [
  { name: "Cape Harvest Co-op", score: "99.2%" },
  { name: "Atlas Logistics SA", score: "97.1%" },
  { name: "Kalahari Inputs", score: "95.8%" },
];
export const trustCards = [
  { title: "Verified companies", body: "Company verification and certificate metadata, so counterparties know who they trade with." },
  { title: "Lot-level traceability", body: "Product → lot → warehouse → movement → QA. Mock recalls and hold gates before goods leave the gate." },
  { title: "Quality release gates", body: "Inspections that block ship. HACCP CCPs. Auditor export packs when regulators call." },
  { title: "SHEQ operators use", body: "Incidents, hazards, NCR/CAPA wired to the same inventory that runs the business." },
  { title: "On-chain pedigree", body: "Optional product passports and PO escrow when capital or authenticity must be proven." },
  { title: "Peer ratings & RIAD", body: "Bilateral stars after trade and RIAD risk logs that follow every supplier relationship." },
];
// [SLA]
export const cipc = {
  title: "A CIPC-verified badge on your public profile, with a 24-hour target.",
  steps: [
    { t: "Pay R69", b: "Once, via secure Paystack checkout." },
    { t: "CIPC match", b: "Registration or VAT number checked with VerifyNow CIPC; legal names compared." },
    { t: "Public badge", b: "On success your public profile shows the trust badge." },
    { t: "24-hour SLA", b: "Target: badge, or a clear mismatch, within 24h of payment." },
    { t: "Free re-run", b: "Pending or failed? Re-use the same payment; no second charge." },
  ],
};

// [BFG] get paid + [HOME] SRM/CRM/Finance/Network
export const getPaidLede =
  "Being trusted means little if the invoice is lost in an inbox. On SupplierAdvisor®, the commercial trail and the money trail are one: every PO rides a trusted relationship, and every invoice lands in the same ledger.";
export const tradeCards = [
  { title: "Network", body: "Company-to-company connections, pricing edges with connected companies, marketplace reach and invites, so every PO rides a trusted relationship, not a cold email." },
  { title: "Suppliers (SRM)", body: "Discover verified partners, connect on-platform, raise POs with optional on-chain escrow, and run OTIFEF scorecards after every delivery." },
  { title: "Customers (CRM)", body: "Pipeline, quotes, sales orders, invoices and loyalty, plus platform invites that turn buyers into live trading edges. Leads → quotes → orders → AR." },
  { title: "Finance", body: "Double-entry CoA, journals, AR/AP, payments, bank import, VAT, fixed assets and management accounts, with live bank feeds on selected banks (FNB Integration Channel and BankLink open banking)." },
  { title: "In-app messaging", body: "Internal team threads and external threads with connected suppliers and customers on the same model, not email silos." },
];
export const sampleRevenue = [
  { a: "Q-2041 · Metro Fresh", b: "R 180k" },
  { a: "SO-991 · AfriRetail", b: "Invoiced" },
  { a: "INV-552 overdue", b: "7d" },
];
export const escrow =
  "Where settlement needs stronger proof, optional wallet-signed escrow on purchase orders is available, without forcing crypto on every workflow.";
// [HOME] "HOW IT WORKS"
export const fourSteps = [
  { title: "Register & verify", body: "Company profile, team, certificates. Multi-entity groups get separate workspaces." },
  { title: "Connect & trade", body: "Invite suppliers and customers. Handshakes, POs, docs, OTIFEF scorecards." },
  { title: "Operate the chain", body: "Inventory, manufacturing, distribution, finance: one membership-scoped OS." },
  { title: "Prove & improve", body: "SHEQ, QA holds, traceability, CAPA and auditor packs when it matters." },
];

// [HOME] "Core OS modules"
export const coreLede =
  "Not a pile of apps: a single operating system for how goods, money and trust move through African and global supply chains. Every module shares the same command chrome, so teams switch systems without relearning the UI.";
export const coreIncluded =
  "Control Tower, Company (identity, modules, billing), Network, Suppliers, Customers, Inventory, Operations, Quality, Finance, Intelligence and Guide: one workspace, one trust fabric.";
export const coreModules = [
  { name: "Operations", tag: "End-to-end control tower", body: "Procure, receive, store, make, ship and fulfil on one live tower; exceptions surface first." },
  { name: "Suppliers (SRM)", tag: "Trust you can measure", body: "Discover and invite, POs with optional escrow, OTIFEF scorecards, peer ratings and RIAD." },
  { name: "Customers (CRM)", tag: "Lead → loyalty in one flow", body: "Leads and opportunities, quotes → orders → AR, buyer portal and reviews." },
  { name: "Inventory", tag: "Every unit has a home", body: "SKU master, multi-site stock, QR receive, GPS transfers, lots and serials, on-chain passports." },
  { name: "Network", tag: "Verified trading graph", body: "Connection graph, pricing edges, marketplace reach and business invites." },
  { name: "SHEQ", tag: "ISO 45001-ready control tower", body: "Incidents, HIRARC hazard scores, NCRs and CAPAs; failed QA inspections auto-raise NCRs." },
  { name: "Quality & food safety", tag: "Inspect · hold · trace · recall", body: "Holds that block shipping, HACCP plans with CCPs, lot pedigree, recall drills, auditor packs." },
  { name: "Finance", tag: "One ledger of truth", body: "Journals and GL, bank allocation, VAT, fixed assets, budgets and management accounts." },
  { name: "Projects", tag: "Portfolio that ships", body: "Portfolio, kanban boards, milestone gates, timesheets and risk registers." },
  { name: "Impact (ESG)", tag: "Carbon you can act on", body: "Scope 1–3 style carbon tracking and report packs wired to real inventory and logistics." },
  { name: "Intelligence", tag: "Signal over noise", body: "Live pulse across network, supply, demand, finance and ops, plus Super-Cube® leadership." },
];

// [HOME] "MODULES · Core OS · Sector · Industry · Government · Bespoke"
export const packagingLede =
  "Every company starts with the same Core operating system, then layers sector and industry packs for how it actually trades. Public-sector programmes and fully custom process design are specialist-led.";
export const layers = [
  { name: "Core OS", price: "{core}/mo", body: "Trade, ops, finance, assure and insight: the foundation every company starts with." },
  { name: "Sector", price: "Shape the workspace", body: "Manufacturing, distribution and container outlets for secondary and tertiary operations." },
  { name: "Industry", price: "+{pack}/mo each", body: "Industry hubs for primary production and services, without removing Core process trees." },
  { name: "Government", price: "Specialist setup", body: "National → Provincial → Municipal → Local workspaces: SchoolAdvisor®, HealthAdvisor®." },
  { name: "Bespoke", price: "Process design", body: "Custom workflows, multi-entity models and integrations when your group runs differently." },
];
export const sectorModules = [
  { name: "Manufacturing", tag: "Factory physics", body: "BOMs, master production schedules, MRP, work centres and work orders with OEE-style throughput.", points: ["BOM & work cells", "MPS / MRP", "Work order execution"] },
  { name: "Distribution", tag: "Door to destination", body: "Inbound and outbound logistics, carriers, fleet and drivers, Incoterms® 2020 and event-level tracking across road, ocean and air.", points: ["Inbound & outbound", "Carriers & fleet", "Live tracking & OTIF"] },
  { name: "Containers", tag: "Last-mile outlet network", body: "Container retail outlets, contractors and resellers, live stock, jobs and meals impact, and feasibility models.", points: ["Map, stock & resellers", "Food security & jobs impact", "Deploy feasibility model"] },
];
export const alsoIncluded = [
  { name: "SAM messenger", body: "SAM (Grok), the SupplierAdvisor® Messenger: in-app setup and how-to without a manual." },
  { name: "Guide", body: "In-app how-to curriculum for every module." },
  { name: "Sales contractors", body: "Pipeline, quotes and personal commission (4–6% programme)." },
  { name: "Supply-chain referral", body: "Earn 6/3/1% of partners’ subscriptions (max 10%)." },
];
export const superCube = {
  title: "Software for the chain. Development for the humans who run it.",
  body: "Super-Cube® is a doctoral leadership model embedded in the product, so teams grow decision quality alongside OTIFEF, cost centres and compliance.",
  points: ["Leadership development in the same workspace as ops", "Intelligence pulse across network, supply, demand and finance", "Guide curriculum for every module"],
};

// [HOME] "Industry modules" (taglines + compare-table descriptions)
export const industryLede =
  "Industry Advisors add vertical depth with diaries, waitlist desks, industry PWAs, rooms, marketplace listings and in-app messages. Enable only the packs you need from Company → Modules. Most Advisors bill the operating company a subscription; members and patients never pay SupplierAdvisor®.";
export const industryGroups = [
  {
    label: "Primary & make",
    items: [
      { name: "CropAdvisor®", tag: "Agri production OS", body: "Fields, harvest, inputs, fleet fuel, labour, regen metrics and farm-to-buyer trade." },
      { name: "QuarryAdvisor®", tag: "Aggregates & extractives OS", body: "Sites, reserves, plant, weighbridge, fleet, QA and permits." },
      { name: "ApparelAdvisor®", tag: "Apparel OS for factory and brand", body: "Range, landed-duty BOM, critical path, QA holds that stop ship, wholesale ATS, buyer PWA." },
      { name: "ConstructionAdvisor®", tag: "Contractor OS for building", body: "BOQ quotes, dated plan vs actuals, claim → certify → client pay, client/contractor PWA." },
    ],
  },
  {
    label: "Fitness & clinical services",
    items: [
      { name: "GymAdvisor®", tag: "Gym & fitness services OS", body: "Coaches, rooms, packs, waitlist, phone check-in QR, member PWA, marketplace." },
      { name: "PhysioAdvisor®", tag: "Physio & allied health OS", body: "Exclusive diaries and rooms, waitlist, treatment plans, POPIA, Rehab PWA." },
      { name: "DentalAdvisor®", tag: "Dental practice OS", body: "Multi-chair diary, waitlist, treatment plans, Chart PWA, marketplace." },
      { name: "PsychiatryAdvisor®", tag: "Mental health practice OS", body: "Exclusive diaries and rooms, waitlist, treatment plans, Records PWA." },
      { name: "MedicalAdvisor®", tag: "GP & medical practice OS", body: "Multi-room diaries, waitlist, treatment plans, Rx on visits, Records PWA." },
      { name: "VetAdvisor®", tag: "Veterinary practice OS", body: "Vets, clients, animals, consults, vaccines, waitlist, Pets PWA." },
    ],
  },
  {
    label: "Hire & retail",
    items: [
      { name: "HireAdvisor®", tag: "Hire / rental marketplace", body: "Plant, tools, party gear and events kit; members hire free; 2.5% on the listing business." },
      { name: "RetailAdvisor®", tag: "B2C till · QR / NFC pay", body: "Catalogue, cash or QR / NFC pay on SA Member; collect gym, clinic and hire bills at the counter." },
    ],
    shared: true,
  },
];
export const clinicShared =
  "slot waitlists and next-available queues, booking another clinician when the preferred one is full, household attendees, treatment plans with one-click book next, rooms and chairs as diary resources, an industry-branded member PWA, an opt-in marketplace listing and in-app care messages.";

// [HOME] government module + [JOIN]
export const school = {
  body: "SchoolAdvisor® runs only on the government / public-sector pathway: DBE and PEU govern catalogue, menus and compliance; schools run kitchen, learners, approved brands and serve day; service providers (SPs) deliver against school POs. Not a private industry pack.",
  roles: [
    { who: "DBE / PEU", what: "Catalogue · menus · PEU visits · claims" },
    { who: "School kitchen", what: "Stock · orders · serve day · prizes" },
    { who: "SP supply", what: "PO → deliver → POD · SLA" },
  ],
  tiers: ["National", "Provincial", "Municipal", "Local"],
};
export const health = "HealthAdvisor® brings Department of Health facility pathways onto the same OS, as an admin-set-up government programme rather than a private pack.";
export const b2gAccess = "Government (B2G) is not self-serve: national, provincial or municipal offices submit a request, and a SupplierAdvisor® admin approves it before the workspace opens.";

// [HOME] "SA MEMBER" + [JOIN] /me
export const member = {
  lede: "Create one free SA Member profile. Link it to any gym, clinic, hire desk or shop on SupplierAdvisor®, then manage that account: book, buy, check in, family, waitlist, subscriptions, medical records, pay and proof, and push alerts. Desks can still print a QR or send WhatsApp.",
  free: "No subscription, no platform take-rate. Brands charge their own gym, clinic or hire prices. You pay them, not us.",
  features: [
    { t: "Install as an app", b: "Add to the home screen: a full-screen PWA for shop, brands, check-in and your profile." },
    { t: "Create & verify yourself", b: "Name, email, phone, city. SA ID via VerifyNow or passport via Didit." },
    { t: "Link any business", b: "Search a company, scan a desk QR, or tap Add to wallet on its public page." },
    { t: "Book your Advisor", b: "Medical, dental, physio, psychiatry and gym: open diary slots on your phone." },
    { t: "Hire golden path", b: "Request → docs → approved → pay → out → return → done, with next action and deposit." },
    { t: "Shop sale & hire", b: "Browse what brands are selling or hiring out, and listed gyms and clinics." },
    { t: "Gym class check-in", b: "Scan the studio QR; your coach and the desk see you are in." },
    { t: "Family & household", b: "Book a child or household attendee onto a class or clinic slot." },
    { t: "Waitlist + calendar", b: "Join the waitlist when a slot is full; download .ics or open Google Calendar." },
    { t: "Pay & proof of payment", b: "See charges from the gym or clinic, pay in-app, or upload proof." },
    { t: "Your medical information", b: "Allergies, scripts, medical aid and care notes your practice shares." },
    { t: "Share your care profile", b: "Consent to share care notes with another linked Advisor desk." },
    { t: "Push alerts", b: "Appointment reminders, waitlist offers and hire updates on your phone." },
    { t: "Reviews after visit or hire", b: "Rate the gym, clinic or hire desk once the visit or hire is done." },
    { t: "Dual-life identity", b: "One login for your personal wallet and any company you operate, kept separate." },
  ],
  note: "Push notifications for appointment reminders, waitlist offers and hire updates. Same login opens any company you operate; the wallet and the workspace stay separate.",
};

// [HOME] "COMPARE" + "REPLACE YOUR STACK"
export const compareLede =
  "Spreadsheets fragment truth. Accounting clouds stop at the books. Major ERPs take years and seven figures. SupplierAdvisor® is the supply-chain OS: network and in-app messaging, ops, finance, quality, people, trust and Industry Advisors in one membership.";
export const compare = [
  { k: "Flexible but fragile", name: "Excel / Sheets", body: "Everyone can edit. Nobody owns a single source of truth. No network, no holds, no OTIFEF, no group tree." },
  { k: "Brilliant for books", name: "Xero-class accounting", body: "World-class ledgers and bank feeds, but not a full supply-chain, multi-entity group OS or trading graph." },
  { k: "Power at a price", name: "Major ERP", body: "SAP, Oracle, Dynamics: deep modules and hierarchy, 12–24 month projects, enterprise licence gravity." },
  { k: "The supply-chain OS", name: "SupplierAdvisor®", body: "Network, ops, finance with live bank feeds on selected banks, people, Industry Advisors, branded PWAs and free SA Member." },
];
export const before = ["Excel / Sheets", "Email POs", "Xero / Sage", "WhatsApp ops", "Separate WMS", "Standalone CRM", "SHEQ PDF packs", "HR folder + payroll bureau"];
export const after = ["Network & trust", "SRM + CRM + POs", "Inventory · lots · holds", "Make · ship · fulfil", "Finance + bank + BS", "SHEQ · HACCP · CAPA", "People · payroll · org", "Intelligence + SAM"];
export const timeToValue = [
  { t: "Go-live in days", b: "SaaS onboarding, not a 12–24 month ERP programme." },
  { t: "Transparent ZAR pricing", b: "No seven-figure licence: one company plan after the trial." },
  { t: "Phone, tablet, desktop", b: "Command centre, finance cards and ops built for mobile and tablet." },
];
export const compareNote =
  "Comparison is illustrative of typical capability classes (spreadsheets, cloud accounting, enterprise ERP suites), as on supplieradvisor.com. Individual products and add-ons vary.";

// [HOME] "TRUST & SECURITY" (+ headers verified on www.supplieradvisor.com)
export const security = [
  { t: "Role-based access", b: "Owner, admin, finance, ops, viewer, sales contractor: module rights per person." },
  { t: "Company-scoped data", b: "Membership gates every API. Multi-entity groups keep workspaces clean." },
  { t: "Audit-ready trails", b: "Journals, PO status, QA holds, CAPA and activity logs for scrutiny." },
  { t: "Cloud Postgres + RLS", b: "Supabase-backed, with row-level security patterns and service isolation." },
  { t: "Modern auth", b: "Privy-based sign-in with team invites: no shared hero passwords." },
  { t: "Controls where trade happens", b: "SHEQ, holds and verification live in the same OS as POs and stock." },
];
export const webProtections = [
  "HTTPS only, with HSTS",
  "An enforced Content Security Policy",
  "Framing blocked (X-Frame-Options: DENY) and a strict referrer policy",
];
export const africaReady = [
  "CIPC company verification via VerifyNow, with a 24h paid SLA",
  "SA ID (VerifyNow) or passport (Didit) checks for members",
  "Paystack billing in ZAR · Apple Pay ready",
];
// [PRIV]
export const privacy =
  "Personal information is handled in line with South Africa's POPIA: you may request access, correction, deletion or restriction of personal information, and object to certain processing. Clinical Advisors carry POPIA notices on patient portals.";

// [PRICE] + [HOME] HomePricing
export const included = (trial) => [
  "Unlimited team users per company",
  "Core OS: ops, SRM, CRM, inventory, manufacturing, distribution",
  "SHEQ, quality and finance",
  "Projects, ESG / impact, intelligence and Super-Cube®",
  "Verified network, quotes, invoices and cost allocation to the balance sheet",
  `Secure Paystack billing in ZAR · ${trial}-day free trial`,
];
export const founding =
  "Early companies on SupplierAdvisor® receive complimentary lifetime access. After the founding cohort fills, the standard trial and paid tiers apply.";
export const referral =
  "Invite real trading partners. When they pay for SupplierAdvisor®, you earn a share of their platform subscription, not product sales. Fees apply only to qualifying subscription payments.";

// [JOIN] + [HOME] "GET STARTED"
export const paths = [
  { k: "B2C · free", t: "Member account", b: "One personal wallet. Link any business to shop, book, check in, family-book, join a waitlist, pay or send proof, and share care notes after you consent. No company, no card.", href: "/me", cta: "Create free account" },
  { k: "B2B · company workspace", t: "Business", b: "Register a company. Next you choose the organisation type (private, public, NPO or association), then sector, industry and role. The trial starts automatically.", href: "/onboarding?lane=b2b", cta: "Register business", hl: true },
  { k: "B2G · approval required", t: "Government", b: "National, provincial or municipal offices. Your request is held until a SupplierAdvisor® admin activates the workspace.", href: "/onboarding?lane=b2g", cta: "Request access" },
];
export const billingSteps = (trial) => [
  `Register your company: the trial starts automatically for ${trial} days.`,
  "Use the full platform with your team, with unlimited users.",
  "Pick a tier in Billing: monthly, or prepaid multi-year via Paystack.",
];
export const links = [
  { t: "Pricing", p: "/pricing" },
  { t: "Interactive demo", p: "/demo" },
  { t: "Industries", p: "/industries" },
  { t: "CIPC verification SLA", p: "/verification-sla" },
  { t: "Marketplace", p: "/marketplace" },
  { t: "Install the app", p: "/install" },
];

// [BFG] article opening, by the founder
export const quote = {
  text: "“Across Africa I meet business owners who make good products and give good service, yet struggle to be seen. What is often missing is access to markets, and the proof that opens them.”",
  cite: "Dr Craig R. Muller, founder of Big Five Group™ · from “Found, verified, trusted and paid: SupplierAdvisor® as a system for empowerment”, bigfivegroup.africa, October 2026",
};

// [HOME] PO status flow (Draft → Sent → Accept → Deliver → Rate)
export const loop = {
  title: "Trust is earned on real trade, not claimed in a brochure.",
  body: "Purchase orders move through the same states on both sides. When the goods arrive, the buyer scores the delivery and rates the partner, and the score follows the company across the network.",
};

// [HOME] "COMPARE" matrix rows (values are read live from ComparePlatforms.tsx)
export const compareRows = [
  "Live verified trading network",
  "Peer ratings, trust score & OTIFEF",
  "CRM: leads → quotes → orders → AR",
  "SRM: suppliers, POs, contracts, OTIFEF",
  "Inventory, lots, warehouses & transfers",
  "QA holds that stop ship",
  "Full GL · journals · bank · VAT",
  "Live bank feeds (selected banks)",
  "Group hierarchy · holding & subsidiaries",
  "SHEQ · incidents · hazards · NCR/CAPA",
  "On-chain passports & optional PO escrow",
  "Go-live in days (not 12–24 months)",
];

// [PRICE] referral example
export const refExample =
  "You invite Company A. They invite Company B. B invites Company C. When C pays a monthly subscription, each level up the chain earns its share. If you invited C directly, you would earn L1 instead. Prepaid terms use the same percentages on the amount actually paid.";

// [HOME] "GET STARTED" trio
export const trio = [
  { t: "Ethical sourcing & SDGs", b: "Transparent chains support Zero Hunger, Responsible Consumption, and Climate Action." },
  { t: "Super-Cube® leadership", b: "Doctoral Super-Cube® model: develop leaders who compound better decisions." },
  { t: "A better world together", b: "Business, government, SchoolAdvisor® schools, and consumers on one verified network." },
];
