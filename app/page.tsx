'use client';

import Link from 'next/link';
import {
  ArrowRight,
  ShieldCheck,
  Factory,
  Leaf,
  Globe,
  BookOpen,
  Users2,
  Award,
  Heart,
  Network,
  Package,
  Truck,
  Brain,
  CheckCircle2,
  Building2,
  Ship,
  Wallet,
  ShoppingCart,
  Workflow,
  Landmark,
  ChevronRight,
  HardHat,
  ClipboardCheck,
  Link2,
  Star,
  Fingerprint,
  CreditCard,
  Container,
  FolderKanban,
  Handshake,
  Gift,
  Bot,
  Sparkles,
  Layers,
  Mail,
  Puzzle,
  Sprout,
  Mountain,
  Dumbbell,
  Stethoscope,
  Smile,
  PanelLeft,
  BrainCircuit,
  Hospital,
  School,
  BriefcaseBusiness,
  QrCode,
  Smartphone,
  BadgeCheck,
  Bell,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import LandingNav from '@/components/marketing/LandingNav';
import HomePricing from '@/components/marketing/HomePricing';
import FoundingCounterStrip from '@/components/marketing/FoundingCounterStrip';
import ComparePlatforms from '@/components/marketing/ComparePlatforms';
import SocialProofStrip from '@/components/marketing/SocialProofStrip';
import ProductVideo from '@/components/marketing/ProductVideo';
import ReplaceStackDiagram from '@/components/marketing/ReplaceStackDiagram';
import RoiCalculator from '@/components/marketing/RoiCalculator';
import SecurityStrip from '@/components/marketing/SecurityStrip';
import SuperCubeStory from '@/components/marketing/SuperCubeStory';
import IndustriesStrip from '@/components/marketing/IndustriesStrip';
import {
  OpsMock,
  SrmMock,
  CrmMock,
  InventoryMock,
  ManufacturingMock,
  DistributionMock,
  IntelligenceMock,
  AccountingMock,
  SheqMock,
  QualityMock,
  ContainersMock,
  NetworkMock,
  ProjectsMock,
  SustainabilityMock,
  FieldgraphMock,
  QuarrygraphMock,
  FitgraphMock,
  PhysiographMock,
  DentalgraphMock,
  PsychiatrygraphMock,
  MedicalgraphMock,
  HiregraphMock,
  SchoolsMock,
  NavMock,
  ModuleGallery,
  ProductMockShell,
} from '@/components/marketing/ProductMocks';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
  formatZar,
} from '@/lib/billing/company-subscription';
import {
  CORE_OS_MONTHLY_ZAR,
  INDUSTRY_PACK_MONTHLY_ZAR,
  OS_SECTORS,
} from '@/lib/product/architecture';
import { FOUNDING_FREE_COMPANY_LIMIT } from '@/lib/billing/lifetime';
import {
  REFERRAL_LEVEL_RATES_PCT,
  REFERRAL_TOTAL_CAP_PCT,
} from '@/lib/billing/supply-chain-referral';

type ModuleBand = 'core' | 'sector' | 'industry' | 'government' | 'nav';

const MODULE_BAND_META: Record<
  Exclude<ModuleBand, 'nav'>,
  { title: string; blurb: string; accent: string; step: string; price: string }
> = {
  core: {
    title: 'Core OS',
    blurb:
      'The shared operating system every company gets — trade, ops, assure, finance, and insight on one fabric.',
    accent:
      'text-[#0077b6] border-[#00b4d8]/40 bg-cyan-50/80 dark:text-cyan-300 dark:border-cyan-500/40 dark:bg-cyan-500/10',
    step: '01',
    price: `R${CORE_OS_MONTHLY_ZAR}/mo`,
  },
  sector: {
    title: 'Sector',
    blurb:
      'Shape the workspace for how you produce and move goods — secondary manufacturing, logistics, and last-mile outlets.',
    accent:
      'text-sky-800 border-sky-200 bg-sky-50/80 dark:text-sky-300 dark:border-sky-500/40 dark:bg-sky-500/10',
    step: '02',
    price: 'Shape the workspace',
  },
  industry: {
    title: 'Industry',
    blurb:
      'Vertical OS modules for agri, extractives, and services — CropAdvisor®, QuarryAdvisor®, GymAdvisor®, HireAdvisor® and clinic Advisors with diaries, waitlists, treatment plans, rooms, marketplace, and in-app care.',
    accent:
      'text-emerald-800 border-emerald-200 bg-emerald-50/80 dark:text-emerald-300 dark:border-emerald-500/40 dark:bg-emerald-500/10',
    step: '03',
    price: `+R${INDUSTRY_PACK_MONTHLY_ZAR}/mo each`,
  },
  government: {
    title: 'Government',
    blurb:
      'Public-sector programmes only — SchoolAdvisor® (DBE / NSNP: department · school kitchen · SP) and Health (DoH facilities). National → Provincial → Municipal → Local packaging, not private company modules.',
    accent:
      'text-violet-800 border-violet-200 bg-violet-50/80 dark:text-violet-300 dark:border-violet-500/40 dark:bg-violet-500/10',
    step: '04',
    price: 'Specialist setup',
  },
};

const MODULE_OPTIONS: Array<{
  id: 'core' | 'sector' | 'industry' | 'government' | 'bespoke';
  step: string;
  title: string;
  price: string;
  eyebrow: string;
  body: string;
  tone: string;
  iconTone: string;
  bullets: string[];
  href: string;
  cta: string;
  /** Specialist cards list bullets instead of MODULES links */
  specialist?: boolean;
}> = [
  {
    id: 'core',
    step: '01',
    title: 'Core OS',
    price: `R${CORE_OS_MONTHLY_ZAR}/mo`,
    eyebrow: 'Always included',
    body: 'Trade, ops, finance, assure, and insight on one fabric — the foundation every company starts with.',
    tone: 'border-slate-200 bg-[#f8fafc] dark:border-neutral-800 dark:bg-neutral-950',
    iconTone: 'bg-[#00b4d8]/15 text-[#0077b6] dark:bg-[#00b4d8]/20 dark:text-[#00b4d8]',
    bullets: [
      'Network · Suppliers · Customers',
      'Inventory · Operations · Quality · SHEQ',
      'Finance · Projects · Impact · Intelligence',
    ],
    href: '#modules-core',
    cta: 'Explore Core modules',
  },
  {
    id: 'sector',
    step: '02',
    title: 'Sector',
    price: 'Shape the workspace',
    eyebrow: 'How you make & move',
    body: 'Layer manufacturing, distribution, and container outlets for secondary and tertiary operations.',
    tone: 'border-slate-200 bg-white dark:border-neutral-800 dark:bg-black',
    iconTone: 'bg-sky-50 text-[#00b4d8] dark:bg-sky-500/15 dark:text-sky-300',
    bullets: ['Manufacturing (Make)', 'Distribution (Ship)', 'Containers · last-mile outlets'],
    href: '#modules-sector',
    cta: 'Explore Sector modules',
  },
  {
    id: 'industry',
    step: '03',
    title: 'Industry',
    price: `+R${INDUSTRY_PACK_MONTHLY_ZAR}/mo each`,
    eyebrow: 'Vertical depth',
    body: 'Industry hubs for primary production and tertiary services — without removing Core process trees.',
    tone: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 to-white dark:border-emerald-500/30 dark:from-emerald-500/10 dark:to-black',
    iconTone: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    bullets: [
      'CropAdvisor® agri · QuarryAdvisor® aggregates',
      'GymAdvisor® · rooms · waitlist · marketplace',
      'Clinic Advisors · exclusive diaries · treatment plans',
    ],
    href: '#modules-industry',
    cta: 'Explore Industry modules',
  },
  {
    id: 'government',
    step: '04',
    title: 'Government',
    price: 'Specialist setup',
    eyebrow: 'Public programmes',
    body: 'National → Provincial → Municipal → Local programme workspaces — SchoolAdvisor® (DBE / NSNP), DoH facilities, multi-entity roles. Schools always run the public-sector government process.',
    tone: 'border-violet-200 bg-gradient-to-br from-violet-50/80 to-white dark:border-violet-500/30 dark:from-violet-500/10 dark:to-black',
    iconTone: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
    bullets: [
      'SchoolAdvisor® (NSNP / DBE · public sector)',
      'Health (DoH facilities)',
      'National · Provincial · Municipal · Local',
    ],
    href: '#modules-government',
    cta: 'Explore SchoolAdvisor®',
    specialist: false,
  },
  {
    id: 'bespoke',
    step: '05',
    title: 'Bespoke',
    price: 'Process design',
    eyebrow: 'Specialist-led',
    body: 'Custom workflows, multi-entity models, and integrations when your group runs differently.',
    tone: 'border-amber-200 bg-gradient-to-br from-amber-50/80 to-white dark:border-amber-500/30 dark:from-amber-500/10 dark:to-black',
    iconTone: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    bullets: [
      'Custom process trees & approvals',
      'Multi-entity / group models',
      'Integrations into how you already work',
    ],
    href: '#modules-bespoke',
    cta: 'Talk about bespoke',
    specialist: true,
  },
];

