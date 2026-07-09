export type RiadType = 'risk' | 'issue' | 'action' | 'decision';
export type RiadStatus = 'open' | 'in_progress' | 'mitigated' | 'resolved' | 'closed' | 'on_hold' | 'active';
export type RiadPriority = 'low' | 'medium' | 'high' | 'critical';

export type RiadRecord = {
  id: number;
  profile_id?: number | null;
  container_id?: number | null;
  contractor_id?: number | null;
  module?: string | null;
  source?: string | null;
  riad_type: RiadType | string;
  title: string;
  description?: string | null;
  status: string;
  priority?: string | null;
  category?: string | null;
  owner_name?: string | null;
  owner_id?: number | null;
  stakeholder_type?: string | null;
  stakeholder_id?: number | null;
  stakeholder_name?: string | null;
  severity?: number | null;
  likelihood?: number | null;
  time_horizon?: number | null;
  rpn?: number | null;
  residual_rpn?: number | null;
  mitigation_plan?: string | null;
  logged_date?: string | null;
  due_date?: string | null;
  closed_at?: string | null;
  image_url?: string | null;
  tags?: string[] | null;
  created_by?: string | null;
  created_by_name?: string | null;
  notes?: string | null;
  resolution?: string | null;
  created_at?: string;
  updated_at?: string;
  /** joined */
  container_name?: string | null;
  container_code?: string | null;
};

export const RIAD_TYPES: { key: RiadType; label: string; plural: string; color: string }[] = [
  { key: 'risk', label: 'Risk', plural: 'Risks', color: 'rose' },
  { key: 'issue', label: 'Issue', plural: 'Issues', color: 'amber' },
  { key: 'action', label: 'Action', plural: 'Actions', color: 'sky' },
  { key: 'decision', label: 'Decision', plural: 'Decisions', color: 'violet' },
];

export const RIAD_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'mitigated', label: 'Mitigated' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'on_hold', label: 'On hold' },
] as const;

export const RIAD_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

export const CONTAINER_RIAD_CATEGORIES = [
  'Safety',
  'Security',
  'Inventory',
  'Cash / sales',
  'Stock loss',
  'Maintenance',
  'Power / utilities',
  'Contractor ops',
  'Customer complaint',
  'Compliance',
  'Other',
];

export function computeRpn(severity: number, likelihood: number, timeHorizon: number) {
  return severity * likelihood * timeHorizon;
}

export function rpnBand(rpn: number) {
  if (rpn >= 75) return { label: 'Critical', className: 'bg-red-600 text-white' };
  if (rpn >= 50) return { label: 'High', className: 'bg-orange-500 text-white' };
  if (rpn >= 25) return { label: 'Medium', className: 'bg-amber-400 text-slate-900' };
  return { label: 'Low', className: 'bg-emerald-500 text-white' };
}

export function priorityClass(p?: string | null) {
  switch ((p || '').toLowerCase()) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    default:
      return 'bg-neutral-100 text-neutral-700 border-neutral-200';
  }
}

export function statusClass(s?: string | null) {
  switch ((s || '').toLowerCase()) {
    case 'open':
    case 'active':
      return 'bg-sky-100 text-sky-800';
    case 'in_progress':
      return 'bg-indigo-100 text-indigo-800';
    case 'mitigated':
    case 'resolved':
      return 'bg-emerald-100 text-emerald-800';
    case 'closed':
      return 'bg-neutral-200 text-neutral-700';
    case 'on_hold':
      return 'bg-amber-100 text-amber-900';
    default:
      return 'bg-neutral-100 text-neutral-600';
  }
}

export function isOpenStatus(s?: string | null) {
  const v = (s || '').toLowerCase();
  return v === 'open' || v === 'active' || v === 'in_progress' || v === 'on_hold' || v === 'mitigated';
}
