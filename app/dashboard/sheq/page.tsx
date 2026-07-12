'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ClipboardList,
  HardHat,
  Loader2,
  ShieldAlert,
  ArrowRight,
  FileWarning,
  Wrench,
  Search,
} from 'lucide-react';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import {
  HubHero,
  HubModuleGrid,
  HubTelemetryGrid,
  TelemetryCard,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';

type Summary = {
  migration_required?: boolean;
  warning?: string;
  counts?: {
    incidentsOpen: number;
    ncrsOpen: number;
    capasOpen: number;
    hazardsOpen: number;
    highRisks: number;
    qaHolds: number;
  };
  recentIncidents?: Array<{ id: number; title: string; status: string; severity: string }>;
  recentNcrs?: Array<{ id: number; title: string; status: string; lot_number?: string }>;
  recentCapas?: Array<{ id: number; title: string; status: string }>;
};

const MODULES: HubModule[] = [
  {
    href: '/dashboard/sheq/incidents',
    icon: HardHat,
    code: '01',
    title: 'Incidents',
    desc: 'ISO 45001 — near-misses, injuries, investigation & close-out.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/sheq/hazards',
    icon: ShieldAlert,
    code: '02',
    title: 'Hazards & risks',
    desc: 'HIRARC lite — likelihood × severity, controls, residual risk.',
    accent: 'from-orange-50 to-white border-orange-100',
  },
  {
    href: '/dashboard/sheq/ncrs',
    icon: FileWarning,
    code: '03',
    title: 'NCR',
    desc: 'Nonconformances from QA fails, incidents, audits, or manual raise.',
    accent: 'from-rose-50 to-white border-rose-100',
  },
  {
    href: '/dashboard/sheq/capas',
    icon: Wrench,
    code: '04',
    title: 'CAPA',
    desc: 'Corrective & preventive actions with effectiveness check.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/quality/inspections',
    icon: Search,
    code: '05',
    title: 'QA inspections',
    desc: 'Food safety inspections — failed checks auto-raise NCR + CAPA.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/quality',
    icon: ClipboardList,
    code: '06',
    title: 'Quality & HACCP',
    desc: 'Traceability, HACCP plans, recall simulator, regulatory packs.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
];

export default function SheqHubPage() {
  const companyId = getSelectedCompanyId();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/sheq/summary?companyId=${companyId}`);
      const data = await res.json();
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const c = summary?.counts;

  return (
    <RelationshipPage>
      <RelationshipHeader
        eyebrow="Safety · Health · Environment · Quality"
        title="SHEQ"
        titleAccent="Command"
        description="ISO 45001-aligned incidents & hazards, ISO 9001-style NCR/CAPA, wired to food-safety inspections and lot holds."
      />

      {summary?.migration_required && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Migration required:</strong>{' '}
          {summary.warning ||
            'Run supabase/migrations/20260712_sheq_module.sql on production.'}
        </div>
      )}

      <HubHero
        pill="SHEQ live"
        title="One control tower for people, product, and process risk"
        description="Report incidents → assess hazards → raise NCR → close CAPA. Failed QA inspections open NCR automatically."
      />

      <HubTelemetryGrid>
        <TelemetryCard
          label="Open incidents"
          value={loading ? '—' : String(c?.incidentsOpen ?? 0)}
          sub="ISO 45001"
          accent="amber"
        />
        <TelemetryCard
          label="Open NCRs"
          value={loading ? '—' : String(c?.ncrsOpen ?? 0)}
          sub="Nonconformance"
          accent="rose"
        />
        <TelemetryCard
          label="Open CAPAs"
          value={loading ? '—' : String(c?.capasOpen ?? 0)}
          sub="Actions"
          accent="violet"
        />
        <TelemetryCard
          label="QA holds"
          value={loading ? '—' : String(c?.qaHolds ?? 0)}
          sub="Lots blocked"
          accent="sky"
        />
      </HubTelemetryGrid>

      <HubModuleGrid modules={MODULES} />

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <RecentCard
          title="Recent incidents"
          empty="No incidents yet"
          loading={loading}
          href="/dashboard/sheq/incidents"
          items={(summary?.recentIncidents || []).map((r) => ({
            id: r.id,
            label: r.title,
            meta: `${r.severity} · ${r.status}`,
          }))}
        />
        <RecentCard
          title="Recent NCRs"
          empty="No NCRs yet"
          loading={loading}
          href="/dashboard/sheq/ncrs"
          items={(summary?.recentNcrs || []).map((r) => ({
            id: r.id,
            label: r.title,
            meta: r.lot_number ? `Lot ${r.lot_number} · ${r.status}` : r.status,
          }))}
        />
        <RecentCard
          title="Recent CAPAs"
          empty="No CAPAs yet"
          loading={loading}
          href="/dashboard/sheq/capas"
          items={(summary?.recentCapas || []).map((r) => ({
            id: r.id,
            label: r.title,
            meta: r.status,
          }))}
        />
      </div>

      <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-white p-6 text-sm text-slate-600">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-slate-900">How this maps to standards</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>
                <strong>ISO 45001</strong> — incidents, hazard/risk assessment, improvement
                via CAPA
              </li>
              <li>
                <strong>ISO 9001</strong> — NCR + CAPA + effectiveness verification
              </li>
              <li>
                <strong>Food safety</strong> — QA inspections & HACCP remain under Quality;
                fails auto-raise NCR
              </li>
            </ul>
          </div>
        </div>
      </div>
    </RelationshipPage>
  );
}

function RecentCard({
  title,
  empty,
  loading,
  href,
  items,
}: {
  title: string;
  empty: string;
  loading: boolean;
  href: string;
  items: Array<{ id: number; label: string; meta: string }>;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <Link
          href={href}
          className="text-xs font-semibold text-[#00b4d8] inline-flex items-center gap-1 hover:underline"
        >
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {loading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#00b4d8]" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500 py-4">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <div className="text-sm font-medium text-slate-900 line-clamp-1">
                {it.label}
              </div>
              <div className="text-[11px] text-slate-500 capitalize">{it.meta}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
