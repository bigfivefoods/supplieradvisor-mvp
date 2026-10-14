/**
 * Brief 110 — GymAdvisor saves send changed id-rows only.
 *
 * sa_module_store_merge_id_array already unions by id, keeps omitted rows, and
 * drops removed_ids / _deleted tombstones. The desk used to send the whole
 * array. This module diffs the request snapshot and builds that small patch.
 * No SQL changes.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { FitgraphStore } from '@/lib/fitness/fitgraph';

const REMOVED_CAP = 2000;

export type FitgraphDeltaPlan = {
  patch: Partial<FitgraphStore>;
  bytes: number;
  write: boolean;
  updatedAt: string;
};

type Snap =
  | { kind: 'id-array'; byId: Map<string, string> }
  | { kind: 'json'; json: string };

export type FitgraphBaseline = {
  updatedAt: string;
  removedIds: Record<string, string[]>;
  values: Map<string, Snap>;
};

type RemovedMap = Record<string, string[]>;

function stableStringify(value: unknown): string {
  if (value === undefined || value === null) return 'null';
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) {
    return `[${value
      .map((item) => (item === undefined ? 'null' : stableStringify(item)))
      .join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((key) => obj[key] !== undefined && typeof obj[key] !== 'function')
    .sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(',')}}`;
}

export function fitgraphRowId(row: unknown): string | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  if (!Object.prototype.hasOwnProperty.call(row, 'id')) return null;
  const id = (row as { id?: unknown }).id;
  if (id == null) return null;
  const text = String(id).trim();
  return text ? text : null;
}

/** Same flags as sa_module_store_is_tombstone. */
export function fitgraphRowIsTombstone(row: unknown): boolean {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  const record = row as Record<string, unknown>;
  if (record._deleted === true || record.deleted === true || record.is_deleted === true) {
    return true;
  }
  return record.deleted_at != null && String(record.deleted_at).trim() !== '';
}

function isIdArray(rows: unknown[]): boolean {
  if (!rows.length) return false;
  for (const row of rows) {
    if (!fitgraphRowId(row)) return false;
  }
  return true;
}

function snapValue(value: unknown): Snap {
  if (Array.isArray(value) && isIdArray(value)) {
    const byId = new Map<string, string>();
    for (const row of value) {
      const id = fitgraphRowId(row);
      if (id) byId.set(id, stableStringify(row));
    }
    return { kind: 'id-array', byId };
  }
  return { kind: 'json', json: stableStringify(value) };
}

function asRemovedMap(value: unknown): RemovedMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: RemovedMap = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(raw)) continue;
    const ids = raw.map((id) => String(id || '').trim()).filter(Boolean);
    if (ids.length) out[key] = ids;
  }
  return out;
}

export function snapshotFitgraphBaseline(store: FitgraphStore): FitgraphBaseline {
  const values = new Map<string, Snap>();
  for (const key of Object.keys(store) as Array<keyof FitgraphStore>) {
    if (key === 'updated_at' || key === 'removed_ids') continue;
    const value = store[key];
    if (value === undefined) continue;
    values.set(key, snapValue(value));
  }
  return {
    updatedAt: String(store.updated_at || ''),
    removedIds: asRemovedMap(store.removed_ids),
    values,
  };
}

function idDiff(
  baseById: Map<string, string>,
  rows: unknown[]
): { rows: unknown[]; removed: string[] } {
  const currentById = new Map<string, unknown>();
  for (const row of rows) {
    const id = fitgraphRowId(row);
    if (id) currentById.set(id, row);
  }
  const changed: unknown[] = [];
  const removed: string[] = [];
  for (const [id, row] of currentById) {
    if (baseById.get(id) === stableStringify(row)) continue;
    changed.push(row);
    if (fitgraphRowIsTombstone(row)) removed.push(id);
  }
  for (const id of baseById.keys()) {
    if (currentById.has(id)) continue;
    removed.push(id);
    changed.push({ id, _deleted: true });
  }
  return { rows: changed, removed };
}

