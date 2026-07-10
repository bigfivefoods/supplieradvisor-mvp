'use client';

import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  Network,
  Truck,
  Users,
  Package,
  Wallet,
  ShoppingCart,
  Tag,
  TrendingUp,
  Boxes,
} from 'lucide-react';
import {
  CompanyRequired,
  IntelligenceHeader,
  IntelligencePage,
} from '@/components/intelligence/IntelligenceShell';
import {
  KpiCard,
  MetricHero,
  Panel,
  SectionLabel,
} from '@/components/relationship/RelationshipChrome';
import FxRateStrip from '@/components/fx/FxRateStrip';
import {
  healthTone,
  money,
  useIntelligence,
} from '@/lib/intelligence/useIntelligence';

export default function PulseDashboardPage() {
  return (
    <CompanyRequired>
      <PulseInner />
    </CompanyRequired>
  );
}

function PulseInner() {
  const { data, loading, error, reload } = useIntelligence();
  const p = data?.pulse || {};
  const h = data?.health;
  const ccy = data?.company?.primary_currency || 'ZAR';

  if (loading) {
    return (
      <IntelligencePage>
        <div className="py-28 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      </IntelligencePage>
    );
  }

  return (
    <IntelligencePage>
      <IntelligenceHeader
        title="Business"
        titleAccent="pulse"
        description="Real-time vitals from Supabase — network graph, SRM trust, CRM pipeline, multi-currency catalogue, and AR/AP — refreshed on demand."
        action={
          <button type="button" onClick={() => void reload()} className="btn-secondary !py-2.5 !px-4 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <FxRateStrip currency={ccy} className="mb-8" />

      <SectionLabel>Health index</SectionLabel>
      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        <MetricHero
          label="Overall"
          value={String(h?.overall ?? 0)}
          unit=""
          icon={TrendingUp}
          hint="Average of five domain scores"
        />
        {(
          [
            ['Network', h?.network, '/dashboard/connections'],
            ['Supply', h?.supply, '/dashboard/suppliers'],
            ['Demand', h?.demand, '/dashboard/customers'],
            ['Finance', h?.finance, '/dashboard/accounting'],
            ['Ops', h?.ops, '/dashboard/inventory'],
          ] as const
        ).map(([label, score, href]) => (
          <KpiCard
            key={label}
            label={label}
            value={score ?? 0}
            href={href}
            tone={healthTone(score ?? 0)}
          />
        ))}
      </div>

      <SectionLabel>Network & trade</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <KpiCard
          icon={Network}
          label="Connected"
          value={Number(p.networkAccepted || 0)}
          sub={`${p.networkPendingIn || 0} in · ${p.networkPendingOut || 0} out`}
          href="/dashboard/connections"
          tone={Number(p.networkPendingIn || 0) > 0 ? 'amber' : 'emerald'}
        />
        <KpiCard
          icon={Tag}
          label="Pricing active"
          value={Number(p.pricingActive || 0)}
          href="/dashboard/connections/pricing"
          tone="cyan"
        />
        <KpiCard
          icon={ShoppingCart}
          label="Open POs"
          value={Number(p.openPos || 0)}
          sub={`${p.onchainPos || 0} on-chain · 30d ${money(Number(p.poValue30 || 0), ccy)}`}
          href="/dashboard/suppliers/po"
        />
        <KpiCard
          icon={TrendingUp}
          label="PO growth 30d"
          value={`${Number(p.poGrowth || 0) >= 0 ? '+' : ''}${p.poGrowth || 0}%`}
          tone={Number(p.poGrowth || 0) >= 0 ? 'emerald' : 'amber'}
        />
      </div>

      <SectionLabel>SRM · CRM · Finance · Inventory</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <KpiCard
          icon={Truck}
          label="OTIFEF"
          value={`${Number(p.srmAvgOtifef || 0).toFixed(0)}%`}
          sub={`Trust ${Number(p.srmAvgTrust || 0).toFixed(0)} · ${p.srmConnected || 0} linked`}
          href="/dashboard/suppliers/performance"
          tone={Number(p.srmAvgOtifef || 0) >= 85 ? 'emerald' : 'amber'}
        />
        <KpiCard
          icon={Users}
          label="Pipeline"
          value={money(Number(p.pipelineValue || 0), ccy)}
          sub={`${p.customersActive || 0} active · ${p.openLeads || 0} leads`}
          href="/dashboard/customers/leads"
          tone="cyan"
        />
        <KpiCard
          icon={Wallet}
          label="AR / AP open"
          value={`${p.arOpen || 0} / ${p.apOpen || 0}`}
          sub={`AR ${money(Number(p.arBalance || 0), ccy)}`}
          href="/dashboard/accounting/accounts-receivable"
        />
        <KpiCard
          icon={Boxes}
          label="Catalogue"
          value={Number(p.products || 0)}
          sub={`${p.multiCurrencyProducts || 0} multi-FX · ${p.lowStock || 0} low stock`}
          href="/dashboard/inventory/products"
          tone={Number(p.lowStock || 0) > 0 ? 'amber' : 'neutral'}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Quote engine">
          <div className="p-5 grid grid-cols-2 gap-3">
            <Stat label="Open quotes" value={String(p.quotesOpen || 0)} />
            <Stat label="Win rate" value={`${p.quoteWinRate || 0}%`} />
            <Stat label="Open quote value" value={money(Number(p.quotesValue || 0), ccy)} />
            <Stat
              label="Currencies"
              value={
                Array.isArray(p.currencies)
                  ? (p.currencies as string[]).join(', ') || ccy
                  : ccy
              }
            />
          </div>
          <div className="px-5 pb-5">
            <Link href="/dashboard/customers/quotes" className="text-xs font-semibold text-[#00b4d8]">
              Open quotes →
            </Link>
          </div>
        </Panel>
        <Panel title="Retail pulse (containers)">
          <div className="p-5 grid grid-cols-2 gap-3">
            <Stat label="Sales 30d" value={money(Number(p.sales30 || 0), ccy)} />
            <Stat
              label="Sales growth"
              value={`${Number(p.salesGrowth || 0) >= 0 ? '+' : ''}${p.salesGrowth || 0}%`}
            />
            <Stat label="Stock units" value={String(Math.round(Number(p.stockUnits || 0)))} />
            <Stat label="Reviews given" value={String(p.reviewsGiven || 0)} />
          </div>
          <div className="px-5 pb-5">
            <Link href="/dashboard/containers" className="text-xs font-semibold text-[#00b4d8]">
              Containers →
            </Link>
          </div>
        </Panel>
      </div>
    </IntelligencePage>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 border border-neutral-100 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
        {label}
      </div>
      <div className="font-bold text-slate-900 tabular-nums mt-0.5 text-sm">{value}</div>
    </div>
  );
}
