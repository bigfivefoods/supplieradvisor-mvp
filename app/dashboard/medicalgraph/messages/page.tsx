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
      titleAccent="practice team"
      description="Colleague chat between practitioners, desk ↔ clinician, and practitioner ↔ patient threads for care plans, scripts and follow-ups."
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
                value: (store.practitioners || []).length,
              },
              {
                label: 'Patients',
                value: (store.patients || []).length,
              },
            ]}
          />
          <ServiceMessaging
            variant="medicalgraph"
            accent="teal"
            threads={(store.threads || []) as ServiceThread[]}
            directory={{
              coachesOrPractitioners: (store.practitioners || [])
                .filter((p) => p.id && p.name)
                .map((p) => ({
                  id: String(p.id),
                  name: String(p.name),
                  code: p.code ? String(p.code) : undefined,
                  active: p.active !== false,
                  subtitle: p.email || undefined,
                })),
              membersOrPatients: (store.patients || [])
                .filter((p) => p.id && p.name)
                .map((p) => ({
                  id: String(p.id),
                  name: String(p.name),
                  code: p.code ? String(p.code) : undefined,
                  active: p.active !== false,
                  subtitle: p.email || undefined,
                })),
            }}
            saving={saving}
            onAction={(body) => post(body)}
          />
        </div>
      )}
    </MedicalgraphWorkbench>
  );
}
