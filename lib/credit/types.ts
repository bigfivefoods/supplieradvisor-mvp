export const CREDIT_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'more_info_needed',
  'approved',
  'declined',
] as const;

export type CreditStatus = (typeof CREDIT_STATUSES)[number];

export type CreditTermsOption =
  | 'COD'
  | '7 days'
  | '14 days'
  | '30 days from statement'
  | '60 days from statement'
  | 'Other';

export type CreditAddress = {
  line1?: string;
  line2?: string;
  suburb?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
};

export type CreditApplicationBusiness = {
  trading_name?: string;
  registered_name?: string;
  entity_type?: string;
  registration_number?: string;
  vat_number?: string;
  years_trading?: string;
  industry?: string;
};

export type CreditApplicationContacts = {
  accounts?: {
    name?: string;
    email?: string;
    phone?: string;
    job_title?: string;
  };
  buyer?: {
    name?: string;
    email?: string;
    phone?: string;
    job_title?: string;
  };
};

export type CreditTradeReference = {
  company?: string;
  contact?: string;
  phone?: string;
  email?: string;
  account_since?: string;
  typical_monthly_spend?: string;
  terms?: string;
};

export type CreditApplicationBank = {
  bank_name?: string;
  branch_name?: string;
  branch_code?: string;
  account_type?: string;
  account_holder?: string;
  account_number?: string;
  account_number_enc?: string;
  account_number_last4?: string;
};

export type CreditApplicationPrincipalInput = {
  id?: number;
  full_name?: string;
  role?: string;
  id_type?: 'sa_id' | 'passport' | 'other';
  id_number?: string;
  id_number_enc?: string;
  id_number_last4?: string;
  nationality?: string;
  residential_address?: CreditAddress;
  email?: string;
  phone?: string;
  shareholding_pct?: number | string;
  surety_offered?: boolean;
  surety_signature?: {
    typed_name?: string;
    capacity?: string;
    signed_at?: string;
  };
};

export type CreditApplicationDocumentType =
  | 'cipc_registration'
  | 'bank_confirmation'
  | 'vat_certificate'
  | 'id_copy'
  | 'financials'
  | 'surety_deed'
  | 'other';

export type CreditApplicationDocument = {
  id?: number;
  principal_id?: number | null;
  doc_type: CreditApplicationDocumentType;
  file_name?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  sha256?: string | null;
  created_at?: string | null;
};

export type CreditApplicationInput = {
  country_code?: string;
  form_version?: number;
  business?: CreditApplicationBusiness;
  addresses?: {
    physical?: CreditAddress;
    postal?: CreditAddress;
    delivery?: CreditAddress;
  };
  contacts?: CreditApplicationContacts;
  trade_references?: CreditTradeReference[];
  bank?: CreditApplicationBank;
  requested_limit?: number | string;
  requested_terms?: string;
  requested_terms_other?: string;
  currency?: string;
  principals?: CreditApplicationPrincipalInput[];
  consent?: {
    popia?: boolean;
    credit_check?: boolean;
    terms_accepted?: boolean;
  };
  signature?: {
    typed_name?: string;
    capacity?: string;
  };
  info_response?: string;
};

export type CreditApplicationRow = {
  id: number;
  profile_id: number;
  customer_id: number;
  viewer_id: number | null;
  applicant_profile_id: number | null;
  reference: string | null;
  country_code: string;
  form_version: number;
  status: CreditStatus;
  business: Record<string, unknown>;
  addresses: Record<string, unknown>;
  contacts: Record<string, unknown>;
  trade_references: Array<Record<string, unknown>>;
  bank: Record<string, unknown>;
  requested_limit: number | null;
  requested_terms: string | null;
  currency: string | null;
  approved_limit: number | null;
  approved_terms: string | null;
  review_date: string | null;
  decision_reason: string | null;
  info_request: string | null;
  info_response: string | null;
  popia_consent_at: string | null;
  credit_check_consent_at: string | null;
  terms_accepted_at: string | null;
  terms_version: string | null;
  terms_sha256: string | null;
  signature: Record<string, unknown> | null;
  submitted_at: string | null;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
  updated_at: string;
};
