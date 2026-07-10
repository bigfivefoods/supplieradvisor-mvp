/**
 * Supplier RIAD — same vocabulary as customer/container RIAD,
 * scoped to supplier relationships (SRM).
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

export type SupplierRiadRecord = {
  id: number;
  profile_id?: number | null;
  supplier_id?: number | null;
  entry_type: string;
  title: string;
  description?: string | null;
  status: string;
  severity?: string | null;
  owner_name?: string | null;
  due_date?: string | null;
  closed_at?: string | null;
  related_po_id?: number | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  resolution?: string | null;
  category?: string | null;
  mitigation_plan?: string | null;
  notes?: string | null;
  /** joined from srm_suppliers */
  supplier_name?: string | null;
};

/** SRM-oriented categories (parallel to customer CRM categories). */
export const SUPPLIER_RIAD_CATEGORIES = [
  'Supply continuity',
  'Delivery / OTIF',
  'Product quality',
  'Pricing / commercial',
  'Capacity / allocation',
  'Single-source risk',
  'Contract / SLA',
  'Compliance / certs',
  'ESG / sustainability',
  'Relationship / service',
  'Payment / commercial terms',
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
