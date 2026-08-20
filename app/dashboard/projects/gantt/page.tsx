'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import { WaterfallGantt, type GanttGroup } from '@/components/projects/WaterfallGantt';
import { dateRangeOverlaps } from '@/lib/projects/waterfall';

type Project = {
  id: number;
  name: string;
  status?: string;
  start_date?: string | null;
  target_date?: string | null;
  partner_name?: string | null;
  progress?: number | null;
};

type Task = {
  id: number;
  project_id: number;
  title: string;
  start_date?: string | null;
  due_date?: string | null;
  column_key?: string;
  phase_key?: string | null;
};

export default function GanttPage() {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('full_fy')
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) qs.set('privyUserId', privyUserId);
      const [pRes, tRes] = await Promise.all([
        fetch(`/api/projects?${qs}`),
        fetch(`/api/projects/tasks?${qs}`),
      ]);
      const pj = await pRes.json();
      const tj = await tRes.json();
      setProjects(pj.projects || []);
      setTasks(tj.tasks || []);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups: GanttGroup[] = useMemo(() => {
    return projects
      .filter((p) =>
        dateRangeOverlaps(p.start_date, p.target_date, period.from, period.to)
      )
      .map((p) => {
        const mine = tasks.filter((t) => t.project_id === p.id);
        const bars = mine.length
          ? mine.map((t) => ({
              id: String(t.id),
              label: t.title,
              start: String(t.start_date || p.start_date || period.from).slice(0, 10),
              end: String(t.due_date || p.target_date || period.to).slice(0, 10),
              tone:
                t.column_key === 'done'
                  ? ('emerald' as const)
                  : t.column_key === 'in_progress'
                    ? ('cyan' as const)
                    : ('violet' as const),
            }))
          : [
              {
                id: `p-${p.id}`,
                label: p.name,
                start: String(p.start_date || period.from).slice(0, 10),
                end: String(p.target_date || period.to).slice(0, 10),
                tone: 'cyan' as const,
                progress: Number(p.progress || 0),
              },
            ];
        return {
          id: String(p.id),
          title: p.name,
          subtitle: [p.partner_name, p.status].filter(Boolean).join(' · '),
          bars,
        };
      });
  }, [projects, tasks, period.from, period.to]);

  return (
    <RelationshipPage>
      <RelationshipHeader
        band
        backHref="/dashboard/projects"
        backLabel="Projects overview"
        eyebrow="Enterprise project management"
        title="Waterfall"
        titleAccent="Gantt"
        description="Slice the period, then read every initiative as a sequential waterfall — same chart language as customer and supplier joint projects."
      />
      <PeriodSlicer value={period} onChange={setPeriod} className="mb-5" />
      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <WaterfallGantt groups={groups} from={period.from} to={period.to} />
      )}
    </RelationshipPage>
  );
}
