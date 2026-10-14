/**
 * Customer prices for VerifyNow checks, in rand.
 * These are the VAT-inclusive amounts Paystack charges.
 * Provider costs (excl. VAT) stay beside them so the markup is visible.
 *
 * Shelf rule matches the live CIPC price: provider cost R26 excl. VAT is sold at R69.
 * That is about 2.65×. Amounts below R15 are lifted so the Paystack fee does not
 * wipe the margin. Craig confirms these before they are treated as final.
 */
export type CustomerPrice = {
  id: string;
  label: string;
  /** VAT-inclusive rand amount shown to the customer and charged by Paystack. */
  zar: number;
  cents: number;
  /** VerifyNow product-guide cost, excluding VAT. */
  costExclVatZar: number;
  credits: number;
  vatInclusive: true;
  /** Undiscounted sum of the component customer prices. Bundles only. */
  listZar?: number;
};

export const CUSTOMER_PRICES = {
  cipc_company_match: {
    id: 'cipc_company_match',
    label: 'CIPC company match',
    zar: 69,
    cents: 6900,
    costExclVatZar: 26,
    credits: 10,
    vatInclusive: true as const,
  },
  cipc_director_search: {
    id: 'cipc_director_search',
    label: 'CIPC director search',
    zar: 69,
    cents: 6900,
    costExclVatZar: 26,
    credits: 10,
    vatInclusive: true as const,
  },
  said_verification: {
    id: 'said_verification',
    label: 'Director SA ID',
    zar: 15,
    cents: 1500,
    costExclVatZar: 2.6,
    credits: 1,
    vatInclusive: true as const,
  },
  aml_pep: {
    id: 'aml_pep',
    label: 'AML, PEP and sanctions',
    zar: 15,
    cents: 1500,
    costExclVatZar: 5.2,
    credits: 2,
    vatInclusive: true as const,
  },
  bank_account: {
    id: 'bank_account',
    label: 'Company bank account',
    zar: 50,
    cents: 5000,
    costExclVatZar: 15.6,
    credits: 6,
    vatInclusive: true as const,
  },
  business_bank_account: {
    id: 'business_bank_account',
    label: 'Capitec Business / Mercantile',
    zar: 55,
    cents: 5500,
    costExclVatZar: 18.2,
    credits: 7,
    vatInclusive: true as const,
  },
  supplier_bundle: {
    id: 'supplier_bundle',
    label: 'Supplier bundle',
    zar: 169,
    cents: 16900,
    costExclVatZar: 72.8,
    credits: 28,
    vatInclusive: true as const,
    listZar: 203,
  },
  supplier_bundle_capitec: {
    id: 'supplier_bundle_capitec',
    label: 'Supplier bundle (Capitec Business)',
    zar: 179,
    cents: 17900,
    costExclVatZar: 75.4,
    credits: 29,
    vatInclusive: true as const,
    listZar: 208,
  },
} as const satisfies Record<string, CustomerPrice>;

export type PricedCheck =
  | 'cipc_company_match'
  | 'cipc_director_search'
  | 'said_verification'
  | 'aml_pep'
  | 'bank_account'
  | 'supplier_bundle';

/** Customer price for a profile check. Async bank uses the Capitec shelf. */
export function customerPriceFor(check: PricedCheck, asyncBank = false): CustomerPrice {
  if (check === 'bank_account' && asyncBank) return CUSTOMER_PRICES.business_bank_account;
  if (check === 'supplier_bundle' && asyncBank) return CUSTOMER_PRICES.supplier_bundle_capitec;
  return CUSTOMER_PRICES[check];
}

/** Company + director search + AML + bank, before the bundle discount. */
export function bundleListZar(asyncBank: boolean): number {
  const bank = asyncBank
    ? CUSTOMER_PRICES.business_bank_account.zar
    : CUSTOMER_PRICES.bank_account.zar;
  return (
    CUSTOMER_PRICES.cipc_company_match.zar +
    CUSTOMER_PRICES.cipc_director_search.zar +
    CUSTOMER_PRICES.aml_pep.zar +
    bank
  );
}

export function formatCustomerZar(zar: number): string {
  if (Number.isInteger(zar)) return `R${zar}`;
  return `R${zar.toFixed(2)}`;
}
