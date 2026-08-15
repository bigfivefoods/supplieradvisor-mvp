'use client';

import {
  DentalgraphWorkbench,
  LoadingBlock,
  useDentalgraph,
} from '@/components/dental/DentalgraphWorkbench';
import { StatRow } from '@/components/dental/DentalForm';
import { AdvisorAnnouncementsDesk } from '@/components/services/AdvisorAnnouncementsDesk';

export default function DentalgraphCommsPage() {
  const { store, loading, saving, post } = useDentalgraph();
  const rows = store?.announcements || [];

  return (
    <DentalgraphWorkbench
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
            accentClass="border-sky-200"
            buttonClass="bg-sky-600 hover:bg-sky-700 text-white"
          />
        </div>
      )}
    </DentalgraphWorkbench>
  );
}
