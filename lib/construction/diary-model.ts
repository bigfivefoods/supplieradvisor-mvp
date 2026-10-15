/**
 * Site diary. One entry per project per date. A signed-off day is append-only.
 */
import type { ConstructiongraphStore, DiaryEntry } from './constructiongraph';
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

function lockSignature(entry: DiaryEntry): string {
  const { addenda: _addenda, ...rest } = entry;
  return JSON.stringify(rest);
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
    const saved: DiaryEntry = { ...row, date };
    if (existing?.signed_off_at) {
      if (lockSignature(existing) !== lockSignature({ ...saved, signed_off_at: existing.signed_off_at, signed_off_by: existing.signed_off_by })) {
        return { ok: false, error: 'This day is signed off. Add an addendum.' };
      }
      const prevCount = existing.addenda?.length || 0;
      const nextCount = saved.addenda?.length || 0;
      if (nextCount < prevCount) return { ok: false, error: 'This day is signed off. Add an addendum.' };
      saved.signed_off_at = existing.signed_off_at;
      saved.signed_off_by = existing.signed_off_by;
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
