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
  ListTodo,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
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
  const { data, loading, error, reload, companyId, privyUserId } = useIntelligence();
  const insights = data?.insights || [];
  const conc = data?.concentration;
  const [domain, setDomain] = useState<string>('all');
  const [severity, setSeverity] = useState<string>('all');
  const [actingId, setActingId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [dueDate, setDueDate] = useState('');

  const runAction = async (ins: Insight, action: 'riad' | 'task' | 'collection') => {
    if (!companyId) {
      toast.error('Select a company');
      return;
    }
    setActingId(`${ins.id}-${action}`);
    try {
      const { apiJson } = await import('@/lib/client/api-fetch');
      const json = await apiJson<{ message?: string; href?: string }>(
        '/api/intelligence/actions',
        {
          method: 'POST',
          companyId,
          privyUserId,
          jsonBody: {
            action,
            owner_name: ownerName || null,
            due_date: dueDate || null,
            insight: {
              id: ins.id,
              title: ins.title,
              detail: ins.detail,
              domain: ins.domain,
              severity: ins.severity,
              href: ins.href,
            },
          },
        }
      );
      toast.success(json.message || 'Action created', {
        action: json.href
          ? {
              label: 'Open',
              onClick: () => {
                window.location.href = json.href!;
              },
            }
          : undefined,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setActingId(null);
    }
  };

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
        <input
          className="input !py-1.5 !text-xs w-auto min-w-[120px]"
          placeholder="Owner (actions)"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
        />
        <input
          className="input !py-1.5 !text-xs w-auto"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          title="Due date for RIAD / task"
        />
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
                  <InsightCard
                    key={ins.id}
                    ins={ins}
                    actingId={actingId}
                    onAction={runAction}
                  />
                ))}
              </div>
            </section>
          )}
          {positive.length > 0 && (
            <section>
              <SectionLabel>Strengths</SectionLabel>
              <div className="space-y-3">
                {positive.map((ins) => (
                  <InsightCard
                    key={ins.id}
                    ins={ins}
                    actingId={actingId}
                    onAction={runAction}
                  />
                ))}
              </div>
            </section>
          )}
          {info.length > 0 && (
            <section>
              <SectionLabel>Opportunities</SectionLabel>
              <div className="space-y-3">
                {info.map((ins) => (
                  <InsightCard
                    key={ins.id}
                    ins={ins}
                    actingId={actingId}
                    onAction={runAction}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <p className="mt-8 text-xs text-neutral-500">
        Engine: transparent business rules on live Supabase data. Set{' '}
        <strong>Owner</strong> and <strong>Due date</strong> above, then Log RIAD or
        Create task. Finance insights can open the Money hub for collections.
      </p>
    </IntelligencePage>
  );
}

function InsightCard({
  ins,
  actingId,
  onAction,
}: {
  ins: Insight;
  actingId: string | null;
  onAction: (ins: Insight, action: 'riad' | 'task' | 'collection') => void;
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

  const busy = actingId?.startsWith(ins.id);

  return (
    <div className={`rounded-3xl border px-5 py-4 ${border}`}>
      <div className="flex gap-4">
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
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={ins.href}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#00b4d8]"
            >
              {ins.action || 'Open module'}
              <ArrowRight className="w-3 h-3" />
            </Link>
            {ins.severity !== 'positive' && (
              <>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => onAction(ins, 'riad')}
                  className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                >
                  {actingId === `${ins.id}-riad` ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <ShieldAlert className="w-3 h-3" />
                  )}
                  Log RIAD
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => onAction(ins, 'task')}
                  className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100 disabled:opacity-50"
                >
                  {actingId === `${ins.id}-task` ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <ListTodo className="w-3 h-3" />
                  )}
                  Create task
                </button>
                {ins.domain === 'finance' && (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => onAction(ins, 'collection')}
                    className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Collections
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
