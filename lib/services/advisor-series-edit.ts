/**
 * Edit "this occurrence only" vs "this and future" for class/appointment series.
 */
export type SeriesEditScope = 'one' | 'future' | 'all';

export type DatedOccurrence = {
  id: string;
  date: string;
  series_id?: string | null;
};

/**
 * Returns ids to update for a series edit.
 * - one: only the selected id
 * - future: selected + later dates sharing series_id
 * - all: every occurrence sharing series_id
 */
export function resolveSeriesEditIds<T extends DatedOccurrence>(
  items: T[],
  selectedId: string,
  scope: SeriesEditScope
): string[] {
  const selected = items.find((x) => x.id === selectedId);
  if (!selected) return [];
  if (!selected.series_id || scope === 'one') {
    return [selected.id];
  }
  const sid = String(selected.series_id);
  return items
    .filter((x) => {
      if (x.series_id !== sid) return false;
      if (scope === 'future') return x.date >= selected.date;
      return true;
    })
    .map((x) => x.id);
}

export type SeriesPatch = {
  start_time?: string;
  end_time?: string | null;
  location?: string | null;
  room?: string | null;
  coach_id?: string | null;
  duration_min?: number | null;
  capacity?: number | null;
  class_type_id?: string;
  session_kind?: string;
  appointment_kind?: string;
  personal_reason?: string | null;
  programme_id?: string | null;
  service_id?: string;
  public?: boolean;
  notes?: string | null;
  public_notes?: string | null;
  class_plan?: string | null;
  status?: string;
};

export function applySeriesPatch<T extends object>(
  row: T,
  patch: SeriesPatch,
  opts?: { isAnchor?: boolean; newDate?: string }
): T {
  const next = { ...row } as T & {
    start_time?: string;
    end_time?: string | null;
    location?: string | null;
    room?: string | null;
    coach_id?: string | null;
    duration_min?: number | null;
    capacity?: number | null;
    class_type_id?: string;
    session_kind?: string;
    appointment_kind?: string;
    personal_reason?: string | null;
    programme_id?: string | null;
    service_id?: string;
    public?: boolean;
    notes?: string | null;
    public_notes?: string | null;
    class_plan?: string | null;
    status?: string;
    date?: string;
  };
  if (patch.start_time != null) {
    next.start_time = String(patch.start_time).slice(0, 5);
  }
  if (patch.end_time !== undefined) {
    next.end_time = patch.end_time
      ? String(patch.end_time).slice(0, 5)
      : null;
  }
  if (patch.session_kind) {
    next.session_kind = String(patch.session_kind);
  }
  if (patch.appointment_kind) {
    next.appointment_kind = String(patch.appointment_kind);
  }
  if (patch.personal_reason !== undefined) {
    next.personal_reason = patch.personal_reason;
  }
  if (patch.programme_id !== undefined) {
    next.programme_id = patch.programme_id
      ? String(patch.programme_id)
      : null;
  }
  if (patch.location !== undefined) {
    next.location = patch.location;
  }
  if (patch.room !== undefined) {
    next.room = patch.room;
  }
  if (patch.coach_id !== undefined) {
    next.coach_id = patch.coach_id;
  }
  if (patch.duration_min !== undefined) {
    next.duration_min = patch.duration_min;
  }
  if (patch.capacity !== undefined) {
    next.capacity = patch.capacity;
  }
  if (patch.class_type_id) {
    next.class_type_id = patch.class_type_id;
  }
  if (patch.service_id) {
    next.service_id = patch.service_id;
  }
  if (patch.public === true || patch.public === false) {
    next.public = patch.public;
  }
  if (patch.notes !== undefined) {
    next.notes = patch.notes;
  }
  if (patch.public_notes !== undefined) {
    next.public_notes = patch.public_notes;
  }
  if (patch.class_plan !== undefined) {
    next.class_plan = patch.class_plan;
  }
  if (patch.status) {
    next.status = patch.status;
  }
  // Date only moves on the anchor occurrence for "future" (keeps weekly spacing)
  if (opts?.isAnchor && opts.newDate) {
    next.date = opts.newDate.slice(0, 10);
  }
  return next as T;
}
