'use client';

import {
  LoadingBlock,
  MedicalgraphWorkbench,
  useMedicalgraph,
} from '@/components/clinic/MedicalgraphWorkbench';
import { AdvisorFloorTasks } from '@/components/services/AdvisorFloorTasks';

export default function MedicalgraphTasksPage() {
  const { store, loading, saving, post } = useMedicalgraph();

  return (
    <MedicalgraphWorkbench
      title="Tasks"
      titleAccent="floor"
      description="Today’s work for the practice — assign a clinician, link a patient, repeat follow-ups, and tick off without losing the thread."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <AdvisorFloorTasks
          tasks={store.floor_tasks || []}
          staff={(store.practitioners || []).map((p) => ({
            id: p.id,
            name: p.name,
            active: p.active,
          }))}
          people={(store.patients || []).map((p) => ({
            id: p.id,
            name: p.name,
            active: p.active,
          }))}
          staffLabel="Clinician"
          personLabel="Patient"
          timezone={store.settings?.timezone}
          saving={saving}
          accent="medical"
          onAction={(body) => post(body)}
        />
      )}
    </MedicalgraphWorkbench>
  );
}