const MODULES = [
  {
    id: 'nav',
    band: 'nav' as ModuleBand,
    code: '00',
    title: 'Navigation',
    short: 'Nav',
    tagline: 'Core · Sector · Industry in one sidebar',
    body: 'Your company workspace groups modules the way you buy them — Core OS always on, sector modules for how you make and move, industry hubs when vertical depth matters.',
    bullets: [
      'Core foundations first',
      'Sector make · ship · outlets',
      'Industry: Advisors · rooms · waitlist · marketplace',
    ],
    Mock: NavMock,
    icon: PanelLeft,
  },
  {
    id: 'ops',
    band: 'core' as ModuleBand,
    code: '01',
    title: 'Operations',
    short: 'Ops',
    tagline: 'End-to-end control tower',
    body: 'Procure, receive, store, make, ship, and fulfill on one live tower — exceptions surface first so throughput never goes dark.',
    bullets: ['Supplier POs → inbound', 'Warehouse & production WIP', 'Outbound + customer fulfill'],
    Mock: OpsMock,
    icon: Workflow,
  },
  {
    id: 'srm',
    band: 'core' as ModuleBand,
    code: '02',
    title: 'Suppliers (SRM)',
    short: 'Suppliers',
    tagline: 'Trust you can measure',
    body: 'Discover verified partners, connect on-platform, raise POs with optional on-chain escrow, and run OTIFEF scorecards after every delivery.',
    bullets: ['Discover & invite', 'OTIFEF scorecards', 'Peer ratings & RIAD'],
    Mock: SrmMock,
    icon: Truck,
  },
  {
    id: 'crm',
    band: 'core' as ModuleBand,
    code: '03',
    title: 'Customers (CRM)',
    short: 'Customers',
    tagline: 'Lead → loyalty in one flow',
    body: 'Pipeline, quotes, sales orders, invoices, and loyalty — plus platform invites that turn buyers into live trading edges.',
    bullets: ['Leads & opportunities', 'Quotes → orders → AR', 'Buyer portal & reviews'],
    Mock: CrmMock,
    icon: ShoppingCart,
  },
  {
    id: 'inv',
    band: 'core' as ModuleBand,
    code: '04',
    title: 'Inventory',
    short: 'Inventory',
    tagline: 'Every unit has a home',
    body: 'SKU master, multi-site stock, QR receive, GPS transfers, lots & serials, and on-chain product passports when pedigree matters.',
    bullets: ['Products & locations', 'Live stock & transfers', 'Lots, GS1, on-chain ready'],
    Mock: InventoryMock,
    icon: Package,
  },
  {
    id: 'net',
    band: 'core' as ModuleBand,
    code: '05',
    title: 'Network',
    short: 'Network',
    tagline: 'Verified trading graph',
    body: 'Company-to-company connections, pricing edges, marketplace reach, and invites — so every PO rides a trusted relationship, not a cold email.',
    bullets: ['Connection graph', 'Pricing & marketplace', 'Invite businesses'],
    Mock: NetworkMock,
    icon: Network,
  },
  {
    id: 'sheq',
    band: 'core' as ModuleBand,
    code: '06',
    title: 'SHEQ',
    short: 'SHEQ',
    tagline: 'ISO 45001-ready control tower',
    body: 'Incidents, hazard risk scores, NCRs and CAPAs in one hub — failed QA inspections auto-raise nonconformances so people, product, and process risk never live in separate silos.',
    bullets: ['Incidents & near-misses', 'HIRARC hazard register', 'NCR + CAPA loop'],
    Mock: SheqMock,
    icon: HardHat,
  },
  {
    id: 'qa',
    band: 'core' as ModuleBand,
    code: '07',
    title: 'Quality & food safety',
    short: 'Quality',
    tagline: 'Inspect · hold · trace · recall',
    body: 'Live inspections that block shipping on hold, HACCP plans with CCPs, lot pedigree graphs, recall drills, and auditor export packs — built for real release gates, not paperwork theatre.',
    bullets: ['QA holds block ship', 'HACCP monitoring', 'Traceability + recall packs'],
    Mock: QualityMock,
    icon: ClipboardCheck,
  },
  {
    id: 'fin',
    band: 'core' as ModuleBand,
    code: '08',
    title: 'Finance',
    short: 'Finance',
    tagline: 'One ledger of truth',
    body: 'Double-entry CoA, journals, AR/AP, payments, bank import, VAT, fixed assets, and management accounts — membership-scoped to your company.',
    bullets: ['Journals & GL', 'Bank allocation', 'Management accounts'],
    Mock: AccountingMock,
    icon: Wallet,
  },
  {
    id: 'prj',
    band: 'core' as ModuleBand,
    code: '09',
    title: 'Projects',
    short: 'Projects',
    tagline: 'Portfolio that ships',
    body: 'Portfolio overview, kanban boards, milestone gates, timesheets, and risk registers — so improvement work and capex land with the same discipline as ops.',
    bullets: ['Portfolio & boards', 'Milestones & gates', 'Timesheets & risk'],
    Mock: ProjectsMock,
    icon: FolderKanban,
  },
  {
    id: 'esg',
    band: 'core' as ModuleBand,
    code: '10',
    title: 'Impact (ESG)',
    short: 'Impact',
    tagline: 'Carbon you can act on',
    body: 'Scope 1–3 style carbon tracking and report packs wired to the same inventory and logistics reality — not a disconnected ESG spreadsheet.',
    bullets: ['Carbon tracking', 'ESG report packs', 'Tied to real ops data'],
    Mock: SustainabilityMock,
    icon: Leaf,
  },
  {
    id: 'bi',
    band: 'core' as ModuleBand,
    code: '11',
    title: 'Intelligence',
    short: 'Insights',
    tagline: 'Signal over noise',
    body: 'Live pulse across network, supply, demand, finance, and ops — plus Super-Cube® leadership development for the humans who run the system.',
    bullets: ['Enterprise health', 'Insights & forecasts', 'Super-Cube® leadership'],
    Mock: IntelligenceMock,
    icon: Brain,
  },
  {
    id: 'mfg',
    band: 'sector' as ModuleBand,
    code: 'S1',
    title: 'Manufacturing',
    short: 'Make',
    tagline: 'Secondary sector · factory physics',
    body: 'BOMs, master production schedules, MRP explosion, work centers, and work orders with OEE-style throughput — how secondary-sector producers run make.',
    bullets: ['BOM & work cells', 'MPS / MRP', 'Work order execution'],
    Mock: ManufacturingMock,
    icon: Factory,
  },
  {
    id: 'dst',
    band: 'sector' as ModuleBand,
    code: 'S2',
    title: 'Distribution',
    short: 'Ship',
    tagline: 'Tertiary sector · door to destination',
    body: 'Inbound and outbound logistics, carriers, fleet & drivers, Incoterms® 2020, and event-level tracking across road, ocean, and air.',
    bullets: ['Inbound & outbound', 'Carriers & fleet', 'Live tracking & OTIF'],
    Mock: DistributionMock,
    icon: Ship,
  },
  {
    id: 'ctr',
    band: 'sector' as ModuleBand,
    code: 'S3',
    title: 'Containers',
    short: 'Containers',
    tagline: 'Last-mile outlet network',
    body: 'Deploy container retail outlets, contractors and resellers, live stock, impact (jobs & meals), and feasibility models — one command centre for the last mile.',
    bullets: ['Map, stock & resellers', 'Food security & jobs impact', 'Deploy feasibility model'],
    Mock: ContainersMock,
    icon: Container,
  },
  {
    id: 'fieldgraph',
    band: 'industry' as ModuleBand,
    code: 'I1',
    title: 'CropAdvisor®',
    short: 'CropAdvisor',
    tagline: 'Agri production OS',
    body: 'Multi-crop fields, estimates, harvest plans, inputs, fleet fuel (L/h · L/km · R/km), labour, regen metrics, and farm-to-buyer trade — primary production without the spreadsheet sprawl.',
    bullets: ['Fields · estimates · harvest', 'Inputs, fleet & labour', 'Regen metrics · trade handoff'],
    Mock: FieldgraphMock,
    icon: Sprout,
  },
  {
    id: 'quarrygraph',
    band: 'industry' as ModuleBand,
    code: 'I2',
    title: 'QuarryAdvisor®',
    short: 'QuarryAdvisor',
    tagline: 'Aggregates & extractives OS',
    body: 'Permanent and temporary sites, batching plants with GPS, reserves, production, plant, weighbridge, fleet fuel, QA, permits, and resource allocation across the pit network.',
    bullets: ['Sites · reserves · production', 'Plant, fleet & weighbridge', 'Temp / batching · GPS allocate'],
    Mock: QuarrygraphMock,
    icon: Mountain,
  },
  {
    id: 'fitgraph',
    band: 'industry' as ModuleBand,
    code: 'I3',
    title: 'GymAdvisor®',
    short: 'GymAdvisor',
    tagline: 'Gym & fitness services OS',
    body: 'Coaches (People dual-write, contracts), members with invites & family booking, memberships (freeze & packs), rooms on the calendar, waitlists, 24h reminders, outcomes & recalls, in-app messaging by system user ID, staff Today PWA, website embed and marketplace listing — fees stay off-platform; SA bills the gym subscription only.',
    bullets: [
      'Portal book / waitlist · family · .ics',
      'Rooms · concurrent coaches · plan vs actual',
      'In-app messages · marketplace · recalls',
    ],
    Mock: FitgraphMock,
    icon: Dumbbell,
  },
  {
    id: 'physiograph',
    band: 'industry' as ModuleBand,
    code: 'I4',
    title: 'PhysioAdvisor®',
    short: 'PhysioAdvisor',
    tagline: 'Physio & allied health OS',
    body: 'Practitioners, POPIA-aware patients, rehab packs & treatment plans (one-click book next), exclusive clinician diaries with rooms, waitlist desk, medical chart (aid, docs, scripts), in-app care messaging, marketplace listing, and clinic website — physio, OT, biokinetics and allied practices.',
    bullets: [
      'Waitlist desk · other clinician · family',
      'Treatment plans · book next · recalls',
      'Rooms · chart · marketplace · messages',
    ],
    Mock: PhysiographMock,
    icon: Stethoscope,
  },
  {
    id: 'dentalgraph',
    band: 'industry' as ModuleBand,
    code: 'I5',
    title: 'DentalAdvisor®',
    short: 'DentalAdvisor',
    tagline: 'Dental practice OS',
    body: 'Dentists, hygienists and staff, POPIA-aware patients, care packs & treatment plans, multi-chair practice diary (no double-book per clinician), waitlist desk, medical chart with scripts, in-app messaging, marketplace listing, and practice website.',
    bullets: [
      'Practice multi-chair · exclusive books',
      'Waitlist desk · treatment-plan book next',
      'Chart · scripts · marketplace · messages',
    ],
    Mock: DentalgraphMock,
    icon: Smile,
  },
  {
    id: 'psychiatrygraph',
    band: 'industry' as ModuleBand,
    code: 'I6',
    title: 'PsychiatryAdvisor®',
    short: 'PsychiatryAdvisor',
    tagline: 'Mental health practice OS',
    body: 'Psychiatrists and psychologists, POPIA-aware patients, therapy packs & treatment plans, exclusive clinician diaries with rooms, waitlist desk, medical chart with scripts, patient portal, in-app messaging, marketplace listing, and practice website.',
    bullets: [
      'Exclusive diaries · rooms · waitlist',
      'Treatment plans · recalls · portal',
      'Chart · scripts · marketplace · messages',
    ],
    Mock: PsychiatrygraphMock,
    icon: BrainCircuit,
  },
  {
    id: 'medicalgraph',
    band: 'industry' as ModuleBand,
    code: 'I7',
    title: 'MedicalAdvisor®',
    short: 'MedicalAdvisor',
    tagline: 'GP & medical practice OS',
    body: 'GPs, specialists and nurses, POPIA-aware patients, care packs & treatment plans, multi-room exclusive clinician diaries, waitlist desk, medical chart with prescriptions linked to visits, patient portal, in-app messaging, marketplace listing, and practice website.',
    bullets: [
      'Multi-room diaries · no double-book',
      'Waitlist · book next · scripts on visits',
      'Portal · marketplace · care messages',
    ],
    Mock: MedicalgraphMock,
    icon: Hospital,
  },
  {
    id: 'hiregraph',
    band: 'industry' as ModuleBand,
    code: 'I8',
    title: 'HireAdvisor®',
    short: 'HireAdvisor',
    tagline: 'Hire / rental marketplace · members free',
    body: 'Suppliers list plant, vehicles, tools, kids party gear (jumping castles, soft play, slides), events kit and more; people rent B2C for free on SA Member. Categories enforce different requirements — castles need flat ground, power, adult supervision and age/weight limits. The listing business pays a 2.5% take-rate on hire GMV. Members pay rental + refundable deposit only — no platform fee.',
    bullets: [
      'Kids party · jumping castles · soft play',
      'Categories · catalogue · B2C bookings',
      'Members free · 2.5% on the listing business · handover pack',
    ],
    Mock: HiregraphMock,
    icon: BriefcaseBusiness,
  },
  {
    id: 'schools',
    band: 'government' as ModuleBand,
    code: 'G1',
    title: 'SchoolAdvisor®',
    short: 'SchoolAdvisor',
    tagline: 'Public sector · NSNP programme OS',
    body: 'SchoolAdvisor® runs only on the government / public-sector pathway: DBE & PEU govern catalogue, menus and compliance; schools run kitchen, learners, approved brands and serve day; SPs deliver against school POs. Not a private industry pack — National → Provincial → Municipal → Local packaging with role-filtered hubs.',
    bullets: [
      'DBE / PEU: catalogue · menus · PEU visits · claims',
      'School kitchen: stock · orders · serve day · prizes',
      'SP supply: PO → deliver → POD · SLA',
    ],
    Mock: SchoolsMock,
    icon: School,
  },
] as const;

