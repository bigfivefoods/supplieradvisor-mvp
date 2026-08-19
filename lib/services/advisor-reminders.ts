/**
 * Booking reminder emails for GymAdvisor + clinic Advisors.
 */
import { getAppUrl } from '@/lib/resend';
import {
  escapeEmailHtml,
  sendAdvisorNoticeEmail,
  sendAdvisorSessionEmail,
} from '@/lib/services/advisor-branded-email';

export type ReminderTarget = {
  to: string;
  personName: string;
  brand: string;
  eventTitle: string;
  date: string;
  start_time: string;
  location?: string;
  /** Portal or public link */
  manageUrl?: string;
  icsUrl?: string;
  moduleLabel?: string;
  moduleKey?: string;
  logoUrl?: string | null;
  practitionerName?: string | null;
};

export async function sendBookingReminderEmail(
  target: ReminderTarget
): Promise<{ ok: boolean; error?: string }> {
  const app = getAppUrl();
  const manage = target.manageUrl
    ? target.manageUrl.startsWith('http')
      ? target.manageUrl
      : `${app}${target.manageUrl}`
    : app;
  return sendAdvisorSessionEmail(target.to, {
    kind: 'pre',
    personName: target.personName,
    brand: target.brand,
    eventTitle: target.eventTitle,
    date: target.date,
    start_time: target.start_time,
    location: target.location,
    practitionerName: target.practitionerName,
    logoUrl: target.logoUrl,
    ctaUrl: manage,
    moduleKey: target.moduleKey,
    moduleLabel: target.moduleLabel,
  });
}

/**
 * Notify a waitlisted person that a spot opened and they were promoted to booked.
 */
export async function sendWaitlistOfferEmail(
  target: ReminderTarget
): Promise<{ ok: boolean; error?: string }> {
  const app = getAppUrl();
  const when = `${target.date} at ${String(target.start_time || '').slice(0, 5)}`;
  const subject = `Spot available: ${target.eventTitle} · ${when}`;
  const manage = target.manageUrl
    ? target.manageUrl.startsWith('http')
      ? target.manageUrl
      : `${app}${target.manageUrl}`
    : app;
  return sendAdvisorNoticeEmail(target.to, {
    personName: target.personName,
    brand: target.brand,
    logoUrl: target.logoUrl,
    moduleKey: target.moduleKey,
    moduleLabel: target.moduleLabel,
    subject,
    headline: `Good news, ${escapeEmailHtml(target.personName)}!`,
    leadHtml: `A place opened at <strong>${escapeEmailHtml(target.brand)}</strong> and you have been <strong>moved from the waitlist onto the booking</strong>.`,
    detailKicker: 'Your booking',
    detailTitle: target.eventTitle,
    detailLines: [when, target.location || ''],
    ctaUrl: manage,
    ctaLabel: 'View / manage booking',
  });
}

/** Bookings in the next N hours that have not been reminded yet */
export function needsReminder(
  booking: {
    status: string;
    reminded_at?: string | null;
    reminder_count?: number;
  },
  eventDate: string,
  eventTime: string,
  windowHours = 24
): boolean {
  if (booking.status !== 'booked' && booking.status !== 'waitlist') return false;
  if ((Number(booking.reminder_count) || 0) >= 2) return false;
  const start = new Date(`${eventDate}T${(eventTime || '09:00').slice(0, 5)}:00`);
  if (Number.isNaN(start.getTime())) return false;
  const now = Date.now();
  const ms = start.getTime() - now;
  if (ms < 0) return false; // past
  if (ms > windowHours * 3600 * 1000) return false; // too far
  // If already reminded once, only re-remind inside 3h window
  if (booking.reminded_at) {
    return ms <= 3 * 3600 * 1000 && (Number(booking.reminder_count) || 0) < 2;
  }
  return true;
}
