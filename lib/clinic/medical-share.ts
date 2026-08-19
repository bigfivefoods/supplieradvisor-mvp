/**
 * Safe patient-facing medical summary for portals and SA Member.
 * Full charts stay on the practice; this is allergies, aid, scripts, notes.
 */
import {
  shareFlagOn,
  type ClinicalShareFlags,
  type PatientCondition,
} from '@/lib/health/ailments';

export type SharedAdviceNote = {
  id: string;
  at: string;
  body: string;
  plan?: string | null;
  author_name?: string | null;
};

export type SharedTreatmentPlan = {
  id: string;
  title: string;
  status?: string;
  goals?: string;
  next_step?: {
    title?: string;
    status?: string;
    notes?: string;
  } | null;
  steps?: Array<{
    id?: string;
    title: string;
    status?: string;
    notes?: string;
    sessions_planned?: number;
    sessions_done?: number;
  }>;
};

export function buildPatientMedicalShare(patient: {
  share_medical?: boolean;
  diagnosis_notes?: string | null;
  clinical?: {
    injury_status?: string | null;
    injury_areas?: unknown;
    injury_notes?: string | null;
    diagnosis_notes?: string | null;
    training_modifications?: string | null;
    goals?: string | null;
    pain_score?: number | null;
    progress_notes?: string | null;
    treatment_goals?: string | null;
    functional_limitations?: string | null;
    contraindications?: string | null;
    conditions?: PatientCondition[];
    share?: ClinicalShareFlags;
  } | null;
  medical?: {
    allergies?: string | null;
    chronic_conditions?: string | null;
    current_meds?: string | null;
    medical_aid?: {
      scheme_name?: string | null;
      plan_name?: string | null;
      membership_number?: string | null;
    } | null;
    scripts?: Array<{
      status?: string | null;
      medication?: string | null;
      strength?: string | null;
      dose?: string | null;
      frequency?: string | null;
      instructions?: string | null;
    }> | null;
  } | null;
}): Record<string, unknown> | null {
  if (patient.share_medical === false) return null;
  const clinical = patient.clinical;
  const medical = patient.medical;
  const flags = clinical?.share;
  const explicit = Boolean(flags && Object.keys(flags).length);
  const allow = (key: Parameters<typeof shareFlagOn>[1]) =>
    shareFlagOn(flags, key, explicit);
  const summary: Record<string, unknown> = {};
  if (allow('conditions') && clinical?.conditions?.length) {
    const shared = clinical.conditions.filter((c) => c.share !== false);
    if (shared.length) {
      summary.conditions = shared.map((c) => ({
        label: c.label,
        status: c.status,
        notes: c.notes || undefined,
        onset: c.onset || undefined,
      }));
    }
  }
  if (clinical?.injury_status) summary.injury_status = clinical.injury_status;
  if (
    allow('injury_areas') &&
    clinical?.injury_areas &&
    Array.isArray(clinical.injury_areas) &&
    clinical.injury_areas.length
  ) {
    summary.injury_areas = clinical.injury_areas;
  }
  if (allow('injury_notes') && clinical?.injury_notes) {
    summary.injury_notes = clinical.injury_notes;
  }
  if (
    allow('diagnosis_notes') &&
    (clinical?.diagnosis_notes || patient.diagnosis_notes)
  ) {
    summary.diagnosis_notes =
      clinical?.diagnosis_notes || patient.diagnosis_notes;
  }
  if (allow('training_modifications') && clinical?.training_modifications) {
    summary.care_notes = clinical.training_modifications;
  }
  if (allow('goals') && clinical?.goals) summary.goals = clinical.goals;
  if (allow('treatment_goals') && clinical?.treatment_goals) {
    summary.treatment_goals = clinical.treatment_goals;
  }
  if (allow('progress_notes') && clinical?.progress_notes) {
    summary.progress_notes = clinical.progress_notes;
  }
  if (allow('functional_limitations') && clinical?.functional_limitations) {
    summary.functional_limitations = clinical.functional_limitations;
  }
  if (allow('contraindications') && clinical?.contraindications) {
    summary.contraindications = clinical.contraindications;
  }
  if (allow('pain_score') && clinical?.pain_score != null) {
    summary.pain_score = clinical.pain_score;
  }
  if (medical?.allergies) summary.allergies = medical.allergies;
  if (medical?.chronic_conditions) {
    summary.chronic_conditions = medical.chronic_conditions;
  }
  if (medical?.current_meds) summary.current_meds = medical.current_meds;
  if (medical?.medical_aid?.scheme_name) {
    summary.medical_aid = {
      scheme_name: medical.medical_aid.scheme_name,
      plan_name: medical.medical_aid.plan_name,
      membership_number: medical.medical_aid.membership_number
        ? `••••${String(medical.medical_aid.membership_number).slice(-4)}`
        : undefined,
    };
  }
  const activeScripts = (medical?.scripts || []).filter(
    (s) => String(s.status || 'active').toLowerCase() === 'active'
  );
  if (activeScripts.length) {
    summary.active_scripts = activeScripts.map((s) =>
      [s.medication, s.strength, s.dose, s.frequency, s.instructions]
        .filter(Boolean)
        .join(' · ')
    );
  }
  return Object.keys(summary).length ? summary : null;
}

/** Non-private visit notes the patient may see as advice. */
export function buildSharedAdvice(
  notes:
    | Array<{
        id: string;
        person_id: string;
        body?: string | null;
        private?: boolean;
        created_at?: string;
        author_name?: string | null;
        soap?: { plan?: string | null } | null;
      }>
    | undefined,
  personId: string
): SharedAdviceNote[] {
  return (notes || [])
    .filter((n) => n.person_id === personId && n.private !== true)
    .sort((a, b) =>
      String(b.created_at || '').localeCompare(String(a.created_at || ''))
    )
    .slice(0, 8)
    .map((n) => ({
      id: n.id,
      at: n.created_at || '',
      body: String(n.body || '').trim(),
      plan: n.soap?.plan || null,
      author_name: n.author_name || null,
    }))
    .filter((n) => n.body || n.plan);
}
