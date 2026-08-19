/**
 * MedicalAdvisor® — tertiary / services medical practice OS
 * (GPs, specialists, nurses: practitioners, patients, services,
 * care packages, diary, bookings, website).
 * Stored on profiles.metadata.medicalgraph.
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
import { normalizeClinicRooms } from '@/lib/clinic/clinic-rooms';
import { copyStoredClinicArrays } from '@/lib/clinic/hydrate-clinic-store';
import { buildPatientVisitHistory } from '@/lib/clinic/visit-history';
import {
  snapshotContractorCommercial,
  type ContractorCommercialFields,
} from '@/lib/clinic/contractor-commercial';

export const MEDICALGRAPH_MODULE_ID = 'medicalgraph' as const;
export const MEDICALGRAPH_META_KEY = 'medicalgraph';

export const PRACTITIONER_DISCIPLINES = [
  'General practice (GP)',
  'Internal medicine',
  'Family medicine',
  'Paediatrics',
  'Emergency medicine',
  'Surgery',
  'Nursing',
  'Clinical associate',
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

export type MedicalRateBasis = (typeof PRACTITIONER_RATE_BASES)[number] | string;

/** One closed employment / engagement period for a practitioner */
export type MedicalEngagement = {
  id: string;
  /** YYYY-MM-DD */
  start_date: string;
  /** YYYY-MM-DD */
  end_date: string;
  note?: string;
  ended_reason?: string;
  rate_zar?: number | null;
  rate_basis?: MedicalRateBasis;
} & ContractorCommercialFields;

