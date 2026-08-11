/**
 * Build repeating clinic appointment rows (Dental / Physio / Medical / Psychiatry).
 * Shared conflict-aware expansion used by create_appointment_series API actions.
 */

import {
  findClinicianDiaryConflict,
  type DiaryAppointmentLike,
} from '@/lib/schedule/clinician-diary';
import {
  expandRecurrenceDates,
  parseRecurrenceBody,
  type ScheduleRecurrence,
} from '@/lib/schedule/recurrence';

export type AppointmentSeriesTemplate = {
  service_id: string;
  /** dental: staff_id; clinic: practitioner_id */
  clinician_id: string;
  date: string;
  start_time: string;
  duration_min?: number | null;
  end_time?: string | null;
  location?: string;
  public?: boolean;
  notes?: string;
  public_notes?: string;
  status?: string;
};

export type SeriesConflict = {
  date: string;
  message: string;
  with_id?: string;
};

/**
 * Expand recurrence and ensure no clinician double-book against existing diary
 * or within the series itself. Returns null conflicts when all clear.
 */
export function planAppointmentSeries(opts: {
  existing: DiaryAppointmentLike[];
  template: AppointmentSeriesTemplate;
  recurrence: ScheduleRecurrence;
  clinicianField: 'staff_id' | 'practitioner_id';
  /** Clinic modules require a prefix (e.g. 'apt', 'ser'). */
  newId: (prefix: string) => string;
  nowIso: string;
}): {
  dates: string[];
  series_id: string | null;
  rows: Array<
    DiaryAppointmentLike & {
      service_id: string;
      location?: string;
      public?: boolean;
      notes?: string;
      public_notes?: string;
      series_id?: string | null;
      created_at: string;
      staff_id?: string | null;
      practitioner_id?: string | null;
    }
  >;
  conflicts: SeriesConflict[];
} {
  const dates = expandRecurrenceDates(opts.template.date, opts.recurrence);
  const seriesId = dates.length > 1 ? opts.newId('ser') : null;
  const duration = opts.template.duration_min ?? 45;
  const start = String(opts.template.start_time || '09:00').slice(0, 5);
  const conflicts: SeriesConflict[] = [];
  const planned: DiaryAppointmentLike[] = [];
  const rows: ReturnType<typeof planAppointmentSeries>['rows'] = [];

  for (const date of dates) {
    const conflict = findClinicianDiaryConflict({
      appointments: [...opts.existing, ...planned],
      clinicianId: opts.template.clinician_id,
      clinicianField: opts.clinicianField,
      date,
      start_time: start,
      duration_min: duration,
      end_time: opts.template.end_time ?? null,
      status: opts.template.status || 'scheduled',
    });
    if (conflict.conflict) {
      conflicts.push({
        date,
        message: conflict.message,
        with_id: conflict.with_id,
      });
      continue;
    }
    const id = opts.newId('apt');
    const row = {
      id,
      service_id: opts.template.service_id,
      date,
      start_time: start,
      end_time: opts.template.end_time ?? null,
      duration_min: duration,
      location: opts.template.location,
      status: (opts.template.status || 'scheduled') as DiaryAppointmentLike['status'],
      public: opts.template.public === true,
      notes: opts.template.notes,
      public_notes: opts.template.public_notes,
      series_id: seriesId,
      created_at: opts.nowIso,
      staff_id:
        opts.clinicianField === 'staff_id'
          ? opts.template.clinician_id
          : null,
      practitioner_id:
        opts.clinicianField === 'practitioner_id'
          ? opts.template.clinician_id
          : null,
    };
    planned.push(row);
    rows.push(row);
  }

  return { dates, series_id: seriesId, rows, conflicts };
}

export function recurrenceFromRequestBody(
  body: Record<string, unknown>
): ScheduleRecurrence {
  return parseRecurrenceBody(body, { seriesDefault: 'weekly' });
}
