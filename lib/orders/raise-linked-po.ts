/**
 * Raise a manufacturer PO from a sales order and link them.
 * Used by the dashboard API and auto-called when a customer portal PO
 * becomes a sales order. Never copies customer sell prices onto the PO.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { docNumber } from '@/lib/customers/documents';
import { mapSoItemsToPoItems } from '@/lib/orders/map-so-to-po-items';
import { notifyLinkedPoCreated } from '@/lib/orders/notify-chain';
import { resolvePreferredSupplier } from '@/lib/orders/preferred-supplier';
import {
  groupSoItemsByChain,
  mapChainSetup,
  type OrderChainSetup,
} from '@/lib/orders/chain-setup';
import { isMissingRelation } from '@/lib/business/company-data';

export type RaiseLinkedPoInput = {
  supabase: SupabaseClient;
  companyId: number;
  salesOrderId: number;
  salesOrder?: Record<string, unknown> | null;
  status?: 'draft' | 'sent';
  createdBy: string;
  srmSupplierId?: number | null;
  supplierProfileId?: number | null;
  allowMultipleLinks?: boolean;
  promisedDate?: string | null;
  paymentTerms?: string | null;
  /** When splitting an SO across manufacturers, pass only this group's lines. */
  itemsOverride?: unknown;
  chainSetupId?: number | null;
};

export type RaiseLinkedPoResult = {
  ok: boolean;
  skipped?: boolean;
  code?: string;
  error?: string;
  purchaseOrder?: Record<string, unknown>;
  link?: Record<string, unknown> | null;
  preferredSource?: string | null;
  warning?: string;
};

function asObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

async function costByProductId(
  supabase: SupabaseClient,
  companyId: number,
  ids: number[]
): Promise<Record<number, number>> {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (!unique.length) return {};
  const { data } = await supabase
    .from('products')
    .select('id, cost_price')
    .eq('profile_id', companyId)
    .in('id', unique);
  const out: Record<number, number> = {};
  for (const row of data || []) {
    const id = Number(row.id);
    const cost = Number(row.cost_price);
    if (Number.isFinite(id) && Number.isFinite(cost) && cost > 0) out[id] = cost;
  }
  return out;
}

