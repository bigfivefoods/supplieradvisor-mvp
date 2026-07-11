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
} from '@/components/marketing/ProductMocks';

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
  badge: 'verified' | 'network';
};

const MODULES = [
  {
    id: 'ops',
    code: '01',
    title: 'Operations',
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
    tagline: 'Lead → loyalty in one flow',
    body: 'Pipeline, quotes, sales orders, invoices, and loyalty — plus platform invites that turn buyers into live trading edges.',
    bullets: ['Leads & opportunities', 'Quotes → orders → AR', 'Buyer portal & reviews'],
    Mock: CrmMock,
    icon: ShoppingCart,
  },
  {
    id: 'inv',
    code: '04',
    title: 'Inventory',
    tagline: 'Every unit has a home',
    body: 'SKU master, multi-site stock, QR receive, GPS transfers, lots & serials, and on-chain product passports when pedigree matters.',
    bullets: ['Products & locations', 'Live stock & transfers', 'Lots, GS1, on-chain ready'],
    Mock: InventoryMock,
    icon: Package,
  },
  {
    id: 'mfg',
    code: '05',
    title: 'Manufacturing',
    tagline: 'Factory physics, not spreadsheets',
    body: 'BOMs, master production schedules, MRP explosion, work centers, and work orders with OEE-style throughput on every refresh.',
    bullets: ['BOM & work cells', 'MPS / MRP', 'Work order execution'],
    Mock: ManufacturingMock,
    icon: Factory,
  },
  {
    id: 'dst',
    code: '06',
    title: 'Distribution',
    tagline: 'Door to destination',
    body: 'Inbound and outbound logistics, carriers, fleet & drivers, Incoterms® 2020, and event-level tracking across road, ocean, and air.',
    bullets: ['Inbound & outbound', 'Carriers & fleet', 'Live tracking & OTIF'],
    Mock: DistributionMock,
    icon: Ship,
  },
  {
    id: 'fin',
    code: '07',
    title: 'Accounting',
    tagline: 'One ledger of truth',
    body: 'Double-entry CoA, journals, AR/AP, payments, bank import, tax, fixed assets, and management accounts — membership-scoped to your company.',
    bullets: ['Double-entry GL', 'AR / AP / bank', 'Reports & management P&L'],
    Mock: AccountingMock,
    icon: Wallet,
  },
  {
    id: 'bi',
    code: '08',
    title: 'Intelligence',
    tagline: 'Signal over noise',
    body: 'Live pulse across network, supply, demand, finance, and ops — plus Super-Cube® leadership development for the humans who run the system.',
    bullets: ['Enterprise health', 'Insights & forecasts', 'Super-Cube® leadership'],
    Mock: IntelligenceMock,
    icon: Brain,
  },
] as const;

const STATS = [
  { label: 'Modules', value: '20+' },
  { label: 'From farm to fork', value: 'E2E' },
  { label: 'On-chain ready', value: 'Yes' },
  { label: 'Multi-currency', value: 'Live' },
];

