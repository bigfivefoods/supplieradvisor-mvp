'use client';

import Link from 'next/link';
import {
  Activity,
  Brain,
  TrendingUp,
  Target,
  Users,
  Loader2,
  RefreshCw,
  ArrowRight,
  Network,
  Truck,
  Wallet,
  Package,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  CompanyRequired,
  IntelligenceHeader,
  IntelligencePage,
} from '@/components/intelligence/IntelligenceShell';
import {
  KpiCard,
  MetricHero,
  OperatingPrinciples,
  Panel,
  ProcessLifecycle,
  SectionLabel,
} from '@/components/relationship/RelationshipChrome';
import FxRateStrip from '@/components/fx/FxRateStrip';
import {
  healthTone,
  money,
  useIntelligence,
} from '@/lib/intelligence/useIntelligence';

const MODULES = [
  {
    href: '/dashboard/intelligence/pulse-dashboard',
    icon: Activity,
    title: 'Pulse',
    desc: 'Live operational, network, and financial vitals from Supabase.',
  },
  {
    href: '/dashboard/intelligence/neural-insights',
    icon: Brain,
    title: 'Insights',
    desc: 'Rule-based intelligence: risks, opportunities, concentration.',
  },
  {
    href: '/dashboard/intelligence/predictive-forecasts',
    icon: TrendingUp,
    title: 'Forecasts',
    desc: '30-day demand, procurement, and collection projections.',
  },
  {
    href: '/dashboard/intelligence/custom-scorecards',
    icon: Target,
    title: 'Scorecards',
    desc: 'Network, supply, demand, finance, and ops composite scores.',
  },
  {
    href: '/dashboard/intelligence/leadership-development',
    icon: Users,
    title: 'Leadership',
    desc: 'Super-Cube® assessment, growth plan, and development journey.',
  },
] as const;

export default function IntelligenceHub() {
  return (
    <CompanyRequired>
      <HubInner />
    </CompanyRequired>
  );
}

