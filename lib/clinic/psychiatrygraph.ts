/**
 * PsychiatryAdvisor® — tertiary / services mental health OS
 * (psychiatry, psychology, counselling: practitioners, patients, services,
 * packages, diary, bookings, website).
 * Stored on profiles.metadata.psychiatrygraph.
 */

import { totalUnread } from '@/lib/messaging/service-inbox';

export const PSYCHIATRYGRAPH_MODULE_ID = 'psychiatrygraph' as const;
export const PSYCHIATRYGRAPH_META_KEY = 'psychiatrygraph';

export const PRACTITIONER_DISCIPLINES = [
  'Psychiatry',
  'Clinical psychology',
  'Counselling psychology',
  'Psychotherapy',
  'Child & adolescent',
  'Addiction medicine',
  'Psychiatric nursing',
  'Occupational therapy (MH)',
  'General',
] as const;

export const DEFAULT_PRACTITIONER_DISCIPLINES: string[] = [
  ...PRACTITIONER_DISCIPLINES,
];

export const PATIENT_STATUSES = [
  'active',
  'new',
  'discharged',
  'on_hold',
  'cancelled',
] as const;

/** How the owner pays / prices a practitioner */
export const PRACTITIONER_RATE_BASES = [
  'hourly',
  'per_session',
  'per_appointment',
  'monthly',
  'fixed',
  'package',
] as const;

export type PsychiatryRateBasis = (typeof PRACTITIONER_RATE_BASES)[number] | string;

/** One closed employment / engagement period for a practitioner */
export type PsychiatryEngagement = {
  id: string;
  /** YYYY-MM-DD */
  start_date: string;
  /** YYYY-MM-DD */
  end_date: string;
  note?: string;
  ended_reason?: string;
  rate_zar?: number | null;
  rate_basis?: PsychiatryRateBasis;
};

/** PDF (or doc) contract attached to a practitioner engagement */
export type PsychiatryContractDoc = {
  id: string;
  title: string;
  file_name: string;
  /** Public storage URL */
  url: string;
  uploaded_at: string;
  /** practitioner_agreement | nda | rate_letter | other */
  kind?: string;
};

export const PHYSIO_CONTRACT_KINDS = [
  'practitioner_agreement',
  'nda',
  'rate_letter',
  'terms',
  'other',
] as const;

export type PsychiatryPractitioner = {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  /** Skills / disciplines (owner-managed catalogue) */
  disciplines?: string[];
  bio?: string;
  public_bio?: string;
  photo_url?: string;
  rate_zar?: number | null;
  /** hourly | per_session | per_appointment | monthly | fixed | package */
  rate_basis?: PsychiatryRateBasis | null;
  /** Optional owner note about rate (e.g. "incl. home visit travel") */
  rate_note?: string;
  active?: boolean;
  /**
   * Current engagement start (owner-set).
   * Defaults to created_at date when first saved.
   */
  start_date?: string | null;
  /**
   * Current engagement end (owner-set).
   * Null while still active; set when leaving / contract ends.
   */
  end_date?: string | null;
  /** Owner-uploaded PDF contracts (agreements, NDAs, rate letters) */
  contracts?: PsychiatryContractDoc[];
  /** Closed past engagements (keep history when practitioner returns) */
  history?: PsychiatryEngagement[];
  portal_token?: string | null;
  /** Can manage own diary slots */
  can_manage?: boolean;
  created_at: string;
};

