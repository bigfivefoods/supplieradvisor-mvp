/**
 * Module-specific ailment catalogues and share flags.
 * Stored on patient.clinical and mirrored to the member portal / SA Member.
 */

export type AilmentModule =
  | 'physio'
  | 'medical'
  | 'dental'
  | 'psychiatry'
  | 'gym';

export type PatientConditionStatus = 'active' | 'monitoring' | 'resolved';

export type PatientCondition = {
  id: string;
  label: string;
  category?: string;
  status?: PatientConditionStatus;
  notes?: string;
  share?: boolean;
  onset?: string | null;
};

export const CLINICAL_SHARE_KEYS = [
  'conditions',
  'injury_areas',
  'injury_notes',
  'diagnosis_notes',
  'treatment_goals',
  'goals',
  'training_modifications',
  'functional_limitations',
  'contraindications',
  'progress_notes',
  'pain_score',
] as const;

export type ClinicalShareKey = (typeof CLINICAL_SHARE_KEYS)[number];
export type ClinicalShareFlags = Partial<Record<ClinicalShareKey, boolean>>;

export const CLINICAL_SHARE_LABELS: Record<ClinicalShareKey, string> = {
  conditions: 'Condition list',
  injury_areas: 'Body / site',
  injury_notes: 'What is going on',
  diagnosis_notes: 'Diagnosis / clinical notes',
  treatment_goals: 'Treatment goals',
  goals: 'Patient goals',
  training_modifications: 'Session / load rules',
  functional_limitations: 'Functional limits',
  contraindications: 'Avoid / cautions',
  progress_notes: 'Progress notes',
  pain_score: 'Pain score',
};

/** Safe defaults when the desk has not chosen yet (legacy records share all). */
export const DEFAULT_CLINICAL_SHARE: ClinicalShareFlags = {
  conditions: true,
  injury_areas: true,
  injury_notes: false,
  diagnosis_notes: false,
  treatment_goals: true,
  goals: true,
  training_modifications: true,
  functional_limitations: true,
  contraindications: true,
  progress_notes: false,
  pain_score: true,
};

export type AilmentCatalogItem = {
  label: string;
  category: string;
};

export const PHYSIO_AILMENTS: readonly AilmentCatalogItem[] = [
  { category: 'Soft tissue', label: 'Muscle strain / tear' },
  { category: 'Soft tissue', label: 'Ligament sprain' },
  { category: 'Soft tissue', label: 'Tendinopathy' },
  { category: 'Soft tissue', label: 'Bursitis' },
  { category: 'Soft tissue', label: 'Contusion / haematoma' },
  { category: 'Knee', label: 'ACL / PCL / MCL / LCL' },
  { category: 'Knee', label: 'Meniscus / cartilage' },
  { category: 'Knee', label: 'Patellofemoral pain' },
  { category: 'Knee', label: 'ITB syndrome' },
  { category: 'Shoulder', label: 'Rotator cuff' },
  { category: 'Shoulder', label: 'Impingement' },
  { category: 'Shoulder', label: 'Frozen shoulder' },
  { category: 'Shoulder', label: 'Labral / instability' },
  { category: 'Spine', label: 'Disc / sciatica' },
  { category: 'Spine', label: 'Mechanical back pain' },
  { category: 'Spine', label: 'Neck strain / whiplash' },
  { category: 'Spine', label: 'Sacroiliac / pelvis' },
  { category: 'Hip', label: 'Hip impingement / labrum' },
  { category: 'Hip', label: 'Greater trochanteric pain' },
  { category: 'Lower limb', label: 'Achilles tendinopathy' },
  { category: 'Lower limb', label: 'Plantar fasciitis' },
  { category: 'Lower limb', label: 'Ankle sprain' },
  { category: 'Lower limb', label: 'Shin splints' },
  { category: 'Upper limb', label: 'Tennis / golfer’s elbow' },
  { category: 'Upper limb', label: 'Carpal tunnel / nerve' },
  { category: 'Upper limb', label: 'Wrist / hand strain' },
  { category: 'Post-op / medical', label: 'Post-operative rehab' },
  { category: 'Post-op / medical', label: 'Joint replacement rehab' },
  { category: 'Post-op / medical', label: 'Fracture / post-fracture' },
  { category: 'Post-op / medical', label: 'Osteoarthritis' },
  { category: 'Neuro / other', label: 'Nerve entrapment' },
  { category: 'Neuro / other', label: 'Concussion / post-concussion' },
  { category: 'Neuro / other', label: 'Chronic / nociplastic pain' },
  { category: 'Neuro / other', label: 'Hypermobility' },
  { category: 'Neuro / other', label: 'Sports overload / overuse' },
  { category: 'Other', label: 'Other MSK / physical' },
];

