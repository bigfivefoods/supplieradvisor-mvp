/** Session clock helpers — start/end as HH:mm, duration in minutes. */

export function parseHm(t: string): number {
  const [h, m] = String(t || '')
    .slice(0, 5)
    .split(':')
    .map(Number);
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

export function formatHm(mins: number): string {
  const n = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

export function durationFromStartEnd(start: string, end: string): number {
  let d = parseHm(end) - parseHm(start);
  if (d <= 0) d += 24 * 60;
  return Math.max(15, d);
}

export function endFromStartDuration(start: string, durationMin: number): string {
  return formatHm(parseHm(start) + Math.max(15, Number(durationMin) || 45));
}

export function resolveSessionTimes(opts: {
  start_time: string;
  end_time?: string | null;
  duration_min?: number | null;
  fallbackDuration?: number;
}): { start_time: string; end_time: string; duration_min: number } {
  const start = String(opts.start_time || '06:00').slice(0, 5);
  const endRaw = opts.end_time != null ? String(opts.end_time).trim() : '';
  if (endRaw) {
    const end = endRaw.slice(0, 5);
    return {
      start_time: start,
      end_time: end,
      duration_min: durationFromStartEnd(start, end),
    };
  }
  const dur = Math.max(
    15,
    Number(opts.duration_min) || Number(opts.fallbackDuration) || 45
  );
  return {
    start_time: start,
    end_time: endFromStartDuration(start, dur),
    duration_min: dur,
  };
}

export type FitSessionKind = 'class' | 'private_pt' | 'coach_personal';

export function normalizeSessionKind(
  raw: unknown,
  fallback: FitSessionKind = 'class'
): FitSessionKind {
  const v = String(raw || '').toLowerCase();
  if (v === 'private_pt' || v === 'pt' || v === 'personal_training') {
    return 'private_pt';
  }
  if (
    v === 'coach_personal' ||
    v === 'coach_block' ||
    v === 'personal' ||
    v === 'self'
  ) {
    return 'coach_personal';
  }
  if (v === 'class') return 'class';
  return fallback;
}

export const SYS_PT_CODE = 'SYS_PT';
export const SYS_COACH_TIME_CODE = 'SYS_COACH_TIME';

export const SESSION_KIND_OPTIONS: Array<{
  value: FitSessionKind;
  label: string;
  hint: string;
}> = [
  {
    value: 'class',
    label: 'Group class',
    hint: 'Bookable class on the gym diary',
  },
  {
    value: 'private_pt',
    label: 'Private PT',
    hint: '1:1 personal training with a member',
  },
  {
    value: 'coach_personal',
    label: 'Coach personal time',
    hint: 'Own training, admin, or other blocked time',
  },
];

export function sessionKindLabel(kind: FitSessionKind): string {
  if (kind === 'private_pt') return 'Private PT';
  if (kind === 'coach_personal') return 'Coach personal';
  return 'Class';
}

export function sessionKindTone(
  kind: FitSessionKind
): 'yellow' | 'amber' | 'indigo' {
  if (kind === 'private_pt') return 'amber';
  if (kind === 'coach_personal') return 'indigo';
  return 'yellow';
}

export function defaultDurationForKind(kind: FitSessionKind): number {
  return kind === 'class' ? 45 : 60;
}

export function sessionKindFromRecord(opts: {
  session_kind?: unknown;
  class_code?: string | null;
}): FitSessionKind {
  if (opts.session_kind != null && String(opts.session_kind).trim()) {
    return normalizeSessionKind(opts.session_kind);
  }
  const code = String(opts.class_code || '');
  if (code === SYS_PT_CODE) return 'private_pt';
  if (code === SYS_COACH_TIME_CODE) return 'coach_personal';
  return 'class';
}

export function isSystemClassCode(code?: string | null): boolean {
  return code === SYS_PT_CODE || code === SYS_COACH_TIME_CODE;
}

/** Adjust form fields when the coach switches Class / PT / personal time. */
export function patchFormForSessionKind<
  T extends {
    session_kind?: string;
    class_type_id?: string;
    start_time?: string;
    end_time?: string;
    public?: boolean;
    capacity?: string;
  },
>(
  form: T,
  kind: FitSessionKind,
  classTypes: Array<{ id: string; code: string }>
): T {
  const start = String(form.start_time || '06:00').slice(0, 5);
  const prevEnd = form.end_time ? String(form.end_time).slice(0, 5) : '';
  const prevDur = prevEnd
    ? durationFromStartEnd(start, prevEnd)
    : defaultDurationForKind(kind);
  const dur =
    kind === 'class'
      ? prevDur
      : Math.max(prevDur, defaultDurationForKind(kind));
  const current = classTypes.find((c) => c.id === form.class_type_id);
  const sysId =
    kind === 'private_pt'
      ? classTypes.find((c) => c.code === SYS_PT_CODE)?.id || ''
      : kind === 'coach_personal'
        ? classTypes.find((c) => c.code === SYS_COACH_TIME_CODE)?.id || ''
        : '';
  let class_type_id = form.class_type_id || '';
  if (kind === 'class') {
    if (!current || isSystemClassCode(current.code)) class_type_id = '';
  } else if (kind === 'coach_personal') {
    class_type_id = sysId;
  } else if (!current || isSystemClassCode(current.code)) {
    class_type_id = sysId;
  }
  return {
    ...form,
    session_kind: kind,
    class_type_id,
    start_time: start,
    end_time: endFromStartDuration(start, dur),
    public: kind === 'class' ? form.public === true : false,
    capacity:
      kind === 'coach_personal'
        ? '0'
        : kind === 'private_pt'
          ? form.capacity && Number(form.capacity) > 0
            ? form.capacity
            : '1'
          : form.capacity,
  };
}
