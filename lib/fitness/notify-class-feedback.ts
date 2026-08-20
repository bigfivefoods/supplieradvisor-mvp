/**
 * Member class ratings go to the session coach and the gym owner.
 */
import { sendAdvisorNoticeEmail } from '@/lib/services/advisor-branded-email';
import {
  newDeskNotice,
  pushDeskNotice,
} from '@/lib/services/advisor-member-calendar';
import type { FitClassFeedback, FitgraphStore } from '@/lib/fitness/fitgraph';

export async function notifyGymClassFeedback(opts: {
  store: FitgraphStore;
  bookingId: string;
  feedback: Pick<
    FitClassFeedback,
    'feeling' | 'intensity' | 'enjoyment' | 'comment' | 'author_name'
  >;
}): Promise<FitgraphStore> {
  const booking = opts.store.bookings.find((b) => b.id === opts.bookingId);
  const session = opts.store.sessions.find((s) => s.id === booking?.session_id);
  const client = opts.store.clients.find((c) => c.id === booking?.client_id);
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
  const who = opts.feedback.author_name || client?.name || 'A member';
  const scores = [
    `Feel ${opts.feedback.feeling}/5`,
    opts.feedback.intensity != null ? `RPE ${opts.feedback.intensity}/10` : null,
    opts.feedback.enjoyment != null ? `Enjoy ${opts.feedback.enjoyment}/5` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const comment = String(opts.feedback.comment || '').trim();

  opts.store.desk_notices = pushDeskNotice(
    opts.store.desk_notices,
    newDeskNotice({
      kind: 'class_feedback',
      person_id: client?.id || booking?.client_id || '',
      person_name: who,
      email: client?.email || null,
      phone: client?.phone || null,
      source: 'pwa',
      appointment_id: session?.id || null,
      date: session?.date || null,
      start_time: session?.start_time || null,
      service_name: className,
      note: [scores, comment].filter(Boolean).join(' — '),
    })
  );

  const recipients = new Set<string>();
  if (coach?.email && coach.email.includes('@')) recipients.add(coach.email.trim());
  const owner = String(opts.store.settings?.contact_email || '').trim();
  if (owner.includes('@')) recipients.add(owner);

  const input = {
    brand,
    subject: `Class feedback · ${who} · ${className}`,
    headline: `${who} rated ${className}`,
    kicker: 'GymAdvisor® class feedback',
    leadHtml: `<p>${who} sent class feedback${when ? ` for ${when}` : ''}.</p>`,
    detailKicker: 'Rating',
    detailTitle: className,
    detailLines: [scores, comment].filter(Boolean),
    moduleKey: 'fitgraph',
    moduleLabel: 'GymAdvisor®',
    logoUrl: opts.store.settings?.company_logo_url || null,
  };

  await Promise.all(
    [...recipients].map((to) =>
      sendAdvisorNoticeEmail(to, input).catch(() => ({ ok: false }))
    )
  );

  return opts.store;
}
