'use client';

import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { AdvisorRoomsCard } from '@/components/services/AdvisorRoomsCard';

export default function FitgraphRoomsPage() {
  const { store, loading, saving, post } = useFitgraph();

  if (loading || !store) {
    return (
      <FitgraphWorkbench
        title="Rooms"
        titleAccent="floor"
        description="Studios, courts and spin rooms used as diary resources. Pick a room when scheduling so the calendar shows where each session runs."
      >
        <LoadingBlock />
      </FitgraphWorkbench>
    );
  }

  return (
    <FitgraphWorkbench
      title="Rooms"
      titleAccent="floor"
      description="Studios, courts and spin rooms used as diary resources. Pick a room when scheduling so the calendar shows where each session runs."
    >
      <AdvisorRoomsCard
        rooms={store.settings?.rooms ?? []}
        saving={saving}
        accentClass="border-emerald-200"
        label="Studios & rooms"
        hint="Floor resources for the diary (studio, court, spin room)."
        onSave={async (rooms) => {
          await post({
            action: 'update_settings',
            settings: { rooms },
          });
        }}
      />
    </FitgraphWorkbench>
  );
}
