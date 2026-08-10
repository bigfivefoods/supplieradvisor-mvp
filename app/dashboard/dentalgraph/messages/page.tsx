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
                value: (store.staff || []).length,
              },
              {
                label: 'Patients',
                value: (store.patients || []).length,
              },
            ]}
          />
          <ServiceMessaging
            variant="dentalgraph"
            accent="sky"
            threads={(store.threads || []) as ServiceThread[]}
            directory={{
              coachesOrPractitioners: (store.staff || [])
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
    </DentalgraphWorkbench>
  );
}
