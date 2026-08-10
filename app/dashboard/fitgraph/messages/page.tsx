'use client';

import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { StatRow } from '@/components/fitness/FitForm';
import { ServiceMessaging } from '@/components/messaging/ServiceMessaging';
import type { ServiceThread } from '@/lib/messaging/service-inbox';

export default function FitgraphMessagesPage() {
  const { store, loading, saving, post, summary } = useFitgraph();

  return (
    <FitgraphWorkbench
      title="Messages"
      titleAccent="team & members"
      description="Colleague chat between coaches, desk ↔ coach, and coach ↔ member threads so the floor stays aligned on care, schedule and recovery."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            tone="owner"
            items={[
              {
                label: 'Open threads',
                value: Number(summary?.threadCount) || (store.threads || []).filter((t) => !t.archived).length,
              },
              {
                label: 'Unread (desk)',
                value: Number(summary?.unreadMessages) || 0,
              },
              {
                label: 'Coaches',
                value: store.coaches.filter((c) => c.active !== false).length,
              },
              {
                label: 'Members',
                value: store.clients.filter((c) => c.active !== false).length,
              },
            ]}
          />
          <ServiceMessaging
            variant="fitgraph"
            accent="violet"
            threads={(store.threads || []) as ServiceThread[]}
            directory={{
              coachesOrPractitioners: store.coaches
                .filter((c) => c.active !== false)
                .map((c) => ({ id: c.id, name: c.name, code: c.code })),
              membersOrPatients: store.clients
                .filter((c) => c.active !== false)
                .map((c) => ({ id: c.id, name: c.name, code: c.code })),
            }}
            saving={saving}
            onAction={(body) => post(body)}
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
