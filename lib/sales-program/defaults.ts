import {
  DEFAULT_COMMISSION_TIERS,
  SUPER_LINK_UNIT_PRICE_ZAR,
  SUPER_LINK_UNITS,
  type CommissionTier,
} from '@/lib/sales-contractor/commission';
import {
  SALES_CONTRACTOR_CONTRACT_TITLE,
  SALES_CONTRACTOR_CONTRACT_VERSION,
  SALES_CONTRACTOR_EMAIL_DOMAIN,
  SALES_CONTRACTOR_KPIS,
} from '@/lib/sales-contractor/agreement';
import type { ProgramCriterion, SalesProgramSettings } from './types';

export const PLATFORM_PROGRAM_NAME = 'Independent Sales Contractor Program';

export const PLATFORM_PROGRAM_SUMMARY =
  'Join as an independent sales contractor: personal-sales-only commission (not multi-level marketing), company-owned CRM, and a dedicated sales portal under South African law.';

export function platformSalesCriteria(): ProgramCriterion[] {
  return SALES_CONTRACTOR_KPIS.map((k) => ({
    key: k.key,
    title: k.title,
    detail: k.detail,
    required: true,
  }));
}

export function platformResellerCriteria(): ProgramCriterion[] {
  return [
    {
      key: 'verify',
      title: 'Identity verification',
      detail:
        'Complete VerifyNow (or company-approved ID checks) before trading stock.',
      required: true,
    },
    {
      key: 'stock_care',
      title: 'Stock care & reporting',
      detail:
        'Keep accurate counts, report damage, and follow RIAD / feedback workflows.',
      required: true,
    },
    {
      key: 'honest_sales',
      title: 'Honest sales practices',
      detail:
        'No misrepresentation of price, product, or origin. Personal sales only — no multi-level recruiting pay.',
      required: true,
    },
  ];
}

export function platformCommissionTiers(): CommissionTier[] {
  return DEFAULT_COMMISSION_TIERS.map((t) => ({ ...t }));
}

/** In-memory platform defaults for a company that has not configured a program yet. */
export function buildPlatformDefaultProgram(
  companyId: number
): SalesProgramSettings {
  return {
    id: null,
    profile_id: companyId,
    program_name: PLATFORM_PROGRAM_NAME,
    program_summary: PLATFORM_PROGRAM_SUMMARY,
    is_enabled: true,
    contract_title: SALES_CONTRACTOR_CONTRACT_TITLE,
    contract_version: SALES_CONTRACTOR_CONTRACT_VERSION,
    legal_body_html: null,
    legal_addendum_html: null,
    email_domain: SALES_CONTRACTOR_EMAIL_DOMAIN,
    require_re_sign_on_change: true,
    commission_model: 'stepped',
    commission_tiers: platformCommissionTiers(),
    min_commission_pct: 0,
    max_commission_pct: 100,
    currency: 'ZAR',
    example_units: SUPER_LINK_UNITS,
    example_unit_price: SUPER_LINK_UNIT_PRICE_ZAR,
    example_label: 'Super-link (~full load)',
    sales_criteria: platformSalesCriteria(),
    reseller_criteria: platformResellerCriteria(),
    eligibility_notes: null,
    program_info_html: null,
    personal_sales_only: true,
    metadata: {},
    using_defaults: true,
  };
}
