/**
 * Push to a linked SA Member (Privy user), no company workspace required.
 */
import { getCanonicalUserId } from '@/lib/auth/identity';
import { pushToUser, type PushPayload } from '@/lib/push/web-push';

export type MemberPushTopic = 'care' | 'bookings' | 'hire';

export async function notifyLinkedMember(opts: {
  platformUserId?: string | null;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  topic?: MemberPushTopic;
}): Promise<{ sent: number; pruned: number }> {
  const uid = getCanonicalUserId(opts.platformUserId);
  if (!uid) return { sent: 0, pruned: 0 };
  const payload: PushPayload = {
    title: opts.title,
    body: opts.body,
    url: opts.url || '/me',
    tag: opts.tag,
  };
  try {
    return await pushToUser(uid, payload, {
      topic: opts.topic || 'bookings',
    });
  } catch (e) {
    console.warn('[member-push]', e);
    return { sent: 0, pruned: 0 };
  }
}

export async function notifyPatientBookingPush(opts: {
  platformUserId?: string | null;
  brand?: string | null;
  title: string;
  date: string;
  start_time: string;
  status: string;
  portalPath?: string | null;
}): Promise<void> {
  const when = `${opts.date} ${(opts.start_time || '').slice(0, 5)}`.trim();
  const booked = opts.status === 'booked';
  const waitlist = opts.status === 'waitlist';
  if (!booked && !waitlist) return;
  await notifyLinkedMember({
    platformUserId: opts.platformUserId,
    title: booked ? 'Appointment booked' : 'You are on the waitlist',
    body: [opts.brand, opts.title, when].filter(Boolean).join(' · '),
    url: opts.portalPath || '/me',
    tag: `booking-${opts.date}-${opts.start_time}`,
    topic: 'bookings',
  });
}

export async function notifyBookingReminderPush(opts: {
  platformUserId?: string | null;
  brand?: string | null;
  title: string;
  date: string;
  start_time: string;
  portalPath?: string | null;
}): Promise<{ sent: number }> {
  const when = `${opts.date} at ${(opts.start_time || '').slice(0, 5)}`;
  const r = await notifyLinkedMember({
    platformUserId: opts.platformUserId,
    title: `Reminder · ${opts.title}`,
    body: [opts.brand, when].filter(Boolean).join(' · '),
    url: opts.portalPath || '/me',
    tag: `reminder-${opts.date}-${opts.start_time}`,
    topic: 'bookings',
  });
  return { sent: r.sent };
}
