/**
 * HireAdvisor® commercial model — distinct from other Advisor packs.
 *
 * Other Advisors: platform bills a company subscription (+ optional industry pack).
 * HireAdvisor: marketplace take-rate (not a gym/clinic subscription).
 *   • 2.5% charged to the supplier (owner listing the item)
 *   • 2.5% charged to the customer on the rental (deposits excluded)
 *
 * Deposit / damage bonds are held separately and are not commissionable.
 * Gym / clinic B2C remains free — this file is Hire-only.
 */

/** Supplier-side platform commission on hire rental value (ex-VAT if applicable) */
export const HIRE_SUPPLIER_COMMISSION_PCT = 2.5;

/** Customer-side platform commission on marketplace hire (not gym/clinic). */
export const HIRE_CUSTOMER_COMMISSION_PCT = 2.5;

/** Combined platform take-rate */
export const HIRE_PLATFORM_COMMISSION_PCT =
  HIRE_SUPPLIER_COMMISSION_PCT + HIRE_CUSTOMER_COMMISSION_PCT;

export type HireCommissionBreakdown = {
  /** Gross hire rental (days × rate × qty) before platform fees */
  rentalZar: number;
  /** Optional refundable deposit / bond (not commissionable) */
  depositZar: number;
  supplierCommissionPct: number;
  customerCommissionPct: number;
  supplierCommissionZar: number;
  customerCommissionZar: number;
  platformTotalZar: number;
  /** What supplier nets from rental (rental − supplier commission) */
  supplierNetZar: number;
  /** What customer pays for rental+fees (rental + customer commission + deposit) */
  customerPaysZar: number;
  /** Customer pays excluding deposit */
  customerRentalWithFeeZar: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Split hire GMV. Deposits are pass-through (held/refunded) and never take commission.
 * Delivery fees sit on top of this breakdown and are not commissionable.
 */
export function computeHireCommissions(opts: {
  rentalZar: number;
  depositZar?: number | null;
  supplierPct?: number;
  customerPct?: number;
}): HireCommissionBreakdown {
  const rentalZar = Math.max(0, Number(opts.rentalZar) || 0);
  const depositZar = Math.max(0, Number(opts.depositZar) || 0);
  const supplierCommissionPct =
    opts.supplierPct ?? HIRE_SUPPLIER_COMMISSION_PCT;
  const customerCommissionPct =
    opts.customerPct ?? HIRE_CUSTOMER_COMMISSION_PCT;

  const supplierCommissionZar = round2(
    (rentalZar * supplierCommissionPct) / 100
  );
  const customerCommissionZar = round2(
    (rentalZar * customerCommissionPct) / 100
  );
  const platformTotalZar = round2(
    supplierCommissionZar + customerCommissionZar
  );
  const supplierNetZar = round2(rentalZar - supplierCommissionZar);
  const customerRentalWithFeeZar = round2(rentalZar + customerCommissionZar);
  const customerPaysZar = round2(customerRentalWithFeeZar + depositZar);

  return {
    rentalZar: round2(rentalZar),
    depositZar: round2(depositZar),
    supplierCommissionPct,
    customerCommissionPct,
    supplierCommissionZar,
    customerCommissionZar,
    platformTotalZar,
    supplierNetZar,
    customerPaysZar,
    customerRentalWithFeeZar,
  };
}

export function formatPct(n: number) {
  return `${n}%`;
}

export const HIRE_COMMERCIAL_COPY = {
  modelLabel: '2.5% + 2.5% on marketplace hire',
  supplierLine: `${HIRE_SUPPLIER_COMMISSION_PCT}% commission to the supplier on hire rental value`,
  customerLine: `${HIRE_CUSTOMER_COMMISSION_PCT}% platform fee on the rental (deposits excluded)`,
  totalLine: `${HIRE_PLATFORM_COMMISSION_PCT}% platform take on marketplace hire GMV`,
  depositLine:
    'Refundable deposits / damage bonds are held separately and are not commissionable',
  vsOtherAdvisors:
    'HireAdvisor® takes 2.5% from the customer and 2.5% from the listing business on rental GMV (deposits excluded). Gym / clinic Advisors stay subscription-led; those members never pay a platform take-rate.',
} as const;
