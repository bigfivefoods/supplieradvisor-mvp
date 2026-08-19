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
      kind?: string | null;
      medication?: string | null;
      strength?: string | null;
      dose?: string | null;
      frequency?: string | null;
      duration?: string | null;
      instructions?: string | null;
    }> | null;
  } | null;
  client_notes?: Array<{
    id: string;
    body: string;
    created_at?: string;
    author_name?: string | null;
  }> | null;
  shared_movements?: Array<{
    id: string;
    movement_name: string;
    category?: string;
    overview?: string;
    details?: string;
    sets?: string | null;
    reps?: string | null;
    hold?: string | null;
    frequency?: string | null;
    notes?: string;
    status?: string;
    shared_at?: string;
  }> | null;
}): Record<string, unknown> | null {
  const shareChart = patient.share_medical !== false;
  const summary: Record<string, unknown> = {};
  const clinical = patient.clinical;
  const medical = patient.medical;
  const flags = clinical?.share;
  const explicit = Boolean(flags && Object.keys(flags).length);
  const allow = (key: Parameters<typeof shareFlagOn>[1]) =>
    shareFlagOn(flags, key, explicit);
  if (shareChart && allow('conditions') && clinical?.conditions?.length) {
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
  if (shareChart) {
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
  }
  const activeScripts = (medical?.scripts || []).filter(
    (s) => String(s.status || 'active').toLowerCase() === 'active'
  );
  if (activeScripts.length) {
    summary.active_scripts = activeScripts.map((s) => ({
      kind: s.kind || 'prescription',
      title: s.medication,
      line: [s.medication, s.strength, s.dose, s.frequency, s.duration]
        .filter(Boolean)
        .join(' · '),
      instructions: s.instructions || null,
    }));
  }
  const notes = (patient.client_notes || [])
    .map((n) => ({
      id: n.id,
      body: String(n.body || '').trim(),
      at: n.created_at || '',
      author_name: n.author_name || null,
    }))
    .filter((n) => n.body);
  if (notes.length) summary.client_notes = notes.slice(0, 12);
  const moves = (patient.shared_movements || []).filter(
    (m) => String(m.status || 'active').toLowerCase() === 'active'
  );
  if (moves.length) {
    summary.shared_movements = moves.slice(0, 24).map((m) => ({
      id: m.id,
      name: m.movement_name,
      category: m.category || null,
      overview: m.overview || null,
      details: m.details || null,
      sets: m.sets || null,
      reps: m.reps || null,
      hold: m.hold || null,
      frequency: m.frequency || null,
      notes: m.notes || null,
      shared_at: m.shared_at || null,
    }));
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
