/**
 * Public website diary for clinic Advisors (token = practice public_token).
 * Guest book creates/finds patient by email and books open slots.
 */

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
  clinicians: Array<{ name: string; disciplines?: string[] }>;
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
  staff_id?: string | null;
  practitioner_id?: string | null;
};

type Booking = {
  appointment_id: string;
  status: string;
};

function appointmentOpen(
  store: { appointments: Appt[]; bookings: Booking[]; services: Array<{ id: string; name: string }> },
  a: Appt
): boolean {
  if (a.status !== 'scheduled') return false;
  if (a.public !== true) return false;
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

  const slots: ClinicPublicSlot[] = store.appointments
    .filter(
      (a) =>
        a.status === 'scheduled' &&
        a.public === true &&
        a.date >= start &&
        a.date <= end
    )
    .sort((a, b) =>
      a.date === b.date
        ? a.start_time.localeCompare(b.start_time)
        : a.date.localeCompare(b.date)
    )
    .map((a) => {
      const svc = store.services.find((s) => s.id === a.service_id);
      const clinId = a.staff_id || a.practitioner_id;
      const clin = clinId
        ? clinicians.find((c) => c.id === clinId)
        : undefined;
      const open = appointmentOpen(store, a);
      return {
        id: a.id,
        date: a.date,
        start_time: a.start_time,
        end_time: a.end_time,
        duration_min: a.duration_min,
        service_name: svc?.name || 'Appointment',
        clinician_name: clin?.name,
        location: a.location,
        spots_left: open ? 1 : 0,
        full: !open,
        public_notes: a.public_notes,
      };
    });

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
      .map((c) => ({
        name: c.name,
        disciplines: c.disciplines,
      })),
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
