/**
 * Shared GymAdvisor + PhysioAdvisor exercise catalogue (2,520 source rows,
 * unique by name). System items are merged at read time — not copied into
 * company metadata — so gyms/clinics only store overrides and custom moves.
 */
import raw from './exercise-catalog.json';
import { resolveMovementPose } from '@/lib/fitness/movement-art';

export type ExerciseScoring =
  | 'Strength'
  | 'Bodyweight'
  | 'Timed'
  | 'Distance (Short)'
  | 'Distance (Long)'
  | string;

export type ExerciseCatalogRow = {
  code: string;
  name: string;
  modality: string;
  muscle_group: string;
  movement_pattern: string;
  category: ExerciseScoring;
};

export const EXERCISE_MODALITIES = [
  'Strength',
  'Power',
  'Mobility',
  'Conditioning',
  'Activation',
  'Agility',
  'Cardio',
  'Myofascial Release',
  'Yoga',
] as const;

export const EXERCISE_MUSCLE_GROUPS = [
  'Quads',
  'Core',
  'Shoulders',
  'Glutes',
  'Chest',
  'Mid Back',
  'Hamstrings',
  'Triceps',
  'Lower Leg',
  'Biceps',
  'Hip & Groin',
  'Upper Back & Neck',
  'Forearms',
  'Lower Back',
] as const;

export const EXERCISE_PATTERNS = [
  'Lower Body Push',
  'Lower Body Hinge',
  'Upper Body Horizontal Push',
  'Upper Body Vertical Push',
  'Upper Body Horizontal Pull',
  'Upper Body Vertical Pull',
  'Core Bracing',
  'Core Flexion / Extension',
  'Core Rotation',
  'Locomotion',
  'Carry / Gait',
] as const;

export const EXERCISE_SCORING = [
  'Strength',
  'Bodyweight',
  'Timed',
  'Distance (Short)',
  'Distance (Long)',
] as const;

export const EXERCISE_CATALOG: ExerciseCatalogRow[] =
  raw as ExerciseCatalogRow[];

export function exerciseCodeToId(code: string): string {
  return `mov_ex_${String(code || '')
    .replace(/^EX_/, '')
    .toLowerCase()}`;
}

export function isExerciseCatalogCode(code?: string | null): boolean {
  return String(code || '').startsWith('EX_');
}