export async function raiseLinkedPoFromSo(
  input: RaiseLinkedPoInput
): Promise<RaiseLinkedPoResult> {
  const {
    supabase,
    companyId,
    salesOrderId,
    status = 'sent',
    createdBy,
  } = input;

  let so = input.salesOrder || null;
  if (!so) {
    const hit = await supabase
      .from('sales_orders')
      .select('*')
      .eq('id', salesOrderId)
      .eq('profile_id', companyId)
      .maybeSingle();
    so = hit.data as Record<string, unknown> | null;
  }
  if (!so) {
    return { ok: false, error: 'Sales order not found', code: 'SO_NOT_FOUND' };
  }

  if (input.allowMultipleLinks !== true) {
    const { data: existingLink } = await supabase
      .from('order_links')
      .select('id, target_order_id')
      .eq('company_id', companyId)
      .eq('source_order_id', salesOrderId)
      .eq('source_order_type', 'sales_order')
      .eq('target_order_type', 'purchase_order')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (existingLink?.id) {
      return {
        ok: true,
        skipped: true,
        code: 'ALREADY_LINKED',
        preferredSource: null,
        purchaseOrder: { id: existingLink.target_order_id },
      };
    }
  }

  let supplierProfileId = input.supplierProfileId
    ? Number(input.supplierProfileId)
    : null;
  let srmSupplierId = input.srmSupplierId ? Number(input.srmSupplierId) : null;
  let srmId: number | null = null;
  let bookOnlyName: string | null = null;
  let preferredSource: string | null = null;

  if (
    (!supplierProfileId || !Number.isFinite(supplierProfileId)) &&
    (!srmSupplierId || !Number.isFinite(srmSupplierId))
  ) {
    const preferred = await resolvePreferredSupplier(supabase, companyId, so);
    if (preferred.srmSupplierId || preferred.supplierProfileId) {
      srmSupplierId = preferred.srmSupplierId;
      supplierProfileId = preferred.supplierProfileId;
      bookOnlyName = preferred.tradingName;
      preferredSource = preferred.source;
    }
  }

  if (srmSupplierId && Number.isFinite(srmSupplierId)) {
    const { data: srm } = await supabase
      .from('srm_suppliers')
      .select('id, linked_profile_id, trading_name, status')
      .eq('id', srmSupplierId)
      .eq('profile_id', companyId)
      .maybeSingle();
    if (!srm) {
      return { ok: false, error: 'Supplier not found in your book', code: 'SUPPLIER_NOT_FOUND' };
    }
    if (srm.status === 'blocked') {
      return { ok: false, error: 'Supplier is blocked', code: 'SUPPLIER_BLOCKED' };
    }
    srmId = Number(srm.id);
    if (srm.linked_profile_id) supplierProfileId = Number(srm.linked_profile_id);
    bookOnlyName = srm.trading_name || bookOnlyName;
  }

  if ((!supplierProfileId || !Number.isFinite(supplierProfileId)) && !srmId) {
    return {
      ok: false,
      skipped: true,
      code: 'SUPPLIER_REQUIRED',
      error:
        'No manufacturer selected and no preferred supplier configured.',
    };
  }

  const soItems =
    input.itemsOverride !== undefined ? input.itemsOverride : so.items;
  const productIds: number[] = [];
  if (Array.isArray(soItems)) {
    for (const row of soItems) {
      const id = Number(asObject(row).product_id);
      if (Number.isFinite(id) && id > 0) productIds.push(id);
    }
  }
  const costs = await costByProductId(supabase, companyId, productIds);
  const mapped = mapSoItemsToPoItems(soItems, {
    copyPrices: false,
    priceByProductId: costs,
  });
  if ('error' in mapped) {
    return { ok: false, error: mapped.error, code: 'ITEMS' };
  }

  const orderQty = mapped.items.reduce((s, i) => s + Number(i.quantity || 0), 0);
  const now = new Date().toISOString();
  const soNumber = String(so.order_number || `#${salesOrderId}`);
  const soMeta = asObject(so.metadata);
  const { data: buyerProf } = await supabase
    .from('profiles')
    .select('trading_name')
    .eq('id', companyId)
    .maybeSingle();
  const buyerName = String(buyerProf?.trading_name || 'Buyer');
  const poNumber = docNumber('PO');
  const promised =
    input.promisedDate ||
    (so.promised_date != null ? String(so.promised_date).slice(0, 10) : null);

  const payload: Record<string, unknown> = {
    buyer_profile_id: companyId,
    supplier_profile_id: supplierProfileId,
    supplier_id: srmId || supplierProfileId,
    supplier_name: bookOnlyName || null,
    po_number: poNumber,
    order_number: poNumber,
    total_amount: mapped.total,
    subtotal: mapped.total,
    currency: so.currency || 'ZAR',
    description: `Manufacturing order for ${buyerName} · from ${soNumber}`,
    items: mapped.items,
    status,
    payment_terms: input.paymentTerms || so.payment_terms || null,
    promised_date: promised,
    order_quantity: orderQty,
    source: 'linked_so',
    production_status: null,
    confirmed_qty: null,
    payment_status: 'unpaid',
    amount_paid: 0,
    metadata: {
      linked_from_sales_order_id: salesOrderId,
      linked_from_order_number: so.order_number || null,
      source_customer_po_number: soMeta.customer_po_number || null,
      srm_supplier_id: srmId,
      book_only: !supplierProfileId,
      raise_linked_po: true,
      preferred_source: preferredSource,
      chain_setup_id: input.chainSetupId || null,
      hide_customer_commercial: true,
    },
    created_at: now,
    updated_at: now,
  };

  let poIns = await supabase.from('purchase_orders').insert(payload).select('*').single();
  if (poIns.error && /column|schema cache|does not exist/i.test(poIns.error.message)) {
    const soft = { ...payload };
    delete soft.po_number;
    delete soft.order_number;
    delete soft.production_status;
    delete soft.confirmed_qty;
    delete soft.payment_status;
    delete soft.amount_paid;
    delete soft.source;
    poIns = await supabase.from('purchase_orders').insert(soft).select('*').single();
  }
  if (poIns.error || !poIns.data) {
    return {
      ok: false,
      error: poIns.error?.message || 'Failed to create manufacturer PO',
      code: 'PO_INSERT',
    };
  }

  const po = poIns.data as Record<string, unknown>;
  const { data: link, error: linkErr } = await supabase
    .from('order_links')
    .insert({
      company_id: companyId,
      source_order_id: salesOrderId,
      source_order_type: 'sales_order',
      target_order_id: po.id,
      target_order_type: 'purchase_order',
      link_type: 'fulfillment',
      status: 'active',
      created_by: createdBy,
      notes: 'Auto-linked from sales order',
      metadata: { sales_order_number: so.order_number || null },
    })
    .select('*')
    .single();

  void notifyLinkedPoCreated(supabase, {
    companyId,
    poId: Number(po.id),
    salesOrderId,
    orderNumber: so.order_number != null ? String(so.order_number) : null,
    supplierProfileId,
    sent: status === 'sent',
  });

  if (status === 'sent' && supplierProfileId) {
    void (async () => {
      try {
        const { notifyInboundPo } = await import('@/lib/notifications/email-alerts');
        await notifyInboundPo({
          supplierProfileId,
          buyerProfileId: companyId,
          buyerName,
          poId: Number(po.id),
          totalAmount: Number(po.total_amount ?? mapped.total),
          currency: String(po.currency || 'ZAR'),
          lineCount: mapped.items.length,
          source: 'linked_so',
        });
      } catch (e) {
        console.warn('raise-linked-po notify soft-fail', e);
      }
    })();
  }

  return {
    ok: true,
    purchaseOrder: po,
    link: linkErr ? null : (link as Record<string, unknown>),
    preferredSource,
    warning: linkErr ? `PO created but link failed: ${linkErr.message}` : undefined,
  };
}

