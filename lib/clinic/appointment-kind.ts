/**
 * Clinic diary kinds — consult vs personal / leave block.
 * Personal time is not public and not patient-bookable (GymAdvisor coach_personal).
 */
import {
  endFromStartDuration,
  resolveSessionTimes,
} from '@/lib/fitness/session-times';

export type ClinicAppointmentKind = 'consult' | 'personal';
export type ClinicPersonalReason = 'personal' | 'leave' | 'admin' | 'other';

export const SYS_PERSONAL_CODE = 'SYS_PERSONAL';
export const SYS_PERSONAL_SERVICE_ID = 'svc_sys_personal';

export const APPOINTMENT_KIND_OPTIONS: Array<{
  value: ClinicAppointmentKind;
  label: string;
  hint: string;
}> = [
  {
    value: 'consult',
    label: 'Patient appointment',
    hint: 'Bookable consult on the clinician diary',
  },
  {
    value: 'personal',
    label: 'Own time / leave',
    hint: 'Leave, admin, or personal — blocks the diary',
  },
];

export const PERSONAL_REASON_OPTIONS: Array<{
  value: ClinicPersonalReason;
  label: string;
}> = [
  { value: 'personal', label: 'Personal' },
  { value: 'leave', label: 'Leave' },
  { value: 'admin', label: 'Admin / paperwork' },
  { value: 'other', label: 'Other' },
];

export function normalizeAppointmentKind(
  raw: unknown,
  fallback: ClinicAppointmentKind = 'consult'
): ClinicAppointmentKind {
  const v = String(raw || '').toLowerCase();
  if (
    v === 'personal' ||
    v === 'leave' ||
    v === 'own' ||
    v === 'self' ||
    v === 'block' ||
    v === 'coach_personal'
  ) {
    return 'personal';
  }
  if (v === 'consult' || v === 'appointment' || v === 'class') return 'consult';
  return fallback;
}

export function normalizePersonalReason(
  raw: unknown
): ClinicPersonalReason {
  const v = String(raw || '').toLowerCase();
  if (v === 'leave' || v === 'admin' || v === 'other' || v === 'personal') {
    return v;
  }
  return 'personal';
}

export function personalReasonOrNull(
  raw: unknown
): ClinicPersonalReason | null {
  if (raw == null || String(raw).trim() === '') return null;
  return normalizePersonalReason(raw);
}

export function appointmentKindLabel(
  kind: ClinicAppointmentKind,
  reason?: ClinicPersonalReason | null
): string {
  if (kind !== 'personal') return 'Appointment';
  if (reason === 'leave') return 'Leave';
  if (reason === 'admin') return 'Admin time';
  if (reason === 'other') return 'Blocked time';
  return 'Personal time';
}

export function personalReasonLabel(reason?: ClinicPersonalReason | null): string {
  const hit = PERSONAL_REASON_OPTIONS.find((o) => o.value === reason);
  return hit?.label || 'Personal';
}

export function appointmentKindOf(
  apt: { appointment_kind?: unknown; service_id?: string } | null | undefined,
  services: Array<{ id: string; code?: string }>
): ClinicAppointmentKind {
  if (!apt) return 'consult';
  if (apt.appointment_kind != null && String(apt.appointment_kind).trim()) {
    return normalizeAppointmentKind(apt.appointment_kind);
  }
  const svc = services.find((s) => s.id === apt.service_id);
  if (svc?.code === SYS_PERSONAL_CODE) return 'personal';
  return 'consult';
}

export function isSystemPersonalService(code?: string | null): boolean {
  return String(code || '') === SYS_PERSONAL_CODE;
}

export function ensureSystemPersonalService<
  T extends {
    id: string;
    code?: string;
    name: string;
    default_duration_min?: number;
    duration_min?: number;
    price_zar?: number;
    active?: boolean;
    created_at?: string;
  },
>(services: T[]): T[] {
  const list = Array.isArray(services) ? services : [];
  if (list.some((s) => s.code === SYS_PERSONAL_CODE)) return list;
  const now = new Date().toISOString();
  list.push({
    id: SYS_PERSONAL_SERVICE_ID,
    code: SYS_PERSONAL_CODE,
    name: 'Personal / leave',
    default_duration_min: 60,
    duration_min: 60,
    price_zar: 0,
    active: true,
    created_at: now,
  } as T);
  return list;
}

export function systemPersonalServiceId(
  services: Array<{ id: string; code?: string }>
): string {
  return (
    services.find((s) => s.code === SYS_PERSONAL_CODE)?.id ||
    SYS_PERSONAL_SERVICE_ID
  );
}

