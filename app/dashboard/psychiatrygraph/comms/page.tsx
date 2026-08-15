'use client';

import {
  LoadingBlock,
  PsychiatrygraphWorkbench,
  usePsychiatrygraph,
} from '@/components/clinic/PsychiatrygraphWorkbench';
import { StatRow } from '@/components/clinic/PsychiatryForm';
import { AdvisorAnnouncementsDesk } from '@/components/services/AdvisorAnnouncementsDesk';

export default function PsychiatrygraphCommsPage() {
  const { store, loading, saving, post } = usePsychiatrygraph();
  const rows = store?.announcements || [];

  return (
    <PsychiatrygraphWorkbench
      title="Comms"
      titleAccent="all patients"
      description="Push notices, ads and offers to every patient on the practice portal."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              {
                label: 'Live',
                value: rows.filter((r) => r.status === 'published').length,
              },
              {
                label: 'Patients',
                value: (store.patients || []).length,
              },
            ]}
          />
          <AdvisorAnnouncementsDesk
            items={store.announcements}
            post={post}
            saving={saving}
            accentClass="border-rose-200"
            buttonClass="bg-indigo-600 hover:bg-indigo-700 text-white"
          />
        </div>
      )}
    </PsychiatrygraphWorkbench>
  );
}