type ArrayDiff =
  | { type: 'omit' }
  | { type: 'replace'; value: unknown }
  | { type: 'id'; rows: unknown[]; removed: string[] };

function diffArray(baseline: Snap | undefined, rows: unknown[]): ArrayDiff {
  const baseIsId = baseline?.kind === 'id-array';
  const baseEmpty =
    !baseline ||
    (baseline.kind === 'id-array' && baseline.byId.size === 0) ||
    (baseline.kind === 'json' && baseline.json === '[]');
  const currentIsId = isIdArray(rows);
  if ((baseIsId || baseEmpty) && (currentIsId || rows.length === 0)) {
    const byId = baseline?.kind === 'id-array' ? baseline.byId : new Map<string, string>();
    const diff = idDiff(byId, rows);
    if (!diff.rows.length && !diff.removed.length) return { type: 'omit' };
    return { type: 'id', rows: diff.rows, removed: diff.removed };
  }
  const json = stableStringify(rows);
  if (baseline?.kind === 'json' && baseline.json === json) return { type: 'omit' };
  return { type: 'replace', value: rows };
}

function mergeRemovedIds(existing: string[] | undefined, extra: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...extra, ...(existing || [])]) {
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= REMOVED_CAP) break;
  }
  return out;
}

/**
 * Shrink a keyed patch to changed id-rows. Objects and arrays without ids
 * stay whole. Disappeared ids are tombstoned and listed on removed_ids.
 */
export function prepareFitgraphDeltaWrite(
  baseline: FitgraphBaseline,
  patch: Partial<FitgraphStore>
): FitgraphDeltaPlan {
  const delta: Partial<FitgraphStore> = {};
  const removedExtra: RemovedMap = {};
  for (const key of Object.keys(patch) as Array<keyof FitgraphStore>) {
    if (key === 'updated_at' || key === 'removed_ids') continue;
    const value = patch[key];
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      const diff = diffArray(baseline.values.get(key), value);
      if (diff.type === 'omit') continue;
      if (diff.type === 'replace') {
        (delta as Record<string, unknown>)[key] = diff.value;
        continue;
      }
      (delta as Record<string, unknown>)[key] = diff.rows;
      if (diff.removed.length) removedExtra[key] = diff.removed;
      continue;
    }
    const json = stableStringify(value);
    const prev = baseline.values.get(key);
    if (prev?.kind === 'json' && prev.json === json) continue;
    (delta as Record<string, unknown>)[key] = value;
  }

  const patchRemoved = Object.prototype.hasOwnProperty.call(patch, 'removed_ids')
    ? asRemovedMap(patch.removed_ids)
    : baseline.removedIds;
  const removed: RemovedMap = {};
  const removedKeys = new Set([
    ...Object.keys(baseline.removedIds),
    ...Object.keys(patchRemoved),
    ...Object.keys(removedExtra),
  ]);
  for (const key of removedKeys) {
    const ids = mergeRemovedIds(patchRemoved[key] || baseline.removedIds[key], removedExtra[key] || []);
    if (ids.length) removed[key] = ids;
  }
  if (stableStringify(removed) !== stableStringify(baseline.removedIds)) {
    delta.removed_ids = removed as FitgraphStore['removed_ids'];
  }

  const write = Object.keys(delta).length > 0;
  const bytes = write ? Buffer.byteLength(JSON.stringify(delta), 'utf8') : 0;
  return {
    patch: delta,
    bytes,
    write,
    updatedAt: baseline.updatedAt,
  };
}

export function fitgraphDeltaIsEmpty(patch: Partial<FitgraphStore>): boolean {
  return Object.keys(patch).length === 0;
}

/** Diff every key on `store` against the snapshot. Unchanged keys are omitted. */
export function diffFitgraphStore(
  baseline: FitgraphBaseline,
  store: FitgraphStore
): Partial<FitgraphStore> {
  const patch: Partial<FitgraphStore> = {};
  for (const key of Object.keys(store) as Array<keyof FitgraphStore>) {
    if (key === 'updated_at') continue;
    const value = store[key];
    if (value === undefined) continue;
    (patch as Record<string, unknown>)[key] = value;
  }
  return prepareFitgraphDeltaWrite(baseline, patch).patch;
}

