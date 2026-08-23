/**
 * Cascade helpers: push non-commercial production fields from a PO
 * to all actively linked sales orders.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CASCADE_SAFE_FIELDS,
  cascadeSourceTag,
  type ProductionStatus,
} from './order-links';

export interface CascadePayload {
  production_status?: ProductionStatus | string | null;
  confirmed_qty?: number | null;
  promised_date?: string | null;
  actual_completion_date?: string | null;
}

export interface CascadeResult {
  linkedSoIds: number[];
  updated: number;
  errors: string[];
}

/**
 * Find active fulfillment links where this PO is the target,
 * then update cascade-safe fields on each linked sales_order.
 */
export async function cascadeFromPo(
  supabase: SupabaseClient,
  companyId: number,
  poId: number,
  payload: CascadePayload
): Promise<CascadeResult> {
  const result: CascadeResult = { linkedSoIds: [], updated: 0, errors: [] };

  const { data: links, error: linkErr } = await supabase
    .from('order_links')
    .select('id, source_order_id, source_order_type')
    .eq('company_id', companyId)
    .eq('target_order_id', poId)
    .eq('target_order_type', 'purchase_order')
    .eq('status', 'active');

  if (linkErr) {
    result.errors.push(linkErr.message);
    return result;
  }

  if (!links?.length) return result;

  const soIds = links
    .filter((l) => l.source_order_type === 'sales_order')
    .map((l) => Number(l.source_order_id))
    .filter(Boolean);

  result.linkedSoIds = soIds;
  if (!soIds.length) return result;

  const update: Record<string, unknown> = {
    cascade_updated_at: new Date().toISOString(),
    cascade_source: cascadeSourceTag('purchase_order', poId),
    updated_at: new Date().toISOString(),
  };

  for (const field of CASCADE_SAFE_FIELDS) {
    if (field in payload && payload[field as keyof CascadePayload] !== undefined) {
      update[field] = payload[field as keyof CascadePayload];
    }
  }

  // Also map production_status onto SO status when completed (soft signal only)
  if (payload.production_status === 'completed') {
    // Do not force SO status overwrite if already fulfilled/invoiced — only set processing-ish
    // Callers can decide; here we only touch cascade fields.
  }

  const { error: upErr, count } = await supabase
    .from('sales_orders')
    .update(update)
    .eq('profile_id', companyId)
    .in('id', soIds);

  if (upErr) {
    result.errors.push(upErr.message);
  } else {
    result.updated = count ?? soIds.length;
  }

  return result;
}
