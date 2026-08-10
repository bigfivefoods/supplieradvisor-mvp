/**
 * Per-clinician diary rules for Dental / Physio / Medical / Psychiatry Advisors.
 *
 * Practice diary: many doctors can run in parallel (like Fit coaches).
 * Clinician diary: one person cannot be double-booked (overlapping times).
 */

export type DiaryAppointmentLike = {
  id: string;
  date: string;
  start_time: string;
  end_time?: string | null;
  duration_min?: number | null;
  status?: string;
  staff_id?: string | null;
  practitioner_id?: string | null;
};

function minutesFromTime(t: string): number {
  const [h, m] = String(t || '09:00')
    .slice(0, 5)
    .split(':')
    .map(Number);
  return (h || 0) * 60 + (m || 0);
}

function endMinutes(opts: {
  start_time: string;
  end_time?: string | null;
  duration_min?: number | null;
}): number {
  if (opts.end_time) {
    const e = minutesFromTime(opts.end_time);
    const s = minutesFromTime(opts.start_time);
    if (e > s) return e;
  }
  const dur = Number(opts.duration_min);
  return minutesFromTime(opts.start_time) + (Number.isFinite(dur) && dur > 0 ? dur : 45);
}

function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export type ClinicianConflict = {
  conflict: true;
  with_id: string;
  with_start: string;
  with_end: string;
  message: string;
};

export type ClinicianNoConflict = { conflict: false };

/**
 * Find an overlapping appointment for the same clinician on the same day.
 * Cancelled / completed slots do not block.
 */
export function findClinicianDiaryConflict(opts: {
  appointments: DiaryAppointmentLike[];
  /** staff_id (dental) or practitioner_id (physio/medical/psych) */
  clinicianId: string;
  clinicianField?: 'staff_id' | 'practitioner_id' | 'auto';
  date: string;
  start_time: string;
  duration_min?: number | null;
  end_time?: string | null;
  /** When updating, ignore this appointment id */
  excludeId?: string | null;
  /** Status of the row being saved — cancelled never conflicts */
  status?: string | null;
}): ClinicianConflict | ClinicianNoConflict {
  const clinicianId = String(opts.clinicianId || '').trim();
  if (!clinicianId) return { conflict: false };

  const status = String(opts.status || 'scheduled');
  if (status === 'cancelled') return { conflict: false };

  const field = opts.clinicianField || 'auto';
  const date = String(opts.date || '').slice(0, 10);
  const start = minutesFromTime(opts.start_time);
  const end = endMinutes({
    start_time: opts.start_time,
    end_time: opts.end_time,
    duration_min: opts.duration_min,
  });
  if (end <= start) return { conflict: false };

  for (const a of opts.appointments) {
    if (opts.excludeId && a.id === opts.excludeId) continue;
    if (String(a.date || '').slice(0, 10) !== date) continue;
    if (a.status === 'cancelled') continue;

    const aid =
      field === 'staff_id'
        ? a.staff_id
        : field === 'practitioner_id'
          ? a.practitioner_id
          : a.staff_id || a.practitioner_id;
    if (String(aid || '') !== clinicianId) continue;

    const aStart = minutesFromTime(a.start_time);
    const aEnd = endMinutes({
      start_time: a.start_time,
      end_time: a.end_time,
      duration_min: a.duration_min,
    });
    if (rangesOverlap(start, end, aStart, aEnd)) {
      const withEnd =
        a.end_time ||
        (() => {
          const total = aEnd;
          const hh = Math.floor(total / 60) % 24;
          const mm = total % 60;
          return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
        })();
      return {
        conflict: true,
        with_id: a.id,
        with_start: a.start_time.slice(0, 5),
        with_end: String(withEnd).slice(0, 5),
        message: `This clinician is already booked ${a.start_time.slice(0, 5)}–${String(withEnd).slice(0, 5)} on ${date}. Choose another time or another clinician.`,
      };
    }
  }
  return { conflict: false };
}

/** Client-side helper for desk forms before POST */
export function clinicianHasConflict(
  appointments: DiaryAppointmentLike[],
  opts: {
    clinicianId: string;
    clinicianField?: 'staff_id' | 'practitioner_id' | 'auto';
    date: string;
    start_time: string;
    duration_min?: number | null;
    excludeId?: string | null;
  }
): boolean {
  return findClinicianDiaryConflict({
    appointments,
    ...opts,
  }).conflict;
}
