export type IndustrySlug =
  | 'food-beverage'
  | 'agriculture'
  | 'manufacturing'
  | 'distribution'
  | 'public-sector'
  | 'multi-entity';

export type IndustryPage = {
  slug: IndustrySlug;
  name: string;
  headline: string;
  subhead: string;
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
      'Lots, HACCP, QA holds, cold-chain inventory, and container outlets that measure meals and jobs — on the same books as POs and invoices.',
    pains: [
      'Spreadsheet batch records nobody trusts',
      'QA paperwork after the truck left',
      'No single view of supplier OTIFEF and food safety',
    ],
    wins: [
      'Holds block outbound automatically',
      'Traceability graphs and recall packs',
      'Outlet impact for food security narratives',
    ],
    modules: ['Inventory', 'Quality & HACCP', 'SHEQ', 'Containers', 'Suppliers', 'Finance'],
  },
  {
    slug: 'agriculture',
    name: 'Agriculture & inputs',
    headline: 'Seasonal trade with scores you can defend.',
    subhead:
      'Verified suppliers, scored deliveries, multi-site stock, and cost centres for plants and depots — built for African agricultural chains.',
    pains: [
      'Informal supplier books and lost POs',
      'No OTIFEF after harvest deliveries',
      'Cost by farm / depot buried in Excel',
    ],
    wins: [
      'SRM book + OTIFEF scorecards',
      'Inventory and transfers with GPS',
      'BU allocation for every rand of spend',
    ],
    modules: ['Suppliers', 'Inventory', 'Network', 'Manufacturing costs', 'Finance', 'People'],
  },
  {
    slug: 'manufacturing',
    name: 'Manufacturing',
    headline: 'Factory physics, not another spreadsheet.',
    subhead:
      'BOM, MPS, MRP, work centres, assets, labour capture, and GL postings — with people and costs on the organogram.',
    pains: [
      'MRP in disconnected workbooks',
      'Labour not on the balance sheet',
      'Assets and cells without cost centres',
    ],
    wins: [
      'Production orders with labour cost',
      'Cost centres: BU · cell · station · asset',
      'People allocated and paid on the same OS',
    ],
    modules: ['Manufacturing', 'People', 'Inventory', 'Finance', 'Operations', 'SHEQ'],
  },
  {
    slug: 'distribution',
    name: 'Distribution & logistics',
    headline: 'Every mile. Every handoff. One tower.',
    subhead:
      'Inbound and outbound, carriers, fleet, Incoterms, and OTIF — wired to inventory and customer orders.',
    pains: [
      'Tracking in WhatsApp threads',
      'Carriers outside the ERP',
      'No exception-first control tower',
    ],
    wins: [
      'Shipments with live events',
      'Fleet & driver visibility',
      'Ops tower from PO to delivery',
    ],
    modules: ['Distribution', 'Operations', 'Inventory', 'Customers', 'Finance'],
  },
  {
    slug: 'public-sector',
    name: 'Public sector (B2G)',
    headline: 'Procurement that can face scrutiny.',
    subhead:
      'Transparent supplier discovery, documented trade, verification, and export packs — not email chains.',
    pains: [
      'Opaque supplier selection',
      'Audit packs assembled after the fact',
      'No performance trail on suppliers',
    ],
    wins: [
      'Verified company graph',
      'OTIFEF and peer ratings',
      'SHEQ / NCR trails for oversight',
    ],
    modules: ['Network', 'Suppliers', 'SHEQ', 'Quality', 'Finance', 'Documents'],
  },
  {
    slug: 'multi-entity',
    name: 'Groups & brands',
    headline: 'Many companies. Clean walls. One platform.',
    subhead:
      'Separate workspaces, team roles, and membership-scoped data — groups and brands without tangled logins.',
    pains: [
      'One database for every legal entity',
      'Shared passwords across brands',
      'No clear ownership of books or stock',
    ],
    wins: [
      'Company switcher + roles',
      'Scoped COA, inventory, people',
      'Invite partners without sharing the group',
    ],
    modules: ['Company', 'Team roles', 'Finance', 'Network', 'People'],
  },
];

export function getIndustry(slug: string): IndustryPage | undefined {
  return INDUSTRIES.find((i) => i.slug === slug);
}

export function industrySlugs(): IndustrySlug[] {
  return INDUSTRIES.map((i) => i.slug);
}
