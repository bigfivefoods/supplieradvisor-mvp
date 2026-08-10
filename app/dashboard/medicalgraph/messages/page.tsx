'use client';

import {
  LoadingBlock,
  MedicalgraphWorkbench,
  useMedicalgraph,
} from '@/components/clinic/MedicalgraphWorkbench';
import { StatRow } from '@/components/clinic/MedicalForm';
import { ServiceMessaging } from '@/components/messaging/ServiceMessaging';
import type { ServiceThread } from '@/lib/messaging/service-inbox';

export default function MedicalgraphMessagesPage() {
  const { store, loading, saving, post, summary } = useMedicalgraph();

  return (
    <MedicalgraphWorkbench
      title="Messages"
      titleAccent="clinic team"
      description="Colleague chat between practitioners, desk ↔ physio, and practitioner ↔ patient threads for care plans, injury updates and follow-ups."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              {
                label: 'Open threads',
                value:
                  Number(summary?.threadCount) ||
                  (store.threads || []).filter((t) => !t.archived).length,
              },
              {
                label: 'Unread (desk)',
                value: Number(summary?.unreadMessages) || 0,
              },
              {
                label: 'Practitioners',
                value: store.practitioners.filter((p) => p.active !== false)
                  .length,
              },
              {
                label: 'Patients',
                value: store.patients.filter((p) => p.active !== false).length,
              },
            ]}
          />
          <ServiceMessaging
            variant="medicalgraph"
            accent="teal"
            threads={(store.threads || []) as ServiceThread[]}
            directory={{
              coachesOrPractitioners: store.practitioners
                .filter((p) => p.active !== false)
                .map((p) => ({ id: p.id, name: p.name, code: p.code })),
              membersOrPatients: store.patients
                .filter((p) => p.active !== false)
                .map((p) => ({ id: p.id, name: p.name, code: p.code })),
            }}
            saving={saving}
            onAction={(body) => post(body)}
          />
        </div>
      )}
    </MedicalgraphWorkbench>
  );
}
