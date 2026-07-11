'use client';

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
    href: '/dashboard/projects/portfolio',
    icon: FolderTree,
    code: '01',
    title: 'Portfolio',
    desc: 'All initiatives in one portfolio view — outcomes over activity.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/projects/kanban-boards',
    icon: Columns3,
    code: '02',
    title: 'Kanban',
    desc: 'Board-based execution for teams with clear WIP limits.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/projects/gantt',
    icon: Calendar,
    code: '03',
    title: 'Gantt',
    desc: 'Timeline planning and dependencies across work packages.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
  {
    href: '/dashboard/projects/resource-allocation',
    icon: Users,
    code: '04',
    title: 'Resources',
    desc: 'Who is on what — capacity awareness for leadership.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/projects/milestones',
    icon: Target,
    code: '05',
    title: 'Milestones',
    desc: 'Gate reviews and on-chain checkpoints that define done.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/projects/budgeting',
    icon: DollarSign,
    code: '06',
    title: 'Budgeting',
    desc: 'Cost control against plan with variance visibility.',
    accent: 'from-rose-50 to-white border-rose-100',
  },
  {
    href: '/dashboard/projects/risk-register',
    icon: AlertTriangle,
    code: '07',
    title: 'Risk register',
    desc: 'Risks, owners, and mitigations — silent risk is unmanaged risk.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/projects/timesheets',
    icon: Clock,
    code: '08',
    title: 'Timesheets',
    desc: 'Time capture against work packages for audit-friendly progress.',
    accent: 'from-slate-50 to-white border-slate-200',
  },
  {
    href: '/dashboard/projects/reporting',
    icon: BarChart3,
    code: '09',
    title: 'Reporting',
    desc: 'Status packs for stakeholders — membership-scoped truth.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
];

export default function ProjectsHub() {
  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard"
        backLabel="Dashboard"
        eyebrow="Project delivery"
        title="Projects"
        titleAccent="Command"
        description="Plan and deliver initiatives with milestones, risk, and audit-friendly status — same light chrome as Operations."
      />

      <HubHero
        pill="Live PMO · portfolio → report"
        title="Outcomes over activity."
        description="Milestones force clarity on what done means. Every material risk has an owner. Status, budget, and time stay membership-scoped so leadership can trust the narrative."
        stats={[
          { label: 'Views', value: 9, valueClass: 'text-[#00b4d8]' },
          { label: 'Focus', value: 'Done', valueClass: 'text-emerald-600' },
          { label: 'Risk', value: 'Owned', valueClass: 'text-amber-600' },
        ]}
      />

      <HubTelemetryGrid>
        <TelemetryCard
          label="Portfolio"
          value="All"
          sub="Initiatives overview"
          accent="violet"
          icon={FolderTree}
          href="/dashboard/projects/portfolio"
        />
        <TelemetryCard
          label="Execution"
          value="Board"
          sub="Kanban & Gantt"
          accent="sky"
          icon={Columns3}
          href="/dashboard/projects/kanban-boards"
        />
        <TelemetryCard
          label="Milestones"
          value="Gates"
          sub="Define done"
          accent="emerald"
          icon={Target}
          href="/dashboard/projects/milestones"
        />
        <TelemetryCard
          label="Risk"
          value="Register"
          sub="Owned mitigations"
          accent="amber"
          icon={AlertTriangle}
          href="/dashboard/projects/risk-register"
        />
      </HubTelemetryGrid>

      <HubModuleGrid modules={MODULES} />

      <HubPrinciples
        items={[
          {
            title: 'Outcomes over activity',
            body: 'Milestones and portfolio views force clarity on what done means — not just busy boards.',
          },
          {
            title: 'Risk is owned',
            body: 'Every material risk has an owner and a mitigation. Silent risk is unmanaged risk.',
          },
          {
            title: 'Audit-friendly progress',
            body: 'Status, budget, and time capture stay membership-scoped so leadership can trust the narrative.',
          },
        ]}
      />
    </RelationshipPage>
  );
}
