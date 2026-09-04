'use client';

import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { AdvisorFloorTasks } from '@/components/services/AdvisorFloorTasks';

export default function FitgraphTasksPage() {
  const { store, loading, saving, post } = useFitgraph();

  return (
    <FitgraphWorkbench
      title="Tasks"
      titleAccent="floor"
      description="Create, assign, repeat and close floor work. Slice the period, click a graph, then work the list."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <AdvisorFloorTasks
          tasks={store.floor_tasks || []}
          staff={(store.coaches || []).map((c) => ({
            id: c.id,
            name: c.name,
            active: c.active,
          }))}
          people={(store.clients || []).map((c) => ({
            id: c.id,
            name: c.name,
            active: c.active,
          }))}
          staffLabel="Coach"
          personLabel="Member"
          timezone={store.settings?.timezone}
          saving={saving}
          accent="gym"
          onAction={(body) => post(body)}
        />
      )}
    </FitgraphWorkbench>
  );
}
