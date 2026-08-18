/**
 * DentalAdvisor® — tertiary / services dental practice OS.
 * Dentists, hygienists, assistants (staff), patients, services, care plans, diary, bookings.
 * Stored on profiles.metadata.dentalgraph.
 */

import { totalUnread } from '@/lib/messaging/service-inbox';
import {
  portalMessagesUnread,
  portalThreadsForPerson,
} from '@/lib/services/clinic-portal-messaging';
import {
  buildPatientMedicalShare,
  buildSharedAdvice,
} from '@/lib/clinic/medical-share';
import {
  followUpsAsAdvice,
  patientFacingFollowUps,
} from '@/lib/clinic/patient-follow-up';
import { publishedAnnouncements } from '@/lib/services/member-announcements';
import { logoUrlFromSettings } from '@/lib/business/company-logo';
import { ensureSystemPersonalService } from '@/lib/clinic/appointment-kind';
import { toPortalOpenSlots } from '@/lib/services/advisor-member-calendar';
import { clinicCommandBookingMetrics } from '@/lib/advisors/command-booking-metrics';

export const DENTALGRAPH_MODULE_ID = 'dentalgraph' as const;
export const DENTALGRAPH_META_KEY = 'dentalgraph';

export const STAFF_ROLES = [
  'Dentist',
  'Dental hygienist',
  'Oral hygienist',
  'Dental therapist',
  'Dental assistant',
  'Reception',
  'Practice manager',
  'Specialist (ortho)',
  'Specialist (endo)',
  'Specialist (periodontics)',
  'Specialist (oral surgery)',
  'General',
] as const;

/** Common dental treatment / concern sites (chart shorthand) */
export const DENTAL_SITES = [
  'Upper right (UR)',
  'Upper left (UL)',
  'Lower left (LL)',
  'Lower right (LR)',
  'Anterior / smile zone',
  'Molars',
  'Wisdom teeth',
  'Gums / periodontium',
  'TMJ / jaw',
  'Full mouth',
  'Other',
] as const;

export const DEFAULT_STAFF_ROLES: string[] = [
  ...STAFF_ROLES,
];

export const PATIENT_STATUSES = [
  'active',
  'new',
  'discharged',
  'on_hold',
  'cancelled',
] as const;

/** How the owner pays / prices a staff member */
export const STAFF_RATE_BASES = [
  'hourly',
  'per_session',
  'per_appointment',
  'monthly',
  'fixed',
  'package',
] as const;

export type DentalRateBasis = (typeof STAFF_RATE_BASES)[number] | string;

/** One closed employment / engagement period for a staff member */
export type DentalEngagement = {
  id: string;
  /** YYYY-MM-DD */
  start_date: string;
  /** YYYY-MM-DD */
  end_date: string;
  note?: string;
  ended_reason?: string;
  rate_zar?: number | null;
  rate_basis?: DentalRateBasis;
};

/** PDF (or doc) contract attached to a staff engagement */
export type DentalContractDoc = {
  id: string;
  title: string;
  file_name: string;
  /** Public storage URL */
  url: string;
  uploaded_at: string;
  /** staff_agreement | nda | rate_letter | other */
  kind?: string;
};

export const DENTAL_CONTRACT_KINDS = [
  'staff_agreement',
  'nda',
  'rate_letter',
  'terms',
  'other',
] as const;

export type DentalStaff = {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  /** SA ID / passport for VerifyNow (SA) or Didit (international) */
  id_number?: string;
  identity?: import('@/lib/identity/person-verification').PersonIdentityVerification;
  /** Linked People / HR employee id (dual-write) */
  hr_employee_id?: number | null;
  /** Roles / skills (owner-managed catalogue) */
  roles?: string[];
  bio?: string;
  public_bio?: string;
  qualifications?: import('@/lib/services/person-qualifications').PersonQualification[];
  photo_url?: string;
  rate_zar?: number | null;
  /** hourly | per_session | per_appointment | monthly | fixed | package */
  rate_basis?: DentalRateBasis | null;
  /** Optional owner note about rate */
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
  contracts?: DentalContractDoc[];
  /** Closed past engagements (keep history when staff returns) */
  history?: DentalEngagement[];
  portal_token?: string | null;
  /** Can manage own diary slots */
  can_manage?: boolean;
  created_at: string;
} & import('@/lib/services/advisor-workforce').AdvisorPersonInviteFields;

