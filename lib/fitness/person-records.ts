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

export type FitResultLog = {
  id: string;
  kind: 'goal' | 'pb' | 'board' | 'challenge' | 'watch';
  title: string;
  value: string;
  numeric?: number | null;
  unit?: string | null;
  at: string;
  source_id?: string | null;
  notes?: string;
};

export type FitPersonalBestLog = {
  id: string;
  value: string;
  unit?: string;
  at: string;
  notes?: string;
};

export type FitPersonalBest = {
  id: string;
  title: string;
  value: string;
  unit?: string;
  achieved_on?: string | null;
  notes?: string;
  updated_at: string;
  /** Every logged result for this lift/test — used for trends. */
  history?: FitPersonalBestLog[];
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

function pbKey(title: string, unit?: string | null) {
  return `${String(title || '').trim().toLowerCase()}|${String(unit || '').trim().toLowerCase()}`;
}

export function parsePbHistory(raw: unknown): FitPersonalBestLog[] {
  if (!Array.isArray(raw)) return [];
  const out: FitPersonalBestLog[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const value = String(r.value || '').trim();
    if (!value) continue;
    const id = String(r.id || '').trim() || recId('pbl');
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      value,
      unit: String(r.unit || '').trim() || undefined,
      at: String(r.at || r.achieved_on || r.updated_at || ''),
      notes: String(r.notes || '').trim() || undefined,
    });
  }
  return out.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

function withCurrentInHistory(row: FitPersonalBest): FitPersonalBestLog[] {
  const history = parsePbHistory(row.history);
  const at =
    row.achieved_on && /^\d{4}-\d{2}-\d{2}$/.test(row.achieved_on)
      ? `${row.achieved_on}T12:00:00.000Z`
      : row.updated_at;
  const last = history[history.length - 1];
  if (last && last.value === row.value) return history;
  history.push({
    id: recId('pbl'),
    value: row.value,
    unit: row.unit,
    at,
    notes: row.notes,
  });
  return history;
}

export function parsePersonalBests(raw: unknown): FitPersonalBest[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, FitPersonalBest>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const title = String(r.title || r.movement || r.name || '').trim();
    const value = String(r.value || '').trim();
    if (!title || !value) continue;
    const parsed: FitPersonalBest = {
      id: String(r.id || '').trim() || recId('pb'),
      title,
      value,
      unit: String(r.unit || '').trim() || undefined,
      achieved_on: asIsoDate(r.achieved_on || r.date),
      notes: String(r.notes || '').trim() || undefined,
      updated_at: String(r.updated_at || new Date().toISOString()),
      history: parsePbHistory(r.history),
    };
    parsed.history = withCurrentInHistory(parsed);
    const key = pbKey(parsed.title, parsed.unit);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, parsed);
      continue;
    }
    const newer =
      String(parsed.updated_at) >= String(prev.updated_at) ? parsed : prev;
    const older = newer === parsed ? prev : parsed;
    const histMap = new Map<string, FitPersonalBestLog>();
    for (const h of [...(older.history || []), ...(newer.history || [])]) {
      histMap.set(h.id, h);
    }
    newer.history = [...histMap.values()].sort((a, b) =>
      String(a.at).localeCompare(String(b.at))
    );
    byKey.set(key, newer);
  }
  return [...byKey.values()].sort((a, b) =>
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
  const unit = String(patch.unit || '').trim() || undefined;
  const prev = parsePersonalBests(list);
  const id = String(patch.id || '').trim();
  let idx = id ? prev.findIndex((x) => x.id === id) : -1;
  if (idx < 0) idx = prev.findIndex((x) => pbKey(x.title, x.unit) === pbKey(title, unit));
  const logAt = asIsoDate(patch.achieved_on)
    ? `${asIsoDate(patch.achieved_on)}T12:00:00.000Z`
    : now;
  const log: FitPersonalBestLog = {
    id: recId('pbl'),
    value,
    unit,
    at: logAt,
    notes: String(patch.notes || '').trim() || undefined,
  };
  if (idx < 0) {
    const row: FitPersonalBest = {
      id: id || recId('pb'),
      title,
      value,
      unit,
      achieved_on: asIsoDate(patch.achieved_on),
      notes: String(patch.notes || '').trim() || undefined,
      updated_at: now,
      history: [log],
    };
    return { list: parsePersonalBests([row, ...prev]), row };
  }
  const existing = prev[idx];
  const history = parsePbHistory(existing.history);
  const last = history[history.length - 1];
  if (
    !last ||
    last.value !== value ||
    Math.abs(Date.parse(last.at || '') - Date.parse(log.at)) > 1500
  ) {
    history.push(log);
  }
  const row: FitPersonalBest = {
    ...existing,
    title,
    value,
    unit,
    achieved_on: asIsoDate(patch.achieved_on) || existing.achieved_on,
    notes: String(patch.notes || '').trim() || existing.notes,
    updated_at: now,
    history,
  };
  const next = [...prev];
  next[idx] = row;
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

export function parseResultLogs(raw: unknown): FitResultLog[] {
  if (!Array.isArray(raw)) return [];
  const out: FitResultLog[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const title = String(r.title || '').trim();
    const value = String(r.value || '').trim();
    if (!title || !value) continue;
    const id = String(r.id || '').trim() || recId('rlog');
    if (seen.has(id)) continue;
    seen.add(id);
    const kindRaw = String(r.kind || 'pb');
    const kind: FitResultLog['kind'] =
      kindRaw === 'goal' ||
      kindRaw === 'board' ||
      kindRaw === 'challenge' ||
      kindRaw === 'watch'
        ? kindRaw
        : 'pb';
    const numeric =
      r.numeric == null || r.numeric === ''
        ? null
        : Number(r.numeric);
    out.push({
      id,
      kind,
      title,
      value,
      numeric: numeric != null && Number.isFinite(numeric) ? numeric : null,
      unit: r.unit != null ? String(r.unit) : null,
      at: String(r.at || r.updated_at || ''),
      source_id: r.source_id ? String(r.source_id) : null,
      notes: String(r.notes || '').trim() || undefined,
    });
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export function appendResultLog(
  person: { result_logs?: FitResultLog[] },
  entry: Omit<FitResultLog, 'id'> & { id?: string }
): FitResultLog {
  const log: FitResultLog = {
    id: entry.id || recId('rlog'),
    kind: entry.kind,
    title: entry.title,
    value: String(entry.value),
    numeric:
      entry.numeric != null && Number.isFinite(Number(entry.numeric))
        ? Number(entry.numeric)
        : null,
    unit: entry.unit ?? null,
    at: entry.at,
    source_id: entry.source_id ?? null,
    notes: entry.notes,
  };
  const list = parseResultLogs(person.result_logs);
  if (!list.some((x) => x.id === log.id)) list.unshift(log);
  person.result_logs = list.slice(0, 2000);
  return log;
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
    result_logs?: FitResultLog[];
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
    appendResultLog(person, {
      kind: 'pb',
      title: result.row.title,
      value: result.row.value,
      unit: result.row.unit || null,
      at: now,
      source_id: result.row.id,
      notes: result.row.notes,
    });
    person.updated_at = now;
    return { ok: true, message: 'Result saved' };
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
