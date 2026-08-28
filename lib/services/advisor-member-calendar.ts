/**
 * Shared Advisor → SA Member diary.
 *
 * Advisors share working hours; members see open times and book.
 * Desk gets a join / booking inbox so new PWA patients are never silent.
 */
import {
  consultServices,
  isSystemPersonalService,
} from '@/lib/clinic/appointment-kind';
import { consolidateClinicDiarySlots } from '@/lib/clinic/consolidate-diary-slots';
import {
  normalizeWorkingHours,
  openCloseOn,
  type WorkingHours,
} from '@/lib/schedule/working-hours';

export type DeskMemberNoticeKind =
  | 'member_joined'
  | 'booking_made'
  | 'booking_request'
  | 'class_feedback'
  | 'class_rsvp';

export type DeskMemberNotice = {
  id: string;
  kind: DeskMemberNoticeKind;
  status: 'new' | 'seen' | 'accepted' | 'dismissed';
  person_id: string;
  person_name: string;
  email?: string | null;
  phone?: string | null;
  source: 'pwa' | 'portal' | 'embed' | 'desk';
  appointment_id?: string | null;
  date?: string | null;
  start_time?: string | null;
  service_name?: string | null;
  note?: string | null;
  created_at: string;
  seen_at?: string | null;
};

export type AdvisorMemberSlot = {
  id: string;
  virtual: boolean;
  date: string;
  start_time: string;
  end_time: string;
  duration_min: number;
  service_id: string;
  service_name: string;
  practitioner_id: string | null;
  practitioner_name: string | null;
  location?: string;
  public_notes?: string;
  full: boolean;
  spots_left: number;
};

export type ClinicMemberStore = {
  appointments: Array<{
    id: string;
    service_id: string;
    date: string;
    start_time: string;
    end_time?: string | null;
    duration_min?: number | null;
    location?: string;
    status: string;
    public?: boolean;
    appointment_kind?: string;
    practitioner_id?: string | null;
    staff_id?: string | null;
    notes?: string;
    created_at?: string;
  }>;
  bookings: Array<{
    id: string;
    appointment_id: string;
    patient_id: string;
    status: string;
    booked_at?: string;
    source?: string;
    notes?: string;
    family_member_id?: string | null;
    family_member_name?: string | null;
  }>;
  services: Array<{
    id: string;
    name: string;
    code?: string;
    default_duration_min?: number;
    active?: boolean;
  }>;
  practitioners?: Array<{ id: string; name: string; active?: boolean }>;
  staff?: Array<{ id: string; name: string; active?: boolean }>;
  patients?: Array<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
    desk_join_status?: string | null;
    platform_user_id?: string | null;
    active?: boolean;
  }>;
  desk_notices?: DeskMemberNotice[];
  settings?: {
    allow_public_booking?: boolean;
    share_member_calendar?: boolean;
    generate_member_slots?: boolean;
    member_slot_minutes?: number;
    require_accept_join?: boolean;
    working_hours?: WorkingHours;
    brand_name?: string;
    timezone?: string;
  } | null;
};

export type ClinicModuleKey =
  | 'physiograph'
  | 'dentalgraph'
  | 'medicalgraph'
  | 'psychiatrygraph'
  | 'vetgraph';

export const CLINIC_KIND_TO_MODULE: Record<string, ClinicModuleKey> = {
  physio: 'physiograph',
  dental: 'dentalgraph',
  medical: 'medicalgraph',
  psychiatry: 'psychiatrygraph',
  vet: 'vetgraph',
};

export function moduleToClinicKind(module: string): string {
  if (module === 'physiograph') return 'physio';
  if (module === 'dentalgraph') return 'dental';
  if (module === 'medicalgraph') return 'medical';
  if (module === 'psychiatrygraph') return 'psychiatry';
  if (module === 'vetgraph') return 'vet';
  return module;
}

export function isClinicModule(m: string): m is ClinicModuleKey {
  return (
    m === 'physiograph' ||
    m === 'dentalgraph' ||
    m === 'medicalgraph' ||
    m === 'vetgraph' ||
    m === 'psychiatrygraph'
  );
}

export function memberCalendarShareOn(settings?: ClinicMemberStore['settings']) {
  if (settings?.share_member_calendar === false) return false;
  if (settings?.allow_public_booking === false) return false;
  return true;
}

