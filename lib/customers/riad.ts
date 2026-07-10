/**
 * Customer RIAD — same vocabulary and presentation helpers as container RIAD,
 * scoped to customer relationships (CRM) rather than container outlets.
 */
export type {
  RiadType,
  RiadStatus,
  RiadPriority,
} from '@/lib/containers/riad';

export {
  RIAD_TYPES,
  RIAD_STATUSES,
  RIAD_PRIORITIES,
  priorityClass,
  statusClass,
  isOpenStatus,
  rpnBand,
  computeRpn,
} from '@/lib/containers/riad';

export type CustomerRiadRecord = {
  id: number;
  profile_id?: number | null;
  customer_id?: number | null;
  entry_type: string;
  title: string;
  description?: string | null;
  status: string;
  /** Stored as text low|medium|high|critical (maps to UI priority) */
  severity?: string | null;
  owner_name?: string | null;
  due_date?: string | null;
  closed_at?: string | null;
  related_order_id?: number | null;
  related_claim_id?: number | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  resolution?: string | null;
  category?: string | null;
  mitigation_plan?: string | null;
  notes?: string | null;
  /** joined */
  customer_name?: string | null;
};

/** CRM-oriented categories (parallel to container outlet categories). */
export const CUSTOMER_RIAD_CATEGORIES = [
  'Credit / payment',
  'Delivery / OTIF',
  'Product quality',
  'Pricing / commercial',
  'Contract / SLA',
  'Relationship / service',
  'Churn / retention',
  'Claims / disputes',
  'Compliance',
  'Onboarding',
  'Other',
] as const;

export function isOpenLike(s?: string | null) {
  const v = String(s || 'open').toLowerCase();
  return ['open', 'active', 'in_progress', 'on_hold', 'mitigated'].includes(v);
}

export function isClosedLike(s?: string | null) {
  const v = String(s || '').toLowerCase();
  return v === 'closed' || v === 'resolved';
}
