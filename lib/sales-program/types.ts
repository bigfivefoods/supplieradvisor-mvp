import type { CommissionTier } from '@/lib/sales-contractor/commission';

/** KPI / eligibility criterion shown in agreement + portal. */
export type ProgramCriterion = {
  key: string;
  title: string;
  detail: string;
  required?: boolean;
};

export type SalesProgramSettings = {
  id: number | null;
  profile_id: number;
  program_name: string;
  program_summary: string;
  is_enabled: boolean;

  contract_title: string;
  contract_version: string;
  /** Full custom legal body HTML; null/empty = use platform template. */
  legal_body_html: string | null;
  /** Appended after platform (or custom) body. */
  legal_addendum_html: string | null;
  email_domain: string | null;
  require_re_sign_on_change: boolean;

  commission_model: 'stepped';
  commission_tiers: CommissionTier[];
  min_commission_pct: number;
  max_commission_pct: number;
  currency: string;
  example_units: number | null;
  example_unit_price: number | null;
  example_label: string | null;

  sales_criteria: ProgramCriterion[];
  reseller_criteria: ProgramCriterion[];
  eligibility_notes: string | null;
  program_info_html: string | null;

  /** Always true — personal sales only / not MLM. */
  personal_sales_only: true;

  metadata: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;

  /** True when no DB row exists (platform defaults in memory). */
  using_defaults?: boolean;
};

export type SalesProgramPatch = Partial<{
  program_name: string;
  program_summary: string;
  is_enabled: boolean;
  contract_title: string;
  contract_version: string;
  legal_body_html: string | null;
  legal_addendum_html: string | null;
  email_domain: string | null;
  require_re_sign_on_change: boolean;
  commission_tiers: CommissionTier[];
  min_commission_pct: number;
  max_commission_pct: number;
  currency: string;
  example_units: number | null;
  example_unit_price: number | null;
  example_label: string | null;
  sales_criteria: ProgramCriterion[];
  reseller_criteria: ProgramCriterion[];
  eligibility_notes: string | null;
  program_info_html: string | null;
  metadata: Record<string, unknown>;
}>;
