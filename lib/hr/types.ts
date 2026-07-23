/**
 * HR / People module types — employees, allocations, leave, payroll.
 */

export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'temporary'
  | 'intern'
  | 'casual';

export type EmployeeStatus =
  | 'active'
  | 'on_leave'
  | 'probation'
  | 'suspended'
  | 'terminated'
  | 'draft';

export type PayFrequency = 'monthly' | 'biweekly' | 'weekly' | 'hourly';

export type LeaveRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type PayrollRunStatus =
  | 'draft'
  | 'calculated'
  | 'approved'
  | 'paid'
  | 'void';

export type PerformanceRating =
  | 'exceeds'
  | 'meets'
  | 'developing'
  | 'needs_improvement';

export const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: 'full_time', label: 'Full time' },
  { value: 'part_time', label: 'Part time' },
  { value: 'contract', label: 'Contract' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'intern', label: 'Intern' },
  { value: 'casual', label: 'Casual' },
];

export const EMPLOYEE_STATUSES: { value: EmployeeStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'probation', label: 'Probation' },
  { value: 'on_leave', label: 'On leave' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'draft', label: 'Draft' },
];

export const PAY_FREQUENCIES: { value: PayFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'hourly', label: 'Hourly' },
];

export type HrEmployee = {
  id: number;
  profile_id?: number | null;
  employee_number?: string | null;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
  email?: string | null;
  work_email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  job_title?: string | null;
  department?: string | null;
  employment_type?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  probation_end_date?: string | null;
  manager_id?: number | null;
  business_unit_id?: number | null;
  work_center_id?: number | null;
  work_station_id?: number | null;
  asset_id?: number | null;
  salary_basic?: number | null;
  salary_currency?: string | null;
  pay_frequency?: string | null;
  hourly_rate?: number | null;
  tax_number?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_branch_code?: string | null;
  leave_balance_days?: number | null;
  sick_balance_days?: number | null;
  onboarding_status?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

/** Simple SA-style proxies for demo payroll (not tax advice). */
export function estimatePayeMonthly(gross: number): number {
  const g = Math.max(0, Number(gross) || 0);
  // Flat proxy bands — real PAYE needs SARS tables + rebates
  if (g <= 0) return 0;
  if (g <= 7000) return Math.round(g * 0.1 * 100) / 100;
  if (g <= 15000) return Math.round(g * 0.18 * 100) / 100;
  if (g <= 30000) return Math.round(g * 0.26 * 100) / 100;
  if (g <= 50000) return Math.round(g * 0.31 * 100) / 100;
  return Math.round(g * 0.36 * 100) / 100;
}

/** UIF employee 1% capped (proxy monthly). */
export function estimateUifEmployee(gross: number): number {
  const g = Math.max(0, Number(gross) || 0);
  const cap = 177.12; // illustrative monthly cap
  return Math.min(cap, Math.round(g * 0.01 * 100) / 100);
}

export function estimateUifEmployer(gross: number): number {
  return estimateUifEmployee(gross);
}

export function monthlyBasicFromEmployee(emp: {
  salary_basic?: number | null;
  hourly_rate?: number | null;
  pay_frequency?: string | null;
}): number {
  const freq = String(emp.pay_frequency || 'monthly').toLowerCase();
  const basic = Number(emp.salary_basic || 0);
  const hourly = Number(emp.hourly_rate || 0);
  if (freq === 'hourly' && hourly > 0) {
    return Math.round(hourly * 160 * 100) / 100; // ~160h month proxy
  }
  if (freq === 'weekly' && basic > 0) {
    return Math.round(basic * 4.333 * 100) / 100;
  }
  if (freq === 'biweekly' && basic > 0) {
    return Math.round(basic * 2.167 * 100) / 100;
  }
  return Math.round(basic * 100) / 100;
}

export function computePayslipLine(opts: {
  basic: number;
  allowances?: number;
  overtime?: number;
  otherDeductions?: number;
}): {
  gross_pay: number;
  paye: number;
  uif_employee: number;
  uif_employer: number;
  total_deductions: number;
  net_pay: number;
  employer_cost: number;
} {
  const basic = Math.max(0, Number(opts.basic) || 0);
  const allowances = Math.max(0, Number(opts.allowances) || 0);
  const overtime = Math.max(0, Number(opts.overtime) || 0);
  const other = Math.max(0, Number(opts.otherDeductions) || 0);
  const gross = Math.round((basic + allowances + overtime) * 100) / 100;
  const paye = estimatePayeMonthly(gross);
  const uifE = estimateUifEmployee(gross);
  const uifR = estimateUifEmployer(gross);
  const totalDed =
    Math.round((paye + uifE + other) * 100) / 100;
  const net = Math.round((gross - totalDed) * 100) / 100;
  const employer = Math.round((gross + uifR) * 100) / 100;
  return {
    gross_pay: gross,
    paye,
    uif_employee: uifE,
    uif_employer: uifR,
    total_deductions: totalDed,
    net_pay: Math.max(0, net),
    employer_cost: employer,
  };
}

export function fullNameFromParts(opts: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
}): string {
  if (opts.full_name && String(opts.full_name).trim()) {
    return String(opts.full_name).trim();
  }
  const parts = [opts.first_name, opts.last_name]
    .map((p) => (p ? String(p).trim() : ''))
    .filter(Boolean);
  if (parts.length) return parts.join(' ');
  if (opts.preferred_name) return String(opts.preferred_name).trim();
  return 'Unnamed employee';
}

export function defaultOnboardingChecklist(): Array<{
  id: string;
  label: string;
  done: boolean;
}> {
  return [
    { id: 'contract', label: 'Signed employment contract', done: false },
    { id: 'id', label: 'ID / passport on file', done: false },
    { id: 'bank', label: 'Banking details verified', done: false },
    { id: 'tax', label: 'Tax number captured', done: false },
    { id: 'induction', label: 'Safety / SHEQ induction', done: false },
    { id: 'system', label: 'System access provisioned', done: false },
    { id: 'buddy', label: 'Buddy / manager assigned', done: false },
  ];
}

export function statusBadgeClass(status?: string | null): string {
  const s = String(status || '').toLowerCase();
  if (s === 'active') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (s === 'probation') return 'bg-sky-50 text-sky-800 border-sky-200';
  if (s === 'on_leave') return 'bg-amber-50 text-amber-900 border-amber-200';
  if (s === 'suspended') return 'bg-orange-50 text-orange-900 border-orange-200';
  if (s === 'terminated') return 'bg-slate-100 text-slate-600 border-slate-200';
  if (s === 'approved' || s === 'paid' || s === 'complete') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
  if (s === 'pending' || s === 'draft' || s === 'calculated') {
    return 'bg-amber-50 text-amber-900 border-amber-200';
  }
  if (s === 'rejected' || s === 'void') {
    return 'bg-rose-50 text-rose-800 border-rose-200';
  }
  return 'bg-slate-50 text-slate-700 border-slate-200';
}
