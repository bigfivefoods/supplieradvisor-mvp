'use client';

import ModuleHub from '@/components/ModuleHub';
import HubCard from '@/components/HubCard';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Clock,
  Columns3,
  DollarSign,
  FolderTree,
  Target,
  Users,
} from 'lucide-react';

const NODES = [
  {
    name: 'Portfolio',
    href: '/dashboard/projects/portfolio',
    icon: FolderTree,
    desc: 'All initiatives in one portfolio view.',
  },
  {
    name: 'Kanban',
    href: '/dashboard/projects/kanban-boards',
    icon: Columns3,
    desc: 'Board-based execution for teams.',
  },
  {
    name: 'Gantt',
    href: '/dashboard/projects/gantt',
    icon: Calendar,
    desc: 'Timeline planning and dependencies.',
  },
  {
    name: 'Resources',
    href: '/dashboard/projects/resource-allocation',
    icon: Users,
    desc: 'Who is on what — capacity awareness.',
  },
  {
    name: 'Milestones',
    href: '/dashboard/projects/milestones',
    icon: Target,
    desc: 'Gate reviews and on-chain checkpoints.',
  },
  {
    name: 'Budgeting',
    href: '/dashboard/projects/budgeting',
    icon: DollarSign,
    desc: 'Cost control against plan.',
  },
  {
    name: 'Risk register',
    href: '/dashboard/projects/risk-register',
    icon: AlertTriangle,
    desc: 'Risks, owners, and mitigations.',
  },
  {
    name: 'Timesheets',
    href: '/dashboard/projects/timesheets',
    icon: Clock,
    desc: 'Time capture against work packages.',
  },
  {
    name: 'Reporting',
    href: '/dashboard/projects/reporting',
    icon: BarChart3,
    desc: 'Status packs for stakeholders.',
  },
] as const;

export default function ProjectsHub() {
  return (
    <ModuleHub
      title="Projects"
      titleAccent="delivery"
      description="Plan and deliver initiatives with milestones, risk, and audit-friendly status — same light chrome as Operations."
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
