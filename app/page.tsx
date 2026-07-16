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
  Handshake,
  Gift,
  Bot,
  Sparkles,
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
  formatZar,
} from '@/lib/billing/company-subscription';
import { FOUNDING_FREE_COMPANY_LIMIT } from '@/lib/billing/lifetime';
import {
  REFERRAL_LEVEL_RATES_PCT,
  REFERRAL_PROGRAM_ROOT_NAME,
  REFERRAL_TOTAL_CAP_PCT,
  referralRatesSummary,
} from '@/lib/billing/supply-chain-referral';

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

const NETWORK_PAGE_SIZE = 9;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00b4d8]">
      {children}
    </p>
  );
}

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

  useEffect(() => {
    const t = setInterval(() => {
      setActiveModule((i) => (i + 1) % MODULES.length);
    }, 6500);
    return () => clearInterval(t);
  }, []);

  const featured = MODULES[activeModule];
  const FeaturedMock = featured.Mock;
  const networkPageCount = Math.max(
    1,
    Math.ceil(verifiedCompanies.length / NETWORK_PAGE_SIZE)
  );
  const networkPageSafe = Math.min(networkPage, networkPageCount - 1);
  const pagedCompanies = verifiedCompanies.slice(
    networkPageSafe * NETWORK_PAGE_SIZE,
    networkPageSafe * NETWORK_PAGE_SIZE + NETWORK_PAGE_SIZE
  );

  const exampleFee = (pct: number) =>
    Math.round(((COMPANY_SUBSCRIPTION_MONTHLY_ZAR * pct) / 100) * 100) / 100;

  return (
    <div className="relative z-0 min-h-dvh bg-[#05070b] text-white antialiased selection:bg-cyan-500/30">
      <LandingNav />

      {/* ═══════════ HERO ═══════════ */}
      <section
        id="platform"
        className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden pt-16 sm:pt-[4.25rem]"
      >
        {/* Cinematic backdrop */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              'radial-gradient(ellipse 90% 70% at 50% -20%, rgba(0,180,216,0.22), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 50%, rgba(0,119,182,0.12), transparent 50%), radial-gradient(ellipse 40% 30% at 0% 80%, rgba(16,185,129,0.08), transparent 45%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          aria-hidden
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black, transparent)',
          }}
        />
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#05070b] to-transparent"
          aria-hidden
        />

        <div className="relative z-[1] mx-auto w-full max-w-screen-2xl px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-5xl text-center">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Supply-chain operating system · Live
            </div>

            <h1 className="text-[2.5rem] font-black leading-[0.98] tracking-[-0.04em] text-white sm:text-6xl md:text-7xl lg:text-[5.25rem] lg:tracking-[-0.05em]">
              The OS for
              <span className="mt-1 block bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent">
                verified trade.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/60 sm:mt-8 sm:text-lg md:text-xl md:leading-relaxed">
              One workspace for network, buy/sell, inventory, manufacturing, distribution,
              SHEQ, quality, finance, containers, projects, ESG, and intelligence —
              with ratings, lots, and on-chain pedigree that actually{' '}
              <span className="text-white/90">block risk</span> when it matters.
            </p>

            <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:mt-12 sm:flex-row sm:items-center">
              <Link
                href="/onboarding?type=business"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-slate-950 transition-all hover:bg-white/90 active:scale-[0.99] sm:text-lg"
              >
                Start {COMPANY_TRIAL_DAYS}-day free trial
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#systems"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-8 py-4 text-base font-semibold text-white transition-all hover:border-white/30 hover:bg-white/[0.06] sm:text-lg"
              >
                Explore the systems
              </a>
            </div>

            <p className="mt-6 text-sm text-white/40">
              From {formatZar(COMPANY_SUBSCRIPTION_MONTHLY_ZAR)}/mo · first{' '}
              {FOUNDING_FREE_COMPANY_LIMIT} companies free for life ·{' '}
              <Link href="/pricing" className="text-white/70 underline decoration-white/20 underline-offset-4 hover:text-white">
                Pricing & referral
              </Link>
            </p>

            {/* Telemetry strip */}
            <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
              {[
                { v: String(MODULES.length), l: 'Core modules' },
                { v: String(SYSTEMS.length), l: 'Systems' },
                { v: `${COMPANY_TRIAL_DAYS}d`, l: 'Free trial' },
                { v: `R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}`, l: 'From / mo' },
              ].map((s) => (
                <div
                  key={s.l}
                  className="bg-[#05070b]/80 px-3 py-5 text-center backdrop-blur-sm sm:py-6"
                >
                  <div className="text-xl font-black tabular-nums tracking-tight text-white sm:text-2xl">
                    {s.v}
                  </div>
                  <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ SYSTEMS GRID ═══════════ */}
      <section id="systems" className="relative border-t border-white/10 bg-[#070a10] py-20 sm:py-28">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <SectionLabel>Full stack</SectionLabel>
            <h2 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl md:text-6xl">
              Every critical system.
              <span className="mt-2 block text-white/40">One company workspace.</span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-white/50 sm:text-lg">
              Not a pile of apps. A single operating system for how goods, money, and trust
              move through African and global supply chains.
            </p>
          </div>

          <div className="grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {SYSTEMS.map((s) => (
              <div
                key={s.title}
                className="group bg-[#070a10] p-5 transition-colors hover:bg-white/[0.03] sm:p-6"
              >
                <s.icon className="mb-4 h-5 w-5 text-[#00b4d8] transition-transform group-hover:scale-110" />
                <h3 className="text-sm font-bold text-white sm:text-base">{s.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-white/45 sm:text-[13px]">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURED MODULE ROTATOR ═══════════ */}
      <section className="relative border-t border-white/10 bg-[#05070b] py-16 sm:py-24">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-5">
              <SectionLabel>Mission control</SectionLabel>
              <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
                Built like a mission.
                <span className="mt-1 block text-[#00b4d8]">Run like a business.</span>
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/50 sm:text-base">
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
                        ? 'border-[#00b4d8] bg-[#00b4d8] text-slate-950'
                        : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {m.short}
                  </button>
                ))}
              </div>
              <div className="mt-8 border-l-2 border-[#00b4d8]/50 pl-5">
                <div className="font-mono text-[10px] tracking-widest text-white/30">
                  {featured.code}
                </div>
                <h3 className="mt-1 text-xl font-black text-white">{featured.title}</h3>
                <p className="mt-1 text-sm font-semibold text-[#00b4d8]">{featured.tagline}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{featured.body}</p>
              </div>
            </div>
            <div className="relative min-w-0 lg:col-span-7">
              <div className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-[#00b4d8]/10 blur-3xl" />
              <div className={`relative w-full ${PRODUCT_MOCK_HEIGHT}`}>
                <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50">
                  <FeaturedMock />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ MODULES ═══════════ */}
      <section id="modules" className="border-t border-white/10 bg-[#070a10] py-20 sm:py-28">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <SectionLabel>Modules</SectionLabel>
            <h2 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">
              Fourteen systems. Zero silos.
            </h2>
            <p className="mt-4 text-white/50">
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
                      <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-white/30">
                        {mod.code}
                      </span>
                      <span className="h-px w-10 bg-white/15" />
                      <mod.icon className="h-4 w-4 text-[#00b4d8]" />
                    </div>
                    <h3 className="text-2xl font-black tracking-tight text-white sm:text-4xl">
                      {mod.title}
                    </h3>
                    <p className="mt-2 text-base font-semibold text-[#00b4d8] sm:text-lg">
                      {mod.tagline}
                    </p>
                    <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/50 sm:text-base">
                      {mod.body}
                    </p>
                    <ul className="mt-6 space-y-2.5">
                      {mod.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2.5 text-sm text-white/70">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={`min-w-0 ${reverse ? 'lg:order-1' : ''}`}>
                    <div className={`relative w-full ${PRODUCT_MOCK_HEIGHT}`}>
                      <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/10">
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
      <section id="trust" className="border-t border-white/10 bg-[#05070b] py-20 sm:py-28">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <SectionLabel>Trust layer</SectionLabel>
            <h2 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">
              When a lot fails,
              <span className="mt-1 block text-white/40">the ship stops.</span>
            </h2>
            <p className="mt-4 text-base text-white/50 sm:text-lg">
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
                className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/20 hover:bg-white/[0.04] sm:p-7"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  <p.icon className="h-5 w-5 text-[#00b4d8]" />
                </div>
                <h3 className="text-lg font-bold text-white">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="border-t border-white/10 bg-[#070a10] py-20 sm:py-24">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
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
                className="rounded-3xl border border-white/10 bg-[#05070b] p-6 sm:p-8"
              >
                <div className="text-4xl font-black tracking-tighter text-white/10">{step.n}</div>
                <h3 className="mt-3 text-xl font-bold text-white">{step.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{step.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ EARN / REFERRAL / PRICING ═══════════ */}
      <section id="earn" className="border-t border-white/10 bg-[#05070b] py-20 sm:py-28">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionLabel>Earn on the network</SectionLabel>
              <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                Sales commissions
                <span className="mt-1 block text-white/40">& supply-chain referral.</span>
              </h2>
              <p className="mt-5 text-base leading-relaxed text-white/50">
                Two clean programmes — never confused:
              </p>
              <ul className="mt-6 space-y-4">
                <li className="flex gap-3">
                  <Handshake className="mt-0.5 h-5 w-5 shrink-0 text-[#00b4d8]" />
                  <div>
                    <div className="font-bold text-white">Sales contractors</div>
                    <p className="mt-1 text-sm text-white/50">
                      Personal product sales only (company-set 4–6%). Pipeline, quotes,
                      orders, invoices in the sales portal — no multi-level product MLM.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Gift className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  <div>
                    <div className="font-bold text-white">Company referral</div>
                    <p className="mt-1 text-sm text-white/50">
                      When companies you invite (link or supplier/customer invite) pay for
                      SupplierAdvisor, you earn a share of their{' '}
                      <strong className="text-white/80">subscription</strong> —{' '}
                      {referralRatesSummary()}. Programme root:{' '}
                      {REFERRAL_PROGRAM_ROOT_NAME}.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Bot className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
                  <div>
                    <div className="font-bold text-white">SAM — in-app help</div>
                    <p className="mt-1 text-sm text-white/50">
                      Supplier Advisor Messenger (Grok) answers how-to questions inside the
                      dashboard so teams ramp without a training manual.
                    </p>
                  </div>
                </li>
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/pricing#referral"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-white/90"
                >
                  See fees & example <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white hover:border-white/30"
                >
                  Pricing tiers
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-6 sm:p-8">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Example · monthly sub {formatZar(COMPANY_SUBSCRIPTION_MONTHLY_ZAR)}
              </div>
              <p className="mt-3 text-sm text-white/55">
                You invite A → A invites B → B invites C. When C pays:
              </p>
              <div className="mt-6 space-y-3">
                {[
                  { who: 'Company B', level: 'L1', pct: REFERRAL_LEVEL_RATES_PCT[0] },
                  { who: 'Company A', level: 'L2', pct: REFERRAL_LEVEL_RATES_PCT[1] },
                  { who: 'You', level: 'L3', pct: REFERRAL_LEVEL_RATES_PCT[2] },
                ].map((row) => (
                  <div
                    key={row.level}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                  >
                    <div>
                      <div className="font-semibold text-white">{row.who}</div>
                      <div className="text-xs text-white/40">
                        {row.level} · {row.pct}%
                      </div>
                    </div>
                    <div className="text-lg font-black tabular-nums text-emerald-400">
                      {formatZar(exampleFee(row.pct))}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                  <div className="font-bold text-white">Total shared</div>
                  <div className="text-lg font-black tabular-nums text-emerald-300">
                    {formatZar(
                      exampleFee(REFERRAL_LEVEL_RATES_PCT[0]) +
                        exampleFee(REFERRAL_LEVEL_RATES_PCT[1]) +
                        exampleFee(REFERRAL_LEVEL_RATES_PCT[2])
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-white/40">
                Cap {REFERRAL_TOTAL_CAP_PCT}% of the paid subscription. Prepaid terms use the
                same rates on the amount paid.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ NETWORK ═══════════ */}
      <section id="network" className="border-t border-white/10 bg-[#070a10] py-20 sm:py-28">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="mb-12 text-center">
            <SectionLabel>Network</SectionLabel>
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
              Businesses on SupplierAdvisor®
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/50">
              {platformTotal
                ? `${platformTotal} companies on the platform${
                    verifiedCount > 0 ? ` · ${verifiedCount} verified` : ''
                  }${networkCount > 0 ? ` · ${networkCount} building trust` : ''}`
                : 'Verified and joining companies building transparent trade'}
            </p>
            {!loadingVerified && platformTotal != null && (
              <p className="mt-3 text-sm font-semibold text-violet-300">
                Founding free-for-life: {Math.max(0, FOUNDING_FREE_COMPANY_LIMIT - platformTotal)}{' '}
                of {FOUNDING_FREE_COMPANY_LIMIT} slots remaining
              </p>
            )}
          </div>

          {loadingVerified ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: NETWORK_PAGE_SIZE }, (_, i) => (
                <div
                  key={i}
                  className="h-40 animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]"
                />
              ))}
            </div>
          ) : verifiedCompanies.length > 0 ? (
            <>
              <div className="grid min-h-[22rem] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                      className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.02] p-6 transition-all hover:border-white/20 hover:bg-white/[0.04]"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-bold text-white">{name}</h3>
                          {sub && <p className="truncate text-sm text-white/40">{sub}</p>}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            isVerified
                              ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border border-amber-500/30 bg-amber-500/10 text-amber-200'
                          }`}
                        >
                          {isVerified ? 'Verified' : 'Unverified'}
                        </span>
                      </div>
                      <div className="mb-4 flex items-center gap-2 text-xs text-white/40">
                        <Building2 className="h-3.5 w-3.5 text-[#00b4d8] shrink-0" />
                        <span className="truncate">{meta || 'Business on SupplierAdvisor'}</span>
                      </div>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                        <div className="flex items-center gap-1.5">
                          {stars != null && starCount > 0 ? (
                            <>
                              <span className="text-sm font-black tabular-nums text-white">
                                {stars.toFixed(1)}
                              </span>
                              <span className="text-[11px] text-white/40">({starCount})</span>
                            </>
                          ) : (
                            <span className="text-[11px] text-white/30">No ratings yet</span>
                          )}
                        </div>
                        <div className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-bold text-white/70">
                          <ShieldCheck className="h-3 w-3 text-[#00b4d8]" />
                          Trust {trust != null ? Math.round(trust) : '—'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {networkPageCount > 1 && (
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={networkPageSafe <= 0}
                    onClick={() => setNetworkPage((p) => Math.max(0, p - 1))}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <span className="text-xs font-semibold tabular-nums text-white/40">
                    {networkPageSafe + 1} / {networkPageCount}
                  </span>
                  <button
                    type="button"
                    disabled={networkPageSafe >= networkPageCount - 1}
                    onClick={() =>
                      setNetworkPage((p) => Math.min(networkPageCount - 1, p + 1))
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] py-14 text-center">
              <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-[#00b4d8]" />
              <p className="font-semibold text-white">Be among the first on the network</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
                Complete company onboarding — your trading name can appear here.
              </p>
              <Link
                href="/onboarding?type=business"
                className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950"
              >
                Register your business
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════ AUDIENCES ═══════════ */}
      <section id="audiences" className="border-t border-white/10 bg-[#05070b] py-20 sm:py-28">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <div className="mb-12 text-center">
            <SectionLabel>Who it&apos;s for</SectionLabel>
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
              One platform. Every stakeholder.
            </h2>
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
                className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.02] p-6 transition-all hover:border-white/20"
              >
                <a.icon className="mb-4 h-7 w-7 text-[#00b4d8]" />
                <h3 className="text-lg font-bold text-white">{a.t}</h3>
                <p className="mb-5 mt-2 flex-1 text-sm leading-relaxed text-white/50">{a.b}</p>
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
                className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8"
              >
                <h.icon className="mb-4 h-6 w-6 text-[#00b4d8]" />
                <h3 className="text-lg font-bold text-white">{h.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{h.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className="relative overflow-hidden border-t border-white/10 px-4 py-20 sm:px-6 sm:py-28 lg:px-10">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% 100%, rgba(0,180,216,0.2), transparent 55%)',
          }}
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
            <Sparkles className="h-3.5 w-3.5 text-[#00b4d8]" />
            The network is open
          </div>
          <h2 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl md:text-6xl">
            Stop running trust
            <span className="mt-1 block text-white/40">on spreadsheets.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/50 sm:text-lg">
            Join operators who treat verification, ratings, lots, and SHEQ as live controls.
            {COMPANY_TRIAL_DAYS} days free. First {FOUNDING_FREE_COMPANY_LIMIT} free for life.
          </p>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href="/onboarding?type=business"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-slate-950 hover:bg-white/90 sm:text-lg"
            >
              Get started in under 5 minutes
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-8 py-4 text-base font-semibold text-white hover:border-white/30 sm:text-lg"
            >
              Log in to workspace
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/40 sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              {COMPANY_TRIAL_DAYS}-day free trial
            </span>
            <span>From R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/mo · Paystack</span>
            <Link href="/pricing" className="text-white/60 underline underline-offset-4 hover:text-white">
              Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="border-t border-white/10 bg-black py-12 px-4 sm:px-6">
        <div className="mx-auto max-w-screen-2xl">
          <div className="mb-10 flex flex-col justify-between gap-8 md:flex-row md:items-start">
            <div>
              <div className="text-lg font-black tracking-tight text-white">
                SupplierAdvisor<span className="text-[#00b4d8]">®</span>
              </div>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/40">
                Verified supply-chain OS — trade, ops, SHEQ, finance, and on-chain pedigree
                for B2B, B2G, and B2C.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3 sm:gap-12">
              <div className="space-y-2">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-white/30">
                  Product
                </div>
                <a href="#systems" className="block text-white/50 hover:text-white">
                  Systems
                </a>
                <a href="#modules" className="block text-white/50 hover:text-white">
                  Modules
                </a>
                <Link href="/pricing" className="block text-white/50 hover:text-white">
                  Pricing
                </Link>
                <Link href="/login" className="block text-white/50 hover:text-white">
                  Log in
                </Link>
              </div>
              <div className="space-y-2">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-white/30">
                  Legal
                </div>
                <Link href="/privacy" className="block text-white/50 hover:text-white">
                  Privacy
                </Link>
                <Link href="/terms" className="block text-white/50 hover:text-white">
                  Terms
                </Link>
              </div>
              <div className="col-span-2 space-y-2 sm:col-span-1">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-white/30">
                  Contact
                </div>
                <a
                  href="mailto:connect@supplieradvisor.com"
                  className="block break-all text-white/50 hover:text-white"
                >
                  connect@supplieradvisor.com
                </a>
                <a href="tel:+27825814215" className="block text-white/50 hover:text-white">
                  +27 (0) 82 581 4215
                </a>
                <span className="block text-white/40">South Africa</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/30 sm:flex-row sm:items-center">
            <span>SupplierAdvisor® 2026 © All rights reserved.</span>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <a
                href="https://x.com/supplieradvisa"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-white/40 hover:text-white"
              >
                <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
                </svg>
                @supplieradvisa
              </a>
              <span className="hidden sm:inline text-white/20">·</span>
              <span>Built for operators who measure trust.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