export const MEDICAL_AILMENTS: readonly AilmentCatalogItem[] = [
  { category: 'Cardio-metabolic', label: 'Hypertension' },
  { category: 'Cardio-metabolic', label: 'Type 2 diabetes' },
  { category: 'Cardio-metabolic', label: 'Type 1 diabetes' },
  { category: 'Cardio-metabolic', label: 'Dyslipidaemia' },
  { category: 'Cardio-metabolic', label: 'Obesity / metabolic syndrome' },
  { category: 'Heart', label: 'Ischaemic heart disease / angina' },
  { category: 'Heart', label: 'Heart failure' },
  { category: 'Heart', label: 'AF / arrhythmia' },
  { category: 'Heart', label: 'Stroke / TIA (history)' },
  { category: 'Respiratory', label: 'Asthma' },
  { category: 'Respiratory', label: 'COPD' },
  { category: 'Respiratory', label: 'Allergic rhinitis' },
  { category: 'Respiratory', label: 'Sleep apnoea' },
  { category: 'Endocrine', label: 'Hypothyroidism' },
  { category: 'Endocrine', label: 'Hyperthyroidism' },
  { category: 'GI / renal', label: 'GORD / ulcer' },
  { category: 'GI / renal', label: 'IBD' },
  { category: 'GI / renal', label: 'CKD' },
  { category: 'MSK / blood', label: 'Gout' },
  { category: 'MSK / blood', label: 'Osteoporosis' },
  { category: 'MSK / blood', label: 'Anaemia' },
  { category: 'Neuro', label: 'Migraine' },
  { category: 'Neuro', label: 'Epilepsy' },
  { category: 'Infection / other', label: 'HIV' },
  { category: 'Infection / other', label: 'TB (current / history)' },
  { category: 'Infection / other', label: 'Cancer (active / history)' },
  { category: 'Infection / other', label: 'Autoimmune disease' },
  { category: 'Women’s / family', label: 'Pregnancy / postpartum' },
  { category: 'Other', label: 'Other medical condition' },
];

export const DENTAL_AILMENTS: readonly AilmentCatalogItem[] = [
  { category: 'Teeth', label: 'Dental caries' },
  { category: 'Teeth', label: 'Pulpitis / abscess' },
  { category: 'Teeth', label: 'Cracked / fractured tooth' },
  { category: 'Teeth', label: 'Tooth wear / erosion' },
  { category: 'Teeth', label: 'Sensitivity' },
  { category: 'Gums', label: 'Gingivitis' },
  { category: 'Gums', label: 'Periodontitis' },
  { category: 'Gums', label: 'Pericoronitis' },
  { category: 'Surgical', label: 'Impacted wisdom tooth' },
  { category: 'Surgical', label: 'Missing teeth / edentulous' },
  { category: 'Surgical', label: 'Implant care' },
  { category: 'Surgical', label: 'Trauma / avulsion' },
  { category: 'Restorative', label: 'Crown / bridge in situ' },
  { category: 'Restorative', label: 'Orthodontics' },
  { category: 'Jaw / habits', label: 'TMJ / TMD' },
  { category: 'Jaw / habits', label: 'Bruxism' },
  { category: 'Soft tissue', label: 'Dry mouth' },
  { category: 'Soft tissue', label: 'Oral ulcer / lesion' },
  { category: 'Soft tissue', label: 'Halitosis' },
  { category: 'Other', label: 'Other dental' },
];

export const PSYCHIATRY_AILMENTS: readonly AilmentCatalogItem[] = [
  { category: 'Mood', label: 'Major depressive disorder' },
  { category: 'Mood', label: 'Bipolar disorder' },
  { category: 'Mood', label: 'Grief / adjustment' },
  { category: 'Anxiety', label: 'Generalised anxiety' },
  { category: 'Anxiety', label: 'Panic disorder' },
  { category: 'Anxiety', label: 'Social anxiety' },
  { category: 'Anxiety', label: 'OCD' },
  { category: 'Trauma / stress', label: 'PTSD' },
  { category: 'Trauma / stress', label: 'Burnout / occupational stress' },
  { category: 'Neurodev', label: 'ADHD' },
  { category: 'Neurodev', label: 'Autism / neurodiversity' },
  { category: 'Sleep / substance', label: 'Insomnia / sleep disorder' },
  { category: 'Sleep / substance', label: 'Substance use' },
  { category: 'Other', label: 'Eating disorder' },
  { category: 'Other', label: 'Psychosis / schizophrenia' },
  { category: 'Other', label: 'Personality disorder' },
  { category: 'Other', label: 'Dementia / cognitive' },
  { category: 'Other', label: 'Safety / risk monitoring' },
  { category: 'Other', label: 'Other mental health' },
];

