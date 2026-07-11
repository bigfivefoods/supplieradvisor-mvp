'use client';

import {
  AlertTriangle,
  BarChart3,
  FileCheck,
  Search,
  ShieldCheck,
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

const MODULES: HubModule[] = [
  {
    href: '/dashboard/quality/haccp',
    icon: ShieldCheck,
    code: '01',
    title: 'HACCP',
    desc: 'Hazard analysis and critical control points — prevent defects at source.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/quality/inspections',
    icon: Search,
    code: '02',
    title: 'Inspections',
    desc: 'Incoming and in-process quality checks with release gates.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/quality/traceability',
    icon: BarChart3,
    code: '03',
    title: 'Traceability',
    desc: 'Lot pedigree and chain of custody for every unit.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
  {
    href: '/dashboard/quality/traceability-graph',
    icon: Workflow,
    code: '04',
    title: 'Traceability graph',
    desc: 'Visual graph of material flow across the chain.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/quality/recall-simulator',
    icon: AlertTriangle,
    code: '05',
    title: 'Recall simulator',
    desc: 'Practice and plan recall response before you need it.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/quality/regulatory-reports',
    icon: FileCheck,
    code: '06',
    title: 'Regulatory reports',
    desc: 'Compliance packs and exportable reports for auditors.',
    accent: 'from-rose-50 to-white border-rose-100',
  },
];

export default function QualityHub() {
  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard"
        backLabel="Dashboard"
        eyebrow="Quality & food safety"
        title="Quality"
        titleAccent="Command"
        description="Protect the brand — inspections, HACCP, lot traceability, and recall readiness on a light control tower."
      />

      <HubHero
        pill="Live QA · prevent → release"
        title="Trust travels with the goods."
        description="HACCP and critical controls reduce defect rate at source. Pedigree turns a recall from panic into a precise, time-bound action. Open quality points block ship until cleared."
        stats={[
          { label: 'Modules', value: 6, valueClass: 'text-[#00b4d8]' },
          { label: 'Gate', value: 'Hold', valueClass: 'text-emerald-600' },
          { label: 'Focus', value: 'Lots', valueClass: 'text-amber-600' },
        ]}
      />

      <HubTelemetryGrid>
        <TelemetryCard
          label="HACCP"
          value="Plans"
          sub="Critical control points"
          accent="emerald"
          icon={ShieldCheck}
          href="/dashboard/quality/haccp"
        />
        <TelemetryCard
          label="Inspections"
          value="Checks"
          sub="Incoming & in-process"
          accent="sky"
          icon={Search}
          href="/dashboard/quality/inspections"
        />
        <TelemetryCard
          label="Traceability"
          value="Lots"
          sub="Chain of custody"
          accent="cyan"
          icon={BarChart3}
          href="/dashboard/quality/traceability"
        />
        <TelemetryCard
          label="Recall ready"
          value="Sim"
          sub="Practice response"
          accent="amber"
          icon={AlertTriangle}
          href="/dashboard/quality/recall-simulator"
        />
      </HubTelemetryGrid>

      <HubModuleGrid modules={MODULES} />

      <HubPrinciples
        items={[
          {
            title: 'Prevent before you inspect',
            body: 'HACCP and critical controls reduce defect rate at source — inspection confirms, it does not invent quality.',
          },
          {
            title: 'Trace every lot',
            body: 'Pedigree and chain of custody turn a recall from panic into a precise, time-bound action.',
          },
          {
            title: 'Hold the release gate',
            body: 'Open quality points block ship and put-away until cleared — trust travels with the goods.',
          },
        ]}
      />
    </RelationshipPage>
  );
}
