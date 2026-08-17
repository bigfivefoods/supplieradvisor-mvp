/**
 * Public website diary for clinic Advisors (token = practice public_token).
 * Guest book creates/finds patient by email and books open slots.
 */
import { generateAdvisorMemberSlots } from '@/lib/services/advisor-member-calendar';

export type ClinicPublicSlot = {
  id: string;
  date: string;
  start_time: string;
  end_time?: string | null;
  duration_min?: number | null;
  service_name: string;
  clinician_name?: string;
  location?: string;
  spots_left: number;
  full: boolean;
  public_notes?: string;
};

export type ClinicPublicCalendar = {
  module: string;
  brand: string;
  bio?: string;
  timezone?: string;
  allow_booking: boolean;
  contact_email?: string;
  contact_phone?: string;
  primary_color?: string;
  city?: string;
  from: string;
  to: string;
  slots: ClinicPublicSlot[];
  clinicians: Array<{
    name: string;
    disciplines?: string[];
    bio?: string;
    qualifications?: Array<{
      title: string;
      issuer?: string;
      year?: string | null;
      certificates?: Array<{ file_name: string; url: string }>;
    }>;
  }>;
  services: Array<{ name: string; duration_min?: number; price_zar?: number }>;
};

type Appt = {
  id: string;
  service_id: string;
  date: string;
  start_time: string;
  end_time?: string | null;
  duration_min?: number | null;
  location?: string;
  status: string;
  public?: boolean;
  public_notes?: string;
  appointment_kind?: string;
  staff_id?: string | null;
  practitioner_id?: string | null;
};

type Booking = {
  appointment_id: string;
  status: string;
};

function appointmentOpen(
  store: { appointments: Appt[]; bookings: Booking[]; services: Array<{ id: string; name: string; code?: string }> },
  a: Appt
): boolean {
  if (a.status !== 'scheduled') return false;
  if (a.public !== true) return false;
  if (String(a.appointment_kind || '') === 'personal') return false;
  const booked = store.bookings.filter(
    (b) =>
      b.appointment_id === a.id &&
      (b.status === 'booked' || b.status === 'attended' || b.status === 'waitlist')
  ).length;
  return booked < 1;
}

