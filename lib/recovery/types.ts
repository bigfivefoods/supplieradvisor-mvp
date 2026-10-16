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
  block_unregistered_assignment?: boolean;
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
  registration_expires_on?: string | null;
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
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  notes?: string;
  archived_at?: string | null;
  mandate_count?: number;
  account_count?: number;
  updated_at?: string;
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
  commission_model?: CommissionModel;
  allocation_order?: AllocationLabel[];
  agreement_reference?: string;
  account_count?: number;
  signed_on?: string | null;
  authority_to_litigate?: boolean;
  bureau_authority?: boolean;
  retention_months?: number | null;
  start_on?: string | null;
  end_on?: string | null;
  updated_at?: string;
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

export type CommissionKind = 'pct_of_recovered' | 'tiered' | 'flat_per_account' | 'flat_plus_pct';
export type CommissionModel = {
  kind?: CommissionKind;
  bps?: number;
  cents?: number;
  flat_cents?: number;
};
export type AllocationLabel = 'costs' | 'interest' | 'fees' | 'principal';
export type StopFlag = 'debt_review' | 'deceased' | 'insolvency' | 'represented' | 'dispute' | 'do_not_contact';
export type DebtorKind = 'person' | 'company';
export type IdType = 'sa_id' | 'passport' | 'company_reg' | 'other';
export type ContactKind = 'phone' | 'whatsapp' | 'email' | 'address' | 'employer';
export type AccountState = 'active' | 'arrangement' | 'dispute' | 'legal' | 'paid' | 'recalled' | 'closed' | 'prescribed' | 'stopped';

export type RecoverBookStats = {
  placedCount: number;
  placedBalanceCents: number;
  assignedCount: number;
  unassignedCount: number;
  imported: boolean;
  arrangementCount?: number;
  paidCount?: number;
};

export type RecoverCapabilities = {
  canSeeAllQueues: boolean;
  canEditSettings: boolean;
  canSeeTrust: boolean;
  canManageStaff: boolean;
  canSetRealData: boolean;
  canEditBooks?: boolean;
  canSeeContacts?: boolean;
  canSeeAccountRows?: boolean;
  canAddNote?: boolean;
  canMutateAccounts?: boolean;
  canRevealId?: boolean;
  canImport?: boolean;
  canClearDemo?: boolean;
  canSeeCreditorDetail?: boolean;
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
  book?: RecoverBookStats | null;
};

export type RecoverBookOp =
  | { op: 'creditor.upsert'; patch: Record<string, unknown> }
  | { op: 'creditor.archive'; patch: Record<string, unknown> }
  | { op: 'mandate.upsert'; patch: Record<string, unknown> }
  | { op: 'mandate.set_status'; patch: Record<string, unknown> }
  | { op: 'debtor.upsert'; patch: Record<string, unknown> }
  | { op: 'contact_point.upsert'; patch: Record<string, unknown> }
  | { op: 'contact_point.remove'; patch: Record<string, unknown> }
  | { op: 'account.create'; patch: Record<string, unknown> }
  | { op: 'account.assign'; patch: Record<string, unknown> }
  | { op: 'account.set_flag'; patch: Record<string, unknown> }
  | { op: 'account.clear_flag'; patch: Record<string, unknown> }
  | { op: 'account.add_note'; patch: Record<string, unknown> }
  | { op: 'account.recall'; patch: Record<string, unknown> }
  | { op: 'account.adjust'; patch: Record<string, unknown> }
  | { op: 'debtor.merge'; patch: Record<string, unknown> }
  | { op: 'account.reveal_id'; patch: Record<string, unknown> }
  | { op: 'import.dry_run' }
  | { op: 'import.commit' }
  | { op: 'import.rollback' }
  | { op: 'import.load_demo' }
  | { op: 'import.clear_demo' };
