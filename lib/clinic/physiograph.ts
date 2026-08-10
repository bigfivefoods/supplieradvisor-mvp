/**
 * Physiograph® — tertiary / services clinic OS (physio, OT, biokinetics, etc.).
 * Practitioners, patients, services, packages, appointments, bookings.
 * Stored on profiles.metadata.physiograph.
 */

import { totalUnread } from '@/lib/messaging/service-inbox';

export const PHYSIOGRAPH_MODULE_ID = 'physiograph' as const;
export const PHYSIOGRAPH_META_KEY = 'physiograph';

export const PRACTITIONER_DISCIPLINES = [
  'Physiotherapy',
  'Occupational therapy',
  'Biokinetics',
  'Chiropractic',
  'Sports medicine',
  'Massage therapy',
  'Podiatry',
  'Speech therapy',
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

export type PhysioPractitioner = {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  disciplines?: string[];
  bio?: string;
  public_bio?: string;
  photo_url?: string;
  rate_zar?: number | null;
  /** hourly | per_session | package */
  rate_basis?: string | null;
  active?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  portal_token?: string | null;
  created_at: string;
};

/**
 * Clinical / injury awareness — practitioners update so the whole team
 * knows body region, side, status, goals and contraindications.
 */
export type PhysioClinicalProfile =
  import('@/lib/health/body-map').PersonHealthProfile;

export type PhysioPatient = {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  status?: (typeof PATIENT_STATUSES)[number] | string;
  practitioner_id?: string | null;
  package_id?: string | null;
  /** @deprecated prefer clinical.diagnosis_notes — kept for older records */
  diagnosis_notes?: string;
  emergency_contact?: string;
  notes?: string;
  /** Injury, diagnosis, pain, goals, contraindications */
  clinical?: PhysioClinicalProfile;
  start_date?: string | null;
  active?: boolean;
  created_at: string;
  updated_at: string;
};

export type PhysioService = {
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

export type PhysioPackage = {
  id: string;
  code: string;
  name: string;
  sessions_total: number;
  price_zar: number;
  description?: string;
  active?: boolean;
  created_at: string;
};

export type PhysioAppointment = {
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

export type PhysioBooking = {
  id: string;
  appointment_id: string;
  patient_id: string;
  status: 'booked' | 'waitlist' | 'cancelled' | 'attended' | 'no_show';
  booked_at: string;
  source?: 'desk' | 'website' | 'practitioner' | string;
  notes?: string;
};

export type PhysioPublicSettings = {
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
};

export type PhysiographStore = {
  practitioners: PhysioPractitioner[];
  patients: PhysioPatient[];
  services: PhysioService[];
  packages: PhysioPackage[];
  appointments: PhysioAppointment[];
  bookings: PhysioBooking[];
  /** Desk · practitioner · patient messaging threads */
  threads?: import('@/lib/messaging/service-inbox').ServiceThread[];
  settings?: PhysioPublicSettings;
  updated_at?: string;
};

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultPublicSettings(companyId?: number): PhysioPublicSettings {
  return {
    enabled: false,
    public_token:
      companyId != null
        ? `pg_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
        : `pg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    allow_public_booking: true,
    show_practitioners: true,
    show_pricing: true,
    timezone: 'Africa/Johannesburg',
    embed_primary_color: '#0d9488',
    practitioner_disciplines: [...DEFAULT_PRACTITIONER_DISCIPLINES],
  };
}

export function emptyPhysiographStore(): PhysiographStore {
  return {
    practitioners: [],
    patients: [],
    services: [],
    packages: [],
    appointments: [],
    bookings: [],
    threads: [],
    settings: defaultPublicSettings(),
  };
}

export function readPhysiographFromMetadata(
  meta: Record<string, unknown> | null | undefined
): PhysiographStore {
  if (!meta || typeof meta !== 'object') return emptyPhysiographStore();
  const raw = meta[PHYSIOGRAPH_META_KEY];
  if (!raw || typeof raw !== 'object') return emptyPhysiographStore();
  const s = raw as Partial<PhysiographStore>;
  const e = emptyPhysiographStore();
  for (const key of Object.keys(e) as Array<keyof PhysiographStore>) {
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

export function writePhysiographToMetadata(
  meta: Record<string, unknown>,
  store: PhysiographStore
): Record<string, unknown> {
  return {
    ...meta,
    [PHYSIOGRAPH_META_KEY]: {
      ...store,
      updated_at: new Date().toISOString(),
    },
  };
}

export function ensurePublicToken(
  settings: PhysioPublicSettings | undefined,
  companyId?: number
): PhysioPublicSettings {
  const base: PhysioPublicSettings = {
    ...defaultPublicSettings(companyId),
    ...(settings || {}),
  };
  if (!base.public_token) {
    base.public_token = defaultPublicSettings(companyId).public_token;
  }
  return base;
}

export function getDisciplineOptions(
  store?: PhysiographStore | null
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

export function summarisePhysiograph(store: PhysiographStore) {
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
  };
}

export function appointmentBookingCount(
  store: PhysiographStore,
  appointmentId: string
): number {
  return store.bookings.filter(
    (b) =>
      b.appointment_id === appointmentId &&
      (b.status === 'booked' || b.status === 'attended')
  ).length;
}

export function appointmentsInRange(
  store: PhysiographStore,
  from: string,
  to: string
): PhysioAppointment[] {
  return store.appointments
    .filter((a) => a.date >= from && a.date <= to && a.status !== 'cancelled')
    .sort((a, b) =>
      a.date === b.date
        ? a.start_time.localeCompare(b.start_time)
        : a.date.localeCompare(b.date)
    );
}

export function seedDemoPhysiograph(
  now: string,
  companyId?: number
): PhysiographStore {
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
      brand_name: 'MotionCare Physio',
      contact_email: 'hello@motioncare.example',
      contact_phone: '+27 11 000 2222',
      public_bio: 'Sports physio & rehab clinic — assessments to return-to-play.',
    },
    practitioners: [
      {
        id: p1,
        code: 'PR',
        name: 'Dr Priya Reddy',
        email: 'priya@motioncare.example',
        disciplines: ['Physiotherapy', 'Sports medicine'],
        public_bio: 'Sports physio · ACL & shoulder rehab.',
        rate_zar: 750,
        rate_basis: 'per_session',
        start_date: d(-120),
        active: true,
        created_at: now,
      },
      {
        id: p2,
        code: 'JM',
        name: 'Johan Meyer',
        email: 'johan@motioncare.example',
        disciplines: ['Biokinetics'],
        public_bio: 'Biokinetics · strength return-to-play programmes.',
        rate_zar: 650,
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
          injured: true,
          injury_areas: ['Knee'],
          injury_side: 'right',
          injury_status: 'recovering',
          injury_onset: d(-45),
          injury_notes: 'Post-ACL reconstruction week 8 — swelling intermittent.',
          training_modifications: 'No deep knee flexion load; closed-chain only as prescribed.',
          diagnosis_notes: 'ACL reconstruction (right) · progressive return to run.',
          treatment_goals: 'Full ROM · light jog by week 12 · return-to-play criteria.',
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
