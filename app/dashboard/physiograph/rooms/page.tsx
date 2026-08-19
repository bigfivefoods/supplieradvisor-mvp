'use client';

import {
  LoadingBlock,
  PhysiographWorkbench,
  usePhysiograph,
} from '@/components/clinic/PhysiographWorkbench';
import { ClinicRoomsDesk } from '@/components/clinic/ClinicRoomsDesk';

export default function PhysioRoomsPage() {
  const { companyId, store, loading, saving, post, summary } = usePhysiograph();
  const people = (store?.practitioners || [])
    .filter((p) => p.active !== false)
    .map((p) => ({ id: p.id, name: p.name }));

  return (
    <PhysiographWorkbench
      title="Rooms"
      titleAccent="floor"
      description="Floor resources: add treatment rooms, attach equipment, and optionally assign a room to a practitioner. The diary uses these so two physios can work at the same time."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <ClinicRoomsDesk
          companyId={companyId}
          rooms={store.settings?.rooms}
          people={people}
          personNoun="practitioner"
          peopleNoun="practitioners"
          calendarHref="/dashboard/physiograph/calendar"
          saving={saving}
          post={post}
          summaryRoomCount={Number(summary?.roomCount) || undefined}
        />
      )}
    </PhysiographWorkbench>
  );
}