/** PDF (or doc) contract attached to a practitioner engagement */
export type MedicalContractDoc = {
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

export type MedicalPractitioner = {
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
  /** Skills / disciplines (owner-managed catalogue) */
  disciplines?: string[];
  bio?: string;
  public_bio?: string;
  qualifications?: import('@/lib/services/person-qualifications').PersonQualification[];
  photo_url?: string;
  rate_zar?: number | null;
  /** hourly | per_session | per_appointment | monthly | fixed | package */
  rate_basis?: MedicalRateBasis | null;
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
  contracts?: MedicalContractDoc[];
  /** Closed past engagements (keep history when practitioner returns) */
  history?: MedicalEngagement[];
  portal_token?: string | null;
  /** Can manage own diary slots */
  can_manage?: boolean;
  created_at: string;
} & import('@/lib/services/advisor-workforce').AdvisorPersonInviteFields &
  ContractorCommercialFields;

export function formatPractitionerRate(
  rateZar?: number | null,
  basis?: MedicalRateBasis | null
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
  person: MedicalPractitioner,
  endDate: string,
  opts?: { note?: string; reason?: string; nowIso?: string }
): MedicalPractitioner {
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
      ...snapshotContractorCommercial(person),
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
  person: MedicalPractitioner,
  startDate: string
): MedicalPractitioner {
  return {
    ...person,
    start_date: startDate,
    end_date: null,
    active: true,
  };
}

/** Rename a discipline across the catalogue and all practitioners */
export function renamePractitionerDiscipline(
  store: MedicalgraphStore,
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
  store: MedicalgraphStore,
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
  store: MedicalgraphStore,
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
export type MedicalClinicalProfile =
  import('@/lib/health/body-map').PersonHealthProfile;

export type MedicalPatient = {
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
  invite_token?: string | null;
  invite_status?: string | null;
  invite_email?: string | null;
  invite_sent_at?: string | null;
  invite_accepted_at?: string | null;
  invite_expires_at?: string | null;
  share_schedule?: boolean;
  share_feedback?: boolean;
  status?: (typeof PATIENT_STATUSES)[number] | string;
  practitioner_id?: string | null;
  package_id?: string | null;
  /** @deprecated prefer clinical.diagnosis_notes — kept for older records */
  diagnosis_notes?: string;
  emergency_contact?: string;
  notes?: string;
  /** Notes the clinician wrote for the client (shown on PWA / portal) */
  client_notes?: import('@/lib/clinic/clinic-movements').PatientClientNote[];
  /** Injury, diagnosis, pain, goals, contraindications */
  clinical?: MedicalClinicalProfile;
  /** Full medical chart: aid, documents, claims */
  medical?: import('@/lib/clinic/patient-medical').PatientMedicalRecord;
  /** When false, portal hides the care summary (default: share) */
  share_medical?: boolean;
  follow_ups?: import('@/lib/clinic/patient-follow-up').PatientFollowUp[];
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

export type MedicalService = {
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

export type MedicalPackage = {
  id: string;
  code: string;
  name: string;
  sessions_total: number;
  price_zar: number;
  description?: string;
  active?: boolean;
  created_at: string;
};

export type MedicalAppointment = {
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
  appointment_kind?: import('@/lib/clinic/appointment-kind').ClinicAppointmentKind;
  personal_reason?: import('@/lib/clinic/appointment-kind').ClinicPersonalReason | null;
  /** Links occurrences created as a repeating series */
  series_id?: string | null;
  created_at: string;
};

export type MedicalBooking = {
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
  post_session_emailed_at?: string | null;
};

export type MedicalPublicSettings = {
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
  show_practitioners: boolean;
  show_pricing: boolean;
  portal_sections?: Record<string, boolean>;
  timezone?: string;
  contact_email?: string;
  contact_phone?: string;
  /** Practice number printed on medical-aid claim packs */
  practice_number?: string;
  bhf_number?: string;
  vat_number?: string;
  pcns_number?: string;
  billing_email?: string;
  claims_switch?: import('@/lib/clinic/medical-aid-switch').PracticeClaimsSwitch;
  embed_primary_color?: string;
  company_logo_url?: string | null;
  practitioner_disciplines?: string[];
  /** Clinic open days & hours for schedule calendar */
  working_hours?: import('@/lib/schedule/working-hours').WorkingHours;
  rooms?: import('@/lib/clinic/clinic-rooms').ClinicRoom[] | string[];
  reschedule_policy?: import('@/lib/services/advisor-reschedule').ReschedulePolicy;
  marketplace?: {
    listed?: boolean;
    city?: string;
    blurb?: string;
    specialties?: string[];
  };
  has_front_desk?: boolean;
  desk_name?: string;
  desk_email?: string | null;
  desk_invite_status?: string | null;
  desk_invite_sent_at?: string | null;
  desk_invite_accepted_at?: string | null;
  desk_team_member_id?: number | null;
  desk_last_invited_email?: string | null;
};

export type MedicalgraphStore = {
  practitioners: MedicalPractitioner[];
  patients: MedicalPatient[];
  services: MedicalService[];
  packages: MedicalPackage[];
  appointments: MedicalAppointment[];
  bookings: MedicalBooking[];
  waitlist_queue?: import('@/lib/services/clinic-waitlist').ClinicWaitlistQueueEntry[];
  care_packs?: import('@/lib/services/advisor-pack-ledger').AdvisorPackLedgerEntry[];
  treatment_plans?: import('@/lib/services/advisor-clinical').TreatmentPlan[];
  visit_notes?: import('@/lib/services/advisor-clinical').VisitNote[];
  record_shares?: import('@/lib/services/advisor-b2c-relationship').PatientRecordShareGrant[];
  outcome_scores?: import('@/lib/services/advisor-clinical').OutcomeScore[];
  /** Desk · practitioner · patient messaging threads */
  threads?: import('@/lib/messaging/service-inbox').ServiceThread[];
  /** Patient post-visit feedback */
  appointment_feedback?: import('@/lib/services/booking-feedback').ServiceFeedback[];
  announcements?: import('@/lib/services/member-announcements').MemberAnnouncement[];
  desk_notices?: import('@/lib/services/advisor-member-calendar').DeskMemberNotice[];
  settings?: MedicalPublicSettings;
  updated_at?: string;
};

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultPublicSettings(companyId?: number): MedicalPublicSettings {
  return {
    enabled: false,
    public_token:
      companyId != null
        ? `medg_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
        : `medg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    allow_public_booking: true,
    share_member_calendar: true,
    generate_member_slots: true,
    require_accept_join: false,
    show_practitioners: true,
    show_pricing: true,
    timezone: 'Africa/Johannesburg',
    embed_primary_color: '#059669',
    practitioner_disciplines: [...DEFAULT_PRACTITIONER_DISCIPLINES],
  };
}

export function emptyMedicalgraphStore(): MedicalgraphStore {
  return {
    practitioners: [],
    patients: [],
    services: [],
    packages: [],
    appointments: [],
    bookings: [],
    waitlist_queue: [],
    care_packs: [],
    treatment_plans: [],
    visit_notes: [],
    outcome_scores: [],
    threads: [],
    appointment_feedback: [],
    announcements: [],
    desk_notices: [],
    record_shares: [],
    settings: defaultPublicSettings(),
  };
}

export function readMedicalgraphFromMetadata(
  meta: Record<string, unknown> | null | undefined
): MedicalgraphStore {
  if (!meta || typeof meta !== 'object') return emptyMedicalgraphStore();
  const raw = meta[MEDICALGRAPH_META_KEY];
  if (!raw || typeof raw !== 'object') return emptyMedicalgraphStore();
  const s = raw as Partial<MedicalgraphStore>;
  const e = copyStoredClinicArrays(
    emptyMedicalgraphStore(),
    s as Record<string, unknown>
  );
  e.settings = {
    ...defaultPublicSettings(),
    ...(s.settings && typeof s.settings === 'object' ? s.settings : {}),
  };
  e.settings.rooms = normalizeClinicRooms(e.settings.rooms);
  if (!e.settings.public_token) {
    e.settings.public_token = defaultPublicSettings().public_token;
  }
  e.services = ensureSystemPersonalService(e.services);
  e.updated_at = s.updated_at ? String(s.updated_at) : undefined;
  return e;
}

export const MEDICALGRAPH_PATIENT_TOKENS_KEY = 'medicalgraph_patient_tokens';
export const MEDICALGRAPH_STAFF_TOKENS_KEY = 'medicalgraph_staff_tokens';

export function writeMedicalgraphToMetadata(
  meta: Record<string, unknown>,
  store: MedicalgraphStore
): Record<string, unknown> {
  const patientTokens: Record<string, string> = {};
  for (const p of store.patients || []) {
    if (p.portal_token) patientTokens[String(p.portal_token)] = p.id;
  }
  const staffTokens: Record<string, string> = {};
  for (const p of store.practitioners || []) {
    if (p.portal_token) staffTokens[String(p.portal_token)] = p.id;
  }
  return {
    ...meta,
    [MEDICALGRAPH_META_KEY]: {
      ...store,
      updated_at: new Date().toISOString(),
    },
    [MEDICALGRAPH_PATIENT_TOKENS_KEY]: patientTokens,
    [MEDICALGRAPH_STAFF_TOKENS_KEY]: staffTokens,
  };
}

/** Issue patient portal token (self-serve diary booking). */
export function issuePatientPortalToken(companyId: number): string {
  return `medp_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Issue practitioner diary portal token. */
export function issuePractitionerPortalToken(companyId: number): string {
  return `clin_${companyId}_medi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function parseMedicalCompanyIdFromToken(token: string): number | null {
  const m = /^medp_(\d+)_/.exec(token);
  if (m) return Number(m[1]);
  const pg = /^medg_(\d+)_/.exec(token);
  if (pg) return Number(pg[1]);
  const clin = /^clin_(\d+)_/.exec(token);
  if (clin) return Number(clin[1]);
  return null;
}

/** @deprecated use parseMedicalCompanyIdFromToken */
export const parsePhysioCompanyIdFromToken = parseMedicalCompanyIdFromToken;

/**
 * Patient portal: open public diary slots with vacancies + this patient's bookings.
 */
export function buildPatientPortalPayload(
  store: MedicalgraphStore,
  patient: MedicalPatient,
  from?: string,
  to?: string
) {
  const start = from || new Date().toISOString().slice(0, 10);
  const endDate = new Date(start + 'T12:00:00');
  endDate.setDate(endDate.getDate() + 28);
  const end = to || endDate.toISOString().slice(0, 10);

  const open_slots = toPortalOpenSlots(store, {
    patientId: patient.id,
    preferredClinicianId: patient.practitioner_id,
    from: start,
    to: end,
  });

  const visit_history = buildPatientVisitHistory({
    patientId: patient.id,
    bookings: store.bookings,
    appointments: store.appointments,
    services: store.services,
    practitioners: store.practitioners,
    visitNotes: store.visit_notes,
    scripts: patient.medical?.scripts,
    patientFacing: true,
    today: start,
  });
  const my_bookings = visit_history
    .filter((v) => v.upcoming)
    .slice()
    .reverse()
    .map((v) => {
      const b = store.bookings.find((x) => x.id === v.booking_id);
      return {
        booking_id: v.booking_id,
        status: v.status,
        appointment_id: v.appointment_id,
        date: v.date,
        start_time: v.start_time,
        service_name: v.service_name,
        practitioner_name: v.practitioner_name,
        location: v.location,
        waitlist_offered_at: b?.waitlist_offered_at || null,
        waitlist_accepted_at: b?.waitlist_accepted_at || null,
        feedback_token: b?.feedback_token || null,
        feedback_submitted_at: b?.feedback_submitted_at || null,
      };
    });

  return {
    logo_url: logoUrlFromSettings(
      store.settings as { company_logo_url?: string | null } | undefined
    ),
    brand: store.settings?.brand_name || 'Clinic',
    bio: store.settings?.public_bio,
    timezone: store.settings?.timezone || 'Africa/Johannesburg',
    allow_booking: store.settings?.allow_public_booking !== false,
    contact_email: store.settings?.contact_email,
    contact_phone: store.settings?.contact_phone,
    primary_color: store.settings?.embed_primary_color || '#059669',
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
      preferred_clinician_id: patient.practitioner_id || null,
      preferred_clinician_name:
        store.practitioners.find((p) => p.id === patient.practitioner_id)?.name ||
        null,
      family: Array.isArray(patient.family) ? patient.family : [],
    },
    can_book_other_clinicians: true,
    open_slots,
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
    vacancies: open_slots.filter((s) => !s.full && !s.my_status),
    medical_share: buildPatientMedicalShare(patient),
    announcements: publishedAnnouncements(store.announcements),
    shared_advice: [
      ...buildSharedAdvice(store.visit_notes, patient.id),
      ...followUpsAsAdvice(patient.follow_ups),
    ],
    follow_ups: patientFacingFollowUps(patient.follow_ups),
    shares: {
      schedule: true,
      medical: patient.share_medical !== false,
    },
    my_bookings,
    visit_history: visit_history.filter((v) => !v.upcoming),
    open_count: open_slots.filter((s) => !s.full).length,
    full_count: open_slots.filter((s) => s.full && !s.my_status).length,
    threads: portalThreadsForPerson(store.threads, 'patient', patient.id),
    messages_unread: portalMessagesUnread(store.threads, 'patient', patient.id),
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
            (st) => st.status === 'planned' || st.status === 'in_progress'
          ) || null,
        steps: t.steps || [],
      })),
  };
}