export function gymCalendarShareOn(settings?: {
  share_member_calendar?: boolean;
  allow_public_booking?: boolean;
} | null) {
  if (settings?.share_member_calendar === false) return false;
  if (settings?.allow_public_booking === false) return false;
  return true;
}

export function memberSlotsFromHoursOn(
  settings?: ClinicMemberStore['settings']
) {
  return settings?.generate_member_slots !== false;
}

export function newDeskNoticeId() {
  return `ntc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newDeskNotice(
  input: Omit<DeskMemberNotice, 'id' | 'status' | 'created_at'> & {
    status?: DeskMemberNotice['status'];
    created_at?: string;
  }
): DeskMemberNotice {
  return {
    ...input,
    id: newDeskNoticeId(),
    status: input.status || 'new',
    created_at: input.created_at || new Date().toISOString(),
  };
}

export function pushDeskNotice(
  notices: DeskMemberNotice[] | undefined,
  notice: DeskMemberNotice
): DeskMemberNotice[] {
  const list = [...(notices || [])];
  const dup = list.find(
    (n) =>
      n.status === 'new' &&
      n.kind === notice.kind &&
      n.person_id === notice.person_id &&
      (notice.appointment_id
        ? n.appointment_id === notice.appointment_id
        : !n.appointment_id) &&
      Date.now() - Date.parse(n.created_at) < 12 * 60 * 60 * 1000
  );
  if (dup) return list;
  list.unshift(notice);
  return list.slice(0, 80);
}

export function openDeskNotices(notices?: DeskMemberNotice[]) {
  return (notices || []).filter(
    (n) => n.status === 'new' || n.status === 'seen'
  );
}

function toMin(t: string): number {
  const [h, m] = String(t || '00:00')
    .slice(0, 5)
    .split(':')
    .map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fromMin(n: number): string {
  const h = Math.floor(n / 60) % 24;
  const m = n % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function endMin(a: {
  start_time: string;
  end_time?: string | null;
  duration_min?: number | null;
}): number {
  if (a.end_time) {
    const e = toMin(a.end_time);
    if (e > toMin(a.start_time)) return e;
  }
  return toMin(a.start_time) + (Number(a.duration_min) > 0 ? Number(a.duration_min) : 45);
}

function clinicianId(a: {
  practitioner_id?: string | null;
  staff_id?: string | null;
}): string | null {
  return a.practitioner_id || a.staff_id || null;
}

function peopleOf(store: ClinicSlotStore) {
  const list =
    store.practitioners && store.practitioners.length
      ? store.practitioners
      : store.staff || [];
  const active = list.filter((p) => p.active !== false);
  return active.length ? active : [{ id: '', name: 'Practice' }];
}

function defaultConsult(store: ClinicSlotStore) {
  const list = consultServices(store.services || []);
  return list[0] || null;
}

function slotMinutes(store: ClinicSlotStore, svc?: { default_duration_min?: number } | null) {
  const set = Number(store.settings?.member_slot_minutes);
  if (Number.isFinite(set) && set >= 15) return Math.min(180, set);
  const d = Number(svc?.default_duration_min);
  return Number.isFinite(d) && d >= 15 ? d : 45;
}

function occupies(
  a: ClinicMemberStore['appointments'][number],
  date: string,
  start: number,
  end: number,
  personId: string | null
): boolean {
  if (String(a.date).slice(0, 10) !== date) return false;
  if (a.status === 'cancelled') return false;
  const who = clinicianId(a);
  const personal = String(a.appointment_kind || '') === 'personal';
  if (personal) {
    if (who && personId && who !== personId) return false;
  } else if (who && personId && who !== personId) {
    return false;
  }
  const aStart = toMin(a.start_time);
  const aEnd = endMin(a);
  return start < aEnd && aStart < end;
}

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = from.split('-').map(Number);
  const cur = new Date(fy, (fm || 1) - 1, fd || 1);
  const [ty, tm, td] = to.split('-').map(Number);
  const last = new Date(ty, (tm || 1) - 1, td || 1);
  const p = (n: number) => String(n).padStart(2, '0');
  while (cur <= last && out.length < 90) {
    out.push(
      `${cur.getFullYear()}-${p(cur.getMonth() + 1)}-${p(cur.getDate())}`
    );
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function virtualSlotId(opts: {
  practitionerId: string | null;
  date: string;
  start: string;
}): string {
  const who = opts.practitionerId || 'any';
  return `avail_${opts.date}_${opts.start.replace(':', '')}_${who}`;
}

export function parseVirtualSlotId(id: string): {
  practitionerId: string | null;
  date: string;
  start: string;
} | null {
  const m = /^avail_(\d{4}-\d{2}-\d{2})_(\d{4})_(.+)$/.exec(String(id || ''));
  if (!m) return null;
  return {
    date: m[1],
    start: `${m[2].slice(0, 2)}:${m[2].slice(2)}`,
    practitionerId: m[3] === 'any' ? null : m[3],
  };
}

/** Enough of a clinic store to list bookable hours (public calendar + PWA). */
export type ClinicSlotStore = {
  appointments: ClinicMemberStore['appointments'];
  bookings: Array<{ appointment_id: string; status: string }>;
  services: ClinicMemberStore['services'];
  practitioners?: ClinicMemberStore['practitioners'];
  staff?: ClinicMemberStore['staff'];
  settings?: ClinicMemberStore['settings'];
};

export function generateAdvisorMemberSlots(
  store: ClinicSlotStore,
  opts?: { from?: string; to?: string }
): AdvisorMemberSlot[] {
  if (!memberCalendarShareOn(store.settings)) return [];
  const today = new Date().toISOString().slice(0, 10);
  const start = opts?.from && opts.from >= today ? opts.from : today;
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 21);
  const end = opts?.to || horizon.toISOString().slice(0, 10);
  const svc = defaultConsult(store);
  const duration = slotMinutes(store, svc);
  const hours = normalizeWorkingHours(store.settings?.working_hours);
  const people = peopleOf(store);
  const slots: AdvisorMemberSlot[] = [];
  const seen = new Set<string>();

  const push = (s: AdvisorMemberSlot) => {
    if (seen.has(s.id)) return;
    seen.add(s.id);
    slots.push(s);
  };

  for (const a of store.appointments || []) {
    if (
      a.status !== 'scheduled' ||
      a.public !== true ||
      String(a.appointment_kind || '') === 'personal'
    ) {
      continue;
    }
    if (a.date < start || a.date > end) continue;
    const booked = (store.bookings || []).filter(
      (b) =>
        b.appointment_id === a.id &&
        (b.status === 'booked' ||
          b.status === 'waitlist' ||
          b.status === 'attended')
    ).length;
    const full = booked >= 1;
    const who = clinicianId(a);
    const person = people.find((p) => p.id && p.id === who);
    const rowSvc = (store.services || []).find((s) => s.id === a.service_id);
    push({
      id: a.id,
      virtual: false,
      date: a.date,
      start_time: String(a.start_time).slice(0, 5),
      end_time: a.end_time
        ? String(a.end_time).slice(0, 5)
        : fromMin(endMin(a)),
      duration_min: a.duration_min || duration,
      service_id: a.service_id,
      service_name: rowSvc?.name || svc?.name || 'Appointment',
      practitioner_id: who,
      practitioner_name: person?.name || null,
      location: a.location,
      full,
      spots_left: full ? 0 : 1,
    });
  }

  if (memberSlotsFromHoursOn(store.settings) && svc) {
    for (const date of eachDate(start, end)) {
      const oc = openCloseOn(hours, date);
      if (oc.closed) continue;
      const open = toMin(oc.open);
      const close = toMin(oc.close);
      for (const person of people) {
        const pid = person.id || null;
        for (let t = open; t + duration <= close; t += duration) {
          const blocked = (store.appointments || []).some((a) =>
            occupies(a, date, t, t + duration, pid)
          );
          if (blocked) continue;
          const startT = fromMin(t);
          push({
            id: virtualSlotId({
              practitionerId: pid,
              date,
              start: startT,
            }),
            virtual: true,
            date,
            start_time: startT,
            end_time: fromMin(t + duration),
            duration_min: duration,
            service_id: svc.id,
            service_name: svc.name,
            practitioner_id: pid,
            practitioner_name: person.id ? person.name : null,
            full: false,
            spots_left: 1,
          });
        }
      }
    }
  }

  slots.sort((a, b) =>
    a.date === b.date
      ? a.start_time.localeCompare(b.start_time)
      : a.date.localeCompare(b.date)
  );
  return slots;
}

export function materializeAdvisorSlot<T extends ClinicMemberStore>(
  store: T,
  slot: AdvisorMemberSlot,
  newId: (prefix: string) => string,
  module: ClinicModuleKey
): { store: T; appointmentId: string; created: boolean } {
  if (!slot.virtual) {
    return { store, appointmentId: slot.id, created: false };
  }
  const now = new Date().toISOString();
  const id = newId('apt');
  const appt: ClinicMemberStore['appointments'][number] = {
    id,
    service_id: slot.service_id,
    date: slot.date,
    start_time: slot.start_time,
    end_time: slot.end_time,
    duration_min: slot.duration_min,
    status: 'scheduled',
    public: true,
    appointment_kind: 'consult',
    notes: 'Opened from SA Member bookable hours',
    created_at: now,
  };
  if (module === 'dentalgraph') {
    appt.staff_id = slot.practitioner_id;
  } else {
    appt.practitioner_id = slot.practitioner_id;
  }
  store.appointments = [...(store.appointments || []), appt];
  return { store, appointmentId: id, created: true };
}

export function bookAdvisorMemberSlot<T extends ClinicMemberStore>(opts: {
  store: T;
  module: ClinicModuleKey;
  patientId: string;
  slotId: string;
  newId: (prefix: string) => string;
  source?: string;
  familyMemberId?: string | null;
  familyMemberName?: string | null;
  now?: string;
}):
  | {
      ok: true;
      store: T;
      appointmentId: string;
      bookingId: string;
      status: 'booked' | 'waitlist';
      slot: AdvisorMemberSlot;
    }
  | { ok: false; error: string; status: number; code?: string } {
  const now = opts.now || new Date().toISOString();
  const settings = opts.store.settings;
  if (!memberCalendarShareOn(settings)) {
    return {
      ok: false,
      error: 'This practice is not sharing a bookable diary yet',
      status: 403,
      code: 'calendar_closed',
    };
  }
  const patient = (opts.store.patients || []).find(
    (p) => p.id === opts.patientId && p.active !== false
  );
  if (!patient) {
    return { ok: false, error: 'Patient not found', status: 404 };
  }
  if (
    settings?.require_accept_join === true &&
    patient.desk_join_status === 'pending'
  ) {
    return {
      ok: false,
      error: 'The practice is reviewing your join request',
      status: 403,
      code: 'join_pending',
    };
  }
  if (patient.desk_join_status === 'dismissed') {
    return {
      ok: false,
      error: 'This practice has not accepted your membership yet',
      status: 403,
      code: 'join_dismissed',
    };
  }

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 21);
  const slots = generateAdvisorMemberSlots(opts.store, {
    from: new Date().toISOString().slice(0, 10),
    to: horizon.toISOString().slice(0, 10),
  });
  let slot = slots.find((s) => s.id === opts.slotId) || null;
  if (!slot) {
    const parsed = parseVirtualSlotId(opts.slotId);
    if (parsed) {
      slot =
        slots.find(
          (s) =>
            s.date === parsed.date &&
            s.start_time === parsed.start &&
            (s.practitioner_id || null) === parsed.practitionerId
        ) || null;
    }
  }
  if (!slot) {
    return { ok: false, error: 'That time is no longer free', status: 409 };
  }

  const made = materializeAdvisorSlot(
    opts.store,
    slot,
    opts.newId,
    opts.module
  );
  const appointmentId = made.appointmentId;
  const dup = (opts.store.bookings || []).find(
    (b) =>
      b.appointment_id === appointmentId &&
      b.patient_id === opts.patientId &&
      (b.status === 'booked' ||
        b.status === 'waitlist' ||
        b.status === 'attended')
  );
  if (dup) {
    return {
      ok: true,
      store: opts.store,
      appointmentId,
      bookingId: dup.id,
      status: dup.status === 'waitlist' ? 'waitlist' : 'booked',
      slot,
    };
  }
  const taken = (opts.store.bookings || []).filter(
    (b) =>
      b.appointment_id === appointmentId &&
      (b.status === 'booked' ||
        b.status === 'waitlist' ||
        b.status === 'attended')
  ).length;
  const status: 'booked' | 'waitlist' = taken >= 1 ? 'waitlist' : 'booked';
  const bookingId = opts.newId('bk');
  opts.store.bookings = [
    ...(opts.store.bookings || []),
    {
      id: bookingId,
      appointment_id: appointmentId,
      patient_id: opts.patientId,
      status,
      booked_at: now,
      source: opts.source || 'pwa',
      notes:
        status === 'waitlist'
          ? 'SA Member — waitlist'
          : 'SA Member diary booking',
      family_member_id: opts.familyMemberName ? opts.familyMemberId : null,
      family_member_name: opts.familyMemberName || null,
    },
  ];
  opts.store.desk_notices = pushDeskNotice(
    opts.store.desk_notices,
    newDeskNotice({
      kind: status === 'waitlist' ? 'booking_request' : 'booking_made',
      person_id: opts.patientId,
      person_name: patient.name,
      email: patient.email,
      source: opts.source === 'embed' ? 'embed' : opts.source === 'portal' ? 'portal' : 'pwa',
      appointment_id: appointmentId,
      date: slot.date,
      start_time: slot.start_time,
      service_name: slot.service_name,
      note:
        status === 'waitlist'
          ? 'Asked to join a full slot'
          : `${slot.date} ${slot.start_time}`,
    })
  );
  return {
    ok: true,
    store: opts.store,
    appointmentId,
    bookingId,
    status,
    slot,
  };
}

export function markPatientJoined<T extends { desk_join_status?: string | null; source?: string; joined_via?: string }>(
  person: T,
  requireAccept: boolean
): T {
  person.source = person.source || 'sa_member';
  person.joined_via = 'pwa';
  if (!person.desk_join_status || person.desk_join_status === 'dismissed') {
    person.desk_join_status = requireAccept ? 'pending' : 'accepted';
  }
  return person;
}

export function decideDeskNotice<T extends ClinicMemberStore>(
  store: T,
  noticeId: string,
  decision: 'accepted' | 'dismissed' | 'seen'
): T {
  const now = new Date().toISOString();
  store.desk_notices = (store.desk_notices || []).map((n) => {
    if (n.id !== noticeId) return n;
    if (decision === 'seen') {
      return { ...n, status: n.status === 'new' ? 'seen' : n.status, seen_at: now };
    }
    return { ...n, status: decision, seen_at: n.seen_at || now };
  });
  const notice = (store.desk_notices || []).find((n) => n.id === noticeId);
  if (notice && (decision === 'accepted' || decision === 'dismissed')) {
    store.patients = (store.patients || []).map((p) =>
      p.id === notice.person_id
        ? { ...p, desk_join_status: decision }
        : p
    );
  }
  return store;
}

/** Used by tests — avoid unused import lint on isSystemPersonalService in some builds */
export function isBookableServiceCode(code?: string) {
  return !isSystemPersonalService(code);
}

export function toPortalOpenSlots(
  store: ClinicMemberStore,
  opts: {
    patientId: string;
    preferredClinicianId?: string | null;
    from?: string;
    to?: string;
  }
) {
  const rows = generateAdvisorMemberSlots(store, {
    from: opts.from,
    to: opts.to,
  }).map((s) => {
    const my = !s.virtual
      ? (store.bookings || []).find(
          (b) =>
            b.appointment_id === s.id &&
            b.patient_id === opts.patientId &&
            (b.status === 'booked' ||
              b.status === 'waitlist' ||
              b.status === 'attended')
        )
      : undefined;
    return {
      id: s.id,
      date: s.date,
      start_time: s.start_time,
      end_time: s.end_time,
      duration_min: s.duration_min,
      service_name: s.service_name,
      practitioner_id: s.practitioner_id,
      practitioner_name: s.practitioner_name,
      clinician_name: s.practitioner_name,
      is_preferred_clinician: Boolean(
        opts.preferredClinicianId &&
          s.practitioner_id &&
          opts.preferredClinicianId === s.practitioner_id
      ),
      location: s.location,
      capacity: 1,
      spots_left: s.spots_left,
      full: s.full,
      public_notes: s.public_notes,
      my_status: my?.status || null,
      my_booking_id: my?.id || null,
      virtual: s.virtual,
    };
  });
  return consolidateClinicDiarySlots(rows, { availableOnly: true });
}
