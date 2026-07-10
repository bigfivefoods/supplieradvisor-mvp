'use client';

import ModuleHub from '@/components/ModuleHub';
import HubCard from '@/components/HubCard';
import {
  AlertTriangle,
  BarChart3,
  FileCheck,
  Search,
  ShieldCheck,
  Workflow,
} from 'lucide-react';

const NODES = [
  {
    name: 'HACCP',
    href: '/dashboard/quality/haccp',
    icon: ShieldCheck,
    desc: 'Hazard analysis and critical control points.',
  },
  {
    name: 'Inspections',
    href: '/dashboard/quality/inspections',
    icon: Search,
    desc: 'Incoming and in-process quality checks.',
  },
  {
    name: 'Traceability',
    href: '/dashboard/quality/traceability',
    icon: BarChart3,
    desc: 'Lot pedigree and chain of custody.',
  },
  {
    name: 'Traceability graph',
    href: '/dashboard/quality/traceability-graph',
    icon: Workflow,
    desc: 'Visual graph of material flow.',
  },
  {
    name: 'Recall simulator',
    href: '/dashboard/quality/recall-simulator',
    icon: AlertTriangle,
    desc: 'Practice and plan recall response.',
  },
  {
    name: 'Regulatory reports',
    href: '/dashboard/quality/regulatory-reports',
    icon: FileCheck,
    desc: 'Compliance packs and exportable reports.',
  },
] as const;

export default function QualityHub() {
  return (
    <ModuleHub
      title="Quality"
      titleAccent="& trust"
      description="Protect the brand — inspections, HACCP, lot traceability, and recall readiness on a light workspace."
    >
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {NODES.map((n) => (
          <HubCard
            key={n.href}
            title={n.name}
            description={n.desc}
            href={n.href}
            icon={n.icon}
          />
        ))}
      </div>
    </ModuleHub>
  );
}
