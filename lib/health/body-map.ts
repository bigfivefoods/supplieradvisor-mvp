/**
 * Shared body / injury vocabulary for GymAdvisor clients and PhysioAdvisor patients.
 * Coaches and practitioners use this so the floor knows what to adapt.
 */
import {
  normalizeConditions,
  normalizeShareFlags,
} from '@/lib/health/ailments';

export const BODY_REGIONS = [
  'Head / neck',
  'Shoulder',
  'Upper arm',
  'Elbow',
  'Wrist / hand',
  'Upper back',
  'Lower back',
  'Hip / pelvis',
  'Thigh',
  'Knee',
  'Shin / calf',
  'Ankle',
  'Foot',
  'Chest / ribs',
  'Core / abs',
  'Other',
] as const;

export type BodyRegion = (typeof BODY_REGIONS)[number] | string;

export const INJURY_SIDES = ['left', 'right', 'bilateral', 'n/a'] as const;
export type InjurySide = (typeof INJURY_SIDES)[number] | string;

export const INJURY_STATUSES = [
  'none',
  'acute',
  'recovering',
  'chronic',
  'cleared',
] as const;
export type InjuryStatus = (typeof INJURY_STATUSES)[number] | string;

/** Training / clinical awareness profile shared shape */
export type PersonHealthProfile = {
  /** Currently injured / managing an ailment */
  injured?: boolean;
  /** Body regions affected */
  injury_areas?: string[];
  injury_side?: InjurySide | null;
  injury_status?: InjuryStatus | null;
  /** When it started (YYYY-MM-DD) */
  injury_onset?: string | null;
  /** Free-text: what hurts, how it happened, symptoms */
  injury_notes?: string;
  /** What to avoid or modify in sessions (coach / physio cue) */
  training_modifications?: string;
  /** Recovery / performance goals */
  goals?: string;
  /** Medical clearance on file */
  medical_clearance?: boolean | null;
  /** Current pain 0–10 */
  pain_score?: number | null;
  /** Clinical / physio-only: diagnosis & plan */
  diagnosis_notes?: string;
  contraindications?: string;
  functional_limitations?: string;
  progress_notes?: string;
  treatment_goals?: string;
  /** Module-specific conditions (physio / medical / dental / psychiatry) */
  conditions?: import('@/lib/health/ailments').PatientCondition[];
  /** Which clinical notes the member may see */
  share?: import('@/lib/health/ailments').ClinicalShareFlags;
  updated_at?: string;
  /** e.g. coach:Priya · desk · prac:Johan */
  updated_by?: string;
};

export function emptyHealthProfile(): PersonHealthProfile {
  return {
    injured: false,
    injury_areas: [],
    injury_side: 'n/a',
    injury_status: 'none',
    injury_onset: null,
    injury_notes: '',
    training_modifications: '',
    goals: '',
    medical_clearance: null,
    pain_score: null,
  };
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    const t = String(x || '').trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, n));
}

/**
 * Merge a health patch into previous profile.
 * Accepts nested `{ health: {...} }` or flat injury_* fields on the patch.
 */
