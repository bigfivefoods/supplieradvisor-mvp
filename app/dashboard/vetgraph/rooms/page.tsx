'use client';

import {
  LoadingBlock,
  VetgraphWorkbench,
  useVetgraph,
} from '@/components/clinic/VetgraphWorkbench';
import { ClinicRoomsDesk } from '@/components/clinic/ClinicRoomsDesk';

export default function MedicalRoomsPage() {
  const { companyId, store, loading, saving, post, summary } = useVetgraph();
  const people = (store?.practitioners || [])
    .filter((p) => p.active !== false)
    .map((p) => ({ id: p.id, name: p.name }));

  return (
    <VetgraphWorkbench
      title="Rooms"
      titleAccent="floor"
      description="Floor resources: add consult rooms and surgeries, attach equipment, and optionally assign a room to a medical advisor. The diary uses these so two advisors can work at the same time."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <ClinicRoomsDesk
          companyId={companyId}
          rooms={store.settings?.rooms}
          people={people}
          personNoun="medical advisor"
          peopleNoun="medical advisors"
          calendarHref="/dashboard/vetgraph/calendar"
          saving={saving}
          post={post}
          summaryRoomCount={Number(summary?.roomCount) || undefined}
        />
      )}
    </VetgraphWorkbench>
  );
}
