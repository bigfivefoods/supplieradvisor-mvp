'use client';

import { useMemo } from 'react';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { StatRow } from '@/components/fitness/FitForm';
import {
  ServiceMessaging,
  type MessagingGroup,
} from '@/components/messaging/ServiceMessaging';
import type { ServiceThread } from '@/lib/messaging/service-inbox';
import {
  fitgraphHasFrontDesk,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';

/** Build messageable class groups from calendar sessions + class types */
function buildFitMessagingGroups(store: FitgraphStore): MessagingGroup[] {
  const today = new Date().toISOString().slice(0, 10);
  const pastCutoff = new Date();
  pastCutoff.setDate(pastCutoff.getDate() - 14);
  const pastFrom = pastCutoff.toISOString().slice(0, 10);

  const activeBooking = (status: string) =>
    status === 'booked' ||
    status === 'waitlist' ||
    status === 'attended' ||
    status === 'no_show';

  const groups: MessagingGroup[] = [];

  // Upcoming + recent sessions with at least one booked member
  const sessions = [...(store.sessions || [])]
    .filter(
      (s) =>
        s.status !== 'cancelled' &&
        s.date >= pastFrom &&
        s.date <=
          (() => {
            const d = new Date();
            d.setDate(d.getDate() + 60);
            return d.toISOString().slice(0, 10);
          })()
    )
    .sort((a, b) =>
      a.date === b.date
        ? a.start_time.localeCompare(b.start_time)
        : a.date.localeCompare(b.date)
    );

  for (const s of sessions) {
    const ct = store.class_types.find((t) => t.id === s.class_type_id);
    const coach = store.coaches.find((c) => c.id === s.coach_id);
    const memberIds = [
      ...new Set(
        (store.bookings || [])
          .filter(
            (b) =>
              b.session_id === s.id &&
              activeBooking(String(b.status)) &&
              b.client_id
          )
          .map((b) => String(b.client_id))
      ),
    ];
    if (!memberIds.length) continue;
    const when =
      s.date === today
        ? `Today ${s.start_time}`
        : `${s.date} ${s.start_time}`;
    groups.push({
      id: `session:${s.id}`,
      kind: 'session',
      ref_id: s.id,
      name: ct?.name || 'Class',
      subtitle: `${when}${coach ? ` · ${coach.name}` : ''} · ${memberIds.length} on roster`,
      member_ids: memberIds,
      coach_id: s.coach_id || null,
    });
  }

  // Class-type groups: all members booked on any recent/upcoming session of that type
  for (const ct of store.class_types || []) {
    if (ct.active === false) continue;
    const typeSessions = sessions.filter((s) => s.class_type_id === ct.id);
    if (!typeSessions.length) continue;
    const memberIds = [
      ...new Set(
        typeSessions.flatMap((s) =>
          (store.bookings || [])
            .filter(
              (b) =>
                b.session_id === s.id &&
                activeBooking(String(b.status)) &&
                b.client_id
            )
            .map((b) => String(b.client_id))
        )
      ),
    ];
    if (!memberIds.length) continue;
    const coachIds = [
      ...new Set(
        typeSessions.map((s) => s.coach_id).filter(Boolean) as string[]
      ),
    ];
    groups.push({
      id: `type:${ct.id}`,
      kind: 'class_type',
      ref_id: ct.id,
      name: ct.name,
      subtitle: `${ct.code || 'Class type'} · ${typeSessions.length} session(s) · ${memberIds.length} members`,
      member_ids: memberIds,
      coach_id: coachIds[0] || null,
    });
  }

  return groups;
}

export default function FitgraphMessagesPage() {
  const { store, loading, saving, post, summary } = useFitgraph();

  const groups = useMemo(
    () => (store ? buildFitMessagingGroups(store) : []),
    [store]
  );
  const hasFrontDesk = fitgraphHasFrontDesk(store?.settings);

  return (
    <FitgraphWorkbench
      title="Messages"
      titleAccent={
        hasFrontDesk ? 'team · members · classes' : 'coach · members · classes'
      }
      description={
        hasFrontDesk
          ? 'Message coaches and members one-to-one, or message a whole class / group. Front desk can also thread with coaches and members.'
          : 'Coach-led gym (no front desk): message members one-to-one or whole class groups. Set front desk under Website → Gym operations model.'
      }
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
                value:
                  Number(summary?.threadCount) ||
                  (store.threads || []).filter((t) => !t.archived).length,
              },
              {
                label: 'Unread (desk)',
                value: Number(summary?.unreadMessages) || 0,
              },
              {
                label: 'Coaches',
                value: (store.coaches || []).length,
              },
              {
                label: 'Class groups',
                value: groups.length,
              },
            ]}
          />
          <ServiceMessaging
            variant="fitgraph"
            accent="yellow"
            hasFrontDesk={hasFrontDesk}
            threads={(store.threads || []) as ServiceThread[]}
            directory={{
              coachesOrPractitioners: (store.coaches || [])
                .filter((c) => c.id && c.name)
                .map((c) => ({
                  id: String(c.id),
                  name: String(c.name),
                  code: c.code ? String(c.code) : undefined,
                  active: c.active !== false,
                  subtitle: c.email || undefined,
                })),
              membersOrPatients: (store.clients || [])
                .filter((c) => c.id && c.name)
                .map((c) => ({
                  id: String(c.id),
                  name: String(c.name),
                  code: c.code ? String(c.code) : undefined,
                  active: c.active !== false,
                  subtitle: c.email || undefined,
                })),
              groups,
            }}
            saving={saving}
            onAction={(body) => post(body)}
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