const MODULE_SECTION_BANDS: Array<{
  id: Exclude<ModuleBand, 'nav'>;
  title: string;
  blurb: string;
}> = [
  {
    id: 'core',
    title: 'Core OS',
    blurb: 'Platform foundations — trade, ops, finance, people assurance, and insight.',
  },
  {
    id: 'sector',
    title: 'Sector',
    blurb: 'How you make and move — manufacturing, distribution, and container outlets.',
  },
  {
    id: 'industry',
    title: 'Industry',
    blurb:
      'Vertical depth — CropAdvisor®, QuarryAdvisor®, and service Advisors (Fit · Physio · Dental · Psychiatry · Medical) with diaries, waitlist desks, treatment plans, rooms, portals, marketplace listings, and in-app care messages — not brochure modules.',
  },
  {
    id: 'government',
    title: 'Government',
    blurb:
      'Public programmes — SchoolAdvisor® (DBE · school kitchen · SP · NSNP) and Health (DoH). Always Public Sector packaging: National → Provincial → Municipal → Local. Specialist-led setup for agencies; self-serve local school kitchens.',
  },
];

/** Every major platform surface — called out in the systems grid */
const SYSTEMS = [
  {
    icon: Building2,
    title: 'Company OS',
    body: 'Profile, team roles, documents, sales program, billing, risks.',
  },
  {
    icon: Network,
    title: 'Verified network',
    body: 'Connect suppliers & customers. Pricing edges. Marketplace reach.',
  },
  {
    icon: Truck,
    title: 'SRM',
    body: 'Discover, invite, POs, OTIFEF scores, peer ratings, RIAD.',
  },
  {
    icon: ShoppingCart,
    title: 'CRM',
    body: 'Leads, quotes, orders, invoices, loyalty, buyer portal.',
  },
  {
    icon: Package,
    title: 'Inventory',
    body: 'SKU master, multi-site stock, lots, QR receive, GPS transfers.',
  },
  {
    icon: Factory,
    title: 'Manufacturing',
    body: 'BOM, MPS, MRP, work centers, work orders, throughput.',
  },
  {
    icon: Ship,
    title: 'Distribution',
    body: 'Inbound/outbound, carriers, fleet, Incoterms®, live tracking.',
  },
  {
    icon: Workflow,
    title: 'Operations tower',
    body: 'One spine from PO to ship — exceptions first.',
  },
  {
    icon: Container,
    title: 'Containers',
    body: 'Outlet deploy, contractors, resellers, stock, food impact.',
  },
  {
    icon: HardHat,
    title: 'SHEQ',
    body: 'Incidents, HIRARC, NCR/CAPA — ISO 45001-style control.',
  },
  {
    icon: ClipboardCheck,
    title: 'Quality & HACCP',
    body: 'Inspect, hold, release, recall packs. Failed lots stop ships.',
  },
  {
    icon: Wallet,
    title: 'Finance & bank',
    body: 'GL, AR/AP, VAT, bank import, management accounts.',
  },
  {
    icon: Handshake,
    title: 'Sales contractors',
    body: 'Pipeline, quotes, personal commission (4–6% program).',
  },
  {
    icon: Gift,
    title: 'Supply-chain referral',
    body: `${REFERRAL_LEVEL_RATES_PCT[0]}/${REFERRAL_LEVEL_RATES_PCT[1]}/${REFERRAL_LEVEL_RATES_PCT[2]}% of subscription (max ${REFERRAL_TOTAL_CAP_PCT}%).`,
  },
  {
    icon: Fingerprint,
    title: 'On-chain ready',
    body: 'Product passports & PO escrow when pedigree or capital must prove.',
  },
  {
    icon: Brain,
    title: 'Intelligence + SAM',
    body: 'Live pulse, Super-Cube®, and Grok-powered in-app messenger.',
  },
  {
    icon: FolderKanban,
    title: 'Projects',
    body: 'Portfolio, boards, milestones, timesheets, risk registers.',
  },
  {
    icon: Leaf,
    title: 'ESG & impact',
    body: 'Carbon Scope 1–3 style packs on real ops data.',
  },
  {
    icon: BookOpen,
    title: 'Guide',
    body: 'In-app how-to curriculum for every module.',
  },
  {
    icon: CreditCard,
    title: 'Simple ZAR billing',
    body: `${COMPANY_TRIAL_DAYS}d trial · R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/mo · up to 30% prepaid.`,
  },
] as const;


function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00b4d8]">
      {children}
    </p>
  );
}

