'use client';

import Link from 'next/link';
import {
  ArrowRight,
  ShieldCheck,
  Users,
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
  Warehouse,
  Ship,
  Wallet,
  ShoppingCart,
  Workflow,
  ChevronRight,
  ChevronLeft,
  HardHat,
  ClipboardCheck,
  Link2,
  Star,
  Fingerprint,
  CreditCard,
  Container,
  FolderKanban,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import LandingNav from '@/components/marketing/LandingNav';
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
} from '@/lib/billing/company-subscription';
import { FOUNDING_FREE_COMPANY_LIMIT } from '@/lib/billing/lifetime';
import {
  ComparisonTable,
  DemoCta,
  FoundingBanner,
  InteractiveTrustDemo,
  MultiEntityCase,
  OtifefCard,
  SecurityStrip,
  TraceOnchainCard,
} from '@/components/marketing/LandingConversion';

type PublicCompany = {
  id: number;
  legal_name: string | null;
  trading_name: string | null;
  verification_status: string | null;
  verified_at: string | null;
  business_type: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  logo_url?: string | null;
  trust_score?: number | null;
  star_avg?: number | null;
  star_count?: number;
  badge: 'verified' | 'network';
};

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

const STATS = [
  { label: 'Modules', value: String(MODULES.length) },
  { label: 'Free trial', value: `${COMPANY_TRIAL_DAYS}d` },
  { label: 'On-chain ready', value: 'Yes' },
  { label: 'From', value: `R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}` },
];

const TRUST_PILLARS = [
  {
    icon: Star,
    title: 'Supplier ratings & OTIFEF',
    body: 'Score every delivery on On-Time, In-Full, Error-Free — peer ratings and RIAD risk logs that follow the trading relationship.',
  },
  {
    icon: Fingerprint,
    title: 'On-chain pedigree',
    body: 'Optional product passports and PO escrow when capital or authenticity must be proven — without forcing crypto on every workflow.',
  },
  {
    icon: Link2,
    title: 'Lot-level traceability',
    body: 'Product → lot → warehouse → movement → QA/HACCP nodes. Mock recalls and hold gates before goods leave the gate.',
  },
  {
    icon: HardHat,
    title: 'SHEQ that operators use',
    body: 'ISO 45001-style incidents and hazards plus ISO 9001-style NCR/CAPA — wired to the same inventory that runs the business.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified companies',
    body: 'CIPC-style verification and certificate metadata so counterparties know who they are trading with on the network.',
  },
  {
    icon: CreditCard,
    title: 'Simple ZAR billing',
    body: `${COMPANY_TRIAL_DAYS}-day free trial, then R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/mo — or save up to 30% prepaid. First ${FOUNDING_FREE_COMPANY_LIMIT} companies free for life.`,
  },
];

const NETWORK_PAGE_SIZE = 9;