/**
 * Port of sa_module_store_merge_id_array (Brief 52): incoming non-tombstones
 * first, then existing rows whose ids were not replaced or removed.
 */
export function mergeModuleStoreIdArray<T>(
  existing: readonly T[],
  incoming: readonly T[],
  removedIds: readonly string[] = []
): T[] {
  const removed = new Set(
    removedIds.map((id) => String(id || '').trim()).filter(Boolean)
  );
  const incomingIds = new Set<string>();
  const tombstones = new Set<string>();
  for (const row of incoming) {
    const id = fitgraphRowId(row);
    if (!id) continue;
    incomingIds.add(id);
    if (fitgraphRowIsTombstone(row)) tombstones.add(id);
  }
  const out: T[] = [];
  for (const row of incoming) {
    const id = fitgraphRowId(row);
    if (id && tombstones.has(id)) continue;
    out.push(row);
  }
  for (const row of existing) {
    const id = fitgraphRowId(row);
    if (id && (incomingIds.has(id) || removed.has(id))) continue;
    out.push(row);
  }
  return out;
}

function arrayMergesById(incoming: unknown, existing: unknown): boolean {
  if (!Array.isArray(incoming)) return false;
  if (isIdArray(incoming)) return true;
  return Array.isArray(existing) && isIdArray(existing);
}

/** Apply one patch the way sa_merge_module_store_data applies id arrays. */
export function applyModuleStoreMerge<T extends Record<string, unknown>>(
  existing: T,
  incoming: Partial<T>
): T {
  const merged: Record<string, unknown> = { ...existing, ...incoming };
  const removedMap = asRemovedMap(incoming.removed_ids);
  for (const key of Object.keys(incoming)) {
    const incomingValue = incoming[key];
    const existingValue = existing[key];
    if (!arrayMergesById(incomingValue, existingValue)) continue;
    const removed = removedMap[key] || [];
    merged[key] = mergeModuleStoreIdArray(
      Array.isArray(existingValue) ? existingValue : [],
      incomingValue as unknown[],
      removed
    );
  }
  return merged as T;
}

export function formatFitgraphServerTiming(timing: {
  loadMs: number;
  saveMs: number;
  patchBytes: number;
}): string {
  const dur = (ms: number) =>
    (Number.isFinite(ms) && ms > 0 ? ms : 0).toFixed(1);
  const bytes = Math.max(0, Math.round(timing.patchBytes || 0));
  return `load;dur=${dur(timing.loadMs)}, save;dur=${dur(timing.saveMs)}, patch_bytes;desc=${bytes}`;
}

type PostCtx = {
  baseline: FitgraphBaseline | null;
  loadMs: number;
  saveMs: number;
  patchBytes: number;
};

const postContext = new AsyncLocalStorage<PostCtx>();

function ctx(): PostCtx | undefined {
  return postContext.getStore();
}

export function runFitgraphDeskPost<T>(fn: () => Promise<T>): Promise<T> {
  return postContext.run(
    { baseline: null, loadMs: 0, saveMs: 0, patchBytes: 0 },
    fn
  );
}

export function noteFitgraphLoad(ms: number): void {
  const current = ctx();
  if (current) current.loadMs = ms;
}

export function rememberFitgraphBaseline(store: FitgraphStore): void {
  const current = ctx();
  if (current) current.baseline = snapshotFitgraphBaseline(store);
}

export function currentFitgraphBaseline(): FitgraphBaseline | null {
  return ctx()?.baseline ?? null;
}

export function noteFitgraphSave(ms: number, bytes: number): void {
  const current = ctx();
  if (!current) return;
  current.saveMs += ms;
  current.patchBytes += bytes;
}

export function fitgraphServerTimingHeader(): string {
  const current = ctx();
  return formatFitgraphServerTiming({
    loadMs: current?.loadMs ?? 0,
    saveMs: current?.saveMs ?? 0,
    patchBytes: current?.patchBytes ?? 0,
  });
}
