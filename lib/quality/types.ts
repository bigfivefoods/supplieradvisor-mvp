export const INSPECTION_TYPES = [
  'incoming',
  'in_process',
  'outgoing',
  'hold_review',
  'other',
] as const;

export type InspectionType = (typeof INSPECTION_TYPES)[number];

export const INSPECTION_STATUSES = [
  'open',
  'passed',
  'failed',
  'conditional',
  'cancelled',
] as const;

export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export type QualityInspection = {
  id: number;
  profile_id: number;
  product_id?: number | null;
  lot_number?: string | null;
  warehouse_id?: number | null;
  purchase_order_id?: number | null;
  inspection_type: string;
  status: string;
  result_grade?: string | null;
  sample_size?: number | null;
  defects_found?: number | null;
  inspector_name?: string | null;
  notes?: string | null;
  checklist?: unknown;
  metadata?: Record<string, unknown> | null;
  inspected_at?: string | null;
  released_at?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  /** joined */
  product_name?: string | null;
};

export function inspectionStatusClass(status?: string | null): string {
  switch (String(status || '').toLowerCase()) {
    case 'passed':
      return 'bg-emerald-100 text-emerald-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'conditional':
      return 'bg-amber-100 text-amber-900';
    case 'cancelled':
      return 'bg-neutral-100 text-neutral-500';
    default:
      return 'bg-sky-100 text-sky-800';
  }
}

export function isInspectionType(v: unknown): v is InspectionType {
  return typeof v === 'string' && (INSPECTION_TYPES as readonly string[]).includes(v);
}

export function isInspectionStatus(v: unknown): v is InspectionStatus {
  return typeof v === 'string' && (INSPECTION_STATUSES as readonly string[]).includes(v);
}
