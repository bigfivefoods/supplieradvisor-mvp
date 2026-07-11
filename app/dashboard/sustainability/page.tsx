'use client';

import { BarChart3, Droplets, Leaf, Recycle, Wind } from 'lucide-react';
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

const MODULES: HubModule[] = [
  {
    href: '/dashboard/sustainability/carbon-tracking',
    icon: Leaf,
    code: '01',
    title: 'Carbon tracking',
    desc: 'Emissions visibility across the chain — scored on real trade flows.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/sustainability/water-waste',
    icon: Droplets,
    code: '02',
    title: 'Water & waste',
    desc: 'Resource intensity and reduction goals you can review like any KPI.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/sustainability/ethical-sourcing',
    icon: Wind,
    code: '03',
    title: 'Ethical sourcing',
    desc: 'Supplier ethics and SDG alignment tied to your network.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
  {
    href: '/dashboard/sustainability/green-certificates',
    icon: Recycle,
    code: '04',
    title: 'Green certificates',
    desc: 'Certificates and claims management — evidence over slogans.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/sustainability/regenerative-dashboard',
    icon: Leaf,
    code: '05',
    title: 'Regenerative dashboard',
    desc: 'Regenerative impact at a glance for leadership.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/sustainability/reports',
    icon: BarChart3,
    code: '06',
    title: 'Reports',
    desc: 'Stakeholder and compliance packs ready to share.',
    accent: 'from-rose-50 to-white border-rose-100',
  },
];

export default function SustainabilityHub() {
  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard"
        backLabel="Dashboard"
        eyebrow="ESG & regenerative"
        title="Sustainability"
        titleAccent="Command"
        description="Measure what matters — carbon, water, ethics, and regenerative outcomes tied to trade."
      />

      <HubHero
        pill="Live impact · measure → improve"
        title="Impact follows trade."
        description="Emissions and ethics are scored on real supplier and product flows — not detached marketing claims. Certificates and regenerative metrics must be verifiable."
        stats={[
          { label: 'Tracks', value: 6, valueClass: 'text-emerald-600' },
          { label: 'Focus', value: 'CO₂e', valueClass: 'text-[#00b4d8]' },
          { label: 'Proof', value: 'Certs', valueClass: 'text-amber-600' },
        ]}
      />

      <HubTelemetryGrid>
        <TelemetryCard
          label="Carbon"
          value="Track"
          sub="Chain emissions"
          accent="emerald"
          icon={Leaf}
          href="/dashboard/sustainability/carbon-tracking"
        />
        <TelemetryCard
          label="Water & waste"
          value="Goals"
          sub="Resource intensity"
          accent="sky"
          icon={Droplets}
          href="/dashboard/sustainability/water-waste"
        />
        <TelemetryCard
          label="Ethics"
          value="SDG"
          sub="Supplier alignment"
          accent="cyan"
          icon={Wind}
          href="/dashboard/sustainability/ethical-sourcing"
        />
        <TelemetryCard
          label="Certificates"
          value="Claims"
          sub="Evidence packs"
          accent="violet"
          icon={Recycle}
          href="/dashboard/sustainability/green-certificates"
        />
      </HubTelemetryGrid>

      <HubModuleGrid modules={MODULES} />

      <HubPrinciples
        items={[
          {
            title: 'Impact follows trade',
            body: 'Emissions and ethics are scored on real supplier and product flows — not detached marketing claims.',
          },
          {
            title: 'Measure to improve',
            body: 'Carbon, water, and waste only change when they are visible, owned, and reviewed like any KPI.',
          },
          {
            title: 'Evidence over slogans',
            body: 'Certificates, ethical sourcing, and regenerative metrics must be verifiable and shareable with partners.',
          },
        ]}
      />
    </RelationshipPage>
  );
}