export function patternSlug(pattern?: string | null): string {
  const p = String(pattern || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return p || 'generic';
}

/** Default 5-second clip for a movement pattern (replaceable per movement). */
export function defaultExerciseVideoSrc(pattern?: string | null): string {
  return `/videos/movements/${patternSlug(pattern)}.mp4`;
}

export function defaultExerciseImageSrc(name: string, pattern?: string | null): string {
  const family = familyFromPattern(pattern);
  const pose = resolveMovementPose(name, family);
  return `/images/movements/${pose}.jpg`;
}

export function familyFromPattern(pattern?: string | null): string {
  const p = String(pattern || '').toLowerCase();
  if (p.includes('hinge')) return 'Hinge';
  if (p.includes('lunge') || (p.includes('lower body push') && /lunge/i.test(p)))
    return 'Lunge';
  if (p.includes('lower body push')) return 'Squat';
  if (p.includes('horizontal push')) return 'Push';
  if (p.includes('vertical push')) return 'Push';
  if (p.includes('horizontal pull') || p.includes('vertical pull')) return 'Pull';
  if (p.includes('carry')) return 'Carry';
  if (p.includes('core')) return 'Core';
  if (p.includes('locomotion')) return 'Conditioning';
  return 'Other';
}

export function inferEquipment(name: string, scoring?: string | null): string {
  const n = name.toLowerCase();
  if (/\bbarbell\b|\bbb\b/.test(n)) return 'Barbell';
  if (/\bdumbbell\b|\bdb\b/.test(n)) return 'Dumbbell';
  if (/\bkettlebell\b|\bkb\b/.test(n)) return 'Kettlebell';
  if (/\bcable\b/.test(n)) return 'Cable';
  if (/\bband(ed)?\b/.test(n)) return 'Band';
  if (/\bmachine\b|\bsmith\b/.test(n)) return 'Machine';
  if (/\btrx\b/.test(n)) return 'TRX';
  if (/\bmedicine ball\b|\bmed ball\b|\bslam ball\b/.test(n)) return 'Medicine ball';
  if (/\bbattle rope\b/.test(n)) return 'Battle rope';
  if (/\bbox\b/.test(n)) return 'Box';
  if (/\broad\b|\bsled\b|\bprowler\b/.test(n)) return 'Sled';
  if (/\bfoam\b|\broller\b/.test(n)) return 'Foam roller';
  if (String(scoring || '').startsWith('Distance')) return 'None';
  if (String(scoring || '') === 'Bodyweight' || String(scoring || '') === 'Timed')
    return 'None';
  return 'As named';
}

export function inferLevel(modality: string): 'beginner' | 'intermediate' | 'advanced' {
  const m = String(modality || '').toLowerCase();
  if (m === 'power' || m === 'agility') return 'intermediate';
  if (m === 'yoga' || m === 'activation' || m === 'mobility') return 'beginner';
  return 'beginner';
}

export function catalogOverview(row: ExerciseCatalogRow): string {
  const muscle = row.muscle_group || 'full body';
  const pattern = row.movement_pattern
    ? ` (${row.movement_pattern.toLowerCase()})`
    : '';
  return `${row.name} — ${row.modality.toLowerCase()} for the ${muscle.toLowerCase()}${pattern}.`;
}

export function catalogDetails(row: ExerciseCatalogRow): string {
  const bits = [
    row.movement_pattern && `Pattern: ${row.movement_pattern}.`,
    row.muscle_group && `Target: ${row.muscle_group}.`,
    `Load: ${row.category}.`,
    'Move through a controlled, pain-free range. Replace the photo and 5-second clip when you have your own.',
  ].filter(Boolean);
  return bits.join(' ');
}

export type ListedExercise = {
  id: string;
  code: string;
  name: string;
  modality: string;
  muscle_group: string;
  movement_pattern: string;
  category: string;
  scoring: string;
  equipment: string;
  muscles: string;
  level: 'beginner' | 'intermediate' | 'advanced' | string;
  overview: string;
  details: string;
  image_url: string | null;
  video_url: string | null;
  system: true;
  active: true;
};

export function listedExerciseFromRow(row: ExerciseCatalogRow): ListedExercise {
  return {
    id: exerciseCodeToId(row.code),
    code: row.code,
    name: row.name,
    modality: row.modality,
    muscle_group: row.muscle_group,
    movement_pattern: row.movement_pattern,
    category: familyFromPattern(row.movement_pattern) || row.category,
    scoring: row.category,
    equipment: inferEquipment(row.name, row.category),
    muscles: row.muscle_group || '',
    level: inferLevel(row.modality),
    overview: catalogOverview(row),
    details: catalogDetails(row),
    image_url: defaultExerciseImageSrc(row.name, row.movement_pattern),
    video_url: defaultExerciseVideoSrc(row.movement_pattern),
    system: true,
    active: true,
  };
}

export function mergeCatalogWithOverrides<
  T extends {
    id?: string;
    code?: string | null;
    name?: string;
    image_url?: string | null;
    video_url?: string | null;
    overview?: string;
    details?: string;
    description?: string;
    active?: boolean;
    system?: boolean;
  },
>(
  overrides: T[] | null | undefined,
  extrasMap: (row: ListedExercise, override: T | undefined) => T
): T[] {
  const list = Array.isArray(overrides) ? overrides : [];
  const byCode = new Map<string, T>();
  const byName = new Map<string, T>();
  const byId = new Map<string, T>();
  for (const m of list) {
    if (m.code) byCode.set(String(m.code), m);
    if (m.id) byId.set(String(m.id), m);
    if (m.name) byName.set(String(m.name).toLowerCase(), m);
  }
  const used = new Set<T>();
  const out: T[] = [];
  for (const row of EXERCISE_CATALOG) {
    const id = exerciseCodeToId(row.code);
    const hit =
      byCode.get(row.code) || byId.get(id) || byName.get(row.name.toLowerCase());
    if (hit) used.add(hit);
    out.push(extrasMap(listedExerciseFromRow(row), hit));
  }
  for (const m of list) {
    if (!used.has(m)) out.push(m);
  }
  return out;
}
