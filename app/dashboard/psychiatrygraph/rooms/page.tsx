'use client';

import {
  LoadingBlock,
  PsychiatrygraphWorkbench,
  usePsychiatrygraph,
} from '@/components/clinic/PsychiatrygraphWorkbench';
import { ClinicRoomsDesk } from '@/components/clinic/ClinicRoomsDesk';

export default function PsychiatryRoomsPage() {
  const { companyId, store, loading, saving, post, summary } =
    usePsychiatrygraph();
  const people = (store?.practitioners || [])
    .filter((p) => p.active !== false)
    .map((p) => ({ id: p.id, name: p.name }));

  return (
    <PsychiatrygraphWorkbench
      title="Rooms"
      titleAccent="floor"
      description="Floor resources: add consult rooms, attach equipment, and optionally assign a room to a clinician. The diary uses these so two clinicians can work at the same time."
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
          calendarHref="/dashboard/psychiatrygraph/calendar"
          saving={saving}
          post={post}
          summaryRoomCount={Number(summary?.roomCount) || undefined}
        />
      )}
    </PsychiatrygraphWorkbench>
  );
}
