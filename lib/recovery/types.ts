export type OperatorType = 'agency' | 'in_house' | 'attorney';
export type TrustMode = 'trust' | 'direct';
export type ProgrammeType = 'recovery' | 'managed_repayment';
export type StaffRole = 'manager' | 'collector' | 'compliance' | 'finance_view';
export type StaffStatus = 'active' | 'inactive';
export type RemittanceTerms = 'monthly' | 'weekly' | 'on_receipt';
export type ProductType =
  | 'nca_credit'
  | 'trade'
  | 'levy'
  | 'rent'
  | 'medical'
  | 'utility'
  | 'other';
export type ProcessingRole = 'responsible_party' | 'operator';
export type PortalKind = 'creditor' | 'debtor' | 'attorney';

export type RecoverWorkspace = {
  id: string;
  company_id: number;
  display_name: string;
  operator_type: OperatorType;
  programme_types: ProgrammeType[];
  trust_mode: TrustMode;
  cfdc_registration_no: string;
  cfdc_expiry: string | null;
  vat_registered: boolean;
  vat_rate_bps: number | null;
  real_data_enabled: boolean;
  real_data_confirmed_by: string | null;
  real_data_confirmed_at: string | null;
};

export type RecoverStaff = {
  id: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  team_id: string | null;
  cfdc_registration_no: string;
  registration_status: string;
  monthly_target_cents: number | null;
  user_id: string | null;
};

export type RecoverCreditor = {
  id: string;
  name: string;
  reg_no: string;
  vat_no: string;
  remittance_terms: RemittanceTerms;
  portal_enabled: boolean;
  status: string;
  customer_id: number | null;
};

export type RecoverMandate = {
  id: string;
  creditor_id: string;
  creditor_name: string;
  programme_type: ProgrammeType;
  product_type: ProductType;
  nca_regulated: boolean;
  processing_role: ProcessingRole;
  status: string;
};

export type RecoverOp =
  | {
      op: 'init_workspace';
      display_name?: string;
      operator_type?: OperatorType;
      trust_mode?: TrustMode;
      cfdc_registration_no?: string;
      cfdc_expiry?: string | null;
      vat_registered?: boolean;
      vat_rate_bps?: number | null;
    }
  | {
      op: 'update_workspace';
      display_name?: string;
      operator_type?: OperatorType;
      trust_mode?: TrustMode;
      cfdc_registration_no?: string;
      cfdc_expiry?: string | null;
      vat_registered?: boolean;
      vat_rate_bps?: number | null;
    }
  | {
      op: 'upsert_staff';
      id?: string;
      email: string;
      role: StaffRole;
      team_id?: string | null;
      cfdc_registration_no?: string;
      registration_status?: string;
      monthly_target_cents?: number | null;
    }
  | { op: 'deactivate_staff'; id: string }
  | { op: 'set_real_data_enabled'; enabled: boolean; confirm?: string };

export type RecoverRole =
  | 'owner'
  | 'manager'
  | 'agent'
  | 'finance'
  | 'compliance'
  | 'viewer'
  | 'none';

export type RecoverCapabilities = {
  canSeeAllQueues: boolean;
  canEditSettings: boolean;
  canSeeTrust: boolean;
  canManageStaff: boolean;
  canSetRealData: boolean;
};

export type RecoverDeskPayload = {
  ready: boolean;
  reason?: 'migration_pending';
  workspace: RecoverWorkspace | null;
  role: RecoverRole;
  capabilities: RecoverCapabilities;
  counts: { creditors: number | null; mandates: number | null; staff: number | null };
  creditors: RecoverCreditor[];
  mandates: RecoverMandate[];
  staff: RecoverStaff[];
  self: RecoverStaff | null;
};
