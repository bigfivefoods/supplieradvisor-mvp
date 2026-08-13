/**
 * HireAdvisor® commercial model — distinct from other Advisor packs.
 *
 * Other Advisors: platform bills a company subscription (+ optional industry pack).
 * HireAdvisor: take-rate is on the listing business only.
 *   • 2.5% charged to the supplier (owner listing the item)
 *   • 0% charged to the customer / member (B2C is free)
 *
 * Deposit / damage bonds are held separately and are not commissionable.
 */

import { B2C_CUSTOMER_TAKE_RATE_PCT } from '@/lib/b2c/pricing';

/** Supplier-side platform commission on hire rental value (ex-VAT if applicable) */
export const HIRE_SUPPLIER_COMMISSION_PCT = 2.5;

/** Customer-side platform commission — always 0. B2C members are free. */
export const HIRE_CUSTOMER_COMMISSION_PCT = B2C_CUSTOMER_TAKE_RATE_PCT;

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
 * Split hire GMV. Customer take-rate is 0 (B2C free).
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
  modelLabel: 'Supplier commission · members free',
  supplierLine: `${HIRE_SUPPLIER_COMMISSION_PCT}% commission to the supplier on hire rental value`,
  customerLine: 'Members and renters pay no platform fee (B2C is free)',
  totalLine: `${HIRE_SUPPLIER_COMMISSION_PCT}% platform take-rate on the listing business only`,
  depositLine:
    'Refundable deposits / damage bonds are held separately and are not commissionable',
  vsOtherAdvisors:
    'HireAdvisor® bills the listing business a take-rate on completed hires. Gym / clinic Advisors are subscription-led. End customers never pay SupplierAdvisor®.',
} as const;
