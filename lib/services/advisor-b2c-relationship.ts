/**
 * Shared B2C relationship layer for medical + gym advisors.
 *
 * Applies to: DentalAdvisor, PhysioAdvisor, MedicalAdvisor, PsychiatryAdvisor,
 * and GymAdvisor (alongside fitgraph-relationship).
 *
 * Design principles (POPIA-aligned):
 * - Patient/member owns the relationship and consents to shares
 * - Practice owns operational records; patient sees a safe summary when allowed
 * - Cross-professional share only after explicit consent (pending → active)
 * - Soft health signals drive care queues without exposing full charts
 */

import type { AdvisorShareKind } from '@/lib/b2c/profile-share-types';

export type AdvisorModuleKind =
  | AdvisorShareKind
  | 'gym'
  | 'physio'
  | 'dental'
  | 'medical'
  | 'psychiatry';

export type ClinicalShareScope =
  | 'summary'
  | 'treatment_plan'
  | 'scripts'
  | 'clinical_notes'
  | 'imaging_docs'
  | 'full_chart';

export const CLINICAL_SHARE_SCOPE_LABEL: Record<ClinicalShareScope, string> = {
  summary: 'Health summary',
  treatment_plan: 'Treatment / care plan',
  scripts: 'Active scripts',
  clinical_notes: 'Clinical notes',
  imaging_docs: 'Documents & imaging',
  full_chart: 'Full chart (restricted)',
};

export const PATIENT_PORTAL_DEFAULT_SCOPES: ClinicalShareScope[] = [
  'summary',
  'treatment_plan',
  'scripts',
];

export const PROFESSIONAL_SHARE_DEFAULT_SCOPES: ClinicalShareScope[] = [
  'summary',
  'treatment_plan',
  'scripts',
];

export type RelationshipLevel =
  | 'strong'
  | 'steady'
  | 'cooling'
  | 'at_risk'
  | 'unknown';

export type AdvisorRelationshipHealth = {
  score: number;
  level: RelationshipLevel;
  label: string;
  metrics: {
    attended_30d: number;
    attended_90d: number;
    no_shows_90d: number;
    days_since_visit: number | null;
    open_plans: number;
    last_visit_at: string | null;
  };
  suggested_actions: Array<{
    code: string;
    title: string;
    priority: 'high' | 'medium' | 'low';
  }>;
};

export type AdvisorJourneyEvent = {
  id: string;
  person_id: string;
  module: AdvisorModuleKind;
  at: string;
  kind:
    | 'visit'
    | 'note'
    | 'goal'
    | 'plan'
    | 'message'
    | 'share_granted'
    | 'share_revoked'
    | 'story';
  title: string;
  body?: string;
  visibility: 'patient' | 'practice' | 'shared';
  author_role: 'patient' | 'clinician' | 'owner' | 'system';
};

export type AdvisorCareGoal = {
  id: string;
  person_id: string;
  module: AdvisorModuleKind;
  title: string;
  target_date?: string | null;
  status: 'active' | 'achieved' | 'paused' | 'cancelled';
  created_at: string;
  updated_at: string;
};

export type PatientRecordShareGrant = {
  id: string;
  person_id: string;
  from_company_id: number;
  from_module: AdvisorModuleKind;
  to:
    | { type: 'patient' }
    | {
        type: 'professional';
        company_id: number;
        module: AdvisorModuleKind;
        label?: string;
      };
  scopes: ClinicalShareScope[];
  status: 'pending' | 'active' | 'revoked' | 'expired';
  requested_by: 'patient' | 'practice';
  note?: string | null;
  created_at: string;
  decided_at?: string | null;
  expires_at?: string | null;
};

export type ClinicEngagementInput = {
  person_id: string;
  person_name: string;
  clinician_id?: string | null;
  last_attended_at?: string | null;
  attended_30d?: number;
  attended_90d?: number;
  no_shows_90d?: number;
  open_plan_items?: number;
  soft_blocked?: boolean;
  recall_after_days?: number;
};

