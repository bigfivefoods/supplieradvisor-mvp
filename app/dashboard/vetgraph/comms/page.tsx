'use client';

import {
  LoadingBlock,
  VetgraphWorkbench,
  useVetgraph,
} from '@/components/clinic/VetgraphWorkbench';
import { StatRow } from '@/components/clinic/VetForm';
import { AdvisorAnnouncementsDesk } from '@/components/services/AdvisorAnnouncementsDesk';

export default function VetgraphCommsPage() {
  const { store, loading, saving, post } = useVetgraph();
  const rows = store?.announcements || [];

  return (
    <VetgraphWorkbench
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
            accentClass="border-emerald-200"
            buttonClass="bg-emerald-600 hover:bg-emerald-700 text-white"
          />
        </div>
      )}
    </VetgraphWorkbench>
  );
}