export function buildClinicPublicCalendar(opts: {
  module: string;
  store: {
    appointments: Appt[];
    bookings: Booking[];
    services: Array<{
      id: string;
      name: string;
      default_duration_min?: number;
      price_zar?: number;
      active?: boolean;
    }>;
    staff?: Array<{ id: string; name: string; role?: string; disciplines?: string[] }>;
    practitioners?: Array<{
      id: string;
      name: string;
      disciplines?: string[];
      active?: boolean;
    }>;
    settings?: {
      brand_name?: string;
      public_bio?: string;
      timezone?: string;
      allow_public_booking?: boolean;
      share_member_calendar?: boolean;
      generate_member_slots?: boolean;
      member_slot_minutes?: number;
      working_hours?: import('@/lib/schedule/working-hours').WorkingHours;
      contact_email?: string;
      contact_phone?: string;
      embed_primary_color?: string;
      marketplace?: { city?: string };
      enabled?: boolean;
    } | null;
  };
  daysAhead?: number;
}): ClinicPublicCalendar {
  const days = Math.min(90, Math.max(7, opts.daysAhead || 28));
  const start = new Date().toISOString().slice(0, 10);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);
  const end = endDate.toISOString().slice(0, 10);
  const store = opts.store;
  const clinicians =
    store.staff ||
    (store.practitioners || []).map((p) => ({
      id: p.id,
      name: p.name,
      disciplines: p.disciplines,
    }));

  const generated = generateAdvisorMemberSlots(store, { from: start, to: end });
  const slots: ClinicPublicSlot[] = generated.map((s) => ({
    id: s.id,
    date: s.date,
    start_time: s.start_time,
    end_time: s.end_time,
    duration_min: s.duration_min,
    service_name: s.service_name,
    clinician_name: s.practitioner_name || undefined,
    location: s.location,
    spots_left: s.spots_left,
    full: s.full,
    public_notes: s.public_notes,
  }));

  return {
    module: opts.module,
    brand: store.settings?.brand_name || 'Clinic',
    bio: store.settings?.public_bio,
    timezone: store.settings?.timezone || 'Africa/Johannesburg',
    allow_booking: store.settings?.allow_public_booking !== false,
    contact_email: store.settings?.contact_email,
    contact_phone: store.settings?.contact_phone,
    primary_color: store.settings?.embed_primary_color || '#0d9488',
    city: store.settings?.marketplace?.city,
    from: start,
    to: end,
    slots,
    clinicians: clinicians
      .filter((c) => (c as { active?: boolean }).active !== false)
      .map((c) => {
        const person = c as {
          name: string;
          disciplines?: string[];
          roles?: string[];
          public_bio?: string;
          bio?: string;
          qualifications?: unknown;
        };
        const quals = (
          person.qualifications && Array.isArray(person.qualifications)
            ? person.qualifications
            : []
        ) as Array<{
          title?: string;
          issuer?: string;
          year?: string | null;
          public?: boolean;
          certificates?: Array<{ file_name: string; url: string }>;
        }>;
        return {
          name: person.name,
          disciplines: person.disciplines || person.roles,
          bio: person.public_bio || person.bio,
          qualifications: quals
            .filter((q) => q.public !== false && q.title)
            .map((q) => ({
              title: String(q.title),
              issuer: q.issuer,
              year: q.year,
              certificates: q.certificates || [],
            })),
        };
      }),
    services: store.services
      .filter((s) => s.active !== false)
      .map((s) => ({
        name: s.name,
        duration_min: s.default_duration_min,
        price_zar: s.price_zar,
      })),
  };
}

/** Soft room conflict: same location string + overlapping time on same day */
export function findRoomDiaryConflict(opts: {
  appointments: Array<{
    id: string;
    date: string;
    start_time: string;
    end_time?: string | null;
    duration_min?: number | null;
    location?: string | null;
    room?: string | null;
    status?: string;
  }>;
  room: string;
  date: string;
  start_time: string;
  duration_min?: number | null;
  end_time?: string | null;
  excludeId?: string | null;
}): { conflict: true; message: string; with_id: string } | { conflict: false } {
  const room = String(opts.room || '').trim().toLowerCase();
  if (!room) return { conflict: false };

  const toMin = (t: string) => {
    const [h, m] = String(t || '09:00')
      .slice(0, 5)
      .split(':')
      .map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const endOf = (
    start: string,
    end?: string | null,
    dur?: number | null
  ) => {
    if (end) {
      const e = toMin(end);
      const s = toMin(start);
      if (e > s) return e;
    }
    return toMin(start) + (Number(dur) > 0 ? Number(dur) : 45);
  };

  const date = String(opts.date || '').slice(0, 10);
  const start = toMin(opts.start_time);
  const end = endOf(opts.start_time, opts.end_time, opts.duration_min);

  for (const a of opts.appointments) {
    if (opts.excludeId && a.id === opts.excludeId) continue;
    if (String(a.date || '').slice(0, 10) !== date) continue;
    if (a.status === 'cancelled') continue;
    const aRoom = String(a.location || a.room || '')
      .trim()
      .toLowerCase();
    if (!aRoom || aRoom !== room) continue;
    const aStart = toMin(a.start_time);
    const aEnd = endOf(a.start_time, a.end_time, a.duration_min);
    if (start < aEnd && aStart < end) {
      return {
        conflict: true,
        with_id: a.id,
        message: `Room “${opts.room}” is already booked at ${a.start_time.slice(0, 5)}`,
      };
    }
  }
  return { conflict: false };
}
