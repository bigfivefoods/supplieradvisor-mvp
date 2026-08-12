/**
 * Shared clinician diary portal helpers for Dental / Physio / Medical / Psychiatry.
 * Mirrors FitAdvisor coach portal: token auth, week diary, edit/delete, attendance.
 */
import { promoteNextWaitlist } from '@/lib/services/advisor-booking';

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export type ClinicianModule =
  | 'dentalgraph'
  | 'physiograph'
  | 'medicalgraph'
  | 'psychiatrygraph';

export const CLINICIAN_MODULES: ClinicianModule[] = [
  'dentalgraph',
  'physiograph',
  'medicalgraph',
  'psychiatrygraph',
];

export function isClinicianModule(v: string): v is ClinicianModule {
  return (CLINICIAN_MODULES as string[]).includes(v);
}

export function clinicianModuleLabel(mod: ClinicianModule): string {
  switch (mod) {
    case 'dentalgraph':
      return 'DentalAdvisor';
    case 'physiograph':
      return 'PhysioAdvisor';
    case 'medicalgraph':
      return 'MedicalAdvisor';
    case 'psychiatrygraph':
      return 'PsychiatryAdvisor';
  }
}

/** Token embeds company id for fast resolve: clin_{companyId}_{mod3}_{ts}_{rand} */
export function issueClinicianPortalToken(
  companyId: number,
  module: ClinicianModule
): string {
  const short = module.replace('graph', '').slice(0, 4);
  return `clin_${companyId}_${short}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function parseClinicianCompanyIdFromToken(token: string): number | null {
  const m = /^clin_(\d+)_/.exec(token.trim());
  if (m) return Number(m[1]);
  // legacy dental-style if any
  const d = /^dstaff_(\d+)_/.exec(token.trim());
  if (d) return Number(d[1]);
  const p = /^(?:pprac|mprac|yprac)_(\d+)_/.exec(token.trim());
  if (p) return Number(p[1]);
  return null;
}

export function staffTokenMapKey(module: ClinicianModule): string {
  return `${module}_staff_tokens`;
}

export type ClinicianPerson = {
  id: string;
  code?: string;
  name: string;
  email?: string;
  phone?: string;
  portal_token?: string | null;
  can_manage?: boolean;
  active?: boolean;
  roles?: string[];
  specialties?: string[];
  bio?: string;
  public_bio?: string;
  photo_url?: string;
};

export type ClinicianAppointment = {
  id: string;
  service_id: string;
  staff_id?: string | null;
  practitioner_id?: string | null;
  date: string;
  start_time: string;
  duration_min?: number | null;
  location?: string;
  status: string;
  public?: boolean;
  notes?: string;
  public_notes?: string;
  series_id?: string | null;
  created_at?: string;
};

export type ClinicianBooking = {
  id: string;
  appointment_id: string;
  patient_id: string;
  status: string;
  booked_at?: string;
  source?: string;
  notes?: string;
  family_member_id?: string | null;
  family_member_name?: string | null;
  waitlist_offered_at?: string | null;
};

export type ClinicianStoreLike = {
  staff?: ClinicianPerson[];
  practitioners?: ClinicianPerson[];
  patients: Array<{
    id: string;
    code?: string;
    name: string;
    email?: string;
    phone?: string;
    active?: boolean;
    staff_id?: string | null;
    practitioner_id?: string | null;
    portal_token?: string | null;
    clinical?: unknown;
    health?: unknown;
    booking_soft_block?: boolean;
    no_show_count?: number;
  }>;
  services: Array<{
    id: string;
    code?: string;
    name: string;
    default_duration_min?: number;
    duration_min?: number;
    capacity?: number | null;
    active?: boolean;
  }>;
  appointments: ClinicianAppointment[];
  bookings: ClinicianBooking[];
  settings?: {
    brand_name?: string;
    public_token?: string;
    enabled?: boolean;
    rooms?: string[];
  } | null;
};

export function peopleKey(
  module: ClinicianModule
): 'staff' | 'practitioners' {
  return module === 'dentalgraph' ? 'staff' : 'practitioners';
}

export function clinicianField(
  module: ClinicianModule
): 'staff_id' | 'practitioner_id' {
  return module === 'dentalgraph' ? 'staff_id' : 'practitioner_id';
}

export function listClinicians(
  store: ClinicianStoreLike,
  module: ClinicianModule
): ClinicianPerson[] {
  return module === 'dentalgraph'
    ? store.staff || []
    : store.practitioners || [];
}

export function findClinicianByToken(
  store: ClinicianStoreLike,
  module: ClinicianModule,
  token: string
): ClinicianPerson | null {
  const clean = token.trim();
  return (
    listClinicians(store, module).find(
      (p) => p.portal_token === clean && p.active !== false
    ) || null
  );
}

export function appointmentBookedCount(
  store: ClinicianStoreLike,
  appointmentId: string
): number {
  return (store.bookings || []).filter(
    (b) =>
      b.appointment_id === appointmentId &&
      (b.status === 'booked' || b.status === 'attended')
  ).length;
}

export function clinicianOwnsAppointment(
  appt: ClinicianAppointment,
  module: ClinicianModule,
  clinicianId: string
): boolean {
  const field = clinicianField(module);
  return String(appt[field] || '') === clinicianId;
}

export function buildClinicianPortalPayload(
  store: ClinicianStoreLike,
  module: ClinicianModule,
  clinician: ClinicianPerson,
  from?: string,
  to?: string
) {
  const start = from || new Date().toISOString().slice(0, 10);
  const endDate = new Date(start + 'T12:00:00');
  endDate.setDate(endDate.getDate() + 14);
  const end = to || endDate.toISOString().slice(0, 10);
  const field = clinicianField(module);

  const myAppts = (store.appointments || [])
    .filter(
      (a) =>
        a.status !== 'cancelled' &&
        a.date >= start &&
        a.date <= end &&
        String(a[field] || '') === clinician.id
    )
    .sort((a, b) =>
      a.date === b.date
        ? a.start_time.localeCompare(b.start_time)
        : a.date.localeCompare(b.date)
    );

  const cards = myAppts.map((a) => {
    const svc = (store.services || []).find((s) => s.id === a.service_id);
    const roster = (store.bookings || [])
      .filter(
        (b) => b.appointment_id === a.id && b.status !== 'cancelled'
      )
      .map((b) => {
        const patient = (store.patients || []).find(
          (p) => p.id === b.patient_id
        );
        const clinical = patient?.clinical || patient?.health;
        const injured =
          clinical &&
          typeof clinical === 'object' &&
          ((clinical as { injured?: boolean }).injured === true ||
            (Array.isArray(
              (clinical as { injury_areas?: string[] }).injury_areas
            ) &&
              ((clinical as { injury_areas?: string[] }).injury_areas || [])
                .length > 0));
        const actual =
          b.status === 'attended'
            ? 'attended'
            : b.status === 'no_show'
              ? 'no_show'
              : b.status === 'cancelled'
                ? 'cancelled'
                : 'pending';
        return {
          booking_id: b.id,
          patient_id: b.patient_id,
          status: b.status,
          plan:
            b.status === 'booked' ||
            b.status === 'attended' ||
            b.status === 'no_show' ||
            b.status === 'waitlist',
          actual,
          name:
            b.family_member_name || patient?.name || 'Patient',
          email: patient?.email,
          phone: patient?.phone,
          soft_block: patient?.booking_soft_block === true,
          no_show_count: patient?.no_show_count || 0,
          injured: !!injured,
          clinical,
        };
      });
    const planned = roster.filter(
      (r) =>
        r.status === 'booked' ||
        r.status === 'attended' ||
        r.status === 'no_show'
    ).length;
    return {
      appointment: a,
      service_name: svc?.name,
      service_code: svc?.code,
      capacity: 1,
      planned,
      waitlist: roster.filter((r) => r.status === 'waitlist').length,
      attended: roster.filter((r) => r.actual === 'attended').length,
      no_show: roster.filter((r) => r.actual === 'no_show').length,
      pending: roster.filter(
        (r) => r.actual === 'pending' && r.status === 'booked'
      ).length,
      roster,
    };
  });

  const by_date: Record<string, typeof cards> = {};
  for (const card of cards) {
    const d = card.appointment.date;
    if (!by_date[d]) by_date[d] = [];
    by_date[d].push(card);
  }

  const patients = (store.patients || [])
    .filter((p) => p.active !== false)
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      email: p.email,
      phone: p.phone,
      soft_block: p.booking_soft_block === true,
      no_show_count: p.no_show_count || 0,
      clinical: p.clinical || p.health,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const services = (store.services || [])
    .filter((s) => s.active !== false)
    .map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      default_duration_min:
        s.default_duration_min ?? s.duration_min ?? 45,
    }));

  return {
    module,
    clinician: {
      id: clinician.id,
      code: clinician.code,
      name: clinician.name,
      email: clinician.email,
      phone: clinician.phone,
      roles: clinician.roles || clinician.specialties || [],
      bio: clinician.bio,
      public_bio: clinician.public_bio,
      photo_url: clinician.photo_url,
      can_manage: clinician.can_manage !== false,
    },
    from: start,
    to: end,
    appointments: cards,
    by_date,
    patients,
    services,
    rooms: store.settings?.rooms || [],
  };
}

export function createClinicianAppointment(
  store: ClinicianStoreLike,
  module: ClinicianModule,
  clinicianId: string,
  input: {
    service_id: string;
    date: string;
    start_time: string;
    duration_min?: number;
    location?: string;
    public?: boolean;
    notes?: string;
    public_notes?: string;
    series_id?: string | null;
  },
  now = new Date().toISOString()
): ClinicianAppointment {
  const svc = (store.services || []).find((s) => s.id === input.service_id);
  const appt: ClinicianAppointment = {
    id: newId('apt'),
    service_id: input.service_id,
    date: input.date.slice(0, 10),
    start_time: String(input.start_time).slice(0, 5),
    duration_min:
      input.duration_min ??
      svc?.default_duration_min ??
      svc?.duration_min ??
      45,
    location: input.location,
    status: 'scheduled',
    public: input.public === true,
    notes: input.notes,
    public_notes: input.public_notes,
    series_id: input.series_id ?? null,
    created_at: now,
  };
  if (module === 'dentalgraph') {
    appt.staff_id = clinicianId;
  } else {
    appt.practitioner_id = clinicianId;
  }
  store.appointments.push(appt);
  return appt;
}

export function deleteClinicianAppointment(
  store: ClinicianStoreLike,
  appointmentId: string,
  deleteSeries = false
): { deleted: number; promoted: number } {
  const target = store.appointments.find((a) => a.id === appointmentId);
  if (!target) return { deleted: 0, promoted: 0 };
  let removeIds: Set<string>;
  if (deleteSeries && target.series_id) {
    const sid = String(target.series_id);
    removeIds = new Set(
      store.appointments.filter((a) => a.series_id === sid).map((a) => a.id)
    );
  } else {
    removeIds = new Set([appointmentId]);
  }
  let promoted = 0;
  // Promote waitlist before drop (in case of partial series — only for non-deleted waitlists on other appts)
  for (const id of removeIds) {
    // no promote needed when removing entire slot
    void id;
  }
  store.appointments = store.appointments.filter((a) => !removeIds.has(a.id));
  store.bookings = (store.bookings || []).filter(
    (b) => !removeIds.has(b.appointment_id)
  );
  return { deleted: removeIds.size, promoted };
}

export function cancelBookingAndPromote(
  store: ClinicianStoreLike,
  bookingId: string,
  now = new Date().toISOString()
): { cancelled: boolean; promoted: ClinicianBooking | null } {
  const booking = store.bookings.find((b) => b.id === bookingId);
  if (!booking) return { cancelled: false, promoted: null };
  const wasBooked =
    booking.status === 'booked' || booking.status === 'attended';
  booking.status = 'cancelled';
  let promoted: ClinicianBooking | null = null;
  if (wasBooked) {
    promoted = promoteNextWaitlist(
      store.bookings,
      (b) => b.appointment_id === booking.appointment_id,
      now
    );
  }
  return { cancelled: true, promoted };
}

/** Fill / utilisation metrics for clinic reports */
export function clinicDiaryMetrics(
  store: ClinicianStoreLike,
  from: string,
  to: string,
  module: ClinicianModule
) {
  const field = clinicianField(module);
  const appts = (store.appointments || []).filter(
    (a) =>
      a.date >= from &&
      a.date <= to &&
      a.status !== 'cancelled'
  );
  let bookedSlots = 0;
  let openSlots = 0;
  let attended = 0;
  let noShow = 0;
  let waitlist = 0;
  for (const a of appts) {
    const books = (store.bookings || []).filter(
      (b) => b.appointment_id === a.id && b.status !== 'cancelled'
    );
    const hasBooked = books.some(
      (b) =>
        b.status === 'booked' ||
        b.status === 'attended' ||
        b.status === 'no_show'
    );
    if (hasBooked) bookedSlots += 1;
    else openSlots += 1;
    attended += books.filter((b) => b.status === 'attended').length;
    noShow += books.filter((b) => b.status === 'no_show').length;
    waitlist += books.filter((b) => b.status === 'waitlist').length;
  }
  const total = appts.length || 1;
  const fillRate = Math.round((bookedSlots / total) * 100);
  const clinicians = listClinicians(store, module).filter(
    (c) => c.active !== false
  );
  const byClinician = clinicians.map((c) => {
    const mine = appts.filter((a) => String(a[field] || '') === c.id);
    let b = 0;
    let att = 0;
    let ns = 0;
    for (const a of mine) {
      const books = (store.bookings || []).filter(
        (x) => x.appointment_id === a.id
      );
      if (
        books.some(
          (x) =>
            x.status === 'booked' ||
            x.status === 'attended' ||
            x.status === 'no_show'
        )
      )
        b += 1;
      att += books.filter((x) => x.status === 'attended').length;
      ns += books.filter((x) => x.status === 'no_show').length;
    }
    return {
      id: c.id,
      name: c.name,
      appointments: mine.length,
      booked: b,
      attended: att,
      no_show: ns,
      fill_pct: mine.length
        ? Math.round((b / mine.length) * 100)
        : 0,
    };
  });
  return {
    appointments: appts.length,
    bookedSlots,
    openSlots,
    attended,
    noShow,
    waitlist,
    fillRate,
    byClinician,
  };
}
