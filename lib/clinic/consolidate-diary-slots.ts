/**
 * Member / public clinic diaries should not paint every clinician’s
 * booked appointment as its own block. Collapse a time bucket to:
 *  - your booking (if any)
 *  - each still-open slot (what you can book)
 *  - or one anonymous “Booked” block when nobody is free
 */

export type DiarySlotLike = {
  id: string;
  date: string;
  start_time: string;
  end_time?: string | null;
  full?: boolean;
  my_status?: string | null;
  practitioner_name?: string | null;
  clinician_name?: string | null;
  service_name?: string;
  spots_left?: number;
};

function timeKey(s: Pick<DiarySlotLike, 'date' | 'start_time' | 'end_time'>): string {
  return `${s.date}|${String(s.start_time || '').slice(0, 5)}|${String(
    s.end_time || ''
  ).slice(0, 5)}`;
}

export function consolidateClinicDiarySlots<T extends DiarySlotLike>(
  slots: T[]
): T[] {
  const groups = new Map<string, T[]>();
  for (const s of slots) {
    const k = timeKey(s);
    const list = groups.get(k) || [];
    list.push(s);
    groups.set(k, list);
  }

  const out: T[] = [];
  for (const group of groups.values()) {
    const mine = group.filter((s) => Boolean(s.my_status));
    const open = group.filter((s) => !s.full && !s.my_status);
    const taken = group.filter((s) => s.full && !s.my_status);

    if (mine.length) out.push(...mine);
    if (open.length) {
      out.push(...open);
      continue;
    }
    if (!mine.length && taken.length) {
      const pick = taken[0];
      out.push({
        ...pick,
        full: true,
        spots_left: 0,
        service_name: 'Booked',
        practitioner_name: null,
        clinician_name: null,
      });
    }
  }

  out.sort((a, b) =>
    a.date === b.date
      ? String(a.start_time).localeCompare(String(b.start_time))
      : a.date.localeCompare(b.date)
  );
  return out;
}
