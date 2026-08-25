/**
 * Personal bests and injury records on gym member / coach profiles.
 */
import {
  emptyHealthProfile,
  type PersonHealthProfile,
} from '@/lib/health/body-map';

function recId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export type FitPersonalBest = {
  id: string;
  title: string;
  value: string;
  unit?: string;
  achieved_on?: string | null;
  notes?: string;
  updated_at: string;
};

export type FitInjuryEntry = {
  id: string;
  area: string;
  side?: string;
  status?: string;
  onset?: string | null;
  notes?: string;
  modifications?: string;
  pain_score?: number | null;
  updated_at: string;
};

export const PB_TITLE_PRESETS = [
  'Back squat',
  'Front squat',
  'Deadlift',
  'Bench press',
  'Overhead press',
  'Pull-ups',
  '5 km',
  '10 km',
  'Row 500 m',
] as const;

export const PB_UNITS = ['kg', 'km', 'min', 'reps', 'm', 'sec'] as const;

function asIsoDate(raw: unknown): string | null {
  const s = String(raw || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function parsePersonalBests(raw: unknown): FitPersonalBest[] {
  if (!Array.isArray(raw)) return [];
  const out: FitPersonalBest[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const title = String(r.title || r.movement || r.name || '').trim();
    const value = String(r.value || '').trim();
    if (!title || !value) continue;
    out.push({
      id: String(r.id || '').trim() || recId('pb'),
      title,
      value,
      unit: String(r.unit || '').trim() || undefined,
      achieved_on: asIsoDate(r.achieved_on || r.date),
      notes: String(r.notes || '').trim() || undefined,
      updated_at: String(r.updated_at || new Date().toISOString()),
    });
  }
  return out.sort((a, b) =>
    String(b.achieved_on || b.updated_at).localeCompare(
      String(a.achieved_on || a.updated_at)
    )
  );
}

export function upsertPersonalBest(
  list: FitPersonalBest[] | undefined,
  patch: Record<string, unknown>,
  now = new Date().toISOString()
): { list: FitPersonalBest[]; row: FitPersonalBest; error?: string } {
  const title = String(patch.title || patch.movement || '').trim();
  const value = String(patch.value || '').trim();
  if (!title) return { list: list || [], row: list?.[0] as FitPersonalBest, error: 'Name the PB (e.g. Back squat)' };
  if (!value) return { list: list || [], row: list?.[0] as FitPersonalBest, error: 'Add the result' };
  const id = String(patch.id || '').trim() || recId('pb');
  const row: FitPersonalBest = {
    id,
    title,
    value,
    unit: String(patch.unit || '').trim() || undefined,
    achieved_on: asIsoDate(patch.achieved_on),
    notes: String(patch.notes || '').trim() || undefined,
    updated_at: now,
  };
  const prev = parsePersonalBests(list);
  const idx = prev.findIndex((x) => x.id === id);
  const next = [...prev];
  if (idx >= 0) next[idx] = row;
  else next.unshift(row);
  return { list: parsePersonalBests(next), row };
}

export function removePersonalBest(
  list: FitPersonalBest[] | undefined,
  id: string
): FitPersonalBest[] {
  return parsePersonalBests(list).filter((x) => x.id !== id);
}

export function parseInjuryEntries(raw: unknown): FitInjuryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: FitInjuryEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const area = String(r.area || r.region || '').trim();
    if (!area) continue;
    const pain =
      r.pain_score == null || r.pain_score === ''
        ? null
        : Number(r.pain_score);
    out.push({
      id: String(r.id || '').trim() || recId('inj'),
      area,
      side: String(r.side || '').trim() || undefined,
      status: String(r.status || '').trim() || undefined,
      onset: asIsoDate(r.onset),
      notes: String(r.notes || '').trim() || undefined,
      modifications: String(r.modifications || '').trim() || undefined,
      pain_score:
        pain != null && Number.isFinite(pain)
          ? Math.max(0, Math.min(10, pain))
          : null,
      updated_at: String(r.updated_at || new Date().toISOString()),
    });
  }
  return out.sort((a, b) =>
    String(b.onset || b.updated_at).localeCompare(String(a.onset || a.updated_at))
  );
}

export function upsertInjuryEntry(
  list: FitInjuryEntry[] | undefined,
  patch: Record<string, unknown>,
  now = new Date().toISOString()
): { list: FitInjuryEntry[]; row: FitInjuryEntry; error?: string } {
  const area = String(patch.area || patch.region || '').trim();
  if (!area) {
    return {
      list: list || [],
      row: list?.[0] as FitInjuryEntry,
      error: 'Pick the body area',
    };
  }
  const id = String(patch.id || '').trim() || recId('inj');
  const pain =
    patch.pain_score == null || patch.pain_score === ''
      ? null
      : Number(patch.pain_score);
  const row: FitInjuryEntry = {
    id,
    area,
    side: String(patch.side || '').trim() || undefined,
    status: String(patch.status || 'recovering').trim() || 'recovering',
    onset: asIsoDate(patch.onset),
    notes: String(patch.notes || '').trim() || undefined,
    modifications: String(patch.modifications || '').trim() || undefined,
    pain_score:
      pain != null && Number.isFinite(pain)
        ? Math.max(0, Math.min(10, pain))
        : null,
    updated_at: now,
  };
  const prev = parseInjuryEntries(list);
  const idx = prev.findIndex((x) => x.id === id);
  const next = [...prev];
  if (idx >= 0) next[idx] = row;
  else next.unshift(row);
  return { list: parseInjuryEntries(next), row };
}

