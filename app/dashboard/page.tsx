'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Truck,
  Package,
  AlertTriangle,
  ArrowRight,
  Plus,
  Target,
  ShieldCheck,
  Network,
  FileText,
  RefreshCw,
  Building2,
  Container,
  UserCheck,
  Boxes,
  Handshake,
  Star,
  TrendingUp,
  ShoppingCart,
  Settings,
  Loader2,
  Wallet,
  CreditCard,
  Search,
  Globe2,
  Tag,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  AlertBanner,
  KpiCard,
  MetricHero,
  ModuleGrid,
  OperatingPrinciples,
  Panel,
  ProcessLifecycle,
  ProcessRail,
  RelationshipHeader,
  RelationshipPage,
  SectionLabel,
  type ModuleCard,
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
  wallet_address?: string | null;
};

type Kpis = {
  teamActive: number;
  teamInvited: number;
  teamTotal: number;
  networkAccepted: number;
  networkPending: number;
  networkPendingIn?: number;
  networkPendingOut?: number;
  suppliersActive: number;
  suppliersTotal: number;
  openRisks: number;
  highRisks: number;
  products: number;
  documents: number;
  containersActive?: number;
  containersTotal?: number;
  contractorsVerified?: number;
  contractorsTotal?: number;
  warehouseLowStock?: number;
  containerLowStock?: number;
  salesToday?: number;
  customersTotal?: number;
  customersActive?: number;
  leadsOpen?: number;
  pipelineValue?: number;
  opportunitiesOpen?: number;
  crmInvitePending?: number;
  crmInviteAccepted?: number;
  crmRiadOpen?: number;
  srmBookTotal?: number;
  srmConnected?: number;
  srmInvitePending?: number;
  srmVerified?: number;
  srmAvgTrust?: number;
  srmAvgOtifef?: number;
  srmOpenPos?: number;
  srmOnchainPos?: number;
  srmRiadOpen?: number;
  profileCompleteness?: number;
  pricingAgreements?: number;
  pricingActive?: number;
  pricingSelling?: number;
  pricingBuying?: number;
  quotesOpen?: number;
  quotesValue?: number;
  invoicesOpen?: number;
  invoicesOpenValue?: number;
  multiCurrencyProducts?: number;
  catalogueCurrencies?: string[];
  arOpen?: number;
  arOpenValue?: number;
  apOpen?: number;
  apOpenValue?: number;
  marketplaceListings?: number;
};

type CrmSnap = {
  customers: number;
  customersActive: number;
  leadsOpen: number;
  pipelineValue: number;
  opportunitiesOpen: number;
  invitePending: number;
  inviteAccepted: number;
  riadOpen: number;
  href: string;
};

type SrmSnap = {
  book: number;
  connected: number;
  invitePending: number;
  verified: number;
  avgTrust: number;
  avgOtifef: number;
  openPos: number;
  onchainPos: number;
  riadOpen: number;
  href: string;
};

type NetworkSnap = {
  accepted: number;
  pending: number;
  pendingIn: number;
  pendingOut: number;
  pricingActive: number;
  pricingTotal: number;
  marketplaceListings: number;
  href: string;
};

type TradeSnap = {
  quotesOpen: number;
  quotesValue: number;
  invoicesOpen: number;
  invoicesOpenValue: number;
  openPos: number;
  onchainPos: number;
  arOpen: number;
  arOpenValue: number;
  apOpen: number;
  apOpenValue: number;
};

type InventorySnap = {
  products: number;
  multiCurrencyProducts: number;
  currencies: string[];
  warehouseLowStock: number;
  warehouses: number;
  href: string;
};

type BusinessSnap = {
  profileCompleteness: number;
  teamActive: number;
  teamInvited: number;
  verified: boolean;
  href: string;
};

type Activity = {
  id: string;
  title: string;
  subtitle: string;
  at: string | null;
  type: string;
};

type AlertItem = {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  href: string;
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatRelative(iso: string | null) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function money(n: number, currency = 'ZAR') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.length === 3 ? currency : 'ZAR',
      maximumFractionDigits: 0,
    }).format(Number(n || 0));
  } catch {
    return `${currency} ${Number(n || 0).toLocaleString()}`;
  }
}