export default function LandingPage() {
  const [activeModule, setActiveModule] = useState(0);
  const [heroBand, setHeroBand] = useState<'all' | Exclude<ModuleBand, 'nav'>>('all');

  const heroModules = useMemo(() => {
    if (heroBand === 'all') return MODULES;
    return MODULES.filter((m) => m.band === heroBand || m.band === 'nav');
  }, [heroBand]);

  useEffect(() => {
    setActiveModule(0);
  }, [heroBand]);

  useEffect(() => {
    const t = setInterval(() => {
      setActiveModule((i) => (i + 1) % heroModules.length);
    }, 6500);
    return () => clearInterval(t);
  }, [heroModules.length]);

  const featured = heroModules[activeModule] ?? MODULES[0];
  const FeaturedMock = featured.Mock;
  const bandLabel =
    featured.band === 'nav'
      ? 'Navigation'
      : MODULE_BAND_META[featured.band as Exclude<ModuleBand, 'nav'>]?.title ||
        featured.band;

  return (
    <div className="relative z-0 min-h-dvh bg-sa-bg text-sa-text antialiased selection:bg-cyan-100 dark:selection:bg-cyan-500/30">
      <LandingNav />

      {/* ═══════════ HERO ═══════════ */}
      <section
        id="platform"
        className="relative flex flex-col justify-center overflow-x-clip pt-20 sm:pt-[5.25rem] lg:min-h-[calc(100svh-0.5rem)]"
      >
        {/* Light / dark washes */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(0,180,216,0.18),transparent_55%)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(0,180,216,0.14),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(#cbd5e1_0.6px,transparent_0.6px)] bg-[length:18px_18px] opacity-[0.35] dark:bg-[radial-gradient(#404040_0.6px,transparent_0.6px)] dark:opacity-[0.25]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-[#00b4d8]/10 blur-3xl dark:bg-[#00b4d8]/15"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-16 bottom-1/4 h-64 w-64 rounded-full bg-violet-200/20 blur-3xl dark:bg-[#00b4d8]/8"
          aria-hidden
        />

        <div className="relative z-[1] mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
          {/* Hero: 1/3 text · 2/3 images — sized to fit first viewport */}
          <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-10 xl:gap-12">
            {/* ── Text (1/3) ── */}
            <div className="flex flex-col justify-center text-center lg:col-span-4 lg:text-left">
              <h1 className="text-[2.35rem] font-black leading-[1.04] tracking-[-0.045em] text-slate-900 sm:text-5xl md:text-6xl lg:text-[2.75rem] xl:text-[3.25rem] 2xl:text-[3.5rem] lg:tracking-[-0.05em] dark:text-white">
                The world&apos;s most trusted
                <span className="mt-1.5 block bg-gradient-to-r from-[#00b4d8] via-[#0096c7] to-[#0077b6] bg-clip-text text-transparent sm:mt-2">
                  supplier advice — and OS.
                </span>
              </h1>

              <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-slate-600 sm:mt-5 sm:text-base lg:mx-0 dark:text-neutral-400">
                SupplierAdvisor® unites{' '}
                <strong className="font-semibold text-slate-900 dark:text-white">B2B</strong>,{' '}
                <strong className="font-semibold text-slate-900 dark:text-white">B2G</strong>, and{' '}
                <strong className="font-semibold text-slate-900 dark:text-white">B2C</strong> on one
                verified network — watch the key modules rotate live.
              </p>

              <div className="mt-6 flex flex-col items-stretch gap-2.5 sm:mx-auto sm:max-w-md sm:flex-row sm:items-center lg:mx-0 lg:max-w-none lg:flex-col xl:flex-row">
                <Link
                  href="/onboarding?type=business"
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#00b4d8] px-6 py-3 text-[15px] font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:bg-[#0099b8] active:scale-[0.99] sm:px-7 sm:py-3.5 sm:text-base"
                >
                  Start {COMPANY_TRIAL_DAYS}-day free trial
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-[15px] font-semibold text-slate-800 shadow-sm transition-all hover:border-[#00b4d8] hover:text-[#0077b6] dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:hover:border-[#00b4d8] sm:px-7 sm:py-3.5 sm:text-base"
                >
                  Book a demo
                </Link>
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-neutral-400">
                Customer or member?{' '}
                <Link
                  href="/me"
                  className="font-bold text-[#0077b6] underline decoration-sky-200 underline-offset-4 hover:text-[#00b4d8]"
                >
                  Create a free SA Member account
                </Link>
                {' '}
                — gym, dentist, hire. No company needed.
              </p>

              <p className="mt-4 text-xs leading-relaxed text-slate-500 sm:text-sm dark:text-neutral-500">
                Not Excel. Not accounting-only. Not a multi-year ERP project.{' '}
                <a
                  href="#compare"
                  className="font-semibold text-[#0077b6] underline decoration-sky-200 underline-offset-4 hover:text-[#00b4d8]"
                >
                  See how we compare
                </a>
                .
              </p>
            </div>

            {/* ── Images (2/3) — compact hero mocks that fit the viewport ── */}
            <div className="min-w-0 lg:col-span-8">
              <div className="relative">
                <div
                  className="pointer-events-none absolute -inset-2 rounded-[2rem] bg-gradient-to-tr from-cyan-200/40 via-transparent to-violet-200/30 blur-2xl sm:-inset-3 dark:from-cyan-500/15 dark:to-[#00b4d8]/10"
                  aria-hidden
                />

                {/* Band navigation: Core · Sector · Industry · Government · All */}
                <div className="relative mb-2 flex flex-wrap items-center gap-1 sm:mb-2.5 sm:gap-1.5">
                  {(
                    [
                      { id: 'all' as const, label: 'All modules' },
                      { id: 'core' as const, label: 'Core OS' },
                      { id: 'sector' as const, label: 'Sector' },
                      { id: 'industry' as const, label: 'Industry' },
                      { id: 'government' as const, label: 'Government' },
                    ] as const
                  ).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setHeroBand(b.id)}
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all touch-manipulation sm:px-3 sm:py-1.5 sm:text-[11px] ${
                        heroBand === b.id
                          ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-[#0077b6] dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300'
                      }`}
                      aria-pressed={heroBand === b.id}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                {/* Module chrome — compact */}
                <div className="relative mb-2 flex min-h-[3.25rem] flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 shadow-sm sm:mb-2.5 sm:min-h-[3.5rem] sm:rounded-2xl sm:px-4 dark:border-neutral-800 dark:bg-neutral-950/95">
                  <div className="flex min-w-0 items-center gap-2">
                    <featured.icon className="h-4 w-4 shrink-0 text-[#00b4d8] sm:h-5 sm:w-5" />
                    <div className="min-w-0">
                      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:text-[10px]">
                        {bandLabel} · {featured.code} /{' '}
                        {String(heroModules.length).padStart(2, '0')}
                      </div>
                      <div className="truncate text-xs font-black text-slate-900 sm:text-sm dark:text-white">
                        {featured.title}
                        <span className="ml-1.5 font-semibold text-[#00b4d8] sm:ml-2">
                          {featured.tagline}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800 sm:px-2.5 sm:py-1 sm:text-[10px] dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>
                    Live
                  </span>
                </div>

                {/* Three scene cards — hide on phone (stacked height blows the hero) */}
                <div className="mb-2 hidden w-full sm:mb-2.5 sm:block">
                  <ModuleGallery moduleId={featured.id} variant="hero" />
                </div>

                {/* Main product frame — hero-sized, fixed HxW */}
                <div className="relative w-full overflow-hidden rounded-[1.25rem] border border-slate-200/90 bg-white shadow-xl shadow-slate-200/70 sm:rounded-[1.5rem] dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-black/50">
                  <ProductMockShell variant="hero">
                    <FeaturedMock />
                  </ProductMockShell>
                </div>

                {/* Module picker */}
                <div className="mt-2 -mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 scrollbar-thin sm:mt-2.5 sm:gap-1.5 sm:flex-wrap sm:justify-center lg:justify-start">
                  {heroModules.map((m, i) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setActiveModule(i)}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold transition-all touch-manipulation sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-xs ${
                        i === activeModule
                          ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm shadow-cyan-200/60'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-[#0077b6] dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300'
                      }`}
                      aria-pressed={i === activeModule}
                      aria-label={`Show ${m.title} module`}
                    >
                      <m.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      {m.short}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-center text-[10px] text-slate-400 sm:text-[11px] lg:text-left">
                  Auto-rotates · Core, Sector &amp; Industry · fixed size
                </p>
              </div>
            </div>
          </div>

          {/* Accurate commercial strip under hero (not competing with headline) */}
          <div className="mt-8 flex flex-col items-center gap-3 border-t border-slate-200/80 pt-6 sm:mt-10 sm:pt-8 dark:border-neutral-800">
            <p className="text-center text-sm text-slate-500">
              Core OS from {formatZar(COMPANY_SUBSCRIPTION_MONTHLY_ZAR)}/mo ·
              Industry Packs +{formatZar(INDUSTRY_PACK_MONTHLY_ZAR)}/mo each ·
              Paystack &amp; Apple Pay · {COMPANY_TRIAL_DAYS}-day free trial ·
              first {FOUNDING_FREE_COMPANY_LIMIT} companies free for life ·{' '}
              <a
                href="#pricing"
                className="font-semibold text-[#0077b6] underline decoration-sky-200 underline-offset-4 hover:text-[#00b4d8]"
              >
                Pricing
              </a>
            </p>
            <FoundingCounterStrip />
          </div>

          {/* Proof bar */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:mt-10">
            {[
              { k: '14+', l: 'operating systems' },
              { k: 'B2B·G·C', l: 'one verified fabric' },
              { k: `${COMPANY_TRIAL_DAYS}d`, l: 'free full trial' },
              {
                k: 'R' + COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
                l: 'Core OS / mo',
              },
            ].map((s) => (
              <div
                key={s.l}
                className="rounded-2xl border border-slate-200/90 bg-white/80 px-3 py-3 text-center shadow-sm backdrop-blur-sm sm:px-4"
              >
                <div className="text-lg font-black tracking-tight text-slate-900 sm:text-xl">
                  {s.k}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[11px]">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ProductVideo />

      {/* ═══════════ B2B · B2G · B2C ═══════════ */}
      <section
        id="markets"
        className="flex min-h-svh flex-col justify-center scroll-mt-20 border-t border-slate-200 bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-10"
      >
        <div className="mx-auto w-full max-w-screen-2xl">
          <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
            <SectionLabel>Who the network serves</SectionLabel>
            <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900 sm:text-5xl">
              B2B. B2G. B2C.
              <span className="mt-2 block text-slate-400">One trusted fabric.</span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
              Most platforms pick one market. SupplierAdvisor® is built so private trade,
              public procurement, and consumer trust share the same verification,
              traceability, and operating discipline.
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {[
              {
                code: 'B2B',
                title: 'Business to business',
                body: 'Manufacturers, distributors, traders, and brands run the full OS — network, buy/sell, inventory, make, ship, finance, SHEQ, and quality — with counterparties you can score and prove.',
                points: [
                  'Verified company graph & OTIFEF ratings',
                  'POs, quotes, orders, invoices on the same books',
                  'Lot holds that stop the ship when QA fails',
                ],
                href: '/onboarding?lane=b2b',
                cta: 'Register your company',
                icon: Factory,
              },
              {
                code: 'B2G',
                title: 'Business to government',
                body: 'Public entities and suppliers need transparent procurement, accountable spend, and audit-ready trails — not email chains and disconnected spreadsheets.',
                points: [
                  'Transparent supplier discovery & handshakes',
                  'Documented trade and performance scores',
                  'SHEQ, NCR/CAPA, and export packs for scrutiny',
                ],
                href: '/onboarding?lane=b2g',
                cta: 'Request government access',
                icon: Landmark,
              },
              {
                code: 'B2C',
                title: 'Business to consumer',
                body: 'One free personal wallet. Link any business on this platform to manage that account — shop, subscriptions, bookings and medical records. No company. If you also run a business, that workspace stays separate.',
                points: [
                  'Free PWA — install on your phone, no company, no card',
                  'Link any gym, clinic, hire desk or shop to this wallet',
                  'Book, buy, records and push alerts — same login',
                ],
                href: '/me',
                cta: 'Create free SA Member account',
                icon: Users2,
              },
            ].map((m) => (
              <div
                key={m.code}
                className="group flex min-h-[22rem] flex-col rounded-[1.75rem] border border-slate-200 bg-gradient-to-b from-white to-sky-50/40 p-7 sm:p-8 shadow-sm transition-all hover:border-[#00b4d8]/45 hover:shadow-lg hover:shadow-sky-100/80 lg:min-h-[28rem]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs font-black tracking-[0.2em] text-[#00b4d8]">
                    {m.code}
                  </span>
                  <m.icon className="h-5 w-5 text-slate-400 transition-colors group-hover:text-[#00b4d8]" />
                </div>
                <h3 className="mt-4 text-2xl font-black tracking-tight text-slate-900">
                  {m.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{m.body}</p>
                <ul className="mt-5 space-y-2">
                  {m.points.map((pt) => (
                    <li key={pt} className="flex gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      {pt}
                    </li>
                  ))}
                </ul>
                <Link
                  href={m.href}
                  className="mt-7 inline-flex items-center gap-1.5 text-sm font-bold text-[#00b4d8] hover:text-[#0077b6]"
                >
                  {m.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ SA MEMBER APP ═══════════ */}
      <section
        id="member-app"
        className="flex min-h-svh flex-col justify-center scroll-mt-20 border-t border-slate-200 bg-[#f8fafc] px-4 py-16 sm:px-6 sm:py-20 lg:px-10"
      >
        <div className="mx-auto w-full max-w-screen-2xl">
          <div className="mx-auto mb-6 max-w-3xl text-center sm:mb-8">
            <SectionLabel>SA Member</SectionLabel>
            <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900 sm:text-5xl">
              Your personal wallet
              <span className="mt-2 block text-[#00b4d8]">for every business on this platform.</span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Create one free SA Member profile. Link it to any gym, clinic,
              hire desk or shop on SupplierAdvisor — then manage that account:
              book, buy, subscriptions, medical records and push alerts. Desks
              can still print a QR or send WhatsApp. You never pay us.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              {
                icon: Smartphone,
                t: 'Install as an app',
                b: 'Add to the home screen. Full-screen PWA for shop, brands, check-in and your profile.',
              },
              {
                icon: BadgeCheck,
                t: 'Create & verify yourself',
                b: 'Name, email, phone, city. SA ID via VerifyNow or passport via Didit. Hire desks see the badge.',
              },
              {
                icon: BriefcaseBusiness,
                t: 'Hire golden path',
                b: 'Request → docs → approved → pay → out → return → done. Next action, deposit, and documents on the phone.',
              },
              {
                icon: ShoppingCart,
                t: 'Shop sale & hire',
                b: 'Browse what brands are selling or hiring out, and listed gyms and clinics — in the same app.',
              },
              {
                icon: QrCode,
                t: 'Link any business',
                b: 'Search a company in the app, scan a desk QR, or tap Add to wallet on their public page. One profile, many accounts.',
              },
              {
                icon: Stethoscope,
                t: 'Book your Advisor',
                b: 'Medical, dental, physio, psychiatry and gym — open diary slots on your phone. Same path the desk uses.',
              },
              {
                icon: Heart,
                t: 'Your medical information',
                b: 'Allergies, scripts, medical aid and care notes your practice shares — on the phone, not only at reception.',
              },
              {
                icon: Bell,
                t: 'Push notifications',
                b: 'Appointment reminders, waitlist offers and hire updates on the device — even when the app is closed.',
              },
              {
                icon: Fingerprint,
                t: 'Free for members',
                b: 'No subscription, no platform take-rate. Brands charge their own gym, clinic or hire prices. You pay them — not us.',
              },
            ].map((f) => (
              <div
                key={f.t}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
              >
                <f.icon className="h-5 w-5 text-[#00b4d8]" />
                <h3 className="mt-3 text-base font-black text-slate-900">{f.t}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{f.b}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href="/me"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00b4d8] px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 hover:bg-[#0099b8]"
            >
              Create free SA Member account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/join"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-3.5 text-sm font-bold text-slate-800 hover:border-[#00b4d8]"
            >
              I run a gym, clinic or hire desk
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════ WHY JOIN ═══════════ */}
      <section
        id="why-join"
        className="flex min-h-svh flex-col justify-center scroll-mt-20 border-t border-slate-200 bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-10"
      >
        <div className="mx-auto w-full max-w-screen-2xl">
          <div className="mx-auto mb-6 max-w-3xl text-center sm:mb-8">
            <SectionLabel>Why join</SectionLabel>
            <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900 sm:text-5xl">
              Compelling reasons to run
              <span className="mt-2 block text-[#00b4d8]">on SupplierAdvisor®</span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Not another dashboard. The operating system for people who measure trust —
              and refuse to separate commerce from quality, safety, and proof.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                icon: ShieldCheck,
                t: 'Trust is a control, not a brochure',
                b: 'Verification, peer stars, OTIFEF, and RIAD risk live where you buy and sell — so bad counterparties show up before the next PO.',
              },
              {
                icon: Link2,
                t: 'When a lot fails, the ship stops',
                b: 'QA holds and HACCP gates block inventory and outbound. Recall drills and pedigree graphs are operational, not theatre.',
              },
              {
                icon: Network,
                t: 'One graph for B2B, B2G & B2C',
                b: 'Invite suppliers and customers, connect public buyers, and give consumers a path into verified brands — same fabric of trust.',
              },
              {
                icon: Workflow,
                t: 'Full stack, zero silos',
                b: 'Network, SRM, CRM, inventory, manufacturing, distribution, finance, SHEQ, projects, ESG, intelligence — plus industry packs for agri, quarry, gyms, and clinical practices — share one workspace.',
              },
              {
                icon: Stethoscope,
                t: 'Industry & programme solutions that operate',
                b: 'CropAdvisor®, QuarryAdvisor®, GymAdvisor®, HireAdvisor® (hire marketplace · members free · 2.5% on the listing business), clinic Advisors, and SchoolAdvisor® (public-sector NSNP: DBE · school · SP). Most Advisors bill the operating company a subscription; members and patients never pay SupplierAdvisor®.',
              },
              {
                icon: Fingerprint,
                t: 'On-chain when capital must prove',
                b: 'Optional product passports and PO escrow when authenticity or settlement need stronger proof — without forcing crypto on every workflow.',
              },
              {
                icon: Building2,
                t: 'Built for multi-entity groups',
                b: 'Separate company workspaces, team roles, and membership-scoped data — groups and brands stay clean, not tangled in one login.',
              },
              {
                icon: HardHat,
                t: 'SHEQ operators actually use',
                b: 'Incidents, hazards, NCR/CAPA wired to stock and quality — ISO-minded control without a second system for safety.',
              },
              {
                icon: Gift,
                t: 'Paid to grow a good network',
                b: 'Invite real partners; earn on platform subscriptions (L1 6% · L2 3% · L3 1%). Sales contractors earn personal product commission separately.',
              },
              {
                icon: CreditCard,
                t: 'Simple ZAR economics',
                b: `${COMPANY_TRIAL_DAYS}-day free trial, then from R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/mo — or save up to 30% prepaid. First ${FOUNDING_FREE_COMPANY_LIMIT} companies free for life.`,
              },
              {
                icon: Container,
                t: 'Last-mile that feeds people',
                b: 'Container outlets, contractors, resellers, and impact metrics — food security and jobs on the same command centre as inventory.',
              },
              {
                icon: Brain,
                t: 'Intelligence + human help',
                b: 'Live pulse across the enterprise, Super-Cube® leadership development, and SAM (Grok) for in-app how-to — ramp without a manual.',
              },
              {
                icon: Globe,
                t: 'Africa-ready, world-class',
                b: 'Paystack ZAR billing, local verification patterns, and the discipline global buyers expect — so African trade scales with proof.',
              },
            ].map((r) => (
              <div
                key={r.t}
                className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4 shadow-sm transition-all hover:border-[#00b4d8]/40 hover:shadow-md sm:p-5"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-[#00b4d8]">
                  <r.icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900 sm:text-base">{r.t}</h3>
                <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600 sm:text-[13px]">{r.b}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/onboarding?type=business"
              className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-7 py-3.5 text-sm font-bold text-white shadow-md shadow-cyan-200/50 hover:bg-[#0099b8]"
            >
              Join the trusted network <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#systems"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-3.5 text-sm font-bold text-slate-800 hover:border-[#00b4d8]"
            >
              See every system
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════ COMPARE vs Excel / Xero / ERP ═══════════ */}
      <ComparePlatforms />

      <SocialProofStrip />

      <ReplaceStackDiagram />

      <RoiCalculator />

      {/* ═══════════ SYSTEMS GRID ═══════════ */}
      <section id="systems" className="relative border-t border-slate-200 bg-[#f8fafc] py-20 sm:py-28">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <SectionLabel>Full stack</SectionLabel>
            <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900 sm:text-5xl md:text-6xl">
              Every critical system.
              <span className="mt-2 block text-slate-500">One company workspace.</span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg">
              Not a pile of apps. A single operating system for how goods, money, and trust
              move through African and global supply chains.
            </p>
          </div>

          <div className="grid gap-px overflow-hidden rounded-3xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            {SYSTEMS.map((s) => (
              <div
                key={s.title}
                className="group bg-white p-5 transition-colors hover:bg-sky-50/40 sm:p-6"
              >
                <s.icon className="mb-4 h-5 w-5 text-[#00b4d8] transition-transform group-hover:scale-110" />
                <h3 className="text-sm font-bold text-slate-900 sm:text-base">{s.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500 sm:text-[13px]">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURED MODULE ROTATOR ═══════════ */}
      <section className="relative border-t border-slate-200 bg-[#f8fafc] py-16 sm:py-24">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-4">
              <SectionLabel>Mission control</SectionLabel>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl md:text-[2.75rem]">
                Built like a mission.
                <span className="mt-1 block text-[#00b4d8]">Run like a business.</span>
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                Every module shares the same command chrome — telemetry, workbenches,
                and clear process steps. Switch systems without relearning the UI.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {heroModules.map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActiveModule(i)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all ${
                      i === activeModule
                        ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-[#0077b6]'
                    }`}
                  >
                    {m.short}
                  </button>
                ))}
              </div>
              <div className="mt-8 border-l-2 border-[#00b4d8]/50 pl-5">
                <div className="font-mono text-[10px] tracking-widest text-slate-400">
                  {featured.code}
                </div>
                <h3 className="mt-1 text-xl font-black text-slate-900">{featured.title}</h3>
                <p className="mt-1 text-sm font-semibold text-[#00b4d8]">{featured.tagline}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{featured.body}</p>
              </div>
            </div>
            <div className="relative min-w-0 lg:col-span-8">
              <div className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-[#00b4d8]/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/80">
                <ProductMockShell>
                  <FeaturedMock />
                </ProductMockShell>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ MODULES — Core · Sector · Industry · Bespoke ═══════════ */}
      <section
        id="modules"
        className="scroll-mt-20 border-t border-slate-200 bg-white py-20 dark:border-neutral-800 dark:bg-black sm:py-28"
      >
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
            <SectionLabel>Modules</SectionLabel>
            <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900 dark:text-white sm:text-5xl">
              Core OS · Sector · Industry
              <span className="mt-2 block text-[#00b4d8]">
                Government &amp; bespoke by design
              </span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-neutral-400 sm:text-lg">
              Same packaging stack as setup — pick the layer that matches how you trade,
              then dive into the modules inside each band. Public programmes and fully
              custom process design are specialist-led.
            </p>
          </div>

          {/* Stack strip — mirrors Setup section (5 steps) */}
          <div className="mx-auto mb-10 max-w-5xl sm:mb-12">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50/60 shadow-sm dark:border-neutral-800 dark:from-neutral-950 dark:via-black dark:to-neutral-950">
              <div className="grid divide-y divide-slate-100 dark:divide-neutral-800 sm:grid-cols-5 sm:divide-x sm:divide-y-0">
                {MODULE_OPTIONS.map((t) => (
                  <a
                    key={t.id}
                    href={t.href}
                    className={`flex flex-col items-center px-2 py-5 text-center transition-colors sm:px-3 sm:py-6 ${
                      t.id === 'core'
                        ? 'bg-[#00b4d8] text-white hover:bg-[#0099b8]'
                        : t.id === 'government'
                          ? 'bg-violet-50 text-violet-950 hover:bg-violet-100/80 dark:bg-violet-500/15 dark:text-violet-100 dark:hover:bg-violet-500/20'
                          : t.id === 'bespoke'
                            ? 'bg-amber-50 text-amber-950 hover:bg-amber-100/80 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/15'
                            : t.id === 'industry'
                              ? 'bg-white text-slate-900 hover:bg-emerald-50/50 dark:bg-black dark:text-white dark:hover:bg-emerald-500/10'
                              : 'bg-white text-slate-900 hover:bg-sky-50/50 dark:bg-black dark:text-white dark:hover:bg-sky-500/10'
                    }`}
                  >
                    <span className="font-mono text-[10px] font-bold tracking-widest opacity-70">
                      {t.step}
                    </span>
                    <span className="mt-1 text-sm font-black sm:text-base">{t.title}</span>
                    <span className="mt-1 text-[11px] font-semibold opacity-80">{t.price}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Five distinct option cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {MODULE_OPTIONS.map((opt) => {
              const Icon =
                opt.id === 'core'
                  ? Layers
                  : opt.id === 'sector'
                    ? Package
                    : opt.id === 'industry'
                      ? Factory
                      : opt.id === 'government'
                        ? Landmark
                        : Puzzle;
              const bandMods =
                opt.specialist || opt.id === 'bespoke'
                  ? []
                  : MODULES.filter((m) => m.band === opt.id);
              const checkTone =
                opt.id === 'government'
                  ? 'text-violet-600 dark:text-violet-400'
                  : opt.id === 'bespoke'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400';
              const ctaTone =
                opt.id === 'government'
                  ? 'text-violet-700 hover:text-violet-600 dark:text-violet-300'
                  : opt.id === 'bespoke'
                    ? 'text-amber-700 hover:text-amber-600 dark:text-amber-300'
                    : 'text-[#00b4d8] hover:text-[#0077b6]';
              return (
                <div
                  key={opt.id}
                  id={
                    opt.id === 'bespoke'
                      ? 'modules-bespoke'
                      : opt.id === 'government'
                        ? 'modules-government'
                        : undefined
                  }
                  className={`flex flex-col rounded-[1.75rem] border p-5 sm:p-6 ${opt.tone} ${
                    opt.specialist ? 'scroll-mt-24' : ''
                  }`}
                >
                  <div
                    className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl ${opt.iconTone}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <p
                    className={`text-[10px] font-black uppercase tracking-widest ${
                      opt.id === 'government'
                        ? 'text-violet-700 dark:text-violet-300'
                        : opt.id === 'bespoke'
                          ? 'text-amber-800 dark:text-amber-300'
                          : 'text-[#0077b6] dark:text-[#00b4d8]'
                    }`}
                  >
                    {opt.eyebrow}
                  </p>
                  <h3 className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                    {opt.title}
                  </h3>
                  <p className="mt-0.5 text-xs font-bold text-slate-500 dark:text-neutral-400">
                    {opt.price}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-neutral-400">
                    {opt.body}
                  </p>

                  {bandMods.length > 0 ? (
                    <ul className="mt-4 flex-1 space-y-2">
                      {bandMods.map((m) => (
                        <li key={m.id}>
                          <a
                            href={`#module-${m.id}`}
                            className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white/80 px-2.5 py-2 text-sm transition-colors hover:border-[#00b4d8]/40 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-[#00b4d8]/40"
                          >
                            <m.icon className="h-3.5 w-3.5 shrink-0 text-[#00b4d8]" />
                            <span className="min-w-0 flex-1 truncate font-semibold text-slate-800 dark:text-neutral-100">
                              {m.title}
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-neutral-600" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700 dark:text-neutral-300">
                      {opt.bullets.map((line) => (
                        <li key={line} className="flex gap-2">
                          <CheckCircle2
                            className={`mt-0.5 h-4 w-4 shrink-0 ${checkTone}`}
                          />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <Link
                    href={
                      opt.specialist
                        ? opt.id === 'government'
                          ? 'mailto:hello@supplieradvisor.com?subject=Government%20setup%20%E2%80%94%20SupplierAdvisor'
                          : '/demo'
                        : opt.href
                    }
                    className={`mt-6 inline-flex items-center gap-1.5 text-sm font-bold ${ctaTone}`}
                  >
                    {opt.cta} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Deep dive: modules by band */}
          <div className="mt-20 space-y-20 sm:mt-24 sm:space-y-24 lg:space-y-28">
            {MODULE_SECTION_BANDS.map((band) => {
              const bandModules = MODULES.filter((m) => m.band === band.id);
              return (
                <div
                  key={band.id}
                  id={`modules-${band.id}`}
                  className="scroll-mt-24"
                >
                  <div className="mb-10 flex flex-col gap-3 border-b border-slate-100 pb-6 dark:border-neutral-800 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p
                        className={`mb-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${MODULE_BAND_META[band.id].accent}`}
                      >
                        {band.title}
                      </p>
                      <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                        {band.title} modules
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-neutral-400 sm:text-base">
                        {band.blurb}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] font-bold text-slate-400">
                      {String(bandModules.length).padStart(2, '0')} modules
                    </span>
                  </div>

                  <div className="space-y-16 sm:space-y-20">
                    {bandModules.map((mod) => (
                      <div
                        key={mod.id}
                        id={`module-${mod.id}`}
                        className="grid scroll-mt-24 items-start gap-8 lg:grid-cols-12 lg:gap-10 xl:gap-12"
                      >
                        <div className="lg:col-span-4 lg:sticky lg:top-28">
                          <div className="mb-4 flex items-center gap-3">
                            <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-slate-400">
                              {mod.code}
                            </span>
                            <span className="h-px w-10 bg-slate-200 dark:bg-neutral-700" />
                            <mod.icon className="h-4 w-4 text-[#00b4d8]" />
                          </div>
                          <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl xl:text-4xl">
                            {mod.title}
                          </h3>
                          <p className="mt-2 text-base font-semibold text-[#00b4d8] sm:text-lg">
                            {mod.tagline}
                          </p>
                          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600 dark:text-neutral-400 sm:text-base">
                            {mod.body}
                          </p>
                          <ul className="mt-6 space-y-2.5">
                            {mod.bullets.map((b) => (
                              <li
                                key={b}
                                className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-neutral-300"
                              >
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                {b}
                              </li>
                            ))}
                          </ul>
                          <Link
                            href={
                              mod.band === 'government'
                                ? mod.id === 'schools'
                                  ? '/onboarding?type=school'
                                  : '/onboarding?type=government'
                                : '/onboarding?type=business'
                            }
                            className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-[#0077b6] transition-colors hover:text-[#00b4d8] dark:text-[#00b4d8]"
                          >
                            Join to use {mod.short}
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </div>

                        <div className="min-w-0 lg:col-span-8">
                          <div className="mb-3 overflow-hidden rounded-[1.5rem] border border-slate-200/90 bg-white shadow-lg shadow-slate-200/60 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-black/40">
                            <ProductMockShell>
                              <mod.Mock />
                            </ProductMockShell>
                          </div>
                          <ModuleGallery moduleId={mod.id} />
                          <p className="mt-3 text-center text-[11px] text-slate-400 sm:text-left">
                            Product frame + three live views · fixed height · not stock photos
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-16 flex flex-wrap items-center justify-center gap-3 sm:mt-20">
            <Link
              href="/onboarding?type=business"
              className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-7 py-3.5 text-sm font-bold text-white shadow-md shadow-cyan-200/50 hover:bg-[#0099b8] dark:shadow-cyan-900/30"
            >
              Start free trial — unlock all modules
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-3.5 text-sm font-bold text-slate-800 hover:border-[#00b4d8] dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            >
              See pricing
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════ CORE OS · SECTOR · INDUSTRY · GOVERNMENT · BESPOKE ═══════════ */}
      <section
        id="packaging"
        className="scroll-mt-20 border-t border-slate-200 bg-white py-20 dark:border-neutral-800 dark:bg-black sm:py-28"
      >
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
            <SectionLabel>Setup SupplierAdvisor®</SectionLabel>
            <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900 sm:text-5xl">
              Core OS · Sector · Industry
              <span className="mt-2 block text-[#00b4d8]">
                Government &amp; bespoke by design
              </span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
              Every company starts with the same Core operating system, then layers
              sector and industry packs for how you actually trade. Public-sector
              programmes and fully custom process design are specialist-led —
              contact us to get set up.
            </p>
          </div>

          {/* Stack visual */}
          <div className="mx-auto mb-12 max-w-4xl">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50/60 shadow-sm dark:border-neutral-800 dark:from-neutral-950 dark:via-black dark:to-neutral-950">
              <div className="grid divide-y divide-slate-100 dark:divide-neutral-800 sm:grid-cols-5 sm:divide-x sm:divide-y-0">
                {[
                  {
                    step: '01',
                    title: 'Core OS',
                    price: `R${CORE_OS_MONTHLY_ZAR}/mo`,
                    tone: 'bg-[#00b4d8] text-white',
                  },
                  {
                    step: '02',
                    title: 'Sector',
                    price: 'Shape the workspace',
                    tone: 'bg-white text-slate-900 dark:bg-black dark:text-white',
                  },
                  {
                    step: '03',
                    title: 'Industry',
                    price: `+R${INDUSTRY_PACK_MONTHLY_ZAR}/mo each`,
                    tone: 'bg-white text-slate-900 dark:bg-black dark:text-white',
                  },
                  {
                    step: '04',
                    title: 'Government',
                    price: 'Specialist setup',
                    tone: 'bg-violet-50 text-violet-950 dark:bg-violet-500/15 dark:text-violet-100',
                  },
                  {
                    step: '05',
                    title: 'Bespoke',
                    price: 'Process design',
                    tone: 'bg-amber-50 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100',
                  },
                ].map((t) => (
                  <div
                    key={t.step}
                    className={`flex flex-col items-center px-3 py-5 text-center sm:py-6 ${t.tone}`}
                  >
                    <span className="font-mono text-[10px] font-bold tracking-widest opacity-70">
                      {t.step}
                    </span>
                    <span className="mt-1 text-sm font-black sm:text-base">
                      {t.title}
                    </span>
                    <span className="mt-1 text-[11px] font-semibold opacity-80">
                      {t.price}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Core OS */}
            <div className="rounded-[1.75rem] border border-slate-200 bg-[#f8fafc] p-6 dark:border-neutral-800 dark:bg-neutral-950 sm:p-7 lg:col-span-1">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00b4d8]/15 text-[#0077b6] dark:bg-[#00b4d8]/20 dark:text-[#00b4d8]">
                <Layers className="h-5 w-5" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#0077b6] dark:text-[#00b4d8]">
                Always included
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                Core OS · R{CORE_OS_MONTHLY_ZAR}/mo
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-neutral-400">
                The shared operating system every company gets: Control Tower,
                Company (identity, modules, billing), Network, Suppliers,
                Customers, Inventory, Operations, Quality, Finance, Intelligence,
                and Guide — one workspace, one trust fabric.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-neutral-300">
                {[
                  `${COMPANY_TRIAL_DAYS}-day free trial`,
                  'Module toggles for your team',
                  'Paystack billing · Apple Pay ready',
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00b4d8]" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/onboarding?type=business"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-[#00b4d8] hover:text-[#0077b6]"
              >
                Start with Core OS <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Sector + Industry */}
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-black sm:p-7 lg:col-span-1">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-[#00b4d8] dark:bg-sky-500/15">
                <Package className="h-5 w-5" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#0077b6] dark:text-[#00b4d8]">
                Self-serve packaging
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                Sector &amp; industries
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-neutral-400">
                Pick your economic sector, then one or more industries. Industry
                Packs unlock CropAdvisor®, QuarryAdvisor®, GymAdvisor®, HireAdvisor® and clinic
                Advisors. Choose <strong>Public Sector</strong> for SchoolAdvisor®
                (NSNP / DBE) and government programmes — at +R
                {INDUSTRY_PACK_MONTHLY_ZAR}/mo each for industry packs.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {OS_SECTORS.map((s) => (
                  <span
                    key={s.id}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                      s.id === 'public_sector'
                        ? 'border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-600 dark:bg-violet-950 dark:text-violet-100'
                        : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
                    }`}
                  >
                    {s.label}
                    {s.id === 'public_sector' ? ' · SchoolAdvisor®' : ''}
                  </span>
                ))}
              </div>
              <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-neutral-300">
                {[
                  'Primary · Secondary · Tertiary · Quaternary · Public Sector',
                  'Multi-industry companies supported',
                  'Packs: agri, fitness, clinics, ESG & public procurement',
                  'SchoolAdvisor® only via Public Sector (government process)',
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00b4d8]" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/industries"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-[#00b4d8] hover:text-[#0077b6]"
              >
                Explore industries <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Government + Bespoke */}
            <div className="rounded-[1.75rem] border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-6 shadow-sm sm:p-7 lg:col-span-1">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-800">
                <Landmark className="h-5 w-5" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">
                Specialist-led
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-900">
                Government &amp; bespoke design
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                National, provincial, municipal, and local programme workspaces —
                SchoolAdvisor® (DBE / PEU, school kitchens, NSNP SPs) and DoH
                facilities — plus fully custom process design for complex groups.
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-violet-100 bg-white/90 px-3.5 py-3">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <School className="h-4 w-4 text-violet-700" />
                    SchoolAdvisor® &amp; government programmes
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                    Public Sector packaging only: National → Provincial → Municipal →
                    Local. SchoolAdvisor® kitchen, catalogue, PEU and SP roles —
                    never private-company packaging.
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50/50 px-3.5 py-3">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <Puzzle className="h-4 w-4 text-amber-700" />
                    Bespoke process design
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                    Custom workflows, integrations, and multi-entity operating
                    models tailored to how your group actually runs.
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm font-semibold text-violet-950">
                To get set up for government or bespoke design, contact us:
              </p>
              <a
                href="mailto:hello@supplieradvisor.com?subject=Government%20%2F%20bespoke%20setup%20%E2%80%94%20SupplierAdvisor"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-violet-700 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-violet-800"
              >
                <Mail className="h-4 w-4" />
                hello@supplieradvisor.com
              </a>
              <p className="mt-2 text-center text-[11px] text-slate-500">
                We&apos;ll scope sector, industries, packs, and go-live with you.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/onboarding?type=business"
              className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-7 py-3.5 text-sm font-bold text-white shadow-md shadow-cyan-200/50 hover:bg-[#0099b8]"
            >
              Self-serve Core OS &amp; packs <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-3.5 text-sm font-bold text-slate-800 hover:border-[#00b4d8]"
            >
              See pricing
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════ TRUST ═══════════ */}
      <section id="trust" className="border-t border-slate-200 bg-[#f8fafc] py-20 sm:py-28">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <SectionLabel>Trust layer</SectionLabel>
            <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900 sm:text-5xl">
              When a lot fails,
              <span className="mt-1 block text-slate-500">the ship stops.</span>
            </h2>
            <p className="mt-4 text-base text-slate-600 sm:text-lg">
              Verification, ratings, lots, HACCP, and SHEQ are live controls — not
              after-the-fact PDFs.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Star,
                title: 'OTIFEF & peer ratings',
                body: 'Score every delivery On-Time, In-Full, Error-Free. Peer stars and RIAD risk logs follow the relationship.',
              },
              {
                icon: Link2,
                title: 'Lot-level traceability',
                body: 'Product → lot → warehouse → movement → QA. Mock recalls and hold gates before goods leave the gate.',
              },
              {
                icon: HardHat,
                title: 'SHEQ operators use',
                body: 'Incidents, hazards, NCR/CAPA wired to the same inventory that runs the business.',
              },
              {
                icon: ClipboardCheck,
                title: 'Quality release gates',
                body: 'Inspections that block ship. HACCP CCPs. Auditor export packs when regulators call.',
              },
              {
                icon: Fingerprint,
                title: 'On-chain pedigree',
                body: 'Optional product passports and PO escrow when capital or authenticity must be proven.',
              },
              {
                icon: ShieldCheck,
                title: 'Verified companies',
                body: 'Company verification and certificate metadata so counterparties know who they trade with.',
              },
            ].map((p) => (
              <div
                key={p.title}
                className="rounded-3xl border border-slate-200 bg-white p-6 transition-colors hover:border-slate-300 hover:bg-sky-50/50 sm:p-7"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                  <p.icon className="h-5 w-5 text-[#00b4d8]" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="border-t border-slate-200 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Four steps to live ops
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: '01',
                t: 'Register & verify',
                b: 'Company profile, team, certificates. Multi-entity groups get separate workspaces.',
              },
              {
                n: '02',
                t: 'Connect & trade',
                b: 'Invite suppliers and customers. Handshakes, POs, docs, OTIFEF scorecards.',
              },
              {
                n: '03',
                t: 'Operate the chain',
                b: 'Inventory, manufacturing, distribution, finance — one membership-scoped OS.',
              },
              {
                n: '04',
                t: 'Prove & improve',
                b: 'SHEQ, QA holds, traceability, CAPA, and auditor packs when it matters.',
              },
            ].map((step) => (
              <div
                key={step.n}
                className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-sky-50/40 p-6 sm:p-8"
              >
                <div className="text-4xl font-black tracking-tighter text-slate-200">{step.n}</div>
                <h3 className="mt-3 text-xl font-bold text-slate-900">{step.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SecurityStrip />

      <IndustriesStrip />

      <SuperCubeStory />

      {/* ═══════════ PRICING + REFERRAL (same site) ═══════════ */}
      <HomePricing />

      {/* ═══════════ AUDIENCES ═══════════ */}
      <section id="audiences" className="border-t border-slate-200 bg-[#f8fafc] py-20 sm:py-28">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="mb-12 text-center">
            <SectionLabel>Get started</SectionLabel>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">
              Why are you joining us?
              <span className="mt-1 block text-[#00b4d8]">Member, business, or government.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-600">
              Three paths only. B2C is a free personal wallet. B2B then picks
              private, public or NPO. B2G waits for platform admin approval.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Leaf,
                t: 'B2C · Member account',
                b: 'Free personal wallet. Link any business on this platform to shop, book, see records and manage subscriptions. Same login if you later register a company.',
                href: '/me',
                cta: 'Create free account',
              },
              {
                icon: Factory,
                t: 'B2B · Business',
                b: 'Company workspace. Next you choose organisation type — private, public, NPO or association — then sector, industry and role.',
                href: '/onboarding?lane=b2b',
                cta: 'Register business',
              },
              {
                icon: Landmark,
                t: 'B2G · Government',
                b: 'National, provincial or municipal offices. Not self-serve — a SupplierAdvisor admin must approve before the workspace opens.',
                href: '/onboarding?lane=b2g',
                cta: 'Request access',
              },
            ].map((a) => (
              <div
                key={a.t}
                className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 transition-all hover:border-slate-300"
              >
                <a.icon className="mb-4 h-7 w-7 text-[#00b4d8]" />
                <h3 className="text-lg font-bold text-slate-900">{a.t}</h3>
                <p className="mb-5 mt-2 flex-1 text-sm leading-relaxed text-slate-600">{a.b}</p>
                <Link
                  href={a.href}
                  className="inline-flex items-center gap-1 text-sm font-bold text-[#00b4d8] hover:text-cyan-300"
                >
                  {a.cta} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Globe,
                t: 'Ethical sourcing & SDGs',
                b: 'Transparent chains support Zero Hunger, Responsible Consumption, and Climate Action.',
              },
              {
                icon: Award,
                t: 'Super-Cube® leadership',
                b: 'Doctoral Super-Cube® model — develop leaders who compound better decisions.',
              },
              {
                icon: Heart,
                t: 'A better world together',
                b: 'Business, government, SchoolAdvisor® schools, and consumers on one verified network.',
              },
            ].map((h) => (
              <div
                key={h.t}
                className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"
              >
                <h.icon className="mb-4 h-6 w-6 text-[#00b4d8]" />
                <h3 className="text-lg font-bold text-slate-900">{h.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{h.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className="relative overflow-hidden border-t border-slate-200 px-4 py-20 sm:px-6 sm:py-28 lg:px-10">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#f8fafc] via-sky-50/80 to-cyan-50/60"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(#94a3b8_0.55px,transparent_0.55px)] bg-[length:18px_18px] opacity-[0.22]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            <Sparkles className="h-3.5 w-3.5 text-[#00b4d8]" />
            The network is open
          </div>
          <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900 sm:text-5xl md:text-6xl">
            The world&apos;s most trusted
            <span className="mt-1 block text-[#00b4d8]">supplier advice starts here.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 sm:text-lg">
            B2B · B2G · B2C on one verified OS. Join operators who treat verification,
            ratings, lots, and SHEQ as live controls. {COMPANY_TRIAL_DAYS} days free. First{' '}
            {FOUNDING_FREE_COMPANY_LIMIT} free for life.
          </p>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href="/onboarding?type=business"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#00b4d8] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-cyan-500/25 hover:bg-[#0099b8] sm:text-lg"
            >
              Get started in under 5 minutes
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/me"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-200 bg-white px-8 py-4 text-base font-semibold text-[#0077b6] hover:border-[#00b4d8] sm:text-lg"
            >
              Create free SA Member account
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-8 py-4 text-base font-semibold text-slate-800 hover:border-[#00b4d8] sm:text-lg"
            >
              Log in
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500 sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              {COMPANY_TRIAL_DAYS}-day free trial
            </span>
            <span>From R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/mo · Paystack</span>
            <a href="#pricing" className="text-slate-600 underline underline-offset-4 hover:text-slate-900">
              Pricing
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="border-t border-slate-200 bg-white py-12 px-4 sm:px-6">
        <div className="mx-auto max-w-screen-2xl">
          <div className="mb-10 flex flex-col justify-between gap-8 md:flex-row md:items-start">
            <div>
              <div className="text-lg font-black tracking-tight text-slate-900">
                SupplierAdvisor<span className="text-[#00b4d8]">®</span>
              </div>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
                The world&apos;s most trusted supplier advice and supply-chain OS —
                B2B, B2G, and B2C on one verified network.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3 sm:gap-12">
              <div className="space-y-2">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Product
                </div>
                <a href="#why-join" className="block text-slate-600 hover:text-slate-900">
                  Why SA
                </a>
                <a href="#modules" className="block text-slate-600 hover:text-slate-900">
                  Product
                </a>
                <a href="#packaging" className="block text-slate-600 hover:text-slate-900">
                  How it fits
                </a>
                <a href="#pricing" className="block text-slate-600 hover:text-slate-900">
                  Pricing
                </a>
                <Link href="/industries" className="block text-slate-600 hover:text-slate-900">
                  Industries
                </Link>
                <Link href="/demo" className="block text-slate-600 hover:text-slate-900">
                  Demo
                </Link>
                <a href="#compare" className="block text-slate-600 hover:text-slate-900">
                  Compare platforms
                </a>
                <a href="#roi" className="block text-slate-600 hover:text-slate-900">
                  ROI calculator
                </a>
                <a href="#security" className="block text-slate-600 hover:text-slate-900">
                  Security
                </a>
                <Link href="/login" className="block text-slate-600 hover:text-slate-900">
                  Log in
                </Link>
                <Link href="/me" className="block text-slate-600 hover:text-slate-900">
                  SA Member signup
                </Link>
                <Link href="/join" className="block text-slate-600 hover:text-slate-900">
                  Join as business
                </Link>
              </div>
              <div className="space-y-2">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Legal
                </div>
                <Link href="/privacy" className="block text-slate-600 hover:text-slate-900">
                  Privacy
                </Link>
                <Link href="/terms" className="block text-slate-600 hover:text-slate-900">
                  Terms
                </Link>
                <Link
                  href="/cancellation-refund"
                  className="block text-slate-600 hover:text-slate-900"
                >
                  Cancellation &amp; refunds
                </Link>
              </div>
              <div className="col-span-2 space-y-2 sm:col-span-1">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Contact
                </div>
                <a
                  href="mailto:hello@supplieradvisor.com"
                  className="block break-all text-slate-600 hover:text-slate-900"
                >
                  hello@supplieradvisor.com
                </a>
                <a href="tel:+27825814215" className="block text-slate-600 hover:text-slate-900">
                  +27 (0) 82 581 4215
                </a>
                <span className="block text-slate-500">South Africa</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center">
            <span>SupplierAdvisor® 2026 © All rights reserved.</span>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <a
                href="https://x.com/supplieradvisa"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900"
              >
                <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
                </svg>
                @supplieradvisa
              </a>
              <span className="hidden sm:inline text-slate-300">·</span>
              <span>Built for operators who measure trust.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
