'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
    dmaic?: number;
    sdg?: number;
    withProgramme?: number;
  } | null>(null);
  const [hours, setHours] = useState(0);
  const [riadOpen, setRiadOpen] = useState(0);
  const [riadTotal, setRiadTotal] = useState(0);
  const [programmes, setProgrammes] = useState(0);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    Promise.all([
      fetch(`/api/projects?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/projects/timesheets?companyId=${companyId}`).then((r) =>
        r.json()
      ),
      fetch(`/api/projects/riads?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/projects/programmes?companyId=${companyId}`).then((r) =>
        r.json()
      ),
    ])
      .then(([p, t, r, prog]) => {
        setSummary(p.summary || null);
        setHours(t.total_hours || 0);
        setRiadOpen(r.summary?.open ?? 0);
        setRiadTotal(r.summary?.total ?? (r.riads || []).length);
        setProgrammes(prog.summary?.total ?? (prog.programmes || []).length);
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/projects"
        backLabel="Projects"
        eyebrow="PMO · Leadership pack"
        title="Project"
        titleAccent="reporting"
        description="Steering-committee snapshot — portfolio, DMAIC, SDG, programmes, hours, and open RIADs."
      />

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total projects', v: summary?.total ?? 0 },
              { label: 'Active', v: summary?.active ?? 0 },
              { label: 'Completed', v: summary?.completed ?? 0 },
              { label: 'On hold', v: summary?.on_hold ?? 0 },
              { label: 'DMAIC / hybrid', v: summary?.dmaic ?? 0 },
              { label: 'SDG / hybrid', v: summary?.sdg ?? 0 },
              { label: 'In programmes', v: summary?.withProgramme ?? 0 },
              { label: 'Programmes', v: programmes },
              { label: 'Hours logged', v: hours },
              { label: 'RIAD open / total', v: `${riadOpen}/${riadTotal}` },
            ].map((c) => (
              <div key={c.label} className="bg-white border rounded-3xl p-5">
                <div className="text-2xl font-black tracking-tight sa-metric-value">
                  {c.v}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">{c.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link
              href="/dashboard/projects/dmaic"
              className="font-semibold text-[#00b4d8]"
            >
              DMAIC board →
            </Link>
            <Link
              href="/dashboard/projects/sdg"
              className="font-semibold text-emerald-700"
            >
              SDG portfolio →
            </Link>
            <Link
              href="/dashboard/projects/programmes"
              className="font-semibold text-violet-700"
            >
              Programmes →
            </Link>
            <Link
              href="/dashboard/projects/risk-register"
              className="font-semibold text-amber-700"
            >
              RIAD register →
            </Link>
          </div>
        </>
      )}
    </RelationshipPage>
  );
}