export const GYM_AILMENTS: readonly AilmentCatalogItem[] = [
  ...PHYSIO_AILMENTS,
  { category: 'Medical flags', label: 'Asthma' },
  { category: 'Medical flags', label: 'Hypertension' },
  { category: 'Medical flags', label: 'Diabetes' },
  { category: 'Medical flags', label: 'Heart condition' },
  { category: 'Medical flags', label: 'Epilepsy' },
  { category: 'Medical flags', label: 'Pregnancy / postnatal' },
  { category: 'Medical flags', label: 'Allergy / anaphylaxis' },
  { category: 'Other', label: 'Other / see notes' },
];

export function ailmentsForModule(
  module: AilmentModule
): readonly AilmentCatalogItem[] {
  if (module === 'physio') return PHYSIO_AILMENTS;
  if (module === 'gym') return GYM_AILMENTS;
  if (module === 'medical') return MEDICAL_AILMENTS;
  if (module === 'dental') return DENTAL_AILMENTS;
  return PSYCHIATRY_AILMENTS;
}

export function ailmentDeskTitle(module: AilmentModule): string {
  if (module === 'physio') return 'Physical issues & rehab';
  if (module === 'gym') return 'Ailments & injuries';
  if (module === 'medical') return 'Medical conditions (GP)';
  if (module === 'dental') return 'Dental ailments';
  return 'Psychiatry & mental health';
}

export function ailmentDeskHint(module: AilmentModule): string {
  if (module === 'physio') {
    return 'MSK, post-op and load issues. Tick what to share on the member PWA and portal.';
  }
  if (module === 'gym') {
    return 'From the member PWA plus desk notes. Coaches see this on the floor — tick what the member may see.';
  }
  if (module === 'medical') {
    return 'GP and chronic conditions. Tick the notes the patient may see on their profile.';
  }
  if (module === 'dental') {
    return 'Oral and jaw issues for this episode of care. Choose what the member can see.';
  }
  return 'Mental-health issues and monitoring. Share only what is safe and useful for the member.';
}

export function newConditionId(): string {
  return `ail_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeConditions(raw: unknown): PatientCondition[] {
  if (!Array.isArray(raw)) return [];
  const out: PatientCondition[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const label = String(r.label || r.name || '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const status = String(r.status || 'active');
    out.push({
      id: String(r.id || newConditionId()),
      label,
      category: r.category != null ? String(r.category) : undefined,
      status:
        status === 'monitoring' || status === 'resolved' ? status : 'active',
      notes: r.notes != null ? String(r.notes) : undefined,
      share: r.share !== false,
      onset: r.onset ? String(r.onset).slice(0, 10) : null,
    });
  }
  return out;
}

export function normalizeShareFlags(raw: unknown): ClinicalShareFlags {
  const out: ClinicalShareFlags = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  for (const key of CLINICAL_SHARE_KEYS) {
    if (r[key] !== undefined) out[key] = r[key] === true;
  }
  return out;
}

export function shareFlagOn(
  flags: ClinicalShareFlags | undefined,
  key: ClinicalShareKey,
  hasExplicitFlags: boolean
): boolean {
  if (!hasExplicitFlags) return true;
  if (flags && flags[key] !== undefined) return flags[key] === true;
  return DEFAULT_CLINICAL_SHARE[key] === true;
}

export function groupedCatalog(module: AilmentModule) {
  const groups: Array<{ category: string; items: readonly AilmentCatalogItem[] }> =
    [];
  const map = new Map<string, AilmentCatalogItem[]>();
  for (const item of ailmentsForModule(module)) {
    const list = map.get(item.category) || [];
    list.push(item);
    map.set(item.category, list);
  }
  for (const [category, items] of map) {
    groups.push({ category, items });
  }
  return groups;
}
