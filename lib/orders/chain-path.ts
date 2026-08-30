/**
 * Shared golden path for the three-party loop:
 * customer PO → sales order → production → delivery → feedback
 * manufacturer PO received → accept → production → ship → complete
 *
 * Customer-facing labels never include manufacturer identity or cost.
 */
import { customerVisibleProductionStatus } from '@/lib/orders/order-links';

export const CUSTOMER_CHAIN_STEPS = [
  { id: 'po', label: 'Purchase order' },
  { id: 'so', label: 'Sales order' },
  { id: 'production', label: 'Production' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'feedback', label: 'Feedback' },
] as const;

export const SUPPLIER_CHAIN_STEPS = [
  { id: 'received', label: 'PO received' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'production', label: 'In production' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'complete', label: 'Complete' },
] as const;

export type ChainSide = 'customer' | 'supplier';

export type ChainSignals = {
  side: ChainSide;
  orderStatus?: string | null;
  productionStatus?: string | null;
  shippedDate?: string | null;
  fulfilmentStatus?: string | null;
  deliveredQty?: number | null;
  rated?: boolean;
  hasSalesOrder?: boolean;
  inventoryReceived?: boolean;
};

function norm(s?: string | null): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function customerChainStep(s: ChainSignals): number {
  const st = norm(s.orderStatus);
  const prod = norm(s.productionStatus);
  if (
    s.rated ||
    ['rated', 'closed', 'complete', 'completed', 'done'].includes(st)
  ) {
    return 4;
  }
  if (
    s.shippedDate ||
    prod === 'completed' ||
    ['delivered', 'shipped', 'received', 'invoiced', 'paid'].includes(st)
  ) {
    return 3;
  }
  if (
    ['released', 'in_progress', 'on_hold'].includes(prod) ||
    st === 'accepted'
  ) {
    return 2;
  }
  if (
    s.hasSalesOrder ||
    ['confirmed', 'open', 'processing', 'partial'].includes(st)
  ) {
    return 1;
  }
  return 0;
}

export function supplierChainStep(s: ChainSignals): number {
  const st = norm(s.orderStatus);
  const prod = norm(s.productionStatus);
  const shipped =
    Boolean(s.shippedDate) ||
    norm(s.fulfilmentStatus) === 'shipped' ||
    st === 'shipped' ||
    st === 'delivered';
  if (
    s.inventoryReceived ||
    ['paid', 'complete', 'completed'].includes(st)
  ) {
    return 4;
  }
  if (shipped || st === 'invoiced' || prod === 'completed') {
    return 3;
  }
  if (prod === 'in_progress' || prod === 'on_hold' || prod === 'released') {
    return 2;
  }
  if (st === 'accepted') return 1;
  return 0;
}

/** Phone-sized supplier portal actions for Brief 17. */
export function supplierPortalCardAction(s: {
  orderStatus?: string | null;
  productionStatus?: string | null;
  fulfilmentStatus?: string | null;
  shippedDate?: string | null;
  inventoryReceived?: boolean;
}): { key: 'accept' | 'ready' | 'ship'; label: string } | null {
  const st = norm(s.orderStatus);
  const prod = norm(s.productionStatus);
  const shipped =
    Boolean(s.shippedDate) ||
    norm(s.fulfilmentStatus) === 'shipped' ||
    st === 'shipped';
  if (s.inventoryReceived || ['paid', 'completed', 'complete'].includes(st)) {
    return null;
  }
  if (st === 'sent' || st === 'draft') {
    return { key: 'accept', label: 'Accept PO' };
  }
  if (st === 'accepted' && !shipped) {
    if (!prod || prod === 'cancelled') {
      return { key: 'ready', label: 'Mark ready' };
    }
    return { key: 'ship', label: 'Mark shipped' };
  }
  if (shipped) return null;
  return null;
}

export function chainStepIndex(s: ChainSignals): number {
  return s.side === 'supplier' ? supplierChainStep(s) : customerChainStep(s);
}

export function chainStepsFor(side: ChainSide) {
  return side === 'supplier' ? SUPPLIER_CHAIN_STEPS : CUSTOMER_CHAIN_STEPS;
}

export function chainProductionLabel(
  productionStatus?: string | null
): string {
  return customerVisibleProductionStatus(productionStatus);
}

/** Next manufacturer production status the supplier should tap. */
export type ChainDocFields = {
  production_status?: string | null;
  production_label?: string | null;
  chain_step?: number;
  completed_at?: string | null;
  confirmed_qty?: number | null;
  rated?: boolean;
  linked?: boolean;
  customer_po_number?: string | null;
};

export function enrichChainDoc<T extends {
  status: string;
  kind?: string;
  production_status?: string | null;
  shippedDate?: string | null;
  fulfilment_status?: string | null;
  completed_at?: string | null;
  delivered?: number | null;
  rated?: boolean;
  inventoryReceived?: boolean;
}>(
  row: T,
  side: ChainSide
): T & ChainDocFields {
  const production_status = row.production_status ?? null;
  return {
    ...row,
    production_status,
    production_label: chainProductionLabel(production_status),
    chain_step: chainStepIndex({
      side,
      orderStatus: row.status,
      productionStatus: production_status,
      shippedDate: row.completed_at || row.shippedDate || null,
      fulfilmentStatus:
        (row as { fulfilment_status?: string | null }).fulfilment_status || null,
      deliveredQty: row.delivered ?? null,
      rated: row.rated === true,
      hasSalesOrder: row.kind === 'order' || side === 'customer',
      inventoryReceived:
        (row as { inventoryReceived?: boolean }).inventoryReceived === true,
    }),
  };
}

export function nextSupplierProductionAction(
  orderStatus?: string | null,
  productionStatus?: string | null
): { status: string; label: string } | null {
  const st = norm(orderStatus);
  const prod = norm(productionStatus);
  if (st === 'sent' || st === 'draft') {
    return { status: 'accepted', label: 'Accept order' };
  }
  if (!prod || prod === 'cancelled') {
    return { status: 'released', label: 'Release to production' };
  }
  if (prod === 'released' || prod === 'on_hold') {
    return { status: 'in_progress', label: 'Start production' };
  }
  if (prod === 'in_progress') {
    return { status: 'completed', label: 'Mark produced' };
  }
  if (prod === 'completed' && !['invoiced', 'shipped', 'paid'].includes(st)) {
    return { status: 'shipped', label: 'Mark shipped' };
  }
  return null;
}
