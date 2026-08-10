'use client';

import {
  LoadingBlock,
  PsychiatrygraphWorkbench,
  usePsychiatrygraph,
} from '@/components/clinic/PsychiatrygraphWorkbench';
import { StatRow } from '@/components/clinic/PsychiatryForm';
import { ServiceMessaging } from '@/components/messaging/ServiceMessaging';
import type { ServiceThread } from '@/lib/messaging/service-inbox';

export default function PsychiatrygraphMessagesPage() {
  const { store, loading, saving, post, summary } = usePsychiatrygraph();

  return (
    <PsychiatrygraphWorkbench
      title="Messages"
      titleAccent="practice team"
      description="Colleague chat between clinicians, desk ↔ practitioner, and practitioner ↔ patient threads for care plans and follow-ups."
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
            variant="psychiatrygraph"
            accent="violet"
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
    </PsychiatrygraphWorkbench>
  );
}
