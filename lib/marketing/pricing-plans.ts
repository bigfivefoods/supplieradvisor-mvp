import {
  BILLING_TERMS,
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
  type BillingTerm,
} from '@/lib/billing/company-subscription';
import {
  REFERRAL_LEVEL_LABELS,
  REFERRAL_LEVEL_RATES_PCT,
  REFERRAL_TOTAL_CAP_PCT,
} from '@/lib/billing/supply-chain-referral';

const TIER_CTA_BY_ID: Record<BillingTerm['id'], string> = {
  monthly: 'Start monthly',
  '1y': 'Choose 1 year',
  '2y': 'Choose 2 years',
  '3y': 'Lock in 3 years',
};

export const PRICING_SECTION_IDS = {
  pricing: 'pricing',
  tiers: 'tiers',
  referral: 'referral',
} as const;

export const MARKETING_PRICING_TERMS = BILLING_TERMS.map((tier) => ({
  ...tier,
  cta: TIER_CTA_BY_ID[tier.id],
}));

export const REFERRAL_LEVEL_DETAILS = REFERRAL_LEVEL_RATES_PCT.map((rate, index) => ({
  label: REFERRAL_LEVEL_LABELS[index],
  rate,
  description:
    index === 0
      ? 'Company you invited directly'
      : index === 1
        ? 'Company invited by your referral'
        : 'One more level deeper',
}));

export const REFERRAL_EXPLAINER_STEPS = [
  {
    title: 'Invite real trading partners',
    body: 'Share your referral link with suppliers, buyers, and partners you actually trade with. First-touch attribution applies, so the first valid invitation keeps the relationship.',
  },
  {
    title: 'They activate SupplierAdvisor',
    body: `Each invited company gets ${COMPANY_TRIAL_DAYS} days to run the full platform and can then subscribe from R${COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month or choose a prepaid tier.`,
  },
  {
    title: 'Referral fees are shared by depth',
    body: `When a qualifying subscription is paid, L1 earns ${REFERRAL_LEVEL_RATES_PCT[0]}%, L2 earns ${REFERRAL_LEVEL_RATES_PCT[1]}%, and L3 earns ${REFERRAL_LEVEL_RATES_PCT[2]}% (maximum ${REFERRAL_TOTAL_CAP_PCT}% combined).`,
  },
] as const;

export const PRICING_FAQ_ITEMS = [
  {
    question: 'Is pricing per user or per company?',
    answer:
      'SupplierAdvisor pricing is per company workspace, not per seat. Every paid tier includes unlimited team users so operations, finance, quality, and procurement can work in one system.',
  },
  {
    question: 'What does “from R299/mo” mean?',
    answer:
      'R299/mo is the current monthly list rate for one company subscription. Prepaid 1-year, 2-year, and 3-year tiers reduce the effective monthly cost while keeping the same full platform access.',
  },
  {
    question: 'Do all billing tiers include the same product?',
    answer:
      'Yes. Every tier includes the same core operating system modules and advisor tools. The difference is billing term length and discount, not feature access.',
  },
  {
    question: 'How does the free trial work?',
    answer:
      `New companies get a ${COMPANY_TRIAL_DAYS}-day free trial with full platform access. No card is required to start, and you can select a paid tier later from billing settings.`,
  },
  {
    question: 'How are referral fees calculated?',
    answer:
      `Referral fees are based on actual qualifying subscription payments only. The shared split is ${REFERRAL_LEVEL_RATES_PCT[0]}% at L1, ${REFERRAL_LEVEL_RATES_PCT[1]}% at L2, and ${REFERRAL_LEVEL_RATES_PCT[2]}% at L3, with a total cap of ${REFERRAL_TOTAL_CAP_PCT}%.`,
  },
  {
    question: 'Are referral payouts based on product sales?',
    answer:
      'No. Referral payouts apply to SupplierAdvisor platform subscription fees, not to traded goods or service sales between partners.',
  },
  {
    question: 'Can I switch my billing tier later?',
    answer:
      'Yes. Companies can move from monthly to prepaid terms in billing. Early renewals extend your subscription window and referral percentages continue to apply to amounts actually paid.',
  },
] as const;
