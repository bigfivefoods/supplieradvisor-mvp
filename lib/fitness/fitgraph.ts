/**
 * GymAdvisor® — tertiary / services gym OS (Fitness & wellness industry).
 * Coaches, clients/members, memberships, class types, calendar sessions,
 * bookings, check-ins, PT packs. Stored on profiles.metadata.fitgraph.
 */

import {
  previewText,
  threadTitle,
  threadsForParticipant,
  totalUnread,
  unreadInThread,
} from '@/lib/messaging/service-inbox';
import {
  addDaysIso,
  addMonthsIso,
  expandRecurrenceDates,
  weekdayOf,
} from '@/lib/schedule/recurrence';
import { healthSummaryLabel } from '@/lib/health/body-map';
import { buildRelationshipSummary } from '@/lib/fitness/fitgraph-relationship';
import { publishedAnnouncements } from '@/lib/services/member-announcements';
import { logoUrlFromSettings } from '@/lib/business/company-logo';
import { bookingEligibleForClientRating } from '@/lib/services/booking-feedback';
import { isoDateInZone } from '@/lib/fitness/gym-local-time';
import { compactWorkingHours } from '@/lib/schedule/working-hours';
import {
  SYS_COACH_TIME_CODE,
  SYS_PT_CODE,
  normalizeSessionKind,
  resolveSessionTimes,
  type FitSessionKind,
} from '@/lib/fitness/session-times';
import type {
  FitMovement,
  FitProgramme,
} from '@/lib/fitness/movements';
import type {
  FitProgrammeEnrollment,
  FitProgrammeLog,
} from '@/lib/fitness/programme-follow';
import {
  buildMemberProgrammeFollows,
  buildProgrammeFollowRoster,
} from '@/lib/fitness/programme-follow';
import {
  dateToProgrammeWeekday,
  hydrateProgramme,
  memberFacingProgramme,
  programmeBlockForWeekday,
  resolveProgrammeForSession,
} from '@/lib/fitness/movements';
import {
  ensureSystemMovements,
  listedFitMovements,
} from '@/lib/fitness/movement-catalog';
import {
  snapshotContractorCommercial,
  type ContractorCommercialFields,
} from '@/lib/clinic/contractor-commercial';
import {
  gymRequiresDebitBank,
  memberDebitBankComplete,
} from '@/lib/fitness/member-debit-bank';
import { isPortalSectionOn } from '@/lib/advisors/portal-sections';
import { gymCommandBookingMetrics } from '@/lib/advisors/command-booking-metrics';

export {
  SYS_COACH_TIME_CODE,
  SYS_PT_CODE,
  normalizeSessionKind,
  resolveSessionTimes,
  sessionKindFromRecord,
  sessionKindLabel,
  type FitSessionKind,
} from '@/lib/fitness/session-times';

// Re-export shared recurrence helpers for existing Fit imports
export { addDaysIso, addMonthsIso, expandRecurrenceDates, weekdayOf };

export const FITGRAPH_MODULE_ID = 'fitgraph' as const;
export const FITGRAPH_META_KEY = 'fitgraph';
/** Movement library lives in its own module-store row so desk GET stays small. */
export const FITGRAPH_LIB_KEY = 'fitgraph_lib';

/** VUKA Fitness wordmark yellow (sampled from vukafitness.com logo). */
export const GYM_BRAND_YELLOW = '#E8E830';
export const GYM_BRAND_YELLOW_DEEP = '#6B6B00';
const LEGACY_GYM_PURPLE = '#7c3aed';

export function gymBrandColor(raw?: string | null): string {
  const c = String(raw || '').trim();
  if (!c || c.toLowerCase() === LEGACY_GYM_PURPLE) return GYM_BRAND_YELLOW.toLowerCase();
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(c)) return `#${c.toLowerCase()}`;
  return GYM_BRAND_YELLOW.toLowerCase();
}

export const COACH_SPECIALTIES = [
  'Strength',
  'HIIT',
  'Yoga',
  'Pilates',
  'CrossFit',
  'Boxing',
  'Spin / cycle',
  'Functional',
  'Personal training',
  'Nutrition',
  'General',
] as const;

/** Default catalogue when a gym has not customised specialties yet */
export const DEFAULT_COACH_SPECIALTIES: string[] = [...COACH_SPECIALTIES];

/**
 * Owner-managed specialty list for a gym.
 * Falls back to platform defaults; always returns a non-empty unique list.
 */
export function getCoachSpecialtyOptions(
  storeOrSettings?:
    | Pick<FitgraphStore, 'settings' | 'coaches'>
    | FitPublicSettings
    | null
): string[] {
  let custom: string[] | undefined;
  let coaches: { specialties?: string[] }[] | undefined;
  if (storeOrSettings && 'coaches' in storeOrSettings) {
    custom = storeOrSettings.settings?.coach_specialties;
    coaches = storeOrSettings.coaches;
  } else if (storeOrSettings && 'coach_specialties' in (storeOrSettings as object)) {
    custom = (storeOrSettings as FitPublicSettings).coach_specialties;
  } else if (
    storeOrSettings &&
    typeof storeOrSettings === 'object' &&
    'public_token' in storeOrSettings
  ) {
    custom = (storeOrSettings as FitPublicSettings).coach_specialties;
  }

  const base =
    Array.isArray(custom) && custom.length > 0
      ? custom.map((s) => String(s).trim()).filter(Boolean)
      : [...DEFAULT_COACH_SPECIALTIES];

  // Include any specialties already on coaches so renames/orphans still show as chips
  if (coaches) {
    for (const c of coaches) {
      for (const s of c.specialties || []) {
        const t = String(s).trim();
        if (t && !base.some((b) => b.toLowerCase() === t.toLowerCase())) {
          base.push(t);
        }
      }
    }
  }

  // Dedupe case-insensitively, preserve first-seen casing/order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of base) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out.length ? out : [...DEFAULT_COACH_SPECIALTIES];
}