async function loadChainSetups(
  supabase: SupabaseClient,
  companyId: number
): Promise<OrderChainSetup[]> {
  const { data, error } = await supabase
    .from('order_chain_setups')
    .select('*')
    .eq('profile_id', companyId)
    .eq('status', 'active')
    .limit(200);
  if (error) {
    if (!isMissingRelation(error)) {
      console.warn('order_chain_setups', error.message);
    }
    return [];
  }
  return (data || [])
    .map(mapChainSetup)
    .filter((s): s is OrderChainSetup => !!s);
}

/**
 * Raise one or more manufacturer POs from an SO using order-chain setups
 * (customer + products + supplier). Unmatched lines fall back to company preferred.
 */
export async function raiseFulfillmentPosFromSo(
  input: RaiseLinkedPoInput
): Promise<RaiseLinkedPoResult & { raised: number }> {
  const supabase = input.supabase;
  let so = input.salesOrder || null;
  if (!so) {
    const hit = await supabase
      .from('sales_orders')
      .select('*')
      .eq('id', input.salesOrderId)
      .eq('profile_id', input.companyId)
      .maybeSingle();
    so = hit.data as Record<string, unknown> | null;
  }
  if (!so) {
    return {
      ok: false,
      error: 'Sales order not found',
      code: 'SO_NOT_FOUND',
      raised: 0,
    };
  }

  const setups = await loadChainSetups(supabase, input.companyId);
  const customerId = Number(so.customer_id);
  const groups = groupSoItemsByChain(
    so.items,
    setups,
    Number.isFinite(customerId) && customerId > 0 ? customerId : null
  );

  const assigned = groups.filter((g) => g.srmSupplierId);
  if (!assigned.length || setups.length === 0) {
    const one = await raiseLinkedPoFromSo(input);
    return { ...one, raised: one.ok && !one.skipped ? 1 : 0 };
  }

  let last: RaiseLinkedPoResult = {
    ok: false,
    error: 'No manufacturer PO raised',
  };
  let raised = 0;
  let i = 0;
  for (const g of assigned) {
    const result = await raiseLinkedPoFromSo({
      ...input,
      salesOrder: so,
      srmSupplierId: g.srmSupplierId,
      itemsOverride: g.items,
      allowMultipleLinks: i > 0 || input.allowMultipleLinks === true,
      chainSetupId: g.setupId,
    });
    last = result;
    if (result.ok && !result.skipped) raised += 1;
    i += 1;
  }
  const unmatched = groups.find((g) => !g.srmSupplierId);
  if (unmatched && unmatched.items.length) {
    const result = await raiseLinkedPoFromSo({
      ...input,
      salesOrder: so,
      itemsOverride: unmatched.items,
      allowMultipleLinks: raised > 0 || input.allowMultipleLinks === true,
      srmSupplierId: undefined,
      supplierProfileId: undefined,
    });
    last = result;
    if (result.ok && !result.skipped) raised += 1;
  }

  return {
    ...last,
    ok: raised > 0 || last.ok,
    raised,
    preferredSource: raised ? 'chain_setup' : last.preferredSource,
  };
}
