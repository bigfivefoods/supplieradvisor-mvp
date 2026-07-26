/**
 * Hub (blanket / master) orders + call-offs.
 * A hub commits total volume for a production run; call-offs draw against remaining qty
 * within a window (default 3 months).
 */

export type PoOrderKind = 'standard' | 'hub' | 'call_off';

export type HubCallOffMeta = {
  order_kind: PoOrderKind;
  parent_po_id?: number | null;
  call_off_window_months?: number;
  call_off_window_start?: string | null;
  call_off_window_end?: string | null;
  hub_quantity?: number;
  called_off_quantity?: number;
  /** Line-level remaining tracking: product_name/sku key → called qty */
  called_off_by_line?: Record<string, number>;
};

export const CALL_OFF_WINDOW_OPTIONS = [
  { months: 1, label: '1 month' },
  { months: 3, label: '3 months' },
  { months: 6, label: '6 months' },
  { months: 12, label: '12 months' },
] as const;

export function parseOrderKind(raw: unknown): PoOrderKind {
  const k = String(raw || 'standard').toLowerCase();
  if (k === 'hub' || k === 'blanket' || k === 'master' || k === 'framework') return 'hub';
  if (k === 'call_off' || k === 'calloff' || k === 'release') return 'call_off';
  return 'standard';
}

export function lineKey(item: {
  product_id?: number | null;
  sku?: string | null;
  item_name?: string | null;
  name?: string | null;
}): string {
  if (item.product_id != null && Number.isFinite(Number(item.product_id))) {
    return `pid:${item.product_id}`;
  }
  const sku = String(item.sku || '').trim().toLowerCase();
  if (sku) return `sku:${sku}`;
  return `name:${String(item.item_name || item.name || '')
    .trim()
    .toLowerCase()
    .slice(0, 80)}`;
}

export function itemsTotalQty(
  items: Array<{ quantity?: number | string | null }> | null | undefined
): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
}

export function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate.slice(0, 10) + 'T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function extractHubMeta(
  po: Record<string, unknown> | null | undefined
): HubCallOffMeta {
  const meta =
    po?.metadata && typeof po.metadata === 'object' && !Array.isArray(po.metadata)
      ? (po.metadata as Record<string, unknown>)
      : {};
  const kind = parseOrderKind(po?.order_kind ?? meta.order_kind);
  const hubQty =
    Number(po?.hub_quantity ?? meta.hub_quantity ?? po?.order_quantity) ||
    itemsTotalQty(po?.items as Array<{ quantity?: number }>);
  const called =
    Number(po?.called_off_quantity ?? meta.called_off_quantity) || 0;
  return {
    order_kind: kind,
    parent_po_id:
      po?.parent_po_id != null
        ? Number(po.parent_po_id)
        : meta.parent_po_id != null
          ? Number(meta.parent_po_id)
          : null,
    call_off_window_months: Number(
      po?.call_off_window_months ?? meta.call_off_window_months ?? 3
    ),
    call_off_window_start: String(
      po?.call_off_window_start ?? meta.call_off_window_start ?? ''
    ).slice(0, 10) || null,
    call_off_window_end: String(
      po?.call_off_window_end ?? meta.call_off_window_end ?? ''
    ).slice(0, 10) || null,
    hub_quantity: hubQty,
    called_off_quantity: called,
    called_off_by_line:
      meta.called_off_by_line && typeof meta.called_off_by_line === 'object'
        ? (meta.called_off_by_line as Record<string, number>)
        : {},
  };
}

export function remainingHubQty(hub: HubCallOffMeta): number {
  return Math.max(0, (hub.hub_quantity || 0) - (hub.called_off_quantity || 0));
}

export function isHubWindowOpen(hub: HubCallOffMeta, today = new Date()): boolean {
  if (!hub.call_off_window_end) return true;
  const end = new Date(hub.call_off_window_end + 'T23:59:59Z');
  return today.getTime() <= end.getTime();
}

export function hubBadgeClass(kind: PoOrderKind): string {
  if (kind === 'hub') return 'bg-indigo-100 text-indigo-900 border-indigo-200';
  if (kind === 'call_off') return 'bg-teal-100 text-teal-900 border-teal-200';
  return 'bg-neutral-100 text-neutral-600 border-neutral-200';
}

export function hubKindLabel(kind: PoOrderKind): string {
  if (kind === 'hub') return 'Hub order';
  if (kind === 'call_off') return 'Call-off';
  return 'Standard';
}
