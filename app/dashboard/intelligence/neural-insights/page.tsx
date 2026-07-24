'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Brain,
  Filter,
} from 'lucide-react';
import {
  CompanyRequired,
  IntelligenceHeader,
  IntelligencePage,
} from '@/components/intelligence/IntelligenceShell';
import { Panel, SectionLabel } from '@/components/relationship/RelationshipChrome';
import { useIntelligence } from '@/lib/intelligence/useIntelligence';
import type { Insight, InsightSeverity } from '@/lib/intelligence/engine';

const DOMAINS = [
  'all',
  'network',
  'supply',
  'demand',
  'finance',
  'ops',
  'quality',
  'esg',
  'projects',
] as const;

const SEVERITIES: Array<InsightSeverity | 'all'> = [
  'all',
  'critical',
  'warning',
  'positive',
  'info',
];

export default function InsightsPage() {
  return (
    <CompanyRequired>
      <InsightsInner />
    </CompanyRequired>
  );
}

function InsightsInner() {
  const { data, loading, error, reload } = useIntelligence();
  const insights = data?.insights || [];
  const conc = data?.concentration;
  const [domain, setDomain] = useState<string>('all');
  const [severity, setSeverity] = useState<string>('all');

  const filtered = useMemo(() => {
    return insights.filter((i) => {
      if (domain !== 'all' && i.domain !== domain) return false;
      if (severity !== 'all' && i.severity !== severity) return false;
      return true;
    });
  }, [insights, domain, severity]);

  const counts = useMemo(() => {
    const c = { critical: 0, warning: 0, positive: 0, info: 0 };
    for (const i of insights) c[i.severity] = (c[i.severity] || 0) + 1;
    return c;
  }, [insights]);

  if (loading && !data) {
    return (
      <IntelligencePage>
        <div className="py-28 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      </IntelligencePage>
    );
  }

  const critical = filtered.filter(
    (i) => i.severity === 'critical' || i.severity === 'warning'
  );
  const positive = filtered.filter((i) => i.severity === 'positive');
  const info = filtered.filter((i) => i.severity === 'info');

  return (
    <IntelligencePage>
      <IntelligenceHeader
        title="Business"
        titleAccent="insights"
        description="Live rule-based intelligence from network, SRM, CRM, inventory, finance, quality, ESG, and projects — transparent thresholds with a clear action for each signal."
        action={
          <button
            type="button"
            onClick={() => void reload()}
            className="btn-secondary !py-2.5 !px-4 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />{' '}
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
          <p className="text-xs mt-1 opacity-80">
            Ensure you are signed in and a company is selected. Auth cookies or
            Bearer token required in production.
          </p>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(
          [
            ['Critical / warn', counts.critical + counts.warning, 'text-amber-700'],
            ['Strengths', counts.positive, 'text-emerald-700'],
            ['Opportunities', counts.info, 'text-sky-700'],
            ['Total signals', insights.length, 'text-slate-900'],
          ] as const
        ).map(([label, v, cls]) => (
          <div key={label} className="bg-white border rounded-2xl p-3">
            <div className="text-[10px] font-bold uppercase text-neutral-400">
              {label}
            </div>
            <div className={`text-2xl font-black ${cls}`}>{v}</div>
          </div>
        ))}
      </div>

      {conc && conc.supplierCount > 0 && (
        <div className="mb-6 rounded-2xl border border-neutral-200 bg-white px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Supply concentration
            </div>
            <div className="text-sm text-slate-800 mt-0.5">
              Top supplier share of PO spend:{' '}
              <strong
                className={
                  conc.topSupplierShare >= 60 ? 'text-amber-700' : 'text-emerald-700'
                }
              >
                {conc.topSupplierShare}%
              </strong>{' '}
              across {conc.supplierCount} suppliers
            </div>
          </div>
          <Link
            href="/dashboard/suppliers/network"
            className="text-xs font-semibold text-[#00b4d8]"
          >
            Review book →
          </Link>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <Filter className="w-3.5 h-3.5 text-neutral-400" />
        <select
          className="input !py-1.5 !text-xs w-auto"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        >
          {DOMAINS.map((d) => (
            <option key={d} value={d}>
              {d === 'all' ? 'All domains' : d}
            </option>
          ))}
        </select>
        <select
          className="input !py-1.5 !text-xs w-auto"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All severities' : s}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-500">
          Showing {filtered.length} of {insights.length}
        </span>
      </div>

      {!insights.length ? (
        <Panel>
          <div className="p-16 text-center">
            <Brain className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-800">
              All quiet on the intelligence front
            </p>
            <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">
              Connect companies, raise POs, quote customers, log stock and ESG —
              insights appear as your operating graph grows.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link
                href="/dashboard/connections/discover"
                className="btn-primary !py-2 !px-4 text-sm"
              >
                Discover partners
              </Link>
              <Link
                href="/dashboard/intelligence/simulation-lab"
                className="btn-secondary !py-2 !px-4 text-sm"
              >
                Try simulation lab
              </Link>
            </div>
          </div>
        </Panel>
      ) : filtered.length === 0 ? (
        <Panel>
          <div className="p-10 text-center text-sm text-neutral-500">
            No insights match these filters.
          </div>
        </Panel>
      ) : (
        <div className="space-y-8">
          {critical.length > 0 && (
            <section>
              <SectionLabel>Needs attention</SectionLabel>
              <div className="space-y-3">
                {critical.map((ins) => (
                  <InsightCard key={ins.id} ins={ins} />
                ))}
              </div>
            </section>
          )}
          {positive.length > 0 && (
            <section>
              <SectionLabel>Strengths</SectionLabel>
              <div className="space-y-3">
                {positive.map((ins) => (
                  <InsightCard key={ins.id} ins={ins} />
                ))}
              </div>
            </section>
          )}
          {info.length > 0 && (
            <section>
              <SectionLabel>Opportunities</SectionLabel>
              <div className="space-y-3">
                {info.map((ins) => (
                  <InsightCard key={ins.id} ins={ins} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <p className="mt-8 text-xs text-neutral-500">
        Engine: transparent business rules on live Supabase data. Not a neural
        network — every threshold is inspectable in code (
        <code className="font-mono">lib/intelligence/engine.ts</code>).
      </p>
    </IntelligencePage>
  );
}

function InsightCard({ ins }: { ins: Insight }) {
  const border =
    ins.severity === 'critical'
      ? 'border-red-200 bg-red-50/50'
      : ins.severity === 'warning'
        ? 'border-amber-200 bg-amber-50/40'
        : ins.severity === 'positive'
          ? 'border-emerald-200 bg-emerald-50/40'
          : 'border-neutral-200 bg-white';
  const Icon =
    ins.severity === 'positive'
      ? CheckCircle2
      : ins.severity === 'info'
        ? Info
        : AlertTriangle;
  const iconCls =
    ins.severity === 'positive'
      ? 'text-emerald-600'
      : ins.severity === 'info'
        ? 'text-sky-600'
        : ins.severity === 'critical'
          ? 'text-red-600'
          : 'text-amber-600';

  return (
    <Link
      href={ins.href}
      className={`flex gap-4 rounded-3xl border px-5 py-4 hover:shadow-md transition-all group ${border}`}
    >
      <div className={`mt-0.5 ${iconCls}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            {ins.domain}
          </span>
          <h3 className="font-semibold text-slate-900">{ins.title}</h3>
          {ins.metric && (
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white border border-neutral-200 text-slate-700 tabular-nums">
              {ins.metric}
            </span>
          )}
        </div>
        <p className="text-sm text-neutral-600 mt-1 leading-relaxed">{ins.detail}</p>
        {ins.action && (
          <span className="inline-flex mt-2 text-xs font-bold text-[#00b4d8]">
            {ins.action} →
          </span>
        )}
      </div>
      <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-[#00b4d8] shrink-0 mt-1" />
    </Link>
  );
}
