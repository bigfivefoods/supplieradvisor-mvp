/**
 * GymAdvisor® debit orders — shared types.
 * Amounts are integer cents. Account numbers and service keys are never
 * part of the public shapes returned to the browser.
 */

export const MANDATE_STATUSES = ['pending', 'active', 'suspended', 'cancelled'] as const;
export type MandateStatus = (typeof MANDATE_STATUSES)[number];

export const RUN_STATUSES = [
  'preview',
  'submitted',
  'polling',
  'reconciled',
  'failed',
  'cancelled',
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const LINE_STATUSES = [
  'scheduled',
  'submitted',
  'paid',
  'unpaid',
  'reversed',
  'skipped',
  'review',
] as const;
export type LineStatus = (typeof LINE_STATUSES)[number];

export const NETCASH_MODES = ['test', 'live'] as const;
export type NetcashMode = (typeof NETCASH_MODES)[number];

export const CADENCES = ['monthly', 'weekly', 'fortnightly'] as const;
export type BillingCadence = (typeof CADENCES)[number];

export const ACCOUNT_TYPES = ['cheque', 'current', 'savings', 'transmission'] as const;
export type MandateAccountType = (typeof ACCOUNT_TYPES)[number];

export type NetcashSettings = {
  companyId: number;
  merchantAccount: string;
  /** Sealed service key. Null when the gym has not stored one. */
  serviceKeyEnc: string | null;
  serviceKeyLast4: string;
  serviceKeyConfigured: boolean;
  accountKeyEnc: string | null;
  accountKeyLast4: string;
  accountKeyConfigured: boolean;
  mode: NetcashMode;
  debitDay: number;
  cadence: BillingCadence;
  leadBusinessDays: number;
  cutoffHourSast: number;
  cutoffMinute: number;
  pricesIncludeVat: boolean;
  vatBps: number;
  invoicePrefix: string;
  creditPrefix: string;
  lateFeeCents: number;
  retryMaxAttempts: number;
  autoSubmit: boolean;
  autoSuspendAccess: boolean;
  dunningEmail: boolean;
  allowAmountVariance: boolean;
  glBankCode: string;
  glArCode: string;
  glRevenueCode: string;
  glVatCode: string;
  glFeeCode: string;
  updatedAt: string;
  updatedBy: string;
};

export type Mandate = {
  id: string;
  companyId: number;
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  accountHolder: string;
  bankName: string;
  branchCode: string;
  accountType: MandateAccountType;
  /** Sealed. Empty string when not stored. */
  accountNumberEnc: string;
  accountLast4: string;
  validationStatus: 'unchecked' | 'valid' | 'invalid' | 'error';
  validationRef: string;
  debitDay: number;
  amountCents: number;
  currency: 'ZAR';
  status: MandateStatus;
  consentText: string;
  consentVersion: string;
  signedAt: string | null;
  signedIp: string;
  signedUserAgent: string;
  netcashRef: string;
  masterfileBatchId: string;
  masterfileUploadedAt: string | null;
  startsOn: string;
  endsOn: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BillablePlan = {
  id: string;
  name: string;
  cents: number;
  addon: boolean;
  billing: 'monthly' | 'weekly' | 'annual' | 'pack' | 'drop_in';
};

export type BillableMember = {
  memberId: string;
  name: string;
  email: string;
  phone: string;
  crmCustomerId: number | null;
  startDate: string | null;
  active: boolean;
  /** Discount in basis points applied to the gross membership amount. */
  discountBps: number;
  plans: BillablePlan[];
};

export type InvoiceLineDraft = {
  description: string;
  quantity: number;
  unitCents: number;
  amountCents: number;
  taxBps: number;
  accountCode: string;
  kind: 'plan' | 'addon' | 'discount' | 'prorata' | 'late_fee';
};

export type BillingLine = {
  id: string;
  companyId: number;
  runId: string;
  mandateId: string | null;
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  crmCustomerId: number | null;
  description: string;
  planCents: number;
  addonCents: number;
  discountCents: number;
  prorataCents: number;
  feeCents: number;
  netCents: number;
  vatCents: number;
  totalCents: number;
  items: InvoiceLineDraft[];
  invoiceId: number | null;
  invoiceNumber: string;
  creditNoteId: number | null;
  creditNoteNumber: string;
  collectionStatus: LineStatus;
  skipReason: string;
  netcashReasonCode: string;
  netcashReasonText: string;
  retryOfLineId: string | null;
  attempt: number;
  accessSuspended: boolean;
  notifiedAt: string | null;
  whatsappPath: string;
  idempotencyKey: string;
  financeStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type BillingRun = {
  id: string;
  companyId: number;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  status: RunStatus;
  requestedActionDate: string;
  actionDate: string;
  cutoffApplied: boolean;
  holidayShifted: boolean;
  actionDateNote: string;
  expectedCents: number;
  collectedCents: number;
  unpaidCents: number;
  memberCount: number;
  batchCount: number;
  idempotencyKey: string;
  netcashBatchId: string;
  fileSha256: string;
  submittedAt: string | null;
  reconciledAt: string | null;
  approvedAt: string | null;
  approvedBy: string;
  createdBy: string;
  error: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditEvent = {
  id: string;
  companyId: number;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  ip: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

export type AccessHold = {
  id: string;
  companyId: number;
  memberId: string;
  memberName: string;
  reason: string;
  active: boolean;
  createdAt: string;
  releasedAt: string | null;
};

export type JobRecord = {
  id: string;
  companyId: number;
  kind: 'submit_batch' | 'poll_results' | 'issue_invoices' | 'scheduled_preview';
  idempotencyKey: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  attempts: number;
  runId: string | null;
  lastError: string;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BatchLineResult = {
  netcashRef: string;
  outcome: 'paid' | 'unpaid' | 'reversed';
  reasonCode: string;
};

export type PublicSettings = Omit<NetcashSettings, 'serviceKeyEnc'> & {
  serviceKeyEnc?: never;
};

export type PublicMandate = Omit<Mandate, 'accountNumberEnc'> & {
  accountNumberMasked: string;
};
