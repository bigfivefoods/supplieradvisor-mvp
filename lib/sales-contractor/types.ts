import type { CommissionTier } from './commission';
import type { SalesSubscriptionInfo, SubscriptionStatus } from './subscription';

export type AgreementStatus = 'pending' | 'signed' | 'suspended' | 'terminated';

export type SalesContractorAgreement = {
  id: number;
  profile_id: number;
  business_user_id: number | null;
  user_id: string | null;
  contractor_email: string | null;
  contractor_name: string | null;
  status: AgreementStatus;
  contract_version: string;
  commission_tiers: CommissionTier[];
  max_commission_pct: number;
  min_commission_pct: number;
  currency: string;
  signed_at: string | null;
  signature_name: string | null;
  signature_email: string | null;
  terms_summary: string | null;
  subscription?: SalesSubscriptionInfo;
  subscription_status?: SubscriptionStatus | string | null;
  subscription_starts_at?: string | null;
  subscription_ends_at?: string | null;
  subscription_paystack_ref?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CommissionLedgerStatus =
  | 'projected'
  | 'earned'
  | 'approved'
  | 'paid'
  | 'void';

export type SalesCommissionRow = {
  id: number;
  profile_id: number;
  sales_rep_user_id: string;
  source_type: string;
  source_id: number | null;
  customer_id: number | null;
  customer_name: string | null;
  deal_amount: number;
  commission_pct: number;
  commission_amount: number;
  currency: string;
  status: CommissionLedgerStatus;
  event_date: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at?: string;
};

export type SalesPortalSummary = {
  companyName: string;
  roleLabel: string;
  agreementSigned: boolean;
  subscriptionActive: boolean;
  /** Owner / finance / admin — no paid sub */
  subscriptionExempt?: boolean;
  subscription: SalesSubscriptionInfo | null;
  agreement: SalesContractorAgreement | null;
  kpis: {
    myLeads: number;
    myCustomers: number;
    openPipeline: number;
    weightedPipeline: number;
    quotesOpen: number;
    quotesValue: number;
    invoicesOpen: number;
    invoicesValue: number;
    earnedCommission: number;
    projectedCommission: number;
    paidCommission: number;
    wonDeals: number;
    wonValue: number;
  };
  pipelineByMonth: { month: string; projected: number; earned: number }[];
  forecastNext90: { week: string; amount: number; commission: number }[];
  topDeals: {
    id: number;
    name: string;
    amount: number;
    stage: string;
    commission: number;
    type: string;
  }[];
  recentActivity: {
    id: string;
    label: string;
    amount?: number;
    commission?: number;
    at: string;
  }[];
  commissionPreview: {
    sampleAmounts: number[];
    samples: { amount: number; commission: number; effectiveRatePct: number }[];
  };
};
