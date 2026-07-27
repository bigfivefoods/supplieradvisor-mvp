/**
 * School RIAD categories — risks, issues, actions, decisions for education & NSNP.
 */

export const SCHOOL_RIAD_TYPES = [
  { value: 'risk', label: 'Risk', short: 'R' },
  { value: 'issue', label: 'Issue', short: 'I' },
  { value: 'action', label: 'Action', short: 'A' },
  { value: 'decision', label: 'Decision', short: 'D' },
] as const;

export const SCHOOL_RIAD_CATEGORIES = [
  'Kitchen & food safety',
  'NSNP delivery / stock',
  'Learner wellbeing',
  'Staffing & teachers',
  'Facilities & buildings',
  'Water & sanitation',
  'Safety & security',
  'Finance & funding',
  'Compliance / PEU',
  'Community & parents',
  'Curriculum & learning',
  'Other',
] as const;

/** Categories when DBE raises a RIAD against a service provider */
export const SP_RIAD_CATEGORIES = [
  'NSNP delivery / OTIF',
  'Food safety & quality',
  'Approved brand / catalogue',
  'POD & documentation',
  'Pricing & claims',
  'CSD / compliance',
  'Cluster / district allocation',
  'Contract / SLA breach',
  'Communication',
  'Other',
] as const;

export type RiadTargetType = 'school' | 'isp' | 'self';

export const RIAD_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

export const RIAD_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'closed', label: 'Closed' },
  { value: 'resolved', label: 'Resolved' },
] as const;

export type SchoolRiadRecord = {
  id: number;
  entry_type?: string;
  riad_type?: string;
  title: string;
  description?: string | null;
  status?: string | null;
  severity?: string | null;
  priority?: string | null;
  category?: string | null;
  owner_name?: string | null;
  due_date?: string | null;
  mitigation_plan?: string | null;
  notes?: string | null;
  resolution?: string | null;
  module?: string | null;
  created_at?: string | null;
};

export function isClosedLike(status?: string | null) {
  const s = String(status || '').toLowerCase();
  return ['closed', 'resolved', 'done', 'cancelled'].includes(s);
}

/** DB stores "active" for UI "open" (legacy riad_logs_status_check). */
export function isOpenLike(status?: string | null) {
  const s = String(status || '').toLowerCase();
  if (isClosedLike(s)) return false;
  return ['open', 'active', 'new', 'logged', 'pending', ''].includes(s);
}

export function priorityClass(p?: string | null) {
  const s = String(p || 'medium').toLowerCase();
  if (s === 'critical') return 'bg-rose-100 text-rose-900 border-rose-200';
  if (s === 'high') return 'bg-orange-100 text-orange-900 border-orange-200';
  if (s === 'low') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-amber-100 text-amber-900 border-amber-200';
}

export function statusClass(st?: string | null) {
  const s = String(st || 'open').toLowerCase();
  if (isClosedLike(s)) return 'bg-emerald-100 text-emerald-900 border-emerald-200';
  if (s === 'in_progress') return 'bg-sky-100 text-sky-900 border-sky-200';
  if (s === 'on_hold') return 'bg-violet-100 text-violet-900 border-violet-200';
  return 'bg-amber-50 text-amber-900 border-amber-200';
}
