'use client';

import {
  LoadingBlock,
  PhysiographWorkbench,
  usePhysiograph,
} from '@/components/clinic/PhysiographWorkbench';
import { StatRow } from '@/components/clinic/PhysioForm';
import { ServiceMessaging } from '@/components/messaging/ServiceMessaging';
import type { ServiceThread } from '@/lib/messaging/service-inbox';

export default function PhysiographMessagesPage() {
  const { store, loading, saving, post, summary } = usePhysiograph();

  return (
    <PhysiographWorkbench
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
                value: (store.practitioners || []).length,
              },
              {
                label: 'Patients',
                value: (store.patients || []).length,
              },
            ]}
          />
          <ServiceMessaging
            variant="physiograph"
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
    </PhysiographWorkbench>
  );
}
