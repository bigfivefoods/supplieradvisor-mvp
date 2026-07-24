'use client';

import { useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  Droplets,
  Globe2,
  Leaf,
  Loader2,
  Scale,
  Sparkles,
  Target,
  Workflow,
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
    href: '/dashboard/sustainability/carbon-tracking',
    icon: Leaf,
    code: '01',
    title: 'GHG inventory',
    desc: 'Scopes 1–3 ledger + logistics estimates (GHG Protocol-aligned).',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/sustainability/water-waste',
    icon: Droplets,
    code: '02',
    title: 'Water · waste · energy',
    desc: 'Resource stewardship metrics, diversion and renewable share.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/sustainability/regenerative-dashboard',
    icon: Target,
    code: '03',
    title: 'Targets & pathway',
    desc: 'Reduction targets, progress vs baseline, regenerative KPIs.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/sustainability/green-certificates',
    icon: Award,
    code: '04',
    title: 'Certificates',
    desc: 'ISO, organic, Fairtrade and more — with expiry alerts.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/sustainability/ethical-sourcing',
    icon: Scale,
    code: '05',
    title: 'Ethical sourcing',
    desc: 'Supplier integrity, OTIFEF, docs, QA and settle proof.',
    accent: 'from-teal-50 to-white border-teal-100',
  },
  {
    href: '/dashboard/sustainability/initiatives',
    icon: Workflow,
    code: '06',
    title: 'Initiatives',
    desc: 'E·S·G action plans with progress, SDG and project links.',
    accent: 'from-fuchsia-50 to-white border-fuchsia-100',
  },
  {
    href: '/dashboard/sustainability/materiality',
    icon: Sparkles,
    code: '07',
    title: 'Materiality',
    desc: 'Double-materiality lite — impact vs financial scores.',
    accent: 'from-rose-50 to-white border-rose-100',
  },
  {
    href: '/dashboard/projects/sdg',
    icon: Globe2,
    code: '08',
    title: 'SDG portfolio',
    desc: 'UN SDG projects across all 17 goals (Projects module).',
    accent: 'from-lime-50 to-white border-lime-100',
  },
  {
    href: '/dashboard/sustainability/reports',
    icon: BarChart3,
    code: '09',
    title: 'ESG packs',
    desc: 'Board-ready pack: inventory, resources, social, governance.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
];

type Summary = {
  inventory?: { total_label?: string; entry_count?: number; by_scope?: Record<string, number> };
  targets?: { total?: number; active?: number };
  resources?: { diversion_pct?: number | null; renewable_pct?: number | null; water_withdrawal?: number };
  certificates?: { total?: number; expiring_soon?: number };
  initiatives?: { total?: number; in_progress?: number };
  materiality?: { total?: number; critical?: number };
  warning?: string | null;
  hint?: string;
};

export default function SustainabilityHub() {
  const companyId = getSelectedCompanyId();
  const [s, setS] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    fetch(`/api/sustainability/summary?companyId=${companyId}`)
      .then((r) => r.json())
      .then((j) => setS(j))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [companyId]);

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard"
        backLabel="Dashboard"
        eyebrow="ESG · Impact system"
        title="Sustainability"
        titleAccent="suite"
        description="World-class operational ESG: GHG Protocol inventory, resource stewardship, reduction targets, certificates, materiality, initiatives, and board packs — honest estimates, never over-claim."
      />

      <HubHero
        pill="Measure · Reduce · Prove"
        title="Impact you can run."
        description="One system for climate inventory, water/waste/energy, ethical supply, and disclosure-ready packs. Built for operators — aligned with GHG Protocol and double-materiality thinking."
        stats={[
          {
            label: 'GHG inventory',
            value: loading ? '…' : s?.inventory?.total_label || '0 kg',
            valueClass: 'text-emerald-600',
          },
          {
            label: 'Active targets',
            value: loading ? '…' : s?.targets?.active ?? 0,
            valueClass: 'text-violet-600',
          },
          {
            label: 'Initiatives',
            value: loading ? '…' : s?.initiatives?.total ?? 0,
            valueClass: 'text-[#00b4d8]',
          },
        ]}
      />

      {s?.warning && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Apply migration for full ESG tables.
          <span className="mt-1 block font-mono text-xs">
            {s.hint || 'supabase/migrations/20260724_sustainability_esg_suite.sql'}
          </span>
        </div>
      )}

      <HubTelemetryGrid>
        <TelemetryCard
          label="Scope 1+2+3"
          value={loading ? '…' : s?.inventory?.total_label || '—'}
          sub={`${s?.inventory?.entry_count ?? 0} ledger lines`}
          accent="emerald"
          icon={loading ? Loader2 : Leaf}
          href="/dashboard/sustainability/carbon-tracking"
        />
        <TelemetryCard
          label="Diversion"
          value={
            loading
              ? '…'
              : s?.resources?.diversion_pct != null
                ? `${s.resources.diversion_pct}%`
                : '—'
          }
          sub="Waste recycled share"
          accent="sky"
          icon={Droplets}
          href="/dashboard/sustainability/water-waste"
        />
        <TelemetryCard
          label="Renewable"
          value={
            loading
              ? '…'
              : s?.resources?.renewable_pct != null
                ? `${s.resources.renewable_pct}%`
                : '—'
          }
          sub="Electricity mix"
          accent="violet"
          icon={Sparkles}
          href="/dashboard/sustainability/water-waste"
        />
        <TelemetryCard
          label="Certificates"
          value={loading ? '…' : String(s?.certificates?.total ?? 0)}
          sub={
            (s?.certificates?.expiring_soon || 0) > 0
              ? `${s?.certificates?.expiring_soon} expiring ≤90d`
              : 'On file'
          }
          accent="amber"
          icon={Award}
          href="/dashboard/sustainability/green-certificates"
        />
        <TelemetryCard
          label="Materiality"
          value={loading ? '…' : String(s?.materiality?.total ?? 0)}
          sub={`${s?.materiality?.critical ?? 0} critical topics`}
          accent="rose"
          icon={Scale}
          href="/dashboard/sustainability/materiality"
        />
        <TelemetryCard
          label="ESG pack"
          value="Live"
          sub="Export JSON / print"
          accent="cyan"
          icon={BarChart3}
          href="/dashboard/sustainability/reports"
        />
      </HubTelemetryGrid>

      <HubModuleGrid modules={MODULES} />

      <HubPrinciples
        items={[
          {
            title: 'GHG Protocol first',
            body: 'Inventory by Scope 1, 2, and 3 with activity data, factors, and data-quality labels. Logistics estimates sit beside the ledger — never mixed without disclosure.',
          },
          {
            title: 'Reduce with targets',
            body: 'Baseline → horizon pathways for climate, water, waste, and renewable share. Progress calculated from live inventory and resource data.',
          },
          {
            title: 'Double materiality lite',
            body: 'Score topics on impact and financial materiality. Seed a standard set, prioritise critical themes for board attention.',
          },
          {
            title: 'Prove with packs',
            body: 'ESG operating packs pull inventory, resources, suppliers, QA, HACCP, certificates, initiatives, and materiality into exportable evidence.',
          },
          {
            title: 'Honest scope',
            body: 'Default factors are order-of-magnitude. Label estimates clearly. This is operational ESG — not a substitute for a formal audit opinion.',
          },
        ]}
      />
    </RelationshipPage>
  );
}