function HubInner() {
  const { data, loading, error, reload } = useIntelligence();
  const ccy = data?.company?.primary_currency || 'ZAR';
  const health = data?.health;
  const pulse = data?.pulse || {};

  if (loading) {
    return (
      <IntelligencePage>
        <div className="py-28 flex flex-col items-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8] mb-3" />
          <p className="text-sm text-neutral-500">Loading live intelligence…</p>
        </div>
      </IntelligencePage>
    );
  }

  return (
    <IntelligencePage>
      <IntelligenceHeader
        title="Intelligence"
        titleAccent="command"
        description="Best-in-class business intelligence from your live Supabase data — network, SRM, CRM, multi-currency trade, inventory, and finance — plus Super-Cube® leadership development."
        action={
          <button
            type="button"
            onClick={() => void reload()}
            className="btn-secondary !py-2.5 !px-4 text-sm"
          >
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

      <ProcessLifecycle
        title="Intelligence lifecycle"
        intro="Sense live vitals, surface insights, forecast demand, score performance, and develop leaders who act on the signal."
        steps={[
          {
            label: 'Pulse',
            href: '/dashboard/intelligence/pulse-dashboard',
            desc: 'Live ops, network, and finance vitals.',
          },
          {
            label: 'Insights',
            href: '/dashboard/intelligence/neural-insights',
            desc: 'Risks, concentration, and opportunities.',
          },
          {
            label: 'Forecast',
            href: '/dashboard/intelligence/predictive-forecasts',
            desc: 'Forward view of demand and pressure.',
          },
          {
            label: 'Scorecards',
            href: '/dashboard/intelligence/custom-scorecards',
            desc: 'KPIs leadership reviews on cadence.',
          },
          {
            label: 'Lead',
            href: '/dashboard/intelligence/leadership-development',
            desc: 'Super-Cube® develops the human system.',
          },
        ]}
      />

      <SectionLabel>Enterprise health</SectionLabel>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
        <MetricHero
          label="Overall health"
          value={String(health?.overall ?? 0)}
          unit="/100"
          icon={Sparkles}
          hint="Composite of network · supply · demand · finance · ops"
        />
        <KpiCard
          icon={Network}
          label="Network"
          value={health?.network ?? 0}
          sub={`${pulse.networkAccepted ?? 0} connected`}
          href="/dashboard/connections"
          tone={healthTone(health?.network ?? 0)}
        />
        <KpiCard
          icon={Truck}
          label="Supply"
          value={health?.supply ?? 0}
          sub={`OTIFEF ${Number(pulse.srmAvgOtifef ?? 0).toFixed(0)}%`}
          href="/dashboard/suppliers/performance"
          tone={healthTone(health?.supply ?? 0)}
        />
        <KpiCard
          icon={Users}
          label="Demand"
          value={health?.demand ?? 0}
          sub={money(Number(pulse.pipelineValue || 0), ccy)}
          href="/dashboard/customers"
          tone={healthTone(health?.demand ?? 0)}
        />
        <KpiCard
          icon={Wallet}
          label="Finance"
          value={health?.finance ?? 0}
          sub={`${pulse.arOpen ?? 0} AR · ${pulse.apOpen ?? 0} AP`}
          href="/dashboard/accounting"
          tone={healthTone(health?.finance ?? 0)}
        />
        <KpiCard
          icon={Package}
          label="Operations"
          value={health?.ops ?? 0}
          sub={`${pulse.products ?? 0} SKUs · ${pulse.lowStock ?? 0} low`}
          href="/dashboard/inventory"
          tone={healthTone(health?.ops ?? 0)}
        />
      </div>

      <SectionLabel>Live pulse</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        <KpiCard
          icon={Network}
          label="Connected companies"
          value={Number(pulse.networkAccepted || 0)}
          sub={`${pulse.networkPendingIn || 0} incoming requests`}
          href="/dashboard/connections"
          tone={Number(pulse.networkPendingIn || 0) > 0 ? 'amber' : 'emerald'}
        />
        <KpiCard
          icon={Truck}
          label="Open POs"
          value={Number(pulse.openPos || 0)}
          sub={`${pulse.onchainPos || 0} on-chain · ${Number(pulse.poGrowth || 0) >= 0 ? '+' : ''}${pulse.poGrowth || 0}% 30d`}
          href="/dashboard/suppliers/po"
        />
        <KpiCard
          icon={Wallet}
          label="AR balance"
          value={money(Number(pulse.arBalance || 0), ccy)}
          sub={`${pulse.arOpen || 0} open invoices`}
          href="/dashboard/accounting/accounts-receivable"
          tone="cyan"
        />
        <KpiCard
          icon={Package}
          label="Multi-currency SKUs"
          value={Number(pulse.multiCurrencyProducts || 0)}
          sub={
            Array.isArray(pulse.currencies)
              ? (pulse.currencies as string[]).join(' · ') || ccy
              : ccy
          }
          href="/dashboard/inventory/products"
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-4 mb-10">
        <Panel
          title="Priority insights"
          className="lg:col-span-2"
          action={
            <Link
              href="/dashboard/intelligence/neural-insights"
              className="text-[10px] font-semibold text-[#00b4d8]"
            >
              All insights →
            </Link>
          }
        >
          {!data?.insights?.length ? (
            <div className="p-8 text-center text-sm text-neutral-500">
              No critical signals — keep trading and connecting.
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.insights.slice(0, 5).map((ins) => (
                <li key={ins.id}>
                  <Link
                    href={ins.href}
                    className="flex gap-3 px-5 py-3.5 hover:bg-neutral-50 transition-colors"
                  >
                    <SeverityDot severity={ins.severity} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900">
                        {ins.title}
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                        {ins.detail}
                      </div>
                    </div>
                    {ins.metric && (
                      <span className="text-xs font-bold text-slate-700 tabular-nums shrink-0">
                        {ins.metric}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Intelligence modules" className="lg:col-span-3">
          <div className="p-4 grid sm:grid-cols-2 gap-3">
            {MODULES.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="group rounded-2xl border border-neutral-200 bg-white p-4 hover:border-[#00b4d8] hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-[#00b4d8]/10 text-[#00b4d8]">
                    <m.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 group-hover:text-[#0077b6]">
                      {m.title}
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                      {m.desc}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-300 ml-auto shrink-0 group-hover:text-[#00b4d8]" />
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Link
          href="/dashboard/intelligence/leadership-development"
          className="flex items-center gap-3 rounded-3xl border border-neutral-200 bg-white px-4 py-3.5 hover:border-[#00b4d8] transition-all"
        >
          <Users className="w-5 h-5 text-[#00b4d8]" />
          <span className="text-sm font-semibold">Leadership Super-Cube®</span>
          <ArrowRight className="w-4 h-4 text-neutral-300 ml-auto" />
        </Link>
        <Link
          href="/dashboard/intelligence/predictive-forecasts"
          className="flex items-center gap-3 rounded-3xl border border-neutral-200 bg-white px-4 py-3.5 hover:border-[#00b4d8] transition-all"
        >
          <TrendingUp className="w-5 h-5 text-[#00b4d8]" />
          <span className="text-sm font-semibold">30-day forecasts</span>
          <ArrowRight className="w-4 h-4 text-neutral-300 ml-auto" />
        </Link>
        <Link
          href="/dashboard/intelligence/custom-scorecards"
          className="flex items-center gap-3 rounded-3xl border border-neutral-200 bg-white px-4 py-3.5 hover:border-[#00b4d8] transition-all"
        >
          <Target className="w-5 h-5 text-[#00b4d8]" />
          <span className="text-sm font-semibold">Scorecards</span>
          <ArrowRight className="w-4 h-4 text-neutral-300 ml-auto" />
        </Link>
      </div>

      <OperatingPrinciples
        items={[
          {
            title: 'Live data, not vanity BI',
            body: 'Pulse and insights read Supabase trade, network, and finance — the same books operators use every day.',
          },
          {
            title: 'Signal over noise',
            body: 'Rule-based insights highlight risk, concentration, and opportunity so leaders act, not drown in charts.',
          },
          {
            title: 'Lead the human system',
            body: 'Super-Cube® develops the people who run the network — better decisions compound across every module.',
          },
        ]}
      />
    </IntelligencePage>
  );
}

function SeverityDot({
  severity,
}: {
  severity: 'critical' | 'warning' | 'positive' | 'info';
}) {
  const cls =
    severity === 'critical'
      ? 'bg-red-500'
      : severity === 'warning'
        ? 'bg-amber-500'
        : severity === 'positive'
          ? 'bg-emerald-500'
          : 'bg-sky-500';
  return (
    <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${cls}`}>
      {severity === 'positive' ? (
        <CheckCircle2 className="w-0 h-0 opacity-0" />
      ) : severity === 'critical' ? (
        <AlertTriangle className="w-0 h-0 opacity-0" />
      ) : null}
    </span>
  );
}
