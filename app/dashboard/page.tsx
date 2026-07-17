'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode, Suspense } from 'react';
import Link from 'next/link';
import {
  Users,
  Truck,
  Package,
  AlertTriangle,
  Network,
  RefreshCw,
  TrendingUp,
  ShoppingCart,
  Loader2,
  Wallet,
  Search,
  Tag,
  Boxes,
  Factory,
  Ship,
  Building2,
  ChevronDown,
  Brain,
  ClipboardCheck,
  ArrowRight,
  Landmark,
  Percent,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  AlertBanner,
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import FxRateStrip from '@/components/fx/FxRateStrip';
import {
  HubHero,
  HubModuleGrid,
  HubPrinciples,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
  type TelemetryAccent,
} from '@/components/chrome/CommandHubChrome';
import GoldenPathChecklist from '@/components/onboarding/GoldenPathChecklist';
import RatingPromptBanner from '@/components/ratings/RatingPromptBanner';
import FirstHourKickstart from '@/components/dashboard/FirstHourKickstart';
import CatalogueEmptyBanner from '@/components/business/CatalogueEmptyBanner';
import TradeNextBanner from '@/components/journey/TradeNextBanner';
import { computeHubNextAction } from '@/lib/connections/next-action';
import CipcMismatchBanner from '@/components/business/CipcMismatchBanner';
import OpsHealthStrip from '@/components/system/OpsHealthStrip';

type CompanyData = {
  id: number;
  trading_name: string;
  legal_name: string | null;
  industry: string | null;
  verification_status?: string | null;
  country?: string | null;
  city?: string | null;
  trust_score?: number | null;
  primary_currency?: string | null;
};

type Kpis = {
  teamActive: number;
  teamInvited: number;
  networkAccepted: number;
  networkPendingIn?: number;
  networkPendingOut?: number;
  openRisks: number;
  highRisks: number;
  products: number;
  containersActive?: number;
  containersTotal?: number;
  warehouseLowStock?: number;
  containerLowStock?: number;
  salesToday?: number;
  customersTotal?: number;
  leadsOpen?: number;
  pipelineValue?: number;
  opportunitiesOpen?: number;
  crmRiadOpen?: number;
  srmBookTotal?: number;
  srmConnected?: number;
  srmVerified?: number;
  srmAvgTrust?: number;
  srmAvgOtifef?: number;
  srmOpenPos?: number;
  srmOnchainPos?: number;
  srmRiadOpen?: number;
  profileCompleteness?: number;
  pricingActive?: number;
  quotesOpen?: number;
  quotesValue?: number;
  quotesAcceptedValue?: number;
  quotesTotalValue?: number;
  invoicesOpen?: number;
  invoicesDraft?: number;
  invoicesOverdue?: number;
  invoicesOpenValue?: number;
  invoicesPaidValue?: number;
  invoicesTotalValue?: number;
  invoicesCollectedValue?: number;
  multiCurrencyProducts?: number;
  catalogueCurrencies?: string[];
  arOpen?: number;
  arOpenValue?: number;
  apOpen?: number;
  apOpenValue?: number;
};

type AlertItem = {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  href: string;
};

type OpsSnap = {
  workOrdersInFlight?: number;
  shipmentsInMotion?: number;
  exceptions?: number;
  unitsOnHand?: number;
  qualityOpen?: number;
  supplierPosOpen?: number;
  inboundInMotion?: number;
  outboundInMotion?: number;
  transfersLive?: number;
  throughput?: number;
  warehouses?: number;
  bomsActive?: number;
  workCells?: number;
  customerPosOpen?: number;
};

type MfgSnap = {
  boms?: number;
  bomsActive?: number;
  orders?: number;
  ordersInProgress?: number;
  ordersReleased?: number;
  ordersHold?: number;
  ordersComplete?: number;
  oee?: number;
  yieldPct?: number;
  completionPct?: number;
  workCenters?: number;
  workCentersActive?: number;
  mpsPlans?: number;
  unitsOnHand?: number;
};

type FinSnap = {
  arOpen?: number;
  arBalance?: number;
  apOpen?: number;
  apBalance?: number;
  coaAccounts?: number;
  journalsPosted?: number;
  bankAccounts?: number;
  unreconciled?: number;
  monthPayments?: number;
};

type IntelSnap = {
  overallHealth?: number;
  networkScore?: number;
  supplyScore?: number;
  demandScore?: number;
  financeScore?: number;
  opsScore?: number;
  poGrowth?: number;
  salesGrowth?: number;
  pipelineValue?: number;
  quoteWinRate?: number;
};

type Metric = {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function money(n: number, currency = 'ZAR') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'ZAR',
      maximumFractionDigits: 0,
    }).format(n || 0);
  } catch {
    return `${currency} ${Math.round(n || 0).toLocaleString()}`;
  }
}

function formatRelative(iso: string | null | undefined) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

function toneClass(tone?: Metric['tone']) {
  if (tone === 'good') return 'text-emerald-700';
  if (tone === 'warn') return 'text-amber-700';
  if (tone === 'bad') return 'text-rose-700';
  return 'text-slate-900';
}

