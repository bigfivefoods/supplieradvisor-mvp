'use client';

import {
  LoadingBlock,
  PhysiographWorkbench,
  usePhysiograph,
} from '@/components/clinic/PhysiographWorkbench';
import { StatRow } from '@/components/clinic/PhysioForm';
import { AdvisorAnnouncementsDesk } from '@/components/services/AdvisorAnnouncementsDesk';

export default function PhysiographCommsPage() {
  const { store, loading, saving, post } = usePhysiograph();
  const rows = store?.announcements || [];

  return (
    <PhysiographWorkbench
      title="Comms"
      titleAccent="all patients"
      description="Push notices, ads and offers to every patient on the clinic portal."
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
            accentClass="border-teal-200"
            buttonClass="bg-teal-600 hover:bg-teal-700 text-white"
          />
        </div>
      )}
    </PhysiographWorkbench>
  );
}
