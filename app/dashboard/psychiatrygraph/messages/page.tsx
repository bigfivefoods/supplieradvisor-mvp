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
      titleAccent="clinic team"
      description="Colleague chat between practitioners, desk ↔ clinician, and practitioner ↔ patient threads for care plans and follow-ups."
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
            variant="psychiatrygraph"
            accent="violet"
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
    </PsychiatrygraphWorkbench>
  );
}
