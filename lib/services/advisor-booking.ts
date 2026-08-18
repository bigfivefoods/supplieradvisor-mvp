/**
 * Shared booking helpers for GymAdvisor + clinic *Advisor modules.
 * Family attendee, waitlist promote, no-show stats, ICS export.
 */
import type { FamilyMember } from '@/lib/services/family-members';
import { relationshipLabel } from '@/lib/services/family-members';

export type BookingStatus =
  | 'booked'
  | 'waitlist'
  | 'cancelled'
  | 'attended'
  | 'no_show';

/** Extra fields dual-written on Fit/clinic bookings */
export type AdvisorBookingExtras = {
  /** When parent account books for a child / household member */
  family_member_id?: string | null;
  family_member_name?: string | null;
  /** Reminder emails sent */
  reminded_at?: string | null;
  reminder_count?: number;
  /** When waitlisted person was offered a spot */
  waitlist_offered_at?: string | null;
  waitlist_accepted_at?: string | null;
};

export type PersonNoShowStats = {
  no_show_count?: number;
  last_no_show_at?: string | null;
  attended_count?: number;
  /** Soft block after N no-shows (desk flag) */
  booking_soft_block?: boolean;
};

export const DEFAULT_NO_SHOW_SOFT_BLOCK = 3;

export function applyAttendanceToPersonStats(
  person: PersonNoShowStats,
  status: BookingStatus,
  now = new Date().toISOString()
): PersonNoShowStats {
  if (status === 'no_show') {
    const n = (Number(person.no_show_count) || 0) + 1;
    return {
      ...person,
      no_show_count: n,
      last_no_show_at: now,
      booking_soft_block: n >= DEFAULT_NO_SHOW_SOFT_BLOCK,
    };
  }
  if (status === 'attended') {
    return {
      ...person,
      attended_count: (Number(person.attended_count) || 0) + 1,
    };
  }
  return person;
}

/**
 * When a booked slot is cancelled, promote oldest waitlist entry to booked.
 * Mutates bookings array in place. Returns promoted booking or null.
 */
export function promoteNextWaitlist<
  T extends {
    id: string;
    status: string;
    booked_at?: string;
    notes?: string;
    waitlist_offered_at?: string | null;
  },
>(
  bookings: T[],
  match: (b: T) => boolean,
  now = new Date().toISOString()
): T | null {
  const waitlisted = bookings
    .filter((b) => match(b) && b.status === 'waitlist')
    .sort((a, b) =>
      String(a.booked_at || '').localeCompare(String(b.booked_at || ''))
    );
  const next = waitlisted[0];
  if (!next) return null;
  next.status = 'booked';
  next.waitlist_offered_at = now;
  next.notes = [next.notes, 'Promoted from waitlist'].filter(Boolean).join(' · ');
  return next;
}

/** Desk books a specific waitlisted person onto the slot. */
export function promoteWaitlistBooking<
  T extends {
    id: string;
    status: string;
    notes?: string;
    waitlist_offered_at?: string | null;
  },
>(bookings: T[], bookingId: string, now = new Date().toISOString()): T | null {
  const hit = bookings.find((b) => b.id === bookingId);
  if (!hit || hit.status !== 'waitlist') return null;
  hit.status = 'booked';
  hit.waitlist_offered_at = now;
  hit.notes = [hit.notes, 'Desk booked from waitlist']
    .filter(Boolean)
    .join(' · ');
  return hit;
}

export function resolveFamilyAttendee(
  family: FamilyMember[] | undefined | null,
  familyMemberId: string | null | undefined
): { id: string; name: string; label: string } | null {
  if (!familyMemberId || !Array.isArray(family)) return null;
  const m = family.find((f) => f.id === familyMemberId && f.active !== false);
  if (!m) return null;
  return {
    id: m.id,
    name: m.name,
    label: `${m.name} (${relationshipLabel(m.relationship)})`,
  };
}

/** Escape text for ICS */
function icsEscape(s: string): string {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function toIcsUtc(date: string, time: string): string {
  const t = (time || '09:00').slice(0, 5);
  const d = `${date.replace(/-/g, '')}T${t.replace(':', '')}00`;
  // Local wall time as floating (no Z) — works for most calendar apps
  return d;
}

export function buildBookingIcs(opts: {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  date: string;
  start_time: string;
  duration_min?: number;
  url?: string;
}): string {
  const start = toIcsUtc(opts.date, opts.start_time);
  const [h, m] = opts.start_time.slice(0, 5).split(':').map(Number);
  const dur = Number(opts.duration_min) || 45;
  const total = (h || 0) * 60 + (m || 0) + dur;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  const end = toIcsUtc(
    opts.date,
    `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
  );
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SupplierAdvisor//Advisor//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${icsEscape(opts.uid)}@supplieradvisor`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsEscape(opts.title)}`,
  ];
  if (opts.description) {
    lines.push(`DESCRIPTION:${icsEscape(opts.description)}`);
  }
  if (opts.location) {
    lines.push(`LOCATION:${icsEscape(opts.location)}`);
  }
  if (opts.url) {
    lines.push(`URL:${icsEscape(opts.url)}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export function membershipStatusAfterFreeze(
  current: string | undefined,
  action: 'freeze' | 'unfreeze'
): string {
  if (action === 'freeze') return 'frozen';
  if (current === 'frozen') return 'active';
  return current || 'active';
}
