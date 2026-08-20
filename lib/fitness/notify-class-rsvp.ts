/**
 * Member class RSVP → desk notice + coach / gym email.
 */
import { sendAdvisorNoticeEmail } from '@/lib/services/advisor-branded-email';
import {
  newDeskNotice,
  pushDeskNotice,
} from '@/lib/services/advisor-member-calendar';
import type { FitBooking, FitgraphStore } from '@/lib/fitness/fitgraph';
import { notifyLinkedMember } from '@/lib/b2c/member-push';

export async function notifyGymClassRsvp(opts: {
  store: FitgraphStore;
  booking: FitBooking;
  coming: boolean;
}): Promise<FitgraphStore> {
  const session = opts.store.sessions.find(
    (s) => s.id === opts.booking.session_id
  );
  const client = opts.store.clients.find((c) => c.id === opts.booking.client_id);
  const ct = session
    ? opts.store.class_types.find((t) => t.id === session.class_type_id)
    : null;
  const coach = session
    ? opts.store.coaches.find((c) => c.id === session.coach_id)
    : null;
  const brand = opts.store.settings?.brand_name || 'Gym';
  const className = ct?.name || 'Class';
  const when = session
    ? `${session.date} ${String(session.start_time || '').slice(0, 5)}`
    : '';
  const who = client?.name || 'A member';
  const coming = opts.coming;
  const line = coming ? 'will be attending' : "won't be attending";

  opts.store.desk_notices = pushDeskNotice(
    opts.store.desk_notices,
    newDeskNotice({
      kind: 'class_rsvp',
      person_id: client?.id || opts.booking.client_id,
      person_name: who,
      email: client?.email || null,
      phone: client?.phone || null,
      source: 'pwa',
      appointment_id: session?.id || null,
      date: session?.date || null,
      start_time: session?.start_time || null,
      service_name: className,
      note: `${who} ${line}${when ? ` · ${when}` : ''}`,
    })
  );

  const recipients = new Set<string>();
  if (coach?.email && coach.email.includes('@')) {
    recipients.add(coach.email.trim());
  }
  const owner = String(opts.store.settings?.contact_email || '').trim();
  if (owner.includes('@')) recipients.add(owner);

  const input = {
    brand,
    subject: `${who} ${line} · ${className}`,
    headline: coming ? `${who} will be attending` : `${who} won’t be attending`,
    kicker: 'GymAdvisor® class RSVP',
    leadHtml: `<p><strong>${who}</strong> ${line} <strong>${className}</strong>${when ? ` on ${when}` : ''}.</p>`,
    detailKicker: coming ? 'Attending' : 'Not attending',
    detailTitle: className,
    detailLines: [when, coach?.name ? `Coach ${coach.name}` : ''].filter(
      Boolean
    ),
    moduleKey: 'fitgraph',
    moduleLabel: 'GymAdvisor®',
    logoUrl: opts.store.settings?.company_logo_url || null,
  };

  await Promise.all([
    ...[...recipients].map((to) =>
      sendAdvisorNoticeEmail(to, input).catch(() => ({ ok: false }))
    ),
    coach && 'platform_user_id' in coach
      ? notifyLinkedMember({
          platformUserId: (coach as { platform_user_id?: string | null })
            .platform_user_id,
          title: coming ? 'Member will attend' : 'Member won’t attend',
          body: `${who} · ${className}${when ? ` · ${when}` : ''}`,
          tag: `class-rsvp-${opts.booking.session_id}`,
          topic: 'bookings',
        }).catch(() => ({ sent: 0, pruned: 0 }))
      : Promise.resolve(),
  ]);

  return opts.store;
}