export function consultServices<T extends { code?: string; active?: boolean }>(
  services: T[]
): T[] {
  return (services || []).filter(
    (s) => s.active !== false && !isSystemPersonalService(s.code)
  );
}

/** kind/reason stay unknown so upserts from Record<string, unknown> still infer T. */
type AppointmentKindRuleInput = {
  service_id?: string;
  appointment_kind?: unknown;
  personal_reason?: unknown;
  public?: boolean;
  notes?: string;
  start_time?: string;
  end_time?: string | null;
  duration_min?: number | null;
};

/** Keeps caller fields (id, date, status, …) and narrows kind / reason. */
export type AppointmentKindRuleResult<T> = T & {
  appointment_kind: ClinicAppointmentKind;
  personal_reason: ClinicPersonalReason | null;
  public: boolean;
  start_time: string;
  end_time: string | null;
  duration_min: number;
};

export function applyAppointmentKindRules<T extends AppointmentKindRuleInput>(
  row: T,
  services: Array<{ id: string; code?: string }>,
  kindRaw?: unknown
): AppointmentKindRuleResult<T> {
  const kind = normalizeAppointmentKind(
    kindRaw != null ? kindRaw : row.appointment_kind,
    appointmentKindOf(row, services)
  );
  const times = resolveSessionTimes({
    start_time: row.start_time || '09:00',
    end_time: row.end_time,
    duration_min: row.duration_min,
    fallbackDuration: kind === 'personal' ? 60 : 45,
  });
  const reason =
    kind === 'personal'
      ? normalizePersonalReason(row.personal_reason)
      : null;
  return {
    ...row,
    appointment_kind: kind,
    personal_reason: reason,
    service_id:
      kind === 'personal'
        ? systemPersonalServiceId(services)
        : row.service_id,
    public: kind === 'personal' ? false : row.public === true,
    start_time: times.start_time,
    end_time: times.end_time,
    duration_min: times.duration_min,
  } as AppointmentKindRuleResult<T>;
}

export function clinicAppointmentSaveFields(opts: {
  kind: unknown;
  reason?: unknown;
  notes?: string;
  start_time: string;
  end_time?: string | null;
  duration_min?: string | number | null;
  service_id: string;
  public?: boolean;
  services: Array<{ id: string; code?: string }>;
}) {
  return applyAppointmentKindRules(
    {
      appointment_kind: normalizeAppointmentKind(opts.kind),
      personal_reason:
        opts.reason != null ? String(opts.reason) : null,
      notes: opts.notes,
      start_time: opts.start_time,
      end_time: opts.end_time,
      duration_min:
        opts.duration_min != null && opts.duration_min !== ''
          ? Number(opts.duration_min)
          : null,
      service_id: opts.service_id,
      public: opts.public === true,
    },
    opts.services
  );
}

export function patchFormForAppointmentKind<
  T extends {
    appointment_kind?: string;
    personal_reason?: string;
    service_id?: string;
    start_time?: string;
    end_time?: string;
    duration_min?: string;
    public?: boolean;
  },
>(
  form: T,
  kind: ClinicAppointmentKind,
  services: Array<{ id: string; code?: string }>
): T {
  const start = String(form.start_time || '09:00').slice(0, 5);
  const reason = normalizePersonalReason(form.personal_reason);
  const leave = kind === 'personal' && reason === 'leave';
  const end = leave
    ? '17:00'
    : form.end_time
      ? String(form.end_time).slice(0, 5)
      : endFromStartDuration(start, kind === 'personal' ? 60 : 45);
  const times = resolveSessionTimes({
    start_time: leave ? '08:00' : start,
    end_time: end,
  });
  return {
    ...form,
    appointment_kind: kind,
    personal_reason: kind === 'personal' ? reason : form.personal_reason,
    service_id:
      kind === 'personal'
        ? systemPersonalServiceId(services)
        : isSystemPersonalService(
            services.find((s) => s.id === form.service_id)?.code
          )
          ? ''
          : form.service_id,
    start_time: times.start_time,
    end_time: times.end_time,
    duration_min: String(times.duration_min),
    public: kind === 'personal' ? false : form.public,
  };
}

export function assertAppointmentBookable(
  apt: { appointment_kind?: unknown; service_id?: string } | null | undefined,
  services: Array<{ id: string; code?: string }>
) {
  if (appointmentKindOf(apt, services) === 'personal') {
    throw new Error(
      'This slot is personal / leave time and cannot be booked by a patient'
    );
  }
}