export default function LandingPage() {
  const [verifiedCompanies, setVerifiedCompanies] = useState<PublicCompany[]>([]);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [networkCount, setNetworkCount] = useState(0);
  const [platformTotal, setPlatformTotal] = useState<number | null>(null);
  const [loadingVerified, setLoadingVerified] = useState(true);
  const [networkPage, setNetworkPage] = useState(0);
  const [activeModule, setActiveModule] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/public/verified-companies', { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        setVerifiedCompanies(data.companies || []);
        setNetworkPage(0);
        setVerifiedCount(data.counts?.verified ?? 0);
        setNetworkCount(data.counts?.network ?? 0);
        setPlatformTotal(
          typeof data.counts?.platformTotal === 'number'
            ? data.counts.platformTotal
            : data.counts?.total ?? data.companies?.length ?? 0
        );
      } catch {
        if (!cancelled) {
          setVerifiedCompanies([]);
          setPlatformTotal(null);
        }
      } finally {
        if (!cancelled) setLoadingVerified(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-rotate featured module on large screens
  useEffect(() => {
    const t = setInterval(() => {
      setActiveModule((i) => (i + 1) % MODULES.length);
    }, 6000);
    return () => clearInterval(t);
  }, []);

  const featured = MODULES[activeModule];

  const networkPageCount = Math.max(
    1,
    Math.ceil(verifiedCompanies.length / NETWORK_PAGE_SIZE)
  );
  const networkPageSafe = Math.min(networkPage, networkPageCount - 1);
  const pagedCompanies = verifiedCompanies.slice(
    networkPageSafe * NETWORK_PAGE_SIZE,
    networkPageSafe * NETWORK_PAGE_SIZE + NETWORK_PAGE_SIZE
  );
  const FeaturedMock = featured.Mock;

  return (
    <div className="relative z-0 min-h-dvh bg-[#f8fafc] text-slate-900 antialiased">
      <LandingNav />

      {/* ─── HERO ─── */}
      {/* Note: spacer for fixed nav is inside LandingNav — do not double-pad top */}
      <section
        id="platform"
        className="relative z-0 flex min-h-[calc(100svh-4rem)] flex-col justify-center overflow-x-clip sm:min-h-[calc(100svh-4.25rem)]"
      >
        {/* Light space-grade wash */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(0,180,216,0.18),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(#cbd5e1_0.6px,transparent_0.6px)] bg-[length:18px_18px] opacity-[0.35]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 top-1/3 w-72 h-72 rounded-full bg-[#00b4d8]/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-16 bottom-1/4 w-64 h-64 rounded-full bg-violet-200/20 blur-3xl"
          aria-hidden
        />

        <div className="relative z-[1] mx-auto w-full max-w-screen-2xl px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-20">
          <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="text-center lg:col-span-6 lg:text-left">
              <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-cyan-200/80 bg-white/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#0077b6] shadow-sm sm:mb-6 sm:px-3.5 sm:text-xs">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                <span className="truncate">
                  B2B · B2G · B2C · SHEQ · On-chain ready
                </span>
              </div>

              <h1 className="mb-4 text-[2.15rem] font-black leading-[1.05] tracking-tight text-slate-900 sm:mb-6 sm:text-5xl md:text-6xl lg:text-[3.75rem] xl:text-[4.25rem] xl:tracking-[-0.045em]">
                ERP that ships.
                <span className="mt-1 block text-[#00b4d8]">Trust that blocks risk.</span>
              </h1>

              <p className="mx-auto mb-7 max-w-xl text-base leading-relaxed text-slate-600 sm:mb-8 sm:text-lg md:text-xl lg:mx-0">
                The supply-chain OS for verified trade — inventory, manufacturing, distribution,{' '}
                <strong className="font-semibold text-slate-800">SHEQ & food safety</strong>,
                finance, ratings, and on-chain pedigree in one light workspace. When a lot fails,
                the ship stops.
              </p>

              <div className="relative z-[2] mb-5 flex w-full flex-col gap-3 sm:mb-6 sm:flex-row sm:justify-center lg:justify-start">
                <Link
                  href="/onboarding?type=business"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#00b4d8] px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all touch-manipulation hover:bg-[#0099b8] active:scale-[0.99] sm:w-auto sm:px-8 sm:py-4 sm:text-lg"
                >
                  Start {COMPANY_TRIAL_DAYS}-day free trial{' '}
                  <ArrowRight className="h-5 w-5 shrink-0" />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('demo');
                    if (!el) return;
                    const y = el.getBoundingClientRect().top + window.scrollY - 72;
                    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-800 transition-all touch-manipulation hover:border-[#00b4d8] active:scale-[0.99] sm:w-auto sm:px-8 sm:py-4 sm:text-lg"
                >
                  See how trust works
                </button>
              </div>
              <p className="text-xs text-slate-500 sm:text-sm">
                {COMPANY_TRIAL_DAYS}-day free trial · then from R
                {COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/mo · first {FOUNDING_FREE_COMPANY_LIMIT} cos free
                for life ·{' '}
                <Link href="/pricing" className="font-semibold text-[#0077b6] underline">
                  Pricing
                </Link>
              </p>

              <div className="mx-auto mt-8 grid max-w-lg grid-cols-2 gap-2.5 sm:mt-10 sm:grid-cols-4 sm:gap-3 lg:mx-0">
                {STATS.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-2xl border border-slate-200/80 bg-white/90 px-2.5 py-3 text-center shadow-sm sm:px-3"
                  >
                    <div className="text-base font-black tabular-nums tracking-tight text-slate-900 sm:text-xl">
                      {s.value}
                    </div>
                    <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:text-[10px]">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative min-w-0 lg:col-span-6">
              <div className="pointer-events-none absolute -inset-2 rounded-[2rem] bg-gradient-to-tr from-cyan-200/30 via-transparent to-violet-200/20 blur-2xl sm:-inset-4" />
              <div className="relative min-w-0">
                {/* Fixed height slot — prevents layout jump when modules rotate */}
                <div className={`relative w-full ${PRODUCT_MOCK_HEIGHT}`}>
                  <div className="absolute inset-0">
                    <FeaturedMock />
                  </div>
                </div>
                <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin sm:mt-4 sm:flex-wrap sm:justify-center lg:justify-start">
                  {MODULES.map((m, i) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setActiveModule(i)}
                      className={`shrink-0 rounded-full border px-2.5 py-1.5 text-[10px] font-bold transition-all touch-manipulation sm:px-3 sm:text-xs ${
                        i === activeModule
                          ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300'
                      }`}
                    >
                      {m.short}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRUST STRIP ─── */}
      <section className="border-y border-slate-200 bg-white py-6 sm:py-8">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-center">
            {[
              { icon: ShieldCheck, t: 'Company verification' },
              { icon: Star, t: 'OTIFEF ratings' },
              { icon: HardHat, t: 'SHEQ · ISO 45001' },
              { icon: ClipboardCheck, t: 'QA holds & HACCP' },
              { icon: Link2, t: 'Lot traceability' },
              { icon: Fingerprint, t: 'On-chain ready' },
              { icon: Wallet, t: 'Finance & journals' },
              { icon: Brain, t: 'Live intelligence' },
            ].map((item) => (
              <div
                key={item.t}
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600"
              >
                <item.icon className="w-4 h-4 text-[#00b4d8] shrink-0" />
                {item.t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOUNDING + DEMO ─── */}
      <section className="px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
        <div className="mx-auto max-w-screen-2xl space-y-8 sm:space-y-10">
          <FoundingBanner usedSlots={platformTotal} loading={loadingVerified} />
          <InteractiveTrustDemo />
          <div className="grid gap-4 lg:grid-cols-2">
            <OtifefCard />
            <TraceOnchainCard />
          </div>
          <MultiEntityCase />
        </div>
      </section>

      {/* ─── MODULES SHOWCASE ─── */}
      <section id="modules" className="px-4 py-14 sm:px-6 sm:py-20 md:py-28 lg:px-10 bg-white border-y border-slate-100">
        <div className="mx-auto max-w-screen-2xl">
          <div className="mx-auto mb-10 max-w-3xl text-center sm:mb-16">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#00b4d8] sm:text-xs">
              Product
            </p>
            <h2 className="mb-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl md:text-5xl lg:text-6xl lg:tracking-[-0.04em]">
              Built like a mission.
              <span className="mt-1 block text-[#00b4d8]">Run like a business.</span>
            </h2>
            <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
              Every module shares the same light command chrome — hero telemetry, workbenches, and
              operating principles — so teams never relearn the UI.
            </p>
          </div>

          <div className="space-y-14 sm:space-y-20 md:space-y-28">
            {MODULES.map((mod, index) => {
              const Mock = mod.Mock;
              const reverse = index % 2 === 1;
              return (
                <div
                  key={mod.id}
                  id={`module-${mod.id}`}
                  className="grid items-center gap-6 lg:grid-cols-2 lg:gap-14"
                >
                  <div className={`min-w-0 ${reverse ? 'lg:order-2' : ''}`}>
                    <div className="mb-3 inline-flex items-center gap-2 sm:mb-4">
                      <span className="font-mono text-[10px] font-black tracking-widest text-neutral-400">
                        {mod.code}
                      </span>
                      <span className="h-px w-8 bg-slate-200" />
                      <mod.icon className="h-4 w-4 text-[#00b4d8]" />
                    </div>
                    <h3 className="mb-2 text-xl font-black tracking-tight text-slate-900 sm:text-3xl md:text-4xl md:tracking-[-0.03em]">
                      {mod.title}
                    </h3>
                    <p className="mb-3 text-base font-semibold text-[#0077b6] sm:mb-4 sm:text-xl">
                      {mod.tagline}
                    </p>
                    <p className="mb-5 max-w-lg text-sm leading-relaxed text-slate-600 sm:mb-6 sm:text-base">
                      {mod.body}
                    </p>
                    <ul className="mb-6 space-y-2.5 sm:mb-8">
                      {mod.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/onboarding?type=business"
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-[#00b4d8] transition-colors hover:text-[#0077b6]"
                    >
                      Get access <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className={`min-w-0 ${reverse ? 'lg:order-1' : ''}`}>
                    <div className={`relative w-full ${PRODUCT_MOCK_HEIGHT}`}>
                      <div className="absolute inset-0">
                        <Mock />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 grid grid-cols-2 gap-2.5 sm:mt-20 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {[
              { icon: Users, t: 'My business', d: 'Profile, team, billing' },
              { icon: ShoppingCart, t: 'Sales portal', d: 'Contractors & commission' },
              { icon: Globe, t: 'Marketplace', d: 'Optional reach' },
              { icon: ShoppingCart, t: 'Buyer portal', d: 'Raise POs as buyer' },
              { icon: BookOpen, t: 'Guide', d: 'In-app how-to paths' },
              { icon: CreditCard, t: 'Billing', d: 'Trial + Paystack ZAR' },
              { icon: Award, t: 'Resellers', d: 'Field sales + feedback' },
              { icon: Warehouse, t: 'Lots & GS1', d: 'Pedigree & scan receive' },
            ].map((m) => (
              <div
                key={m.t}
                className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-[#00b4d8]/50 hover:shadow-md sm:rounded-3xl sm:p-5"
              >
                <m.icon className="mb-2 h-5 w-5 text-[#00b4d8] sm:mb-2.5" />
                <div className="text-sm font-bold text-slate-900 sm:text-base">{m.t}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-slate-500 sm:text-xs">{m.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TRUST LAYER ─── */}
      <section
        id="trust"
        className="border-y border-slate-100 bg-white py-16 sm:py-20 md:py-24 px-4 sm:px-6 lg:px-10"
      >
        <div className="mx-auto max-w-screen-2xl">
          <div className="mx-auto mb-10 max-w-3xl text-center sm:mb-14">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#00b4d8] sm:text-xs">
              Trust layer
            </p>
            <h2 className="mb-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl md:text-5xl md:tracking-[-0.04em]">
              Why operators join — and stay
            </h2>
            <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
              Not another dashboard. A system where verification, ratings, lots, and SHEQ
              controls show up in the same place you buy, make, and ship.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-5">
            {TRUST_PILLARS.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5 sm:rounded-3xl sm:p-6 hover:border-[#00b4d8]/40 hover:shadow-md transition-all"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-[#00b4d8]">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">{p.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/onboarding?type=business"
              className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#0099b8]"
            >
              Claim free trial <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-800 hover:border-[#00b4d8]"
            >
              See pricing tiers
            </Link>
          </div>
        </div>
      </section>

      {/* ─── COMPARE + SECURITY ─── */}
      <section className="px-4 py-14 sm:px-6 sm:py-20 lg:px-10 bg-[#f8fafc]">
        <div className="mx-auto max-w-screen-2xl space-y-8">
          <ComparisonTable />
          <SecurityStrip />
          <DemoCta />
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section
        id="how-it-works"
        className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 lg:px-10 bg-white border-y border-slate-100"
      >
        <div className="max-w-screen-2xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-[#00b4d8] mb-3">
              How it works
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-[-0.04em] text-slate-900">
              Four steps to live ops
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                n: '01',
                t: 'Register & verify',
                b: 'Company profile, team, certificates. Multi-entity groups get separate workspaces.',
              },
              {
                n: '02',
                t: 'Connect & trade',
                b: 'Discover or invite partners. Handshakes, POs, docs, and OTIFEF scorecards.',
              },
              {
                n: '03',
                t: 'Operate the chain',
                b: 'Inventory, manufacturing, distribution, finance — one membership-scoped OS.',
              },
              {
                n: '04',
                t: 'Prove & improve',
                b: 'SHEQ incidents, QA holds, traceability, CAPA, and auditor packs when it matters.',
              },
            ].map((step) => (
              <div
                key={step.n}
                className="relative rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white to-sky-50/40 p-6 sm:p-8 shadow-sm"
              >
                <div className="text-4xl sm:text-5xl font-black tracking-tighter text-[#00b4d8]/20 mb-4">
                  {step.n}
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">{step.t}</h3>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">{step.b}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 sm:mt-16 rounded-[1.75rem] sm:rounded-[2rem] border border-cyan-100 bg-gradient-to-br from-white via-sky-50/80 to-cyan-50 p-6 sm:p-10">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-white/90 border border-cyan-100 text-[#0077b6] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-4">
                  Why join
                </div>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-[-0.03em] text-slate-900 mb-3">
                  Your company OS for verified trade
                </h3>
                <p className="text-slate-600 leading-relaxed mb-6 text-sm sm:text-base">
                  Network, buy/sell, inventory, production, shipping, and intelligence in one
                  membership-scoped workspace — so trust and operations never diverge.
                </p>
                <ul className="space-y-2.5 mb-8">
                  {[
                    'Verified counterparties and measurable OTIFEF ratings',
                    'Lot holds, HACCP, and SHEQ NCR/CAPA on the same stock',
                    'Multi-company accounts for groups & brands',
                    'On-chain options when capital or pedigree must be proven',
                    `${COMPANY_TRIAL_DAYS}-day free trial · from R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/mo · founding ${FOUNDING_FREE_COMPANY_LIMIT} free for life`,
                  ].map((t) => (
                    <li key={t} className="flex gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      {t}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/onboarding?type=business"
                  className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] hover:bg-[#0099b8] text-white font-semibold px-7 py-3.5 text-sm sm:text-base transition-all"
                >
                  Create free workspace <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { d: 'Day 1', t: 'Profile & team', b: 'Register, invite, verify.' },
                  { d: 'Day 2', t: 'Connect', b: 'Handshake with a partner.' },
                  { d: 'Day 3', t: 'Trade & operate', b: 'PO, stock, or shipment live.' },
                ].map((c) => (
                  <div
                    key={c.d}
                    className="rounded-2xl border border-white bg-white/90 p-5 shadow-sm"
                  >
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8] mb-2">
                      {c.d}
                    </div>
                    <div className="font-bold text-slate-900 mb-1">{c.t}</div>
                    <p className="text-xs text-slate-500 leading-relaxed">{c.b}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── VERIFIED NETWORK ─── */}
      <section id="verified" className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 lg:px-10">
        <div className="max-w-screen-2xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-100 px-4 py-1.5 rounded-full text-xs font-bold mb-4">
              <ShieldCheck size={16} /> Network businesses
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-[-0.04em] text-slate-900 mb-3">
              Businesses on SupplierAdvisor®
            </h2>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
              {platformTotal
                ? `${platformTotal} companies on the platform${
                    verifiedCount > 0
                      ? ` · ${verifiedCount} verified`
                      : ''
                  }${
                    networkCount > 0
                      ? ` · ${networkCount} building trust`
                      : ''
                  } — peer stars and trust scores when available`
                : 'Verified and joining companies building transparent, ethical trade'}
            </p>
            {!loadingVerified && platformTotal != null && (
              <p className="mt-3 text-sm font-semibold text-violet-800">
                Founding free-for-life: {Math.max(0, FOUNDING_FREE_COMPANY_LIMIT - platformTotal)} of{' '}
                {FOUNDING_FREE_COMPANY_LIMIT} slots remaining
              </p>
            )}
          </div>

          {loadingVerified ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {Array.from({ length: NETWORK_PAGE_SIZE }, (_, i) => i + 1).map((i) => (
                <div
                  key={i}
                  className="border border-slate-200 rounded-3xl p-6 sm:p-8 bg-slate-50 animate-pulse h-40"
                />
              ))}
            </div>
          ) : verifiedCompanies.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 min-h-[28rem] sm:min-h-[26rem] lg:min-h-[22rem]">
                {pagedCompanies.map((company) => {
                  const name =
                    company.trading_name || company.legal_name || `Company #${company.id}`;
                  const sub =
                    company.trading_name &&
                    company.legal_name &&
                    company.trading_name !== company.legal_name
                      ? company.legal_name
                      : null;
                  const meta = [
                    company.industry || company.business_type,
                    company.city,
                    company.country,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  const isVerified = company.badge === 'verified';
                  const stars = company.star_avg;
                  const starCount = company.star_count ?? 0;
                  const trust = company.trust_score;
                  return (
                    <div
                      key={company.id}
                      className="border border-slate-200 rounded-2xl sm:rounded-3xl p-5 sm:p-7 hover:shadow-lg hover:border-cyan-200 transition-all bg-white flex flex-col"
                    >
                      <div className="flex items-start justify-between mb-3 gap-3">
                        <div className="min-w-0">
                          <h3 className="font-bold text-lg sm:text-xl text-slate-900 truncate">
                            {name}
                          </h3>
                          {sub && <p className="text-sm text-slate-500 truncate">{sub}</p>}
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0 ${
                            isVerified
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-amber-50 text-amber-900 border border-amber-100'
                          }`}
                        >
                          {isVerified ? 'Verified' : 'Unverified'}
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm text-slate-500 flex items-center gap-2 mb-4">
                        <Building2 className="w-3.5 h-3.5 text-[#00b4d8] shrink-0" />
                        <span className="truncate">
                          {meta || 'Business on SupplierAdvisor'}
                        </span>
                      </div>

                      {/* Stars received + trust score */}
                      <div className="mt-auto pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {stars != null && starCount > 0 ? (
                            <>
                              <span
                                className="text-amber-500 text-sm tracking-tight"
                                aria-hidden
                              >
                                {'★'.repeat(Math.min(5, Math.round(stars)))}
                                <span className="text-slate-200">
                                  {'★'.repeat(Math.max(0, 5 - Math.round(stars)))}
                                </span>
                              </span>
                              <span className="text-sm font-black text-slate-900 tabular-nums">
                                {stars.toFixed(1)}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                ({starCount})
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              No peer ratings yet
                            </span>
                          )}
                        </div>
                        <div
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold tabular-nums ${
                            trust != null && trust >= 70
                              ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                              : trust != null && trust >= 40
                                ? 'bg-sky-50 border-sky-100 text-sky-800'
                                : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                          title="Trust score"
                        >
                          <ShieldCheck className="w-3 h-3 shrink-0" />
                          Trust {trust != null ? Math.round(trust) : '—'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {networkPageCount > 1 && (
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={networkPageSafe <= 0}
                      onClick={() => setNetworkPage((p) => Math.max(0, p - 1))}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-cyan-300 hover:text-[#0077b6] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      aria-label="Previous companies"
                    >
                      <ChevronLeft className="w-4 h-4" /> Previous
                    </button>
                    <button
                      type="button"
                      disabled={networkPageSafe >= networkPageCount - 1}
                      onClick={() =>
                        setNetworkPage((p) => Math.min(networkPageCount - 1, p + 1))
                      }
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-cyan-300 hover:text-[#0077b6] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      aria-label="Next companies"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5" role="tablist" aria-label="Company pages">
                      {Array.from({ length: networkPageCount }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          role="tab"
                          aria-selected={i === networkPageSafe}
                          aria-label={`Page ${i + 1} of ${networkPageCount}`}
                          onClick={() => setNetworkPage(i)}
                          className={`h-2.5 rounded-full transition-all ${
                            i === networkPageSafe
                              ? 'w-6 bg-[#00b4d8]'
                              : 'w-2.5 bg-slate-200 hover:bg-slate-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-slate-500 tabular-nums ml-1">
                      {networkPageSafe + 1} / {networkPageCount}
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 rounded-3xl border border-dashed border-slate-200 bg-white">
              <ShieldCheck className="w-10 h-10 text-[#00b4d8] mx-auto mb-3" />
              <p className="text-slate-700 font-semibold mb-2">Be among the first verified businesses</p>
              <p className="text-slate-500 text-sm max-w-md mx-auto mb-6 px-4">
                Complete company onboarding — your trading name can appear here for the network to
                discover.
              </p>
              <Link
                href="/onboarding?type=business"
                className="inline-flex rounded-full bg-[#00b4d8] text-white font-semibold px-6 py-3 text-sm"
              >
                Register your business
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ─── AUDIENCES ─── */}
      <section
        id="audiences"
        className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 lg:px-10 bg-white border-t border-slate-100"
      >
        <div className="max-w-screen-2xl mx-auto">
          <div className="text-center mb-12 sm:mb-14">
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-[#00b4d8] mb-3">
              Who it&apos;s for
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-[-0.04em] text-slate-900">
              One platform. Every stakeholder.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
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
                className="flex flex-col rounded-2xl sm:rounded-3xl border border-slate-200 bg-[#f8fafc] p-5 sm:p-6 hover:border-[#00b4d8]/40 hover:shadow-md transition-all"
              >
                <a.icon className="w-7 h-7 text-[#00b4d8] mb-4" />
                <h3 className="text-lg font-black text-slate-900 mb-2">{a.t}</h3>
                <p className="text-sm text-slate-600 leading-relaxed flex-1 mb-5">{a.b}</p>
                <Link
                  href={a.href}
                  className="inline-flex items-center gap-1 text-sm font-bold text-[#00b4d8] hover:text-[#0077b6]"
                >
                  {a.cta} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>

          {/* Humanity band */}
          <div className="mt-12 sm:mt-16 grid md:grid-cols-3 gap-4 sm:gap-5">
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
                className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm"
              >
                <h.icon className="w-6 h-6 text-[#00b4d8] mb-4" />
                <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2">{h.t}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{h.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="relative overflow-x-clip px-4 py-12 sm:px-6 sm:py-16 md:py-20 lg:px-10 lg:py-24">
        {/* Soft light wash — keeps brand bright, not a heavy dark block */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#f8fafc] via-sky-50/80 to-cyan-50/60"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(#94a3b8_0.55px,transparent_0.55px)] bg-[length:18px_18px] opacity-[0.22]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-64 w-[min(90vw,48rem)] -translate-x-1/2 rounded-full bg-[#00b4d8]/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-20 bottom-10 h-56 w-56 rounded-full bg-violet-300/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-16 top-1/3 h-48 w-48 rounded-full bg-cyan-300/25 blur-3xl"
          aria-hidden
        />

        <div className="relative mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-cyan-100/90 bg-white/90 p-7 shadow-[0_24px_80px_-28px_rgba(0,119,182,0.35)] backdrop-blur-sm sm:rounded-[2rem] sm:p-10 md:p-12 lg:p-14">
            {/* Inner brand frame */}
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white via-sky-50/40 to-cyan-50/50"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#00b4d8]/10 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-violet-200/25 blur-3xl"
              aria-hidden
            />
            {/* Top accent line */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#00b4d8] to-transparent opacity-80"
              aria-hidden
            />

            <div className="relative mx-auto max-w-3xl text-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/90 bg-white px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#0077b6] shadow-sm sm:mb-6 sm:text-xs">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                The network is open
              </div>

              <h2 className="mb-4 text-[1.85rem] font-black leading-[1.08] tracking-tight text-slate-900 sm:mb-5 sm:text-4xl md:text-5xl lg:text-[3.25rem] lg:tracking-[-0.035em]">
                Stop running trust on spreadsheets
                <span className="mt-1 block bg-gradient-to-r from-[#00b4d8] to-[#0077b6] bg-clip-text text-transparent">
                  Run it on one OS.
                </span>
              </h2>

              <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-slate-600 sm:mb-9 sm:text-lg md:text-xl">
                Join operators who treat{' '}
                <span className="font-semibold text-slate-800">verification, ratings, lots, and SHEQ</span>
                {' '}as live controls — not after-the-fact reports. {COMPANY_TRIAL_DAYS} days free.
                First {FOUNDING_FREE_COMPANY_LIMIT} companies free for life.
              </p>

              {/* Value chips */}
              <div className="mb-8 flex flex-wrap items-center justify-center gap-2 sm:mb-9 sm:gap-2.5">
                {[
                  { icon: ShieldCheck, label: 'Verified network' },
                  { icon: HardHat, label: 'SHEQ + HACCP' },
                  { icon: Link2, label: 'Traceability' },
                  { icon: Fingerprint, label: 'On-chain ready' },
                  { icon: Globe, label: 'B2B · B2G · B2C' },
                ].map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm sm:text-xs"
                  >
                    <chip.icon className="h-3.5 w-3.5 text-[#00b4d8] shrink-0" aria-hidden />
                    {chip.label}
                  </span>
                ))}
              </div>

              <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/onboarding?type=business"
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#00b4d8] px-7 py-4 text-base font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all touch-manipulation hover:bg-[#0099b8] hover:shadow-cyan-500/35 active:scale-[0.99] sm:w-auto sm:px-10 sm:py-4.5 sm:text-lg"
                >
                  Get started in under 5 minutes
                  <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-7 py-4 text-base font-semibold text-slate-800 shadow-sm transition-all touch-manipulation hover:border-[#00b4d8] hover:text-[#0077b6] active:scale-[0.99] sm:w-auto sm:px-8 sm:text-lg"
                >
                  Log in to workspace
                </Link>
              </div>

              {/* Trust strip */}
              <div className="mt-8 flex flex-col items-center gap-3 sm:mt-9">
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500 sm:text-sm">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" aria-hidden />
                    {COMPANY_TRIAL_DAYS}-day free trial
                  </span>
                  <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-block" aria-hidden />
                  <span className="inline-flex items-center gap-1.5">
                    From R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/mo · Paystack
                  </span>
                  <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-block" aria-hidden />
                  <span className="inline-flex items-center gap-x-2">
                    <Link
                      href="/terms"
                      className="font-semibold text-slate-600 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-[#0077b6] hover:decoration-[#00b4d8]"
                    >
                      Terms
                    </Link>
                    <span className="text-slate-300" aria-hidden>
                      ·
                    </span>
                    <Link
                      href="/privacy"
                      className="font-semibold text-slate-600 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-[#0077b6] hover:decoration-[#00b4d8]"
                    >
                      Privacy
                    </Link>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-slate-950 text-white/60 py-10 sm:py-12 px-4 sm:px-6 border-t border-slate-800">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 mb-8">
            <div>
              <div className="font-black tracking-[-0.03em] text-white text-lg mb-2">
                SupplierAdvisor®
              </div>
              <p className="text-sm text-white/50 max-w-xs leading-relaxed">
                Verified supply-chain OS — trade, ops, SHEQ, finance, and on-chain pedigree for B2B,
                B2G, and B2C.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-10 text-sm">
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-3">
                  Product
                </div>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('modules')?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="block hover:text-white transition-colors text-left"
                >
                  Modules
                </button>
                <Link href="/pricing" className="block hover:text-white transition-colors">
                  Pricing
                </Link>
                <Link href="/login" className="block hover:text-white transition-colors">
                  Log in
                </Link>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-3">
                  Legal
                </div>
                <Link href="/privacy" className="block hover:text-white transition-colors">
                  Privacy
                </Link>
                <Link href="/terms" className="block hover:text-white transition-colors">
                  Terms
                </Link>
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <div className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-3">
                  Contact
                </div>
                <a
                  href="mailto:connect@supplieradvisor.com"
                  className="block hover:text-white transition-colors break-all"
                >
                  connect@supplieradvisor.com
                </a>
                <a href="tel:+27825814215" className="block hover:text-white transition-colors">
                  +27 (0) 82 581 4215
                </a>
                <span className="block">South Africa</span>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-slate-800 text-xs text-white/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span>SupplierAdvisor® 2026 © All rights reserved.</span>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
              <a
                href="https://x.com/supplieradvisa"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors"
                aria-label="SupplierAdvisor on X"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="h-4 w-4 fill-current shrink-0"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
                </svg>
                <span className="font-semibold">@supplieradvisa</span>
              </a>
              <span className="hidden sm:inline text-white/25">·</span>
              <span>Built for operators who measure trust.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
