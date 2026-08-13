/**
 * Safe patient-facing medical summary for portals and SA Member.
 * Full charts stay on the practice; this is allergies, aid, scripts, notes.
 */

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
  const summary: Record<string, unknown> = {};
  if (clinical?.injury_status) summary.injury_status = clinical.injury_status;
  if (clinical?.injury_areas && Array.isArray(clinical.injury_areas) && clinical.injury_areas.length) {
    summary.injury_areas = clinical.injury_areas;
  }
  if (clinical?.injury_notes) summary.injury_notes = clinical.injury_notes;
  if (clinical?.diagnosis_notes || patient.diagnosis_notes) {
    summary.diagnosis_notes =
      clinical?.diagnosis_notes || patient.diagnosis_notes;
  }
  if (clinical?.training_modifications) {
    summary.care_notes = clinical.training_modifications;
  }
  if (clinical?.goals) summary.goals = clinical.goals;
  if (clinical?.pain_score != null) summary.pain_score = clinical.pain_score;
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
