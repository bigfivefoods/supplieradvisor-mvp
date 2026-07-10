'use client';

import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Container,
  Wallet,
  ArrowRight,
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
import { money, useIntelligence } from '@/lib/intelligence/useIntelligence';

export default function ForecastsPage() {
  return (
    <CompanyRequired>
      <ForecastsInner />
    </CompanyRequired>
  );
}

function ForecastsInner() {
  const { data, loading, error, reload } = useIntelligence();
  const f = data?.forecasts;
  const p = data?.pulse || {};
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
        title="Predictive"
        titleAccent="forecasts"
        description="30-day projections from trailing procurement, container sales, and AR balances. Transparent method — trend extrapolation on live Supabase history, not a black box."
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

      <SectionLabel>Next 30 days</SectionLabel>
      <div className="grid md:grid-cols-3 gap-4 mb-10">
        <MetricHero
          label="Projected PO spend"
          value={Math.round(f?.poNext30 ?? 0).toLocaleString()}
          unit={ccy}
          icon={ShoppingCart}
          hint={`Trailing 30d ${money(Number(p.poValue30 || 0), ccy)} · growth ${Number(f?.poGrowth || 0) >= 0 ? '+' : ''}${f?.poGrowth || 0}%`}
        />
        <MetricHero
          label="Projected retail sales"
          value={Math.round(f?.salesNext30 ?? 0).toLocaleString()}
          unit={ccy}
          icon={Container}
          hint={`Trailing 30d ${money(Number(p.sales30 || 0), ccy)} · growth ${Number(f?.salesGrowth || 0) >= 0 ? '+' : ''}${f?.salesGrowth || 0}%`}
        />
        <MetricHero
          label="AR collection risk"
          value={Math.round(f?.arCollectionRisk ?? 0).toLocaleString()}
          unit={ccy}
          icon={Wallet}
          hint="Indicative 15% of open AR balance — chase collections early"
        />
      </div>

      <SectionLabel>Trend signals</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        <KpiCard
          icon={Number(f?.poGrowth || 0) >= 0 ? TrendingUp : TrendingDown}
          label="PO growth"
          value={`${Number(f?.poGrowth || 0) >= 0 ? '+' : ''}${f?.poGrowth || 0}%`}
          tone={Number(f?.poGrowth || 0) >= 0 ? 'emerald' : 'amber'}
          href="/dashboard/suppliers/po"
        />
        <KpiCard
          icon={Number(f?.salesGrowth || 0) >= 0 ? TrendingUp : TrendingDown}
          label="Retail growth"
          value={`${Number(f?.salesGrowth || 0) >= 0 ? '+' : ''}${f?.salesGrowth || 0}%`}
          tone={Number(f?.salesGrowth || 0) >= 0 ? 'emerald' : 'amber'}
          href="/dashboard/containers"
        />
        <KpiCard
          icon={ShoppingCart}
          label="Open POs now"
          value={Number(p.openPos || 0)}
          sub={`${p.onchainPos || 0} escrow`}
          href="/dashboard/suppliers/po"
        />
        <KpiCard
          icon={Wallet}
          label="Open AR"
          value={money(Number(p.arBalance || 0), ccy)}
          sub={`${p.arOpen || 0} invoices`}
          href="/dashboard/accounting/accounts-receivable"
          tone="cyan"
        />
      </div>

      <Panel title="How forecasts are calculated">
        <div className="px-5 py-5 text-sm text-neutral-600 space-y-2 leading-relaxed">
          <p>
            <strong className="text-slate-800">Method:</strong>{' '}
            {f?.method || 'trailing-period trend projection'} over a{' '}
            {f?.horizonDays || 30}-day horizon.
          </p>
          <p>
            Procurement and retail forecasts compare the last 30 days to the prior 30 days, then
            project the next period with the same growth rate (floored at recent run-rate when history
            is thin).
          </p>
          <p>
            AR collection risk applies a conservative 15% factor to open accounting receivables —
            use it as a cash-flow early warning, not a bank covenant.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/dashboard/suppliers/po" className="text-xs font-semibold text-[#00b4d8] inline-flex items-center gap-1">
              PO pipeline <ArrowRight className="w-3 h-3" />
            </Link>
            <Link href="/dashboard/accounting/accounts-receivable" className="text-xs font-semibold text-[#00b4d8] inline-flex items-center gap-1">
              AR workspace <ArrowRight className="w-3 h-3" />
            </Link>
            <Link href="/dashboard/intelligence/custom-scorecards" className="text-xs font-semibold text-[#00b4d8] inline-flex items-center gap-1">
              Scorecards <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </Panel>
    </IntelligencePage>
  );
}
