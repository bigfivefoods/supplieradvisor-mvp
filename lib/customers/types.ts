export const LEAD_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'working', label: 'Working' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'unqualified', label: 'Unqualified' },
  { value: 'converted', label: 'Converted' },
  { value: 'recycled', label: 'Recycled' },
] as const;

export const LEAD_SOURCES = [
  'Website',
  'Referral',
  'Cold call',
  'Trade show',
  'Social media',
  'Partner',
  'Email campaign',
  'Walk-in',
  'Existing customer',
  'Other',
] as const;

export const OPPORTUNITY_STAGES = [
  { value: 'prospecting', label: 'Prospecting', probability: 10 },
  { value: 'qualification', label: 'Qualification', probability: 20 },
  { value: 'needs_analysis', label: 'Needs analysis', probability: 40 },
  { value: 'proposal', label: 'Proposal', probability: 60 },
  { value: 'negotiation', label: 'Negotiation', probability: 80 },
  { value: 'closed_won', label: 'Closed won', probability: 100 },
  { value: 'closed_lost', label: 'Closed lost', probability: 0 },
] as const;

export const OPPORTUNITY_TYPES = [
  { value: 'new_business', label: 'New business' },
  { value: 'renewal', label: 'Renewal' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'cross_sell', label: 'Cross-sell' },
] as const;

export const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const;

export type LeadRecord = {
  id: number;
  profile_id?: number | null;
  name: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  website?: string | null;
  status?: string | null;
  source?: string | null;
  source_detail?: string | null;
  industry?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  address?: string | null;
  value_estimate?: number | null;
  currency?: string | null;
  score?: number | null;
  priority?: string | null;
  owner_name?: string | null;
  next_action?: string | null;
  next_action_date?: string | null;
  notes?: string | null;
  product_interest?: string | null;
  converted_customer_id?: number | null;
  converted_opportunity_id?: number | null;
  converted_at?: string | null;
  last_contacted_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type OpportunityRecord = {
  id: number;
  profile_id?: number | null;
  lead_id?: number | null;
  customer_id?: number | null;
  name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  company_name?: string | null;
  stage?: string | null;
  status?: string | null;
  probability?: number | null;
  amount?: number | null;
  currency?: string | null;
  expected_close_date?: string | null;
  actual_close_date?: string | null;
  opportunity_type?: string | null;
  product_interest?: string | null;
  location?: string | null;
  description?: string | null;
  notes?: string | null;
  next_step?: string | null;
  next_step_date?: string | null;
  owner_name?: string | null;
  competitor?: string | null;
  lost_reason?: string | null;
  source?: string | null;
  priority?: string | null;
  created_at?: string;
  updated_at?: string;
  /** weighted = amount * probability / 100 */
  weighted_amount?: number;
};

/** Denormalized platform-invite phase on the seller CRM customer row (not invitation attempt status). */
export const CUSTOMER_INVITE_STATUSES = [
  { value: 'not_invited', label: 'Not invited' },
  { value: 'invited', label: 'Invited' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
] as const;

/** Lifecycle of a single customer_invitations row. */
export const CUSTOMER_INVITATION_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'claiming', label: 'Claiming' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
  { value: 'revoked', label: 'Revoked' },
] as const;

export type CustomerInviteStatus = (typeof CUSTOMER_INVITE_STATUSES)[number]['value'];
export type CustomerInvitationStatus = (typeof CUSTOMER_INVITATION_STATUSES)[number]['value'];

export type CustomerRecord = {
  id: number;
  profile_id?: number | null;
  trading_name: string;
  legal_name?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_name?: string | null;
  job_title?: string | null;
  status?: string | null;
  customer_type?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  credit_limit?: number | null;
  website?: string | null;
  industry?: string | null;
  vat_number?: string | null;
  registration_number?: string | null;
  city?: string | null;
  country?: string | null;
  region?: string | null;
  postal_code?: string | null;
  currency?: string | null;
  payment_terms?: string | null;
  source?: string | null;
  owner_name?: string | null;
  notes?: string | null;
  rating?: number | null;
  /** Linked buyer company profile after invite accept. */
  linked_profile_id?: number | null;
  /** business_connections id for the customer edge (type=customer). */
  connection_id?: number | null;
  /** not_invited | invited | accepted | suspended | declined | expired */
  invite_status?: string | null;
  invite_token?: string | null;
  invited_at?: string | null;
  invite_accepted_at?: string | null;
  invited_email?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CustomerInvitationRecord = {
  id: number;
  token: string;
  profile_id: number;
  customer_id: number;
  email: string;
  full_name?: string | null;
  status?: string | null;
  invited_by?: string | null;
  company_name?: string | null;
  customer_name?: string | null;
  target_profile_id?: number | null;
  message?: string | null;
  user_id?: string | null;
  expires_at?: string | null;
  accepted_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export function formatMoney(amount: number | null | undefined, currency = 'ZAR') {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.length === 3 ? currency : 'ZAR',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(0)}`;
  }
}

export function leadStatusClass(s?: string | null) {
  switch ((s || '').toLowerCase()) {
    case 'qualified':
    case 'converted':
      return 'bg-emerald-100 text-emerald-800';
    case 'contacted':
    case 'working':
      return 'bg-sky-100 text-sky-800';
    case 'unqualified':
    case 'recycled':
      return 'bg-neutral-200 text-neutral-600';
    default:
      return 'bg-violet-100 text-violet-800';
  }
}

export function opportunityStageClass(s?: string | null) {
  switch ((s || '').toLowerCase()) {
    case 'closed_won':
      return 'bg-emerald-100 text-emerald-800';
    case 'closed_lost':
      return 'bg-red-100 text-red-800';
    case 'negotiation':
    case 'proposal':
      return 'bg-amber-100 text-amber-900';
    case 'qualification':
    case 'needs_analysis':
      return 'bg-sky-100 text-sky-800';
    default:
      return 'bg-violet-100 text-violet-800';
  }
}

export function priorityClass(s?: string | null) {
  switch ((s || '').toLowerCase()) {
    case 'urgent':
      return 'bg-red-100 text-red-800';
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'low':
      return 'bg-neutral-100 text-neutral-600';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export function stageProbability(stage?: string | null) {
  const s = OPPORTUNITY_STAGES.find((x) => x.value === stage);
  return s?.probability ?? 10;
}
