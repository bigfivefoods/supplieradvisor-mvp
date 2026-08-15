'use client';

import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { AdvisorCareQueue } from '@/components/services/AdvisorCareQueue';
import { AdvisorRelationshipPanel } from '@/components/services/AdvisorRelationshipPanel';
import { useState } from 'react';
import { buildCareQueue } from '@/lib/fitness/fitgraph-coach-ops';

export default function FitgraphCarePage() {
  const { store, loading, post, load } = useFitgraph();
  const [focusId, setFocusId] = useState<string | null>(null);

  return (
    <FitgraphWorkbench
      title="Care queue"
      titleAccent="relationships"
      description="Proactive care for members who are cooling off or at risk — relationship health, suggested actions, and shared journey tools."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <AdvisorCareQueue store={store} limit={40} />
          <div className="grid gap-3 sm:grid-cols-2">
            {buildCareQueue(store, { limit: 6 }).map((item) => (
              <button
                key={item.client_id}
                type="button"
                onClick={() => setFocusId(item.client_id)}
                className={`text-left rounded-xl border px-3 py-2 text-xs font-bold ${
                  focusId === item.client_id
                    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/40'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                Focus: {item.client_name}
              </button>
            ))}
          </div>
          {focusId ? (
            <AdvisorRelationshipPanel
              store={store}
              clientId={focusId}
              clientName={store.clients.find((c) => c.id === focusId)?.name}
              coachId={store.clients.find((c) => c.id === focusId)?.coach_id}
              onPersist={async (next) => {
                await post({
                  action: 'replace_relationship_store',
                  goals: next.goals || [],
                  journey_events: next.journey_events || [],
                  member_stories: next.member_stories || [],
                  consent_shares: next.consent_shares || [],
                });
                await load();
              }}
            />
          ) : (
            <p className="text-sm text-slate-500">
              Select a member above to open their relationship panel.
            </p>
          )}
        </div>
      )}
    </FitgraphWorkbench>
  );
}
