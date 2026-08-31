/**
 * Class calendar names + ICS email (Brief 33).
 * Coach calendar lists planned members and RSVP coming.
 * Email uses the same UID so updates replace.
 */
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import {
  buildSessionIcs,
  coachPortalEmails,
  type FitgraphStore,
  type FitSession,
} from '@/lib/fitness/fitgraph';

export type ClassCalendarPerson = {
  name?: string | null;
  rsvp?: 'coming' | 'not_coming' | null;
  status?: string | null;
  plan?: boolean;
};

export function classCalendarPeople(opts: {
  roster?: ClassCalendarPerson[] | null;
  subscribed?: Array<{ name?: string | null; booked?: boolean }> | null;
}): { planned: string[]; coming: string[]; person: string; comingLabel: string } {
  const planned: string[] = [];
  const coming: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | null | undefined, into: string[]) => {
    const name = String(raw || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (into === planned) {
      if (seen.has(key)) return;
      seen.add(key);
      planned.push(name);
      return;
    }
    if (!coming.includes(name)) coming.push(name);
  };
  for (const row of opts.roster || []) {
    const st = String(row.status || '').toLowerCase();
    if (st === 'cancelled' || st === 'no_show') continue;
    push(row.name, planned);
    if (row.rsvp === 'coming') push(row.name, coming);
  }
  for (const row of opts.subscribed || []) {
    push(row.name, planned);
  }
  return {
    planned,
    coming,
    person: planned.join(', '),
    comingLabel: coming.length ? `Coming: ${coming.join(', ')}` : '',
  };
}

export function sessionCalendarDescription(opts: {
  className?: string | null;
  date?: string | null;
  startTime?: string | null;
  location?: string | null;
  coachName?: string | null;
  classPlan?: string | null;
}): string {
  const lines = [
    opts.className ? `Class: ${opts.className}` : '',
    opts.date && opts.startTime
      ? `When: ${opts.date} ${String(opts.startTime).slice(0, 5)}`
      : '',
    opts.location ? `Where: ${opts.location}` : '',
    opts.coachName ? `Coach: ${opts.coachName}` : '',
    opts.classPlan ? `Class Plan:\n${opts.classPlan}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

export function sessionCalendarRecipients(
  store: FitgraphStore,
  session: FitSession
): string[] {
  const out = new Set<string>();
  const add = (raw?: string | null) => {
    const e = String(raw || '').trim().toLowerCase();
    if (e.includes('@')) out.add(e);
  };
  const coach = store.coaches.find((c) => c.id === session.coach_id);
  if (coach) coachPortalEmails(coach).forEach(add);
  for (const b of store.bookings || []) {
    if (b.session_id !== session.id) continue;
    const st = String(b.status || '').toLowerCase();
    if (st === 'cancelled' || st === 'no_show') continue;
    if (!(b.rsvp === 'coming' || st === 'booked' || st === 'attended')) continue;
    const client = store.clients.find((c) => c.id === b.client_id);
    add(client?.email);
  }
  return [...out];
}

export async function emailSessionCalendar(opts: {
  store: FitgraphStore;
  sessionId: string;
}): Promise<{ sent: number }> {
  const session = opts.store.sessions.find((s) => s.id === opts.sessionId);
  if (!session) return { sent: 0 };
  const ct = opts.store.class_types.find((c) => c.id === session.class_type_id);
  const coach = opts.store.coaches.find((c) => c.id === session.coach_id);
  const title = ct?.name || 'Class';
  const brand = opts.store.settings?.brand_name || 'Gym';
  const description = sessionCalendarDescription({
    className: title,
    date: session.date,
    startTime: session.start_time,
    location: session.location,
    coachName: coach?.name,
    classPlan: session.class_plan || session.public_notes,
  });
  const ics = buildSessionIcs({
    sessionId: session.id,
    title: `${title} · ${brand}`,
    date: session.date,
    start_time: session.start_time,
    duration_min: session.duration_min,
    location: session.location,
    description,
    brand,
    method: 'REQUEST',
  });
  const recipients = sessionCalendarRecipients(opts.store, session);
  if (!recipients.length) return { sent: 0 };
  let sent = 0;
  for (const to of recipients) {
    const ok = await sendSessionIcsEmail({
      to,
      brand,
      title,
      date: session.date,
      startTime: session.start_time,
      ics,
    });
    if (ok) sent += 1;
  }
  return { sent };
}

async function sendSessionIcsEmail(opts: {
  to: string;
  brand: string;
  title: string;
  date: string;
  startTime: string;
  ics: string;
}): Promise<boolean> {
  if (!opts.to || !opts.to.includes('@')) return false;
  try {
    if (!process.env.RESEND_API_KEY) return false;
    const { isVukaNotificationSuppressed } = await import(
      '@/lib/notifications/email-suppress'
    );
    if (
      isVukaNotificationSuppressed({
        companyName: opts.brand,
        subject: `${opts.title} at ${opts.brand}`,
      })
    ) {
      return true;
    }
    const resend = getResend();
    const when = `${opts.date} ${String(opts.startTime).slice(0, 5)}`;
    const { error } = await resend.emails.send({
      from: getResendFrom(),
      replyTo: getResendReplyTo(),
      to: opts.to,
      subject: `${opts.title} · ${when}`,
      html: `<p>${opts.title} at ${opts.brand} is on your calendar.</p><p>${when}</p>`,
      attachments: [
        {
          filename: 'class.ics',
          content: Buffer.from(opts.ics, 'utf8'),
          contentType: 'text/calendar; method=REQUEST; charset=utf-8',
        },
      ],
    });
    return !error;
  } catch {
    return false;
  }
}