const PLATFORM_MODULES: ModuleCard[] = [
  {
    href: '/dashboard/connections',
    icon: Network,
    title: 'Network',
    desc: 'Connect companies · pricing · marketplace · trade graph',
    badge: 'Core',
  },
  {
    href: '/dashboard/suppliers',
    icon: Truck,
    title: 'Suppliers SRM',
    desc: 'Discover · PO · escrow · OTIFEF · ratings',
    badge: 'Trust',
  },
  {
    href: '/dashboard/customers',
    icon: Users,
    title: 'Customers CRM',
    desc: 'Lead → quote → order → invoice · multi-currency',
    badge: 'Grow',
  },
  {
    href: '/dashboard/inventory',
    icon: Boxes,
    title: 'Inventory',
    desc: 'Multi-currency catalogue, warehouses, stock',
  },
  {
    href: '/dashboard/accounting',
    icon: Wallet,
    title: 'Accounting',
    desc: 'AR/AP, bank, journals, management accounts',
  },
  {
    href: '/dashboard/containers',
    icon: Container,
    title: 'Containers',
    desc: 'Outlets, contractors, sales, RIAD',
  },
];

export default function DashboardHome() {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [crm, setCrm] = useState<CrmSnap | null>(null);
  const [srm, setSrm] = useState<SrmSnap | null>(null);
  const [network, setNetwork] = useState<NetworkSnap | null>(null);
  const [trade, setTrade] = useState<TradeSnap | null>(null);
  const [inventory, setInventory] = useState<InventorySnap | null>(null);
  const [business, setBusiness] = useState<BusinessSnap | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    const companyId =
      getSelectedCompanyId() ||
      (typeof window !== 'undefined' ? localStorage.getItem('selectedCompanyId') : null);

    if (!companyId) {
      setCompany(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/dashboard/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: Number(companyId) }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load dashboard');
        setCompany(null);
        return;
      }

      setCompany(data.company);
      setKpis(data.kpis);
      setCrm(data.crm || null);
      setSrm(data.srm || null);
      setNetwork(data.network || null);
      setTrade(data.trade || null);
      setInventory(data.inventory || null);
      setBusiness(data.business || null);
      setActivity(data.activity || []);
      setAlerts(data.alerts || []);
      setGeneratedAt(data.generatedAt || null);

      if (data.company?.trading_name) {
        try {
          localStorage.setItem('selectedCompanyName', data.company.trading_name);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      console.error(e);
      setError('Network error loading live dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <RelationshipPage>
        <div className="py-28 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8] mb-4" />
          <p className="text-sm text-neutral-500">Loading live command center…</p>
        </div>
      </RelationshipPage>
    );
  }

  if (!company) {
    return (
      <RelationshipPage>
        <div className="max-w-md mx-auto text-center py-20">
          <div className="mx-auto mb-5 h-12 w-12 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-[#00b4d8]" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-800 mb-2">
            Select a company
          </h2>
          <p className="text-sm text-neutral-500 mb-6">
            {error || 'Choose a workspace to open your live operating system.'}
          </p>
          <Link href="/dashboard/select-company" className="btn-primary !py-3 !px-8 text-sm">
            Select company
          </Link>
        </div>
      </RelationshipPage>
    );
  }

  const pct = business?.profileCompleteness ?? kpis?.profileCompleteness ?? 0;
  const baseCcy = company.primary_currency || 'ZAR';
  const currencies =
    inventory?.currencies?.length
      ? inventory.currencies
      : kpis?.catalogueCurrencies?.length
        ? kpis.catalogueCurrencies
        : [baseCcy];

  const pendingIn = network?.pendingIn ?? kpis?.networkPendingIn ?? 0;
  const networkAccepted = network?.accepted ?? kpis?.networkAccepted ?? 0;
  const pricingActive = network?.pricingActive ?? kpis?.pricingActive ?? 0;

  return (
    <RelationshipPage>
      <RelationshipHeader
        eyebrow={`${greeting()} · Global command center`}
        title={company.trading_name}
        description={
          [
            company.industry,
            company.city,
            company.country,
            currencies.length > 1 ? `${currencies.length} catalogue currencies` : baseCcy,
          ]
            .filter(Boolean)
            .join(' · ') ||
          'Network · multi-currency trade · CRM · SRM · inventory · accounting'
        }
        action={
          <>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2.5 !px-4 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <Link href="/dashboard/select-company" className="btn-secondary !py-2.5 !px-4 text-sm">
              Switch
            </Link>
            <Link
              href="/dashboard/suppliers/discover"
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              <Search className="w-4 h-4" /> Find companies
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4 -mt-4">
        {company.verification_status === 'verified' ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5" /> Verified
          </span>
        ) : (
          <Link
            href="/dashboard/my-business/profile"
            className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-amber-100 text-amber-900 hover:bg-amber-200"
          >
            Get verified
          </Link>
        )}
        {company.wallet_address && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-sky-50 text-[#0077b6] border border-sky-100">
            <Wallet className="w-3 h-3" /> On-chain ready
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-600">
          <Globe2 className="w-3 h-3" /> {currencies.join(' · ')}
        </span>
        {generatedAt && (
          <span className="text-[11px] text-neutral-400">
            Live · {formatRelative(generatedAt) || 'just now'}
          </span>
        )}
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
            <strong>{pendingIn}</strong> incoming network connection
            {pendingIn === 1 ? '' : 's'} waiting — accept to unlock trade.
          </div>
          <Link href="/dashboard/connections" className="btn-primary !py-2 !px-4 text-xs">
            Review network
          </Link>
        </div>
      )}

      <ProcessLifecycle
        title="Trade lifecycle"
        intro="How value moves on SupplierAdvisor — from discovery through connection, commercial terms, order, invoice, and stock."
        steps={[
          {
            label: 'Discover',
            href: '/dashboard/suppliers/discover',
            desc: 'Find companies by trust and capability.',
          },
          {
            label: 'Connect',
            href: '/dashboard/connections',
            desc: 'Handshake unlocks trade tools.',
          },
          {
            label: 'Pricing',
            href: '/dashboard/connections/pricing',
            desc: 'Agreed prices between companies.',
          },
          {
            label: 'Quote',
            href: '/dashboard/customers/quotes',
            desc: 'Offer to customers with multi-currency.',
          },
          {
            label: 'PO',
            href: '/dashboard/suppliers/po',
            desc: 'Commit demand with optional escrow.',
          },
          {
            label: 'Invoice',
            href: '/dashboard/accounting/accounts-receivable',
            desc: 'Bill and collect on the same ledger.',
          },
          {
            label: 'Inventory',
            href: '/dashboard/inventory/products',
            desc: 'Stock master that fulfills the order.',
          },
        ]}
      />

      {/* Hero metrics */}
      <SectionLabel>Workspace pulse</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-8">
        <KpiCard
          icon={Network}
          label="Connected companies"
          value={networkAccepted}
          sub={`${pendingIn} in · ${network?.pendingOut ?? kpis?.networkPendingOut ?? 0} out`}
          href="/dashboard/connections"
          tone={pendingIn > 0 ? 'amber' : 'emerald'}
        />
        <KpiCard
          icon={Tag}
          label="Pricing agreements"
          value={pricingActive}
          sub={`${kpis?.pricingSelling ?? 0} sell · ${kpis?.pricingBuying ?? 0} buy`}
          href="/dashboard/connections/pricing"
          tone="cyan"
        />
        <KpiCard
          icon={FileText}
          label="Open quotes"
          value={trade?.quotesOpen ?? kpis?.quotesOpen ?? 0}
          sub={money(trade?.quotesValue ?? kpis?.quotesValue ?? 0, baseCcy)}
          href="/dashboard/customers/quotes"
        />
        <KpiCard
          icon={ShoppingCart}
          label="Open POs"
          value={trade?.openPos ?? srm?.openPos ?? kpis?.srmOpenPos ?? 0}
          sub={`${trade?.onchainPos ?? srm?.onchainPos ?? 0} on-chain`}
          href="/dashboard/suppliers/po"
          tone="emerald"
        />
        <KpiCard
          icon={Wallet}
          label="AR open"
          value={trade?.arOpen ?? kpis?.arOpen ?? 0}
          sub={money(trade?.arOpenValue ?? kpis?.arOpenValue ?? 0, baseCcy)}
          href="/dashboard/accounting/accounts-receivable"
          tone="cyan"
        />
        <KpiCard
          icon={CreditCard}
          label="AP open"
          value={trade?.apOpen ?? kpis?.apOpen ?? 0}
          sub={money(trade?.apOpenValue ?? kpis?.apOpenValue ?? 0, baseCcy)}
          href="/dashboard/accounting/accounts-payable"
        />
      </div>

      {/* Four pillars */}
      <SectionLabel>Systems</SectionLabel>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        <Pillar
          href="/dashboard/connections"
          icon={Network}
          badge="Network"
          title="Companies you connect"
          desc="Request · accept · pricing · marketplace"
        >
          <StatMini label="Connected" value={String(networkAccepted)} />
          <StatMini label="Incoming" value={String(pendingIn)} />
          <StatMini label="Pricing live" value={String(pricingActive)} />
          <StatMini
            label="Listings"
            value={String(network?.marketplaceListings ?? kpis?.marketplaceListings ?? 0)}
          />
        </Pillar>

        <Pillar
          href="/dashboard/suppliers"
          icon={Truck}
          badge="SRM"
          title="Suppliers you trust"
          desc="Book · OTIFEF · PO · ratings"
        >
          <StatMini label="Book" value={String(srm?.book ?? kpis?.srmBookTotal ?? 0)} />
          <StatMini
            label="OTIFEF"
            value={`${Number(srm?.avgOtifef ?? kpis?.srmAvgOtifef ?? 0).toFixed(0)}%`}
          />
          <StatMini label="Open POs" value={String(srm?.openPos ?? 0)} />
          <StatMini label="Verified" value={String(srm?.verified ?? 0)} />
        </Pillar>

        <Pillar
          href="/dashboard/customers"
          icon={Users}
          badge="CRM"
          title="Customers you grow"
          desc="Pipeline · multi-currency quotes · invoices"
        >
          <StatMini label="Accounts" value={String(crm?.customers ?? 0)} />
          <StatMini label="Pipeline" value={money(crm?.pipelineValue ?? 0, baseCcy)} />
          <StatMini label="Quotes" value={String(trade?.quotesOpen ?? 0)} />
          <StatMini label="Invoices" value={String(trade?.invoicesOpen ?? kpis?.invoicesOpen ?? 0)} />
        </Pillar>

        <Pillar
          href="/dashboard/inventory/products"
          icon={Boxes}
          badge="Inventory"
          title="Catalogue you sell"
          desc="Multi-currency SKUs · warehouses · stock"
        >
          <StatMini label="Products" value={String(inventory?.products ?? kpis?.products ?? 0)} />
          <StatMini
            label="Multi-FX SKUs"
            value={String(inventory?.multiCurrencyProducts ?? kpis?.multiCurrencyProducts ?? 0)}
          />
          <StatMini label="Currencies" value={String(currencies.length)} />
          <StatMini
            label="Low stock"
            value={String(
              (inventory?.warehouseLowStock ?? kpis?.warehouseLowStock ?? 0) +
                (kpis?.containerLowStock ?? 0)
            )}
          />
        </Pillar>
      </div>

      {/* Performance + finance strip */}
      <SectionLabel>Performance & finance</SectionLabel>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-10">
        <MetricHero
          label="Portfolio OTIFEF"
          value={Number(srm?.avgOtifef ?? kpis?.srmAvgOtifef ?? 0).toFixed(1)}
          unit="%"
          icon={TrendingUp}
          hint={`Trust ${Number(srm?.avgTrust ?? 0).toFixed(0)} · ${srm?.openPos ?? 0} open POs`}
        />
        <KpiCard
          icon={Target}
          label="CRM pipeline"
          value={money(crm?.pipelineValue ?? 0, baseCcy)}
          sub={`${crm?.opportunitiesOpen ?? 0} open deals`}
          href="/dashboard/customers/leads"
          tone="cyan"
        />
        <KpiCard
          icon={Star}
          label="Profile complete"
          value={`${pct}%`}
          sub={business?.verified ? 'Verified company' : 'Complete verification'}
          href="/dashboard/my-business"
          tone={pct >= 80 ? 'emerald' : 'amber'}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Open RIADs"
          value={
            (kpis?.openRisks ?? 0) +
            (crm?.riadOpen ?? 0) +
            (srm?.riadOpen ?? 0)
          }
          sub={`${kpis?.highRisks ?? 0} high priority`}
          href="/dashboard/customers/riad-log"
          tone={(kpis?.highRisks || 0) > 0 ? 'amber' : 'neutral'}
        />
      </div>

      {/* Ops strip */}
      <SectionLabel>Operations</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-10">
        <KpiCard
          icon={Container}
          label="Containers"
          value={kpis?.containersActive ?? 0}
          sub={`${kpis?.containersTotal ?? 0} total · today ${money(kpis?.salesToday ?? 0, baseCcy)}`}
          href="/dashboard/containers"
          tone="cyan"
        />
        <KpiCard
          icon={UserCheck}
          label="Contractors"
          value={kpis?.contractorsVerified ?? 0}
          sub={`${kpis?.contractorsTotal ?? 0} total`}
          href="/dashboard/containers/contractors"
          tone="emerald"
        />
        <KpiCard
          icon={Package}
          label="Products"
          value={kpis?.products ?? 0}
          sub={
            (kpis?.multiCurrencyProducts || 0) > 0
              ? `${kpis?.multiCurrencyProducts} multi-currency`
              : 'Catalogue SKUs'
          }
          href="/dashboard/inventory/products"
        />
        <KpiCard
          icon={Users}
          label="Team"
          value={kpis?.teamActive ?? 0}
          sub={`${kpis?.teamInvited ?? 0} invited`}
          href="/dashboard/my-business/team"
          tone={(kpis?.teamInvited || 0) > 0 ? 'amber' : 'neutral'}
        />
      </div>

      {/* Attention + Activity */}
      <div className="grid lg:grid-cols-5 gap-4 mb-10">
        <Panel
          title="Attention"
          className="lg:col-span-2"
          action={
            <span className="text-[10px] font-semibold text-neutral-400">
              {alerts.length} signal{alerts.length === 1 ? '' : 's'}
            </span>
          }
        >
          {alerts.length === 0 ? (
            <div className="p-8 text-center text-sm text-neutral-500">
              All clear — no critical signals.
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {alerts.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    className="flex gap-3 px-5 py-3.5 hover:bg-neutral-50 transition-colors"
                  >
                    <span
                      className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                        a.severity === 'critical'
                          ? 'bg-red-500'
                          : a.severity === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-sky-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{a.title}</div>
                      <div className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                        {a.detail}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Live activity"
          className="lg:col-span-3"
          action={
            <button
              type="button"
              onClick={() => void load()}
              className="text-[10px] font-semibold text-[#00b4d8]"
            >
              Refresh
            </button>
          }
        >
          {activity.length === 0 ? (
            <div className="p-8 text-center text-sm text-neutral-500">
              Connect companies, set pricing, and raise quotes — activity will stream here.
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {activity.slice(0, 10).map((item) => (
                <li
                  key={item.id}
                  className="px-5 py-3.5 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {item.title}
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5 truncate">
                      {item.subtitle}
                    </div>
                  </div>
                  <span className="text-[10px] text-neutral-400 whitespace-nowrap shrink-0">
                    {formatRelative(item.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <SectionLabel>Platform modules</SectionLabel>
      <ModuleGrid modules={PLATFORM_MODULES} />

      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickAction href="/dashboard/suppliers/discover" icon={Search} label="Discover companies" />
        <QuickAction href="/dashboard/connections/pricing" icon={Tag} label="Pricing agreements" />
        <QuickAction href="/dashboard/customers/quotes" icon={FileText} label="New quote" />
        <QuickAction href="/dashboard/my-business/settings" icon={Settings} label="Company settings" />
      </div>

      <OperatingPrinciples
        items={[
          {
            title: 'Connect before you trade',
            body: 'Network edges unlock POs, pricing, documents, and settlement — company-scoped, not person-scoped.',
          },
          {
            title: 'One ledger of operations',
            body: 'CRM, SRM, inventory, manufacturing, and distribution share live Supabase truth — no shadow systems.',
          },
          {
            title: 'Trust compounds on-chain',
            body: 'Where capital or pedigree matters, hashes and escrow sit beside the same commercial workflows.',
          },
        ]}
      />
    </RelationshipPage>
  );
}

function Pillar({
  href,
  icon: Icon,
  badge,
  title,
  desc,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: string;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border border-neutral-200 bg-white p-5 hover:border-[#00b4d8] hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#00b4d8]" />
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#00b4d8]/10 text-[#0077b6] border border-[#00b4d8]/20">
          {badge}
        </span>
      </div>
      <h3 className="font-bold text-base tracking-tight text-slate-800 mb-0.5">{title}</h3>
      <p className="text-xs text-neutral-500 mb-4 leading-relaxed">{desc}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">{children}</div>
      <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#00b4d8]">
        Open <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 border border-neutral-100 px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-wider text-neutral-400 font-semibold">
        {label}
      </div>
      <div className="font-bold text-slate-900 tabular-nums mt-0.5 text-sm truncate">{value}</div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-3xl border border-neutral-200 bg-white px-4 py-3.5 hover:border-[#00b4d8] hover:shadow-md transition-all group"
    >
      <div className="p-2 rounded-xl bg-[#00b4d8]/10 text-[#00b4d8]">
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <ArrowRight className="w-4 h-4 text-neutral-300 ml-auto group-hover:text-[#00b4d8]" />
    </Link>
  );
}
