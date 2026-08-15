'use client';

import {
  LoadingBlock,
  MedicalgraphWorkbench,
  useMedicalgraph,
} from '@/components/clinic/MedicalgraphWorkbench';
import { StatRow } from '@/components/clinic/MedicalForm';
import { AdvisorAnnouncementsDesk } from '@/components/services/AdvisorAnnouncementsDesk';

export default function MedicalgraphCommsPage() {
  const { store, loading, saving, post } = useMedicalgraph();
  const rows = store?.announcements || [];

  return (
    <MedicalgraphWorkbench
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
    </MedicalgraphWorkbench>
  );
}
