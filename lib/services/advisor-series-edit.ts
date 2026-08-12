/**
 * Edit "this occurrence only" vs "this and future" for class/appointment series.
 */
export type SeriesEditScope = 'one' | 'future';

export type DatedOccurrence = {
  id: string;
  date: string;
  series_id?: string | null;
};

/**
 * Returns ids to update for a series edit.
 * - one: only the selected id
 * - future: selected + later dates sharing series_id
 */
export function resolveSeriesEditIds<T extends DatedOccurrence>(
  items: T[],
  selectedId: string,
  scope: SeriesEditScope
): string[] {
  const selected = items.find((x) => x.id === selectedId);
  if (!selected) return [];
  if (scope !== 'future' || !selected.series_id) {
    return [selected.id];
  }
  const sid = String(selected.series_id);
  return items
    .filter(
      (x) =>
        x.series_id === sid &&
        x.date >= selected.date
    )
    .map((x) => x.id);
}

export type SeriesPatch = {
  start_time?: string;
  location?: string | null;
  duration_min?: number | null;
  capacity?: number | null;
  class_type_id?: string;
  service_id?: string;
  public?: boolean;
  notes?: string | null;
  public_notes?: string | null;
  class_plan?: string | null;
  status?: string;
};

export function applySeriesPatch<T extends Record<string, unknown>>(
  row: T,
  patch: SeriesPatch,
  opts?: { isAnchor?: boolean; newDate?: string }
): T {
  const next = { ...row } as T;
  if (patch.start_time != null) {
    (next as { start_time?: string }).start_time = String(
      patch.start_time
    ).slice(0, 5);
  }
  if (patch.location !== undefined) {
    (next as { location?: string | null }).location = patch.location;
  }
  if (patch.duration_min !== undefined) {
    (next as { duration_min?: number | null }).duration_min =
      patch.duration_min;
  }
  if (patch.capacity !== undefined) {
    (next as { capacity?: number | null }).capacity = patch.capacity;
  }
  if (patch.class_type_id) {
    (next as { class_type_id?: string }).class_type_id = patch.class_type_id;
  }
  if (patch.service_id) {
    (next as { service_id?: string }).service_id = patch.service_id;
  }
  if (patch.public === true || patch.public === false) {
    (next as { public?: boolean }).public = patch.public;
  }
  if (patch.notes !== undefined) {
    (next as { notes?: string | null }).notes = patch.notes;
  }
  if (patch.public_notes !== undefined) {
    (next as { public_notes?: string | null }).public_notes =
      patch.public_notes;
  }
  if (patch.class_plan !== undefined) {
    (next as { class_plan?: string | null }).class_plan = patch.class_plan;
  }
  if (patch.status) {
    (next as { status?: string }).status = patch.status;
  }
  // Date only moves on the anchor occurrence for "future" (keeps weekly spacing)
  if (opts?.isAnchor && opts.newDate) {
    (next as { date?: string }).date = opts.newDate.slice(0, 10);
  }
  return next;
}
