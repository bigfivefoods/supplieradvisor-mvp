/**
 * Clinical / session stickiness: visit notes, outcome scores, treatment plans.
 * Stored on module metadata stores (not a full EMR).
 */

export type VisitNote = {
  id: string;
  person_id: string;
  booking_id?: string | null;
  appointment_id?: string | null;
  session_id?: string | null;
  author_id?: string | null;
  author_name?: string | null;
  /** free text clinical / session note */
  body: string;
  /** subjective / objective / assessment / plan snippets */
  soap?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  /** 0–10 pain or symptom score */
  pain_score?: number | null;
  /** 0–10 function / wellbeing */
  function_score?: number | null;
  private?: boolean;
  created_at: string;
  updated_at: string;
};

export type OutcomeScore = {
  id: string;
  person_id: string;
  instrument: string; // e.g. pain_nrs, psfs, gad7, attendance_feeling
  score: number;
  max_score?: number;
  notes?: string;
  booking_id?: string | null;
  recorded_at: string;
};

export type TreatmentPlanStep = {
  id: string;
  title: string;
  service_id?: string | null;
  sessions_planned?: number;
  sessions_done?: number;
  status: 'planned' | 'in_progress' | 'done' | 'skipped';
  notes?: string;
};

export type TreatmentPlan = {
  id: string;
  person_id: string;
  title: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  package_id?: string | null;
  steps: TreatmentPlanStep[];
  goals?: string;
  created_at: string;
  updated_at: string;
};

export function newVisitNote(opts: {
  person_id: string;
  body: string;
  booking_id?: string | null;
  appointment_id?: string | null;
  session_id?: string | null;
  author_id?: string | null;
  author_name?: string | null;
  soap?: VisitNote['soap'];
  pain_score?: number | null;
  function_score?: number | null;
  private?: boolean;
  now?: string;
}): VisitNote {
  const now = opts.now || new Date().toISOString();
  return {
    id: `vn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    person_id: opts.person_id,
    booking_id: opts.booking_id ?? null,
    appointment_id: opts.appointment_id ?? null,
    session_id: opts.session_id ?? null,
    author_id: opts.author_id ?? null,
    author_name: opts.author_name ?? null,
    body: opts.body,
    soap: opts.soap,
    pain_score: opts.pain_score ?? null,
    function_score: opts.function_score ?? null,
    private: opts.private !== false,
    created_at: now,
    updated_at: now,
  };
}

export function newOutcomeScore(opts: {
  person_id: string;
  instrument: string;
  score: number;
  max_score?: number;
  notes?: string;
  booking_id?: string | null;
  now?: string;
}): OutcomeScore {
  return {
    id: `out_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    person_id: opts.person_id,
    instrument: opts.instrument,
    score: Number(opts.score),
    max_score: opts.max_score ?? 10,
    notes: opts.notes,
    booking_id: opts.booking_id ?? null,
    recorded_at: opts.now || new Date().toISOString(),
  };
}

export function newTreatmentPlan(opts: {
  person_id: string;
  title: string;
  package_id?: string | null;
  goals?: string;
  steps?: Array<{ title: string; service_id?: string; sessions_planned?: number }>;
  now?: string;
}): TreatmentPlan {
  const now = opts.now || new Date().toISOString();
  return {
    id: `tp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    person_id: opts.person_id,
    title: opts.title || 'Care plan',
    status: 'active',
    package_id: opts.package_id ?? null,
    goals: opts.goals,
    steps: (opts.steps || []).map((s, i) => ({
      id: `tps_${i}_${Math.random().toString(36).slice(2, 6)}`,
      title: s.title,
      service_id: s.service_id || null,
      sessions_planned: s.sessions_planned || 1,
      sessions_done: 0,
      status: 'planned' as const,
    })),
    created_at: now,
    updated_at: now,
  };
}

/** Mark next planned step progressed when attendance recorded */
export function progressTreatmentPlanOnAttend(
  plan: TreatmentPlan,
  now = new Date().toISOString()
): TreatmentPlan {
  if (plan.status !== 'active') return plan;
  const steps = plan.steps.map((s) => ({ ...s }));
  const idx = steps.findIndex(
    (s) => s.status === 'planned' || s.status === 'in_progress'
  );
  if (idx < 0) {
    return { ...plan, status: 'completed', updated_at: now };
  }
  const step = steps[idx];
  const done = (step.sessions_done || 0) + 1;
  const planned = step.sessions_planned || 1;
  steps[idx] = {
    ...step,
    sessions_done: done,
    status: done >= planned ? 'done' : 'in_progress',
  };
  const allDone = steps.every((s) => s.status === 'done' || s.status === 'skipped');
  return {
    ...plan,
    steps,
    status: allDone ? 'completed' : 'active',
    updated_at: now,
  };
}

export function outcomeTrend(
  scores: OutcomeScore[],
  personId: string,
  instrument: string
): { latest: number | null; previous: number | null; delta: number | null } {
  const rows = scores
    .filter((s) => s.person_id === personId && s.instrument === instrument)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  const latest = rows[0]?.score ?? null;
  const previous = rows[1]?.score ?? null;
  return {
    latest,
    previous,
    delta:
      latest != null && previous != null
        ? Math.round((latest - previous) * 10) / 10
        : null,
  };
}
