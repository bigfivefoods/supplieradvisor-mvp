/**
 * Named consult rooms / surgeries used as diary resources.
 * Accepts legacy string[] and richer room objects.
 */

export type ClinicRoom = {
  id: string;
  name: string;
  notes?: string;
  /** Usual clinicians for this room (optional) */
  practitioner_ids?: string[];
  /** Company asset register ids (People → Organisation / manufacturing assets) */
  asset_ids?: number[];
  active?: boolean;
};

export function normalizeRoomAssetIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const row of raw) {
    const n = Number(row);
    if (!Number.isFinite(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function newClinicRoomId(): string {
  return `room_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeClinicRooms(raw: unknown): ClinicRoom[] {
  if (!Array.isArray(raw)) return [];
  const out: ClinicRoom[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (typeof row === 'string') {
      const name = row.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: newClinicRoomId(), name, active: true, practitioner_ids: [] });
      continue;
    }
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const name = String(r.name || r.label || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const ids = Array.isArray(r.practitioner_ids)
      ? r.practitioner_ids.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
    out.push({
      id: String(r.id || newClinicRoomId()),
      name,
      notes: r.notes != null ? String(r.notes) : undefined,
      practitioner_ids: ids,
      asset_ids: normalizeRoomAssetIds(r.asset_ids),
      active: r.active !== false,
    });
  }
  return out;
}

export function clinicRoomNames(raw: unknown): string[] {
  return normalizeClinicRooms(raw)
    .filter((r) => r.active !== false)
    .map((r) => r.name);
}

/** Keep extra room fields when a name-only editor saves. */
export function mergeClinicRoomNames(
  prev: unknown,
  names: string[]
): ClinicRoom[] {
  const existing = normalizeClinicRooms(prev);
  const byName = new Map(existing.map((r) => [r.name.toLowerCase(), r]));
  const out: ClinicRoom[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = String(raw || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const prevRow = byName.get(key);
    out.push(
      prevRow
        ? { ...prevRow, name, active: true }
        : {
            id: newClinicRoomId(),
            name,
            active: true,
            practitioner_ids: [],
          }
    );
  }
  return out;
}
