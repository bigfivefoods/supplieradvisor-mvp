/**
 * Soft in-app + email notifications for multi-party order chains.
 * Hub (middleman) is the only voice the customer and manufacturer hear.
 * Never blocks the primary write path.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { customerVisibleProductionStatus } from './order-links';
import {
  loadChainHubBrand,
  loadCustomerChainMail,
  loadSupplierChainMail,
} from './chain-mail';

export async function notifyProductionCascade(
  supabase: SupabaseClient,
  opts: {
    buyerCompanyId: number;
    poId: number;
    soIds: number[];
    productionStatus?: string | null;
    actorCompanyId: number;
    isSupplier: boolean;
    promisedDate?: string | null;
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
      .select('id, order_number, customer_id, promised_date')
      .eq('profile_id', opts.buyerCompanyId)
      .in('id', opts.soIds);

    const hub = await loadChainHubBrand(supabase, opts.buyerCompanyId);
    const emailedCustomers = new Set<number>();

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

      if (opts.productionStatus && !emailedCustomers.has(custId)) {
        emailedCustomers.add(custId);
        const mail = await loadCustomerChainMail(supabase, {
          hubCompanyId: opts.buyerCompanyId,
          customerId: custId,
        });
        if (mail.emails.length) {
          const { notifyChainProductionFromHub } = await import(
            '@/lib/notifications/email-alerts'
          );
          await notifyChainProductionFromHub({
            to: mail.emails,
            hubName: hub.name,
            hubLogoUrl: hub.logoUrl,
            orderNumber: String(so.order_number || `SO-${so.id}`),
            statusLabel: label,
            promisedDate:
              opts.promisedDate ||
              (so.promised_date != null ? String(so.promised_date) : null),
            portalUrl: mail.portalUrl,
          });
        }
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
    poNumber?: string | null;
    salesOrderId: number;
    orderNumber?: string | null;
    supplierProfileId?: number | null;
    srmSupplierId?: number | null;
    sent: boolean;
    totalAmount?: number | null;
    currency?: string | null;
    lineCount?: number;
    promisedDate?: string | null;
  }
): Promise<void> {
  try {
    const poLabel = opts.poNumber || `PO #${opts.poId}`;
    await supabase.from('notifications').insert({
      profile_id: opts.companyId,
      type: 'linked_po_created',
      title: opts.sent ? `Linked ${poLabel} sent` : `Linked ${poLabel} drafted`,
      body: `From SO ${opts.orderNumber || opts.salesOrderId}`,
      metadata: {
        poId: opts.poId,
        salesOrderId: opts.salesOrderId,
        href: `/dashboard/operations/chains`,
      },
      read: false,
    });

    if (!opts.sent) return;
    const hub = await loadChainHubBrand(supabase, opts.companyId);
    const mail = await loadSupplierChainMail(supabase, {
      hubCompanyId: opts.companyId,
      srmSupplierId: opts.srmSupplierId,
      supplierProfileId: opts.supplierProfileId,
    });
    if (!mail.emails.length) return;
    const { notifyChainPoFromHub } = await import(
      '@/lib/notifications/email-alerts'
    );
    await notifyChainPoFromHub({
      to: mail.emails,
      hubName: hub.name,
      hubLogoUrl: hub.logoUrl,
      poNumber: poLabel,
      poId: opts.poId,
      totalAmount: opts.totalAmount,
      currency: opts.currency,
      lineCount: opts.lineCount,
      promisedDate: opts.promisedDate,
      portalUrl: mail.portalUrl,
    });
  } catch (e) {
    console.warn('[notify-chain] linked po soft-fail', e);
  }
}
