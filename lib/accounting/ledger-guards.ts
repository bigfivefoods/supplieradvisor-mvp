/**
 * Posting guards. Pure — no database. Callers that write journals use these
 * before they post, and the unit tests exercise them without a ledger.
 */
import { round2 } from '@/lib/accounting/server';

/**
 * Cost relieved for one purchase order cannot exceed that PO's own cost.
 * Each matching invoice used to receive the full cost (PO #2, R63,648, five times).
 */
export function capPoCogsAmount(opts: {
  poCost: number;
  alreadyRelieved: number;
  requested: number;
}): number {
  const remaining = round2(
    round2(Number(opts.poCost) || 0) - round2(Number(opts.alreadyRelieved) || 0)
  );
  if (remaining < 0.005) return 0;
  const requested = round2(Math.abs(Number(opts.requested) || 0));
  if (requested < 0.005) return 0;
  return round2(Math.min(requested, remaining));
}

export type SettlementGate = {
  blocked: boolean;
  outstanding: number;
  message?: string;
};

/**
 * A settlement (this payment plus live settlements already posted) cannot
 * exceed the invoice total. One cent of rounding is allowed.
 */
export function settlementExceedsInvoice(opts: {
  invoiceTotal: number;
  settledToDate: number;
  amount: number;
}): SettlementGate {
  const total = round2(Number(opts.invoiceTotal) || 0);
  const settled = round2(Number(opts.settledToDate) || 0);
  const amount = round2(Math.abs(Number(opts.amount) || 0));
  const outstanding = round2(total - settled);
  if (!(total > 0) || amount < 0.005) {
    return { blocked: false, outstanding };
  }
  if (round2(settled + amount) > round2(total + 0.01)) {
    const left = outstanding > 0 ? outstanding : 0;
    return {
      blocked: true,
      outstanding,
      message: `SupplierAdvisor® cannot settle ${amount.toFixed(2)}. ${settled.toFixed(2)} is already settled of invoice ${total.toFixed(2)} (${left.toFixed(2)} outstanding).`,
    };
  }
  return { blocked: false, outstanding };
}

/** Debit total of live settlement journals. A balanced settlement's debits equal the cash applied. */
export function sumSettlementDebits(
  lines: Array<{ debit?: number | null }>
): number {
  return round2(lines.reduce((sum, line) => sum + Number(line.debit || 0), 0));
}