export function mergeHealthProfile(
  prev: PersonHealthProfile | undefined | null,
  patch: unknown,
  opts?: { now?: string; updatedBy?: string }
): PersonHealthProfile {
  const base: PersonHealthProfile = {
    ...emptyHealthProfile(),
    ...(prev && typeof prev === 'object' ? prev : {}),
  };
  if (patch == null || typeof patch !== 'object') {
    return base;
  }
  const raw = patch as Record<string, unknown>;
  const src =
    raw.health && typeof raw.health === 'object'
      ? { ...raw, ...(raw.health as Record<string, unknown>) }
      : raw;

  const next: PersonHealthProfile = { ...base };

  if (src.injured !== undefined) {
    next.injured = src.injured === true || src.injured === 'true' || src.injured === 1;
  }
  if (src.injury_areas !== undefined) {
    next.injury_areas = asStringArray(src.injury_areas);
  }
  if (src.injury_side !== undefined) {
    next.injury_side = src.injury_side ? String(src.injury_side) : 'n/a';
  }
  if (src.injury_status !== undefined) {
    next.injury_status = src.injury_status
      ? String(src.injury_status)
      : 'none';
  }
  if (src.injury_onset !== undefined) {
    next.injury_onset = src.injury_onset
      ? String(src.injury_onset).slice(0, 10)
      : null;
  }
  if (src.injury_notes !== undefined) {
    next.injury_notes = String(src.injury_notes ?? '');
  }
  if (src.training_modifications !== undefined) {
    next.training_modifications = String(src.training_modifications ?? '');
  }
  if (src.goals !== undefined) {
    next.goals = String(src.goals ?? '');
  }
  if (src.medical_clearance !== undefined) {
    if (src.medical_clearance === null || src.medical_clearance === '') {
      next.medical_clearance = null;
    } else {
      next.medical_clearance =
        src.medical_clearance === true ||
        src.medical_clearance === 'true' ||
        src.medical_clearance === 1;
    }
  }
  if (src.pain_score !== undefined) {
    next.pain_score = numOrNull(src.pain_score);
  }
  if (src.diagnosis_notes !== undefined) {
    next.diagnosis_notes = String(src.diagnosis_notes ?? '');
  }
  if (src.contraindications !== undefined) {
    next.contraindications = String(src.contraindications ?? '');
  }
  if (src.functional_limitations !== undefined) {
    next.functional_limitations = String(src.functional_limitations ?? '');
  }
  if (src.progress_notes !== undefined) {
    next.progress_notes = String(src.progress_notes ?? '');
  }
  if (src.treatment_goals !== undefined) {
    next.treatment_goals = String(src.treatment_goals ?? '');
  }
  if (src.conditions !== undefined) {
    next.conditions = normalizeConditions(src.conditions);
  }
  if (src.share !== undefined) {
    next.share = normalizeShareFlags(src.share);
  }

  // Auto-flag injured when areas or non-none status present
  if (
    next.injured !== true &&
    ((next.injury_areas && next.injury_areas.length > 0) ||
      (next.injury_status &&
        next.injury_status !== 'none' &&
        next.injury_status !== 'cleared'))
  ) {
    // keep explicit false if user cleared; only auto when status implies injury
    if (
      next.injury_status &&
      next.injury_status !== 'none' &&
      next.injury_status !== 'cleared'
    ) {
      next.injured = true;
    }
  }
  if (next.injury_status === 'cleared' || next.injury_status === 'none') {
    if (src.injured === undefined) {
      // don't force false if they still have notes; only when status cleared/none and no areas
      if (!next.injury_areas?.length) next.injured = false;
    }
  }

  next.updated_at = opts?.now || new Date().toISOString();
  if (opts?.updatedBy) next.updated_by = opts.updatedBy;
  else if (base.updated_by) next.updated_by = base.updated_by;

  return next;
}

/** Short label for tables / roster badges */
export function healthSummaryLabel(
  h?: PersonHealthProfile | null
): string {
  if (!h) return '—';
  const status = (h.injury_status || '').toLowerCase();
  if (
    !h.injured &&
    (!h.injury_areas || h.injury_areas.length === 0) &&
    !(h.conditions || []).some((c) => c.status !== 'resolved') &&
    (status === '' || status === 'none' || status === 'cleared')
  ) {
    return status === 'cleared' ? 'Cleared' : 'OK';
  }
  const cond = (h.conditions || [])
    .filter((c) => c.status !== 'resolved')
    .slice(0, 2)
    .map((c) => c.label);
  const areas =
    (h.injury_areas || []).slice(0, 2).join(', ') ||
    cond.join(', ') ||
    'Injury';
  const side =
    h.injury_side && h.injury_side !== 'n/a'
      ? ` (${String(h.injury_side).slice(0, 1).toUpperCase()})`
      : '';
  const st =
    h.injury_status && h.injury_status !== 'none'
      ? ` · ${h.injury_status}`
      : '';
  return `${areas}${side}${st}`;
}

export function isInjured(h?: PersonHealthProfile | null): boolean {
  if (!h) return false;
  if (h.injured === true) return true;
  const st = (h.injury_status || '').toLowerCase();
  if (st === 'acute' || st === 'recovering' || st === 'chronic') return true;
  if ((h.conditions || []).some((c) => c.status !== 'resolved')) return true;
  return Array.isArray(h.injury_areas) && h.injury_areas.length > 0 && st !== 'cleared';
}
