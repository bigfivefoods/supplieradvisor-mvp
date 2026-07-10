'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Target,
  Users,
  FileText,
  Wallet,
  TrendingUp,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Trophy,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { formatZar, formatZarPrecise } from '@/lib/sales-contractor/commission';
import type { SalesPortalSummary } from '@/lib/sales-contractor/types';
import { EarningsTrendChart } from '@/components/sales/SalesCharts';

export default function SalesCommandCentre() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SalesPortalSummary | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !privyUserId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        privyUserId,
      });
      const res = await fetch(`/api/sales/summary?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load portal');
      setSummary(data.summary);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
        <p className="text-slate-400 text-sm">Loading your sales command centre…</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="max-w-lg mx-auto rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="font-semibold text-red-200 mb-2">Could not load portal</p>
        <p className="text-sm text-red-200/80 mb-4">{error}</p>
        <p className="text-xs text-slate-500 mb-4">
          If tables are missing, run{' '}
          <code className="text-amber-300">20260710_sales_contractor_portal.sql</code> in Supabase.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="px-5 py-2.5 rounded-2xl bg-white/10 text-sm font-semibold hover:bg-white/15"
        >
          Retry
        </button>
      </div>
    );
  }

  const k = summary.kpis;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-amber-500/20 via-orange-600/10 to-cyan-500/10 p-6 sm:p-10">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgNjBMMTAgNTBNMzAgNjBMNjAgMzBNMCA0MEwyMCAyME00MCA2MEw2MCA0MCIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBmaWxsPSJub25lIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2cpIi8+PC9zdmc+')] opacity-60" />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 border border-amber-400/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-200 mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              {summary.roleLabel} · {summary.companyName}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-[1.1]">
              Sell with confidence.
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">
                Track every rand you earn.
              </span>
            </h1>
            <p className="mt-4 text-slate-300 max-w-xl text-sm sm:text-base leading-relaxed">
              Your independent contractor workspace for leads, customers, and closed deals. All CRM
              records belong to <strong className="text-white">{summary.companyName}</strong> —
              you earn progressive commission from <strong className="text-amber-300">3%</strong> up
              to <strong className="text-amber-300">5%</strong> as deals get bigger.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {!summary.agreementSigned && (
              <Link
                href="/sales/agreement"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-slate-900 font-bold text-sm shadow-xl"
              >
                Sign agreement first
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <Link
              href="/dashboard/customers/leads"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm shadow-xl shadow-orange-500/25"
            >
              Capture a lead
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {!summary.agreementSigned && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-amber-100">
            <strong>Action required:</strong> Sign the Independent Sales Contractor Agreement to
            unlock full portal tools and commission tracking.
          </p>
          <Link
            href="/sales/agreement"
            className="shrink-0 text-sm font-bold text-amber-300 hover:text-amber-200"
          >
            Review &amp; sign →
          </Link>
        </div>
      )}

      {!summary.subscriptionExempt &&
        summary.agreementSigned &&
        !summary.subscriptionActive && (
        <div className="rounded-2xl border border-orange-400/40 bg-orange-500/10 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-orange-100">
            <strong>Subscribe to access:</strong> R199/month · 6-month platform subscription
            (R1,194 prepaid via Paystack) is required for independent sales contractors.
            Owners and finance have free full access.
          </p>
          <Link
            href="/sales/subscribe"
            className="shrink-0 text-sm font-bold text-orange-300 hover:text-orange-200"
          >
            Subscribe now →
          </Link>
        </div>
      )}

      {/* KPI grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          icon={Wallet}
          label="Projected commission"
          value={formatZarPrecise(k.projectedCommission)}
          hint="Open pipeline + quotes"
          accent="amber"
        />
        <Kpi
          icon={Trophy}
          label="Earned commission"
          value={formatZarPrecise(k.earnedCommission)}
          hint={`Paid out ${formatZarPrecise(k.paidCommission)}`}
          accent="emerald"
        />
        <Kpi
          icon={TrendingUp}
          label="Weighted pipeline"
          value={formatZar(k.weightedPipeline)}
          hint={`${k.openPipeline} open opportunities`}
          accent="sky"
        />
        <Kpi
          icon={Users}
          label="My book"
          value={String(k.myCustomers)}
          hint={`${k.myLeads} open leads`}
          accent="violet"
        />
      </section>

      <section className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-white text-lg">Commission momentum</h2>
              <p className="text-xs text-slate-400">Last 6 months · projected vs earned</p>
            </div>
            <Link href="/sales/earnings" className="text-xs font-semibold text-amber-300">
              Earnings →
            </Link>
          </div>
          <div className="h-64 sm:h-72">
            <EarningsTrendChart
              labels={summary.pipelineByMonth.map((m) => m.month)}
              projected={summary.pipelineByMonth.map((m) => m.projected)}
              earned={summary.pipelineByMonth.map((m) => m.earned)}
            />
          </div>
        </div>

        <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <h2 className="font-bold text-white text-lg mb-1">What you could make</h2>
          <p className="text-xs text-slate-400 mb-4">
            Bigger deals → higher rate (3% → 5%)
          </p>
          <ul className="space-y-2.5">
            {summary.commissionPreview.samples.map((s) => (
              <li
                key={s.amount}
                className="flex items-center justify-between rounded-2xl bg-black/30 border border-white/5 px-3 py-2.5"
              >
                <span className="text-sm text-slate-300">{formatZar(s.amount)} deal</span>
                <span className="text-sm font-bold text-amber-300">
                  {formatZarPrecise(s.commission)}
                  <span className="text-[10px] font-medium text-slate-500 ml-1">
                    ~{s.effectiveRatePct}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/sales/agreement"
            className="mt-4 block text-center text-xs font-semibold text-slate-400 hover:text-amber-300"
          >
            View full commission schedule →
          </Link>
        </div>
      </section>

      {/* Quick modules */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            href: '/dashboard/customers/leads',
            icon: Target,
            title: 'Pipeline',
            desc: 'Leads & opportunities',
            meta: `${k.openPipeline} open`,
          },
          {
            href: '/dashboard/customers/quotes',
            icon: FileText,
            title: 'Quotes',
            desc: 'Preview commission live',
            meta: formatZar(k.quotesValue),
          },
          {
            href: '/dashboard/customers/onboard',
            icon: Users,
            title: 'Add customer',
            desc: 'Saved to company CRM',
            meta: `${k.myCustomers} accounts`,
          },
          {
            href: '/sales/forecast',
            icon: TrendingUp,
            title: '90-day forecast',
            desc: 'Weighted close plan',
            meta: 'Charts',
          },
        ].map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group rounded-3xl border border-white/10 bg-white/[0.03] p-5 hover:border-amber-400/40 hover:bg-amber-500/5 transition-all"
          >
            <m.icon className="w-6 h-6 text-amber-300 mb-3" />
            <div className="font-bold text-white group-hover:text-amber-100">{m.title}</div>
            <div className="text-xs text-slate-400 mt-1">{m.desc}</div>
            <div className="text-[11px] font-semibold text-slate-500 mt-3">{m.meta}</div>
          </Link>
        ))}
      </section>

      {/* Top deals */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-bold text-white">Highest-value opportunities</h2>
          <Link
            href="/dashboard/customers/leads"
            className="text-xs font-semibold text-amber-300"
          >
            Open pipeline →
          </Link>
        </div>
        {summary.topDeals.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No open deals yet — capture a lead to start earning.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {summary.topDeals.map((d) => (
              <li
                key={`${d.type}-${d.id}`}
                className="px-5 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="font-semibold text-slate-100">{d.name}</div>
                  <div className="text-[11px] text-slate-500 uppercase tracking-wide">
                    {d.type} · {d.stage}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-white">{formatZar(d.amount)}</div>
                  <div className="text-xs text-amber-300">
                    You could earn {formatZarPrecise(d.commission)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint: string;
  accent: 'amber' | 'emerald' | 'sky' | 'violet';
}) {
  const tones = {
    amber: 'from-amber-500/20 to-orange-500/5 text-amber-300',
    emerald: 'from-emerald-500/20 to-teal-500/5 text-emerald-300',
    sky: 'from-sky-500/20 to-cyan-500/5 text-sky-300',
    violet: 'from-violet-500/20 to-purple-500/5 text-violet-300',
  };
  return (
    <div
      className={`rounded-3xl border border-white/10 bg-gradient-to-br ${tones[accent]} p-4 sm:p-5`}
    >
      <Icon className="w-5 h-5 mb-3 opacity-90" />
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-xl sm:text-2xl font-black text-white mt-1 tracking-tight">{value}</div>
      <div className="text-[11px] text-slate-500 mt-1">{hint}</div>
    </div>
  );
}
