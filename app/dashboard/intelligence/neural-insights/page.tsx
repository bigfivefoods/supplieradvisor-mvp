'use client';

import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Brain,
} from 'lucide-react';
import {
  CompanyRequired,
  IntelligenceHeader,
  IntelligencePage,
} from '@/components/intelligence/IntelligenceShell';
import { Panel, SectionLabel } from '@/components/relationship/RelationshipChrome';
import { useIntelligence } from '@/lib/intelligence/useIntelligence';

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

  if (loading) {
    return (
      <IntelligencePage>
        <div className="py-28 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      </IntelligencePage>
    );
  }

  const critical = insights.filter((i) => i.severity === 'critical' || i.severity === 'warning');
  const positive = insights.filter((i) => i.severity === 'positive');
  const info = insights.filter((i) => i.severity === 'info');

  return (
    <IntelligencePage>
      <IntelligenceHeader
        title="Business"
        titleAccent="insights"
        description="Rule-based intelligence from live network, SRM, CRM, inventory, and accounting data — transparent thresholds, not a black-box neural net. Each insight links to the module where you can act."
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
          <Link href="/dashboard/suppliers/network" className="text-xs font-semibold text-[#00b4d8]">
            Review book →
          </Link>
        </div>
      )}

      {!insights.length ? (
        <Panel>
          <div className="p-16 text-center">
            <Brain className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-800">All quiet on the intelligence front</p>
            <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">
              Connect companies, raise POs, and quote customers — insights appear as your graph grows.
            </p>
          </div>
        </Panel>
      ) : (
        <div className="space-y-8">
          {critical.length > 0 && (
            <section>
              <SectionLabel>Needs attention</SectionLabel>
              <div className="space-y-3">
                {critical.map((ins) => (
                  <InsightCard key={ins.id} {...ins} />
                ))}
              </div>
            </section>
          )}
          {positive.length > 0 && (
            <section>
              <SectionLabel>Strengths</SectionLabel>
              <div className="space-y-3">
                {positive.map((ins) => (
                  <InsightCard key={ins.id} {...ins} />
                ))}
              </div>
            </section>
          )}
          {info.length > 0 && (
            <section>
              <SectionLabel>Opportunities</SectionLabel>
              <div className="space-y-3">
                {info.map((ins) => (
                  <InsightCard key={ins.id} {...ins} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </IntelligencePage>
  );
}

function InsightCard(ins: {
  severity: string;
  title: string;
  detail: string;
  href: string;
  metric?: string;
}) {
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
          <h3 className="font-semibold text-slate-900">{ins.title}</h3>
          {ins.metric && (
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white border border-neutral-200 text-slate-700 tabular-nums">
              {ins.metric}
            </span>
          )}
        </div>
        <p className="text-sm text-neutral-600 mt-1 leading-relaxed">{ins.detail}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-[#00b4d8] shrink-0 mt-1" />
    </Link>
  );
}
