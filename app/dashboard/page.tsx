'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Truck,
  Package,
  AlertTriangle,
  ArrowRight,
  Network,
  FileText,
  RefreshCw,
  Container,
  TrendingUp,
  ShoppingCart,
  Loader2,
  Wallet,
  CreditCard,
  Search,
  Tag,
  Boxes,
  Handshake,
  Factory,
  Ship,
  type LucideIcon,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  AlertBanner,
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import FxRateStrip from '@/components/fx/FxRateStrip';

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
  invoicesOpen?: number;
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

type SnapCard = {
  label: string;
  value: string | number;
  sub?: string;
  href: string;
  icon: LucideIcon;
  tone?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate' | 'violet';
};

const TONE: Record<
  NonNullable<SnapCard['tone']>,
  { ring: string; icon: string; glow: string }
> = {
  cyan: {
    ring: 'border-cyan-100 hover:border-[#00b4d8]',
    icon: 'bg-cyan-50 text-[#0077b6]',
    glow: 'from-cyan-50/80 to-white',
  },
  emerald: {
    ring: 'border-emerald-100 hover:border-emerald-400',
    icon: 'bg-emerald-50 text-emerald-700',
    glow: 'from-emerald-50/80 to-white',
  },
  amber: {
    ring: 'border-amber-100 hover:border-amber-400',
    icon: 'bg-amber-50 text-amber-800',
    glow: 'from-amber-50/80 to-white',
  },
  rose: {
    ring: 'border-rose-100 hover:border-rose-300',
    icon: 'bg-rose-50 text-rose-700',
    glow: 'from-rose-50/80 to-white',
  },
  slate: {
    ring: 'border-slate-200 hover:border-slate-400',
    icon: 'bg-slate-100 text-slate-700',
    glow: 'from-slate-50 to-white',
  },
  violet: {
    ring: 'border-violet-100 hover:border-violet-400',
    icon: 'bg-violet-50 text-violet-700',
    glow: 'from-violet-50/80 to-white',
  },
};

