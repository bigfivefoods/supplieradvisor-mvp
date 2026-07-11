'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Clock,
  Columns3,
  FolderTree,
  Target,
  Loader2,
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
    href: '/dashboard/projects/portfolio',
    icon: FolderTree,
    code: '01',
    title: 'Portfolio',
    desc: 'All initiatives with health, budget, and progress.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/projects/kanban-boards',
    icon: Columns3,
    code: '02',
    title: 'Kanban',
    desc: 'Task board — backlog to done.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/projects/milestones',
    icon: Target,
    code: '03',
    title: 'Milestones',
    desc: 'Stage gates and completion tracking.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/projects/timesheets',
    icon: Clock,
    code: '04',
    title: 'Timesheets',
    desc: 'Hours against projects and tasks.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/projects/risk-register',
    icon: AlertTriangle,
    code: '05',
    title: 'Risk register',
    desc: 'Likelihood × impact with mitigations.',
    accent: 'from-rose-50 to-white border-rose-100',
  },
  {
    href: '/dashboard/projects/reporting',
    icon: BarChart3,
    code: '06',
    title: 'Reporting',
    desc: 'Portfolio summary for leadership.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
];

export default function ProjectsHub() {
  const companyId = getSelectedCompanyId();
  const [summary, setSummary] = useState<{
    total: number;
    active: number;
    completed: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    fetch(`/api/projects?companyId=${companyId}`)
      .then((r) => r.json())
      .then((j) => setSummary(j.summary || null))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [companyId]);

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard"
        backLabel="Dashboard"
        eyebrow="Project management"
        title="Projects"
        titleAccent="suite"
        description="Portfolio, kanban, milestones, timesheets, and risk — live on Supabase when migration is applied."
      />

      <HubHero
        pill="Live PM suite"
        title="Outcomes over activity."
        description="One portfolio for strategic work. Tasks move on the board. Milestones gate progress. Hours and risks stay visible."
        stats={[
          {
            label: 'Projects',
            value: loading ? '…' : summary?.total ?? 0,
            valueClass: 'text-violet-600',
          },
          {
            label: 'Active',
            value: loading ? '…' : summary?.active ?? 0,
            valueClass: 'text-emerald-600',
          },
          {
            label: 'Done',
            value: loading ? '…' : summary?.completed ?? 0,
            valueClass: 'text-[#00b4d8]',
          },
        ]}
      />

      <HubTelemetryGrid>
        <TelemetryCard
          label="Portfolio"
          value={loading ? '…' : String(summary?.total ?? 0)}
          sub="All initiatives"
          accent="violet"
          icon={loading ? Loader2 : FolderTree}
          href="/dashboard/projects/portfolio"
        />
        <TelemetryCard
          label="Kanban"
          value="Board"
          sub="Tasks by column"
          accent="sky"
          icon={Columns3}
          href="/dashboard/projects/kanban-boards"
        />
        <TelemetryCard
          label="Milestones"
          value="Gates"
          sub="Stage completion"
          accent="emerald"
          icon={Target}
          href="/dashboard/projects/milestones"
        />
        <TelemetryCard
          label="Risks"
          value="Register"
          sub="Likelihood × impact"
          accent="amber"
          icon={AlertTriangle}
          href="/dashboard/projects/risk-register"
        />
      </HubTelemetryGrid>

      <HubModuleGrid modules={MODULES} />

      <HubPrinciples
        items={[
          {
            title: 'One source of truth',
            body: 'Projects, tasks, milestones, hours, and risks share the same company scope and APIs.',
          },
          {
            title: 'Lightweight by design',
            body: 'Enough structure for ops and transformation work — without enterprise PM bloat.',
          },
          {
            title: 'Migration first',
            body: 'Apply 20260711_haccp_esg_pm_suite.sql so pm_* tables exist in Supabase.',
          },
        ]}
      />
    </RelationshipPage>
  );
}
