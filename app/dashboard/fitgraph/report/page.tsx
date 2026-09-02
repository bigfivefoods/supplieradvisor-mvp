'use client';

import { useMemo } from 'react';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import ManagementReportPanel from '@/components/advisors/ManagementReportPanel';
import { ClassSubscriptionReport } from '@/components/fitness/ClassSubscriptionReport';
import { buildClassSubscriptionReport } from '@/lib/fitness/vuka-class-catalog';
import { SYS_COACH_TIME_CODE, SYS_PT_CODE } from '@/lib/fitness/session-times';
import { getCoachSpecialtyOptions } from '@/lib/fitness/fitgraph';

export default function FitReportPage() {
  const { store, loading } = useFitgraph();
  const dimensions = useMemo(() => {
    if (!store) return [];
    const hide = new Set([SYS_PT_CODE, SYS_COACH_TIME_CODE, 'SYS_COACH_AWAY']);
    const specialties = getCoachSpecialtyOptions(store);
    return [
      {
        key: 'coachId',
        label: 'Coach',
        options: (store.coaches || [])
          .filter((c) => c.active !== false)
          .map((c) => ({ id: c.id, label: c.name })),
      },
      {
        key: 'classTypeId',
        label: 'Class',
        options: (store.class_types || [])
          .filter((c) => c.active !== false && !hide.has(String(c.code || '')))
          .map((c) => ({ id: c.id, label: c.name })),
      },
      ...(specialties.length
        ? [
            {
              key: 'specialty',
              label: 'Specialty',
              options: specialties.map((s) => ({ id: s, label: s })),
            },
          ]
        : []),
      {
        key: 'sessionStatus',
        label: 'Session status',
        options: [
          { id: 'scheduled', label: 'Scheduled' },
          { id: 'completed', label: 'Completed' },
          { id: 'cancelled', label: 'Cancelled' },
          { id: 'full', label: 'Full' },
        ],
      },
    ];
  }, [store]);
  const subscriptions = useMemo(
    () => (store ? buildClassSubscriptionReport(store) : null),
    [store]
  );

  return (
    <FitgraphWorkbench
      title="Reports"
      titleAccent="slice & dice · pack · trends"
      description="One slicer at the top. Tabs of reports underneath — each list has a graph above it. Expand a section for the full table."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <ManagementReportPanel
            advisor="fitgraph"
            dimensions={dimensions}
            className="mb-2"
          />
          <ClassSubscriptionReport
            report={subscriptions}
            tone="owner"
            title="Money · class subscriptions"
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