export default function DashboardCommandCenter() {
  const companyId = getSelectedCompanyId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [crm, setCrm] = useState<{
    customers: number;
    pipelineValue: number;
    opportunitiesOpen: number;
    leadsOpen: number;
    riadOpen: number;
  } | null>(null);
  const [srm, setSrm] = useState<{
    book: number;
    openPos: number;
    onchainPos: number;
    avgOtifef: number;
    avgTrust: number;
    verified: number;
    riadOpen: number;
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

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [dashRes, opsRes] = await Promise.all([
        fetch('/api/dashboard/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId }),
        }),
        fetch(`/api/operations/summary?companyId=${companyId}`).catch(() => null),
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

      if (opsRes && opsRes.ok) {
        const o = await opsRes.json();
        setOps(o.summary || null);
      } else {
        setOps(null);
      }
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

  const cards: SnapCard[] = useMemo(() => {
    const networkAccepted = network?.accepted ?? kpis?.networkAccepted ?? 0;
    return [
      {
        label: 'Network',
        value: networkAccepted,
        sub:
          pendingIn > 0
            ? `${pendingIn} request${pendingIn === 1 ? '' : 's'} waiting`
            : `${network?.pendingOut ?? kpis?.networkPendingOut ?? 0} sent`,
        href: '/dashboard/connections',
        icon: Network,
        tone: pendingIn > 0 ? 'amber' : 'emerald',
      },
      {
        label: 'Supplier book',
        value: srm?.book ?? kpis?.srmBookTotal ?? 0,
        sub: `${srm?.verified ?? kpis?.srmVerified ?? 0} verified`,
        href: '/dashboard/suppliers',
        icon: Truck,
        tone: 'violet',
      },
      {
        label: 'Open POs',
        value: openPos,
        sub: `${trade?.onchainPos ?? srm?.onchainPos ?? 0} on-chain`,
        href: '/dashboard/suppliers/po',
        icon: ShoppingCart,
        tone: openPos > 0 ? 'cyan' : 'slate',
      },
      {
        label: 'Customers',
        value: crm?.customers ?? kpis?.customersTotal ?? 0,
        sub: `${crm?.leadsOpen ?? kpis?.leadsOpen ?? 0} open leads`,
        href: '/dashboard/customers',
        icon: Users,
        tone: 'cyan',
      },
      {
        label: 'Pipeline',
        value: money(crm?.pipelineValue ?? kpis?.pipelineValue ?? 0, baseCcy),
        sub: `${crm?.opportunitiesOpen ?? kpis?.opportunitiesOpen ?? 0} deals`,
        href: '/dashboard/customers/leads',
        icon: TrendingUp,
        tone: 'emerald',
      },
      {
        label: 'Open quotes',
        value: trade?.quotesOpen ?? kpis?.quotesOpen ?? 0,
        sub: money(trade?.quotesValue ?? kpis?.quotesValue ?? 0, baseCcy),
        href: '/dashboard/customers/quotes',
        icon: FileText,
        tone: 'slate',
      },
      {
        label: 'AR open',
        value: money(trade?.arOpenValue ?? kpis?.arOpenValue ?? 0, baseCcy),
        sub: `${trade?.arOpen ?? kpis?.arOpen ?? 0} invoices`,
        href: '/dashboard/accounting/accounts-receivable',
        icon: Wallet,
        tone: 'emerald',
      },
      {
        label: 'AP open',
        value: money(trade?.apOpenValue ?? kpis?.apOpenValue ?? 0, baseCcy),
        sub: `${trade?.apOpen ?? kpis?.apOpen ?? 0} bills`,
        href: '/dashboard/accounting/accounts-payable',
        icon: CreditCard,
        tone: 'amber',
      },
      {
        label: 'Products',
        value: inventory?.products ?? kpis?.products ?? 0,
        sub:
          lowStock > 0
            ? `${lowStock} low stock`
            : `${inventory?.warehouses ?? 0} locations`,
        href: '/dashboard/inventory',
        icon: Package,
        tone: lowStock > 0 ? 'amber' : 'cyan',
      },
      {
        label: 'Units on hand',
        value:
          ops?.unitsOnHand != null
            ? Math.round(ops.unitsOnHand).toLocaleString()
            : '—',
        sub: 'Live inventory',
        href: '/dashboard/inventory/stock',
        icon: Boxes,
        tone: 'slate',
      },
      {
        label: 'OTIFEF',
        value: `${Number(srm?.avgOtifef ?? kpis?.srmAvgOtifef ?? 0).toFixed(0)}%`,
        sub: `Trust ${Number(srm?.avgTrust ?? kpis?.srmAvgTrust ?? 0).toFixed(0)}`,
        href: '/dashboard/suppliers/performance',
        icon: Handshake,
        tone: 'emerald',
      },
      {
        label: 'In motion',
        value:
          (ops?.workOrdersInFlight ?? 0) + (ops?.shipmentsInMotion ?? 0),
        sub: `${ops?.workOrdersInFlight ?? 0} WO · ${ops?.shipmentsInMotion ?? 0} ship`,
        href: '/dashboard/operations',
        icon: Factory,
        tone: 'violet',
      },
      {
        label: 'Containers',
        value: kpis?.containersActive ?? 0,
        sub: `${kpis?.containersTotal ?? 0} total`,
        href: '/dashboard/containers',
        icon: Container,
        tone: 'cyan',
      },
      {
        label: 'Team',
        value: business?.teamActive ?? kpis?.teamActive ?? 0,
        sub:
          (business?.teamInvited ?? kpis?.teamInvited ?? 0) > 0
            ? `${business?.teamInvited ?? kpis?.teamInvited} invited`
            : 'Active members',
        href: '/dashboard/my-business/team',
        tone: (business?.teamInvited ?? kpis?.teamInvited ?? 0) > 0 ? 'amber' : 'slate',
        icon: Users,
      },
      {
        label: 'Attention',
        value: attention,
        sub:
          attention === 0
            ? 'All clear'
            : `${alerts.filter((a) => a.severity === 'critical').length} critical`,
        href:
          attention > 0 && alerts[0]
            ? alerts[0].href
            : '/dashboard/operations/exceptions',
        icon: AlertTriangle,
        tone: attention > 0 ? 'rose' : 'emerald',
      },
      {
        label: 'Shipments live',
        value: ops?.shipmentsInMotion ?? 0,
        sub: 'Distribution in transit',
        href: '/dashboard/distribution/tracking',
        icon: Ship,
        tone: (ops?.shipmentsInMotion ?? 0) > 0 ? 'cyan' : 'slate',
      },
    ];
  }, [
    network,
    kpis,
    srm,
    trade,
    crm,
    inventory,
    ops,
    business,
    pendingIn,
    openPos,
    lowStock,
    attention,
    alerts,
    baseCcy,
  ]);

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
            ? `${place}${company?.industry ? ` · ${company.industry}` : ''} — live snapshot across network, trade, money, and operations.`
            : 'Live snapshot across network, trade, money, and operations.'
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

      {pendingIn > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-amber-900">
            <strong>{pendingIn}</strong> incoming connection
            {pendingIn === 1 ? '' : 's'} waiting — accept to unlock trade.
          </div>
          <Link href="/dashboard/connections" className="btn-primary !py-2 !px-4 text-xs">
            Review network
          </Link>
        </div>
      )}

      {loading && !kpis ? (
        <div className="py-24 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400 mb-3">
            Business snapshot
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mb-8">
            {cards.map((c) => {
              const Icon = c.icon;
              const tone = TONE[c.tone || 'cyan'];
              return (
                <Link
                  key={c.label}
                  href={c.href}
                  className={`group relative overflow-hidden rounded-3xl border bg-gradient-to-br ${tone.glow} ${tone.ring} p-4 sm:p-5 shadow-sm hover:shadow-md transition-all`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center ${tone.icon}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-300 opacity-0 group-hover:opacity-100 group-hover:text-[#00b4d8] transition-all" />
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400 mb-1">
                    {c.label}
                  </div>
                  <div className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 tabular-nums leading-none">
                    {c.value}
                  </div>
                  {c.sub && (
                    <div className="text-[11px] text-neutral-500 mt-2 font-medium leading-snug">
                      {c.sub}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Attention only when needed */}
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
                      <ArrowRight className="w-4 h-4 text-neutral-300 shrink-0 self-center" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Minimal jump links */}
          <div className="flex flex-wrap gap-2">
            {[
              { href: '/dashboard/suppliers/discover', icon: Search, label: 'Discover' },
              { href: '/dashboard/connections/pricing', icon: Tag, label: 'Pricing' },
              { href: '/dashboard/operations', icon: Factory, label: 'Operations' },
              { href: '/dashboard/inventory/stock', icon: Package, label: 'Stock' },
              { href: '/dashboard/distribution/tracking', icon: Ship, label: 'Tracking' },
              { href: '/dashboard/intelligence', icon: TrendingUp, label: 'Intelligence' },
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
        </>
      )}
    </RelationshipPage>
  );
}