export function formatPractitionerRate(
  rateZar?: number | null,
  basis?: PsychiatryRateBasis | null
): string {
  if (rateZar == null || !Number.isFinite(Number(rateZar))) return '—';
  const n = Number(rateZar);
  const money = `R${n.toLocaleString('en-ZA', {
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
  const b = String(basis || 'per_session').replace(/_/g, ' ');
  return `${money} / ${b}`;
}

/** Archive current stint into history when ending engagement */
export function closePractitionerEngagement(
  person: PsychiatryPractitioner,
  endDate: string,
  opts?: { note?: string; reason?: string; nowIso?: string }
): PsychiatryPractitioner {
  const start =
    person.start_date ||
    (person.created_at || opts?.nowIso || new Date().toISOString()).slice(0, 10);
  const end = endDate || new Date().toISOString().slice(0, 10);
  const hist = [...(person.history || [])];
  const already = hist.some(
    (h) => h.start_date === start && h.end_date === end
  );
  if (!already && start) {
    hist.push({
      id: newId('eng'),
      start_date: start,
      end_date: end,
      note: opts?.note,
      ended_reason: opts?.reason,
      rate_zar:
        person.rate_zar != null && Number.isFinite(Number(person.rate_zar))
          ? Number(person.rate_zar)
          : null,
      rate_basis: person.rate_basis || undefined,
    });
  }
  hist.sort((a, b) => b.start_date.localeCompare(a.start_date));
  return {
    ...person,
    history: hist,
    start_date: start,
    end_date: end,
    active: false,
  };
}

/** Start a new engagement (rehire) — keeps history */
export function reopenPractitionerEngagement(
  person: PsychiatryPractitioner,
  startDate: string
): PsychiatryPractitioner {
  return {
    ...person,
    start_date: startDate,
    end_date: null,
    active: true,
  };
}

/** Rename a discipline across the catalogue and all practitioners */
export function renamePractitionerDiscipline(
  store: PsychiatrygraphStore,
  from: string,
  to: string
): { ok: true; options: string[] } | { ok: false; error: string } {
  const src = String(from || '').trim();
  const dest = String(to || '').trim();
  if (!src) return { ok: false, error: 'Current discipline name required' };
  if (!dest) return { ok: false, error: 'New discipline name required' };
  if (src.toLowerCase() === dest.toLowerCase() && src === dest) {
    return { ok: true, options: getDisciplineOptions(store) };
  }

  const options = getDisciplineOptions(store).filter(
    (s) => s.toLowerCase() !== src.toLowerCase()
  );
  if (!options.some((s) => s.toLowerCase() === dest.toLowerCase())) {
    options.push(dest);
  }
  if (!store.settings) store.settings = defaultPublicSettings();
  store.settings.practitioner_disciplines = options;

  for (const p of store.practitioners || []) {
    if (!p.disciplines?.length) continue;
    p.disciplines = p.disciplines.map((s) =>
      s.toLowerCase() === src.toLowerCase() ? dest : s
    );
    const seen = new Set<string>();
    p.disciplines = p.disciplines.filter((s) => {
      const k = s.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  return { ok: true, options: getDisciplineOptions(store) };
}

/** Add a discipline to the clinic catalogue */
export function addPractitionerDiscipline(
  store: PsychiatrygraphStore,
  name: string
): { ok: true; options: string[] } | { ok: false; error: string } {
  const n = String(name || '').trim();
  if (!n) return { ok: false, error: 'Discipline name required' };
  if (n.length > 48) return { ok: false, error: 'Keep discipline under 48 characters' };
  const options = getDisciplineOptions(store);
  if (options.some((s) => s.toLowerCase() === n.toLowerCase())) {
    return { ok: false, error: 'That discipline already exists' };
  }
  if (!store.settings) store.settings = defaultPublicSettings();
  store.settings.practitioner_disciplines = [...options, n];
  return { ok: true, options: store.settings.practitioner_disciplines };
}

/** Remove from catalogue (optionally strip from practitioners) */
export function removePractitionerDiscipline(
  store: PsychiatrygraphStore,
  name: string,
  opts?: { stripFromPractitioners?: boolean }
): { ok: true; options: string[] } | { ok: false; error: string } {
  const n = String(name || '').trim();
  if (!n) return { ok: false, error: 'Discipline name required' };
  const options = getDisciplineOptions(store).filter(
    (s) => s.toLowerCase() !== n.toLowerCase()
  );
  if (!options.length) {
    return { ok: false, error: 'Keep at least one discipline' };
  }
  if (!store.settings) store.settings = defaultPublicSettings();
  store.settings.practitioner_disciplines = options;
  if (opts?.stripFromPractitioners) {
    for (const p of store.practitioners || []) {
      if (!p.disciplines?.length) continue;
      p.disciplines = p.disciplines.filter(
        (s) => s.toLowerCase() !== n.toLowerCase()
      );
      if (!p.disciplines.length) p.disciplines = ['General'];
    }
  }
  return { ok: true, options };
}

/**
 * Clinical / injury awareness — practitioners update so the whole team
 * knows body region, side, status, goals and contraindications.
 */
export type PsychiatryClinicalProfile =
  import('@/lib/health/body-map').PersonHealthProfile;

export type PsychiatryPatient = {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  /** Profile photo (public storage URL) */
  photo_url?: string;
  /** Token for patient self-serve portal (book open diary slots) */
  portal_token?: string | null;
  status?: (typeof PATIENT_STATUSES)[number] | string;
  practitioner_id?: string | null;
  package_id?: string | null;
  /** @deprecated prefer clinical.diagnosis_notes — kept for older records */
  diagnosis_notes?: string;
  emergency_contact?: string;
  notes?: string;
  /** Injury, diagnosis, pain, goals, contraindications */
  clinical?: PsychiatryClinicalProfile;
  /** Full medical chart: aid, documents, claims */
  medical?: import('@/lib/clinic/patient-medical').PatientMedicalRecord;
  /**
   * Household / family (kids, dependents) — parent email often on the primary patient.
   */
  family?: import('@/lib/services/family-members').FamilyMember[];
  /** VerifyNow (SA) or Didit (international) self-serve identity check */
  identity?: import('@/lib/identity/person-verification').PersonIdentityVerification;
  start_date?: string | null;
  active?: boolean;
  created_at: string;
  updated_at: string;
};

export type PsychiatryService = {
  id: string;
  code: string;
  name: string;
  /** minutes */
  default_duration_min?: number;
  price_zar?: number;
  description?: string;
  active?: boolean;
  created_at: string;
};

export type PsychiatryPackage = {
  id: string;
  code: string;
  name: string;
  sessions_total: number;
  price_zar: number;
  description?: string;
  active?: boolean;
  created_at: string;
};

export type PsychiatryAppointment = {
  id: string;
  service_id: string;
  practitioner_id?: string | null;
  date: string;
  start_time: string;
  end_time?: string | null;
  duration_min?: number | null;
  location?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  public?: boolean;
  notes?: string;
  public_notes?: string;
  created_at: string;
};

export type PsychiatryBooking = {
  id: string;
  appointment_id: string;
  patient_id: string;
  status: 'booked' | 'waitlist' | 'cancelled' | 'attended' | 'no_show';
  booked_at: string;
  source?: 'desk' | 'website' | 'practitioner' | string;
  notes?: string;
  /** Issued when marked attended — public feedback link */
  feedback_token?: string | null;
  feedback_requested_at?: string | null;
  feedback_submitted_at?: string | null;
  feedback_id?: string | null;
};

export type PsychiatryPublicSettings = {
  enabled: boolean;
  public_token: string;
  brand_name?: string;
  website_url?: string;
  public_bio?: string;
  allow_public_booking: boolean;
  show_practitioners: boolean;
  show_pricing: boolean;
  timezone?: string;
  contact_email?: string;
  contact_phone?: string;
  embed_primary_color?: string;
  practitioner_disciplines?: string[];
  /** Clinic open days & hours for schedule calendar */
  working_hours?: import('@/lib/schedule/working-hours').WorkingHours;
};

export type PsychiatrygraphStore = {
  practitioners: PsychiatryPractitioner[];
  patients: PsychiatryPatient[];
  services: PsychiatryService[];
  packages: PsychiatryPackage[];
  appointments: PsychiatryAppointment[];
  bookings: PsychiatryBooking[];
  /** Desk · practitioner · patient messaging threads */
  threads?: import('@/lib/messaging/service-inbox').ServiceThread[];
  /** Patient post-visit feedback */
  appointment_feedback?: import('@/lib/services/booking-feedback').ServiceFeedback[];
  settings?: PsychiatryPublicSettings;
  updated_at?: string;
};

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultPublicSettings(companyId?: number): PsychiatryPublicSettings {
  return {
    enabled: false,
    public_token:
      companyId != null
        ? `psyg_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
        : `psyg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    allow_public_booking: true,
    show_practitioners: true,
    show_pricing: true,
    timezone: 'Africa/Johannesburg',
    embed_primary_color: '#6366f1',
    practitioner_disciplines: [...DEFAULT_PRACTITIONER_DISCIPLINES],
  };
}

export function emptyPsychiatrygraphStore(): PsychiatrygraphStore {
  return {
    practitioners: [],
    patients: [],
    services: [],
    packages: [],
    appointments: [],
    bookings: [],
    threads: [],
    appointment_feedback: [],
    settings: defaultPublicSettings(),
  };
}

export function readPsychiatrygraphFromMetadata(
  meta: Record<string, unknown> | null | undefined
): PsychiatrygraphStore {
  if (!meta || typeof meta !== 'object') return emptyPsychiatrygraphStore();
  const raw = meta[PSYCHIATRYGRAPH_META_KEY];
  if (!raw || typeof raw !== 'object') return emptyPsychiatrygraphStore();
  const s = raw as Partial<PsychiatrygraphStore>;
  const e = emptyPsychiatrygraphStore();
  for (const key of Object.keys(e) as Array<keyof PsychiatrygraphStore>) {
    if (key === 'updated_at' || key === 'settings') continue;
    const v = s[key];
    (e as Record<string, unknown>)[key] = Array.isArray(v) ? v : [];
  }
  e.settings = {
    ...defaultPublicSettings(),
    ...(s.settings && typeof s.settings === 'object' ? s.settings : {}),
  };
  if (!e.settings.public_token) {
    e.settings.public_token = defaultPublicSettings().public_token;
  }
  e.updated_at = s.updated_at ? String(s.updated_at) : undefined;
  return e;
}

export const PSYCHIATRYGRAPH_PATIENT_TOKENS_KEY = 'psychiatrygraph_patient_tokens';

export function writePsychiatrygraphToMetadata(
  meta: Record<string, unknown>,
  store: PsychiatrygraphStore
): Record<string, unknown> {
  const patientTokens: Record<string, string> = {};
  for (const p of store.patients || []) {
    if (p.portal_token) patientTokens[String(p.portal_token)] = p.id;
  }
  return {
    ...meta,
    [PSYCHIATRYGRAPH_META_KEY]: {
      ...store,
      updated_at: new Date().toISOString(),
    },
    [PSYCHIATRYGRAPH_PATIENT_TOKENS_KEY]: patientTokens,
  };
}

/** Issue patient portal token (self-serve diary booking). */
export function issuePatientPortalToken(companyId: number): string {
  return `psyp_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function parsePsychiatryCompanyIdFromToken(token: string): number | null {
  const m = /^psyp_(\d+)_/.exec(token);
  if (m) return Number(m[1]);
  const pg = /^psyg_(\d+)_/.exec(token);
  if (pg) return Number(pg[1]);
  return null;
}

/** @deprecated use parsePsychiatryCompanyIdFromToken */
export const parsePhysioCompanyIdFromToken = parsePsychiatryCompanyIdFromToken;

/**
 * Patient portal: open public diary slots with vacancies + this patient's bookings.
 */
export function buildPatientPortalPayload(
  store: PsychiatrygraphStore,
  patient: PsychiatryPatient,
  from?: string,
  to?: string
) {
  const start = from || new Date().toISOString().slice(0, 10);
  const endDate = new Date(start + 'T12:00:00');
  endDate.setDate(endDate.getDate() + 28);
  const end = to || endDate.toISOString().slice(0, 10);

  const open_slots = store.appointments
    .filter(
      (a) =>
        a.public === true &&
        a.status === 'scheduled' &&
        a.date >= start &&
        a.date <= end
    )
    .map((a) => {
      const svc = store.services.find((s) => s.id === a.service_id);
      const prac = store.practitioners.find((p) => p.id === a.practitioner_id);
      const booked = appointmentBookingCount(store, a.id);
      // Clinic slots are typically capacity 1
      const capacity = 1;
      const full = booked >= capacity;
      const myBooking = store.bookings.find(
        (b) =>
          b.appointment_id === a.id &&
          b.patient_id === patient.id &&
          (b.status === 'booked' ||
            b.status === 'waitlist' ||
            b.status === 'attended')
      );
      return {
        id: a.id,
        date: a.date,
        start_time: a.start_time,
        end_time: a.end_time,
        duration_min: a.duration_min ?? svc?.default_duration_min ?? 45,
        service_name: svc?.name || 'Appointment',
        practitioner_name: prac?.name,
        location: a.location,
        capacity,
        spots_left: Math.max(0, capacity - booked),
        full,
        public_notes: a.public_notes,
        my_status: myBooking?.status || null,
        my_booking_id: myBooking?.id || null,
      };
    })
    .sort((a, b) =>
      a.date === b.date
        ? a.start_time.localeCompare(b.start_time)
        : a.date.localeCompare(b.date)
    );

  const my_bookings = store.bookings
    .filter((b) => {
      if (b.patient_id !== patient.id || b.status === 'cancelled') return false;
      const a = store.appointments.find((x) => x.id === b.appointment_id);
      return a && a.date >= start;
    })
    .map((b) => {
      const a = store.appointments.find((x) => x.id === b.appointment_id)!;
      const svc = store.services.find((s) => s.id === a.service_id);
      const prac = store.practitioners.find((p) => p.id === a.practitioner_id);
      return {
        booking_id: b.id,
        status: b.status,
        appointment_id: a.id,
        date: a.date,
        start_time: a.start_time,
        service_name: svc?.name || 'Appointment',
        practitioner_name: prac?.name,
        location: a.location,
      };
    })
    .sort((a, b) =>
      a.date === b.date
        ? a.start_time.localeCompare(b.start_time)
        : a.date.localeCompare(b.date)
    );

  return {
    brand: store.settings?.brand_name || 'Clinic',
    bio: store.settings?.public_bio,
    timezone: store.settings?.timezone || 'Africa/Johannesburg',
    allow_booking: store.settings?.allow_public_booking !== false,
    contact_email: store.settings?.contact_email,
    contact_phone: store.settings?.contact_phone,
    primary_color: store.settings?.embed_primary_color || '#6366f1',
    from: start,
    to: end,
    patient: {
      id: patient.id,
      code: patient.code,
      name: patient.name,
      email: patient.email,
      phone: patient.phone,
      id_number: patient.medical?.id_number || undefined,
      photo_url: patient.photo_url,
      status: patient.status,
      identity: {
        status: String(patient.identity?.status || 'unverified'),
        provider: patient.identity?.provider || null,
        verified_at: patient.identity?.verified_at || null,
        verified_name: patient.identity?.verified_name || null,
        status_text: patient.identity?.status_text || null,
        is_verified: patient.identity?.status === 'verified',
      },
      family: Array.isArray(patient.family) ? patient.family : [],
    },
    open_slots,
    vacancies: open_slots.filter((s) => !s.full && !s.my_status),
    my_bookings,
    open_count: open_slots.filter((s) => !s.full).length,
    full_count: open_slots.filter((s) => s.full && !s.my_status).length,
  };
}

export function ensurePublicToken(
  settings: PsychiatryPublicSettings | undefined,
  companyId?: number
): PsychiatryPublicSettings {
  const base: PsychiatryPublicSettings = {
    ...defaultPublicSettings(companyId),
    ...(settings || {}),
  };
  if (!base.public_token) {
    base.public_token = defaultPublicSettings(companyId).public_token;
  }
  return base;
}

export function getDisciplineOptions(
  store?: PsychiatrygraphStore | null
): string[] {
  const custom = store?.settings?.practitioner_disciplines;
  const base =
    Array.isArray(custom) && custom.length
      ? custom.map(String)
      : [...DEFAULT_PRACTITIONER_DISCIPLINES];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of base) {
    const t = s.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  for (const p of store?.practitioners || []) {
    for (const d of p.disciplines || []) {
      const t = String(d).trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
  }
  return out.length ? out : [...DEFAULT_PRACTITIONER_DISCIPLINES];
}

export function summarisePsychiatrygraph(store: PsychiatrygraphStore) {
  const practitioners = store.practitioners.filter((p) => p.active !== false);
  const patients = store.patients.filter((p) => p.active !== false);
  const activePatients = patients.filter(
    (p) => p.status === 'active' || p.status === 'new'
  );
  const today = new Date().toISOString().slice(0, 10);
  const apptsToday = store.appointments.filter(
    (a) => a.date === today && a.status !== 'cancelled'
  );
  const openBookings = store.bookings.filter(
    (b) => b.status === 'booked' || b.status === 'waitlist'
  );
  return {
    practitionerCount: practitioners.length,
    patientCount: patients.length,
    activePatients: activePatients.length,
    serviceCount: store.services.filter((s) => s.active !== false).length,
    packageCount: store.packages.filter((p) => p.active !== false).length,
    appointmentsToday: apptsToday.length,
    appointmentsUpcoming: store.appointments.filter(
      (a) => a.date >= today && a.status === 'scheduled'
    ).length,
    bookingsOpen: openBookings.length,
    websiteEnabled: store.settings?.enabled === true,
    threadCount: (store.threads || []).filter((t) => !t.archived).length,
    unreadMessages: totalUnread(store.threads || [], 'desk', 'desk'),
    pendingFeedback: (store.bookings || []).filter(
      (b) =>
        b.status === 'attended' &&
        b.feedback_token &&
        !b.feedback_submitted_at
    ).length,
    feedbackCount: (store.appointment_feedback || []).length,
  };
}

export function appointmentBookingCount(
  store: PsychiatrygraphStore,
  appointmentId: string
): number {
  return store.bookings.filter(
    (b) =>
      b.appointment_id === appointmentId &&
      (b.status === 'booked' || b.status === 'attended')
  ).length;
}

export function appointmentsInRange(
  store: PsychiatrygraphStore,
  from: string,
  to: string
): PsychiatryAppointment[] {
  return store.appointments
    .filter((a) => a.date >= from && a.date <= to && a.status !== 'cancelled')
    .sort((a, b) =>
      a.date === b.date
        ? a.start_time.localeCompare(b.start_time)
        : a.date.localeCompare(b.date)
    );
}

export function seedDemoPsychiatrygraph(
  now: string,
  companyId?: number
): PsychiatrygraphStore {
  const d = (offset: number) => {
    const x = new Date(now);
    x.setDate(x.getDate() + offset);
    return x.toISOString().slice(0, 10);
  };
  const p1 = newId('prac');
  const p2 = newId('prac');
  const pat1 = newId('pat');
  const pat2 = newId('pat');
  const svc1 = newId('svc');
  const svc2 = newId('svc');
  const pkg1 = newId('pkg');
  const apt1 = newId('apt');
  const apt2 = newId('apt');
  const cid = companyId ?? 0;

  return {
    settings: {
      ...defaultPublicSettings(cid > 0 ? cid : undefined),
      enabled: true,
      brand_name: 'MindCare Psychiatry',
      contact_email: 'hello@mindcare.example',
      contact_phone: '+27 11 000 3333',
      public_bio: 'Adult psychiatry & psychology — assessment, therapy and medication review.',
    },
    practitioners: [
      {
        id: p1,
        code: 'PR',
        name: 'Dr Priya Reddy',
        email: 'priya@mindcare.example',
        disciplines: ['Psychiatry', 'Adult psychiatry'],
        public_bio: 'Consultant psychiatrist · mood & anxiety disorders.',
        rate_zar: 1200,
        rate_basis: 'per_session',
        start_date: d(-120),
        active: true,
        created_at: now,
      },
      {
        id: p2,
        code: 'JM',
        name: 'Johan Meyer',
        email: 'johan@mindcare.example',
        disciplines: ['Clinical psychology'],
        public_bio: 'Clinical psychologist · CBT and trauma-informed care.',
        rate_zar: 950,
        rate_basis: 'per_session',
        start_date: d(-60),
        active: true,
        created_at: now,
      },
    ],
    patients: [
      {
        id: pat1,
        code: 'P-001',
        name: 'Thabo Molefe',
        email: 'thabo@example.com',
        phone: '0820001001',
        status: 'active',
        practitioner_id: p1,
        package_id: pkg1,
        start_date: d(-30),
        clinical: {
          injured: false,
          injury_areas: [],
          injury_side: 'n/a',
          injury_status: 'none',
          injury_onset: null,
          injury_notes: '',
          training_modifications: 'Avoid late-evening sessions if sleep hygiene plan active.',
          diagnosis_notes: 'Major depressive episode · medication review ongoing.',
          treatment_goals: 'Stabilise mood · improve sleep · return to work part-time.',
          pain_score: 3,
          contraindications: 'Open-chain terminal extension resistance early.',
          updated_at: now,
          updated_by: 'prac:Dr Priya Reddy',
        },
        diagnosis_notes: 'ACL reconstruction (right) · progressive return to run.',
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: pat2,
        code: 'P-002',
        name: 'Aisha Naidoo',
        email: 'aisha@example.com',
        status: 'new',
        practitioner_id: p2,
        start_date: d(-3),
        clinical: {
          injured: true,
          injury_areas: ['Shoulder'],
          injury_side: 'left',
          injury_status: 'acute',
          injury_onset: d(-10),
          injury_notes: 'Rotator cuff irritation after overhead work.',
          training_modifications: 'Avoid overhead press and kipping until cleared.',
          treatment_goals: 'Pain-free ADLs · restore scapular control.',
          pain_score: 5,
          updated_at: now,
          updated_by: 'prac:Johan Meyer',
        },
        active: true,
        created_at: now,
        updated_at: now,
      },
    ],
    services: [
      {
        id: svc1,
        code: 'ASS',
        name: 'Initial assessment',
        default_duration_min: 60,
        price_zar: 850,
        active: true,
        created_at: now,
      },
      {
        id: svc2,
        code: 'RX',
        name: 'Treatment session',
        default_duration_min: 45,
        price_zar: 650,
        active: true,
        created_at: now,
      },
    ],
    packages: [
      {
        id: pkg1,
        code: '6PACK',
        name: '6-session rehab pack',
        sessions_total: 6,
        price_zar: 3600,
        description: 'Six treatment sessions with assigned practitioner.',
        active: true,
        created_at: now,
      },
    ],
    appointments: [
      {
        id: apt1,
        service_id: svc1,
        practitioner_id: p1,
        date: d(0),
        start_time: '09:00',
        duration_min: 60,
        location: 'Room 1',
        status: 'scheduled',
        public: true,
        created_at: now,
      },
      {
        id: apt2,
        service_id: svc2,
        practitioner_id: p2,
        date: d(1),
        start_time: '14:00',
        duration_min: 45,
        location: 'Gym floor',
        status: 'scheduled',
        public: true,
        created_at: now,
      },
    ],
    bookings: [
      {
        id: newId('bkg'),
        appointment_id: apt1,
        patient_id: pat1,
        status: 'booked',
        booked_at: now,
        source: 'desk',
      },
    ],
    threads: [
      {
        id: newId('thr'),
        channel: 'practitioner_patient',
        subject: 'ACL rehab check-in · Thabo Molefe',
        participants: [
          { role: 'desk', ref_id: 'desk', name: 'Front desk' },
          { role: 'practitioner', ref_id: p1, name: 'Dr Priya Reddy' },
          { role: 'patient', ref_id: pat1, name: 'Thabo Molefe' },
        ],
        messages: [
          {
            id: newId('msg'),
            body: 'Thabo is week 8 post-ACL — please stick to closed-chain only and reassess swelling before loading stairs.',
            author_role: 'practitioner',
            author_ref_id: p1,
            author_name: 'Dr Priya Reddy',
            created_at: now,
            read_by: [`practitioner:${p1}`],
          },
          {
            id: newId('msg'),
            body: 'Noted at reception — we’ll confirm home exercises on arrival tomorrow.',
            author_role: 'desk',
            author_ref_id: 'desk',
            author_name: 'Front desk',
            created_at: now,
            read_by: ['desk:desk'],
          },
        ],
        created_at: now,
        updated_at: now,
      },
      {
        id: newId('thr'),
        channel: 'practitioner_colleague',
        subject: 'Shoulder case · Aisha',
        participants: [
          { role: 'desk', ref_id: 'desk', name: 'Front desk' },
          { role: 'practitioner', ref_id: p1, name: 'Dr Priya Reddy' },
          { role: 'practitioner', ref_id: p2, name: 'Johan Meyer' },
        ],
        messages: [
          {
            id: newId('msg'),
            body: 'Aisha’s cuff irritation — happy for biokinetics to take scapular control block once pain <3/10.',
            author_role: 'practitioner',
            author_ref_id: p1,
            author_name: 'Dr Priya Reddy',
            created_at: now,
            read_by: [`practitioner:${p1}`],
          },
        ],
        created_at: now,
        updated_at: now,
      },
    ],
  };
}
