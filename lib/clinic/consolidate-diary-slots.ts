/**
 * One practice calendar: a time is either yours, one free slot
 * (any available clinician), or — unless availableOnly — one Booked block.
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
  is_preferred_clinician?: boolean;
};

export type ConsolidateDiaryOpts = {
  /** Member PWA: hide taken times; only free slots (+ yours). */
  availableOnly?: boolean;
};

function timeKey(s: Pick<DiarySlotLike, 'date' | 'start_time' | 'end_time'>): string {
  return `${s.date}|${String(s.start_time || '').slice(0, 5)}|${String(
    s.end_time || ''
  ).slice(0, 5)}`;
}

function pickOpen<T extends DiarySlotLike>(open: T[]): T {
  return open.find((s) => s.is_preferred_clinician) || open[0];
}

export function consolidateClinicDiarySlots<T extends DiarySlotLike>(
  slots: T[],
  opts?: ConsolidateDiaryOpts
): T[] {
  const availableOnly = opts?.availableOnly === true;
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

    if (mine.length) {
      out.push(mine[0]);
      continue;
    }
    if (open.length) {
      const pick = pickOpen(open);
      const spots = open.reduce(
        (n, s) => n + Number(s.spots_left ?? 1),
        0
      );
      out.push({
        ...pick,
        full: false,
        spots_left: spots,
        practitioner_name: null,
        clinician_name: null,
      });
      continue;
    }
    if (!availableOnly && taken.length) {
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
