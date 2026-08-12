/**
 * HireAdvisor® commercial model — distinct from other Advisor packs.
 *
 * Other Advisors: platform bills a company subscription (+ optional industry pack).
 * HireAdvisor: primary revenue is a dual-sided hire commission on completed rentals:
 *   • 2.5% charged to the supplier (owner listing the item)
 *   • 2.5% charged to the customer (person renting the item)
 *   • 5.0% total of hire GMV to SupplierAdvisor®
 *
 * Deposit / damage bonds are held separately and are not commissionable.
 */

/** Supplier-side platform commission on hire rental value (ex-VAT if applicable) */
export const HIRE_SUPPLIER_COMMISSION_PCT = 2.5;

/** Customer-side platform commission on hire rental value */
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
 * Split hire GMV into dual 2.5% commissions.
 * Deposit is pass-through (held/refunded) and never takes commission.
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
  modelLabel: 'Dual-sided hire commission',
  supplierLine: `${HIRE_SUPPLIER_COMMISSION_PCT}% commission to the supplier on hire rental value`,
  customerLine: `${HIRE_CUSTOMER_COMMISSION_PCT}% commission to the customer (person renting) on hire rental value`,
  totalLine: `${HIRE_PLATFORM_COMMISSION_PCT}% total platform take-rate on completed hire GMV`,
  depositLine:
    'Refundable deposits / damage bonds are held separately and are not commissionable',
  vsOtherAdvisors:
    'Unlike FitAdvisor® / clinic Advisors (subscription-led), HireAdvisor® is primarily transaction-commissioned: suppliers list gear; customers rent; SA earns 2.5% + 2.5% on rental value.',
} as const;
