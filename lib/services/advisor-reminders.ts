/**
 * Booking reminder emails for GymAdvisor + clinic Advisors.
 */
import { getResend, getResendFrom, getAppUrl } from '@/lib/resend';
import { sendAdvisorSessionEmail } from '@/lib/services/advisor-branded-email';

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

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Notify a waitlisted person that a spot opened and they were promoted to booked.
 */
export async function sendWaitlistOfferEmail(
  target: ReminderTarget
): Promise<{ ok: boolean; error?: string }> {
  try {
    const resend = getResend();
    if (!resend) {
      return { ok: false, error: 'Email not configured (RESEND_API_KEY)' };
    }
    const app = getAppUrl();
    const when = `${target.date} at ${target.start_time.slice(0, 5)}`;
    const subject = `Spot available: ${target.eventTitle} · ${when}`;
    const manage = target.manageUrl
      ? target.manageUrl.startsWith('http')
        ? target.manageUrl
        : `${app}${target.manageUrl}`
      : app;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
        <p style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b">
          ${escapeHtml(target.moduleLabel || 'SupplierAdvisor')} · Waitlist
        </p>
        <h1 style="font-size:20px;margin:8px 0 12px">Good news, ${escapeHtml(target.personName)}!</h1>
        <p style="font-size:15px;line-height:1.5;color:#334155">
          A place opened at <strong>${escapeHtml(target.brand)}</strong> and you have been
          <strong>moved from the waitlist onto the booking</strong>.
        </p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:16px 0">
          <p style="margin:0;font-weight:700;font-size:16px">${escapeHtml(target.eventTitle)}</p>
          <p style="margin:8px 0 0;color:#166534">${escapeHtml(when)}</p>
          ${
            target.location
              ? `<p style="margin:4px 0 0;color:#64748b">${escapeHtml(target.location)}</p>`
              : ''
          }
        </div>
        <p style="font-size:14px">
          <a href="${escapeHtml(manage)}" style="color:#7c3aed;font-weight:700">View / manage booking</a>
        </p>
        <p style="font-size:12px;color:#94a3b8;margin-top:24px">
          Powered by SupplierAdvisor®
        </p>
      </div>
    `;
    const { error } = await resend.emails.send({
      from: getResendFrom(),
      to: target.to,
      subject,
      html,
    });
    if (error) {
      return { ok: false, error: error.message || 'Send failed' };
    }
    return { ok: true };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Waitlist offer failed',
    };
  }
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