export function ensurePublicToken(
  settings: MedicalPublicSettings | undefined,
  companyId?: number
): MedicalPublicSettings {
  const base: MedicalPublicSettings = {
    ...defaultPublicSettings(companyId),
    ...(settings || {}),
  };
  if (!base.public_token) {
    base.public_token = defaultPublicSettings(companyId).public_token;
  }
  return base;
}

export function getDisciplineOptions(
  store?: MedicalgraphStore | null
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

export function summariseMedicalgraph(store: MedicalgraphStore) {
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
    roomCount: (store.settings?.rooms || []).length,
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
  store: MedicalgraphStore,
  appointmentId: string
): number {
  return store.bookings.filter(
    (b) =>
      b.appointment_id === appointmentId &&
      (b.status === 'booked' || b.status === 'attended')
  ).length;
}

export function appointmentsInRange(
  store: MedicalgraphStore,
  from: string,
  to: string
): MedicalAppointment[] {
  return store.appointments
    .filter((a) => a.date >= from && a.date <= to && a.status !== 'cancelled')
    .sort((a, b) =>
      a.date === b.date
        ? a.start_time.localeCompare(b.start_time)
        : a.date.localeCompare(b.date)
    );
}

export function seedDemoMedicalgraph(
  now: string,
  companyId?: number
): MedicalgraphStore {
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
      brand_name: 'CityCare Medical',
      contact_email: 'hello@citycare.example',
      contact_phone: '+27 11 000 4444',
      public_bio: 'Family medicine & primary care — consultations, chronic care and procedures.',
      rooms: [
        {
          id: 'room_consult_1',
          name: 'Consult 1',
          notes: 'GP consults',
          practitioner_ids: [p1],
          active: true,
        },
        {
          id: 'room_surgery_1',
          name: 'Surgery 1',
          notes: 'Minor procedures',
          practitioner_ids: [p1, p2],
          active: true,
        },
      ],
    },
    practitioners: [
      {
        id: p1,
        code: 'PR',
        name: 'Dr Priya Reddy',
        email: 'priya@citycare.example',
        disciplines: ['General practice (GP)', 'Family medicine'],
        public_bio: 'Family physician · chronic disease and preventative care.',
        rate_zar: 650,
        rate_basis: 'per_session',
        start_date: d(-120),
        active: true,
        created_at: now,
      },
      {
        id: p2,
        code: 'JM',
        name: 'Sister Johan Meyer',
        email: 'johan@citycare.example',
        disciplines: ['Nursing'],
        public_bio: 'Practice nurse · injections, dressings and vitals.',
        rate_zar: 350,
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
          training_modifications: 'Monitor BP before exercise prescriptions.',
          diagnosis_notes: 'Hypertension · type 2 diabetes — quarterly review.',
          treatment_goals: 'BP < 130/80 · HbA1c < 7 · lifestyle plan adherence.',
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
        location: 'Consult 1',
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
        location: 'Surgery 1',
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
