/**
 * Soft in-app notifications for multi-party order chains.
 * Never blocks the primary write path.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { customerVisibleProductionStatus } from './order-links';

export async function notifyProductionCascade(
  supabase: SupabaseClient,
  opts: {
    buyerCompanyId: number;
    poId: number;
    soIds: number[];
    productionStatus?: string | null;
    actorCompanyId: number;
    isSupplier: boolean;
  }
): Promise<void> {
  try {
    const label = customerVisibleProductionStatus(opts.productionStatus);
    // Notify BFF ops when manufacturer updates
    if (opts.isSupplier && opts.buyerCompanyId !== opts.actorCompanyId) {
      await supabase.from('notifications').insert({
        profile_id: opts.buyerCompanyId,
        type: 'production_status_cascade',
        title: `Production update on PO #${opts.poId}`,
        body: `Manufacturer set status to “${label}”${
          opts.soIds.length
            ? ` · cascaded to ${opts.soIds.length} sales order(s)`
            : ''
        }`,
        metadata: {
          poId: opts.poId,
          soIds: opts.soIds,
          production_status: opts.productionStatus,
          href: `/dashboard/operations/chains`,
        },
        read: false,
      });
    }

    // Customer-safe: if SO has a linked customer profile, soft notify
    if (!opts.soIds.length) return;
    const { data: sos } = await supabase
      .from('sales_orders')
      .select('id, order_number, customer_id')
      .eq('profile_id', opts.buyerCompanyId)
      .in('id', opts.soIds);

    for (const so of sos || []) {
      const custId = Number(so.customer_id);
      if (!Number.isFinite(custId) || custId <= 0) continue;
      const { data: cust } = await supabase
        .from('customers')
        .select('linked_profile_id')
        .eq('id', custId)
        .maybeSingle();
      const linked = Number(cust?.linked_profile_id);
      if (Number.isFinite(linked) && linked > 0) {
        await supabase.from('notifications').insert({
          profile_id: linked,
          type: 'order_production_update',
          title: `Order ${so.order_number || so.id} update`,
          body: `Status: ${label}`,
          metadata: {
            salesOrderId: so.id,
            production_status: opts.productionStatus,
            href: `/dashboard/buyer/documents`,
          },
          read: false,
        });
      }

      const { data: viewers } = await supabase
        .from('trade_portal_viewers')
        .select('id, portal_id')
        .eq('profile_id', opts.buyerCompanyId)
        .eq('customer_id', custId)
        .eq('status', 'active')
        .limit(8);
      const seenPortals = new Set<number>();
      for (const v of viewers || []) {
        const pid = Number(v.portal_id);
        if (!pid || seenPortals.has(pid)) continue;
        seenPortals.add(pid);
        await supabase.from('trade_portal_messages').insert({
          portal_id: pid,
          viewer_id: v.id,
          profile_id: opts.buyerCompanyId,
          author: 'host',
          body: `Order ${so.order_number || so.id}: ${label}. Track it under Sales orders.`,
        });
      }
    }
  } catch (e) {
    console.warn('[notify-chain] production cascade soft-fail', e);
  }
}

export async function notifyLinkedPoCreated(
  supabase: SupabaseClient,
  opts: {
    companyId: number;
    poId: number;
    salesOrderId: number;
    orderNumber?: string | null;
    supplierProfileId?: number | null;
    sent: boolean;
  }
): Promise<void> {
  try {
    await supabase.from('notifications').insert({
      profile_id: opts.companyId,
      type: 'linked_po_created',
      title: opts.sent
        ? `Linked PO #${opts.poId} sent`
        : `Linked PO #${opts.poId} drafted`,
      body: `From SO ${opts.orderNumber || opts.salesOrderId}`,
      metadata: {
        poId: opts.poId,
        salesOrderId: opts.salesOrderId,
        href: `/dashboard/operations/chains`,
      },
      read: false,
    });
  } catch (e) {
    console.warn('[notify-chain] linked po soft-fail', e);
  }
}