export function formatStaffRate(
  rateZar?: number | null,
  basis?: DentalRateBasis | null
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
export function closeStaffEngagement(
  person: DentalStaff,
  endDate: string,
  opts?: { note?: string; reason?: string; nowIso?: string }
): DentalStaff {
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
export function reopenStaffEngagement(
  person: DentalStaff,
  startDate: string
): DentalStaff {
  return {
    ...person,
    start_date: startDate,
    end_date: null,
    active: true,
  };
}

/** Rename a role across the catalogue and all staff */
export function renameStaffRole(
  store: DentalgraphStore,
  from: string,
  to: string
): { ok: true; options: string[] } | { ok: false; error: string } {
  const src = String(from || '').trim();
  const dest = String(to || '').trim();
  if (!src) return { ok: false, error: 'Current role name required' };
  if (!dest) return { ok: false, error: 'New role name required' };
  if (src.toLowerCase() === dest.toLowerCase() && src === dest) {
    return { ok: true, options: getStaffRoleOptions(store) };
  }

  const options = getStaffRoleOptions(store).filter(
    (s) => s.toLowerCase() !== src.toLowerCase()
  );
  if (!options.some((s) => s.toLowerCase() === dest.toLowerCase())) {
    options.push(dest);
  }
  if (!store.settings) store.settings = defaultDentalPublicSettings();
  store.settings.staff_roles = options;

  for (const p of store.staff || []) {
    if (!p.roles?.length) continue;
    p.roles = p.roles.map((s) =>
      s.toLowerCase() === src.toLowerCase() ? dest : s
    );
    const seen = new Set<string>();
    p.roles = p.roles.filter((s) => {
      const k = s.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  return { ok: true, options: getStaffRoleOptions(store) };
}

/** Add a role to the practice catalogue */
export function addStaffRole(
  store: DentalgraphStore,
  name: string
): { ok: true; options: string[] } | { ok: false; error: string } {
  const n = String(name || '').trim();
  if (!n) return { ok: false, error: 'Role name required' };
  if (n.length > 48) return { ok: false, error: 'Keep role under 48 characters' };
  const options = getStaffRoleOptions(store);
  if (options.some((s) => s.toLowerCase() === n.toLowerCase())) {
    return { ok: false, error: 'That role already exists' };
  }
  if (!store.settings) store.settings = defaultDentalPublicSettings();
  store.settings.staff_roles = [...options, n];
  return { ok: true, options: store.settings.staff_roles };
}

/** Remove from catalogue (optionally strip from staff) */
export function removeStaffRole(
  store: DentalgraphStore,
  name: string,
  opts?: { stripFromStaff?: boolean }
): { ok: true; options: string[] } | { ok: false; error: string } {
  const n = String(name || '').trim();
  if (!n) return { ok: false, error: 'Role name required' };
  const options = getStaffRoleOptions(store).filter(
    (s) => s.toLowerCase() !== n.toLowerCase()
  );
  if (!options.length) {
    return { ok: false, error: 'Keep at least one role' };
  }
  if (!store.settings) store.settings = defaultDentalPublicSettings();
  store.settings.staff_roles = options;
  if (opts?.stripFromStaff) {
    for (const p of store.staff || []) {
      if (!p.roles?.length) continue;
      p.roles = p.roles.filter((s) => s.toLowerCase() !== n.toLowerCase());
      if (!p.roles.length) p.roles = ['General'];
    }
  }
  return { ok: true, options };
}

/**
 * Clinical / injury awareness — staff update so the whole team
 * knows body region, side, status, goals and contraindications.
 */
export type DentalClinicalProfile =
  import('@/lib/health/body-map').PersonHealthProfile;

export type DentalPatient = {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  /** Profile photo (public storage URL) */
  photo_url?: string;
  /** Token for patient self-serve portal (book open diary slots) */
  portal_token?: string | null;
  /** Platform system user id once on SupplierAdvisor — in-app messaging key */
  platform_user_id?: string | null;
  /** Email invite to join as a patient and open the portal */
  invite_token?: string | null;
  invite_status?: string | null;
  invite_email?: string | null;
  invite_sent_at?: string | null;
  invite_accepted_at?: string | null;
  invite_expires_at?: string | null;
  /** Share medical chart summary on patient portal (default true after invite) */
  share_medical?: boolean;
  follow_ups?: import('@/lib/clinic/patient-follow-up').PatientFollowUp[];
  share_schedule?: boolean;
  share_feedback?: boolean;
  status?: (typeof PATIENT_STATUSES)[number] | string;
  staff_id?: string | null;
  package_id?: string | null;
  /** @deprecated prefer clinical.diagnosis_notes — kept for older records */
  diagnosis_notes?: string;
  emergency_contact?: string;
  notes?: string;
  /** Injury, diagnosis, pain, goals, contraindications */
  clinical?: DentalClinicalProfile;
  /** Full medical chart: aid, documents, claims */
  medical?: import('@/lib/clinic/patient-medical').PatientMedicalRecord;
  /**
   * Household / family (kids, dependents) — parent email often on the primary patient.
   */
  family?: import('@/lib/services/family-members').FamilyMember[];
  no_show_count?: number;
  last_no_show_at?: string | null;
  attended_count?: number;
  booking_soft_block?: boolean;
  popia_consent_at?: string | null;
  source?: string;
  joined_via?: string;
  desk_join_status?: 'pending' | 'accepted' | 'dismissed' | string | null;
  /** VerifyNow (SA) or Didit (international) self-serve identity check */
  identity?: import('@/lib/identity/person-verification').PersonIdentityVerification;
  start_date?: string | null;
  crm_customer_id?: number | null;
  active?: boolean;
  created_at: string;
  updated_at: string;
};

export type DentalService = {
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

export type DentalPackage = {
  id: string;
  code: string;
  name: string;
  sessions_total: number;
  price_zar: number;
  description?: string;
  active?: boolean;
  created_at: string;
};

export type DentalAppointment = {
  id: string;
  service_id: string;
  staff_id?: string | null;
  date: string;
  start_time: string;
  end_time?: string | null;
  duration_min?: number | null;
  location?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  public?: boolean;
  notes?: string;
  public_notes?: string;
  appointment_kind?: import('@/lib/clinic/appointment-kind').ClinicAppointmentKind;
  personal_reason?: import('@/lib/clinic/appointment-kind').ClinicPersonalReason | null;
  /** Links occurrences created as a repeating series */
  series_id?: string | null;
  /** Inventory items used on this visit (allocated after the meeting). */
  materials?: import('@/lib/dental/dental-appointment-inventory').DentalMaterialUsage[];
  created_at: string;
};

export type DentalBooking = {
  id: string;
  appointment_id: string;
  patient_id: string;
  status: 'booked' | 'waitlist' | 'cancelled' | 'attended' | 'no_show';
  booked_at: string;
  source?: 'desk' | 'website' | 'practitioner' | string;
  notes?: string;
  family_member_id?: string | null;
  family_member_name?: string | null;
  reminded_at?: string | null;
  reminder_count?: number;
  waitlist_offered_at?: string | null;
  waitlist_accepted_at?: string | null;
  /** Issued when marked attended — public feedback link */
  feedback_token?: string | null;
  feedback_requested_at?: string | null;
  feedback_submitted_at?: string | null;
  feedback_id?: string | null;
};

export type DentalPublicSettings = {
  enabled: boolean;
  public_token: string;
  brand_name?: string;
  website_url?: string;
  public_bio?: string;
  allow_public_booking: boolean;
  share_member_calendar?: boolean;
  generate_member_slots?: boolean;
  member_slot_minutes?: number;
  require_accept_join?: boolean;
  show_staff: boolean;
  show_pricing: boolean;
  portal_sections?: Record<string, boolean>;
  timezone?: string;
  contact_email?: string;
  contact_phone?: string;
  practice_number?: string;
  bhf_number?: string;
  vat_number?: string;
  pcns_number?: string;
  billing_email?: string;
  embed_primary_color?: string;
  staff_roles?: string[];
  /** Practice open days & hours for schedule calendar */
  working_hours?: import('@/lib/schedule/working-hours').WorkingHours;
  reschedule_policy?: import('@/lib/services/advisor-reschedule').ReschedulePolicy;
  marketplace?: {
    listed?: boolean;
    city?: string;
    blurb?: string;
    specialties?: string[];
  };
  /** Surgeries / chairs / bays as diary resources */
  rooms?: string[];
  has_front_desk?: boolean;
  desk_name?: string;
  desk_email?: string | null;
  desk_invite_status?: string | null;
  desk_invite_sent_at?: string | null;
  desk_invite_accepted_at?: string | null;
  desk_team_member_id?: number | null;
  desk_last_invited_email?: string | null;
};

export type DentalgraphStore = {
  staff: DentalStaff[];
  patients: DentalPatient[];
  services: DentalService[];
  packages: DentalPackage[];
  appointments: DentalAppointment[];
  bookings: DentalBooking[];
  /**
   * General "next available" waitlist (not tied to a single full slot).
   * Patients join when they want any open time / any clinician.
   */
  waitlist_queue?: import('@/lib/services/clinic-waitlist').ClinicWaitlistQueueEntry[];
  /** Care packs with session ledger */
  care_packs?: import('@/lib/services/advisor-pack-ledger').AdvisorPackLedgerEntry[];
  visit_notes?: import('@/lib/services/advisor-clinical').VisitNote[];
  record_shares?: import('@/lib/services/advisor-b2c-relationship').PatientRecordShareGrant[];
  outcome_scores?: import('@/lib/services/advisor-clinical').OutcomeScore[];
  treatment_plans?: import('@/lib/services/advisor-clinical').TreatmentPlan[];
  /** Desk · practitioner · patient messaging threads */
  threads?: import('@/lib/messaging/service-inbox').ServiceThread[];
  /** Patient post-visit feedback */
  appointment_feedback?: import('@/lib/services/booking-feedback').ServiceFeedback[];
  announcements?: import('@/lib/services/member-announcements').MemberAnnouncement[];
  desk_notices?: import('@/lib/services/advisor-member-calendar').DeskMemberNotice[];
  settings?: DentalPublicSettings;
  updated_at?: string;
};

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultDentalPublicSettings(companyId?: number): DentalPublicSettings {
  return {
    enabled: false,
    public_token:
      companyId != null
        ? `dg_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
        : `dg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    allow_public_booking: true,
    share_member_calendar: true,
    generate_member_slots: true,
    require_accept_join: false,
    show_staff: true,
    show_pricing: true,
    timezone: 'Africa/Johannesburg',
    embed_primary_color: '#0284c7',
    staff_roles: [...DEFAULT_STAFF_ROLES],
  };
}

export function emptyDentalgraphStore(): DentalgraphStore {
  return {
    staff: [],
    patients: [],
    services: [],
    packages: [],
    appointments: [],
    bookings: [],
    threads: [],
    appointment_feedback: [],
    announcements: [],
    desk_notices: [],
    record_shares: [],
    settings: defaultDentalPublicSettings(),
  };
}

export function readDentalgraphFromMetadata(
  meta: Record<string, unknown> | null | undefined
): DentalgraphStore {
  if (!meta || typeof meta !== 'object') return emptyDentalgraphStore();
  const raw = meta[DENTALGRAPH_META_KEY];
  if (!raw || typeof raw !== 'object') return emptyDentalgraphStore();
  const s = raw as Partial<DentalgraphStore>;
  const e = emptyDentalgraphStore();
  for (const key of Object.keys(e) as Array<keyof DentalgraphStore>) {
    if (key === 'updated_at' || key === 'settings') continue;
    const v = s[key];
    (e as Record<string, unknown>)[key] = Array.isArray(v) ? v : [];
  }
  e.settings = {
    ...defaultDentalPublicSettings(),
    ...(s.settings && typeof s.settings === 'object' ? s.settings : {}),
  };
  if (!e.settings.public_token) {
    e.settings.public_token = defaultDentalPublicSettings().public_token;
  }
  e.services = ensureSystemPersonalService(e.services);
  e.updated_at = s.updated_at ? String(s.updated_at) : undefined;
  return e;
}

export const DENTALGRAPH_PATIENT_TOKENS_KEY = 'dentalgraph_patient_tokens';
export const DENTALGRAPH_STAFF_TOKENS_KEY = 'dentalgraph_staff_tokens';

export function writeDentalgraphToMetadata(
  meta: Record<string, unknown>,
  store: DentalgraphStore
): Record<string, unknown> {
  const patientTokens: Record<string, string> = {};
  for (const p of store.patients || []) {
    if (p.portal_token) patientTokens[String(p.portal_token)] = p.id;
  }
  const staffTokens: Record<string, string> = {};
  for (const p of store.staff || []) {
    if (p.portal_token) staffTokens[String(p.portal_token)] = p.id;
  }
  return {
    ...meta,
    [DENTALGRAPH_META_KEY]: {
      ...store,
      updated_at: new Date().toISOString(),
    },
    [DENTALGRAPH_PATIENT_TOKENS_KEY]: patientTokens,
    [DENTALGRAPH_STAFF_TOKENS_KEY]: staffTokens,
  };
}

/** Issue patient portal token (self-serve diary booking). */
export function issueDentalPatientPortalToken(companyId: number): string {
  return `dpat_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Issue staff/clinician diary portal token. */
export function issueDentalStaffPortalToken(companyId: number): string {
  return `clin_${companyId}_dent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function parseDentalCompanyIdFromToken(token: string): number | null {
  const m = /^dpat_(\d+)_/.exec(token);
  if (m) return Number(m[1]);
  const dg = /^dg_(\d+)_/.exec(token);
  if (dg) return Number(dg[1]);
  const clin = /^clin_(\d+)_/.exec(token);
  if (clin) return Number(clin[1]);
  return null;
}

/**
 * Patient portal: open public diary slots with vacancies + this patient's bookings.
 */
export function buildDentalPatientPortalPayload(
  store: DentalgraphStore,
  patient: DentalPatient,
  from?: string,
  to?: string
) {
  const start = from || new Date().toISOString().slice(0, 10);
  const endDate = new Date(start + 'T12:00:00');
  endDate.setDate(endDate.getDate() + 28);
  const end = to || endDate.toISOString().slice(0, 10);

  const shareSchedule = patient.share_schedule !== false;
  const shareFeedback = patient.share_feedback !== false;
  const shareMedical = patient.share_medical !== false;

  const open_slots = shareSchedule
    ? toPortalOpenSlots(store, {
        patientId: patient.id,
        preferredClinicianId: patient.staff_id,
        from: start,
        to: end,
      })
    : [];

  const my_bookings = shareSchedule
    ? store.bookings
        .filter((b) => {
          if (b.patient_id !== patient.id || b.status === 'cancelled')
            return false;
          const a = store.appointments.find((x) => x.id === b.appointment_id);
          return a && a.date >= start;
        })
        .map((b) => {
          const a = store.appointments.find((x) => x.id === b.appointment_id)!;
          const svc = store.services.find((s) => s.id === a.service_id);
          const staff = store.staff.find((p) => p.id === a.staff_id);
          return {
            booking_id: b.id,
            status: b.status,
            appointment_id: a.id,
            date: a.date,
            start_time: a.start_time,
            service_name: svc?.name || 'Appointment',
            clinician_name: staff?.name,
            location: a.location,
            feedback_token: shareFeedback
              ? (b as { feedback_token?: string }).feedback_token || null
              : null,
            waitlist_offered_at: b.waitlist_offered_at || null,
            waitlist_accepted_at: b.waitlist_accepted_at || null,
          };
        })
        .sort((a, b) =>
          a.date === b.date
            ? a.start_time.localeCompare(b.start_time)
            : a.date.localeCompare(b.date)
        )
    : [];

  const medical_share = shareMedical
    ? buildPatientMedicalShare(patient)
    : null;

  return {
    logo_url: logoUrlFromSettings(
      store.settings as { company_logo_url?: string | null } | undefined
    ),
    brand: store.settings?.brand_name || 'Practice',
    bio: store.settings?.public_bio,
    timezone: store.settings?.timezone || 'Africa/Johannesburg',
    allow_booking: store.settings?.allow_public_booking !== false,
    contact_email: store.settings?.contact_email,
    contact_phone: store.settings?.contact_phone,
    primary_color: store.settings?.embed_primary_color || '#0284c7',
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
      invite_status: patient.invite_status || null,
      /** Regular / assigned clinician — portal may still book others */
      preferred_clinician_id: patient.staff_id || null,
      preferred_clinician_name:
        store.staff.find((s) => s.id === patient.staff_id)?.name || null,
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
    shares: {
      schedule: shareSchedule,
      feedback: shareFeedback,
      medical: shareMedical,
    },
    /** Patients may book any public clinician, not only their regular one */
    can_book_other_clinicians: true,
    medical_share,
    announcements: publishedAnnouncements(store.announcements),
    shared_advice: shareMedical
      ? [
          ...buildSharedAdvice(store.visit_notes, patient.id),
          ...followUpsAsAdvice(patient.follow_ups),
        ]
      : [],
    follow_ups: shareMedical
      ? patientFacingFollowUps(patient.follow_ups)
      : [],
    open_slots,
    vacancies: open_slots.filter((s) => !s.full && !s.my_status),
    my_bookings,
    open_count: open_slots.filter((s) => !s.full).length,
    full_count: open_slots.filter((s) => s.full && !s.my_status).length,
    waitlist_queue: (() => {
      const open = (store.waitlist_queue || [])
        .filter((q) => q.status === 'waiting')
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      return open
        .filter((q) => q.patient_id === patient.id)
        .map((q) => ({
          id: q.id,
          accept_any_clinician: q.accept_any_clinician,
          preferred_clinician_id: q.preferred_clinician_id,
          service_name: q.service_name,
          notes: q.notes,
          created_at: q.created_at,
          position: open.findIndex((x) => x.id === q.id) + 1,
        }));
    })(),
    threads: portalThreadsForPerson(store.threads, 'patient', patient.id),
    messages_unread: portalMessagesUnread(
      store.threads,
      'patient',
      patient.id
    ),
    /** Care packs remaining for this patient */
    care_packs: (store.care_packs || [])
      .filter((p) => p.person_id === patient.id)
      .map((p) => ({
        id: p.id,
        label: p.label || 'Care pack',
        sessions_total: p.sessions_total,
        sessions_used: p.sessions_used,
        remaining: Math.max(0, (p.sessions_total || 0) - (p.sessions_used || 0)),
        expires_at: p.expires_at || null,
        status: p.status || 'active',
      })),
    treatment_plans: (store.treatment_plans || [])
      .filter((t) => t.person_id === patient.id && t.status === 'active')
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        goals: t.goals,
        next_step:
          t.steps?.find(
            (s) => s.status === 'planned' || s.status === 'in_progress'
          ) || null,
        steps: t.steps || [],
      })),
  };
}

export function ensureDentalPublicToken(
  settings: DentalPublicSettings | undefined,
  companyId?: number
): DentalPublicSettings {
  const base: DentalPublicSettings = {
    ...defaultDentalPublicSettings(companyId),
    ...(settings || {}),
  };
  if (!base.public_token) {
    base.public_token = defaultDentalPublicSettings(companyId).public_token;
  }
  return base;
}

export function getStaffRoleOptions(
  store?: DentalgraphStore | null
): string[] {
  const custom = store?.settings?.staff_roles;
  const base =
    Array.isArray(custom) && custom.length
      ? custom.map(String)
      : [...DEFAULT_STAFF_ROLES];
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
  for (const p of store?.staff || []) {
    for (const d of p.roles || []) {
      const t = String(d).trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
  }
  return out.length ? out : [...DEFAULT_STAFF_ROLES];
}

export function summariseDentalgraph(store: DentalgraphStore) {
  const staff = store.staff.filter((p) => p.active !== false);
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
    staffCount: staff.length,
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
    ...clinicCommandBookingMetrics(store),
  };
}

export function appointmentBookingCount(
  store: DentalgraphStore,
  appointmentId: string
): number {
  return store.bookings.filter(
    (b) =>
      b.appointment_id === appointmentId &&
      (b.status === 'booked' || b.status === 'attended')
  ).length;
}

export function appointmentsInRange(
  store: DentalgraphStore,
  from: string,
  to: string
): DentalAppointment[] {
  return store.appointments
    .filter((a) => a.date >= from && a.date <= to && a.status !== 'cancelled')
    .sort((a, b) =>
      a.date === b.date
        ? a.start_time.localeCompare(b.start_time)
        : a.date.localeCompare(b.date)
    );
}

export function seedDemoDentalgraph(
  now: string,
  companyId?: number
): DentalgraphStore {
  const d = (offset: number) => {
    const x = new Date(now);
    x.setDate(x.getDate() + offset);
    return x.toISOString().slice(0, 10);
  };
  const p1 = newId('stf');
  const p2 = newId('stf');
  const pat1 = newId('dpt');
  const pat2 = newId('dpt');
  const svc1 = newId('svc');
  const svc2 = newId('svc');
  const pkg1 = newId('pkg');
  const apt1 = newId('apt');
  const apt2 = newId('apt');
  const cid = companyId ?? 0;

  return {
    settings: {
      ...defaultDentalPublicSettings(cid > 0 ? cid : undefined),
      enabled: true,
      brand_name: 'BrightSmile Dental',
      contact_email: 'hello@brightsmile.example',
      contact_phone: '+27 11 000 3333',
      public_bio: 'Family & cosmetic dentistry — check-ups to smile makeovers.',
    },
    staff: [
      {
        id: p1,
        code: 'PR',
        name: 'Dr Lindiwe Nkosi',
        email: 'lindiwe@brightsmile.example',
        roles: ['Dentist', 'Specialist (endo)'],
        public_bio: 'General dentist · restorative & endo interest.',
        rate_zar: 750,
        rate_basis: 'per_session',
        start_date: d(-120),
        active: true,
        created_at: now,
      },
      {
        id: p2,
        code: 'JM',
        name: 'Sarah Botha',
        email: 'sarah@brightsmile.example',
        roles: ['Dental hygienist', 'Oral hygienist'],
        public_bio: 'Hygienist · scale & polish · perio maintenance.',
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
        name: 'Nomsa Dlamini',
        email: 'nomsa@example.com',
        phone: '0820001001',
        status: 'active',
        staff_id: p1,
        package_id: pkg1,
        start_date: d(-30),
        clinical: {
          injured: true,
          injury_areas: ['Upper right (UR)', 'Molars'],
          injury_side: 'right',
          injury_status: 'recovering',
          injury_onset: d(-45),
          injury_notes: 'Deep caries UR6 — sensitive to cold; provisional dressing placed.',
          training_modifications: 'Avoid hard foods on right side; temporary filling in place.',
          diagnosis_notes: 'Caries UR6 · planned composite restoration.',
          treatment_goals: 'Restore UR6 · maintain oral hygiene · next hygiene in 6 months.',
          pain_score: 3,
          contraindications: 'No scaling over temporary until definitive restore.',
          updated_at: now,
          updated_by: 'prac:Dr Lindiwe Nkosi',
        },
        diagnosis_notes: 'Caries UR6 · planned composite restoration.',
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: pat2,
        code: 'P-002',
        name: 'James van Rensburg',
        email: 'james@example.com',
        status: 'new',
        staff_id: p2,
        start_date: d(-3),
        clinical: {
          injured: true,
          injury_areas: ['Gums / periodontium'],
          injury_side: 'left',
          injury_status: 'acute',
          injury_onset: d(-10),
          injury_notes: 'Mild gingivitis — bleeding on probing lower anteriors.',
          training_modifications: 'Improve brushing technique; chlorhexidine rinse 7 days.',
          treatment_goals: 'Resolve bleeding · BPE improve · hygiene recall.',
          pain_score: 5,
          updated_at: now,
          updated_by: 'prac:Sarah Botha',
        },
        active: true,
        created_at: now,
        updated_at: now,
      },
    ],
    services: [
      {
        id: svc1,
        code: 'CHK',
        name: 'Comprehensive check-up',
        default_duration_min: 60,
        price_zar: 550,
        active: true,
        created_at: now,
      },
      {
        id: svc2,
        code: 'HYG',
        name: 'Scale & polish',
        default_duration_min: 45,
        price_zar: 550,
        active: true,
        created_at: now,
      },
    ],
    packages: [
      {
        id: pkg1,
        code: '6PACK',
        name: 'Hygiene care plan (2 visits)',
        sessions_total: 2,
        price_zar: 1400,
        description: 'Two hygiene visits with assigned clinician.',
        active: true,
        created_at: now,
      },
    ],
    appointments: [
      {
        id: apt1,
        service_id: svc1,
        staff_id: p1,
        date: d(0),
        start_time: '09:00',
        duration_min: 60,
        location: 'Surgery 1',
        status: 'scheduled',
        public: true,
        created_at: now,
      },
      {
        id: apt2,
        service_id: svc2,
        staff_id: p2,
        date: d(1),
        start_time: '14:00',
        duration_min: 45,
        location: 'Hygiene bay',
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
        subject: 'ACL rehab check-in · Nomsa Dlamini',
        participants: [
          { role: 'desk', ref_id: 'desk', name: 'Front desk' },
          { role: 'practitioner', ref_id: p1, name: 'Dr Lindiwe Nkosi' },
          { role: 'patient', ref_id: pat1, name: 'Nomsa Dlamini' },
        ],
        messages: [
          {
            id: newId('msg'),
            body: 'Nomsa has temporary on UR6 — book composite restore next week; remind soft diet on right.',
            author_role: 'practitioner',
            author_ref_id: p1,
            author_name: 'Dr Lindiwe Nkosi',
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
        subject: 'Hygiene hand-off · James',
        participants: [
          { role: 'desk', ref_id: 'desk', name: 'Front desk' },
          { role: 'practitioner', ref_id: p1, name: 'Dr Lindiwe Nkosi' },
          { role: 'practitioner', ref_id: p2, name: 'Sarah Botha' },
        ],
        messages: [
          {
            id: newId('msg'),
            body: 'Aisha’s cuff irritation — happy for biokinetics to take scapular control block once pain <3/10.',
            author_role: 'practitioner',
            author_ref_id: p1,
            author_name: 'Dr Lindiwe Nkosi',
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
