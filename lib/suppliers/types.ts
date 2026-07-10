/** Supplier SRM — types, vocab, and OTIFEF helpers */

export const SRM_STATUSES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'preferred', label: 'Preferred' },
  { value: 'active', label: 'Active' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'archived', label: 'Archived' },
] as const;

export const SRM_INVITE_STATUSES = [
  { value: 'not_invited', label: 'Not invited' },
  { value: 'invited', label: 'Invited' },
  { value: 'accepted', label: 'Connected' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
] as const;

export const SUPPLIER_CERTIFICATIONS = [
  'HACCP',
  'ISO 22000',
  'ISO 9001',
  'ISO 14001',
  'Halal',
  'Kosher',
  'BRC',
  'SQF',
  'FSSC 22000',
  'Organic',
  'Fairtrade',
  'GlobalG.A.P.',
  'BEE Level 1',
  'BEE Level 2',
  'BEE Level 3',
  'BEE Level 4',
] as const;

export const SUPPLIER_INDUSTRIES = [
  'Agriculture & Farming',
  'Food & Beverage Processing',
  'Ingredients & Raw Materials',
  'Packaging & Materials',
  'Logistics & Distribution',
  'Cold chain & Storage',
  'Retail & Wholesale',
  'Manufacturing',
  'Chemicals',
  'Technology & Software',
  'Professional services',
  'Other',
] as const;

export const DOC_TYPES = [
  { value: 'contract', label: 'Contract' },
  { value: 'cert', label: 'Certificate' },
  { value: 'sla', label: 'SLA' },
  { value: 'nda', label: 'NDA' },
  { value: 'spec', label: 'Spec / BOM' },
  { value: 'other', label: 'Other' },
] as const;

export type SrmSupplierRecord = {
  id: number;
  profile_id?: number | null;
  trading_name: string;
  legal_name?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_name?: string | null;
  job_title?: string | null;
  website?: string | null;
  industry?: string | null;
  sub_industry?: string | null;
  category?: string | null;
  city?: string | null;
  region?: string | null;
  province?: string | null;
  country?: string | null;
  continent?: string | null;
  address?: string | null;
  postal_code?: string | null;
  status?: string | null;
  invite_status?: string | null;
  invite_token?: string | null;
  invited_at?: string | null;
  invite_accepted_at?: string | null;
  invited_email?: string | null;
  linked_profile_id?: number | null;
  connection_id?: number | null;
  wallet_address?: string | null;
  certifications?: string[] | null;
  bee_level?: string | null;
  verified?: boolean | null;
  trust_score?: number | null;
  otifef_pct?: number | null;
  rating_avg?: number | null;
  rating_count?: number | null;
  owner_name?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
  onchain_tx?: string | null;
  onchain_registered_at?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  /** joined */
  linked_trading_name?: string | null;
  connection_status?: string | null;
  connection_suspended?: boolean;
};

export type DiscoverSupplier = {
  id: number;
  trading_name: string;
  legal_name?: string | null;
  email?: string | null;
  industry?: string | null;
  sub_industry?: string | null;
  category?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  continent?: string | null;
  certifications?: string[] | null;
  trust_score?: number | null;
  otifef_average?: number | null;
  bee_level?: string | null;
  verified?: boolean | null;
  verification_status?: string | null;
  is_verified?: boolean | null;
  wallet_address?: string | null;
  website?: string | null;
  public_id?: string | null;
  relationship_type?: string | null;
  already_connected?: boolean;
  in_my_book?: boolean;
  srm_supplier_id?: number | null;
};

export type OtifefMetrics = {
  overall: number;
  onTime: number;
  inFull: number;
  errorFree: number;
  totalPOs: number;
  supplierCount: number;
};

export type SupplierOtifefRow = {
  supplier_id: number;
  name: string;
  overall: number;
  ot_percent: number;
  if_percent: number;
  ef_percent: number;
  ot_days: number;
  total_pos: number;
  srm_supplier_id?: number | null;
};

export type SupplierInvitation = {
  id: number;
  profile_id: number;
  supplier_id?: number | null;
  email: string;
  full_name?: string | null;
  company_name?: string | null;
  message?: string | null;
  status: string;
  target_profile_id?: number | null;
  invited_by?: string | null;
  expires_at?: string | null;
  accepted_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

/**
 * OTIFEF = (OnTime% × InFull% × ErrorFree%) / 10000
 * Range 0–100.
 */
export function computeOtifef(opts: {
  onTimePct: number;
  inFullPct: number;
  errorFreePct: number;
}): number {
  const ot = clampPct(opts.onTimePct);
  const inf = clampPct(opts.inFullPct);
  const ef = clampPct(opts.errorFreePct);
  return clampPct((ot * inf * ef) / 10000);
}

export function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function otifefBand(pct: number) {
  if (pct >= 95) return { label: 'World class', className: 'bg-emerald-600 text-white' };
  if (pct >= 85) return { label: 'Strong', className: 'bg-sky-600 text-white' };
  if (pct >= 70) return { label: 'Acceptable', className: 'bg-amber-500 text-white' };
  if (pct >= 50) return { label: 'At risk', className: 'bg-orange-500 text-white' };
  return { label: 'Critical', className: 'bg-red-600 text-white' };
}

export function trustBand(score: number) {
  if (score >= 85) return { label: 'Highly trusted', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  if (score >= 70) return { label: 'Trusted', className: 'text-sky-700 bg-sky-50 border-sky-200' };
  if (score >= 50) return { label: 'Building trust', className: 'text-amber-800 bg-amber-50 border-amber-200' };
  return { label: 'Unproven', className: 'text-neutral-600 bg-neutral-50 border-neutral-200' };
}

export function inviteStatusClass(s?: string | null) {
  switch ((s || '').toLowerCase()) {
    case 'accepted':
      return 'bg-emerald-100 text-emerald-800';
    case 'invited':
      return 'bg-sky-100 text-sky-800';
    case 'suspended':
      return 'bg-amber-100 text-amber-900';
    case 'declined':
    case 'expired':
      return 'bg-neutral-200 text-neutral-700';
    default:
      return 'bg-neutral-100 text-neutral-600';
  }
}

export function srmStatusClass(s?: string | null) {
  switch ((s || '').toLowerCase()) {
    case 'active':
    case 'preferred':
      return 'bg-emerald-100 text-emerald-800';
    case 'prospect':
      return 'bg-sky-100 text-sky-800';
    case 'blocked':
      return 'bg-red-100 text-red-800';
    case 'archived':
      return 'bg-neutral-200 text-neutral-600';
    default:
      return 'bg-neutral-100 text-neutral-600';
  }
}

/** Composite trust: 0.45 OTIFEF + 0.35 rating(×20) + 0.20 verified bonus */
export function computeTrustScore(opts: {
  otifef?: number | null;
  ratingAvg?: number | null;
  verified?: boolean | null;
}): number {
  const ot = clampPct(Number(opts.otifef || 0));
  const rating = Math.max(0, Math.min(5, Number(opts.ratingAvg || 0)));
  const ratingPts = (rating / 5) * 100;
  const verifiedBonus = opts.verified ? 100 : 40;
  return Math.round(ot * 0.45 + ratingPts * 0.35 + verifiedBonus * 0.2);
}
