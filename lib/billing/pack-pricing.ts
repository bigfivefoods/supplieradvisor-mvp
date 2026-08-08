/**
 * Industry Pack billing — additive monthly ZAR on Core OS.
 * Same multi-year prepaid discounts as Core for pack line items.
 */
import {
  BILLING_TERMS,
  type BillingTermId,
  getBillingTerm,
} from '@/lib/billing/company-subscription';
import {
  INDUSTRY_PACK_MONTHLY_ZAR,
  getIndustryPack,
  monthlyPriceZar,
} from '@/lib/product/architecture';

export const PACK_PRODUCT = 'industry_packs';

export type PackQuote = {
  packIds: string[];
  packCount: number;
  monthlyZar: number;
  termId: BillingTermId;
  months: number;
  discountPercent: number;
  listZar: number;
  payZar: number;
  payCents: number;
  savingsZar: number;
  effectiveMonthlyZar: number;
  planCode: string;
  lines: Array<{ packId: string; name: string; monthlyZar: number }>;
};

/** Quote prepaid amount for selected packs (new packs only when billed). */
export function quoteIndustryPacks(
  packIds: string[],
  termId: string | null | undefined
): PackQuote {
  const term = getBillingTerm(termId);
  const unique = [...new Set(packIds.filter((id) => getIndustryPack(id)))];
  const lines = unique.map((id) => {
    const p = getIndustryPack(id)!;
    return {
      packId: id,
      name: p.name,
      monthlyZar: p.monthlyZar || INDUSTRY_PACK_MONTHLY_ZAR,
    };
  });
  const monthlyZar = lines.reduce((n, l) => n + l.monthlyZar, 0);
  const listZar = monthlyZar * term.months;
  const payZar = Math.round(listZar * (1 - term.discountPercent / 100));
  return {
    packIds: unique,
    packCount: unique.length,
    monthlyZar,
    termId: term.id,
    months: term.months,
    discountPercent: term.discountPercent,
    listZar,
    payZar,
    payCents: payZar * 100,
    savingsZar: listZar - payZar,
    effectiveMonthlyZar:
      term.months > 0 ? Math.round((payZar / term.months) * 100) / 100 : monthlyZar,
    planCode: `packs_${term.planCode}`,
    lines,
  };
}

/** Combined Core + packs quote for a billing term */
export function quoteCorePlusPacks(
  packIds: string[],
  termId: string | null | undefined
): {
  core: ReturnType<typeof getBillingTerm>;
  packs: PackQuote;
  totalPayZar: number;
  totalPayCents: number;
  totalMonthlyZar: number;
} {
  const core = getBillingTerm(termId);
  const packs = quoteIndustryPacks(packIds, termId);
  return {
    core,
    packs,
    totalPayZar: core.payZar + packs.payZar,
    totalPayCents: core.payCents + packs.payCents,
    totalMonthlyZar: monthlyPriceZar(packIds).total,
  };
}

export { BILLING_TERMS, getBillingTerm };
