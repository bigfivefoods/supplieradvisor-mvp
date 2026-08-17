/**
 * People leave windows that block Advisor diaries.
 */

export type LeaveWindow = {
  id?: string | number;
  employee_id: number;
  person_id?: string | null;
  module?: string | null;
  start_date: string;
  end_date: string;
  status: string;
  reason?: string | null;
  leave_type?: string | null;
};

export function isoDate(raw: string | Date): string {
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return String(raw || '').slice(0, 10);
}

export function dateInRange(
  date: string,
  start: string,
  end: string
): boolean {
  const d = isoDate(date);
  return d >= isoDate(start) && d <= isoDate(end);
}

export function approvedLeave(windows: LeaveWindow[]): LeaveWindow[] {
  return (windows || []).filter(
    (w) => String(w.status || '').toLowerCase() === 'approved'
  );
}

export function staffOnLeave(
  windows: LeaveWindow[],
  opts: {
    date: string;
    employeeId?: number | null;
    personId?: string | null;
    module?: string | null;
  }
): LeaveWindow | null {
  const date = isoDate(opts.date);
  for (const w of approvedLeave(windows)) {
    if (!dateInRange(date, w.start_date, w.end_date)) continue;
    if (opts.employeeId && Number(w.employee_id) === Number(opts.employeeId)) {
      return w;
    }
    if (
      opts.personId &&
      w.person_id &&
      String(w.person_id) === String(opts.personId)
    ) {
      if (opts.module && w.module && w.module !== opts.module) continue;
      return w;
    }
  }
  return null;
}

export function leaveBlocksAssignment(
  windows: LeaveWindow[],
  personId: string | null | undefined,
  date: string,
  employeeId?: number | null
): { blocked: boolean; reason?: string } {
  if (!personId && !employeeId) return { blocked: false };
  const hit = staffOnLeave(windows, {
    date,
    personId: personId || null,
    employeeId: employeeId || null,
  });
  if (!hit) return { blocked: false };
  const reason = hit.reason || hit.leave_type || 'leave';
  return {
    blocked: true,
    reason: `On leave ${hit.start_date}–${hit.end_date} (${reason})`,
  };
}

export function windowsFromHrRequests(
  rows: Array<{
    id?: number;
    employee_id: number;
    start_date: string;
    end_date: string;
    status?: string;
    reason?: string | null;
    leave_type_code?: string | null;
  }>,
  employees?: Array<{
    id: number;
    metadata?: Record<string, unknown> | null;
  }>
): LeaveWindow[] {
  const byEmp = new Map(
    (employees || []).map((e) => [Number(e.id), e.metadata || {}])
  );
  return (rows || []).map((r) => {
    const meta = byEmp.get(Number(r.employee_id)) || {};
    return {
      id: r.id,
      employee_id: Number(r.employee_id),
      person_id: meta.service_person_id ? String(meta.service_person_id) : null,
      module: meta.service_module ? String(meta.service_module) : null,
      start_date: isoDate(r.start_date),
      end_date: isoDate(r.end_date),
      status: String(r.status || 'pending'),
      reason: r.reason || null,
      leave_type: r.leave_type_code || null,
    };
  });
}

const META_KEY = 'core_os_leave_blocks';

export function readLeaveBlocksFromMeta(
  metadata: Record<string, unknown> | null | undefined
): LeaveWindow[] {
  const raw = metadata?.[META_KEY];
  if (!Array.isArray(raw)) return [];
  return raw as LeaveWindow[];
}

export function writeLeaveBlocksToMeta(
  metadata: Record<string, unknown>,
  windows: LeaveWindow[]
): Record<string, unknown> {
  return { ...metadata, [META_KEY]: windows };
}

export function upsertLeaveBlock(
  windows: LeaveWindow[],
  next: LeaveWindow
): LeaveWindow[] {
  const key = String(next.id ?? `${next.employee_id}:${next.start_date}`);
  const rest = windows.filter(
    (w) => String(w.id ?? `${w.employee_id}:${w.start_date}`) !== key
  );
  return [...rest, next];
}
