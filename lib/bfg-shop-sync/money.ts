/**
 * Integer-cent arithmetic for the shop totals (contract v1.0, section 3.4).
 * The shop's subtotal, VAT and total are stored exactly as sent: SupplierAdvisor®
 * only asserts the invariants and never recomputes with calcDocTotals.
 */

export type MoneyLine = {
  line_ex_vat_cents: number;
  line_vat_cents: number;
};

export type MoneyTransport = {
  ex_vat_cents: number;
  vat_cents: number;
};

export type MoneyTotals = {
  currency: string;
  subtotal_ex_vat_cents: number;
  vat_cents: number;
  total_inc_vat_cents: number;
};

export function centsToRands(cents: number): number {
  return Math.round(cents) / 100;
}

export function randsToCents(rands: number | string | null | undefined): number {
  return Math.round(Number(rands || 0) * 100);
}

/** Names of the section 3.4 invariants that fail. Empty array means all hold. */
export function totalsInvariantFailures(
  lines: MoneyLine[],
  transport: MoneyTransport,
  totals: MoneyTotals
): string[] {
  const failures: string[] = [];
  const sumEx = lines.reduce((s, l) => s + l.line_ex_vat_cents, 0);
  const sumVat = lines.reduce((s, l) => s + l.line_vat_cents, 0);
  if (sumEx + transport.ex_vat_cents !== totals.subtotal_ex_vat_cents) {
    failures.push('subtotal');
  }
  if (sumVat + transport.vat_cents !== totals.vat_cents) {
    failures.push('vat');
  }
  if (totals.subtotal_ex_vat_cents + totals.vat_cents !== totals.total_inc_vat_cents) {
    failures.push('total');
  }
  if (totals.currency !== 'ZAR') failures.push('currency');
  return failures;
}

/** Stable fingerprint used to detect the same reference arriving with other totals. */
export function totalsFingerprint(totals: MoneyTotals): string {
  return `${totals.subtotal_ex_vat_cents}:${totals.vat_cents}:${totals.total_inc_vat_cents}`;
}
