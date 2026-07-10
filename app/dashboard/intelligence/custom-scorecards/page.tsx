'use client';

import Link from 'next/link';
import { Loader2, RefreshCw, Target, ArrowRight } from 'lucide-react';
import {
  CompanyRequired,
  IntelligenceHeader,
  IntelligencePage,
} from '@/components/intelligence/IntelligenceShell';
import {
  MetricHero,
  Panel,
  SectionLabel,
} from '@/components/relationship/RelationshipChrome';
import { useIntelligence } from '@/lib/intelligence/useIntelligence';

export default function ScorecardsPage() {
  return (
    <CompanyRequired>
      <ScorecardsInner />
    </CompanyRequired>
  );
}

function ScorecardsInner() {
  const { data, loading, error, reload } = useIntelligence();
  const cards = data?.scorecards || [];
  const overall = data?.health?.overall ?? 0;

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
        title="Performance"
        titleAccent="scorecards"
        description="Composite 0–100 scores computed from live Supabase metrics across network, supply chain, CRM demand, finance control, and operations. No manual KPI entry required."
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

      <div className="mb-10 max-w-md">
        <MetricHero
          label="Enterprise score"
          value={String(overall)}
          unit="/100"
          icon={Target}
          hint="Average of the five domain scorecards below"
        />
      </div>

      <SectionLabel>Domain scorecards</SectionLabel>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
        {cards.map((c) => (
          <Link
            key={c.id}
            href={c.href}
            className="group rounded-3xl border border-neutral-200 bg-white p-6 hover:border-[#00b4d8] hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  {c.id}
                </div>
                <h3 className="font-bold text-lg text-slate-800 mt-0.5">{c.label}</h3>
              </div>
              <span
                className={`text-3xl font-black tabular-nums tracking-tighter ${
                  c.score >= 75
                    ? 'text-emerald-600'
                    : c.score >= 55
                      ? 'text-[#0077b6]'
                      : c.score >= 35
                        ? 'text-amber-600'
                        : 'text-neutral-500'
                }`}
              >
                {c.score}
              </span>
            </div>
            <div className="h-2 rounded-full bg-neutral-100 overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all ${
                  c.score >= 75
                    ? 'bg-emerald-500'
                    : c.score >= 55
                      ? 'bg-[#00b4d8]'
                      : c.score >= 35
                        ? 'bg-amber-500'
                        : 'bg-neutral-400'
                }`}
                style={{ width: `${Math.min(100, c.score)}%` }}
              />
            </div>
            <p className="text-xs text-neutral-500 mb-3">{c.detail}</p>
            <div className="flex items-center gap-1 text-xs font-semibold text-[#00b4d8]">
              Open module <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        ))}
      </div>

      <Panel title="How scores are built">
        <ul className="px-5 py-5 text-sm text-neutral-600 space-y-2 list-disc pl-10">
          <li>
            <strong className="text-slate-800">Network</strong> — accepted edges, pending load,
            pricing agreements, on-chain wallet readiness.
          </li>
          <li>
            <strong className="text-slate-800">Supply</strong> — portfolio OTIFEF, trust averages,
            connected and verified suppliers.
          </li>
          <li>
            <strong className="text-slate-800">Demand</strong> — active customers, open opportunities,
            quote win rate, pipeline value.
          </li>
          <li>
            <strong className="text-slate-800">Finance</strong> — open AR/AP volume and balance
            pressure from the accounting ledger.
          </li>
          <li>
            <strong className="text-slate-800">Operations</strong> — catalogue depth, multi-currency
            SKUs, low-stock pressure, units on hand.
          </li>
        </ul>
      </Panel>
    </IntelligencePage>
  );
}