export default function LandingPage() {
  const [verifiedCompanies, setVerifiedCompanies] = useState<PublicCompany[]>([]);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [loadingVerified, setLoadingVerified] = useState(true);
  const [activeModule, setActiveModule] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/public/verified-companies', { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        setVerifiedCompanies(data.companies || []);
        setVerifiedCount(data.counts?.verified ?? data.companies?.length ?? 0);
      } catch {
        if (!cancelled) setVerifiedCompanies([]);
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
  const FeaturedMock = featured.Mock;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 overflow-x-hidden antialiased">
      <LandingNav />

      {/* ─── HERO ─── */}
      <section
        id="platform"
        className="relative pt-16 sm:pt-[4.25rem] min-h-[100svh] flex flex-col justify-center overflow-hidden"
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

        <div className="relative z-10 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 lg:px-10 py-12 sm:py-16 lg:py-20">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-white/90 px-3.5 py-1.5 text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#0077b6] mb-6 shadow-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                B2B · B2G · B2C · On-chain ready
              </div>

              <h1 className="text-[2.5rem] leading-[0.95] sm:text-5xl md:text-6xl lg:text-[4.25rem] font-black tracking-[-0.045em] text-slate-900 mb-5 sm:mb-6">
                The supply chain
                <span className="block text-[#00b4d8]">operating system.</span>
              </h1>

              <p className="text-base sm:text-lg md:text-xl text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed mb-8">
                Verified trade, inventory, manufacturing, distribution, accounting, and intelligence
                — one light, precise workspace. Built for operators who refuse blind spots.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start mb-6">
                <Link
                  href="/onboarding?type=business"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00b4d8] hover:bg-[#0099b8] text-white font-semibold text-base sm:text-lg px-8 py-4 shadow-lg shadow-cyan-500/20 transition-all touch-manipulation"
                >
                  Start free <ArrowRight className="w-5 h-5" />
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('modules')?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white hover:border-[#00b4d8] text-slate-800 font-semibold text-base sm:text-lg px-8 py-4 transition-all touch-manipulation"
                >
                  Explore modules
                </button>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                Free company workspace · no card for beta ·{' '}
                <Link href="/privacy" className="underline hover:text-[#0077b6]">
                  Privacy
                </Link>
              </p>

              <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto lg:mx-0">
                {STATS.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur px-3 py-3 text-center shadow-sm"
                  >
                    <div className="text-lg sm:text-xl font-black text-slate-900 tabular-nums tracking-tight">
                      {s.value}
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6 relative">
              <div className="absolute -inset-4 bg-gradient-to-tr from-cyan-200/30 via-transparent to-violet-200/20 blur-2xl rounded-[2rem] pointer-events-none" />
              <div className="relative">
                <FeaturedMock />
                <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin justify-center lg:justify-start">
                  {MODULES.map((m, i) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setActiveModule(i)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold border transition-all touch-manipulation ${
                        i === activeModule
                          ? 'bg-[#00b4d8] border-[#00b4d8] text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-cyan-300'
                      }`}
                    >
                      {m.title.split(' ')[0]}
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
              { icon: Network, t: 'Secure trading graph' },
              { icon: Package, t: 'Inventory + pedigree' },
              { icon: Factory, t: 'MPS / MRP / BOM' },
              { icon: Ship, t: 'Global logistics' },
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

      {/* ─── MODULES SHOWCASE ─── */}
      <section id="modules" className="py-16 sm:py-20 md:py-28 px-4 sm:px-6 lg:px-10">
        <div className="max-w-screen-2xl mx-auto">
          <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-[#00b4d8] mb-3">
              Product
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-[-0.04em] text-slate-900 mb-4">
              Built like a mission.
              <span className="block text-[#00b4d8]">Run like a business.</span>
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              Every module shares the same light command chrome — hero telemetry, workbenches, and
              operating principles — so teams never relearn the UI.
            </p>
          </div>

          <div className="space-y-16 sm:space-y-24 md:space-y-28">
            {MODULES.map((mod, index) => {
              const Mock = mod.Mock;
              const reverse = index % 2 === 1;
              return (
                <div
                  key={mod.id}
                  id={`module-${mod.id}`}
                  className={`grid lg:grid-cols-2 gap-8 lg:gap-14 items-center ${
                    reverse ? '' : ''
                  }`}
                >
                  <div className={reverse ? 'lg:order-2' : ''}>
                    <div className="inline-flex items-center gap-2 mb-4">
                      <span className="font-mono text-[10px] font-black tracking-widest text-neutral-400">
                        {mod.code}
                      </span>
                      <span className="w-8 h-px bg-slate-200" />
                      <mod.icon className="w-4 h-4 text-[#00b4d8]" />
                    </div>
                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-[-0.03em] text-slate-900 mb-2">
                      {mod.title}
                    </h3>
                    <p className="text-lg sm:text-xl font-semibold text-[#0077b6] mb-4">
                      {mod.tagline}
                    </p>
                    <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-6 max-w-lg">
                      {mod.body}
                    </p>
                    <ul className="space-y-2.5 mb-8">
                      {mod.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/onboarding?type=business"
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-[#00b4d8] hover:text-[#0077b6] transition-colors"
                    >
                      Get access <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                  <div className={reverse ? 'lg:order-1' : ''}>
                    <Mock />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Module grid index */}
          <div className="mt-16 sm:mt-20 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { icon: Warehouse, t: 'Containers', d: 'Retail outlet network' },
              { icon: Network, t: 'Connections', d: 'Company trading graph' },
              { icon: ShieldCheck, t: 'Quality', d: 'HACCP & traceability' },
              { icon: Leaf, t: 'Sustainability', d: 'Carbon & ethics' },
              { icon: Users, t: 'My business', d: 'Profile, team, legal' },
              { icon: Award, t: 'Projects', d: 'Portfolio & milestones' },
              { icon: Globe, t: 'Marketplace', d: 'Optional reach' },
              { icon: ShoppingCart, t: 'Buyer portal', d: 'Raise POs as buyer' },
            ].map((m) => (
              <div
                key={m.t}
                className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm hover:border-[#00b4d8]/50 hover:shadow-md transition-all"
              >
                <m.icon className="w-5 h-5 text-[#00b4d8] mb-2.5" />
                <div className="font-bold text-sm sm:text-base text-slate-900">{m.t}</div>
                <div className="text-xs text-slate-500 mt-0.5">{m.d}</div>
              </div>
            ))}
          </div>
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
              Three steps to live ops
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                n: '01',
                t: 'Verify company',
                b: 'Onboard identity, certificates, and location. Multi-company groups get separate workspaces.',
              },
              {
                n: '02',
                t: 'Connect & trade',
                b: 'Discover or invite counterparties. Accept handshakes. Raise POs, share docs, set pricing.',
              },
              {
                n: '03',
                t: 'Operate & prove',
                b: 'Inventory, manufacturing, distribution, accounting, and intelligence — with OTIFEF and audit trails.',
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
                    'Verified counterparties and measurable OTIFEF',
                    'Multi-company accounts for groups & brands',
                    'On-chain options when capital or pedigree must be proven',
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
              <ShieldCheck size={16} /> Trusted network
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-[-0.04em] text-slate-900 mb-3">
              Businesses on SupplierAdvisor®
            </h2>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
              {verifiedCount > 0
                ? `${verifiedCount}+ verified and network companies building transparent trade together`
                : 'Companies building transparent, ethical trade on the platform'}
            </p>
          </div>

          {loadingVerified ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="border border-slate-200 rounded-3xl p-6 sm:p-8 bg-slate-50 animate-pulse h-40"
                />
              ))}
            </div>
          ) : verifiedCompanies.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {verifiedCompanies.map((company) => {
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
                return (
                  <div
                    key={company.id}
                    className="border border-slate-200 rounded-2xl sm:rounded-3xl p-5 sm:p-7 hover:shadow-lg hover:border-cyan-200 transition-all bg-white"
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
                            : 'bg-sky-50 text-sky-800 border border-sky-100'
                        }`}
                      >
                        {isVerified ? 'Verified' : 'On network'}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-500 flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-[#00b4d8] shrink-0" />
                      <span className="truncate">{meta || 'Business on SupplierAdvisor'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
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
      <section className="relative py-16 sm:py-20 md:py-28 px-4 sm:px-6 lg:px-10 overflow-hidden">
        <div
          className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-[#023e5a]"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(#ffffff_0.7px,transparent_0.7px)] bg-[length:16px_16px] opacity-[0.07]"
          aria-hidden
        />
        <div className="relative max-w-3xl mx-auto text-center text-white">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-[-0.04em] mb-5">
            The future of supply chains is here.
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-white/75 mb-10 leading-relaxed">
            Join the movement that makes transparency the standard and ethics the competitive
            advantage.
          </p>
          <Link
            href="/onboarding?type=business"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00b4d8] hover:bg-[#0099b8] text-white font-semibold text-base sm:text-lg px-8 sm:px-12 py-4 sm:py-5 transition-all touch-manipulation shadow-lg shadow-cyan-500/20"
          >
            Get started in under 5 minutes <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-xs sm:text-sm text-white/45 mt-6">
            Free company workspace ·{' '}
            <Link href="/terms" className="underline hover:text-white">
              Terms
            </Link>{' '}
            ·{' '}
            <Link href="/privacy" className="underline hover:text-white">
              Privacy
            </Link>
          </p>
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
                Verified, transparent supply-chain operating system for B2B, B2G, and B2C.
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
          <div className="pt-6 border-t border-slate-800 text-xs text-white/40 flex flex-col sm:flex-row justify-between gap-2">
            <span>SupplierAdvisor® 2026 © All rights reserved.</span>
            <span>Built for operators who measure trust.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
