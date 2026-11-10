/**
 * Site diary. One entry per project per date. A signed-off day is append-only.
 */
import type { ConstructiongraphStore, DiaryAddendum, DiaryEntry } from './constructiongraph';
import { sastToday } from './format';

export type { DiaryEntry };

const BANNED_KEY = /^(id_number|id_no|photo|image|picture|data_url|dataurl|attachment)$/i;

export function findBannedField(value: unknown): string | null {
  if (typeof value === 'string') {
    if (value.startsWith('data:image') || value.startsWith('data:application')) return 'data-url';
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findBannedField(item);
      if (hit) return hit;
    }
    return null;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (BANNED_KEY.test(key)) return key;
    const hit = findBannedField(child);
    if (hit) return hit;
  }
  return null;
}

function canon(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canon);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child === undefined) continue;
      out[key] = canon(child);
    }
    return out;
  }
  return value;
}

function stable(value: unknown): string {
  return JSON.stringify(canon(value));
}

function withoutAddenda(entry: DiaryEntry): Record<string, unknown> {
  const copy = { ...entry } as Record<string, unknown>;
  delete copy.addenda;
  return copy;
}

function asAddenda(value: unknown): DiaryAddendum[] {
  return Array.isArray(value) ? (value as DiaryAddendum[]) : [];
}

/** A dated, attributed note. Older rows may say `note` and `author_name`. */
export function readAddendum(value: unknown): DiaryAddendum | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const at = String(row.at || '').trim();
  const by = String(row.by || row.author_name || '').trim();
  const text = String(row.text || row.note || '').trim();
  if (!at || Number.isNaN(Date.parse(at))) return null;
  if (!by || !text || text.length > 2000) return null;
  return { at, by, text };
}

export function addendumText(value: unknown): string {
  return readAddendum(value)?.text || '';
}

export function addendumAuthor(value: unknown): string {
  return readAddendum(value)?.by || 'Unknown';
}

export function diaryActorName(value: string | null | undefined): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function withDiaryAddendum(
  entry: DiaryEntry,
  note: { at: string; by: string; text: string }
): DiaryEntry {
  return {
    ...entry,
    addenda: [...asAddenda(entry.addenda), { at: note.at, by: note.by, text: note.text }],
  };
}

/** Stamp only the newly appended notes. Earlier addenda keep their author. */
export function attributeNewAddenda(
  prev: DiaryEntry[] | undefined,
  incoming: DiaryEntry[],
  actorName: string
): DiaryEntry[] {
  const name = diaryActorName(actorName);
  if (!name) return incoming;
  const prior = Array.isArray(prev) ? prev : [];
  return incoming.map((row) => {
    const existing = prior.find((entry) => entry.id === row.id);
    if (!existing?.signed_off_at || !Array.isArray(row.addenda)) return row;
    const kept = existing.addenda?.length || 0;
    return {
      ...row,
      addenda: row.addenda.map((item, index) => {
        if (index < kept || !item || typeof item !== 'object') return item;
        return { ...item, by: name };
      }),
    };
  });
}

function overlayEntry(existing: DiaryEntry, row: DiaryEntry): DiaryEntry {
  const next: DiaryEntry = { ...existing };
  for (const [key, value] of Object.entries(row)) {
    if (value !== undefined) (next as Record<string, unknown>)[key] = value;
  }
  next.date = String(next.date || existing.date).slice(0, 10);
  return next;
}

function addendaMatch(left: unknown, right: unknown): boolean {
  const a = readAddendum(left);
  const b = readAddendum(right);
  if (a && b) return a.at === b.at && a.by === b.by && a.text === b.text;
  return stable(left) === stable(right);
}

const SIGNED = 'This day is signed off. Add an addendum.';

