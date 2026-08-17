/**
 * Workforce book: permanent employees + Advisor contractors.
 */
import { DIARY_HREF, MODULE_LABEL } from './kinds';
import { mergeIdentity, type IdentityLinks } from './identity';
import { staffOnLeave, type LeaveWindow } from './leave';

export type WorkforceKind = 'employee' | 'contractor';

export type LooseStaff = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  hr_employee_id?: number | null;
  platform_user_id?: string | null;
  employment_type?: string | null;
  engagement?: string | null;
  rate_zar?: number | null;
  rate_basis?: string | null;
  active?: boolean;
};

export type People360 = {
  employee_id: number | null;
  name: string;
  workforce: WorkforceKind;
  source_label: string | null;
  source_module: string | null;
  diary_href: string | null;
  identity: IdentityLinks;
  rate_zar: number | null;
  rate_basis: string | null;
  on_leave: boolean;
  leave?: LeaveWindow | null;
};

export function isContractorType(raw?: string | null): boolean {
  const t = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  return (
    t === 'contractor' ||
    t === 'contract' ||
    t === 'temporary' ||
    t === 'casual' ||
    t === 'intern' ||
    t === 'independent' ||
    t === 'freelance'
  );
}

/** People directory accepts permanent + Advisor contractors (not gangs). */
export function toWorkforceEmploymentType(
  raw?: string | null
): 'full_time' | 'part_time' | 'contract' | null {
  const t = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  if (!t) return null;
  if (t === 'part_time' || t === 'parttime') return 'part_time';
  if (
    t === 'permanent' ||
    t === 'full_time' ||
    t === 'fulltime' ||
    t === 'indefinite' ||
    t === 'employed' ||
    t === 'staff'
  ) {
    return 'full_time';
  }
  if (isContractorType(t)) return 'contract';
  return null;
}

export function resolveWorkforceEmployment(
  source: string,
  raw?: string | null
): 'full_time' | 'part_time' | 'contract' | null {
  const mapped = toWorkforceEmploymentType(raw);
  if (mapped) return mapped;
  if (source === 'fieldgraph_gang' || source === 'quarrygraph_crew') {
    return null;
  }
  return 'contract';
}

export function workforceKindOf(
  employmentType?: string | null
): WorkforceKind {
  return employmentType === 'contract' || isContractorType(employmentType)
    ? 'contractor'
    : 'employee';
}

export function assemblePeople360(opts: {
  employee?: {
    id: number;
    full_name: string;
    email?: string | null;
    employment_type?: string | null;
    hourly_rate?: number | null;
    metadata?: Record<string, unknown> | null;
  } | null;
  staff?: LooseStaff | null;
  module?: string | null;
  leave?: LeaveWindow[];
  today?: string;
}): People360 {
  const emp = opts.employee || null;
  const staff = opts.staff || null;
  const meta = emp?.metadata || {};
  const module =
    opts.module ||
    (meta.service_module ? String(meta.service_module) : null) ||
    null;
  const personId =
    staff?.id ||
    (meta.service_person_id ? String(meta.service_person_id) : null);
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const leaveHit = staffOnLeave(opts.leave || [], {
    date: today,
    employeeId: emp?.id || null,
    personId,
    module,
  });
  const employment =
    emp?.employment_type ||
    (staff ? resolveWorkforceEmployment(module || '', staff.employment_type || staff.engagement) : 'full_time');

  return {
    employee_id: emp?.id ?? staff?.hr_employee_id ?? null,
    name: emp?.full_name || staff?.name || 'Staff',
    workforce: workforceKindOf(employment),
    source_label:
      (meta.service_source_label as string) ||
      (module ? MODULE_LABEL[module] || module : null),
    source_module: module,
    diary_href: module ? DIARY_HREF[module] || null : null,
    identity: mergeIdentity({
      hr_employee_id: emp?.id ?? staff?.hr_employee_id ?? null,
      email: emp?.email || staff?.email,
      advisor_person_id: personId,
      advisor_module: module,
      platform_user_id: staff?.platform_user_id,
    }),
    rate_zar: staff?.rate_zar ?? emp?.hourly_rate ?? null,
    rate_basis: staff?.rate_basis || (emp?.hourly_rate ? 'hourly' : null),
    on_leave: Boolean(leaveHit),
    leave: leaveHit,
  };
}

export function unsyncedAdvisorStaff(
  staff: Array<LooseStaff & { module: string }>,
  employees: Array<{ metadata?: Record<string, unknown> | null; email?: string | null }>
): Array<LooseStaff & { module: string }> {
  return staff.filter((s) => {
    if (s.hr_employee_id) return false;
    const key = `${s.module.includes('fit') ? 'fitgraph_coach' : s.module}:${s.id}`;
    return !employees.some((e) => {
      const meta = e.metadata || {};
      if (String(meta.service_person_id || '') === s.id) return true;
      if (String(meta.service_person_key || '').endsWith(`:${s.id}`)) return true;
      if (s.email && e.email && s.email.toLowerCase() === e.email.toLowerCase()) {
        return true;
      }
      return String(meta.service_person_key || '') === key;
    });
  });
}

export function sessionPayLines(opts: {
  staff: Array<{
    id: string;
    name: string;
    rate_zar?: number | null;
    rate_basis?: string | null;
    hr_employee_id?: number | null;
  }>;
  sessions: Array<{
    id: string;
    coach_id?: string | null;
    practitioner_id?: string | null;
    date: string;
    status?: string;
    duration_min?: number | null;
  }>;
  from: string;
  to: string;
}): Array<{
  person_id: string;
  name: string;
  employee_id: number | null;
  sessions: number;
  hours: number;
  rate_zar: number;
  basis: string;
  amount_zar: number;
}> {
  const out: Array<{
    person_id: string;
    name: string;
    employee_id: number | null;
    sessions: number;
    hours: number;
    rate_zar: number;
    basis: string;
    amount_zar: number;
  }> = [];
  for (const p of opts.staff) {
    const mine = opts.sessions.filter((s) => {
      if (s.status === 'cancelled') return false;
      if (s.date < opts.from || s.date > opts.to) return false;
      return s.coach_id === p.id || s.practitioner_id === p.id;
    });
    if (!mine.length) continue;
    const rate = Number(p.rate_zar || 0);
    const basis = String(p.rate_basis || 'per_class');
    const hours = mine.reduce((n, s) => n + Number(s.duration_min || 60) / 60, 0);
    let amount = 0;
    if (basis === 'hourly') amount = rate * hours;
    else if (basis === 'monthly' || basis === 'fixed') amount = rate;
    else amount = rate * mine.length;
    out.push({
      person_id: p.id,
      name: p.name,
      employee_id: p.hr_employee_id ?? null,
      sessions: mine.length,
      hours: Math.round(hours * 100) / 100,
      rate_zar: rate,
      basis,
      amount_zar: Math.round(amount * 100) / 100,
    });
  }
  return out;
}

