/** Customer-safe / manufacturer-safe order-chain email subjects. Hub is the only name. */

export function chainPoSubject(hubName: string, poNumber: string): string {
  return `${hubName} sent you purchase order ${poNumber}`;
}

export function chainProductionSubject(
  hubName: string,
  orderNumber: string,
  statusLabel: string
): string {
  return `${hubName} updated your order ${orderNumber} — ${statusLabel}`;
}
