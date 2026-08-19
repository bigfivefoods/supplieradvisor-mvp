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

export function upsertClinicRoom(
  raw: unknown,
  input: {
    id?: string | null;
    name: string;
    notes?: string | null;
    practitioner_ids?: string[] | null;
    asset_ids?: Array<string | number> | null;
  }
): { rooms: ClinicRoom[]; room: ClinicRoom; created: boolean } {
  const rooms = normalizeClinicRooms(raw);
  const name = String(input.name || '').trim();
  if (!name) throw new Error('Room name required');
  const id = String(input.id || '').trim();
  const clash = rooms.find(
    (r) => r.name.toLowerCase() === name.toLowerCase() && r.id !== id
  );
  if (clash) throw new Error('A room with that name already exists');
  if (id) {
    const i = rooms.findIndex((r) => r.id === id);
    if (i < 0) throw new Error('Room not found');
    const room: ClinicRoom = {
      ...rooms[i],
      name,
      notes:
        input.notes != null
          ? String(input.notes).trim() || undefined
          : rooms[i].notes,
      practitioner_ids: Array.isArray(input.practitioner_ids)
        ? input.practitioner_ids.map((x) => String(x || '').trim()).filter(Boolean)
        : rooms[i].practitioner_ids,
      asset_ids: Array.isArray(input.asset_ids)
        ? normalizeRoomAssetIds(input.asset_ids)
        : rooms[i].asset_ids,
      active: true,
    };
    const next = [...rooms];
    next[i] = room;
    return { rooms: next, room, created: false };
  }
  const room: ClinicRoom = {
    id: newClinicRoomId(),
    name,
    notes: input.notes != null ? String(input.notes).trim() || undefined : undefined,
    practitioner_ids: Array.isArray(input.practitioner_ids)
      ? input.practitioner_ids.map((x) => String(x || '').trim()).filter(Boolean)
      : [],
    asset_ids: normalizeRoomAssetIds(input.asset_ids),
    active: true,
  };
  return { rooms: [...rooms, room], room, created: true };
}

export function removeClinicRoom(raw: unknown, id: string): ClinicRoom[] {
  return normalizeClinicRooms(raw).filter((r) => r.id !== String(id || ''));
}
