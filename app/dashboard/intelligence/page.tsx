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
import FxRateStrip from '@/components/fx/FxRateStrip';
import {
  healthTone,
  money,
  useIntelligence,
} from '@/lib/intelligence/useIntelligence';
import {
  HubHero,
  HubModuleGrid,
  HubPanel,
  HubPrinciples,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
  type TelemetryAccent,
} from '@/components/chrome/CommandHubChrome';

const MODULES: HubModule[] = [
  {
    href: '/dashboard/intelligence/pulse-dashboard',
    icon: Activity,
    code: '01',
    title: 'Pulse',
    desc: 'Live operational, network, and financial vitals from Supabase.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/intelligence/neural-insights',
    icon: Brain,
    code: '02',
    title: 'Insights',
    desc: 'Rule-based intelligence: risks, opportunities, concentration.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/intelligence/predictive-forecasts',
    icon: TrendingUp,
    code: '03',
    title: 'Forecasts',
    desc: '30-day demand, procurement, and collection projections.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
  {
    href: '/dashboard/intelligence/custom-scorecards',
    icon: Target,
    code: '04',
    title: 'Scorecards',
    desc: 'Network, supply, demand, finance, and ops composite scores.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/intelligence/leadership-development',
    icon: Users,
    code: '05',
    title: 'Leadership',
    desc: 'Super-Cube® assessment, growth plan, and development journey.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
];

function mapTone(t: string): TelemetryAccent {
  if (t === 'emerald' || t === 'green') return 'emerald';
  if (t === 'amber' || t === 'yellow') return 'amber';
  if (t === 'rose' || t === 'red') return 'rose';
  if (t === 'violet') return 'violet';
  if (t === 'sky') return 'sky';
  if (t === 'slate' || t === 'neutral') return 'slate';
  return 'cyan';
}

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

  if (loading && !data) {
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
        titleAccent="Command"
        description="Best-in-class business intelligence from live Supabase data — network, SRM, CRM, multi-currency trade, inventory, and finance — plus Super-Cube® leadership development."
        action={
          <button
            type="button"
            onClick={() => void reload()}
            className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <FxRateStrip currency={ccy} className="mb-6" />

      <HubHero
        pill="Live BI · pulse → lead"
        title="Signal over noise."
        description="Pulse and insights read Supabase trade, network, and finance — the same books operators use every day. Super-Cube® develops the people who run the network."
        stats={[
          {
            label: 'Health',
            value: health?.overall ?? 0,
            valueClass: 'text-[#00b4d8]',
          },
          {
            label: 'Network',
            value: health?.network ?? 0,
            valueClass: 'text-emerald-600',
          },
          {
            label: 'Insights',
            value: data?.insights?.length ?? 0,
            valueClass: 'text-amber-600',
          },
        ]}
      />

      <HubTelemetryGrid>
        <TelemetryCard
          label="Overall health"
          value={health?.overall ?? 0}
          sub="/100 composite"
          accent="cyan"
          icon={Sparkles}
          href="/dashboard/intelligence/custom-scorecards"
        />
        <TelemetryCard
          label="Network"
          value={health?.network ?? 0}
          sub={`${pulse.networkAccepted ?? 0} connected`}
          accent={mapTone(String(healthTone(health?.network ?? 0)))}
          icon={Network}
          href="/dashboard/connections"
        />
        <TelemetryCard
          label="Supply"
          value={health?.supply ?? 0}
          sub={`OTIFEF ${Number(pulse.srmAvgOtifef ?? 0).toFixed(0)}%`}
          accent={mapTone(String(healthTone(health?.supply ?? 0)))}
          icon={Truck}
          href="/dashboard/suppliers/performance"
        />
        <TelemetryCard
          label="Demand"
          value={health?.demand ?? 0}
          sub={money(Number(pulse.pipelineValue || 0), ccy)}
          accent={mapTone(String(healthTone(health?.demand ?? 0)))}
          icon={Users}
          href="/dashboard/customers"
        />
        <TelemetryCard
          label="Finance"
          value={health?.finance ?? 0}
          sub={`${pulse.arOpen ?? 0} AR · ${pulse.apOpen ?? 0} AP`}
          accent={mapTone(String(healthTone(health?.finance ?? 0)))}
          icon={Wallet}
          href="/dashboard/accounting"
        />
        <TelemetryCard
          label="Operations"
          value={health?.ops ?? 0}
          sub={`${pulse.products ?? 0} SKUs · ${pulse.lowStock ?? 0} low`}
          accent={mapTone(String(healthTone(health?.ops ?? 0)))}
          icon={Package}
          href="/dashboard/inventory"
        />
        <TelemetryCard
          label="Open POs"
          value={Number(pulse.openPos || 0)}
          sub={`${pulse.onchainPos || 0} on-chain`}
          accent="violet"
          icon={Truck}
          href="/dashboard/suppliers/po"
        />
        <TelemetryCard
          label="AR balance"
          value={money(Number(pulse.arBalance || 0), ccy)}
          sub={`${pulse.arOpen || 0} open invoices`}
          accent="emerald"
          icon={Wallet}
          href="/dashboard/accounting/accounts-receivable"
        />
      </HubTelemetryGrid>

      <div className="grid lg:grid-cols-2 gap-4 mb-8">
        <HubPanel
          title="Priority insights"
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
            <p className="text-sm text-neutral-400 py-6 text-center">
              No critical signals — keep trading and connecting.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.insights.slice(0, 5).map((ins) => (
                <li key={ins.id}>
                  <Link
                    href={ins.href}
                    className="flex gap-3 rounded-xl border border-neutral-100 px-3 py-2.5 hover:border-cyan-200 hover:bg-sky-50/40 transition-colors"
                  >
                    <SeverityDot severity={ins.severity} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900">{ins.title}</div>
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
        </HubPanel>

        <HubPanel title="Connected systems" variant="cyan">
          <p className="text-sm text-neutral-600 leading-relaxed mb-4">
            Intelligence orchestrates signals. Deep work lives in specialist modules.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {[
              { href: '/dashboard/connections', label: 'Network graph' },
              { href: '/dashboard/suppliers', label: 'Suppliers SRM' },
              { href: '/dashboard/customers', label: 'Customers CRM' },
              { href: '/dashboard/accounting', label: 'Accounting' },
              { href: '/dashboard/operations', label: 'Operations tower' },
              { href: '/dashboard/inventory', label: 'Inventory OS' },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-xs font-bold text-[#0077b6] rounded-xl border border-cyan-100 bg-white px-3 py-2.5 hover:border-[#00b4d8] transition-colors"
              >
                {l.label} →
              </Link>
            ))}
          </div>
        </HubPanel>
      </div>

      <HubModuleGrid modules={MODULES} />

      <HubPrinciples
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