const LEVEL_LABEL: Record<RelationshipLevel, string> = {
  strong: 'Strong',
  steady: 'Steady',
  cooling: 'Cooling',
  at_risk: 'At risk',
  unknown: 'Building',
};

function daysBetween(fromIso: string | null | undefined, to = new Date()): number | null {
  if (!fromIso) return null;
  const t = Date.parse(fromIso.slice(0, 10));
  if (!Number.isFinite(t)) return null;
  return Math.floor((to.getTime() - t) / (24 * 60 * 60 * 1000));
}

export function computeAdvisorRelationshipHealth(
  input: ClinicEngagementInput
): AdvisorRelationshipHealth {
  const attended30 = input.attended_30d ?? 0;
  const attended90 = input.attended_90d ?? 0;
  const noShows = input.no_shows_90d ?? 0;
  const days = daysBetween(input.last_attended_at);
  const openPlans = input.open_plan_items ?? 0;
  const recall = input.recall_after_days ?? 45;

  let score = 55;
  if (attended30 >= 3) score += 20;
  else if (attended30 >= 1) score += 10;
  else if (attended90 >= 1) score += 4;
  else score -= 8;

  if (noShows >= 3) score -= 25;
  else if (noShows >= 1) score -= 10;

  if (days == null) score -= 5;
  else if (days > recall * 1.5) score -= 30;
  else if (days > recall) score -= 18;
  else if (days > Math.floor(recall * 0.7)) score -= 8;
  else if (days <= 14) score += 8;

  if (openPlans > 0 && (days == null || days > 21)) score -= 5;
  if (input.soft_blocked) score -= 12;

  score = Math.max(0, Math.min(100, score));

  let level: RelationshipLevel = 'unknown';
  if (attended90 === 0 && !input.last_attended_at) level = 'unknown';
  else if (score >= 75) level = 'strong';
  else if (score >= 55) level = 'steady';
  else if (score >= 35) level = 'cooling';
  else level = 'at_risk';

  const suggested_actions: AdvisorRelationshipHealth['suggested_actions'] = [];
  if (level === 'at_risk' || (days != null && days > recall)) {
    suggested_actions.push({
      code: 'recall',
      title: 'Send a personal recall / check-in',
      priority: 'high',
    });
  }
  if (noShows >= 2) {
    suggested_actions.push({
      code: 'no_show_policy',
      title: 'Review no-show pattern with patient',
      priority: 'high',
    });
  }
  if (openPlans > 0) {
    suggested_actions.push({
      code: 'plan_followup',
      title: 'Book next step from open care plan',
      priority: 'medium',
    });
  }
  if (level === 'strong') {
    suggested_actions.push({
      code: 'acknowledge',
      title: 'Acknowledge progress / continuity of care',
      priority: 'low',
    });
  }

  return {
    score,
    level,
    label: LEVEL_LABEL[level],
    metrics: {
      attended_30d: attended30,
      attended_90d: attended90,
      no_shows_90d: noShows,
      days_since_visit: days,
      open_plans: openPlans,
      last_visit_at: input.last_attended_at || null,
    },
    suggested_actions,
  };
}

export type ClinicCareQueueItem = {
  person_id: string;
  person_name: string;
  clinician_id: string | null;
  health: AdvisorRelationshipHealth;
  priority: number;
};

export function buildClinicCareQueue(
  people: ClinicEngagementInput[],
  limit = 40
): ClinicCareQueueItem[] {
  const items: ClinicCareQueueItem[] = [];
  for (const p of people) {
    const health = computeAdvisorRelationshipHealth(p);
    if (health.level === 'strong' && health.suggested_actions.length === 0) {
      continue;
    }
    if (
      health.level === 'unknown' &&
      health.metrics.attended_90d === 0 &&
      !p.soft_blocked
    ) {
      continue;
    }
    let priority = 100 - health.score;
    if (health.level === 'at_risk') priority += 40;
    if (health.level === 'cooling') priority += 20;
    if (p.soft_blocked) priority += 15;
    items.push({
      person_id: p.person_id,
      person_name: p.person_name,
      clinician_id: p.clinician_id || null,
      health,
      priority,
    });
  }
  items.sort((a, b) => b.priority - a.priority);
  return items.slice(0, limit);
}

