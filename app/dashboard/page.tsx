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
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  AlertBanner,
  KpiCard,
  MetricHero,
  ModuleGrid,
  Panel,
  ProcessRail,
  RelationshipHeader,
  RelationshipPage,
  SectionLabel,
  type ModuleCard,
} from '@/components/relationship/RelationshipChrome';

type CompanyData = {
  id: number;
  trading_name: string;
  legal_name: string | null;
  industry: string | null;
  verification_status?: string | null;
  country?: string | null;
  city?: string | null;
  trust_score?: number | null;
};

type Kpis = {
  teamActive: number;
  teamInvited: number;
  teamTotal: number;
  networkAccepted: number;
  networkPending: number;
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
  // CRM
  customersTotal?: number;
  customersActive?: number;
  leadsOpen?: number;
  pipelineValue?: number;
  opportunitiesOpen?: number;
  crmInvitePending?: number;
  crmInviteAccepted?: number;
  crmRiadOpen?: number;
  // SRM
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

function money(n: number) {
  return `R ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const PLATFORM_MODULES: ModuleCard[] = [
  {
    href: '/dashboard/customers',
    icon: Users,
    title: 'Customers CRM',
    desc: 'Lead → quote → order → invoice · invites · loyalty · RIAD',
    badge: 'Grow',
  },
  {
    href: '/dashboard/suppliers',
    icon: Truck,
    title: 'Suppliers SRM',
    desc: 'Discover · connect · PO · escrow · OTIFEF · ratings',
    badge: 'Trust',
  },
  {
    href: '/dashboard/my-business',
    icon: Building2,
    title: 'My Business',
    desc: 'Profile, team, settings, legal, documents',
    badge: 'Core',
  },
  {
    href: '/dashboard/inventory',
    icon: Boxes,
    title: 'Inventory',
    desc: 'Catalogue, warehouses, stock levels, transfers',
  },
  {
    href: '/dashboard/containers',
    icon: Container,
    title: 'Containers',
    desc: 'Outlets, contractors, sales, container RIAD',
  },
  {
    href: '/dashboard/connections',
    icon: Network,
    title: 'Network',
    desc: 'Connection requests and partner edges',
  },
];

export default function DashboardHome() {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [crm, setCrm] = useState<CrmSnap | null>(null);
  const [srm, setSrm] = useState<SrmSnap | null>(null);
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
          <div className="mx-auto mb-5 h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-[#00b4d8]" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-2">
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

  return (
    <RelationshipPage>
      <RelationshipHeader
        eyebrow={`${greeting()} · Command center`}
        title={company.trading_name}
        description={
          [company.industry, company.city, company.country].filter(Boolean).join(' · ') ||
          'Live operating system for CRM, SRM, inventory, and containers — one product language.'
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
            <Link href="/dashboard/suppliers/add" className="btn-primary !py-2.5 !px-5 text-sm">
              <Plus className="w-4 h-4" /> Add supplier
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-6 -mt-4">
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
        {generatedAt && (
          <span className="text-[11px] text-neutral-400">
            Live from Supabase · {formatRelative(generatedAt) || 'just now'}
          </span>
        )}
      </div>

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

      <SectionLabel>Platform lifecycle</SectionLabel>
      <ProcessRail
        steps={[
          { label: 'Business', href: '/dashboard/my-business' },
          { label: 'Customers', href: '/dashboard/customers' },
          { label: 'Suppliers', href: '/dashboard/suppliers' },
          { label: 'Inventory', href: '/dashboard/inventory' },
          { label: 'Containers', href: '/dashboard/containers' },
          { label: 'Network', href: '/dashboard/connections' },
        ]}
      />

      {/* Core pulse */}
      <SectionLabel>Workspace pulse</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <KpiCard
          icon={Users}
          label="Team active"
          value={kpis?.teamActive ?? 0}
          sub={`${kpis?.teamInvited ?? 0} invited · ${kpis?.teamTotal ?? 0} total`}
          href="/dashboard/my-business/team"
          tone={(kpis?.teamInvited || 0) > 0 ? 'amber' : 'neutral'}
        />
        <KpiCard
          icon={Handshake}
          label="Customers"
          value={crm?.customers ?? kpis?.customersTotal ?? 0}
          sub={`${crm?.customersActive ?? kpis?.customersActive ?? 0} active · ${crm?.invitePending ?? 0} invites`}
          href="/dashboard/customers"
          tone="cyan"
        />
        <KpiCard
          icon={Truck}
          label="Supplier book"
          value={srm?.book ?? kpis?.srmBookTotal ?? 0}
          sub={`${srm?.connected ?? kpis?.srmConnected ?? 0} connected · ${srm?.invitePending ?? 0} invites`}
          href="/dashboard/suppliers/network"
          tone="emerald"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Open RIADs"
          value={
            (kpis?.openRisks ?? 0) +
            (crm?.riadOpen ?? kpis?.crmRiadOpen ?? 0) +
            (srm?.riadOpen ?? kpis?.srmRiadOpen ?? 0)
          }
          sub={`${kpis?.highRisks ?? 0} high · CRM + SRM + ops`}
          href="/dashboard/customers/riad-log"
          tone={(kpis?.highRisks || 0) > 0 ? 'amber' : 'neutral'}
        />
      </div>

      {/* Three pillars: CRM · SRM · Business */}
      <SectionLabel>Relationship systems</SectionLabel>
      <div className="grid lg:grid-cols-3 gap-4 mb-10">
        {/* CRM card */}
        <Link
          href="/dashboard/customers"
          className="group rounded-[1.35rem] border border-neutral-200/90 bg-white p-6 hover:border-slate-900 hover:shadow-xl hover:shadow-slate-900/5 transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-2xl bg-slate-900 text-[#00b4d8]">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-900 text-white">
              CRM
            </span>
          </div>
          <h3 className="font-bold text-lg tracking-tight text-slate-900 mb-1">
            Customers you can <span className="text-[#00b4d8]">grow</span>
          </h3>
          <p className="text-xs text-neutral-500 mb-5 leading-relaxed">
            Pipeline, quotes, orders, invoices, invites, loyalty
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <StatMini label="Open leads" value={String(crm?.leadsOpen ?? 0)} />
            <StatMini
              label="Pipeline"
              value={money(crm?.pipelineValue ?? kpis?.pipelineValue ?? 0)}
            />
            <StatMini label="Open deals" value={String(crm?.opportunitiesOpen ?? 0)} />
            <StatMini label="Connected" value={String(crm?.inviteAccepted ?? 0)} />
          </div>
          <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-[#00b4d8]">
            Open CRM <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* SRM card */}
        <Link
          href="/dashboard/suppliers"
          className="group rounded-[1.35rem] border border-neutral-200/90 bg-white p-6 hover:border-slate-900 hover:shadow-xl hover:shadow-slate-900/5 transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-2xl bg-slate-900 text-[#00b4d8]">
              <Truck className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-900 text-white">
              SRM
            </span>
          </div>
          <h3 className="font-bold text-lg tracking-tight text-slate-900 mb-1">
            Suppliers you can <span className="text-[#00b4d8]">trust</span>
          </h3>
          <p className="text-xs text-neutral-500 mb-5 leading-relaxed">
            Discover, connect, PO escrow, OTIFEF, ratings
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <StatMini label="Connected" value={String(srm?.connected ?? 0)} />
            <StatMini
              label="OTIFEF"
              value={`${Number(srm?.avgOtifef ?? kpis?.srmAvgOtifef ?? 0).toFixed(0)}%`}
            />
            <StatMini label="Open POs" value={String(srm?.openPos ?? 0)} />
            <StatMini label="On-chain" value={String(srm?.onchainPos ?? 0)} />
          </div>
          <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-[#00b4d8]">
            Open SRM <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Business card */}
        <Link
          href="/dashboard/my-business"
          className="group rounded-[1.35rem] border border-slate-900 bg-slate-900 text-white p-6 hover:shadow-xl hover:shadow-slate-900/20 transition-all relative overflow-hidden"
        >
          <div
            aria-hidden
            className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-[#00b4d8]/20 blur-2xl"
          />
          <div className="relative flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-2xl bg-white/10 text-[#00b4d8]">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10">
              Company
            </span>
          </div>
          <h3 className="relative font-bold text-lg tracking-tight mb-1">
            My business, <span className="text-[#00b4d8]">mastered</span>
          </h3>
          <p className="relative text-xs text-neutral-400 mb-5 leading-relaxed">
            Profile integrity, team, settings, legal
          </p>
          <div className="relative">
            <div className="flex items-end justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
                Profile complete
              </span>
              <span className="text-3xl font-black tracking-tighter tabular-nums">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#00b4d8]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-neutral-300">
              <span>{business?.teamActive ?? kpis?.teamActive ?? 0} active team</span>
              <span>{business?.verified ? 'Verified' : 'Unverified'}</span>
            </div>
          </div>
          <div className="relative mt-5 flex items-center gap-1 text-xs font-semibold text-[#00b4d8]">
            Open workspace <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      </div>

      {/* Ops + Inventory strip */}
      <SectionLabel>Operations</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-10">
        <KpiCard
          icon={Container}
          label="Containers"
          value={kpis?.containersActive ?? 0}
          sub={`${kpis?.containersTotal ?? 0} total · sales today ${money(kpis?.salesToday ?? 0)}`}
          href="/dashboard/containers"
          tone="cyan"
        />
        <KpiCard
          icon={UserCheck}
          label="Contractors"
          value={kpis?.contractorsVerified ?? 0}
          sub={`${kpis?.contractorsTotal ?? 0} total verified`}
          href="/dashboard/containers/contractors"
          tone="emerald"
        />
        <KpiCard
          icon={Package}
          label="Products"
          value={kpis?.products ?? 0}
          sub={
            (kpis?.warehouseLowStock || 0) + (kpis?.containerLowStock || 0) > 0
              ? 'Reorder needed'
              : 'Catalogue SKUs'
          }
          href="/dashboard/inventory"
          tone={
            (kpis?.warehouseLowStock || 0) + (kpis?.containerLowStock || 0) > 0
              ? 'amber'
              : 'neutral'
          }
        />
        <KpiCard
          icon={Network}
          label="Network"
          value={kpis?.networkAccepted ?? 0}
          sub={`${kpis?.networkPending ?? 0} pending requests`}
          href="/dashboard/connections"
        />
      </div>

      {/* Activity + Alerts */}
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
              {alerts.slice(0, 6).map((a) => (
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
              Activity will appear as your team works across CRM, SRM, and operations.
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {activity.slice(0, 8).map((item) => (
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

      {/* OTIFEF hero when SRM has data */}
      {(srm?.avgOtifef || 0) > 0 && (
        <>
          <SectionLabel
            action={
              <Link
                href="/dashboard/suppliers/performance"
                className="text-xs font-semibold text-[#00b4d8] hover:underline"
              >
                Scorecards →
              </Link>
            }
          >
            Supply performance
          </SectionLabel>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-10">
            <MetricHero
              label="Portfolio OTIFEF"
              value={Number(srm?.avgOtifef ?? 0).toFixed(1)}
              unit="%"
              icon={TrendingUp}
              hint={`Trust avg ${Number(srm?.avgTrust ?? 0).toFixed(0)} · ${srm?.openPos ?? 0} open POs`}
            />
            <KpiCard
              icon={ShoppingCart}
              label="Open POs"
              value={srm?.openPos ?? 0}
              sub={`${srm?.onchainPos ?? 0} on-chain escrow`}
              href="/dashboard/suppliers/po"
            />
            <KpiCard
              icon={Star}
              label="Verified suppliers"
              value={srm?.verified ?? 0}
              sub="In your book"
              href="/dashboard/suppliers/network"
              tone="emerald"
            />
            <KpiCard
              icon={Target}
              label="CRM pipeline"
              value={money(crm?.pipelineValue ?? 0)}
              sub={`${crm?.opportunitiesOpen ?? 0} open deals`}
              href="/dashboard/customers/leads"
              tone="cyan"
            />
          </div>
        </>
      )}

      <SectionLabel>Platform modules</SectionLabel>
      <ModuleGrid modules={PLATFORM_MODULES} />

      <div className="mt-10 grid sm:grid-cols-3 gap-3">
        <QuickAction href="/dashboard/customers/onboard" icon={Plus} label="Add customer" />
        <QuickAction href="/dashboard/suppliers/discover" icon={Truck} label="Discover suppliers" />
        <QuickAction href="/dashboard/my-business/settings" icon={Settings} label="Company settings" />
      </div>
    </RelationshipPage>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 border border-neutral-100 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
        {label}
      </div>
      <div className="font-bold text-slate-900 tabular-nums mt-0.5">{value}</div>
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
      className="flex items-center gap-3 rounded-[1.25rem] border border-neutral-200/90 bg-white px-4 py-3.5 hover:border-slate-900 hover:shadow-md transition-all group"
    >
      <div className="p-2 rounded-xl bg-slate-50 group-hover:bg-slate-900 group-hover:text-white transition-colors">
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <ArrowRight className="w-4 h-4 text-neutral-300 ml-auto group-hover:text-[#00b4d8]" />
    </Link>
  );
}
