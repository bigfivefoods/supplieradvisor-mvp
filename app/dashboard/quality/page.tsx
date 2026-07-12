'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  FileCheck,
  Search,
  ShieldCheck,
  Workflow,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import {
  HubHero,
  HubModuleGrid,
  HubPrinciples,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';

const MODULES: HubModule[] = [
  {
    href: '/dashboard/sheq',
    icon: ShieldCheck,
    code: '00',
    title: 'SHEQ command',
    desc: 'ISO 45001 incidents, hazards, NCR & CAPA — failed inspections auto-raise NCR.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/quality/inspections',
    icon: Search,
    code: '01',
    title: 'Inspections',
    desc: 'Live QA checks with pass/fail release gates and lot holds.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/quality/traceability',
    icon: BarChart3,
    code: '02',
    title: 'Traceability',
    desc: 'Inventory lots with quality hold flags for recall readiness.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
  {
    href: '/dashboard/quality/haccp',
    icon: ShieldCheck,
    code: '03',
    title: 'HACCP (live)',
    desc: 'Plans, CCPs, monitoring logs, and breach tracking.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/quality/traceability-graph',
    icon: Workflow,
    code: '04',
    title: 'Traceability graph (live)',
    desc: 'Product → lot → movement → warehouse + QA/HACCP nodes.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/quality/recall-simulator',
    icon: AlertTriangle,
    code: '05',
    title: 'Recall simulator (live)',
    desc: 'Search a lot — inventory, QA holds, HACCP breaches.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/quality/regulatory-reports',
    icon: FileCheck,
    code: '06',
    title: 'Regulatory reports (live)',
    desc: 'Export JSON/print pack for auditors from live QA data.',
    accent: 'from-rose-50 to-white border-rose-100',
  },
];

export default function QualityHub() {
  const companyId = getSelectedCompanyId();
  const [summary, setSummary] = useState<{
    open: number;
    passed: number;
    failed: number;
    inventory_lots: number;
    migration_required?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    fetch(`/api/quality/summary?companyId=${companyId}`)
      .then((r) => r.json())
      .then((j) => setSummary(j))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [companyId]);

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard"
        backLabel="Dashboard"
        eyebrow="Quality & food safety"
        title="Quality"
        titleAccent="Command"
        description="Live inspections, HACCP, traceability graph, recall drill, and regulatory packs — end-to-end release gates."
      />

      {/* Hero food-safety story — one continuous path */}
      <div className="mb-8 rounded-3xl border border-cyan-100 bg-white p-5 sm:p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400 mb-1">
          Food-safety path
        </p>
        <h2 className="text-lg font-black text-slate-900 mb-1">
          Receive → inspect → hold/clear → ship → recall pack
        </h2>
        <p className="text-sm text-neutral-500 mb-4 max-w-2xl">
          Follow these five workbenches for a defensible release story. Open or failed inspections
          block warehouse ship until you clear them.
        </p>
        <div className="grid sm:grid-cols-5 gap-2">
          {[
            {
              n: '01',
              t: 'Receive',
              d: 'Scan goods in',
              href: '/dashboard/inventory/scan',
            },
            {
              n: '02',
              t: 'Inspect',
              d: 'Lot + pass/fail',
              href: '/dashboard/quality/inspections',
            },
            {
              n: '03',
              t: 'Trace',
              d: 'Pedigree graph',
              href: '/dashboard/quality/traceability-graph',
            },
            {
              n: '04',
              t: 'Ship',
              d: 'Hold-aware transfer',
              href: '/dashboard/inventory/stock-transfers',
            },
            {
              n: '05',
              t: 'Recall pack',
              d: 'Export for auditors',
              href: '/dashboard/quality/regulatory-reports',
            },
          ].map((s) => (
            <Link
              key={s.n}
              href={s.href}
              className="group rounded-2xl border border-neutral-200 bg-gradient-to-br from-sky-50/80 to-white px-3 py-3 hover:border-[#00b4d8]/50 hover:shadow-sm transition-all"
            >
              <div className="text-[10px] font-black text-[#00b4d8] mb-1">{s.n}</div>
              <div className="text-sm font-bold text-slate-800 group-hover:text-[#0077b6] flex items-center gap-1">
                {s.t}
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">{s.d}</div>
            </Link>
          ))}
        </div>
      </div>

      <HubHero
        pill="Live QA · inspections + lots"
        title="Trust travels with the goods."
        description="Open quality points block mental ship readiness until cleared. Link lots on every inspection for instant pedigree."
        stats={[
          {
            label: 'Open holds',
            value: loading ? '…' : summary?.open ?? 0,
            valueClass: 'text-amber-600',
          },
          {
            label: 'Passed',
            value: loading ? '…' : summary?.passed ?? 0,
            valueClass: 'text-emerald-600',
          },
          {
            label: 'Lots',
            value: loading ? '…' : summary?.inventory_lots ?? 0,
            valueClass: 'text-[#00b4d8]',
          },
        ]}
      />

      {summary?.migration_required && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Apply migration <code className="text-xs">20260711_quality_inspections.sql</code> in
          Supabase to enable inspections.
        </div>
      )}

      <HubTelemetryGrid>
        <TelemetryCard
          label="Inspections"
          value={loading ? '…' : String(summary?.open ?? 0)}
          sub="Open holds"
          accent="amber"
          icon={loading ? Loader2 : Search}
          href="/dashboard/quality/inspections"
        />
        <TelemetryCard
          label="Passed"
          value={loading ? '…' : String(summary?.passed ?? 0)}
          sub="Released lots"
          accent="emerald"
          icon={ShieldCheck}
          href="/dashboard/quality/inspections"
        />
        <TelemetryCard
          label="Failed"
          value={loading ? '…' : String(summary?.failed ?? 0)}
          sub="Blocked"
          accent="rose"
          icon={AlertTriangle}
          href="/dashboard/quality/inspections"
        />
        <TelemetryCard
          label="Traceability"
          value={loading ? '…' : String(summary?.inventory_lots ?? 0)}
          sub="Inventory lots"
          accent="cyan"
          icon={BarChart3}
          href="/dashboard/quality/traceability"
        />
      </HubTelemetryGrid>

      <HubModuleGrid modules={MODULES} />

      <HubPrinciples
        items={[
          {
            title: 'Inspect at the gate',
            body: 'Incoming checks with lot numbers turn quality into operational data — not a paper trail after the fact.',
          },
          {
            title: 'Hold until clear',
            body: 'Failed or open inspections flag lots on the traceability board so warehouse and sales see the same truth.',
          },
          {
            title: 'HACCP is operational',
            body: 'Plans, CCPs, and monitoring logs sit next to inspections — breaches are visible, not buried in PDFs.',
          },
        ]}
      />
    </RelationshipPage>
  );
}
