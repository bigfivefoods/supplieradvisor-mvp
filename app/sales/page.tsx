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
  GraduationCap,
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
        <Loader2 className="w-10 h-10 animate-spin text-[#00b4d8]" />
        <p className="text-neutral-600 text-sm">Loading your sales command centre…</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="max-w-lg mx-auto rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p className="font-semibold text-red-800 mb-2">Could not load portal</p>
        <p className="text-sm text-red-700 mb-4">{error}</p>
        <p className="text-xs text-neutral-600 mb-4">
          If tables are missing, run{' '}
          <code className="text-[#0077b6] bg-sky-50 px-1 rounded">
            20260710_sales_contractor_portal.sql
          </code>{' '}
          in Supabase.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="px-5 py-2.5 rounded-2xl bg-[#00b4d8] text-white text-sm font-semibold hover:bg-[#0096c7]"
        >
          Retry
        </button>
      </div>
    );
  }

  const k = summary.kpis;

  return (
    <div className="space-y-8">
      {/* Hero — light & bright */}
      <section className="relative overflow-hidden rounded-[2rem] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-amber-50 p-6 sm:p-10 shadow-sm">
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8]/10 border border-[#00b4d8]/25 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#0077b6] mb-4">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              {summary.roleLabel} · {summary.companyName}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-[1.1]">
              <span className="text-slate-900">Sell with confidence.</span>
              <span className="block text-[#00b4d8]">Track every rand you earn.</span>
            </h1>
            <p className="mt-4 text-neutral-600 max-w-xl text-sm sm:text-base leading-relaxed">
              Your independent contractor workspace for leads, customers, and closed deals. All CRM
              records belong to <strong className="text-slate-900">{summary.companyName}</strong> —
              you earn commission of{' '}
              <strong className="text-amber-700">4%</strong>,{' '}
              <strong className="text-amber-700">5%</strong> or{' '}
              <strong className="text-amber-700">6%</strong> — a super-link load (32 t) earns{' '}
              <strong className="text-amber-700">6%</strong>.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {!summary.agreementSigned && (
              <Link
                href="/sales/agreement"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white border border-neutral-200 text-slate-900 font-bold text-sm shadow-sm hover:border-[#00b4d8]"
              >
                Sign agreement first
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <Link
              href="/sales/pipeline"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#00b4d8] hover:bg-[#0096c7] text-white font-bold text-sm shadow-md"
            >
              Capture a lead
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {!summary.agreementSigned && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-amber-900">
            <strong>Action required:</strong> Sign the Independent Sales Contractor Agreement to
            unlock full portal tools and commission tracking.
          </p>
          <Link
            href="/sales/agreement"
            className="shrink-0 text-sm font-bold text-amber-800 hover:text-amber-950"
          >
            Review &amp; sign →
          </Link>
        </div>
      )}

      {!summary.subscriptionExempt &&
        summary.agreementSigned &&
        !summary.subscriptionActive && (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-orange-950">
              <strong>Subscribe to access:</strong> R199/month · 6-month platform subscription
              (R1,194 prepaid via Paystack) is required for independent sales contractors. Owners
              and finance have free full access.
            </p>
            <Link
              href="/sales/subscribe"
              className="shrink-0 text-sm font-bold text-orange-800 hover:text-orange-950"
            >
              Subscribe now →
            </Link>
          </div>
        )}

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
        <div className="lg:col-span-3 rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-slate-900 text-lg">Commission momentum</h2>
              <p className="text-xs text-neutral-600 mt-0.5">
                Last 6 months ·{' '}
                <span className="text-amber-700 font-semibold">projected</span>
                {' · '}
                <span className="text-emerald-700 font-semibold">earned</span>
              </p>
            </div>
            <Link
              href="/sales/earnings"
              className="text-xs font-semibold text-[#00b4d8] hover:text-[#0077b6]"
            >
              Earnings →
            </Link>
          </div>
          <div className="h-64 sm:h-72 rounded-2xl bg-slate-50 border border-neutral-100 p-2 sm:p-3">
            <EarningsTrendChart
              labels={summary.pipelineByMonth.map((m) => m.month)}
              projected={summary.pipelineByMonth.map((m) => m.projected)}
              earned={summary.pipelineByMonth.map((m) => m.earned)}
            />
          </div>
        </div>

        <div className="lg:col-span-2 rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-sm">
          <h2 className="font-bold text-slate-900 text-lg mb-1">What you could make</h2>
          <p className="text-xs text-neutral-600 mb-4">
            Bigger deals → higher rate{' '}
            <span className="text-amber-700 font-semibold">(4% · 5% · 6%)</span>
          </p>
          <ul className="space-y-2.5">
            {summary.commissionPreview.samples.map((s) => (
              <li
                key={s.amount}
                className="flex items-center justify-between rounded-2xl bg-amber-50 border border-amber-100 px-3 py-2.5"
              >
                <span className="text-sm text-slate-700 font-medium">
                  {formatZar(s.amount)} deal
                </span>
                <span className="text-sm font-bold text-amber-800">
                  {formatZarPrecise(s.commission)}
                  <span className="text-[10px] font-semibold text-neutral-500 ml-1">
                    ~{s.effectiveRatePct}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/sales/agreement"
            className="mt-4 block text-center text-xs font-semibold text-[#00b4d8] hover:text-[#0077b6]"
          >
            View full commission schedule →
          </Link>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {[
          {
            href: '/sales/pipeline',
            icon: Target,
            title: 'Pipeline',
            desc: 'Leads & opportunities',
            meta: `${k.openPipeline} open`,
          },
          {
            href: '/sales/quotes',
            icon: FileText,
            title: 'Quotes',
            desc: 'Preview commission live',
            meta: formatZar(k.quotesValue),
          },
          {
            href: '/sales/customers',
            icon: Users,
            title: 'Customers',
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
          {
            href: '/sales/leadership',
            icon: GraduationCap,
            title: 'Leadership',
            desc: 'Super-Cube® skills training',
            meta: 'Grow yourself',
          },
        ].map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group rounded-3xl border border-neutral-200 bg-white p-5 hover:border-[#00b4d8]/50 hover:shadow-md transition-all shadow-sm"
          >
            <m.icon className="w-6 h-6 text-[#00b4d8] mb-3" />
            <div className="font-bold text-slate-900 group-hover:text-[#0077b6]">{m.title}</div>
            <div className="text-xs text-neutral-600 mt-1">{m.desc}</div>
            <div className="text-[11px] font-semibold text-neutral-500 mt-3">{m.meta}</div>
          </Link>
        ))}
      </section>

      <section className="rounded-3xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
        <div className="px-5 sm:px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-slate-50/80">
          <h2 className="font-bold text-slate-900">Highest-value opportunities</h2>
          <Link
            href="/sales/pipeline"
            className="text-xs font-semibold text-[#00b4d8] hover:text-[#0077b6]"
          >
            Open pipeline →
          </Link>
        </div>
        {summary.topDeals.length === 0 ? (
          <p className="p-8 text-center text-sm text-neutral-500">
            No open deals yet — capture a lead to start earning.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {summary.topDeals.map((d) => (
              <li
                key={`${d.type}-${d.id}`}
                className="px-5 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50"
              >
                <div>
                  <div className="font-semibold text-slate-900">{d.name}</div>
                  <div className="text-[11px] text-neutral-500 uppercase tracking-wide font-medium">
                    {d.type} · {d.stage}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900">{formatZar(d.amount)}</div>
                  <div className="text-xs font-semibold text-amber-700">
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
    amber: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-700',
    emerald: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-700',
    sky: 'border-sky-200 bg-gradient-to-br from-sky-50 to-white text-sky-700',
    violet: 'border-violet-200 bg-gradient-to-br from-violet-50 to-white text-violet-700',
  };
  return (
    <div className={`rounded-3xl border p-4 sm:p-5 shadow-sm ${tones[accent]}`}>
      <Icon className="w-5 h-5 mb-3" />
      <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-600">{label}</div>
      <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 tracking-tight">{value}</div>
      <div className="text-[11px] text-neutral-600 mt-1">{hint}</div>
    </div>
  );
}
