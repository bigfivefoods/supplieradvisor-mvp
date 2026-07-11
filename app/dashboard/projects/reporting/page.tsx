'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';

export default function ProjectReportingPage() {
  const companyId = getSelectedCompanyId();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{
    total: number;
    active: number;
    completed: number;
    on_hold: number;
  } | null>(null);
  const [hours, setHours] = useState(0);
  const [risks, setRisks] = useState(0);
  const [openRisks, setOpenRisks] = useState(0);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    Promise.all([
      fetch(`/api/projects?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/projects/timesheets?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/projects/risks?companyId=${companyId}`).then((r) => r.json()),
    ])
      .then(([p, t, r]) => {
        setSummary(p.summary || null);
        setHours(t.total_hours || 0);
        const risksList = r.risks || [];
        setRisks(risksList.length);
        setOpenRisks(risksList.filter((x: { status?: string }) => x.status !== 'closed').length);
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/projects"
        backLabel="Projects"
        eyebrow="Leadership pack"
        title="Project"
        titleAccent="reporting"
        description="Snapshot for steering committees — counts from live PM data."
      />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total projects', v: summary?.total ?? 0 },
            { label: 'Active', v: summary?.active ?? 0 },
            { label: 'Completed', v: summary?.completed ?? 0 },
            { label: 'On hold', v: summary?.on_hold ?? 0 },
            { label: 'Hours logged', v: hours },
            { label: 'Risks (open)', v: `${openRisks}/${risks}` },
          ].map((c) => (
            <div key={c.label} className="bg-white border rounded-3xl p-5">
              <div className="text-2xl font-black tracking-tight">{c.v}</div>
              <div className="text-[11px] text-neutral-500 mt-1">{c.label}</div>
            </div>
          ))}
        </div>
      )}
    </RelationshipPage>
  );
}