export function removeInjuryEntry(
  list: FitInjuryEntry[] | undefined,
  id: string
): FitInjuryEntry[] {
  return parseInjuryEntries(list).filter((x) => x.id !== id);
}

const ACTIVE_STATUS = new Set(['acute', 'recovering', 'chronic']);

export function injuryIsActive(status?: string | null): boolean {
  return ACTIVE_STATUS.has(String(status || '').toLowerCase());
}

export function healthHasActiveInjury(
  h?: PersonHealthProfile | null
): boolean {
  if (!h) return false;
  const status = String(h.injury_status || '').toLowerCase();
  if (status === 'cleared' || status === 'none') return false;
  return (
    h.injured === true ||
    (h.injury_areas || []).length > 0 ||
    injuryIsActive(status)
  );
}

export function healthFromInjuries(
  entries: FitInjuryEntry[],
  prev?: PersonHealthProfile | null
): PersonHealthProfile {
  const next = { ...(prev || emptyHealthProfile()) };
  const active = entries.filter((e) => injuryIsActive(e.status));
  const source = active[0] || null;
  next.injured = active.length > 0;
  next.injury_areas = [
    ...new Set(active.map((e) => e.area).filter(Boolean)),
  ];
  next.injury_side = source?.side || 'n/a';
  next.injury_status = active.length
    ? source?.status || 'recovering'
    : entries.length
      ? 'cleared'
      : 'none';
  next.injury_onset = source?.onset || null;
  next.injury_notes = active
    .map((e) => [e.area, e.notes].filter(Boolean).join(': '))
    .filter(Boolean)
    .join('\n');
  next.training_modifications = active
    .map((e) => e.modifications)
    .filter(Boolean)
    .join(' · ');
  next.pain_score =
    active.find((e) => e.pain_score != null)?.pain_score ?? null;
  next.updated_at = new Date().toISOString();
  return next;
}

export function isPersonRecordAction(action: string) {
  return (
    action === 'upsert_personal_best' ||
    action === 'delete_personal_best' ||
    action === 'upsert_injury' ||
    action === 'delete_injury'
  );
}

export function applyPersonRecordAction(
  person: {
    personal_bests?: FitPersonalBest[];
    injuries?: FitInjuryEntry[];
    health?: PersonHealthProfile;
    updated_at?: string;
  },
  action: string,
  body: Record<string, unknown>,
  now = new Date().toISOString()
): { ok: true; message: string } | { ok: false; error: string } {
  if (action === 'upsert_personal_best') {
    const result = upsertPersonalBest(person.personal_bests, body, now);
    if (result.error) return { ok: false, error: result.error };
    person.personal_bests = result.list;
    person.updated_at = now;
    return { ok: true, message: 'PB saved' };
  }
  if (action === 'delete_personal_best') {
    const id = String(body.id || '').trim();
    if (!id) return { ok: false, error: 'id required' };
    person.personal_bests = removePersonalBest(person.personal_bests, id);
    person.updated_at = now;
    return { ok: true, message: 'PB removed' };
  }
  if (action === 'upsert_injury') {
    const result = upsertInjuryEntry(person.injuries, body, now);
    if (result.error) return { ok: false, error: result.error };
    person.injuries = result.list;
    person.health = healthFromInjuries(result.list, person.health);
    person.updated_at = now;
    return { ok: true, message: 'Injury saved' };
  }
  if (action === 'delete_injury') {
    const id = String(body.id || '').trim();
    if (!id) return { ok: false, error: 'id required' };
    person.injuries = removeInjuryEntry(person.injuries, id);
    person.health = healthFromInjuries(person.injuries, person.health);
    person.updated_at = now;
    return { ok: true, message: 'Injury removed' };
  }
  return { ok: false, error: 'Unknown action' };
}

export function injuriesForPerson(person: {
  injuries?: FitInjuryEntry[] | null;
  health?: PersonHealthProfile | null;
}): FitInjuryEntry[] {
  const listed = parseInjuryEntries(person.injuries);
  if (listed.length) return listed;
  const h = person.health;
  if (!h) return [];
  const areas = (h.injury_areas || []).filter(Boolean);
  if (
    !h.injured &&
    !areas.length &&
    (!h.injury_status || h.injury_status === 'none') &&
    !h.injury_notes
  ) {
    return [];
  }
  return [
    {
      id: 'inj_legacy',
      area: areas[0] || 'Other',
      side: h.injury_side || undefined,
      status: h.injury_status || (h.injured ? 'recovering' : 'none'),
      onset: h.injury_onset || null,
      notes: h.injury_notes || undefined,
      modifications: h.training_modifications || undefined,
      pain_score: h.pain_score ?? null,
      updated_at: h.updated_at || new Date().toISOString(),
    },
  ];
}