function lockedAddenda(
  existing: DiaryEntry,
  saved: DiaryEntry
): { ok: true; addenda: DiaryAddendum[] } | { ok: false; error: string } {
  const prev = asAddenda(existing.addenda);
  const next = asAddenda(saved.addenda);
  if (next.length < prev.length) return { ok: false, error: SIGNED };
  const kept: DiaryAddendum[] = [];
  for (let i = 0; i < prev.length; i += 1) {
    if (!addendaMatch(prev[i], next[i])) return { ok: false, error: SIGNED };
    kept.push(readAddendum(prev[i]) || (prev[i] as DiaryAddendum));
  }
  for (let i = prev.length; i < next.length; i += 1) {
    const row = next[i];
    const text = row && typeof row === 'object' ? String((row as { text?: unknown; note?: unknown }).text || (row as { note?: unknown }).note || '').trim() : '';
    if (text.length > 2000) return { ok: false, error: 'An addendum note is too long.' };
    const normalised = readAddendum(row);
    if (!normalised) return { ok: false, error: 'An addendum needs a date, a name, and a note.' };
    kept.push(normalised);
  }
  return { ok: true, addenda: kept };
}

export function reduceDiary(
  prev: DiaryEntry[] | undefined,
  incoming: DiaryEntry[]
): { ok: true; diary: DiaryEntry[] } | { ok: false; error: string } {
  const banned = findBannedField(incoming);
  if (banned) return { ok: false, error: 'Photos and identity numbers are not stored' };
  const prior = Array.isArray(prev) ? prev : [];
  const next = [...prior];
  for (const row of incoming) {
    if (!row || !row.id || !row.site_id || !row.date) {
      return { ok: false, error: 'A diary entry needs a project and a date' };
    }
    const date = String(row.date).slice(0, 10);
    const clash = next.find(
      (entry) => entry.site_id === row.site_id && entry.date.slice(0, 10) === date && entry.id !== row.id
    );
    if (clash) return { ok: false, error: 'One diary entry per project per date' };
    const index = next.findIndex((entry) => entry.id === row.id);
    const existing = index >= 0 ? next[index] : undefined;
    const saved: DiaryEntry = existing ? overlayEntry(existing, { ...row, date }) : { ...row, date };
    if (existing?.signed_off_at) {
      if (row.signed_off_at != null && row.signed_off_at !== existing.signed_off_at) {
        return { ok: false, error: SIGNED };
      }
      if (row.signed_off_by != null && row.signed_off_by !== existing.signed_off_by) {
        return { ok: false, error: SIGNED };
      }
      saved.signed_off_at = existing.signed_off_at;
      saved.signed_off_by = existing.signed_off_by;
      if (stable(withoutAddenda(existing)) !== stable(withoutAddenda(saved))) {
        return { ok: false, error: SIGNED };
      }
      const addenda = lockedAddenda(existing, saved);
      if (!addenda.ok) return addenda;
      saved.addenda = addenda.addenda;
    }
    if (index >= 0) next[index] = saved;
    else next.push(saved);
  }
  const seen = new Set<string>();
  for (const entry of next) {
    const key = `${entry.site_id}|${entry.date.slice(0, 10)}`;
    if (seen.has(key)) return { ok: false, error: 'One diary entry per project per date' };
    seen.add(key);
  }
  return { ok: true, diary: next };
}

export function missingDiarySiteIds(
  store: Pick<ConstructiongraphStore, 'sites' | 'diary'>,
  today = sastToday()
): string[] {
  const diary = store.diary || [];
  return store.sites
    .filter((site) => site.status === 'on_site')
    .filter((site) => !diary.some((entry) => entry.site_id === site.id && entry.date.slice(0, 10) === today))
    .map((site) => site.id);
}

export function labourTotal(entry: DiaryEntry): number {
  return (entry.labour || []).reduce((sum, row) => sum + (Number(row.count) || 0), 0);
}

export function plantHours(entry: DiaryEntry): number {
  return (entry.plant || []).reduce((sum, row) => sum + (Number(row.hours) || 0), 0);
}
