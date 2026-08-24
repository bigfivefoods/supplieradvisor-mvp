import { calcDocTotals, calcLineTotal, docNumber } from '@/lib/customers/documents';

export function suggestPortalPoNumber(accountLabel?: string | null): string {
  const slug =
    String(accountLabel || 'PO')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 6)
      .toUpperCase() || 'PO';
  return `${slug}-${docNumber('PO').replace(/^PO-/, '')}`;
}

export function portalPoTaxRate(country?: string | null): number {
  const c = String(country || '').toLowerCase();
  if (!c || c.includes('south africa') || c === 'za' || c === 'zaf') return 15;
  return 0;
}

export function portalPoMoney(
  qty: number,
  unitPrice: number,
  taxRate: number
) {
  const line = calcLineTotal(qty, unitPrice);
  return calcDocTotals(
    [{ name: 'x', quantity: qty, unit_price: unitPrice, line_total: line }],
    taxRate
  );
}
