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
} from 'lucide-react';
import { useEffect, useState } from 'react';
import LandingNav from '@/components/marketing/LandingNav';
import HomePricing from '@/components/marketing/HomePricing';
import CompanyNetworkSection from '@/components/marketing/CompanyNetworkSection';
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
  PRODUCT_MOCK_HEIGHT,
} from '@/components/marketing/ProductMocks';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
  formatZar,
} from '@/lib/billing/company-subscription';
import { FOUNDING_FREE_COMPANY_LIMIT } from '@/lib/billing/lifetime';
import {
  REFERRAL_LEVEL_RATES_PCT,
  REFERRAL_TOTAL_CAP_PCT,
} from '@/lib/billing/supply-chain-referral';

const MODULES = [
  {
    id: 'ops',
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
    id: 'ctr',
    code: '04',
    title: 'Containers',
    short: 'Containers',
    tagline: 'Outlet network that feeds people',
    body: 'Deploy container retail outlets, contractors and resellers, live stock, impact (jobs & meals), and feasibility models — one command centre for the last mile.',
    bullets: ['Map, stock & resellers', 'Food security & jobs impact', 'Deploy feasibility model'],
    Mock: ContainersMock,
    icon: Container,
  },
  {
    id: 'inv',
    code: '05',
    title: 'Inventory',
    short: 'Inventory',
    tagline: 'Every unit has a home',
    body: 'SKU master, multi-site stock, QR receive, GPS transfers, lots & serials, and on-chain product passports when pedigree matters.',
    bullets: ['Products & locations', 'Live stock & transfers', 'Lots, GS1, on-chain ready'],
    Mock: InventoryMock,
    icon: Package,
  },
  {
    id: 'mfg',
    code: '06',
    title: 'Manufacturing',
    short: 'Make',
    tagline: 'Factory physics, not spreadsheets',
    body: 'BOMs, master production schedules, MRP explosion, work centers, and work orders with OEE-style throughput on every refresh.',
    bullets: ['BOM & work cells', 'MPS / MRP', 'Work order execution'],
    Mock: ManufacturingMock,
    icon: Factory,
  },
  {
    id: 'dst',
    code: '07',
    title: 'Distribution',
    short: 'Ship',
    tagline: 'Door to destination',
    body: 'Inbound and outbound logistics, carriers, fleet & drivers, Incoterms® 2020, and event-level tracking across road, ocean, and air.',
    bullets: ['Inbound & outbound', 'Carriers & fleet', 'Live tracking & OTIF'],
    Mock: DistributionMock,
    icon: Ship,
  },
  {
    id: 'net',
    code: '08',
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
    code: '09',
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
    code: '10',
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
    code: '11',
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
    code: '12',
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
    code: '13',
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
    code: '14',
    title: 'Intelligence',
    short: 'Insights',
    tagline: 'Signal over noise',
    body: 'Live pulse across network, supply, demand, finance, and ops — plus Super-Cube® leadership development for the humans who run the system.',
    bullets: ['Enterprise health', 'Insights & forecasts', 'Super-Cube® leadership'],
    Mock: IntelligenceMock,
    icon: Brain,
  },
] as const;

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

  useEffect(() => {
    const t = setInterval(() => {
      setActiveModule((i) => (i + 1) % MODULES.length);
    }, 6500);
    return () => clearInterval(t);
  }, []);

  const featured = MODULES[activeModule];
  const FeaturedMock = featured.Mock;

  return (
    <div className="relative z-0 min-h-dvh bg-[#f8fafc] text-slate-900 antialiased selection:bg-cyan-100">
      <LandingNav />

      {/* ═══════════ HERO ═══════════ */}
      <section
        id="platform"
        className="relative flex min-h-[calc(100svh-4rem)] flex-col justify-center overflow-x-clip sm:min-h-[calc(100svh-4.25rem)]"
      >
        {/* Bright light wash */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(0,180,216,0.18),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(#cbd5e1_0.6px,transparent_0.6px)] bg-[length:18px_18px] opacity-[0.35]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-[#00b4d8]/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-16 bottom-1/4 h-64 w-64 rounded-full bg-violet-200/20 blur-3xl"
          aria-hidden
        />

        <div className="relative z-[1] mx-auto w-full max-w-screen-2xl px-4 py-12 sm:px-6 sm:py-16 lg:px-10 lg:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12 xl:gap-16">
            {/* Copy */}
            <div className="text-center lg:col-span-5 lg:text-left">
              <div className="mb-6 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                {['B2B', 'B2G', 'B2C'].map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full border border-slate-200/90 bg-white px-3.5 py-1.5 text-[11px] font-black tracking-[0.18em] text-slate-800 shadow-sm"
                  >
                    {tag}
                  </span>
                ))}
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  Live
                </span>
              </div>

              <h1 className="text-[2.2rem] font-black leading-[1.02] tracking-[-0.045em] text-slate-900 sm:text-5xl md:text-6xl lg:text-[3.4rem] xl:text-[3.75rem] lg:tracking-[-0.05em]">
                The world&apos;s most trusted
                <span className="mt-1.5 block bg-gradient-to-r from-[#00b4d8] via-[#0096c7] to-[#0077b6] bg-clip-text text-transparent">
                  supplier advice — and OS.
                </span>
              </h1>

              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:mt-6 sm:text-lg lg:mx-0">
                SupplierAdvisor® unites{' '}
                <strong className="font-semibold text-slate-900">B2B</strong>,{' '}
                <strong className="font-semibold text-slate-900">B2G</strong>, and{' '}
                <strong className="font-semibold text-slate-900">B2C</strong> on one
                verified network — watch the key modules rotate live.
              </p>

              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
                <Link
                  href="/onboarding?type=business"
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#00b4d8] px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:bg-[#0099b8] active:scale-[0.99]"
                >
                  Start {COMPANY_TRIAL_DAYS}-day free trial
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/directory"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-3.5 text-base font-semibold text-slate-800 shadow-sm transition-all hover:border-[#00b4d8] hover:text-[#0077b6]"
                >
                  Browse company directory
                </Link>
              </div>

              <p className="mt-5 text-sm text-slate-500">
                From {formatZar(COMPANY_SUBSCRIPTION_MONTHLY_ZAR)}/mo · first{' '}
                {FOUNDING_FREE_COMPANY_LIMIT} free for life ·{' '}
                <a
                  href="#pricing"
                  className="font-semibold text-[#0077b6] underline decoration-sky-200 underline-offset-4 hover:text-[#00b4d8]"
                >
                  Pricing
                </a>
              </p>

              {/* Active module caption (mobile-friendly under copy) */}
              <div className="mt-8 hidden rounded-2xl border border-slate-200 bg-white/90 p-4 text-left shadow-sm lg:block">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold tracking-widest text-slate-400">
                    {featured.code}
                  </span>
                  <span className="h-px flex-1 bg-slate-100" />
                  <featured.icon className="h-4 w-4 text-[#00b4d8]" />
                </div>
                <div className="mt-2 text-lg font-black text-slate-900">{featured.title}</div>
                <p className="mt-0.5 text-sm font-semibold text-[#00b4d8]">{featured.tagline}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 line-clamp-2">
                  {featured.body}
                </p>
              </div>
            </div>

            {/* Rotating module showcase */}
            <div className="min-w-0 lg:col-span-7">
              <div className="relative">
                <div
                  className="pointer-events-none absolute -inset-3 rounded-[2rem] bg-gradient-to-tr from-cyan-200/40 via-transparent to-violet-200/30 blur-2xl sm:-inset-5"
                  aria-hidden
                />
                <div className="relative overflow-hidden rounded-[1.5rem] border border-slate-200/90 bg-white shadow-xl shadow-slate-200/80 sm:rounded-[1.75rem]">
                  {/* Header bar */}
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                        Platform overview · rotating
                      </div>
                      <div className="mt-0.5 truncate text-sm font-black text-slate-900 sm:text-base">
                        {featured.title}
                        <span className="ml-2 font-semibold text-[#00b4d8]">
                          {featured.tagline}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 rounded-full bg-sky-100 px-2.5 py-1 font-mono text-[10px] font-bold text-[#0077b6]">
                      {featured.code} / {String(MODULES.length).padStart(2, '0')}
                    </div>
                  </div>

                  <div className={`relative w-full ${PRODUCT_MOCK_HEIGHT}`}>
                    <div className="absolute inset-0">
                      <FeaturedMock />
                    </div>
                  </div>

                  {/* Mobile caption under mock */}
                  <div className="border-t border-slate-100 px-4 py-3 lg:hidden">
                    <p className="text-sm leading-relaxed text-slate-600 line-clamp-2">
                      {featured.body}
                    </p>
                  </div>
                </div>

                {/* Module picker pills — rotate on click or auto */}
                <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin sm:mt-4 sm:flex-wrap sm:justify-center lg:justify-start">
                  {MODULES.map((m, i) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setActiveModule(i)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold transition-all touch-manipulation sm:px-3 sm:text-xs ${
                        i === activeModule
                          ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm shadow-cyan-200/60'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-[#0077b6]'
                      }`}
                      aria-pressed={i === activeModule}
                      aria-label={`Show ${m.title} module`}
                    >
                      <m.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      {m.short}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-center text-[11px] text-slate-400 lg:text-left">
                  Auto-rotates every few seconds · tap any module to pin it
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ B2B · B2G · B2C ═══════════ */}
      <section
        id="markets"
        className="scroll-mt-20 border-t border-slate-200 bg-white py-16 sm:py-24"
      >
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="mx-auto mb-12 max-w-3xl text-center">
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
                href: '/onboarding?type=business',
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
                href: '/onboarding?type=government',
                cta: 'Register public entity',
                icon: Landmark,
              },
              {
                code: 'B2C',
                title: 'Business to consumer',
                body: 'People deserve to know where food and goods came from. Brands earn trust when product passports, ethical sourcing, and outlet impact are real — not marketing claims.',
                points: [
                  'Provenance & on-chain ready pedigrees',
                  'Container outlets that feed communities',
                  'Consumers who join verified brands',
                ],
                href: '/onboarding?type=consumer',
                cta: 'Join as consumer',
                icon: Users2,
              },
            ].map((m) => (
              <div
                key={m.code}
                className="group flex flex-col rounded-[1.75rem] border border-slate-200 bg-gradient-to-b from-white to-sky-50/40 p-7 sm:p-8 shadow-sm transition-all hover:border-[#00b4d8]/45 hover:shadow-lg hover:shadow-sky-100/80"
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

      {/* ═══════════ WHY JOIN ═══════════ */}
      <section
        id="why-join"
        className="scroll-mt-20 border-t border-slate-200 bg-[#f8fafc] py-16 sm:py-24"
      >
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <SectionLabel>Why join</SectionLabel>
            <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900 sm:text-5xl">
              Compelling reasons to run
              <span className="mt-2 block text-[#00b4d8]">on SupplierAdvisor®</span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
              Not another dashboard. The operating system for people who measure trust —
              and refuse to separate commerce from quality, safety, and proof.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                b: 'Network, SRM, CRM, inventory, manufacturing, distribution, finance, SHEQ, projects, ESG, and intelligence share one workspace.',
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
                className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-[#00b4d8]/40 hover:shadow-md sm:p-7"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-[#00b4d8]">
                  <r.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900">{r.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{r.b}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
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

      {/* ═══════════ SYSTEMS GRID ═══════════ */}
      <section id="systems" className="relative border-t border-slate-200 bg-white py-20 sm:py-28">
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
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-5">
              <SectionLabel>Mission control</SectionLabel>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
                Built like a mission.
                <span className="mt-1 block text-[#00b4d8]">Run like a business.</span>
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                Every module shares the same command chrome — telemetry, workbenches,
                and clear process steps. Switch systems without relearning the UI.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {MODULES.map((m, i) => (
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
            <div className="relative min-w-0 lg:col-span-7">
              <div className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-[#00b4d8]/10 blur-3xl" />
              <div className={`relative w-full ${PRODUCT_MOCK_HEIGHT}`}>
                <div className="absolute inset-0 overflow-hidden rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/80">
                  <FeaturedMock />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ MODULES ═══════════ */}
      <section id="modules" className="border-t border-slate-200 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <SectionLabel>Modules</SectionLabel>
            <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900 sm:text-5xl">
              Fourteen systems. Zero silos.
            </h2>
            <p className="mt-4 text-slate-600">
              Deep capability where operators work — not marketing slides.
            </p>
          </div>

          <div className="space-y-20 sm:space-y-28">
            {MODULES.map((mod, index) => {
              const Mock = mod.Mock;
              const reverse = index % 2 === 1;
              return (
                <div
                  key={mod.id}
                  id={`module-${mod.id}`}
                  className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16"
                >
                  <div className={reverse ? 'lg:order-2' : ''}>
                    <div className="mb-4 flex items-center gap-3">
                      <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-slate-400">
                        {mod.code}
                      </span>
                      <span className="h-px w-10 bg-slate-200" />
                      <mod.icon className="h-4 w-4 text-[#00b4d8]" />
                    </div>
                    <h3 className="text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">
                      {mod.title}
                    </h3>
                    <p className="mt-2 text-base font-semibold text-[#00b4d8] sm:text-lg">
                      {mod.tagline}
                    </p>
                    <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
                      {mod.body}
                    </p>
                    <ul className="mt-6 space-y-2.5">
                      {mod.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={`min-w-0 ${reverse ? 'lg:order-1' : ''}`}>
                    <div className={`relative w-full ${PRODUCT_MOCK_HEIGHT}`}>
                      <div className="absolute inset-0 overflow-hidden rounded-2xl border border-slate-200">
                        <Mock />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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

      {/* ═══════════ PRICING + REFERRAL (same site) ═══════════ */}
      <HomePricing />

      {/* ═══════════ COMPANIES DIRECTORY (browse + rich search) ═══════════ */}
      <CompanyNetworkSection />

      {/* ═══════════ AUDIENCES ═══════════ */}
      <section id="audiences" className="border-t border-slate-200 bg-[#f8fafc] py-20 sm:py-28">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="mb-12 text-center">
            <SectionLabel>Get started</SectionLabel>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">
              Join as business, government,
              <span className="mt-1 block text-[#00b4d8]">consumer, or association.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-600">
              B2B operators, B2G entities, B2C participants, and collective groups — pick
              your path. Same trusted network underneath.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Factory,
                t: 'Business',
                b: 'Manufacturers, distributors, traders — full ops OS with verified network.',
                href: '/onboarding?type=business',
                cta: 'Register business',
              },
              {
                icon: Leaf,
                t: 'Consumers',
                b: 'Scan passports, support ethical brands, shop with real provenance.',
                href: '/onboarding?type=consumer',
                cta: 'Join as consumer',
              },
              {
                icon: BookOpen,
                t: 'Government',
                b: 'Transparent procurement and decision tools for public sector impact.',
                href: '/onboarding?type=government',
                cta: 'Register entity',
              },
              {
                icon: Users2,
                t: 'Schools & associations',
                b: 'Shared metrics, accountable spend, and collective network power.',
                href: '/onboarding?type=association',
                cta: 'Register group',
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
                b: 'Business, government, schools, and consumers on one verified network.',
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
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-8 py-4 text-base font-semibold text-slate-800 hover:border-[#00b4d8] sm:text-lg"
            >
              Log in to workspace
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
                <a href="#systems" className="block text-slate-600 hover:text-slate-900">
                  Systems
                </a>
                <a href="#modules" className="block text-slate-600 hover:text-slate-900">
                  Modules
                </a>
                <a href="#pricing" className="block text-slate-600 hover:text-slate-900">
                  Pricing
                </a>
                <Link href="/login" className="block text-slate-600 hover:text-slate-900">
                  Log in
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
              </div>
              <div className="col-span-2 space-y-2 sm:col-span-1">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Contact
                </div>
                <a
                  href="mailto:connect@supplieradvisor.com"
                  className="block break-all text-slate-600 hover:text-slate-900"
                >
                  connect@supplieradvisor.com
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
