'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Leaf, Recycle, Loader2 } from 'lucide-react';
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

/** Live modules only — ComingSoon stubs are not linked from the hub. */
const MODULES: HubModule[] = [
  {
    href: '/dashboard/sustainability/carbon-tracking',
    icon: Leaf,
    code: '01',
    title: 'Carbon tracking (live)',
    desc: 'Estimated CO₂e from your distribution shipments.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/sustainability/reports',
    icon: BarChart3,
    code: '02',
    title: 'ESG packs (live)',
    desc: '90-day pack from carbon, OTIFEF, QA, HACCP — export JSON/print.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
];

export default function SustainabilityHub() {
  const companyId = getSelectedCompanyId();
  const [total, setTotal] = useState<string>('—');
  const [count, setCount] = useState<number | string>('—');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    fetch(`/api/sustainability/carbon?companyId=${companyId}`)
      .then((r) => r.json())
      .then((j) => {
        setTotal(j.total_label || '0 kg');
        setCount(j.shipment_count ?? 0);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [companyId]);

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard"
        backLabel="Dashboard"
        eyebrow="Sustainability"
        title="Impact"
        titleAccent="lite"
        description="Start with real shipment carbon estimates. Broader ESG modules stay on the roadmap so we never over-claim."
      />

      <HubHero
        pill="Live carbon from distribution"
        title="Measure what you already move."
        description="We score CO₂e from shipments you already record — transparent factors, no black box."
        stats={[
          {
            label: 'Estimated CO₂e',
            value: loading ? '…' : total,
            valueClass: 'text-emerald-600',
          },
          {
            label: 'Shipments',
            value: loading ? '…' : count,
            valueClass: 'text-[#00b4d8]',
          },
          { label: 'Method', value: 'Factors', valueClass: 'text-amber-600' },
        ]}
      />

      <HubTelemetryGrid>
        <TelemetryCard
          label="Carbon"
          value={loading ? '…' : String(total)}
          sub="From shipments"
          accent="emerald"
          icon={loading ? Loader2 : Leaf}
          href="/dashboard/sustainability/carbon-tracking"
        />
        <TelemetryCard
          label="Scope"
          value="Ops"
          sub="Transport estimate"
          accent="sky"
          icon={Recycle}
          href="/dashboard/sustainability/carbon-tracking"
        />
        <TelemetryCard
          label="ESG pack"
          value="Live"
          sub="Export JSON / print"
          accent="violet"
          icon={BarChart3}
          href="/dashboard/sustainability/reports"
        />
      </HubTelemetryGrid>

      <HubModuleGrid modules={MODULES} />

      <HubPrinciples
        items={[
          {
            title: 'Honest scope',
            body: 'Carbon lite uses mode factors × distance × weight. Label estimates clearly — never as a formal GHG inventory.',
          },
          {
            title: 'Reuse trade data',
            body: 'Distribution shipments already hold mode and routing signals — sustainability rides on ops, not a separate silo.',
          },
          {
            title: 'Expand carefully',
            body: 'Water, waste, and ethical modules stay roadmap until they have real APIs — same standard as quality.',
          },
        ]}
      />
    </RelationshipPage>
  );
}
