'use client';

import {
  DentalgraphWorkbench,
  LoadingBlock,
  useDentalgraph,
} from '@/components/dental/DentalgraphWorkbench';
import { ClinicRoomsDesk } from '@/components/clinic/ClinicRoomsDesk';

export default function DentalRoomsPage() {
  const { companyId, store, loading, saving, post, summary } = useDentalgraph();
  const people = (store?.staff || [])
    .filter((p) => p.active !== false)
    .map((p) => ({ id: p.id, name: p.name }));

  return (
    <DentalgraphWorkbench
      title="Rooms"
      titleAccent="floor"
      description="Floor resources: add surgeries and chairs, attach equipment, and optionally assign a room to a clinician. The diary uses these so two clinicians can work at the same time."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <ClinicRoomsDesk
          companyId={companyId}
          rooms={store.settings?.rooms}
          people={people}
          personNoun="clinician"
          peopleNoun="clinicians"
          calendarHref="/dashboard/dentalgraph/calendar"
          saving={saving}
          post={post}
          summaryRoomCount={Number(summary?.roomCount) || undefined}
        />
      )}
    </DentalgraphWorkbench>
  );
}
