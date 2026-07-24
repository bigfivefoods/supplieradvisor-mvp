'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Clock,
  Columns3,
  FolderTree,
  Globe2,
  Layers,
  Loader2,
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
    href: '/dashboard/projects/portfolio',
    icon: FolderTree,
    code: '01',
    title: 'Portfolio',
    desc: 'All initiatives — methodology, health, programme, budget.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/projects/programmes',
    icon: Layers,
    code: '02',
    title: 'Programmes',
    desc: 'Aggregate projects under strategic programmes (EPM roll-up).',
    accent: 'from-indigo-50 to-white border-indigo-100',
  },
  {
    href: '/dashboard/projects/dmaic',
    icon: Workflow,
    code: '03',
    title: 'DMAIC board',
    desc: 'Lean Six Sigma gates — drag projects Define → Control.',
    accent: 'from-fuchsia-50 to-white border-fuchsia-100',
  },
  {
    href: '/dashboard/projects/sdg',
    icon: Globe2,
    code: '04',
    title: 'SDG portfolio',
    desc: 'All 17 UN goals with targets and impact projects.',
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
  {
    href: '/dashboard/projects/kanban-boards',
    icon: Columns3,
    code: '05',
    title: 'Kanban',
    desc: 'Task board — backlog to done.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/projects/milestones',
    icon: Target,
    code: '06',
    title: 'Milestones',
    desc: 'Stage gates and completion tracking.',
    accent: 'from-teal-50 to-white border-teal-100',
  },
  {
    href: '/dashboard/projects/risk-register',
    icon: AlertTriangle,
    code: '07',
    title: 'RIAD register',
    desc: 'Risks, issues, actions, decisions per project.',
    accent: 'from-rose-50 to-white border-rose-100',
  },
  {
    href: '/dashboard/projects/timesheets',
    icon: Clock,
    code: '08',
    title: 'Timesheets',
    desc: 'Hours against projects and tasks.',
    accent: 'from-amber-50 to-white border-amber-100',
  },
  {
    href: '/dashboard/projects/reporting',
    icon: BarChart3,
    code: '09',
    title: 'Reporting',
    desc: 'Portfolio summary for leadership and PMO.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
];

type Summary = {
  total: number;
  active: number;
  completed: number;
  dmaic?: number;
  sdg?: number;
  withProgramme?: number;
};

export default function ProjectsHub() {
  const companyId = getSelectedCompanyId();
  const [summary, setSummary] = useState<Summary | null>(null);
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
        eyebrow="Enterprise project management"
        title="Projects"
        titleAccent="PMO"
        description="World-class EPM: programmes, Lean Six Sigma DMAIC, UN SDG impact, RIAD governance, and delivery boards — one company scope."
      />

      <HubHero
        pill="EPM · PMO suite"
        title="Outcomes over activity."
        description="Programme roll-ups, DMAIC stage-gates you can drag, SDG coverage across all 17 goals, and a living RIAD log. Structure without enterprise bloat."
        stats={[
          {
            label: 'Projects',
            value: loading ? '…' : summary?.total ?? 0,
            valueClass: 'text-violet-600',
          },
          {
            label: 'DMAIC',
            value: loading ? '…' : summary?.dmaic ?? 0,
            valueClass: 'text-fuchsia-600',
          },
          {
            label: 'SDG',
            value: loading ? '…' : summary?.sdg ?? 0,
            valueClass: 'text-emerald-600',
          },
          {
            label: 'In programmes',
            value: loading ? '…' : summary?.withProgramme ?? 0,
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
          label="Programmes"
          value="EPM"
          sub="Strategic roll-up"
          accent="sky"
          icon={Layers}
          href="/dashboard/projects/programmes"
        />
        <TelemetryCard
          label="DMAIC"
          value={loading ? '…' : String(summary?.dmaic ?? 0)}
          sub="Stage-gate board"
          accent="violet"
          icon={Workflow}
          href="/dashboard/projects/dmaic"
        />
        <TelemetryCard
          label="SDG"
          value={loading ? '…' : String(summary?.sdg ?? 0)}
          sub="Impact projects"
          accent="emerald"
          icon={Globe2}
          href="/dashboard/projects/sdg"
        />
        <TelemetryCard
          label="RIAD"
          value="Log"
          sub="R · I · A · D"
          accent="amber"
          icon={AlertTriangle}
          href="/dashboard/projects/risk-register"
        />
        <TelemetryCard
          label="Kanban"
          value="Board"
          sub="Tasks by column"
          accent="sky"
          icon={Columns3}
          href="/dashboard/projects/kanban-boards"
        />
      </HubTelemetryGrid>

      <HubModuleGrid modules={MODULES} />

      <HubPrinciples
        items={[
          {
            title: 'Programme → project → gate',
            body: 'Strategic programmes aggregate DMAIC, SDG, and standard work. Health and budget roll up for PMO review.',
          },
          {
            title: 'DMAIC you can feel',
            body: 'Drag process-improvement projects across Define, Measure, Analyze, Improve, Control. Gate checklists and transition audit trail included.',
          },
          {
            title: 'SDG by design',
            body: 'Every impact project maps to a UN goal and official targets — coverage visible across all 17.',
          },
          {
            title: 'RIAD everywhere',
            body: 'Risks, issues, actions, and decisions stay project-scoped and visible on boards and the register.',
          },
          {
            title: 'Migration first',
            body: 'Apply 20260711_haccp_esg_pm_suite.sql then 20260723_pm_epm_pmo.sql so pm_programmes, gates, and project RIADs exist.',
          },
        ]}
      />
    </RelationshipPage>
  );
}