export default function DashboardCommandCenter() {
  const companyId = getSelectedCompanyId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [crm, setCrm] = useState<{
    customers: number;
    pipelineValue: number;
    pipelineWeighted?: number;
    opportunitiesOpen: number;
    opportunitiesTotal?: number;
    leadsOpen: number;
    leadsTotal?: number;
    riadOpen: number;
    wonCount?: number;
    wonValue?: number;
    invoicedCount?: number;
    invoicedValue?: number;
    lostCount?: number;
    invitePending?: number;
    quotesOpen?: number;
    quotesValue?: number;
    quotesAcceptedValue?: number;
    quotesTotalValue?: number;
    invoicesOpen?: number;
    invoicesDraft?: number;
    invoicesOverdue?: number;
    invoicesOpenValue?: number;
    invoicesPaidValue?: number;
    invoicesTotalValue?: number;
    invoicesCollectedValue?: number;
    feedbackCount?: number;
    feedbackAvgStars?: number | null;
    feedbackAvgOtifef?: number | null;
    peerAvgStars?: number | null;
    peerRatedCount?: number;
    pipelineStages?: Array<{
      stage: string;
      label: string;
      probability: number;
      count: number;
      value: number;
      weighted: number;
    }>;
  } | null>(null);
  const [srm, setSrm] = useState<{
    book: number;
    openPos: number;
    onchainPos: number;
    avgOtifef: number;
    avgTrust: number;
    verified: number;
    riadOpen: number;
    connected?: number;
    preferred?: number;
    invitePending?: number;
  } | null>(null);
  const [network, setNetwork] = useState<{
    accepted: number;
    pendingIn: number;
    pendingOut: number;
    pricingActive: number;
  } | null>(null);
  const [trade, setTrade] = useState<{
    quotesOpen: number;
    quotesValue: number;
    quotesAcceptedValue?: number;
    quotesTotalValue?: number;
    invoicesOpen?: number;
    invoicesDraft?: number;
    invoicesOverdue?: number;
    invoicesOpenValue?: number;
    invoicesPaidValue?: number;
    invoicesTotalValue?: number;
    invoicesCollectedValue?: number;
    arOpen: number;
    arOpenValue: number;
    apOpen: number;
    apOpenValue: number;
    openPos: number;
    onchainPos: number;
  } | null>(null);
  const [inventory, setInventory] = useState<{
    products: number;
    multiCurrencyProducts: number;
    warehouseLowStock: number;
    warehouses: number;
  } | null>(null);
  const [business, setBusiness] = useState<{
    profileCompleteness: number;
    teamActive: number;
    teamInvited: number;
    verified: boolean;
  } | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [ops, setOps] = useState<OpsSnap | null>(null);
  const [mfg, setMfg] = useState<MfgSnap | null>(null);
  const [fin, setFin] = useState<FinSnap | null>(null);
  const [intel, setIntel] = useState<IntelSnap | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    business: true,
    financial: true,
    crm: true,
    srm: false,
    operations: false,
    manufacturing: false,
    quality: false,
    intelligence: false,
    inventory: false,
  });

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [dashRes, opsRes, mfgRes, finRes, intelRes] = await Promise.all([
        fetch('/api/dashboard/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId }),
        }),
        fetch(`/api/operations/summary?companyId=${companyId}`).catch(() => null),
        fetch(`/api/manufacturing/summary?companyId=${companyId}`).catch(() => null),
        fetch(`/api/accounting/summary?companyId=${companyId}`).catch(() => null),
        fetch('/api/intelligence/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId }),
        }).catch(() => null),
      ]);

      const data = await dashRes.json();
      if (!dashRes.ok) throw new Error(data.error || 'Failed to load dashboard');

      setCompany(data.company || null);
      setKpis(data.kpis || null);
      setCrm(data.crm || null);
      setSrm(data.srm || null);
      setNetwork(data.network || null);
      setTrade(data.trade || null);
      setInventory(data.inventory || null);
      setBusiness(data.business || null);
      setAlerts(data.alerts || []);
      setGeneratedAt(data.generatedAt || null);

      if (opsRes?.ok) {
        const o = await opsRes.json();
        setOps(o.summary || null);
      } else setOps(null);

      if (mfgRes?.ok) {
        const m = await mfgRes.json();
        setMfg(m.summary || null);
      } else setMfg(null);

      if (finRes?.ok) {
        const f = await finRes.json();
        const s = f.summary || f;
        setFin({
          arOpen: s.arOpen,
          arBalance: s.arOpenAmount ?? s.arBalance,
          apOpen: s.apOpen,
          apBalance: s.apOpenAmount ?? s.apBalance,
          coaAccounts: s.coaActive ?? s.coaCount,
          journalsPosted: s.journalsPosted,
          bankAccounts: s.bankAccounts,
          unreconciled: s.unreconciled,
          monthPayments: s.paymentsThisMonth,
        });
      } else setFin(null);

      if (intelRes?.ok) {
        const i = await intelRes.json();
        const health = i.health || {};
        const forecasts = i.forecasts || {};
        const pulse = i.pulse || {};
        setIntel({
          overallHealth: health.overall,
          networkScore: health.network,
          supplyScore: health.supply,
          demandScore: health.demand,
          financeScore: health.finance,
          opsScore: health.ops,
          poGrowth: forecasts.poGrowth ?? pulse.poGrowth,
          salesGrowth: forecasts.salesGrowth ?? pulse.salesGrowth,
          pipelineValue: pulse.pipelineValue,
          quoteWinRate: pulse.quoteWinRate,
        });
      } else setIntel(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const baseCcy = company?.primary_currency || 'ZAR';
  const pendingIn = network?.pendingIn ?? kpis?.networkPendingIn ?? 0;
  const openPos = trade?.openPos ?? srm?.openPos ?? kpis?.srmOpenPos ?? 0;
  const lowStock =
    (inventory?.warehouseLowStock ?? kpis?.warehouseLowStock ?? 0) +
    (kpis?.containerLowStock ?? 0);
  const attention =
    alerts.filter((a) => a.severity === 'critical' || a.severity === 'warning').length +
    (kpis?.openRisks ?? 0) +
    (crm?.riadOpen ?? 0) +
    (srm?.riadOpen ?? 0) +
    (ops?.exceptions ?? 0);
  const inMotion =
    (ops?.workOrdersInFlight ?? 0) + (ops?.shipmentsInMotion ?? 0);

  const arValue = fin?.arBalance ?? trade?.arOpenValue ?? kpis?.arOpenValue ?? 0;
  const apValue = fin?.apBalance ?? trade?.apOpenValue ?? kpis?.apOpenValue ?? 0;
  const completeness = business?.profileCompleteness ?? kpis?.profileCompleteness ?? 0;

  const toggle = (id: string) =>
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const expandAll = () =>
    setOpenSections({
      business: true,
      financial: true,
      crm: true,
      srm: true,
      operations: true,
      manufacturing: true,
      quality: true,
      intelligence: true,
      inventory: true,
    });

  const collapseAll = () =>
    setOpenSections({
      business: false,
      financial: false,
      crm: false,
      srm: false,
      operations: false,
      manufacturing: false,
      quality: false,
      intelligence: false,
      inventory: false,
    });

  const topCards = useMemo(
    () => [
      {
        label: 'Network',
        value: network?.accepted ?? kpis?.networkAccepted ?? 0,
        sub: pendingIn > 0 ? `${pendingIn} waiting` : 'Connected',
        href: '/dashboard/connections',
        icon: Network,
        accent: (pendingIn > 0 ? 'amber' : 'emerald') as TelemetryAccent,
      },
      {
        label: 'Pipeline',
        value: money(crm?.pipelineValue ?? kpis?.pipelineValue ?? 0, baseCcy),
        sub: `${crm?.opportunitiesOpen ?? kpis?.opportunitiesOpen ?? 0} deals`,
        href: '/dashboard/customers/leads',
        icon: TrendingUp,
        accent: 'emerald' as TelemetryAccent,
      },
      {
        label: 'Open POs',
        value: openPos,
        sub: `${trade?.onchainPos ?? srm?.onchainPos ?? 0} on-chain`,
        href: '/dashboard/suppliers/po',
        icon: ShoppingCart,
        accent: (openPos > 0 ? 'cyan' : 'slate') as TelemetryAccent,
      },
      {
        label: 'AR open',
        value: money(arValue, baseCcy),
        sub: `${trade?.arOpen ?? kpis?.arOpen ?? fin?.arOpen ?? 0} invoices`,
        href: '/dashboard/accounting/accounts-receivable',
        icon: Wallet,
        accent: 'emerald' as TelemetryAccent,
      },
      {
        label: 'In motion',
        value: inMotion,
        sub: `${ops?.workOrdersInFlight ?? 0} WO · ${ops?.shipmentsInMotion ?? 0} ship`,
        href: '/dashboard/operations',
        icon: Factory,
        accent: 'violet' as TelemetryAccent,
      },
      {
        label: 'Attention',
        value: attention,
        sub: attention === 0 ? 'All clear' : 'Needs review',
        href:
          attention > 0 && alerts[0]
            ? alerts[0].href
            : '/dashboard/operations/exceptions',
        icon: AlertTriangle,
        accent: (attention > 0 ? 'rose' : 'emerald') as TelemetryAccent,
      },
    ],
    [
      network,
      kpis,
      pendingIn,
      crm,
      baseCcy,
      openPos,
      trade,
      srm,
      arValue,
      fin,
      inMotion,
      ops,
      attention,
      alerts,
    ]
  );

  const modules: HubModule[] = [
    {
      href: '/dashboard/operations',
      icon: Factory,
      code: 'OPS',
      title: 'Operations tower',
      desc: 'Procure → inbound → warehouse → make → outbound → fulfill.',
      accent: 'from-cyan-50 to-white border-cyan-100',
      metric: inMotion,
      metricLabel: 'in motion',
    },
    {
      href: '/dashboard/suppliers',
      icon: Truck,
      code: 'SRM',
      title: 'Suppliers',
      desc: 'Discover, connect, PO, OTIFEF — trust you can measure.',
      accent: 'from-violet-50 to-white border-violet-100',
      metric: srm?.book ?? kpis?.srmBookTotal ?? 0,
      metricLabel: 'in book',
    },
    {
      href: '/dashboard/customers',
      icon: Users,
      code: 'CRM',
      title: 'Customers',
      desc: 'Lead → quote → order → invoice → loyalty on one tower.',
      accent: 'from-sky-50 to-white border-sky-100',
      metric: crm?.customers ?? kpis?.customersTotal ?? 0,
      metricLabel: 'accounts',
    },
    {
      href: '/dashboard/accounting',
      icon: Wallet,
      code: 'FIN',
      title: 'Accounting',
      desc: 'Books, AR/AP, bank, management accounts, forecasts.',
      accent: 'from-violet-50 to-white border-violet-100',
    },
    {
      href: '/dashboard/manufacturing',
      icon: Factory,
      code: 'MFG',
      title: 'Manufacturing',
      desc: 'BOMs, MPS, MRP, and work-order execution.',
      accent: 'from-amber-50 to-white border-amber-100',
      metric: mfg?.ordersInProgress ?? ops?.workOrdersInFlight ?? 0,
      metricLabel: 'WOs live',
    },
    {
      href: '/dashboard/intelligence',
      icon: Brain,
      code: 'BI',
      title: 'Intelligence',
      desc: 'Pulse, insights, forecasts, Super-Cube® leadership.',
      accent: 'from-sky-50 to-white border-sky-100',
      metric: intel?.overallHealth != null ? `${Math.round(intel.overallHealth)}` : '—',
      metricLabel: 'health',
    },
  ];

  if (!companyId) {
    return (
      <RelationshipPage>
        <div className="text-center py-24">
          <p className="text-neutral-600 mb-4">Select a company to open your command center.</p>
          <Link href="/dashboard/select-company" className="btn-primary !py-3 !px-8">
            Select company
          </Link>
        </div>
      </RelationshipPage>
    );
  }

  const name = company?.trading_name || company?.legal_name || 'Your company';
  const place = [company?.city, company?.country].filter(Boolean).join(', ');

  return (
    <RelationshipPage>
      <RelationshipHeader
        eyebrow="Command center"
        title={greeting() + ','}
        titleAccent={name}
        description={
          place
            ? `${place}${company?.industry ? ` · ${company.industry}` : ''} — expandable live snapshot across business, money, trade, and operations.`
            : 'Expandable live snapshot across business, money, trade, and operations.'
        }
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-5 -mt-2">
        {company?.verification_status === 'verified' && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            Verified
          </span>
        )}
        <span className="text-[11px] text-neutral-400">
          {baseCcy}
          {generatedAt ? ` · ${formatRelative(generatedAt) || 'live'}` : ''}
        </span>
      </div>

      <FxRateStrip currency={baseCcy} className="mb-6" />

      <OpsHealthStrip compact />

      <FirstHourKickstart
        loading={loading && !kpis}
        networkAccepted={network?.accepted ?? kpis?.networkAccepted ?? 0}
        openPos={openPos}
        products={kpis?.products ?? inventory?.products ?? 0}
        profileCompleteness={completeness}
        quotesOpen={kpis?.quotesOpen ?? trade?.quotesOpen ?? 0}
      />

      {!loading ? (
        <>
          <CipcMismatchBanner
            verificationStatus={company?.verification_status}
            onFixed={() => void load()}
          />
          <TradeNextBanner
            action={computeHubNextAction({
              role: 'main',
              openOutboundPos: openPos,
              openInboundPos: Number(ops?.customerPosOpen || 0),
              pendingConnections: pendingIn,
              draftInvoices: Number(
                crm?.invoicesDraft ??
                  trade?.invoicesDraft ??
                  kpis?.invoicesDraft ??
                  0
              ),
              overdueInvoices: Number(
                crm?.invoicesOverdue ??
                  trade?.invoicesOverdue ??
                  kpis?.invoicesOverdue ??
                  0
              ),
              profileCompleteness: completeness,
              verificationStatus: company?.verification_status,
              catalogueEmpty:
                (kpis?.products ?? inventory?.products ?? 0) === 0,
            })}
          />
        </>
      ) : null}

      <GoldenPathChecklist />
      <CatalogueEmptyBanner />
      <Suspense fallback={null}>
        <RatingPromptBanner />
      </Suspense>

      {error && (
        <AlertBanner tone="red">
          <div className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={() => void load()} className="font-semibold underline">
              Retry
            </button>
          </div>
        </AlertBanner>
      )}

      <HubHero
        pill="Live command · expand any domain"
        title="One company. Zero blind spots."
        description="Top-line telemetry stays visible. Expand Business, Finance, CRM, SRM, Operations, Manufacturing, Quality, and Intelligence for deep KPIs and shortcuts."
        stats={[
          {
            label: 'Network',
            value: loading ? '—' : network?.accepted ?? kpis?.networkAccepted ?? 0,
            valueClass: 'text-[#00b4d8]',
          },
          {
            label: 'In motion',
            value: loading ? '—' : inMotion,
            valueClass: 'text-emerald-600',
          },
          {
            label: 'Attention',
            value: loading ? '—' : attention,
            valueClass: 'text-amber-600',
          },
        ]}
      />

      {loading && !kpis ? (
        <div className="py-24 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          <HubTelemetryGrid className="mb-8">
            {topCards.map((c) => (
              <TelemetryCard
                key={c.label}
                label={c.label}
                value={c.value}
                sub={c.sub}
                accent={c.accent}
                icon={c.icon}
                href={c.href}
              />
            ))}
          </HubTelemetryGrid>

          {alerts.length > 0 && (
            <div className="rounded-3xl border border-neutral-200 bg-white shadow-sm mb-8 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-700 tracking-wide">Needs attention</h2>
                <span className="text-[10px] font-semibold text-neutral-400">
                  {alerts.length} signal{alerts.length === 1 ? '' : 's'}
                </span>
              </div>
              <ul className="divide-y divide-neutral-100">
                {alerts.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={a.href}
                      className="flex gap-3 px-5 py-3.5 hover:bg-sky-50/40 transition-colors"
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                          a.severity === 'critical'
                            ? 'bg-red-500'
                            : a.severity === 'warning'
                              ? 'bg-amber-500'
                              : 'bg-sky-500'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900">{a.title}</div>
                        <div className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                          {a.detail}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Expandable domain sections ── */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-slate-900 tracking-tight">
                Domain command boards
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Expand a section for KPIs, projections, and deep links
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={expandAll}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-neutral-200 bg-white text-slate-600 hover:border-[#00b4d8]"
              >
                Expand all
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-neutral-200 bg-white text-slate-600 hover:border-[#00b4d8]"
              >
                Collapse all
              </button>
            </div>
          </div>

          <div className="space-y-3 mb-10">
            <ExpandableSection
              id="business"
              open={!!openSections.business}
              onToggle={() => toggle('business')}
              icon={Building2}
              code="BUS"
              title="Business"
              summary={`${completeness}% profile · ${business?.teamActive ?? kpis?.teamActive ?? 0} team`}
              badge={
                completeness < 70
                  ? { label: 'Complete profile', tone: 'warn' }
                  : business?.verified
                    ? { label: 'Verified', tone: 'good' }
                    : undefined
              }
              href="/dashboard/my-business"
              accent="from-slate-50 to-white border-slate-100"
            >
              <MetricGrid
                metrics={[
                  {
                    label: 'Profile completeness',
                    value: `${completeness}%`,
                    sub: completeness < 80 ? 'Finish onboarding fields' : 'Looking solid',
                    href: '/dashboard/my-business/profile',
                    tone: completeness >= 80 ? 'good' : completeness >= 50 ? 'warn' : 'bad',
                  },
                  {
                    label: 'Team active',
                    value: business?.teamActive ?? kpis?.teamActive ?? 0,
                    sub:
                      (business?.teamInvited ?? kpis?.teamInvited ?? 0) > 0
                        ? `${business?.teamInvited ?? kpis?.teamInvited} invited`
                        : 'Members with access',
                    href: '/dashboard/my-business/team',
                  },
                  {
                    label: 'Verification',
                    value: business?.verified || company?.verification_status === 'verified' ? 'Verified' : 'Pending',
                    sub: company?.industry || 'Business status',
                    href: '/dashboard/my-business',
                    tone:
                      business?.verified || company?.verification_status === 'verified'
                        ? 'good'
                        : 'warn',
                  },
                  {
                    label: 'Network accepted',
                    value: network?.accepted ?? kpis?.networkAccepted ?? 0,
                    sub: `${pendingIn} inbound · ${network?.pendingOut ?? 0} outbound`,
                    href: '/dashboard/connections',
                    tone: pendingIn > 0 ? 'warn' : 'default',
                  },
                  {
                    label: 'Pricing agreements',
                    value: network?.pricingActive ?? kpis?.pricingActive ?? 0,
                    sub: 'Active trade edges',
                    href: '/dashboard/connections/pricing',
                  },
                  {
                    label: 'Open RIAD / risks',
                    value: kpis?.openRisks ?? 0,
                    sub: `${kpis?.highRisks ?? 0} high priority`,
                    href: '/dashboard/my-business/riad-log',
                    tone: (kpis?.highRisks ?? 0) > 0 ? 'bad' : (kpis?.openRisks ?? 0) > 0 ? 'warn' : 'good',
                  },
                ]}
              />
              <SectionLinks
                links={[
                  { href: '/dashboard/my-business/team', label: 'Team' },
                  { href: '/dashboard/my-business/profile', label: 'Profile' },
                  { href: '/dashboard/my-business/documents', label: 'Documents' },
                  { href: '/dashboard/invite-business', label: 'Invite business' },
                ]}
              />
            </ExpandableSection>

            <ExpandableSection
              id="financial"
              open={!!openSections.financial}
              onToggle={() => toggle('financial')}
              icon={Landmark}
              code="FIN"
              title="Financial"
              summary={`${money(arValue, baseCcy)} AR · ${money(apValue, baseCcy)} AP`}
              badge={
                (fin?.unreconciled ?? 0) > 0
                  ? { label: `${fin?.unreconciled} unreconciled`, tone: 'warn' }
                  : { label: 'Books live', tone: 'good' }
              }
              href="/dashboard/accounting"
              accent="from-violet-50 to-white border-violet-100"
            >
              <MetricGrid
                metrics={[
                  {
                    label: 'AR open',
                    value: money(arValue, baseCcy),
                    sub: `${fin?.arOpen ?? trade?.arOpen ?? kpis?.arOpen ?? 0} invoices`,
                    href: '/dashboard/accounting/accounts-receivable',
                    tone: arValue > 0 ? 'warn' : 'good',
                  },
                  {
                    label: 'AP open',
                    value: money(apValue, baseCcy),
                    sub: `${fin?.apOpen ?? trade?.apOpen ?? kpis?.apOpen ?? 0} bills`,
                    href: '/dashboard/accounting/accounts-payable',
                  },
                  {
                    label: 'Working capital proxy',
                    value: money(arValue - apValue, baseCcy),
                    sub: 'AR − AP (open)',
                    href: '/dashboard/accounting/management',
                    tone: arValue - apValue >= 0 ? 'good' : 'warn',
                  },
                  {
                    label: 'CoA accounts',
                    value: fin?.coaAccounts ?? '—',
                    sub: 'Active chart',
                    href: '/dashboard/accounting/chart-of-accounts',
                  },
                  {
                    label: 'Journals posted',
                    value: fin?.journalsPosted ?? '—',
                    sub: 'Ledger activity',
                    href: '/dashboard/accounting/journal-entries',
                  },
                  {
                    label: 'Bank accounts',
                    value: fin?.bankAccounts ?? '—',
                    sub:
                      (fin?.unreconciled ?? 0) > 0
                        ? `${fin?.unreconciled} unreconciled lines`
                        : 'Reconciled pulse',
                    href: '/dashboard/accounting/bank-reconciliation',
                    tone: (fin?.unreconciled ?? 0) > 0 ? 'warn' : 'default',
                  },
                  {
                    label: 'Catalogue currencies',
                    value: (kpis?.catalogueCurrencies || []).length || 1,
                    sub: (kpis?.catalogueCurrencies || [baseCcy]).slice(0, 4).join(' · ') || baseCcy,
                    href: '/dashboard/inventory/products',
                  },
                  {
                    label: 'Multi-ccy products',
                    value: inventory?.multiCurrencyProducts ?? kpis?.multiCurrencyProducts ?? 0,
                    sub: 'Priced in >1 currency',
                    href: '/dashboard/inventory/products',
                  },
                ]}
              />
              <div className="mt-4 rounded-2xl border border-cyan-100 bg-gradient-to-r from-sky-50/80 to-white px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-wider text-[#0077b6] mb-1">
                  FX context
                </div>
                <p className="text-xs text-slate-600 mb-2">
                  Live reference rates for {baseCcy} trading — expand the strip above or open
                  management accounts for P&amp;L and 1–12m forecasts.
                </p>
                <SectionLinks
                  links={[
                    { href: '/dashboard/accounting/management', label: 'Management accounts' },
                    { href: '/dashboard/accounting/reports', label: 'Reports & forecast' },
                    { href: '/dashboard/accounting/bank-reconciliation', label: 'Bank' },
                    { href: '/dashboard/accounting/tax', label: 'Tax' },
                  ]}
                />
              </div>
            </ExpandableSection>

            <ExpandableSection
              id="crm"
              open={!!openSections.crm}
              onToggle={() => toggle('crm')}
              icon={Users}
              code="CRM"
              title="CRM · sales & customers"
              summary={`${crm?.opportunitiesOpen ?? kpis?.opportunitiesOpen ?? 0} open deals · ${money(
                crm?.pipelineValue ?? kpis?.pipelineValue ?? 0,
                baseCcy
              )} pipeline · ${
                crm?.feedbackAvgStars != null
                  ? `${crm.feedbackAvgStars.toFixed(1)}★ feedback`
                  : 'no feedback yet'
              }`}
              badge={
                crm?.feedbackAvgStars != null
                  ? {
                      label: `${crm.feedbackAvgStars.toFixed(1)}★`,
                      tone: 'good',
                    }
                  : (crm?.leadsOpen ?? 0) > 0
                    ? { label: `${crm?.leadsOpen} leads`, tone: 'good' }
                    : undefined
              }
              href="/dashboard/customers/report"
              accent="from-sky-50 to-white border-sky-100"
            >
              {/* Same headline KPIs as Customers → Leads + customer feedback stars */}
              <MetricGrid
                metrics={[
                  {
                    label: 'Customer feedback ★',
                    value:
                      crm?.feedbackAvgStars != null
                        ? `${crm.feedbackAvgStars.toFixed(1)} ★`
                        : '—',
                    sub:
                      (crm?.feedbackCount ?? 0) > 0
                        ? `${crm?.feedbackCount} invoice ratings${
                            crm?.feedbackAvgOtifef != null
                              ? ` · OTIFEF ${crm.feedbackAvgOtifef}`
                              : ''
                          }`
                        : 'From invoice QR rate links',
                    href: '/dashboard/customers/report',
                    tone:
                      crm?.feedbackAvgStars != null
                        ? crm.feedbackAvgStars >= 4
                          ? 'good'
                          : crm.feedbackAvgStars < 3
                            ? 'warn'
                            : 'default'
                        : 'default',
                  },
                  {
                    label: 'Open leads',
                    value: crm?.leadsOpen ?? kpis?.leadsOpen ?? 0,
                    sub: `${crm?.leadsTotal ?? crm?.leadsOpen ?? 0} total in book`,
                    href: '/dashboard/customers/leads',
                  },
                  {
                    label: 'Open deals',
                    value: crm?.opportunitiesOpen ?? kpis?.opportunitiesOpen ?? 0,
                    sub: `${crm?.opportunitiesTotal ?? 0} total opportunities`,
                    href: '/dashboard/customers/leads?tab=pipeline',
                    tone: 'good',
                  },
                  {
                    label: 'Pipeline',
                    value: money(crm?.pipelineValue ?? kpis?.pipelineValue ?? 0, baseCcy),
                    sub: 'Open opportunity amount',
                    href: '/dashboard/customers/leads?tab=pipeline',
                    tone: 'good',
                  },
                  {
                    label: 'Weighted',
                    value: money(crm?.pipelineWeighted ?? 0, baseCcy),
                    sub: 'Probability-weighted pipeline',
                    href: '/dashboard/customers/leads?tab=pipeline',
                  },
                  {
                    label: 'Won value',
                    value: money(crm?.wonValue ?? 0, baseCcy),
                    sub: `${crm?.wonCount ?? 0} closed-won deals`,
                    href: '/dashboard/customers/leads?tab=pipeline',
                    tone: 'good',
                  },
                  {
                    label: 'Peer stars (you→them)',
                    value:
                      crm?.peerAvgStars != null
                        ? `${crm.peerAvgStars.toFixed(1)} ★`
                        : '—',
                    sub:
                      (crm?.peerRatedCount ?? 0) > 0
                        ? `${crm?.peerRatedCount} buyers rated`
                        : 'Rate buyers on Customers → Ratings',
                    href: '/dashboard/customers/ratings',
                  },
                  {
                    label: 'Customers',
                    value: crm?.customers ?? kpis?.customersTotal ?? 0,
                    sub: 'Accounts in book',
                    href: '/dashboard/customers',
                  },
                ]}
              />

              {/* Pipeline stage strip — count + value per stage */}
              {crm?.pipelineStages && crm.pipelineStages.length > 0 && (
                <div className="mt-3 mb-1">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400 mb-2 px-0.5">
                    Pipeline by stage
                  </div>
                  <div className="overflow-x-auto pb-1 -mx-0.5">
                    <div className="flex gap-2 min-w-max px-0.5">
                      {crm.pipelineStages.map((st) => (
                        <Link
                          key={st.stage}
                          href="/dashboard/customers/leads?tab=pipeline"
                          className={`w-[132px] shrink-0 rounded-2xl border px-3 py-2.5 bg-white shadow-sm hover:border-[#00b4d8]/50 transition-colors ${
                            st.count > 0
                              ? 'border-sky-100'
                              : 'border-neutral-100 opacity-70'
                          }`}
                        >
                          <div className="text-[10px] font-bold text-neutral-500 truncate">
                            {st.label}
                          </div>
                          <div className="text-lg font-black tabular-nums text-slate-900 leading-tight">
                            {st.count}
                          </div>
                          <div className="text-[11px] font-semibold text-emerald-700 tabular-nums truncate">
                            {money(st.value, baseCcy)}
                          </div>
                          <div className="text-[10px] text-neutral-400">
                            w {money(st.weighted, baseCcy)} · {st.probability}%
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-3">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400 mb-2 px-0.5">
                  Quotes &amp; invoices processed
                </div>
                <MetricGrid
                  metrics={[
                    {
                      label: 'Quoted amount',
                      value: money(
                        crm?.quotesValue ?? trade?.quotesValue ?? kpis?.quotesValue ?? 0,
                        baseCcy
                      ),
                      sub: `${crm?.quotesOpen ?? trade?.quotesOpen ?? kpis?.quotesOpen ?? 0} open quotes`,
                      href: '/dashboard/customers/quotes',
                      tone: 'good',
                    },
                    {
                      label: 'Quotes accepted',
                      value: money(
                        crm?.quotesAcceptedValue ?? trade?.quotesAcceptedValue ?? 0,
                        baseCcy
                      ),
                      sub: 'Accepted / converted quote total',
                      href: '/dashboard/customers/quotes',
                    },
                    {
                      label: 'Invoiced open',
                      value: money(
                        crm?.invoicesOpenValue ??
                          trade?.invoicesOpenValue ??
                          kpis?.invoicesOpenValue ??
                          0,
                        baseCcy
                      ),
                      sub: `${crm?.invoicesOpen ?? trade?.invoicesOpen ?? kpis?.invoicesOpen ?? 0} outstanding`,
                      href: '/dashboard/customers/invoices',
                      tone:
                        (crm?.invoicesOpenValue ?? trade?.invoicesOpenValue ?? 0) > 0
                          ? 'warn'
                          : 'good',
                    },
                    {
                      label: 'Invoiced paid',
                      value: money(
                        crm?.invoicesPaidValue ?? trade?.invoicesPaidValue ?? 0,
                        baseCcy
                      ),
                      sub: `Collected ${money(
                        crm?.invoicesCollectedValue ?? trade?.invoicesCollectedValue ?? 0,
                        baseCcy
                      )}`,
                      href: '/dashboard/customers/invoices',
                      tone: 'good',
                    },
                  ]}
                />
              </div>

              <SectionLinks
                links={[
                  { href: '/dashboard/customers/report', label: 'Customer report' },
                  { href: '/dashboard/customers/ratings', label: 'Star ratings' },
                  { href: '/dashboard/customers/leads', label: 'Leads' },
                  { href: '/dashboard/customers/leads?tab=pipeline', label: 'Pipeline map' },
                  { href: '/dashboard/customers/quotes', label: 'Quotes' },
                  { href: '/dashboard/customers/orders', label: 'Orders' },
                  { href: '/dashboard/customers/invoices', label: 'Invoices' },
                  { href: '/dashboard/customers/loyalty', label: 'Loyalty' },
                ]}
              />
            </ExpandableSection>

            <ExpandableSection
              id="srm"
              open={!!openSections.srm}
              onToggle={() => toggle('srm')}
              icon={Truck}
              code="SRM"
              title="SRM · suppliers & POs"
              summary={`${srm?.book ?? kpis?.srmBookTotal ?? 0} suppliers · ${openPos} open POs`}
              badge={
                Number(srm?.avgOtifef ?? kpis?.srmAvgOtifef ?? 0) >= 90
                  ? { label: 'OTIFEF strong', tone: 'good' }
                  : openPos > 0
                    ? { label: `${openPos} POs live`, tone: 'warn' }
                    : undefined
              }
              href="/dashboard/suppliers"
              accent="from-violet-50 to-white border-violet-100"
            >
              <MetricGrid
                metrics={[
                  {
                    label: 'Supplier book',
                    value: srm?.book ?? kpis?.srmBookTotal ?? 0,
                    sub: `${srm?.connected ?? kpis?.srmConnected ?? 0} connected`,
                    href: '/dashboard/suppliers',
                  },
                  {
                    label: 'Verified',
                    value: srm?.verified ?? kpis?.srmVerified ?? 0,
                    sub: `${srm?.preferred ?? 0} preferred`,
                    href: '/dashboard/suppliers/directory',
                    tone: 'good',
                  },
                  {
                    label: 'Open POs',
                    value: openPos,
                    sub: `${trade?.onchainPos ?? srm?.onchainPos ?? 0} on-chain escrow`,
                    href: '/dashboard/suppliers/po',
                    tone: openPos > 0 ? 'warn' : 'default',
                  },
                  {
                    label: 'Avg OTIFEF',
                    value: `${Number(srm?.avgOtifef ?? kpis?.srmAvgOtifef ?? 0).toFixed(0)}%`,
                    sub: `Trust ${Number(srm?.avgTrust ?? kpis?.srmAvgTrust ?? 0).toFixed(0)}`,
                    href: '/dashboard/suppliers/performance',
                    tone:
                      Number(srm?.avgOtifef ?? 0) >= 90
                        ? 'good'
                        : Number(srm?.avgOtifef ?? 0) >= 70
                          ? 'warn'
                          : 'default',
                  },
                  {
                    label: 'Invites pending',
                    value: srm?.invitePending ?? 0,
                    sub: 'Supplier onboarding',
                    href: '/dashboard/suppliers/invites',
                  },
                  {
                    label: 'SRM RIAD open',
                    value: srm?.riadOpen ?? kpis?.srmRiadOpen ?? 0,
                    sub: 'Supplier issues',
                    href: '/dashboard/suppliers/riad-log',
                    tone: (srm?.riadOpen ?? 0) > 0 ? 'warn' : 'good',
                  },
                  {
                    label: 'PO spend trend',
                    value:
                      intel?.poGrowth != null
                        ? `${intel.poGrowth > 0 ? '+' : ''}${intel.poGrowth}%`
                        : '—',
                    sub: '30d vs prior (intelligence)',
                    href: '/dashboard/intelligence/predictive-forecasts',
                    tone:
                      (intel?.poGrowth ?? 0) > 15
                        ? 'warn'
                        : (intel?.poGrowth ?? 0) < 0
                          ? 'good'
                          : 'default',
                  },
                  {
                    label: 'Discover network',
                    value: '→',
                    sub: 'Find verified partners',
                    href: '/dashboard/suppliers/discover',
                  },
                ]}
              />
              <SectionLinks
                links={[
                  { href: '/dashboard/suppliers/discover', label: 'Discover' },
                  { href: '/dashboard/suppliers/po', label: 'Purchase orders' },
                  { href: '/dashboard/suppliers/performance', label: 'Performance' },
                  { href: '/dashboard/suppliers/contracts', label: 'Contracts' },
                  { href: '/dashboard/procurement', label: 'Procurement' },
                ]}
              />
            </ExpandableSection>

            <ExpandableSection
              id="operations"
              open={!!openSections.operations}
              onToggle={() => toggle('operations')}
              icon={Factory}
              code="OPS"
              title="Operations"
              summary={`${inMotion} in motion · ${ops?.exceptions ?? 0} exceptions`}
              badge={
                (ops?.exceptions ?? 0) > 0
                  ? { label: `${ops?.exceptions} exceptions`, tone: 'bad' }
                  : { label: 'Tower green', tone: 'good' }
              }
              href="/dashboard/operations"
              accent="from-cyan-50 to-white border-cyan-100"
            >
              <MetricGrid
                metrics={[
                  {
                    label: 'Work orders live',
                    value: ops?.workOrdersInFlight ?? 0,
                    sub: 'Manufacturing in flight',
                    href: '/dashboard/operations/production',
                  },
                  {
                    label: 'Shipments in motion',
                    value: ops?.shipmentsInMotion ?? 0,
                    sub: `${ops?.inboundInMotion ?? 0} in · ${ops?.outboundInMotion ?? 0} out`,
                    href: '/dashboard/distribution/tracking',
                  },
                  {
                    label: 'Exceptions',
                    value: ops?.exceptions ?? 0,
                    sub: 'Holds & breaks',
                    href: '/dashboard/operations/exceptions',
                    tone: (ops?.exceptions ?? 0) > 0 ? 'bad' : 'good',
                  },
                  {
                    label: 'Units on hand',
                    value:
                      ops?.unitsOnHand != null
                        ? Math.round(ops.unitsOnHand).toLocaleString()
                        : '—',
                    sub: `${ops?.warehouses ?? inventory?.warehouses ?? 0} warehouses`,
                    href: '/dashboard/inventory/stock',
                  },
                  {
                    label: 'Supplier POs open',
                    value: ops?.supplierPosOpen ?? openPos,
                    sub: 'Inbound demand',
                    href: '/dashboard/operations/supplier-orders',
                  },
                  {
                    label: 'Customer POs open',
                    value: ops?.customerPosOpen ?? 0,
                    sub: 'Outbound demand',
                    href: '/dashboard/operations/customer-orders',
                  },
                  {
                    label: 'Transfers live',
                    value: ops?.transfersLive ?? 0,
                    sub: 'Inter-site moves',
                    href: '/dashboard/inventory/stock-transfers',
                  },
                  {
                    label: 'Throughput score',
                    value: ops?.throughput != null ? `${ops.throughput}` : '—',
                    sub: 'Control-tower proxy 0–100',
                    href: '/dashboard/operations',
                    tone:
                      (ops?.throughput ?? 0) >= 60
                        ? 'good'
                        : (ops?.throughput ?? 0) >= 30
                          ? 'warn'
                          : 'default',
                  },
                ]}
              />
              <SectionLinks
                links={[
                  { href: '/dashboard/operations', label: 'Ops tower' },
                  { href: '/dashboard/operations/inbound', label: 'Inbound' },
                  { href: '/dashboard/operations/outbound', label: 'Outbound' },
                  { href: '/dashboard/distribution', label: 'Distribution' },
                  { href: '/dashboard/containers', label: 'Containers' },
                ]}
              />
            </ExpandableSection>

            <ExpandableSection
              id="manufacturing"
              open={!!openSections.manufacturing}
              onToggle={() => toggle('manufacturing')}
              icon={Boxes}
              code="MFG"
              title="Manufacturing"
              summary={`OEE ${mfg?.oee != null ? `${mfg.oee}%` : '—'} · ${mfg?.ordersInProgress ?? 0} in progress`}
              badge={
                (mfg?.ordersHold ?? 0) > 0
                  ? { label: `${mfg?.ordersHold} on hold`, tone: 'warn' }
                  : mfg?.oee != null
                    ? { label: `OEE ${mfg.oee}%`, tone: mfg.oee >= 70 ? 'good' : 'warn' }
                    : undefined
              }
              href="/dashboard/manufacturing"
              accent="from-amber-50 to-white border-amber-100"
            >
              <MetricGrid
                metrics={[
                  {
                    label: 'OEE proxy',
                    value: mfg?.oee != null ? `${mfg.oee}%` : '—',
                    sub: 'Availability × performance × quality',
                    href: '/dashboard/manufacturing',
                    tone: (mfg?.oee ?? 0) >= 70 ? 'good' : 'warn',
                  },
                  {
                    label: 'Yield',
                    value: mfg?.yieldPct != null ? `${mfg.yieldPct}%` : '—',
                    sub: 'Completed vs scrapped',
                    href: '/dashboard/manufacturing/production-orders',
                    tone: (mfg?.yieldPct ?? 100) >= 95 ? 'good' : 'warn',
                  },
                  {
                    label: 'Completion',
                    value: mfg?.completionPct != null ? `${mfg.completionPct}%` : '—',
                    sub: 'Qty completed / planned',
                    href: '/dashboard/manufacturing/production-orders',
                  },
                  {
                    label: 'Orders in progress',
                    value: mfg?.ordersInProgress ?? ops?.workOrdersInFlight ?? 0,
                    sub: `${mfg?.ordersReleased ?? 0} released · ${mfg?.ordersHold ?? 0} hold`,
                    href: '/dashboard/manufacturing/production-orders',
                  },
                  {
                    label: 'BOMs active',
                    value: mfg?.bomsActive ?? ops?.bomsActive ?? 0,
                    sub: `${mfg?.boms ?? 0} total`,
                    href: '/dashboard/manufacturing/bills-of-materials',
                  },
                  {
                    label: 'Work centers',
                    value: mfg?.workCentersActive ?? ops?.workCells ?? 0,
                    sub: `${mfg?.workCenters ?? 0} total cells`,
                    href: '/dashboard/manufacturing/work-centers',
                  },
                  {
                    label: 'MPS plans',
                    value: mfg?.mpsPlans ?? 0,
                    sub: 'Master production schedules',
                    href: '/dashboard/manufacturing/master-production-schedules',
                  },
                  {
                    label: 'Orders complete',
                    value: mfg?.ordersComplete ?? 0,
                    sub: `${mfg?.orders ?? 0} total orders`,
                    href: '/dashboard/manufacturing/production-orders',
                    tone: 'good',
                  },
                ]}
              />
              <SectionLinks
                links={[
                  { href: '/dashboard/manufacturing', label: 'MFG hub' },
                  { href: '/dashboard/manufacturing/mrp', label: 'MRP' },
                  { href: '/dashboard/manufacturing/bills-of-materials', label: 'BOMs' },
                  { href: '/dashboard/manufacturing/production-orders', label: 'Production orders' },
                ]}
              />
            </ExpandableSection>

            <ExpandableSection
              id="quality"
              open={!!openSections.quality}
              onToggle={() => toggle('quality')}
              icon={ClipboardCheck}
              code="QMS"
              title="Quality"
              summary={`${ops?.qualityOpen ?? 0} open inspections · yield ${mfg?.yieldPct != null ? `${mfg.yieldPct}%` : '—'}`}
              badge={
                (ops?.qualityOpen ?? 0) > 0
                  ? { label: `${ops?.qualityOpen} open QI`, tone: 'warn' }
                  : { label: 'Stable', tone: 'good' }
              }
              href="/dashboard/quality"
              accent="from-emerald-50 to-white border-emerald-100"
            >
              <MetricGrid
                metrics={[
                  {
                    label: 'Open inspections',
                    value: ops?.qualityOpen ?? 0,
                    sub: 'Quality queue',
                    href: '/dashboard/quality/inspections',
                    tone: (ops?.qualityOpen ?? 0) > 0 ? 'warn' : 'good',
                  },
                  {
                    label: 'MFG yield / quality',
                    value: mfg?.yieldPct != null ? `${mfg.yieldPct}%` : '—',
                    sub: 'From production scrap vs complete',
                    href: '/dashboard/manufacturing',
                    tone: (mfg?.yieldPct ?? 100) >= 95 ? 'good' : 'warn',
                  },
                  {
                    label: 'Low stock risk',
                    value: lowStock,
                    sub: 'Can starve fulfillment quality',
                    href: '/dashboard/inventory/stock',
                    tone: lowStock > 0 ? 'warn' : 'good',
                  },
                  {
                    label: 'Open risks (RIAD)',
                    value: kpis?.openRisks ?? 0,
                    sub: `${kpis?.highRisks ?? 0} high`,
                    href: '/dashboard/my-business/riad-log',
                    tone: (kpis?.highRisks ?? 0) > 0 ? 'bad' : 'default',
                  },
                ]}
              />
              <SectionLinks
                links={[
                  { href: '/dashboard/quality', label: 'Quality hub' },
                  { href: '/dashboard/quality/inspections', label: 'Inspections' },
                  { href: '/dashboard/quality/haccp', label: 'HACCP' },
                  { href: '/dashboard/quality/traceability', label: 'Traceability' },
                  { href: '/dashboard/quality/regulatory-reports', label: 'Regulatory' },
                ]}
              />
            </ExpandableSection>

            <ExpandableSection
              id="intelligence"
              open={!!openSections.intelligence}
              onToggle={() => toggle('intelligence')}
              icon={Brain}
              code="BI"
              title="Intelligence"
              summary={
                intel?.overallHealth != null
                  ? `Health ${Math.round(intel.overallHealth)} · supply ${Math.round(intel.supplyScore ?? 0)} · demand ${Math.round(intel.demandScore ?? 0)}`
                  : 'Pulse & forecasts'
              }
              badge={
                intel?.overallHealth != null
                  ? {
                      label: `Health ${Math.round(intel.overallHealth)}`,
                      tone: intel.overallHealth >= 70 ? 'good' : 'warn',
                    }
                  : undefined
              }
              href="/dashboard/intelligence"
              accent="from-sky-50 to-white border-sky-100"
            >
              <MetricGrid
                metrics={[
                  {
                    label: 'Overall health',
                    value:
                      intel?.overallHealth != null
                        ? Math.round(intel.overallHealth)
                        : '—',
                    sub: 'Composite 0–100',
                    href: '/dashboard/intelligence/pulse-dashboard',
                    tone:
                      (intel?.overallHealth ?? 0) >= 70
                        ? 'good'
                        : (intel?.overallHealth ?? 0) >= 45
                          ? 'warn'
                          : 'default',
                  },
                  {
                    label: 'Network score',
                    value: intel?.networkScore != null ? Math.round(intel.networkScore) : '—',
                    sub: 'Connections & pricing',
                    href: '/dashboard/connections',
                  },
                  {
                    label: 'Supply score',
                    value: intel?.supplyScore != null ? Math.round(intel.supplyScore) : '—',
                    sub: 'OTIFEF + trust weighted',
                    href: '/dashboard/suppliers/performance',
                  },
                  {
                    label: 'Demand score',
                    value: intel?.demandScore != null ? Math.round(intel.demandScore) : '—',
                    sub: 'Customers & pipeline',
                    href: '/dashboard/customers',
                  },
                  {
                    label: 'Finance score',
                    value: intel?.financeScore != null ? Math.round(intel.financeScore) : '—',
                    sub: 'AR/AP pressure',
                    href: '/dashboard/accounting',
                  },
                  {
                    label: 'Ops score',
                    value: intel?.opsScore != null ? Math.round(intel.opsScore) : '—',
                    sub: 'Stock & catalogue readiness',
                    href: '/dashboard/operations',
                  },
                  {
                    label: 'PO growth 30d',
                    value:
                      intel?.poGrowth != null
                        ? `${intel.poGrowth > 0 ? '+' : ''}${intel.poGrowth}%`
                        : '—',
                    sub: 'Procurement trend',
                    href: '/dashboard/intelligence/predictive-forecasts',
                  },
                  {
                    label: 'Sales growth 30d',
                    value:
                      intel?.salesGrowth != null
                        ? `${intel.salesGrowth > 0 ? '+' : ''}${intel.salesGrowth}%`
                        : '—',
                    sub: 'Demand trend',
                    href: '/dashboard/intelligence/predictive-forecasts',
                    tone: (intel?.salesGrowth ?? 0) >= 0 ? 'good' : 'warn',
                  },
                ]}
              />
              <SectionLinks
                links={[
                  { href: '/dashboard/intelligence', label: 'BI hub' },
                  { href: '/dashboard/intelligence/pulse-dashboard', label: 'Pulse' },
                  { href: '/dashboard/intelligence/predictive-forecasts', label: 'Forecasts' },
                  { href: '/dashboard/intelligence/neural-insights', label: 'Insights' },
                  {
                    href: '/dashboard/intelligence/leadership-development',
                    label: 'Super-Cube®',
                  },
                ]}
              />
            </ExpandableSection>

            <ExpandableSection
              id="inventory"
              open={!!openSections.inventory}
              onToggle={() => toggle('inventory')}
              icon={Package}
              code="INV"
              title="Inventory"
              summary={`${inventory?.products ?? kpis?.products ?? 0} SKUs · ${lowStock} low stock`}
              badge={
                lowStock > 0
                  ? { label: `${lowStock} low`, tone: 'warn' }
                  : { label: 'Stock OK', tone: 'good' }
              }
              href="/dashboard/inventory"
              accent="from-emerald-50 to-white border-emerald-100"
            >
              <MetricGrid
                metrics={[
                  {
                    label: 'Products / SKUs',
                    value: inventory?.products ?? kpis?.products ?? 0,
                    sub: 'Master catalogue',
                    href: '/dashboard/inventory/products',
                  },
                  {
                    label: 'Warehouses',
                    value: inventory?.warehouses ?? 0,
                    sub: 'Locations',
                    href: '/dashboard/inventory/warehouses',
                  },
                  {
                    label: 'Low stock',
                    value: lowStock,
                    sub: 'At or below reorder',
                    href: '/dashboard/inventory/stock',
                    tone: lowStock > 0 ? 'warn' : 'good',
                  },
                  {
                    label: 'Units on hand',
                    value:
                      ops?.unitsOnHand != null
                        ? Math.round(ops.unitsOnHand).toLocaleString()
                        : '—',
                    sub: 'Across stock records',
                    href: '/dashboard/inventory/stock',
                  },
                  {
                    label: 'Containers active',
                    value: kpis?.containersActive ?? 0,
                    sub: `${kpis?.containersTotal ?? 0} total outlets`,
                    href: '/dashboard/containers',
                  },
                  {
                    label: 'Multi-currency SKUs',
                    value: inventory?.multiCurrencyProducts ?? 0,
                    sub: 'Global pricing ready',
                    href: '/dashboard/inventory/products',
                  },
                ]}
              />
              <SectionLinks
                links={[
                  { href: '/dashboard/inventory/stock', label: 'Stock' },
                  { href: '/dashboard/inventory/products', label: 'Products' },
                  { href: '/dashboard/inventory/stock-transfers', label: 'Transfers' },
                  { href: '/dashboard/inventory/counts', label: 'Counts' },
                ]}
              />
            </ExpandableSection>
          </div>

          <HubModuleGrid modules={modules} />

          <div className="flex flex-wrap gap-2 mb-8">
            {[
              { href: '/dashboard/suppliers/discover', icon: Search, label: 'Discover' },
              { href: '/dashboard/connections/pricing', icon: Tag, label: 'Pricing' },
              { href: '/dashboard/operations', icon: Factory, label: 'Operations' },
              { href: '/dashboard/inventory/stock', icon: Package, label: 'Stock' },
              { href: '/dashboard/distribution/tracking', icon: Ship, label: 'Tracking' },
              { href: '/dashboard/accounting/reports', icon: Percent, label: 'Forecasts' },
              { href: '/dashboard/intelligence', icon: Brain, label: 'Intelligence' },
            ].map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:border-[#00b4d8] hover:text-[#0077b6] transition-colors"
              >
                <q.icon className="w-3.5 h-3.5 text-[#00b4d8]" />
                {q.label}
              </Link>
            ))}
          </div>

          <HubPrinciples
            items={[
              {
                title: 'Expand what matters',
                body: 'Dashboard keeps a thin top line; each domain board opens into KPIs and deep links so operators jump without hunting menus.',
              },
              {
                title: 'Exceptions surface first',
                body: 'Connection requests, low stock, open RIAD, unreconciled bank lines, and ops holds appear before vanity metrics.',
              },
              {
                title: 'Trade is company-scoped',
                body: 'Every number is membership-checked against your selected company — multi-entity safe by design.',
              },
            ]}
          />
        </>
      )}
    </RelationshipPage>
  );
}

/* ─── Expandable section chrome ─── */

function ExpandableSection({
  id,
  open,
  onToggle,
  icon: Icon,
  code,
  title,
  summary,
  badge,
  href,
  accent,
  children,
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
  icon: LucideIcon;
  code: string;
  title: string;
  summary: string;
  badge?: { label: string; tone: 'good' | 'warn' | 'bad' };
  href: string;
  accent: string;
  children: ReactNode;
}) {
  const badgeCls =
    badge?.tone === 'good'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : badge?.tone === 'bad'
        ? 'bg-rose-50 text-rose-700 border-rose-100'
        : 'bg-amber-50 text-amber-800 border-amber-100';

  return (
    <section
      className={`rounded-3xl border bg-gradient-to-br ${accent} shadow-sm overflow-hidden transition-shadow ${
        open ? 'shadow-md ring-1 ring-[#00b4d8]/15' : ''
      }`}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`dash-section-${id}`}
          className="flex-1 min-w-0 flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 text-left hover:bg-white/40 transition-colors"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white shadow-sm text-[#0077b6]">
            <Icon className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
                {code}
              </span>
              {badge && (
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeCls}`}
                >
                  {badge.label}
                </span>
              )}
            </div>
            <div className="text-base sm:text-lg font-black tracking-tight text-slate-900">
              {title}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5 truncate">{summary}</div>
          </div>
          <ChevronDown
            className={`w-5 h-5 shrink-0 text-neutral-400 transition-transform duration-200 ${
              open ? 'rotate-180 text-[#00b4d8]' : ''
            }`}
          />
        </button>
        <Link
          href={href}
          className="hidden sm:flex items-center gap-1.5 px-4 border-l border-black/5 text-xs font-semibold text-[#0077b6] hover:bg-white/50 transition-colors"
          title={`Open ${title}`}
        >
          Open <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {open && (
        <div
          id={`dash-section-${id}`}
          className="border-t border-black/5 bg-white/70 backdrop-blur-sm px-4 sm:px-5 py-5"
        >
          {children}
          <div className="mt-4 sm:hidden">
            <Link
              href={href}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0077b6]"
            >
              Open full module <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
      {metrics.map((m) => {
        const inner = (
          <>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
              {m.label}
            </div>
            <div className={`text-lg sm:text-xl font-black tabular-nums tracking-tight ${toneClass(m.tone)}`}>
              {m.value}
            </div>
            {m.sub && (
              <div className="text-[11px] text-neutral-500 mt-0.5 line-clamp-2">{m.sub}</div>
            )}
          </>
        );
        const cls =
          'rounded-2xl border border-neutral-200/90 bg-white p-3 sm:p-3.5 shadow-sm transition-colors';
        if (m.href) {
          return (
            <Link key={m.label} href={m.href} className={`${cls} hover:border-[#00b4d8]/50 hover:bg-sky-50/30`}>
              {inner}
            </Link>
          );
        }
        return (
          <div key={m.label} className={cls}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

function SectionLinks({ links }: { links: Array<{ href: string; label: string }> }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-[#00b4d8] hover:text-[#0077b6] transition-colors"
        >
          {l.label}
          <ArrowRight className="w-3 h-3 opacity-50" />
        </Link>
      ))}
    </div>
  );
}
