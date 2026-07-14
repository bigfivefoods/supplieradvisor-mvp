/**
 * Reseller field RIAD helpers — shared types, categories, scoring.
 */

import {
  computeRpn,
  isOpenStatus,
  priorityClass,
  rpnBand,
  statusClass,
  RIAD_PRIORITIES,
  RIAD_STATUSES,
  RIAD_TYPES,
  type RiadPriority,
  type RiadStatus,
  type RiadType,
} from '@/lib/containers/riad';

export {
  computeRpn,
  isOpenStatus,
  priorityClass,
  rpnBand,
  statusClass,
  RIAD_PRIORITIES,
  RIAD_STATUSES,
  RIAD_TYPES,
};
export type { RiadPriority, RiadStatus, RiadType };

export type ResellerRiadRecord = {
  id: number;
  profile_id?: number | null;
  reseller_id: number;
  container_id?: number | null;
  product_id?: number | null;
  product_name?: string | null;
  sku?: string | null;
  riad_type: RiadType | string;
  title: string;
  description?: string | null;
  status: string;
  priority?: string | null;
  category?: string | null;
  owner_name?: string | null;
  severity?: number | null;
  likelihood?: number | null;
  time_horizon?: number | null;
  rpn?: number | null;
  mitigation_plan?: string | null;
  resolution?: string | null;
  notes?: string | null;
  due_date?: string | null;
  closed_at?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
  /** joined */
  reseller_name?: string | null;
};

export const RESELLER_RIAD_CATEGORIES = [
  'Product quality',
  'Pricing / value',
  'Packaging',
  'Stock shortage',
  'Damaged goods',
  'Customer complaint',
  'Safety',
  'Security / theft',
  'Payment / cash',
  'Competitor',
  'Logistics / delivery',
  'Brand perception',
  'Other',
] as const;

export function summarizeRiad(items: ResellerRiadRecord[]) {
  const norm = (s?: string | null) => String(s || 'open').toLowerCase();
  const open = items.filter((i) => isOpenStatus(i.status)).length;
  const closed = items.filter((i) =>
    ['closed', 'resolved'].includes(norm(i.status))
  ).length;
  const critical = items.filter(
    (i) =>
      isOpenStatus(i.status) &&
      (norm(i.priority) === 'critical' ||
        (i.rpn != null && Number(i.rpn) >= 75))
  ).length;
  const byType: Record<string, number> = {};
  for (const i of items) {
    const t = norm(i.riad_type) || 'issue';
    byType[t] = (byType[t] || 0) + 1;
  }
  return {
    total: items.length,
    open,
    closed,
    critical,
    byType,
  };
}
