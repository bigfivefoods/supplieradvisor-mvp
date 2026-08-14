/**
 * B2C member account with an Advisor — client-safe types.
 * Charges live on the company; members pay in SA Member.
 */

export const ADVISOR_ACCOUNT_KINDS = [
  'gym',
  'physio',
  'dental',
  'medical',
  'psychiatry',
  'hire',
] as const;

export type AdvisorAccountKind = (typeof ADVISOR_ACCOUNT_KINDS)[number];

export const ADVISOR_ACCOUNT_MODULES = [
  'fitgraph',
  'physiograph',
  'dentalgraph',
  'medicalgraph',
  'psychiatrygraph',
  'hiregraph',
] as const;

export type AdvisorAccountModule = (typeof ADVISOR_ACCOUNT_MODULES)[number];

export const KIND_TO_MODULE: Record<AdvisorAccountKind, AdvisorAccountModule> = {
  gym: 'fitgraph',
  physio: 'physiograph',
  dental: 'dentalgraph',
  medical: 'medicalgraph',
  psychiatry: 'psychiatrygraph',
  hire: 'hiregraph',
};

export const MODULE_TO_KIND: Record<AdvisorAccountModule, AdvisorAccountKind> = {
  fitgraph: 'gym',
  physiograph: 'physio',
  dentalgraph: 'dental',
  medicalgraph: 'medical',
  psychiatrygraph: 'psychiatry',
  hiregraph: 'hire',
};

export type MemberChargeStatus = 'open' | 'pending_pop' | 'paid' | 'void';
export type MemberPaymentMethod = 'paystack' | 'pop' | 'cash' | 'eft';
export type MemberPaymentStatus = 'pending' | 'confirmed' | 'rejected';
export type MemberChargeSource =
  | 'desk'
  | 'subscription'
  | 'visit'
  | 'hire'
  | 'pack';

export type MemberAccountCharge = {
  id: string;
  kind: AdvisorAccountKind;
  ref_id: string;
  member_name: string;
  member_email?: string | null;
  member_user_id?: string | null;
  description: string;
  amount_zar: number;
  status: MemberChargeStatus;
  due_date?: string | null;
  created_at: string;
  created_by?: string | null;
  source: MemberChargeSource;
  source_id?: string | null;
  invoice_id?: number | null;
  invoice_number?: string | null;
  customer_id?: number | null;
};

export type MemberAccountPayment = {
  id: string;
  charge_ids: string[];
  amount_zar: number;
  method: MemberPaymentMethod;
  status: MemberPaymentStatus;
  reference?: string | null;
  paystack_ref?: string | null;
  proof_url?: string | null;
  notes?: string | null;
  paid_at: string;
  confirmed_at?: string | null;
  confirmed_by?: string | null;
  member_name?: string | null;
  member_email?: string | null;
  member_user_id?: string | null;
  kind?: AdvisorAccountKind;
  ref_id?: string | null;
};

export type MemberAccountStore = {
  charges: MemberAccountCharge[];
  payments: MemberAccountPayment[];
  updated_at?: string;
};

export type MemberAccountSuggestion = {
  source: MemberChargeSource;
  source_id: string;
  kind: AdvisorAccountKind;
  ref_id: string;
  member_name: string;
  member_email?: string | null;
  description: string;
  amount_zar: number;
  due_date?: string | null;
};

export type MemberAccountSummary = {
  company_id: number;
  brand: string;
  kind: AdvisorAccountKind;
  ref_id: string;
  member_name: string;
  open_zar: number;
  pending_zar: number;
  paid_zar: number;
  open_count: number;
  pending_count: number;
};

export function isAdvisorAccountKind(v: unknown): v is AdvisorAccountKind {
  return ADVISOR_ACCOUNT_KINDS.includes(String(v) as AdvisorAccountKind);
}

export function isAdvisorAccountModule(v: unknown): v is AdvisorAccountModule {
  return ADVISOR_ACCOUNT_MODULES.includes(String(v) as AdvisorAccountModule);
}

export function emptyMemberAccountStore(): MemberAccountStore {
  return { charges: [], payments: [] };
}

export function chargeBalance(c: MemberAccountCharge): number {
  if (c.status === 'void' || c.status === 'paid') return 0;
  return Math.max(0, Number(c.amount_zar) || 0);
}

export function formatZar(n: number): string {
  const v = Number(n) || 0;
  return `R${v.toLocaleString('en-ZA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function kindAccountLabel(kind: string): string {
  if (kind === 'gym') return 'Gym account';
  if (kind === 'physio') return 'Physio account';
  if (kind === 'dental') return 'Dental account';
  if (kind === 'medical') return 'Medical account';
  if (kind === 'psychiatry') return 'Psychiatry account';
  if (kind === 'hire') return 'Hire account';
  return 'Account';
}
