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
      'CropAdvisor® multi-crop fields, estimates, harvest plans, inputs, fleet fuel (L/h · L/km · R/km), labour, regen metrics, and farm-to-buyer trade — plus verified suppliers and OTIFEF on the Core fabric.',
    cardBlurb:
      'CropAdvisor® — fields, harvest, inputs, fleet fuel, regen, and farm-to-buyer trade.',
    pack: 'CropAdvisor®',
    pains: [
      'Informal supplier books and lost POs',
      'No OTIFEF after harvest deliveries',
      'Season plans and fleet costs buried in Excel',
      'No shared field book across the farm office',
    ],
    wins: [
      'CropAdvisor® field book, estimates & harvest planner',
      'Inputs, fleet util and labour rates on the season',
      'Regen metrics and mill / buyer trade handoff',
      'SRM + OTIFEF on the same verified network',
    ],
    modules: [
      'CropAdvisor®',
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
      'FitAdvisor® coaches (tenure, rates, People dual-write), member invites & portal (family, waitlist), memberships with freeze & packs, rooms on the calendar, reminders & recalls, in-app class-group messages by system user ID, website embed and marketplace listing — front desk or coach-led. SA bills platform subscription only.',
    cardBlurb:
      'FitAdvisor® — coaches, rooms, waitlist, in-app messages, marketplace.',
    pack: 'FitAdvisor®',
    pains: [
      'Membership spreadsheets and lost class bookings',
      'No single coach tenure / rate / contract trail',
      'Members messaged only on WhatsApp',
      'Public schedule disconnected from the floor',
    ],
    wins: [
      'Email invites → portal (book / waitlist / family / feedback)',
      'Rooms, coach calendar, plan vs actual, RPE feedback',
      'In-app care & class groups by system user ID',
      'Reminders, recalls, staff Today PWA',
      'Website embed + marketplace listing',
    ],
    modules: [
      'FitAdvisor®',
      'Coaches · People',
      'Members & invites',
      'Memberships · freeze · packs',
      'Calendar · rooms · bookings',
      'Messages',
      'Website · marketplace',
      'Reports',
    ],
  },
  {
    slug: 'physio-allied-health',
    name: 'Physio & allied health',
    headline: 'Practitioners · diary · chart — clinic OS.',
    subhead:
      'PhysioAdvisor® for physio, OT, biokinetics and allied practices: practitioners, patient invites & portal (POPIA), rehab packs & treatment plans, exclusive clinician diaries with rooms, waitlist desk, medical chart (aid, docs, scripts, claims), in-app messaging by system user ID, marketplace listing, and clinic website.',
    cardBlurb:
      'PhysioAdvisor® — rooms, waitlist, treatment plans, portal, marketplace.',
    pack: 'PhysioAdvisor®',
    pains: [
      'Paper charts and scattered medical-aid claims',
      'Diary full but no patient self-booking',
      'No scripts or care summary on the patient record',
      'Team hand-offs stuck in personal chat apps',
    ],
    wins: [
      'Patient invites & portal; POPIA-aware desk; family booking',
      'Exclusive clinician diaries + rooms; no double-book',
      'Waitlist desk, 24h reminders, treatment-plan book next',
      'In-app care messages by system user ID; marketplace listing',
      'End-to-end process design + printable PDF on the hub',
    ],
    modules: [
      'PhysioAdvisor®',
      'Practitioners',
      'Patients · invites · chart · plans',
      'Packages',
      'Calendar & waitlist desk',
      'Messages',
      'Website · marketplace',
      'Reports',
    ],
  },
  {
    slug: 'dental',
    name: 'Dental practices',
    headline: 'Chairs · care plans · portal — practice OS.',
    subhead:
      'DentalAdvisor® dentists, hygienists and staff, patient invites & portal, treatment catalogue, care packs & treatment plans, multi-chair practice diary (exclusive clinician books), waitlist desk, medical chart with scripts, in-app messaging, marketplace listing, and practice website.',
    cardBlurb:
      'DentalAdvisor® — staff, portal, chairs, waitlist, treatment plans, marketplace.',
    pack: 'DentalAdvisor®',
    pains: [
      'Care plans and charts in different systems',
      'Patients calling for every rebook',
      'Medical-aid claims lag the visit',
      'No shared practice inbox for clinical hand-offs',
    ],
    wins: [
      'Patient invites & portal; POPIA; family booking',
      'Practice multi-chair diary without double-booking a clinician',
      'Waitlist desk, reminders, treatment-plan book next',
      'In-app messaging + marketplace listing',
    ],
    modules: [
      'DentalAdvisor®',
      'Staff',
      'Patients · invites · chart · plans',
      'Care plans',
      'Calendar & waitlist desk',
      'Messages',
      'Website · marketplace',
      'Reports',
    ],
  },
  {
    slug: 'mental-health',
    name: 'Mental health',
    headline: 'Therapy · diary · chart — practice OS.',
    subhead:
      'PsychiatryAdvisor® for psychiatry and psychology: clinicians, patients (POPIA), therapy packages & treatment plans, exclusive clinician diaries with rooms, waitlist desk, medical chart with scripts, patient portal, in-app messaging by system user ID, marketplace listing, and practice website.',
    cardBlurb:
      'PsychiatryAdvisor® — diaries, waitlist, treatment plans, portal, marketplace.',
    pack: 'PsychiatryAdvisor®',
    pains: [
      'Session notes and scripts split across tools',
      'Hard to share a safe summary with patients',
      'No single diary for multi-clinician practices',
      'Follow-ups lost between visits',
    ],
    wins: [
      'Exclusive clinician books + rooms; no double-book',
      'Waitlist desk, treatment-plan book next, recalls',
      'Patient portal and shared care summary (when enabled)',
      'In-app messaging + marketplace listing',
    ],
    modules: [
      'PsychiatryAdvisor®',
      'Practitioners',
      'Patients · chart · plans',
      'Packages',
      'Calendar & waitlist desk',
      'Messages',
      'Website · marketplace',
      'Reports',
    ],
  },
  {
    slug: 'medical-practices',
    name: 'Medical practices',
    headline: 'Consults · scripts · portal — GP OS.',
    subhead:
      'MedicalAdvisor® for GPs, specialists and nurses: patients (POPIA), consults, care packs & treatment plans, multi-room exclusive clinician diaries, waitlist desk, medical chart with prescriptions linked to visits, patient portal, in-app messaging, marketplace listing, and practice website.',
    cardBlurb:
      'MedicalAdvisor® — rooms, waitlist, Rx on visits, portal, marketplace.',
    pack: 'MedicalAdvisor®',
    pains: [
      'Scripts not tied to the appointment',
      'Medical-aid admin chasing after consults',
      'Patients rebook only by phone',
      'No shared practice thread for care teams',
    ],
    wins: [
      'Scripts on patient chart and from bookings',
      'Exclusive clinician diaries + rooms; waitlist desk',
      'Treatment-plan book next; patient portal',
      'In-app messaging + marketplace listing',
    ],
    modules: [
      'MedicalAdvisor®',
      'Practitioners',
      'Patients · chart · plans',
      'Care packs',
      'Calendar & waitlist desk',
      'Messages',
      'Website · marketplace',
      'Reports',
    ],
  },
  {
    slug: 'public-sector',
    name: 'Public sector (B2G)',
    headline: 'Procurement and programmes that face scrutiny.',
    subhead:
      'Transparent supplier discovery, documented trade, verification, export packs — plus SchoolAdvisor® (NSNP / DBE · public sector only) and Health (DoH) programme pathways on the same platform.',
    cardBlurb:
      'SchoolAdvisor® NSNP, Health (DoH), transparent procurement, audit-ready packs.',
    pack: 'SchoolAdvisor®',
    pains: [
      'Opaque supplier selection',
      'Audit packs assembled after the fact',
      'No performance trail on suppliers',
      'Programme ops split from procurement systems',
      'Schools packaged as private companies by mistake',
    ],
    wins: [
      'Verified company graph and peer ratings',
      'OTIFEF and SHEQ / NCR trails for oversight',
      'SchoolAdvisor® process design (DBE · school kitchen · SP)',
      'Always Public Sector packaging for schools',
      'Health facility pathways on the OS',
    ],
    modules: [
      'SchoolAdvisor®',
      'Network',
      'Suppliers',
      'Health (DoH)',
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