export function engagementFromClinicStore(store: {
  patients?: Array<{
    id: string;
    name: string;
    active?: boolean;
    primary_clinician_id?: string | null;
    dentist_id?: string | null;
    physio_id?: string | null;
    booking_soft_block?: boolean;
  }>;
  appointments?: Array<{
    id: string;
    date: string;
    status?: string;
    patient_id?: string;
    clinician_id?: string | null;
    staff_id?: string | null;
  }>;
  bookings?: Array<{
    appointment_id?: string;
    patient_id: string;
    status: string;
    booked_at?: string;
  }>;
  recall_after_days?: number;
}): ClinicEngagementInput[] {
  const patients = (store.patients || []).filter((p) => p.active !== false);
  const now = new Date();
  const d30 = new Date(now);
  d30.setDate(d30.getDate() - 30);
  const d90 = new Date(now);
  d90.setDate(d90.getDate() - 90);
  const iso30 = d30.toISOString().slice(0, 10);
  const iso90 = d90.toISOString().slice(0, 10);

  const apptById = new Map(
    (store.appointments || []).map((a) => [a.id, a] as const)
  );

  return patients.map((p) => {
    const bookings = (store.bookings || []).filter((b) => b.patient_id === p.id);
    let attended30 = 0;
    let attended90 = 0;
    let noShows90 = 0;
    let lastAttended: string | null = null;

    for (const b of bookings) {
      const appt = b.appointment_id ? apptById.get(b.appointment_id) : null;
      const date = appt?.date || (b.booked_at || '').slice(0, 10);
      if (!date) continue;
      if (b.status === 'attended' || b.status === 'completed') {
        if (date >= iso90) attended90 += 1;
        if (date >= iso30) attended30 += 1;
        if (!lastAttended || date > lastAttended) lastAttended = date;
      }
      if (b.status === 'no_show' && date >= iso90) noShows90 += 1;
    }

    if (bookings.length === 0) {
      for (const a of store.appointments || []) {
        if (a.patient_id !== p.id) continue;
        if (a.status === 'completed' || a.status === 'attended') {
          if (a.date >= iso90) attended90 += 1;
          if (a.date >= iso30) attended30 += 1;
          if (!lastAttended || a.date > lastAttended) lastAttended = a.date;
        }
        if (a.status === 'no_show' && a.date >= iso90) noShows90 += 1;
      }
    }

    return {
      person_id: p.id,
      person_name: p.name,
      clinician_id:
        p.primary_clinician_id || p.dentist_id || p.physio_id || null,
      last_attended_at: lastAttended,
      attended_30d: attended30,
      attended_90d: attended90,
      no_shows_90d: noShows90,
      soft_blocked: p.booking_soft_block === true,
      recall_after_days: store.recall_after_days ?? 45,
    };
  });
}

export function scopesAllowedForPatient(
  grants: PatientRecordShareGrant[],
  personId: string
): ClinicalShareScope[] {
  const active = grants.filter(
    (g) =>
      g.person_id === personId &&
      g.status === 'active' &&
      g.to.type === 'patient'
  );
  if (active.length === 0) return [...PATIENT_PORTAL_DEFAULT_SCOPES];
  const set = new Set<ClinicalShareScope>();
  for (const g of active) for (const s of g.scopes) set.add(s);
  return [...set];
}

export function scopesAllowedForProfessional(
  grants: PatientRecordShareGrant[],
  personId: string,
  toCompanyId: number
): ClinicalShareScope[] {
  const active = grants.filter(
    (g) =>
      g.person_id === personId &&
      g.status === 'active' &&
      g.to.type === 'professional' &&
      g.to.company_id === toCompanyId
  );
  const set = new Set<ClinicalShareScope>();
  for (const g of active) for (const s of g.scopes) set.add(s);
  return [...set];
}

export function newShareGrantId() {
  return `prg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
