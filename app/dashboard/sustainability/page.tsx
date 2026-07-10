'use client';

import ModuleHub from '@/components/ModuleHub';
import HubCard from '@/components/HubCard';
import { BarChart3, Droplets, Leaf, Recycle, Wind } from 'lucide-react';

const NODES = [
  {
    name: 'Carbon tracking',
    href: '/dashboard/sustainability/carbon-tracking',
    icon: Leaf,
    desc: 'Emissions visibility across the chain.',
  },
  {
    name: 'Water & waste',
    href: '/dashboard/sustainability/water-waste',
    icon: Droplets,
    desc: 'Resource intensity and reduction goals.',
  },
  {
    name: 'Ethical sourcing',
    href: '/dashboard/sustainability/ethical-sourcing',
    icon: Wind,
    desc: 'Supplier ethics and SDG alignment.',
  },
  {
    name: 'Green certificates',
    href: '/dashboard/sustainability/green-certificates',
    icon: Recycle,
    desc: 'Certificates and claims management.',
  },
  {
    name: 'Regenerative dashboard',
    href: '/dashboard/sustainability/regenerative-dashboard',
    icon: Leaf,
    desc: 'Regenerative impact at a glance.',
  },
  {
    name: 'Reports',
    href: '/dashboard/sustainability/reports',
    icon: BarChart3,
    desc: 'Stakeholder and compliance packs.',
  },
] as const;

export default function SustainabilityHub() {
  return (
    <ModuleHub
      title="Sustainability"
      titleAccent="impact"
      description="Measure what matters — carbon, water, ethics, and regenerative outcomes tied to trade."
      principles={[
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
