'use client';

import {
  LoadingBlock,
  DentalgraphWorkbench,
  useDentalgraph,
} from '@/components/dental/DentalgraphWorkbench';
import { StatRow } from '@/components/dental/DentalForm';
import { ServiceMessaging } from '@/components/messaging/ServiceMessaging';
import type { ServiceThread } from '@/lib/messaging/service-inbox';

export default function DentalgraphMessagesPage() {
  const { store, loading, saving, post, summary } = useDentalgraph();

  return (
    <DentalgraphWorkbench
      title="Messages"
      titleAccent="practice team"
      description="Colleague chat between staff, desk ↔ dentist, and clinician ↔ patient threads for care plans, oral health updates and follow-ups."
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
                label: 'Staff',
                value: store.staff.filter((p) => p.active !== false)
                  .length,
              },
              {
                label: 'Patients',
                value: store.patients.filter((p) => p.active !== false).length,
              },
            ]}
          />
          <ServiceMessaging
            variant="dentalgraph"
            accent="sky"
            threads={(store.threads || []) as ServiceThread[]}
            directory={{
              coachesOrPractitioners: store.staff
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
    </DentalgraphWorkbench>
  );
}