/** Rename a specialty across the catalogue and all coaches */
export function renameCoachSpecialty(
  store: FitgraphStore,
  from: string,
  to: string
): { ok: true; options: string[] } | { ok: false; error: string } {
  const src = String(from || '').trim();
  const dest = String(to || '').trim();
  if (!src) return { ok: false, error: 'Current specialty name required' };
  if (!dest) return { ok: false, error: 'New specialty name required' };
  if (src.toLowerCase() === dest.toLowerCase() && src !== dest) {
    // case-only change — allow
  } else if (src.toLowerCase() === dest.toLowerCase()) {
    return { ok: true, options: getCoachSpecialtyOptions(store) };
  }

  const options = getCoachSpecialtyOptions(store).filter(
    (s) => s.toLowerCase() !== src.toLowerCase()
  );
  if (options.some((s) => s.toLowerCase() === dest.toLowerCase())) {
    // Merge into existing dest label
  } else {
    options.push(dest);
  }
  if (!store.settings) store.settings = defaultPublicSettings();
  store.settings.coach_specialties = options;

  for (const coach of store.coaches || []) {
    if (!coach.specialties?.length) continue;
    coach.specialties = coach.specialties.map((s) =>
      s.toLowerCase() === src.toLowerCase() ? dest : s
    );
    // dedupe
    const seen = new Set<string>();
    coach.specialties = coach.specialties.filter((s) => {
      const k = s.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  return { ok: true, options: getCoachSpecialtyOptions(store) };
}

/** Add a specialty to the gym catalogue */
export function addCoachSpecialty(
  store: FitgraphStore,
  name: string
): { ok: true; options: string[] } | { ok: false; error: string } {
  const n = String(name || '').trim();
  if (!n) return { ok: false, error: 'Specialty name required' };
  if (n.length > 48) return { ok: false, error: 'Keep specialty under 48 characters' };
  const options = getCoachSpecialtyOptions(store);
  if (options.some((s) => s.toLowerCase() === n.toLowerCase())) {
    return { ok: false, error: 'That specialty already exists' };
  }
  if (!store.settings) store.settings = defaultPublicSettings();
  store.settings.coach_specialties = [...options, n];
  return { ok: true, options: store.settings.coach_specialties };
}

/** Remove from catalogue (keeps label on coaches that already have it) */
export function removeCoachSpecialty(
  store: FitgraphStore,
  name: string,
  opts?: { stripFromCoaches?: boolean }
): { ok: true; options: string[] } | { ok: false; error: string } {
  const n = String(name || '').trim();
  if (!n) return { ok: false, error: 'Specialty name required' };
  const options = getCoachSpecialtyOptions(store).filter(
    (s) => s.toLowerCase() !== n.toLowerCase()
  );
  if (!options.length) {
    return { ok: false, error: 'Keep at least one specialty' };
  }
  if (!store.settings) store.settings = defaultPublicSettings();
  store.settings.coach_specialties = options;
  if (opts?.stripFromCoaches) {
    for (const coach of store.coaches || []) {
      if (!coach.specialties?.length) continue;
      coach.specialties = coach.specialties.filter(
        (s) => s.toLowerCase() !== n.toLowerCase()
      );
      if (!coach.specialties.length) coach.specialties = ['General'];
    }
  }
  return { ok: true, options };
}

export const MEMBERSHIP_STATUSES = [
  'active',
  'paused',
  'expired',
  'cancelled',
  'trial',
] as const;

/** How the owner pays / prices a coach */
export const COACH_RATE_BASES = [
  'hourly',
  'per_class',
  'per_session',
  'per_appointment',
  'monthly',
  'fixed',
  'package',
] as const;

export type FitCoachRateBasis = (typeof COACH_RATE_BASES)[number] | string;

/** One closed employment / engagement period for a coach */
export type FitCoachEngagement = {
  id: string;
  /** YYYY-MM-DD */
  start_date: string;
  /** YYYY-MM-DD — null/omitted only while open (current stint is on FitCoach) */
  end_date: string;
  note?: string;
  ended_reason?: string;
  /** Rate at time of closing this stint (ZAR) */
  rate_zar?: number | null;
  rate_basis?: FitCoachRateBasis;
} & ContractorCommercialFields;

/** PDF (or doc) contract attached to gym profile or coach engagement */
export type FitContractDoc = {
  id: string;
  title: string;
  file_name: string;
  /** Public storage URL */
  url: string;
  uploaded_at: string;
  /** membership | waiver | terms | coach_agreement | other */
  kind?: string;
};

export const FIT_CONTRACT_KINDS = [
  'membership',
  'waiver',
  'terms',
  'coach_agreement',
  'practitioner_agreement',
  'staff_agreement',
  'nda',
  'rate_letter',
  'other',
] as const;

export type FitCoach = {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  /** SA ID / passport for identity verification */
  id_number?: string;
  /** Linked People / HR employee id (dual-write) */
  hr_employee_id?: number | null;
  /** VerifyNow (SA) or Didit (international) self-serve identity check */
  identity?: import('@/lib/identity/person-verification').PersonIdentityVerification;
  specialties?: string[];
  bio?: string;
  /** Public bio for website / coach cards */
  public_bio?: string;
  /** Degrees, registrations, short courses + uploaded certificates */
  qualifications?: import('@/lib/services/person-qualifications').PersonQualification[];
  photo_url?: string;
  /** Token for coach self-service portal (share classes with members) */
  portal_token?: string | null;
  /** Can manage own sessions (edit capacity, cancel, share) */
  can_manage_classes?: boolean;
  active?: boolean;
  color?: string;
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
  /**
   * Current pay / charge-out rate in ZAR (owner-set).
   * Snapshotted into history when an engagement is closed.
   */
  rate_zar?: number | null;
  /** hourly | per_class | per_session | monthly | fixed */
  rate_basis?: FitCoachRateBasis | null;
  /** Optional owner note about rate (e.g. "incl. travel") */
  rate_note?: string;
  /** Owner-uploaded PDF contracts (coach agreements, NDAs, etc.) */
  contracts?: FitContractDoc[];
  /** Closed past engagements (keep history when coach returns) */
  history?: FitCoachEngagement[];
  created_at: string;
} & import('@/lib/services/advisor-workforce').AdvisorPersonInviteFields &
  ContractorCommercialFields;

/** Who put this session on the coach diary. */
export function sessionScheduledBy(session: {
  origin?: string | null;
}): 'owner' | 'coach' {
  return String(session.origin || '') === 'coach' ? 'coach' : 'owner';
}

export function formatCoachRate(
  rateZar?: number | null,
  basis?: FitCoachRateBasis | null
): string {
  if (rateZar == null || !Number.isFinite(Number(rateZar))) return '—';
  const n = Number(rateZar);
  const money = `R${n.toLocaleString('en-ZA', {
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
  const b = String(basis || 'per_class').replace(/_/g, ' ');
  return `${money} / ${b}`;
}

/** Archive current stint into history when ending engagement */
export function closeCoachEngagement(
  coach: FitCoach,
  endDate: string,
  opts?: { note?: string; reason?: string; nowIso?: string }
): FitCoach {
  const start =
    coach.start_date ||
    (coach.created_at || opts?.nowIso || new Date().toISOString()).slice(0, 10);
  const end = endDate || new Date().toISOString().slice(0, 10);
  const hist = [...(coach.history || [])];
  // Avoid duplicate close of same open period
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
      ...snapshotContractorCommercial(coach),
    });
  }
  hist.sort((a, b) => b.start_date.localeCompare(a.start_date));
  return {
    ...coach,
    history: hist,
    start_date: start,
    end_date: end,
    active: false,
  };
}

/** Start a new engagement (rehire) — keeps history */
export function reopenCoachEngagement(
  coach: FitCoach,
  startDate: string
): FitCoach {
  return {
    ...coach,
    start_date: startDate,
    end_date: null,
    active: true,
  };
}

/**
 * Injury / training-awareness profile — coaches and desk can update so the
 * floor knows what to adapt (knee load, shoulder range, etc.).
 */
export type FitClientHealth = import('@/lib/health/body-map').PersonHealthProfile;

export type FitMemberJoinEvent = {
  id: string;
  at: string;
  kind:
    | 'created'
    | 'joined_pwa'
    | 'invite_sent'
    | 'invite_accepted'
    | 'wallet_linked'
    | 'membership_started'
    | 'plan_changed'
    | 'frozen'
    | 'unfrozen'
    | 'cancelled'
    | 'reactivated'
    | string;
  title: string;
  note?: string;
  source?: 'desk' | 'pwa' | 'invite' | 'system' | string;
};

export type FitClient = {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  /**
   * National ID / passport / membership ID number (member self-serve + desk).
   * Used for gym records and identity on the member portal.
   */
  id_number?: string;
  /**
   * Household / family on this membership (kids, spouse, etc.).
   * Parent email often stays on the primary client; children listed here.
   */
  family?: import('@/lib/services/family-members').FamilyMember[];
  /** Attendance / no-show stats (Advisor outcomes) */
  no_show_count?: number;
  last_no_show_at?: string | null;
  attended_count?: number;
  booking_soft_block?: boolean;
  popia_consent_at?: string | null;
  /** Membership freeze window */
  membership_frozen_at?: string | null;
  membership_freeze_until?: string | null;
  /** VerifyNow (SA) or Didit (international) self-serve identity check */
  identity?: import('@/lib/identity/person-verification').PersonIdentityVerification;
  /** Profile photo (public storage URL) */
  photo_url?: string;
  /** Token for member self-serve portal (book classes, see vacancies) */
  portal_token?: string | null;
  /** Extra portal tokens kept when duplicate members are merged. */
  portal_token_aliases?: string[];
  /**
   * Platform / system user id (Privy DID) once this person is on SupplierAdvisor.
   * Care messaging delivers in-app by this id — not by email matching.
   */
  platform_user_id?: string | null;
  /** Email invite to join as a member and open the portal */
  invite_token?: string | null;
  invite_status?: string | null;
  invite_email?: string | null;
  invite_sent_at?: string | null;
  invite_accepted_at?: string | null;
  invite_expires_at?: string | null;
  /** Share flags for portal after invite accepted */
  share_schedule?: boolean;
  share_feedback?: boolean;
  membership_plan_id?: string | null;
  /** Linked Core CRM customer (Customers module) */
  crm_customer_id?: number | null;
  membership_status?: (typeof MEMBERSHIP_STATUSES)[number] | string;
  /** Programmes this member paid for / was allocated */
  purchased_programme_ids?: string[];
  start_date?: string | null;
  end_date?: string | null;
  /**
   * Private / PT client of an assigned coach (vs general gym member).
   * Shown on the members list with the coach name.
   */
  private_client?: boolean;
  coach_id?: string | null;
  /** Agreed class rate (ZAR / month). Null = use the class list price. */
  agreed_rate_zar?: number | null;
  /** Agreed private / PT rate with the assigned coach (ZAR / month). */
  private_rate_zar?: number | null;
  /** Birthday (YYYY-MM-DD) — from SA Member PWA passport or desk. */
  date_of_birth?: string | null;
  /** Next of kin / emergency (from PWA passport.emergency_* or desk). */
  next_of_kin?: string;
  next_of_kin_phone?: string;
  next_of_kin_relationship?: string;
  emergency_contact?: string;
  /** Snapshot of the SA Member wallet passport stamped onto this desk. */
  passport?: import('@/lib/b2c/member-passport').MemberPassport;
  /** Medical-style demographics stamped from the PWA passport. */
  medical?: import('@/lib/clinic/patient-medical').PatientMedicalRecord;
  /** Explicit join / membership events (PWA, invite, freeze, desk). */
  join_events?: FitMemberJoinEvent[];
  /** Group class contract vs private (PT) contract. */
  contract_kind?: 'group' | 'private';
  /** Owner-only onboarding / Jotform contracts (PAR-Q, signatures). */
  contracts?: import('@/lib/fitness/member-contract').FitMemberContract[];
  occupation?: string;
  heard_about?: string;
  employer_student_number?: string;
  address?: string;
  gp_contact?: string;
  notes?: string;
  /**
   * Bank account for the gym owner to set up a debit order.
   * Not used for Paystack / Apple Pay charges.
   */
  debit_bank?: import('@/lib/fitness/member-debit-bank').FitMemberDebitBank;
  /** Injury, pain, modifications & goals for coach awareness */
  health?: FitClientHealth;
  /** Garmin Connect + watch session ingest (tokens stay server-side). */
  wearable?: {
    garmin?: import('@/lib/fitness/wearable-types').GarminConnection | null;
  };
  active?: boolean;
  created_at: string;
  updated_at: string;
};

export type FitMembershipPlan = {
  id: string;
  code: string;
  name: string;
  /** ZAR per billing period */
  price_zar: number;
  billing: 'monthly' | 'weekly' | 'annual' | 'pack' | 'drop_in';
  class_credits?: number | null;
  pt_credits?: number | null;
  /** Shop bio — shown when a member opens the class to learn more */
  description?: string;
  /** Marketing still for the shop card and detail sheet */
  image_url?: string | null;
  /** YouTube / Vimeo / uploaded clip shown on the shop detail sheet */
  video_url?: string | null;
  /** Show on public website pricing */
  public?: boolean;
  /** What buying this plan unlocks */
  access?: 'classes' | 'programme' | 'both';
  /** Optional programme included with the membership */
  programme_id?: string | null;
  /** Class types this plan unlocks (empty + unlocks_all_classes = all) */
  class_type_ids?: string[];
  /** Recurring series this plan unlocks (VUKA slot-specific rates) */
  series_ids?: string[];
  unlocks_all_classes?: boolean;
  excluded_class_type_ids?: string[];
  weekly_class_limit?: number | null;
  addon?: boolean;
  audience?: 'all' | 'gents' | 'women' | 'kids' | string;
  schedule_label?: string;
  location?: string;
  /** Default coach for this class (applied to new / upcoming diary dates). */
  default_coach_id?: string | null;
  sibling_discount_pct?: number;
  sort_order?: number;
  catalog?: string;
  active?: boolean;
  created_at: string;
};

/** Active member subscription (recurring or pack entitlement) */
export type FitSubscription = {
  id: string;
  client_id: string;
  plan_id: string;
  status: 'active' | 'trialing' | 'past_due' | 'paused' | 'cancelled' | 'expired';
  started_at: string;
  current_period_end?: string | null;
  cancel_at?: string | null;
  /** Credits remaining this period (null = unlimited) */
  class_credits_remaining?: number | null;
  auto_renew?: boolean;
  notes?: string;
  /**
   * What this member is actually billed (ZAR / period).
   * Null = use the class / plan list price.
   */
  charged_zar?: number | null;
  created_at: string;
  updated_at: string;
};

/** Desk / debit amount for a subscription — charged override, else list price. */
export function subscriptionChargeZar(
  sub: Pick<FitSubscription, 'charged_zar'>,
  plan?: Pick<FitMembershipPlan, 'price_zar'> | null
): number {
  if (sub.charged_zar != null && Number.isFinite(Number(sub.charged_zar))) {
    return Number(sub.charged_zar);
  }
  return Number(plan?.price_zar) || 0;
}

export type FitClassType = {
  id: string;
  code: string;
  name: string;
  category?: string;
  default_duration_min?: number;
  capacity?: number | null;
  description?: string;
  active?: boolean;
  created_at: string;
};

export type FitSession = {
  id: string;
  class_type_id: string;
  coach_id?: string | null;
  /** Local calendar date YYYY-MM-DD */
  date: string;
  /** HH:mm */
  start_time: string;
  end_time?: string | null;
  duration_min?: number | null;
  /**
   * class = group class · private_pt = 1:1 personal training ·
   * coach_personal = coach's own training / blocked time (not member-bookable)
   */
  session_kind?: FitSessionKind;
  capacity?: number | null;
  location?: string;
  /** Multi-resource diary: room / studio / court */
  room?: string | null;
  status: 'scheduled' | 'cancelled' | 'completed' | 'full';
  /** Visible on public website / embed calendar */
  public?: boolean;
  /** Share link slug for this session (optional) */
  share_code?: string | null;
  /** Notes only for coach / owner (private) */
  notes?: string;
  /** Customer-facing blurb when shared on website */
  public_notes?: string;
  /**
   * Planned class activities / workout plan.
   * Visible to members (public calendar / embed) and other coaches in the gym.
   */
  class_plan?: string;
  /**
   * Recurring series id — all occurrences of a weekly/bespoke series share this.
   * One-off bespoke classes have series_id null/undefined.
   */
  series_id?: string | null;
  /** How this row was created */
  origin?: 'one_off' | 'series' | 'owner' | 'coach' | string;
  /** Optional programme override for this occurrence */
  programme_id?: string | null;
  created_at: string;
};

/** @deprecated Prefer ScheduleRecurrence from @/lib/schedule/recurrence */
export type FitRecurrence = import('@/lib/schedule/recurrence').ScheduleRecurrence;

export type FitBooking = {
  id: string;
  session_id: string;
  client_id: string;
  status: 'booked' | 'waitlist' | 'cancelled' | 'attended' | 'no_show';
  booked_at: string;
  /** Source: owner desk, coach portal, website, member self-serve */
  source?: 'desk' | 'coach' | 'website' | 'member' | string;
  /** Guest name if not yet a client record */
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  notes?: string;
  /** Parent books for child / household member */
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
  /** Optional note from the coach to this member after class */
  coach_feedback?: string | null;
  coach_feedback_at?: string | null;
  /** How the member seemed after class (1–5), logged by the coach */
  coach_member_feeling?: number | null;
  /** Coach’s rating of this member in the class (1–5) */
  coach_member_rating?: number | null;
  /** Member said before class whether they will attend */
  rsvp?: 'coming' | 'not_coming' | null;
  rsvp_at?: string | null;
};

/** Gym-level website / portal settings */
export type FitPublicSettings = {
  /** Publish public calendar & class list */
  enabled: boolean;
  /** Secret token for public API (website embed) */
  public_token: string;
  /** Optional short slug for nicer links */
  public_slug?: string;
  brand_name?: string;
  website_url?: string;
  /** Gym / studio public bio (website & profile) */
  public_bio?: string;
  /** Internal owner notes for the gym profile */
  bio?: string;
  allow_public_booking: boolean;
  /** Share public class diary with SA Member PWA (default follows online booking). */
  share_member_calendar?: boolean;
  /**
   * When true, guests must buy a membership before booking a class.
   * Default: true if the gym has priced public memberships.
   */
  require_paid_membership?: boolean;
  /** Once-off joining fee (ZAR). VUKA lists R600, currently waived. */
  joining_fee_zar?: number | null;
  joining_fee_waived?: boolean;
  joining_fee_note?: string;
  /** Members subscribe to priced classes (VUKA). Fees = sum of those classes. */
  class_subscribe?: boolean;
  /**
   * Owner schedules VUKA classes on the calendar (no auto timetable).
   * Set once after clearing seeded series sessions.
   */
  vuka_calendar_manual?: boolean;
  /** Version stamp when Jotform group/private contracts replaced the billed-name roster. */
  vuka_contracts_import?: string;
  /** Version stamp when billed class codes were allocated onto catalog classes. */
  vuka_billed_class_import?: string;
  /** Version stamp when duplicate VUKA members were merged. */
  vuka_member_merge?: string;
  /** Collect debit-order bank details on the member profile. */
  collect_debit_bank?: boolean;
  /** Membership is incomplete until bank details are submitted. */
  require_debit_bank?: boolean;
  show_coaches: boolean;
  show_pricing: boolean;
  /** Show PDF contracts on the public gym page */
  show_contracts?: boolean;
  /** Owner picks which public portal blocks are visible */
  portal_sections?: Record<string, boolean>;
  timezone?: string;
  contact_email?: string;
  contact_phone?: string;
  embed_primary_color?: string;
  /** Copied from My Business profile for branded session emails */
  company_logo_url?: string | null;
  /**
   * Owner-uploaded PDF contracts for the gym profile
   * (membership T&Cs, waivers, studio agreements).
   */
  contracts?: FitContractDoc[];
  /**
   * Owner-managed coach specialty catalogue.
   * When empty/missing, platform defaults (COACH_SPECIALTIES) are used.
   */
  coach_specialties?: string[];
  /**
   * When true (default), gym runs with a front desk / floor admin persona
   * (desk ↔ coach / member messages, desk check-ins).
   * When false, ops and messaging are coach–member led (owner-coach studio).
   */
  has_front_desk?: boolean;
  desk_name?: string;
  desk_email?: string | null;
  desk_invite_status?: string | null;
  desk_invite_sent_at?: string | null;
  desk_invite_accepted_at?: string | null;
  desk_team_member_id?: number | null;
  desk_last_invited_email?: string | null;
  /** Gym open days & hours for schedule calendar */
  working_hours?: import('@/lib/schedule/working-hours').WorkingHours;
  /**
   * When true (default), multiple coaches may schedule at the same time —
   * large floors / train-anywhere. Concurrent sessions are not treated as conflicts.
   */
  allow_concurrent_coach_sessions?: boolean;
  /** Self-serve reschedule / cancel policy (fees collected outside SA) */
  reschedule_policy?: import('@/lib/services/advisor-reschedule').ReschedulePolicy;
  /** Marketplace listing */
  marketplace?: {
    listed?: boolean;
    city?: string;
    blurb?: string;
    specialties?: string[];
  };
  /** Studios / courts / rooms for multi-resource diary */
  rooms?: string[];
  /** Company-branded member PWA (home-screen app named after the gym). */
  pwa_enabled?: boolean;
  pwa_name?: string;
  pwa_short_name?: string;
  pwa_description?: string;
  pwa_theme_color?: string;
  pwa_background_color?: string;
  pwa_icon_url?: string | null;
};

/** Front desk enabled unless owner explicitly turns it off */
export function fitgraphHasFrontDesk(
  settings?: FitPublicSettings | null
): boolean {
  return settings?.has_front_desk !== false;
}

/**
 * Post-class feedback from a member (after attending) or coach (after teaching).
 * Feeling / intensity style check-in for the gym owner.
 */
export type FitClassFeedback = {
  id: string;
  session_id: string;
  role: 'member' | 'coach';
  client_id?: string | null;
  coach_id?: string | null;
  booking_id?: string | null;
  author_name?: string;
  author_email?: string;
  /** How they feel after the class (1 = drained · 5 = great) */
  feeling: number;
  /** Perceived intensity / RPE (1 easy · 10 max effort) */
  intensity: number;
  /** Enjoyment (1–5) */
  enjoyment?: number;
  /** Would do this class again (1–5) */
  would_return?: number;
  comment?: string;
  /** Optional tags e.g. tough, fun, too_easy, recovery */
  tags?: string[];
  created_at: string;
  updated_at: string;
};

export const FEEDBACK_FEELING_LABELS = [
  '',
  'Drained',
  'Tired',
  'OK',
  'Good',
  'Energised',
] as const;

export const FEEDBACK_TAG_OPTIONS = [
  'tough',
  'fun',
  'too easy',
  'too hard',
  'great coaching',
  'recovery',
  'sore',
  'motivated',
] as const;

export function clampScore(n: unknown, min: number, max: number, fallback: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

/** Upsert feedback for the same author+session+role */
export function upsertClassFeedback(
  store: FitgraphStore,
  input: Omit<FitClassFeedback, 'id' | 'created_at' | 'updated_at'> & {
    id?: string;
    created_at?: string;
    updated_at?: string;
  },
  nowIso?: string
): FitClassFeedback {
  if (!store.class_feedback) store.class_feedback = [];
  const now = nowIso || new Date().toISOString();
  const feeling = clampScore(input.feeling, 1, 5, 3);
  const intensity = clampScore(input.intensity, 1, 10, 5);
  const enjoyment =
    input.enjoyment != null
      ? clampScore(input.enjoyment, 1, 5, 3)
      : undefined;
  const would_return =
    input.would_return != null
      ? clampScore(input.would_return, 1, 5, 3)
      : undefined;

  const matchIdx = store.class_feedback.findIndex((f) => {
    if (f.session_id !== input.session_id || f.role !== input.role) return false;
    if (input.role === 'coach') {
      return Boolean(input.coach_id) && f.coach_id === input.coach_id;
    }
    if (input.client_id && f.client_id === input.client_id) return true;
    if (
      input.author_email &&
      f.author_email &&
      f.author_email.toLowerCase() === input.author_email.toLowerCase()
    ) {
      return true;
    }
    if (input.booking_id && f.booking_id === input.booking_id) return true;
    return false;
  });

  if (matchIdx >= 0) {
    const prev = store.class_feedback[matchIdx];
    const row: FitClassFeedback = {
      ...prev,
      feeling,
      intensity,
      enjoyment,
      would_return,
      comment: input.comment != null ? String(input.comment) : prev.comment,
      tags: Array.isArray(input.tags) ? input.tags.map(String) : prev.tags,
      author_name: input.author_name ?? prev.author_name,
      author_email: input.author_email ?? prev.author_email,
      client_id: input.client_id ?? prev.client_id,
      coach_id: input.coach_id ?? prev.coach_id,
      booking_id: input.booking_id ?? prev.booking_id,
      updated_at: now,
    };
    store.class_feedback[matchIdx] = row;
    return row;
  }

  const row: FitClassFeedback = {
    id: input.id || newId('fb'),
    session_id: input.session_id,
    role: input.role,
    client_id: input.client_id ?? null,
    coach_id: input.coach_id ?? null,
    booking_id: input.booking_id ?? null,
    author_name: input.author_name,
    author_email: input.author_email,
    feeling,
    intensity,
    enjoyment,
    would_return,
    comment: input.comment != null ? String(input.comment) : undefined,
    tags: Array.isArray(input.tags) ? input.tags.map(String) : undefined,
    created_at: input.created_at || now,
    updated_at: now,
  };
  store.class_feedback.push(row);
  return row;
}

export function feedbackForSession(
  store: FitgraphStore,
  sessionId: string
): FitClassFeedback[] {
  return (store.class_feedback || []).filter((f) => f.session_id === sessionId);
}

export function summariseSessionFeedback(
  store: FitgraphStore,
  sessionId: string
): {
  member_count: number;
  coach_count: number;
  avg_feeling: number | null;
  avg_intensity: number | null;
  avg_enjoyment: number | null;
} {
  const list = feedbackForSession(store, sessionId);
  const members = list.filter((f) => f.role === 'member');
  const coaches = list.filter((f) => f.role === 'coach');
  const avg = (arr: number[]) =>
    arr.length
      ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
      : null;
  return {
    member_count: members.length,
    coach_count: coaches.length,
    avg_feeling: avg(members.map((m) => m.feeling)),
    avg_intensity: avg(members.map((m) => m.intensity)),
    avg_enjoyment: avg(
      members
        .map((m) => m.enjoyment)
        .filter((n): n is number => n != null && Number.isFinite(n))
    ),
  };
}

export type FitCheckIn = {
  id: string;
  client_id: string;
  date: string;
  time?: string | null;
  method?: 'front_desk' | 'app' | 'class' | 'qr_phone' | 'other' | string;
  session_id?: string | null;
  notes?: string;
  created_at: string;
  /** Snapshot of access evaluation at check-in (phone QR / desk) */
  membership_status?: string | null;
  subscription_status?: string | null;
  /** true when dues are current enough to train */
  payment_ok?: boolean;
  /** Owner-facing alert when past due / expired / frozen */
  access_alert?: string | null;
  access_level?: FitMemberAccessLevel | string | null;
};

/** Member access for floor check-in / class gate */
export type FitMemberAccessLevel =
  | 'allowed'
  | 'allowed_with_warning'
  | 'blocked';

export type FitMemberAccess = {
  level: FitMemberAccessLevel;
  payment_ok: boolean;
  membership_status: string;
  subscription_status: string | null;
  plan_name: string | null;
  /** Short owner-facing reason when not fully paid / frozen */
  alert: string | null;
  /** Short member-facing message */
  member_message: string;
  frozen: boolean;
  period_end: string | null;
  bank_ok?: boolean;
};

/**
 * Evaluate whether a member may train today based on membership + subscription.
 * Gym owners still get the check-in event even when unpaid — flagged for desk.
 */
export function evaluateMemberAccess(
  store: FitgraphStore,
  client: FitClient
): FitMemberAccess {
  const membership = String(client.membership_status || 'active').toLowerCase();
  const frozen =
    Boolean(client.membership_frozen_at) &&
    (!client.membership_freeze_until ||
      client.membership_freeze_until >= new Date().toISOString().slice(0, 10));

  const subs = (store.subscriptions || []).filter(
    (s) => s.client_id === client.id
  );
  const preferred =
    subs.find((s) => s.status === 'active' || s.status === 'trialing') ||
    subs.find((s) => s.status === 'past_due') ||
    subs.find((s) => s.status === 'paused') ||
    subs[0] ||
    null;
  const subStatus = preferred ? String(preferred.status) : null;
  const plan = client.membership_plan_id
    ? store.membership_plans.find((p) => p.id === client.membership_plan_id)
    : preferred
      ? store.membership_plans.find((p) => p.id === preferred.plan_id)
      : null;
  const periodEnd = preferred?.current_period_end || client.end_date || null;
  const bankOk = gymRequiresDebitBank(store)
    ? memberDebitBankComplete(client)
    : true;

  if (client.active === false) {
    return {
      level: 'blocked',
      payment_ok: false,
      membership_status: membership,
      subscription_status: subStatus,
      plan_name: plan?.name || null,
      alert: 'Member marked inactive',
      member_message: 'Your membership is inactive. Please speak to reception.',
      frozen: false,
      period_end: periodEnd,
      bank_ok: bankOk,
    };
  }

  if (frozen) {
    return {
      level: 'blocked',
      payment_ok: false,
      membership_status: membership,
      subscription_status: subStatus,
      plan_name: plan?.name || null,
      alert: `Membership frozen${
        client.membership_freeze_until
          ? ` until ${client.membership_freeze_until}`
          : ''
      }`,
      member_message: 'Your membership is frozen. Please speak to reception.',
      frozen: true,
      period_end: periodEnd,
      bank_ok: bankOk,
    };
  }

  if (membership === 'cancelled' || membership === 'expired') {
    return {
      level: 'blocked',
      payment_ok: false,
      membership_status: membership,
      subscription_status: subStatus,
      plan_name: plan?.name || null,
      alert: `Membership ${membership}`,
      member_message: `Your membership is ${membership}. Please renew at reception.`,
      frozen: false,
      period_end: periodEnd,
      bank_ok: bankOk,
    };
  }

  if (subStatus === 'past_due') {
    return {
      level: 'allowed_with_warning',
      payment_ok: false,
      membership_status: membership,
      subscription_status: subStatus,
      plan_name: plan?.name || null,
      alert: 'Subscription past due — payment outstanding',
      member_message:
        'Checked in — please settle outstanding membership fees with reception.',
      frozen: false,
      period_end: periodEnd,
      bank_ok: bankOk,
    };
  }

  if (subStatus === 'cancelled' || subStatus === 'expired') {
    return {
      level: 'allowed_with_warning',
      payment_ok: false,
      membership_status: membership,
      subscription_status: subStatus,
      plan_name: plan?.name || null,
      alert: `Subscription ${subStatus}`,
      member_message:
        'Checked in — your subscription needs attention at reception.',
      frozen: false,
      period_end: periodEnd,
      bank_ok: bankOk,
    };
  }

  if (subStatus === 'paused') {
    return {
      level: 'allowed_with_warning',
      payment_ok: false,
      membership_status: membership,
      subscription_status: subStatus,
      plan_name: plan?.name || null,
      alert: 'Subscription paused',
      member_message: 'Checked in — subscription is paused; speak to reception.',
      frozen: false,
      period_end: periodEnd,
      bank_ok: bankOk,
    };
  }

  // Active / trial membership (and active/trialing sub if present) — OK
  const paymentOk =
    (membership === 'active' || membership === 'trial') &&
    (subStatus == null ||
      subStatus === 'active' ||
      subStatus === 'trialing');

  if (!bankOk) {
    return {
      level: 'allowed_with_warning',
      payment_ok: paymentOk,
      membership_status: membership,
      subscription_status: subStatus,
      plan_name: plan?.name || null,
      alert: 'Debit-order bank details missing',
      member_message:
        'Add your bank details on your profile so the gym can set up your debit order.',
      frozen: false,
      period_end: periodEnd,
      bank_ok: false,
    };
  }

  return {
    level: 'allowed',
    payment_ok: paymentOk,
    membership_status: membership,
    subscription_status: subStatus,
    plan_name: plan?.name || null,
    alert: null,
    member_message: 'You are checked in. Have a great session!',
    frozen: false,
    period_end: periodEnd,
    bank_ok: true,
  };
}

/** Public URL path for gym door / reception QR (unique per gym public_token). */
export function gymCheckinPath(publicToken: string): string {
  return `/checkin/fitgraph/${encodeURIComponent(publicToken)}`;
}

export function gymCheckinUrl(origin: string, publicToken: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}${gymCheckinPath(publicToken)}`;
}

/**
 * Record a check-in (desk or phone QR). Dedupes same client same day within 30 min
 * for qr_phone to avoid double-tap spam; returns existing row if so.
 */
export function recordMemberCheckIn(
  store: FitgraphStore,
  client: FitClient,
  opts?: {
    method?: FitCheckIn['method'];
    session_id?: string | null;
    notes?: string;
    now?: Date;
    /** Allow blocked members to still log a denied attempt */
    allow_blocked_log?: boolean;
  }
): {
  store: FitgraphStore;
  check_in: FitCheckIn;
  access: FitMemberAccess;
  duplicate: boolean;
  denied: boolean;
} {
  const access = evaluateMemberAccess(store, client);
  const now = opts?.now || new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 16);
  const method = opts?.method || 'front_desk';

  // Soft dedupe: same client + method within 30 minutes today
  const recent = (store.check_ins || []).find((c) => {
    if (c.client_id !== client.id || c.date !== date) return false;
    if (String(c.method) !== String(method)) return false;
    const created = c.created_at ? new Date(c.created_at).getTime() : 0;
    return Number.isFinite(created) && now.getTime() - created < 30 * 60 * 1000;
  });
  if (recent) {
    return {
      store,
      check_in: recent,
      access,
      duplicate: true,
      denied: access.level === 'blocked',
    };
  }

  const denied = access.level === 'blocked';
  // Still record blocked attempts so owners see unpaid/frozen try-ins
  const check_in: FitCheckIn = {
    id: newId('cin'),
    client_id: client.id,
    date,
    time,
    method,
    session_id: opts?.session_id || null,
    notes: [
      opts?.notes,
      denied ? `DENIED: ${access.alert || 'blocked'}` : null,
      access.alert && !denied ? access.alert : null,
    ]
      .filter(Boolean)
      .join(' · ') || undefined,
    created_at: now.toISOString(),
    membership_status: access.membership_status,
    subscription_status: access.subscription_status,
    payment_ok: access.payment_ok,
    access_alert: access.alert,
    access_level: access.level,
  };

  const check_ins = [check_in, ...(store.check_ins || [])];
  return {
    store: { ...store, check_ins },
    check_in,
    access,
    duplicate: false,
    denied,
  };
}

export function clientPortalTokens(
  c: Pick<FitClient, 'portal_token'> & { portal_token_aliases?: string[] | null }
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [c.portal_token, ...(c.portal_token_aliases || [])]) {
    const t = String(raw || '').trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function clientMatchesPortalToken(
  c: Pick<FitClient, 'portal_token'> & { portal_token_aliases?: string[] | null },
  token: string
): boolean {
  const t = String(token || '').trim();
  return Boolean(t) && clientPortalTokens(c).includes(t);
}

/** Find active client by portal token, code, email, or phone (normalised). */
export function findClientForCheckIn(
  store: FitgraphStore,
  lookup: {
    member_token?: string | null;
    code?: string | null;
    email?: string | null;
    phone?: string | null;
  }
): FitClient | null {
  const token = String(lookup.member_token || '').trim();
  if (token) {
    const byToken = store.clients.find(
      (c) => clientMatchesPortalToken(c, token) && c.active !== false
    );
    if (byToken) return byToken;
  }
  const code = String(lookup.code || '').trim().toLowerCase();
  if (code) {
    const byCode = store.clients.find(
      (c) =>
        c.active !== false &&
        (String(c.code || '').toLowerCase() === code ||
          String(c.id_number || '').toLowerCase() === code)
    );
    if (byCode) return byCode;
  }
  const email = String(lookup.email || '').trim().toLowerCase();
  if (email) {
    const byEmail = store.clients.find(
      (c) =>
        c.active !== false && String(c.email || '').toLowerCase() === email
    );
    if (byEmail) return byEmail;
  }
  const phoneRaw = String(lookup.phone || '').replace(/\D/g, '');
  if (phoneRaw.length >= 7) {
    const byPhone = store.clients.find((c) => {
      if (c.active === false) return false;
      const p = String(c.phone || '').replace(/\D/g, '');
      if (!p) return false;
      return p.endsWith(phoneRaw) || phoneRaw.endsWith(p);
    });
    if (byPhone) return byPhone;
  }
  return null;
}

function normalizePersonName(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function namesMatchForPortalSignIn(
  stored: string | null | undefined,
  entered: string | null | undefined
): boolean {
  const a = normalizePersonName(String(stored || ''));
  const b = normalizePersonName(String(entered || ''));
  if (!a || !b) return false;
  if (a === b) return true;
  const at = a.split(' ').filter(Boolean);
  const bt = b.split(' ').filter(Boolean);
  if (at.length < 2 || bt.length < 2) return false;
  return at[0] === bt[0] && at[at.length - 1] === bt[bt.length - 1];
}

/** Active coach on the gym file — email is the access key. */
export function findCoachForPortalSignIn(
  store: FitgraphStore,
  lookup: { name?: string | null; email?: string | null }
): FitCoach | null {
  const email = String(lookup.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return null;
  const name = String(lookup.name || '').trim();
  return (
    (store.coaches || []).find((c) => {
      if (c.active === false || c.end_date) return false;
      const emails = [c.email]
        .map((v) => String(v || '').trim().toLowerCase())
        .filter((v) => v.includes('@'));
      if (!emails.includes(email)) return false;
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length >= 2 && c.name) {
        return namesMatchForPortalSignIn(c.name, name);
      }
      return true;
    }) || null
  );
}

/** Existing member sign-in: name + email must both match the gym roster. */
export function findClientForPortalSignIn(
  store: FitgraphStore,
  lookup: { name?: string | null; email?: string | null }
): FitClient | null {
  const email = String(lookup.email || '').trim().toLowerCase();
  const name = String(lookup.name || '').trim();
  if (!email || !email.includes('@') || !name) return null;
  return (
    (store.clients || []).find((c) => {
      const emails = [c.email, c.invite_email]
        .map((v) => String(v || '').trim().toLowerCase())
        .filter((v) => v.includes('@'));
      return (
        c.active !== false &&
        emails.includes(email) &&
        namesMatchForPortalSignIn(c.name, name)
      );
    }) || null
  );
}

export type FitPtPack = {
  id: string;
  client_id: string;
  coach_id?: string | null;
  sessions_total: number;
  sessions_used: number;
  purchased_at: string;
  expires_at?: string | null;
  price_zar?: number | null;
  notes?: string;
  created_at: string;
  label?: string;
  status?: 'active' | 'exhausted' | 'expired' | 'cancelled';
  consumption_log?: Array<{
    booking_id: string;
    at: string;
    sessions: number;
  }>;
};

export interface FitgraphStore {
  desk_notices?: import('@/lib/services/advisor-member-calendar').DeskMemberNotice[];
  coaches: FitCoach[];
  clients: FitClient[];
  membership_plans: FitMembershipPlan[];
  /** Recurring subscriptions for members */
  subscriptions: FitSubscription[];
  class_types: FitClassType[];
  sessions: FitSession[];
  bookings: FitBooking[];
  check_ins: FitCheckIn[];
  pt_packs: FitPtPack[];
  /** Member + coach post-class feedback */
  class_feedback?: FitClassFeedback[];
  /** Session / clinical stickiness */
  visit_notes?: import('@/lib/services/advisor-clinical').VisitNote[];
  outcome_scores?: import('@/lib/services/advisor-clinical').OutcomeScore[];
  treatment_plans?: import('@/lib/services/advisor-clinical').TreatmentPlan[];
  /** Desk · coach · member messaging threads */
  threads?: import('@/lib/messaging/service-inbox').ServiceThread[];
  /** Owner ads / notices shown to every member */
  announcements?: import('@/lib/services/member-announcements').MemberAnnouncement[];
  /** Coach / gym exercise movement library */
  movements?: FitMovement[];
  /** Class and personal-training programmes built from movements */
  programmes?: FitProgramme[];
  /** Members following a programme (assigned or purchased) */
  programme_enrollments?: FitProgrammeEnrollment[];
  /** Per-day follow logs: done / skip / feeling / RPE / comments */
  programme_logs?: FitProgrammeLog[];
  /** Paid membership / programme checkouts */
  gym_sales?: import('@/lib/fitness/gym-shop').GymSale[];
  /** Watch / Garmin sessions logged after class */
  watch_sessions?: import('@/lib/fitness/wearable-types').FitWatchSession[];
  garmin_oauth_pending?: import('@/lib/fitness/wearable-types').GarminOauthPending[];
  settings?: FitPublicSettings;
  updated_at?: string;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultPublicSettings(companyId?: number): FitPublicSettings {
  return {
    enabled: false,
    allow_concurrent_coach_sessions: true,
    public_token:
      companyId != null
        ? `fg_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
        : `fg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    allow_public_booking: true,
    show_coaches: true,
    show_pricing: true,
    timezone: 'Africa/Johannesburg',
    embed_primary_color: GYM_BRAND_YELLOW,
    coach_specialties: [...DEFAULT_COACH_SPECIALTIES],
    has_front_desk: true,
  };
}

export function ensureSystemClassTypes(store: FitgraphStore): void {
  const now = new Date().toISOString();
  if (!store.class_types.some((c) => c.code === SYS_PT_CODE)) {
    store.class_types.push({
      id: 'cls_sys_pt',
      code: SYS_PT_CODE,
      name: 'Personal training',
      category: 'PT',
      default_duration_min: 60,
      capacity: 1,
      description: '1:1 private training with a coach',
      active: true,
      created_at: now,
    });
  }
  if (!store.class_types.some((c) => c.code === SYS_COACH_TIME_CODE)) {
    store.class_types.push({
      id: 'cls_sys_coach_time',
      code: SYS_COACH_TIME_CODE,
      name: 'Coach personal time',
      category: 'Coach',
      default_duration_min: 60,
      capacity: 0,
      description: 'Coach’s own training, admin, or blocked diary time',
      active: true,
      created_at: now,
    });
  }
}

export function sessionKindOf(
  store: FitgraphStore,
  session: Pick<FitSession, 'session_kind' | 'class_type_id'>
): FitSessionKind {
  if (session.session_kind) {
    return normalizeSessionKind(session.session_kind);
  }
  const ct = store.class_types.find((c) => c.id === session.class_type_id);
  if (ct?.code === SYS_PT_CODE) return 'private_pt';
  if (ct?.code === SYS_COACH_TIME_CODE) return 'coach_personal';
  return 'class';
}

/** Resolve kind + catalogue row. PT / personal time fall back to system types. */
export function resolveClassTypeForSession(
  store: FitgraphStore,
  opts: { class_type_id?: string | null; session_kind?: unknown }
): { class_type_id: string; kind: FitSessionKind } {
  ensureSystemClassTypes(store);
  const ctId = String(opts.class_type_id || '').trim();
  const ct = ctId
    ? store.class_types.find((c) => c.id === ctId)
    : undefined;
  const hasExplicitKind =
    opts.session_kind != null && String(opts.session_kind).trim() !== '';
  const kind = hasExplicitKind
    ? normalizeSessionKind(opts.session_kind)
    : ct?.code === SYS_PT_CODE
      ? 'private_pt'
      : ct?.code === SYS_COACH_TIME_CODE
        ? 'coach_personal'
        : 'class';
  const isSystem =
    ct?.code === SYS_PT_CODE || ct?.code === SYS_COACH_TIME_CODE;
  if (kind === 'private_pt' && (!ct || isSystem)) {
    const sys = store.class_types.find((c) => c.code === SYS_PT_CODE);
    return { class_type_id: sys?.id || ctId, kind };
  }
  if (kind === 'coach_personal' && (!ct || isSystem)) {
    const sys = store.class_types.find((c) => c.code === SYS_COACH_TIME_CODE);
    return { class_type_id: sys?.id || ctId, kind };
  }
  return { class_type_id: ctId, kind };
}

export function applySessionKindRules(
  kind: FitSessionKind,
  opts?: { public?: boolean; capacity?: number | null }
): { public: boolean; capacity: number | null } {
  if (kind === 'coach_personal') {
    return { public: false, capacity: 0 };
  }
  if (kind === 'private_pt') {
    const cap = opts?.capacity;
    return {
      public: false,
      capacity: cap != null && cap > 0 ? cap : 1,
    };
  }
  return {
    public: opts?.public === true,
    capacity: opts?.capacity ?? 20,
  };
}

/** Group classes listed on the public / member diary. */
export function isPublicListingSession(
  store: FitgraphStore,
  session: FitSession
): boolean {
  return (
    session.public === true &&
    session.status === 'scheduled' &&
    sessionKindOf(store, session) === 'class'
  );
}

export function coachPersonalBookingError(
  store: FitgraphStore,
  session: FitSession | undefined | null
): string | null {
  if (!session) return null;
  if (sessionKindOf(store, session) === 'coach_personal') {
    return 'Coach personal time cannot be booked by members';
  }
  return null;
}

export function emptyFitgraphStore(): FitgraphStore {
  return {
    desk_notices: [],
    coaches: [],
    clients: [],
    membership_plans: [],
    subscriptions: [],
    class_types: [],
    sessions: [],
    bookings: [],
    check_ins: [],
    pt_packs: [],
    class_feedback: [],
    threads: [],
    announcements: [],
    movements: [],
    programmes: [],
    programme_enrollments: [],
    programme_logs: [],
    gym_sales: [],
    watch_sessions: [],
    garmin_oauth_pending: [],
    settings: defaultPublicSettings(),
  };
}

export function readFitgraphFromMetadata(
  meta: Record<string, unknown> | null | undefined
): FitgraphStore {
  if (!meta || typeof meta !== 'object') {
    const empty = emptyFitgraphStore();
    ensureSystemClassTypes(empty);
    ensureSystemMovements(empty);
    return empty;
  }
  const raw = meta[FITGRAPH_META_KEY];
  if (!raw || typeof raw !== 'object') {
    const empty = emptyFitgraphStore();
    ensureSystemClassTypes(empty);
    ensureSystemMovements(empty);
    return empty;
  }
  const s = raw as Partial<FitgraphStore>;
  const e = emptyFitgraphStore();
  for (const key of Object.keys(e) as Array<keyof FitgraphStore>) {
    if (key === 'updated_at' || key === 'settings') continue;
    const v = s[key];
    (e as unknown as Record<string, unknown>)[key] = Array.isArray(v) ? v : [];
  }
  e.settings = {
    ...defaultPublicSettings(),
    ...(s.settings && typeof s.settings === 'object' ? s.settings : {}),
  };
  if (!e.settings.public_token) {
    e.settings.public_token = defaultPublicSettings().public_token;
  }
  e.updated_at = s.updated_at ? String(s.updated_at) : undefined;
  const extra = s as unknown as Record<string, unknown>;
  for (const key of [
    'goals',
    'journey_events',
    'member_stories',
    'consent_shares',
    'movements',
    'programmes',
    'programme_enrollments',
    'programme_logs',
    'watch_sessions',
    'garmin_oauth_pending',
  ]) {
    if (Array.isArray(extra[key])) {
      (e as unknown as Record<string, unknown>)[key] = extra[key];
    }
  }
  ensureSystemClassTypes(e);
  ensureSystemMovements(e);
  return e;
}

/** Metadata root indexes for public token lookup (no full table scan). */
export const FITGRAPH_PUBLIC_TOKEN_KEY = 'fitgraph_public_token';
export const FITGRAPH_COACH_TOKENS_KEY = 'fitgraph_coach_tokens';
export const FITGRAPH_CLIENT_TOKENS_KEY = 'fitgraph_client_tokens';

export type FitgraphLibrary = {
  movements: FitgraphStore['movements'];
};

export function splitFitgraphLibrary(store: FitgraphStore): {
  core: FitgraphStore;
  lib: FitgraphLibrary;
} {
  return {
    core: { ...store, movements: [] },
    lib: { movements: store.movements || [] },
  };
}

export function mergeFitgraphLibrary(
  core: FitgraphStore,
  lib: FitgraphLibrary | null | undefined
): FitgraphStore {
  const movements = lib?.movements?.length ? lib.movements : core.movements || [];
  return { ...core, movements };
}

export function readFitgraphLibFromMetadata(
  meta: Record<string, unknown> | null | undefined
): FitgraphLibrary {
  const raw = meta && typeof meta === 'object' ? meta[FITGRAPH_LIB_KEY] : null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { movements: [] };
  }
  const movements = (raw as { movements?: unknown }).movements;
  return { movements: Array.isArray(movements) ? (movements as FitgraphStore['movements']) : [] };
}

export function writeFitgraphLibToMetadata(
  meta: Record<string, unknown>,
  lib: FitgraphLibrary
): Record<string, unknown> {
  return { ...meta, [FITGRAPH_LIB_KEY]: { movements: lib.movements || [] } };
}

export function writeFitgraphToMetadata(
  meta: Record<string, unknown>,
  store: FitgraphStore
): Record<string, unknown> {
  const coachTokens: Record<string, string> = {};
  for (const c of store.coaches || []) {
    if (c.portal_token) coachTokens[String(c.portal_token)] = c.id;
  }
  const clientTokens: Record<string, string> = {};
  for (const c of store.clients || []) {
    for (const token of clientPortalTokens(c)) {
      clientTokens[token] = c.id;
    }
  }
  return {
    ...meta,
    [FITGRAPH_META_KEY]: {
      ...store,
      updated_at: new Date().toISOString(),
    },
    [FITGRAPH_PUBLIC_TOKEN_KEY]: store.settings?.public_token || null,
    [FITGRAPH_COACH_TOKENS_KEY]: coachTokens,
    [FITGRAPH_CLIENT_TOKENS_KEY]: clientTokens,
  };
}

/** Issue a coach portal token (includes company id for fast public resolve). */
export function issueCoachPortalToken(companyId: number): string {
  return `coach_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Issue a member / client portal token for self-serve class booking. */
export function issueClientPortalToken(companyId: number): string {
  return `member_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Parse companyId from coach_* , member_* or fg_{companyId}_* tokens when present. */
export function parseCompanyIdFromToken(token: string): number | null {
  const coach = /^coach_(\d+)_/.exec(token);
  if (coach) return Number(coach[1]);
  const member = /^member_(\d+)_/.exec(token);
  if (member) return Number(member[1]);
  const fg = /^fg_(\d+)_/.exec(token);
  if (fg) return Number(fg[1]);
  return null;
}

/**
 * Member portal: open classes with vacancies + this client's bookings.
 * Only public scheduled sessions appear as open diary vacancies.
 */
export function buildMemberPortalPayload(
  store: FitgraphStore,
  client: FitClient,
  from?: string,
  to?: string
) {
  const tz = store.settings?.timezone || 'Africa/Johannesburg';
  const start = from || isoDateInZone(tz);
  const endDate = new Date(start + 'T12:00:00');
  endDate.setDate(endDate.getDate() + 90);
  const end = to || endDate.toISOString().slice(0, 10);

  const shareSchedule = client.share_schedule !== false;
  const shareFeedback = client.share_feedback !== false;
  const historyFrom = (() => {
    const d = new Date(start + 'T12:00:00');
    d.setDate(d.getDate() - 45);
    return d.toISOString().slice(0, 10);
  })();

  const open_classes = shareSchedule
    ? store.sessions
        .filter(
          (s) =>
            isPublicListingSession(store, s) &&
            s.date >= start &&
            s.date <= end
        )
        .map((s) => {
          const ct = classTypeById(store, s.class_type_id);
          const coach = coachById(store, s.coach_id);
          const booked = sessionBookingCount(store, s.id);
          const cap = s.capacity ?? ct?.capacity ?? 0;
          const myBooking = store.bookings.find(
            (b) =>
              b.session_id === s.id &&
              b.client_id === client.id &&
              (b.status === 'booked' ||
                b.status === 'waitlist' ||
                b.status === 'attended' ||
                b.rsvp === 'not_coming' ||
                b.rsvp === 'coming')
          );
          return {
            id: s.id,
            date: s.date,
            start_time: s.start_time,
            end_time: s.end_time,
            duration_min: s.duration_min ?? ct?.default_duration_min ?? 45,
            class_name: ct?.name || 'Class',
            class_code: ct?.code,
            category: ct?.category,
            coach_name: coach?.name,
            location: s.location,
            capacity: cap,
            spots_left: Math.max(0, cap - booked),
            full: cap > 0 && booked >= cap,
            public_notes: s.public_notes,
            class_plan: s.class_plan || s.public_notes || undefined,
            share_code: s.share_code,
            my_status: myBooking?.status || null,
            my_booking_id: myBooking?.id || null,
            my_rsvp: myBooking?.rsvp || null,
            programme: programmeForSessionPayload(store, s, {
              memberFacing: true,
            }),
          };
        })
        .sort((a, b) =>
          a.date === b.date
            ? a.start_time.localeCompare(b.start_time)
            : a.date.localeCompare(b.date)
        )
    : [];

  const my_bookings = shareSchedule
    ? store.bookings
        .filter(
          (b) =>
            b.client_id === client.id &&
            (() => {
              const s = store.sessions.find((x) => x.id === b.session_id);
              if (!s || s.date < historyFrom) return false;
              if (b.status !== 'cancelled') return true;
              return b.rsvp === 'not_coming' && s.date >= start;
            })()
        )
        .map((b) => {
          const s = store.sessions.find((x) => x.id === b.session_id)!;
          const ct = classTypeById(store, s.class_type_id);
          const coach = coachById(store, s.coach_id);
          const upcoming = s.date >= start;
          return {
            booking_id: b.id,
            status: b.status,
            session_id: s.id,
            date: s.date,
            start_time: s.start_time,
            class_name: ct?.name || 'Class',
            coach_name: coach?.name,
            location: s.location,
            upcoming,
            feedback_token: shareFeedback ? b.feedback_token || null : null,
            feedback_submitted_at: shareFeedback
              ? b.feedback_submitted_at || null
              : null,
            coach_feedback: b.coach_feedback || null,
            coach_member_feeling: b.coach_member_feeling ?? null,
            coach_member_rating: b.coach_member_rating ?? null,
            rsvp: b.rsvp || null,
            programme: programmeForSessionPayload(store, s, {
              memberFacing: true,
            }),
          };
        })
        .sort((a, b) =>
          a.date === b.date
            ? a.start_time.localeCompare(b.start_time)
            : a.date.localeCompare(b.date)
        )
    : [];

  const plan = client.membership_plan_id
    ? store.membership_plans.find((p) => p.id === client.membership_plan_id)
    : null;
  const assignedCoach = client.coach_id
    ? store.coaches.find((c) => c.id === client.coach_id)
    : null;

  return {
    logo_url: logoUrlFromSettings(
      store.settings as { company_logo_url?: string | null } | undefined
    ),
    brand:
      store.settings?.brand_name ||
      store.settings?.public_bio?.slice(0, 40) ||
      'Gym',
    bio: store.settings?.public_bio,
    timezone: store.settings?.timezone || 'Africa/Johannesburg',
    allow_booking: store.settings?.allow_public_booking !== false,
    contact_email: store.settings?.contact_email,
    contact_phone: store.settings?.contact_phone,
    primary_color: gymBrandColor(store.settings?.embed_primary_color),
    from: start,
    to: end,
    client: {
      id: client.id,
      code: client.code,
      name: client.name,
      email: client.email,
      phone: client.phone,
      id_number: client.id_number || undefined,
      photo_url: client.photo_url,
      membership_status: client.membership_status,
      plan_name: plan?.name,
      plan_code: plan?.code,
      coach_name: assignedCoach?.name,
      invite_status: client.invite_status || null,
      identity: (() => {
        try {
          // lazy to avoid circular weight — inline mini view
          const id = client.identity;
          const status = String(id?.status || 'unverified');
          return {
            status,
            provider: id?.provider || null,
            verified_at: id?.verified_at || null,
            verified_name: id?.verified_name || null,
            status_text: id?.status_text || null,
            is_verified: status === 'verified',
          };
        } catch {
          return { status: 'unverified', is_verified: false };
        }
      })(),
      family: Array.isArray(client.family) ? client.family : [],
    },
    shares: {
      schedule: shareSchedule,
      feedback: shareFeedback,
    },
    open_classes,
    vacancies: open_classes.filter((c) => !c.full && !c.my_status),
    my_bookings,
    upcoming_count: my_bookings.filter((b) => b.upcoming).length,
    open_count: open_classes.filter((c) => !c.full).length,
    full_count: open_classes.filter((c) => c.full && !c.my_status).length,
    /** Care messages with coaches / desk (member is a participant) */
    threads: threadsForParticipant(
      store.threads || [],
      'member',
      client.id
    ).map((t) => ({
      id: t.id,
      subject: t.subject,
      channel: t.channel,
      title: threadTitle(t, 'member', client.id),
      preview: previewText(t),
      updated_at: t.updated_at,
      unread: unreadInThread(t, 'member', client.id),
      participants: t.participants,
      messages: t.messages,
    })),
    messages_unread: totalUnread(store.threads || [], 'member', client.id),
    /** PT / session packs remaining (tracking only — payment offline) */
    packs: (store.pt_packs || [])
      .filter((p) => p.client_id === client.id)
      .map((p) => ({
        id: p.id,
        label: p.label || 'PT pack',
        sessions_total: p.sessions_total,
        sessions_used: p.sessions_used,
        remaining: Math.max(
          0,
          (p.sessions_total || 0) - (p.sessions_used || 0)
        ),
        expires_at: p.expires_at || null,
        status: p.status || 'active',
      })),
    /** Gym door QR — member scans on arrival (same unique public_token) */
    gym_checkin: store.settings?.public_token
      ? {
          public_token: store.settings.public_token,
          path: gymCheckinPath(store.settings.public_token),
          brand:
            store.settings.brand_name ||
            store.settings.public_bio?.slice(0, 40) ||
            'Gym',
        }
      : null,
    access: evaluateMemberAccess(store, client),
    announcements: publishedAnnouncements(store.announcements),
    ...buildMemberFacingProgress(store, client, shareFeedback, start),
  };
}

/** Attendance, goals, coach notes, and class feedback for the member portal. */
function buildMemberFacingProgress(
  store: FitgraphStore,
  client: FitClient,
  shareFeedback: boolean,
  today: string
) {
  const from30 = (() => {
    const d = new Date(today + 'T12:00:00');
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  })();

  const myBookings = (store.bookings || []).filter(
    (b) => b.client_id === client.id && b.status !== 'cancelled'
  );
  const attended = myBookings.filter((b) => b.status === 'attended');
  const sessionDate = (b: FitBooking) => {
    const s = store.sessions.find((x) => x.id === b.session_id);
    return s?.date || '';
  };
  const lastAttended =
    attended
      .map(sessionDate)
      .filter(Boolean)
      .sort()
      .reverse()[0] || null;

  const myFeedback = shareFeedback
    ? (store.class_feedback || [])
        .filter((f) => f.role === 'member' && f.client_id === client.id)
        .sort((a, b) =>
          (b.updated_at || b.created_at).localeCompare(
            a.updated_at || a.created_at
          )
        )
        .slice(0, 12)
        .map((f) => {
          const s = store.sessions.find((x) => x.id === f.session_id);
          const ct = s ? classTypeById(store, s.class_type_id) : null;
          return {
            id: f.id,
            at: f.updated_at || f.created_at,
            class_name: ct?.name || 'Class',
            date: s?.date || f.created_at.slice(0, 10),
            feeling: f.feeling,
            intensity: f.intensity,
            enjoyment: f.enjoyment ?? null,
            comment: f.comment || null,
            tags: f.tags || [],
          };
        })
    : [];

  const coachNotes = (store.journey_events || [])
    .filter(
      (e) =>
        e.client_id === client.id &&
        e.kind === 'coach_note' &&
        e.visibility !== 'coach_private'
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      at: e.at,
      title: e.title,
      body: e.body || null,
    }));

  const health = client.health
    ? {
        summary: healthSummaryLabel(client.health),
        injury_status: client.health.injury_status || null,
        injury_areas: client.health.injury_areas || [],
        training_modifications: client.health.training_modifications || null,
        goals: client.health.goals || null,
        pain_score: client.health.pain_score ?? null,
      }
    : null;

  const raw = buildRelationshipSummary(store, client.id, client.coach_id, {
    audience: 'member',
  });
  const relationship = {
    health: {
      score: raw.health.score,
      level: raw.health.level,
      label: raw.health.label,
      metrics: {
        attended_30d: raw.health.metrics.attended_30d,
        days_since_attended: raw.health.metrics.days_since_attended,
        active_goals: raw.health.metrics.active_goals,
      },
    },
    journey_preview: (raw.journey_preview || []).map((e) => ({
      id: e.id,
      at: e.at,
      title: e.title,
      body: e.body,
      kind: e.kind,
    })),
    active_goals: (raw.active_goals || []).map((g) => ({
      id: g.id,
      title: g.title,
      target_date: g.target_date,
      status: g.status,
      unit: g.unit ?? null,
      start_value: g.start_value ?? null,
      target_value: g.target_value ?? null,
      current_value: g.current_value ?? null,
      kind: g.kind || null,
    })),
    ledger: raw.ledger,
  };

  return {
    progress: {
      attended_count: client.attended_count ?? attended.length,
      no_show_count: client.no_show_count || 0,
      attended_30d: attended.filter((b) => sessionDate(b) >= from30).length,
      check_ins_30d: (store.check_ins || []).filter(
        (c) => c.client_id === client.id && c.date >= from30
      ).length,
      last_attended: lastAttended,
      health,
      coach_notes: coachNotes,
      my_feedback: myFeedback,
      pending_feedback: shareFeedback
        ? pendingFeedbackForClient(store, client)
        : [],
    },
    relationship,
    programme_follows: buildMemberProgrammeFollows({
      programmes: store.programmes || [],
      enrollments: store.programme_enrollments || [],
      logs: store.programme_logs || [],
      movements: listedFitMovements(store),
      coaches: store.coaches || [],
      clientId: client.id,
      today,
    }),
  };
}

function pendingFeedbackForClient(store: FitgraphStore, client: FitClient) {
  return (store.bookings || [])
    .filter((b) => {
      if (b.client_id !== client.id || !b.feedback_token || b.feedback_submitted_at)
        return false;
      const s = store.sessions.find((x) => x.id === b.session_id);
      return bookingEligibleForClientRating({
        status: b.status,
        submittedAt: b.feedback_submitted_at,
        date: s?.date,
        startTime: s?.start_time,
      });
    })
    .map((b) => {
      const s = store.sessions.find((x) => x.id === b.session_id);
      const ct = s ? classTypeById(store, s.class_type_id) : null;
      return {
        booking_id: b.id,
        session_id: b.session_id,
        date: s?.date || '',
        class_name: ct?.name || 'Class',
        feedback_token: b.feedback_token as string,
      };
    })
    .slice(0, 8);
}

export function ensurePublicToken(
  settings: FitPublicSettings | undefined,
  companyId?: number
): FitPublicSettings {
  const base: FitPublicSettings = {
    enabled: false,
    allow_public_booking: true,
    show_coaches: true,
    show_pricing: true,
    timezone: 'Africa/Johannesburg',
    embed_primary_color: GYM_BRAND_YELLOW,
    public_token: '',
    ...(settings || {}),
  };
  if (!base.public_token) {
    base.public_token =
      companyId != null
        ? `fg_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
        : defaultPublicSettings().public_token;
  }
  return base;
}

export function summariseFitgraph(store: FitgraphStore) {
  const coaches = store.coaches.filter((c) => c.active !== false);
  const clients = store.clients.filter((c) => c.active !== false);
  const activeMembers = clients.filter(
    (c) => c.membership_status === 'active' || c.membership_status === 'trial'
  );
  const today = new Date().toISOString().slice(0, 10);
  const sessionsToday = store.sessions.filter(
    (s) => s.date === today && s.status !== 'cancelled'
  );
  const bookingsOpen = store.bookings.filter(
    (b) => b.status === 'booked' || b.status === 'waitlist'
  );
  const checkInsToday = store.check_ins.filter((c) => c.date === today);
  const checkInsUnpaidToday = checkInsToday.filter(
    (c) => c.payment_ok === false || Boolean(c.access_alert)
  );
  const checkInsBlockedToday = checkInsToday.filter(
    (c) => c.access_level === 'blocked'
  );
  const ptRemaining = store.pt_packs.reduce(
    (n, p) =>
      n + Math.max(0, (Number(p.sessions_total) || 0) - (Number(p.sessions_used) || 0)),
    0
  );
  const plans = store.membership_plans.filter((p) => p.active !== false);
  const subs = (store.subscriptions || []).filter(
    (s) => s.status === 'active' || s.status === 'trialing'
  );
  const publicSessions = store.sessions.filter(
    (s) => s.public && s.status === 'scheduled' && s.date >= today
  );

  return {
    coachCount: coaches.length,
    clientCount: clients.length,
    activeMembers: activeMembers.length,
    planCount: plans.length,
    activeSubscriptions: subs.length,
    classTypeCount: store.class_types.filter((c) => c.active !== false).length,
    movementCount: listedFitMovements(store).filter((m) => m.active !== false)
      .length,
    programmeCount: (store.programmes || []).filter((p) => p.active !== false)
      .length,
    programmeEnrollmentCount: (store.programme_enrollments || []).filter(
      (e) => e.status === 'active'
    ).length,
    programmeLogCount: (store.programme_logs || []).length,
    sessionsToday: sessionsToday.length,
    sessionsUpcoming: store.sessions.filter(
      (s) => s.date >= today && s.status === 'scheduled'
    ).length,
    publicSessionsUpcoming: publicSessions.length,
    bookingsOpen: bookingsOpen.length,
    checkInsToday: checkInsToday.length,
    checkInsUnpaidToday: checkInsUnpaidToday.length,
    checkInsBlockedToday: checkInsBlockedToday.length,
    checkInsTotal: store.check_ins.length,
    gymCheckinEnabled: Boolean(store.settings?.public_token),
    feedbackCount: (store.class_feedback || []).length,
    memberFeedbackCount: (store.class_feedback || []).filter(
      (f) => f.role === 'member'
    ).length,
    pendingFeedback: (store.bookings || []).filter(
      (b) =>
        b.status === 'attended' &&
        b.feedback_token &&
        !b.feedback_submitted_at
    ).length,
    threadCount: (store.threads || []).filter((t) => !t.archived).length,
    unreadMessages: totalUnread(
      store.threads || [],
      'desk',
      'desk'
    ),
    hasFrontDesk: fitgraphHasFrontDesk(store.settings),
    coachFeedbackCount: (store.class_feedback || []).filter(
      (f) => f.role === 'coach'
    ).length,
    ptSessionsRemaining: ptRemaining,
    websiteEnabled: store.settings?.enabled === true,
    publicBooking: store.settings?.allow_public_booking === true,
    ...gymCommandBookingMetrics(store),
  };
}

/** Public calendar payload for website embed (no private PII) */
export function buildPublicCalendarPayload(
  store: FitgraphStore,
  opts?: { from?: string; to?: string; coachId?: string }
) {
  const today = new Date().toISOString().slice(0, 10);
  const from = opts?.from || today;
  const toDate = new Date(from + 'T12:00:00');
  toDate.setDate(toDate.getDate() + 28);
  const to = opts?.to || toDate.toISOString().slice(0, 10);

  const sessions = store.sessions
    .filter(
      (s) =>
        isPublicListingSession(store, s) &&
        s.date >= from &&
        s.date <= to &&
        (!opts?.coachId || s.coach_id === opts.coachId)
    )
    .map((s) => {
      const ct = classTypeById(store, s.class_type_id);
      const coach = coachById(store, s.coach_id);
      const booked = sessionBookingCount(store, s.id);
      const cap = s.capacity ?? ct?.capacity ?? 0;
      return {
        id: s.id,
        date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        duration_min: s.duration_min ?? ct?.default_duration_min ?? 45,
        class_name: ct?.name || 'Class',
        class_code: ct?.code,
        category: ct?.category,
        coach_name: coach?.name,
        coach_code: coach?.code,
        location: s.location,
        capacity: cap,
        spots_left: Math.max(0, cap - booked),
        full: cap > 0 && booked >= cap,
        public_notes: s.public_notes,
        /** Planned activities — members see this on the public calendar */
        class_plan: s.class_plan || s.public_notes || undefined,
        share_code: s.share_code,
        programme: programmeForSessionPayload(store, s, {
          memberFacing: true,
        }),
      };
    })
    .sort((a, b) =>
      a.date === b.date
        ? a.start_time.localeCompare(b.start_time)
        : a.date.localeCompare(b.date)
    );

  const showTeam = isPortalSectionOn(store.settings, 'team');
  const showJoin = isPortalSectionOn(store.settings, 'join');
  const showPolicies = isPortalSectionOn(store.settings, 'policies');
  const showHours = isPortalSectionOn(store.settings, 'hours');
  const showTimetable = isPortalSectionOn(store.settings, 'timetable');

  const coaches = showTeam
    ? store.coaches
        .filter((c) => c.active !== false && !c.end_date)
        .map((c) => ({
          code: c.code,
          name: c.name,
          specialties: c.specialties || [],
          bio: c.public_bio || c.bio,
          color: c.color,
          photo_url: c.photo_url || undefined,
          qualifications: (c.qualifications || [])
            .filter((q) => q.public !== false)
            .map((q) => ({
              title: q.title,
              issuer: q.issuer,
              year: q.year,
              certificates: (q.certificates || []).map((d) => ({
                file_name: d.file_name,
                url: d.url,
              })),
            })),
        }))
    : [];

  const plans = showJoin
    ? store.membership_plans
        .filter((p) => p.active !== false && p.public !== false)
        .map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          price_zar: p.price_zar,
          billing: p.billing,
          description: p.description,
          class_credits: p.class_credits,
          access: p.access || 'classes',
          programme_id: p.programme_id || null,
          schedule_label: p.schedule_label,
          audience: p.audience,
          addon: p.addon === true,
        }))
    : [];
  const shopProgrammes = (store.programmes || [])
    .filter(
      (p) =>
        p.active !== false &&
        p.public === true &&
        p.personal_for_coach !== true &&
        Number(p.price_zar) > 0
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: [p.weeks ? `${p.weeks}-week programme` : null, p.description]
        .filter(Boolean)
        .join(' · '),
      price_zar: Number(p.price_zar) || 0,
      billing: p.billing || 'once',
      kind: p.kind,
      weeks: p.weeks || null,
    }));

  const contracts = showPolicies
    ? (store.settings?.contracts || []).map((d) => ({
          id: d.id,
          title: d.title,
          file_name: d.file_name,
          url: d.url,
          kind: d.kind || 'other',
        }))
    : [];

  return {
    brand: store.settings?.brand_name || 'Gym',
    bio: store.settings?.public_bio || store.settings?.bio || '',
    timezone: store.settings?.timezone || 'Africa/Johannesburg',
    allow_booking: store.settings?.allow_public_booking !== false,
    contact_email: store.settings?.contact_email,
    contact_phone: store.settings?.contact_phone,
    website_url: store.settings?.website_url,
    logo_url: logoUrlFromSettings(
      store.settings as { company_logo_url?: string | null } | undefined
    ),
    hours:
      showHours && store.settings?.working_hours
        ? compactWorkingHours(store.settings.working_hours)
        : undefined,
    sections: {
      timetable: showTimetable,
      team: showTeam,
      join: showJoin,
      policies: showPolicies,
      hours: showHours,
    },
    city: store.settings?.marketplace?.city,
    primary_color: gymBrandColor(store.settings?.embed_primary_color),
    from,
    to,
    sessions: showTimetable ? sessions : [],
    coaches,
    plans,
    programmes: showJoin ? shopProgrammes : [],
    require_paid_membership:
      store.settings?.require_paid_membership === false
        ? false
        : store.settings?.require_paid_membership === true
          ? true
          : plans.some((p) => Number(p.price_zar) > 0),
    joining:
      store.settings?.joining_fee_zar != null
        ? {
            fee_zar: Number(store.settings.joining_fee_zar) || 0,
            waived: store.settings.joining_fee_waived === true,
            note: store.settings.joining_fee_note || '',
          }
        : null,
    class_subscribe: store.settings?.class_subscribe === true,
    contracts,
  };
}

/** Build one or many sessions for coach/owner scheduling */
export function createSessionsFromTemplate(
  store: FitgraphStore,
  template: {
    class_type_id: string;
    /** Optional — class can be created first, coach assigned later */
    coach_id?: string | null;
    date: string;
    start_time: string;
    end_time?: string | null;
    duration_min?: number | null;
    session_kind?: FitSessionKind;
    capacity?: number | null;
    location?: string;
    room?: string | null;
    public?: boolean;
    notes?: string;
    public_notes?: string;
    class_plan?: string;
    origin?: string;
    programme_id?: string | null;
    /** Reuse a catalog series so class-specific plans still match. */
    series_id?: string | null;
  },
  recurrence?: FitRecurrence | null,
  nowIso?: string
): FitSession[] {
  const now = nowIso || new Date().toISOString();
  const dates = expandRecurrenceDates(template.date, recurrence);
  const forcedSeries = String(template.series_id || '').trim();
  const seriesId = forcedSeries
    ? forcedSeries
    : dates.length > 1
      ? newId('ser')
      : (null as string | null);
  const resolved = resolveClassTypeForSession(store, {
    class_type_id: template.class_type_id,
    session_kind: template.session_kind,
  });
  const ct = classTypeById(store, resolved.class_type_id);
  const kind = resolved.kind;
  const times = resolveSessionTimes({
    start_time: template.start_time,
    end_time: template.end_time,
    duration_min: template.duration_min,
    fallbackDuration: ct?.default_duration_min ?? (kind === 'class' ? 45 : 60),
  });
  const rules = applySessionKindRules(kind, {
    public: template.public,
    capacity:
      template.capacity ??
      (kind === 'class' ? (ct?.capacity ?? 20) : undefined),
  });
  const coachId = template.coach_id ? String(template.coach_id) : null;
  return dates.map((date) => {
    const id = newId('ses');
    return {
      id,
      class_type_id: resolved.class_type_id,
      coach_id: coachId,
      date,
      start_time: times.start_time,
      end_time: times.end_time,
      duration_min: times.duration_min,
      session_kind: kind,
      capacity: rules.capacity,
      location: template.location,
      room: template.room ?? null,
      status: 'scheduled' as const,
      public: rules.public,
      // Always issue a share code so B2C join links work (invite-only or public)
      share_code: `s_${Math.random().toString(36).slice(2, 12)}`,
      notes: template.notes,
      public_notes: template.public_notes,
      class_plan: template.class_plan,
      series_id: seriesId,
      origin:
        template.origin ||
        (dates.length > 1 ? 'series' : 'one_off'),
      programme_id: template.programme_id ?? null,
      created_at: now,
    };
  });
}

export type CoachRosterRow = {
  booking_id: string;
  client_id: string;
  status: string;
  /** Plan = booked / waitlist; Actual = attended / no_show */
  plan: boolean;
  actual: 'pending' | 'attended' | 'no_show' | 'cancelled';
  name: string;
  email?: string;
  phone?: string;
  health?: FitClientHealth;
  injured?: boolean;
  health_label?: string;
  coach_feedback?: string | null;
  coach_feedback_at?: string | null;
  rsvp?: 'coming' | 'not_coming' | null;
};

export type CoachSessionCard = {
  session: FitSession;
  programme?: ReturnType<typeof programmeForSessionPayload>;
  class_name?: string;
  class_code?: string;
  capacity: number;
  /** Planned attendance (booked + attended, not waitlist) */
  planned: number;
  waitlist: number;
  attended: number;
  no_show: number;
  pending: number;
  roster: CoachRosterRow[];
  /** Aggregated member feedback for this session */
  feedback_summary?: {
    member_count: number;
    coach_count: number;
    avg_feeling: number | null;
    avg_intensity: number | null;
    avg_enjoyment: number | null;
  };
  /** This coach's own feedback for the session (if any) */
  my_feedback?: FitClassFeedback | null;
  /** Member feedback rows (coach/owner can read) */
  member_feedback?: FitClassFeedback[];
};

/** Coach portal / coach calendar: sessions + plan vs actual roster */
export function buildCoachPortalPayload(
  store: FitgraphStore,
  coach: FitCoach,
  from?: string,
  to?: string
) {
  const start = from || new Date().toISOString().slice(0, 10);
  const end = to || addDaysIso(start, 27);

  const mySessions: CoachSessionCard[] = store.sessions
    .filter(
      (s) =>
        s.coach_id === coach.id &&
        s.date >= start &&
        s.date <= end &&
        s.status !== 'cancelled'
    )
    .map((s) => {
      const ct = classTypeById(store, s.class_type_id);
      const rows = store.bookings.filter((b) => b.session_id === s.id);
      const roster: CoachRosterRow[] = rows.map((b) => {
        const client = clientById(store, b.client_id);
        const actual: CoachRosterRow['actual'] =
          b.status === 'attended'
            ? 'attended'
            : b.status === 'no_show'
              ? 'no_show'
              : b.status === 'cancelled'
                ? 'cancelled'
                : 'pending';
        return {
          booking_id: b.id,
          client_id: b.client_id,
          status: b.status,
          plan:
            b.status === 'booked' ||
            b.status === 'attended' ||
            b.status === 'no_show' ||
            b.status === 'waitlist',
          actual,
          name: client?.name || b.guest_name || 'Guest',
          email: client?.email || b.guest_email,
          phone: client?.phone || b.guest_phone,
          health: client?.health,
          injured: client?.health
            ? client.health.injured === true ||
              (Array.isArray(client.health.injury_areas) &&
                client.health.injury_areas.length > 0 &&
                client.health.injury_status !== 'cleared' &&
                client.health.injury_status !== 'none')
            : false,
          health_label: client?.health
            ? [
                (client.health.injury_areas || []).slice(0, 2).join(', '),
                client.health.injury_side && client.health.injury_side !== 'n/a'
                  ? client.health.injury_side
                  : null,
                client.health.injury_status &&
                client.health.injury_status !== 'none'
                  ? client.health.injury_status
                  : null,
              ]
                .filter(Boolean)
                .join(' · ') || (client.health.injured ? 'Injured' : '')
            : '',
          coach_feedback: b.coach_feedback || null,
          coach_feedback_at: b.coach_feedback_at || null,
          coach_member_feeling: b.coach_member_feeling ?? null,
          coach_member_rating: b.coach_member_rating ?? null,
          rsvp: b.rsvp || null,
        };
      });
      const planned = roster.filter(
        (r) =>
          r.status === 'booked' ||
          r.status === 'attended' ||
          r.status === 'no_show'
      ).length;
      const fbSummary = summariseSessionFeedback(store, s.id);
      const myFb =
        (store.class_feedback || []).find(
          (f) =>
            f.session_id === s.id &&
            f.role === 'coach' &&
            f.coach_id === coach.id
        ) || null;
      const memberFb = (store.class_feedback || []).filter(
        (f) => f.session_id === s.id && f.role === 'member'
      );
      return {
        session: s,
        scheduled_by: sessionScheduledBy(s),
        programme: programmeForSessionPayload(store, s),
        class_name: ct?.name,
        class_code: ct?.code,
        capacity: s.capacity ?? ct?.capacity ?? 0,
        planned,
        waitlist: roster.filter((r) => r.status === 'waitlist').length,
        attended: roster.filter((r) => r.actual === 'attended').length,
        no_show: roster.filter((r) => r.actual === 'no_show').length,
        pending: roster.filter(
          (r) => r.actual === 'pending' && r.status === 'booked'
        ).length,
        roster,
        feedback_summary: fbSummary,
        my_feedback: myFb,
        member_feedback: memberFb,
      };
    })
    .sort((a, b) =>
      a.session.date === b.session.date
        ? a.session.start_time.localeCompare(b.session.start_time)
        : a.session.date.localeCompare(b.session.date)
    );

  const members = store.clients
    .filter((c) => c.active !== false)
    .map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      email: c.email,
      phone: c.phone,
      emergency_contact: c.emergency_contact,
      notes: c.notes,
      membership_status: c.membership_status,
      coach_id: c.coach_id,
      date_of_birth: c.date_of_birth || c.passport?.date_of_birth || null,
      start_date: c.start_date || null,
      health: c.health,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const coachThreads = threadsForParticipant(
    store.threads || [],
    'coach',
    coach.id
  ).map((t) => ({
    id: t.id,
    channel: t.channel,
    subject: threadTitle(t, 'coach', coach.id),
    updated_at: t.updated_at,
    preview: previewText(t),
    unread: unreadInThread(t, 'coach', coach.id),
    participants: t.participants,
    messages: t.messages,
  }));
  const messagesUnread = totalUnread(store.threads || [], 'coach', coach.id);

  const classTypes = store.class_types
    .filter((c) => c.active !== false)
    .map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      default_duration_min: c.default_duration_min,
      capacity: c.capacity,
    }));

  // Group by date for calendar view
  const byDate: Record<string, CoachSessionCard[]> = {};
  for (const card of mySessions) {
    const d = card.session.date;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(card);
  }

  return {
    coach: {
      id: coach.id,
      code: coach.code,
      name: coach.name,
      email: coach.email || '',
      phone: coach.phone || '',
      id_number: coach.id_number || '',
      specialties: coach.specialties || [],
      bio: coach.bio || '',
      public_bio: coach.public_bio || coach.bio || '',
      qualifications: coach.qualifications || [],
      photo_url: coach.photo_url || '',
      color: coach.color || '',
      start_date: coach.start_date || (coach.created_at || '').slice(0, 10) || '',
      end_date: coach.end_date || '',
      rate_zar:
        coach.rate_zar != null && Number.isFinite(Number(coach.rate_zar))
          ? Number(coach.rate_zar)
          : null,
      rate_basis: coach.rate_basis || 'per_class',
      rate_note: coach.rate_note || '',
      history: coach.history || [],
      active: coach.active !== false,
      can_manage_classes: coach.can_manage_classes !== false,
      engagement: coach.engagement || (coach.hr_employee_id ? 'employed' : 'contractor'),
      identity: {
        status: String(coach.identity?.status || 'unverified'),
        provider: coach.identity?.provider || null,
        verified_at: coach.identity?.verified_at || null,
        verified_name: coach.identity?.verified_name || null,
        status_text: coach.identity?.status_text || null,
        is_verified: coach.identity?.status === 'verified',
      },
    },
    /** Full specialty catalogue for profile multi-select (owner-managed) */
    specialty_options: getCoachSpecialtyOptions(store),
    from: start,
    to: end,
    sessions: mySessions,
    by_date: byDate,
    members,
    class_types: classTypes,
    movements: listedFitMovements(store).filter(
      (m) =>
        m.active !== false &&
        (!m.coach_id || m.coach_id === coach.id)
    ),
    programmes: (store.programmes || []).filter(
      (p) =>
        p.active !== false &&
        (!p.coach_id || p.coach_id === coach.id)
    ),
    programme_follows: buildProgrammeFollowRoster({
      programmes: store.programmes || [],
      enrollments: store.programme_enrollments || [],
      logs: store.programme_logs || [],
      clients: store.clients || [],
      coachId: coach.id,
    }),
    threads: coachThreads,
    messages_unread: messagesUnread,
    /** Peer coaches for colleague messaging */
    peer_coaches: store.coaches
      .filter((c) => c.active !== false && c.id !== coach.id)
      .map((c) => ({ id: c.id, code: c.code, name: c.name })),
  };
}

export function programmeForSessionPayload(
  store: FitgraphStore,
  session: FitSession,
  opts?: { memberFacing?: boolean }
) {
  const found = resolveProgrammeForSession(store.programmes || [], {
    id: session.id,
    class_type_id: session.class_type_id,
    coach_id: session.coach_id,
    session_kind: sessionKindOf(store, session),
    programme_id: session.programme_id,
  });
  if (!found) return null;
  const weekday = dateToProgrammeWeekday(session.date);
  const block = programmeBlockForWeekday(found, weekday);
  const forSession: FitProgramme = block
    ? {
        ...found,
        name: block.title ? `${found.name} · ${block.title}` : found.name,
        description: block.notes || found.description,
        items: (block.items || []).length ? block.items : found.items,
      }
    : found;
  const hydrated = hydrateProgramme(forSession, listedFitMovements(store));
  if (opts?.memberFacing) return memberFacingProgramme(hydrated);
  return hydrated;
}

export function sessionBookingCount(
  store: FitgraphStore,
  sessionId: string
): number {
  return store.bookings.filter(
    (b) =>
      b.session_id === sessionId &&
      (b.status === 'booked' || b.status === 'attended')
  ).length;
}

/** Ensure session has a share_code for B2C join links */
export function ensureSessionShareCode(session: FitSession): string {
  if (session.share_code) return session.share_code;
  session.share_code = `s_${Math.random().toString(36).slice(2, 12)}`;
  return session.share_code;
}

/** Absolute join URL for a class (B2C) */
export function buildClassJoinPath(
  publicToken: string,
  shareCode: string
): string {
  return `/join/fitgraph/${encodeURIComponent(publicToken)}/${encodeURIComponent(shareCode)}`;
}

/** Find session by public share_code */
export function sessionByShareCode(
  store: FitgraphStore,
  shareCode: string
): FitSession | undefined {
  const code = String(shareCode || '').trim();
  if (!code) return undefined;
  return store.sessions.find(
    (s) => s.share_code === code && s.status !== 'cancelled'
  );
}

/** Public detail payload for a single class join page */
export function buildClassJoinPayload(
  store: FitgraphStore,
  shareCode: string
): {
  session: {
    id: string;
    date: string;
    start_time: string;
    end_time?: string | null;
    duration_min?: number | null;
    location?: string;
    capacity: number;
    spots_left: number;
    full: boolean;
    class_name: string;
    class_plan?: string;
    public_notes?: string;
    coach_name?: string;
    share_code: string;
  };
  brand: string;
  timezone: string;
  contact_email?: string;
  contact_phone?: string;
  allow_booking: boolean;
} | null {
  const session = sessionByShareCode(store, shareCode);
  if (!session) return null;
  if (sessionKindOf(store, session) === 'coach_personal') return null;
  const ct = classTypeById(store, session.class_type_id);
  const coach = coachById(store, session.coach_id);
  const booked = sessionBookingCount(store, session.id);
  const cap = session.capacity ?? ct?.capacity ?? 0;
  return {
    session: {
      id: session.id,
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      duration_min: session.duration_min ?? ct?.default_duration_min ?? 45,
      location: session.location,
      capacity: cap,
      spots_left: Math.max(0, cap - booked),
      full: cap > 0 && booked >= cap,
      class_name: ct?.name || 'Class',
      class_plan: session.class_plan || session.public_notes,
      public_notes: session.public_notes,
      coach_name: coach?.name,
      share_code: session.share_code || shareCode,
    },
    brand: store.settings?.brand_name || 'Gym',
    timezone: store.settings?.timezone || 'Africa/Johannesburg',
    contact_email: store.settings?.contact_email,
    contact_phone: store.settings?.contact_phone,
    allow_booking: store.settings?.allow_public_booking !== false,
  };
}

/** Build .ics body for “Add to calendar” */
export function buildSessionIcs(opts: {
  sessionId: string;
  title: string;
  date: string;
  start_time: string;
  duration_min?: number | null;
  location?: string;
  description?: string;
  brand?: string;
}): string {
  const dur = Math.max(15, Number(opts.duration_min) || 45);
  const [hh, mm] = opts.start_time.split(':').map(Number);
  const start = new Date(`${opts.date}T${String(hh).padStart(2, '0')}:${String(mm || 0).padStart(2, '0')}:00`);
  const end = new Date(start.getTime() + dur * 60_000);
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const uid = `${opts.sessionId}@supplieradvisor.fitgraph`;
  const desc = (opts.description || '')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,');
  const loc = (opts.location || '').replace(/,/g, '\\,');
  const summary = (opts.title || 'Class').replace(/,/g, '\\,');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SupplierAdvisor//GymAdvisor//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${summary}`,
    loc ? `LOCATION:${loc}` : '',
    desc ? `DESCRIPTION:${desc}` : '',
    opts.brand ? `ORGANIZER;CN=${opts.brand.replace(/,/g, '')}:MAILTO:noreply@supplieradvisor.com` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

/** Google Calendar “add event” URL */
export function buildGoogleCalendarUrl(opts: {
  title: string;
  date: string;
  start_time: string;
  duration_min?: number | null;
  location?: string;
  description?: string;
}): string {
  const dur = Math.max(15, Number(opts.duration_min) || 45);
  const [hh, mm] = opts.start_time.split(':').map(Number);
  const start = new Date(`${opts.date}T${String(hh).padStart(2, '0')}:${String(mm || 0).padStart(2, '0')}:00`);
  const end = new Date(start.getTime() + dur * 60_000);
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: opts.description || '',
    location: opts.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function coachById(store: FitgraphStore, id?: string | null) {
  if (!id) return undefined;
  return store.coaches.find((c) => c.id === id);
}

export function clientById(store: FitgraphStore, id?: string | null) {
  if (!id) return undefined;
  return store.clients.find((c) => c.id === id);
}

export function classTypeById(store: FitgraphStore, id?: string | null) {
  if (!id) return undefined;
  return store.class_types.find((c) => c.id === id);
}

export function planById(store: FitgraphStore, id?: string | null) {
  if (!id) return undefined;
  return store.membership_plans.find((p) => p.id === id);
}

/** Week grid helper: sessions between from–to dates */
export function sessionsInRange(
  store: FitgraphStore,
  from: string,
  to: string
): FitSession[] {
  return store.sessions
    .filter((s) => s.date >= from && s.date <= to && s.status !== 'cancelled')
    .sort((a, b) =>
      a.date === b.date
        ? a.start_time.localeCompare(b.start_time)
        : a.date.localeCompare(b.date)
    );
}

export function attendanceByClass(store: FitgraphStore) {
  const map = new Map<
    string,
    { class_name: string; sessions: number; bookings: number; attended: number }
  >();
  for (const s of store.sessions) {
    const ct = classTypeById(store, s.class_type_id);
    const key = s.class_type_id;
    const row = map.get(key) || {
      class_name: ct?.name || key,
      sessions: 0,
      bookings: 0,
      attended: 0,
    };
    row.sessions += 1;
    const books = store.bookings.filter((b) => b.session_id === s.id);
    row.bookings += books.filter(
      (b) => b.status === 'booked' || b.status === 'attended'
    ).length;
    row.attended += books.filter((b) => b.status === 'attended').length;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.sessions - a.sessions);
}
