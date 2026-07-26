/**
 * NSNP delivery lifecycle — ISP supplies, school receives, both attach docs.
 */

export const DELIVERY_STATUSES = [
  { value: 'draft', label: 'Draft', role: 'isp' },
  { value: 'confirmed', label: 'Confirmed', role: 'isp' },
  { value: 'dispatched', label: 'On the way', role: 'isp' },
  { value: 'delivered', label: 'Delivered (ISP)', role: 'isp' },
  { value: 'received', label: 'Received (school)', role: 'school' },
  { value: 'disputed', label: 'Disputed', role: 'school' },
  { value: 'cancelled', label: 'Cancelled', role: 'both' },
] as const;

export const FILE_KINDS = [
  { value: 'pod', label: 'Proof of delivery (POD)' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'packing_list', label: 'Packing list' },
  { value: 'photo', label: 'Photo' },
  { value: 'credit_note', label: 'Credit note' },
  { value: 'other', label: 'Other' },
] as const;

export type DeliveryLine = {
  approved_product_id?: number | null;
  product_name: string;
  brand_name: string;
  qty_ordered?: number;
  qty_delivered?: number;
  qty_received?: number;
  uom?: string;
};

export function deliveryStatusClass(status?: string | null) {
  const s = String(status || 'draft').toLowerCase();
  if (s === 'received') return 'bg-emerald-100 text-emerald-900 border-emerald-200';
  if (s === 'delivered' || s === 'dispatched')
    return 'bg-sky-100 text-sky-900 border-sky-200';
  if (s === 'disputed') return 'bg-rose-100 text-rose-900 border-rose-200';
  if (s === 'cancelled') return 'bg-slate-100 text-slate-600 border-slate-200';
  if (s === 'confirmed') return 'bg-violet-100 text-violet-900 border-violet-200';
  return 'bg-amber-50 text-amber-900 border-amber-200';
}

export function fileKindLabel(kind?: string | null) {
  const k = FILE_KINDS.find((f) => f.value === kind);
  return k?.label || kind || 'File';
}
