/**
 * Public /industries catalogue — sector pages for marketing SEO and onboarding.
 * Keep product names as *Advisor®; module IDs stay fitgraph/fieldgraph etc. in the app.
 */

export type IndustrySlug =
  | 'food-beverage'
  | 'agriculture'
  | 'quarry-aggregates'
  | 'manufacturing'
  | 'distribution'
  | 'fitness-gyms'
  | 'physio-allied-health'
  | 'dental'
  | 'mental-health'
  | 'medical-practices'
  | 'public-sector'
  | 'multi-entity';

export type IndustryPage = {
  slug: IndustrySlug;
  name: string;
  headline: string;
  subhead: string;
  /** Short card blurb (index grid) — falls back to subhead */
  cardBlurb?: string;
  /** Optional vertical pack label */
  pack?: string;
  pains: string[];
  wins: string[];
  modules: string[];
};

export const INDUSTRIES: IndustryPage[] = [
  {
    slug: 'food-beverage',
    name: 'Food & beverage',
    headline: 'When a lot fails, the ship stops.',
    subhead:
      'Lots, HACCP, QA holds, cold-chain inventory, and container outlets that measure meals and jobs — on the same books as POs, invoices, and verified trade.',
    cardBlurb:
      'Lots, HACCP, holds, cold chain, and outlet impact that feeds people.',
    pains: [
      'Spreadsheet batch records nobody trusts',
      'QA paperwork after the truck left',
      'No single view of supplier OTIFEF and food safety',
    ],
    wins: [
      'Holds block outbound automatically',
      'Traceability graphs and recall packs',
      'Outlet impact for food security narratives',
      'In-app messaging with suppliers and customers',
    ],
    modules: [
      'Inventory',
      'Quality & HACCP',
      'SHEQ',
      'Containers',
      'Suppliers',
      'Customers',
      'Finance',
      'Messages',
    ],
  },
  {
    slug: 'agriculture',
    name: 'Agriculture & inputs',
    headline: 'Field to buyer — one season, one OS.',
    subhead:
      'FieldAdvisor® multi-crop fields, estimates, harvest plans, inputs, fleet fuel (L/h · L/km · R/km), labour, regen metrics, and farm-to-buyer trade — plus verified suppliers and OTIFEF on the Core fabric.',
    cardBlurb:
      'FieldAdvisor® — fields, harvest, inputs, fleet fuel, regen, and farm-to-buyer trade.',
    pack: 'FieldAdvisor®',
    pains: [
      'Informal supplier books and lost POs',
      'No OTIFEF after harvest deliveries',
      'Season plans and fleet costs buried in Excel',
      'No shared field book across the farm office',
    ],
    wins: [
      'FieldAdvisor® field book, estimates & harvest planner',
      'Inputs, fleet util and labour rates on the season',
      'Regen metrics and mill / buyer trade handoff',
      'SRM + OTIFEF on the same verified network',
    ],
    modules: [
      'FieldAdvisor®',
      'Suppliers',
      'Inventory',
      'Network',
      'Finance',
      'People',
      'Impact',
    ],
  },
  {
    slug: 'quarry-aggregates',
    name: 'Quarry & aggregates',
    headline: 'Sites · plant · dispatch — one pit network.',
    subhead:
      'QuarryAdvisor® permanent and temporary sites, batching plants with GPS, reserves, production, plant, weighbridge, fleet fuel, QA, permits, and resource allocation across the pit network.',
    cardBlurb:
      'QuarryAdvisor® — sites, reserves, plant, weighbridge, fleet, QA, and permits.',
    pack: 'QuarryAdvisor®',
    pains: [
      'Weighbridge tickets disconnected from production',
      'Temp pads and batching plants off the main system',
      'Fleet fuel and R/t only in paper logs',
      'Permits and QA trail hard to assemble for auditors',
    ],
    wins: [
      'Multi-quarry sites, faces and GPS locations',
      'Reserves, production plans and plant stock',
      'Weighbridge dispatch and fleet util (L/km · R/t)',
      'Quality lab and compliance (rights · WUL · EMP)',
    ],
    modules: [
      'QuarryAdvisor®',
      'Suppliers',
      'Customers',
      'Inventory',
      'Operations',
      'Quality',
      'Finance',
    ],
  },
  {
    slug: 'manufacturing',
    name: 'Manufacturing',
    headline: 'Factory physics, not another spreadsheet.',
    subhead:
      'BOM, MPS, MRP, work centres, assets, labour capture, and GL postings — with people and costs on the organogram, and quality holds that stop the line.',
    cardBlurb:
      'BOM, MPS, MRP, work cells, cost centres, and labour on the balance sheet.',
    pains: [
      'MRP in disconnected workbooks',
      'Labour not on the balance sheet',
      'Assets and cells without cost centres',
    ],
    wins: [
      'Production orders with labour cost',
      'Cost centres: BU · cell · station · asset',
      'People allocated and paid on the same OS',
      'QA holds wired to stock and ship',
    ],
    modules: [
      'Manufacturing',
      'People',
      'Inventory',
      'Finance',
      'Operations',
      'SHEQ',
      'Quality',
    ],
  },
  {
    slug: 'distribution',
    name: 'Distribution & logistics',
    headline: 'Every mile. Every handoff. One tower.',
    subhead:
      'Inbound and outbound, carriers, fleet, Incoterms, and OTIF — wired to inventory, customer orders, and live shipment events.',
    cardBlurb:
      'Inbound/outbound, carriers, fleet, OTIF, and live shipment events.',
    pains: [
      'Tracking in WhatsApp threads',
      'Carriers outside the ERP',
      'No exception-first control tower',
    ],
    wins: [
      'Shipments with live events',
      'Fleet & driver visibility',
      'Ops tower from PO to delivery',
      'In-app trade messaging with partners',
    ],
    modules: [
      'Distribution',
      'Operations',
      'Inventory',
      'Customers',
      'Suppliers',
      'Finance',
      'Messages',
    ],
  },
  {
    slug: 'fitness-gyms',
    name: 'Fitness & gyms',
    headline: 'Coaches · members · classes — one gym OS.',
    subhead:
      'FitAdvisor® coaches (tenure, rates, contracts, photos), email member invites & member portal, memberships, class calendar, waitlists, feedback, class-group messages, and website embed — with an optional front desk or coach-led ops model.',
    cardBlurb:
      'FitAdvisor® — coaches, member invites & portal, calendar, feedback, class groups, website.',
    pack: 'FitAdvisor®',
    pains: [
      'Membership spreadsheets and lost class bookings',
      'No single coach tenure / rate / contract trail',
      'Members messaged only on WhatsApp',
      'Public schedule disconnected from the floor',
    ],
    wins: [
      'Email invites → member portal (book / waitlist / feedback)',
      'Coach calendar, plan vs actual, post-class RPE feedback',
      'Coach ↔ member and whole class / session group threads',
      'Front desk or coach-led ops model (owner setting)',
      'Website embed + B2C class join links',
    ],
    modules: [
      'FitAdvisor®',
      'Coaches',
      'Members & invites',
      'Memberships',
      'Calendar & bookings',
      'Messages',
      'Website',
      'Reports',
    ],
  },
  {
    slug: 'physio-allied-health',
    name: 'Physio & allied health',
    headline: 'Practitioners · diary · chart — clinic OS.',
    subhead:
      'PhysioAdvisor® for physio, OT, biokinetics and allied practices: practitioners, patient invites & portal, rehab packages, diary, medical chart (aid, docs, scripts, claims), team messaging, and clinic website.',
    cardBlurb:
      'PhysioAdvisor® — practitioners, patient portal, rehab packs, diary, scripts, messages.',
    pack: 'PhysioAdvisor®',
    pains: [
      'Paper charts and scattered medical-aid claims',
      'Diary full but no patient self-booking',
      'No scripts or care summary on the patient record',
      'Team hand-offs stuck in personal chat apps',
    ],
    wins: [
      'Patient invites & portal for open diary slots',
      'Medical chart: aid, documents, claims, prescriptions',
      'Scripts linked to visits from bookings',
      'Desk · practitioner · patient messaging',
      'End-to-end process design + printable PDF on the hub',
    ],
    modules: [
      'PhysioAdvisor®',
      'Practitioners',
      'Patients · invites · chart',
      'Packages',
      'Calendar & bookings',
      'Messages',
      'Website',
      'Reports',
    ],
  },
  {
    slug: 'dental',
    name: 'Dental practices',
    headline: 'Chairs · care plans · portal — practice OS.',
    subhead:
      'DentalAdvisor® dentists, hygienists and staff, patient invites & portal, treatment catalogue, care plans, surgery diary, medical chart with scripts, messaging, and practice website — multi-chair ready.',
    cardBlurb:
      'DentalAdvisor® — staff, patient portal, care plans, surgeries, scripts, messaging.',
    pack: 'DentalAdvisor®',
    pains: [
      'Care plans and charts in different systems',
      'Patients calling for every rebook',
      'Medical-aid claims lag the visit',
      'No shared practice inbox for clinical hand-offs',
    ],
    wins: [
      'Patient invites & portal for open surgery slots',
      'Medical chart, scripts on visits, claims trail',
      'Staff roles, rates and practice website profile',
      'Desk · clinician · patient messaging',
    ],
    modules: [
      'DentalAdvisor®',
      'Staff',
      'Patients · invites · chart',
      'Care plans',
      'Calendar & bookings',
      'Messages',
      'Website',
      'Reports',
    ],
  },
  {
    slug: 'mental-health',
    name: 'Mental health',
    headline: 'Therapy · diary · chart — practice OS.',
    subhead:
      'PsychiatryAdvisor® for psychiatry and psychology: clinicians, patients, therapy packages, diary, medical chart with scripts, patient portal, messaging, and practice website on the same verified fabric.',
    cardBlurb:
      'PsychiatryAdvisor® — clinicians, therapy packs, diary, scripts, portal, messages.',
    pack: 'PsychiatryAdvisor®',
    pains: [
      'Session notes and scripts split across tools',
      'Hard to share a safe summary with patients',
      'No single diary for multi-clinician practices',
      'Follow-ups lost between visits',
    ],
    wins: [
      'Therapy packages and appointment diary',
      'Medical chart with visit-linked prescriptions',
      'Patient portal and shared care summary (when enabled)',
      'Practice messaging and website profile',
    ],
    modules: [
      'PsychiatryAdvisor®',
      'Practitioners',
      'Patients · chart · scripts',
      'Packages',
      'Calendar & bookings',
      'Messages',
      'Website',
      'Reports',
    ],
  },
  {
    slug: 'medical-practices',
    name: 'Medical practices',
    headline: 'Consults · scripts · portal — GP OS.',
    subhead:
      'MedicalAdvisor® for GPs, specialists and nurses: patients, consults, care packages, diary, medical chart with prescriptions linked to visits, patient portal, messaging, and practice website — multi-room ready.',
    cardBlurb:
      'MedicalAdvisor® — GPs & clinics, consults, Rx on visits, portal, messages.',
    pack: 'MedicalAdvisor®',
    pains: [
      'Scripts not tied to the appointment',
      'Medical-aid admin chasing after consults',
      'Patients rebook only by phone',
      'No shared practice thread for care teams',
    ],
    wins: [
      'Scripts on patient chart and from bookings',
      'Medical aid, documents and claim statuses',
      'Patient portal for open diary vacancies',
      'Desk · practitioner · patient messaging',
    ],
    modules: [
      'MedicalAdvisor®',
      'Practitioners',
      'Patients · chart · scripts',
      'Care packs',
      'Calendar & bookings',
      'Messages',
      'Website',
      'Reports',
    ],
  },
  {
    slug: 'public-sector',
    name: 'Public sector (B2G)',
    headline: 'Procurement and programmes that face scrutiny.',
    subhead:
      'Transparent supplier discovery, documented trade, verification, export packs — plus Schools (NSNP / DBE) and Health (DoH) programme pathways on the same platform.',
    cardBlurb:
      'Transparent procurement, verification, NSNP / Health programmes, audit-ready packs.',
    pains: [
      'Opaque supplier selection',
      'Audit packs assembled after the fact',
      'No performance trail on suppliers',
      'Programme ops split from procurement systems',
    ],
    wins: [
      'Verified company graph and peer ratings',
      'OTIFEF and SHEQ / NCR trails for oversight',
      'Schools NSNP process design (DBE · school · SP)',
      'Health facility pathways on the OS',
    ],
    modules: [
      'Network',
      'Suppliers',
      'Schools (NSNP)',
      'Health',
      'SHEQ',
      'Quality',
      'Finance',
      'Intelligence',
    ],
  },
  {
    slug: 'multi-entity',
    name: 'Groups & brands',
    headline: 'Many companies. Clean walls. One platform.',
    subhead:
      'Separate workspaces, team roles, and membership-scoped data — groups and brands without tangled logins. Enable Core, sector, and Industry Advisors per entity.',
    cardBlurb:
      'Separate company workspaces, roles, and membership-scoped data.',
    pains: [
      'One database for every legal entity',
      'Shared passwords across brands',
      'No clear ownership of books or stock',
    ],
    wins: [
      'Company switcher + roles',
      'Scoped COA, inventory, people',
      'Invite partners without sharing the group',
      'Industry packs per company (Field · Fit · clinic…)',
    ],
    modules: [
      'Company',
      'Team roles',
      'Modules & packaging',
      'Finance',
      'Network',
      'People',
    ],
  },
];

export function getIndustry(slug: string): IndustryPage | undefined {
  return INDUSTRIES.find((i) => i.slug === slug);
}

export function industrySlugs(): IndustrySlug[] {
  return INDUSTRIES.map((i) => i.slug);
}
