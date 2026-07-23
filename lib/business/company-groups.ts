/** Company group relationships — holding, association, franchise, etc. */

export const GROUP_LINK_TYPES = [
  {
    value: 'holding',
    label: 'Holding / subsidiary',
    parentLabel: 'Holding company',
    childLabel: 'Subsidiary',
    description: 'Link an operating company under a holding company.',
  },
  {
    value: 'association',
    label: 'Association membership',
    parentLabel: 'Association / industry body',
    childLabel: 'Member company',
    description: 'Join an association, chamber, or industry body.',
  },
  {
    value: 'group',
    label: 'Corporate group',
    parentLabel: 'Group head',
    childLabel: 'Group member',
    description: 'Generic multi-company group without ownership.',
  },
  {
    value: 'franchise',
    label: 'Franchise',
    parentLabel: 'Franchisor',
    childLabel: 'Franchisee',
    description: 'Franchise network relationship.',
  },
  {
    value: 'joint_venture',
    label: 'Joint venture',
    parentLabel: 'JV partner (lead)',
    childLabel: 'JV partner',
    description: 'Joint venture participation.',
  },
  {
    value: 'affiliate',
    label: 'Affiliate',
    parentLabel: 'Principal',
    childLabel: 'Affiliate',
    description: 'Affiliate or related-party link.',
  },
  {
    value: 'other',
    label: 'Other',
    parentLabel: 'Parent organisation',
    childLabel: 'Related company',
    description: 'Other formal company-to-company relationship.',
  },
] as const;

export type GroupLinkType = (typeof GROUP_LINK_TYPES)[number]['value'];

export const GROUP_LINK_STATUSES = [
  'pending',
  'active',
  'rejected',
  'left',
  'revoked',
] as const;

export type GroupLinkStatus = (typeof GROUP_LINK_STATUSES)[number];

export type GroupLinkDirection = 'request' | 'invite';

export type GroupPeerProfile = {
  id: number;
  trading_name: string | null;
  legal_name: string | null;
  business_type?: string | null;
  industry?: string | null;
  city?: string | null;
  country?: string | null;
  verification_status?: string | null;
  logo_url?: string | null;
};

export type CompanyGroupLink = {
  id: number;
  parent_profile_id: number;
  child_profile_id: number;
  link_type: GroupLinkType | string;
  status: GroupLinkStatus | string;
  ownership_pct?: number | null;
  role_label?: string | null;
  notes?: string | null;
  direction: GroupLinkDirection | string;
  requested_by_user_id?: string | null;
  requested_by_profile_id?: number | null;
  responded_by_user_id?: string | null;
  responded_at?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** Relative to the viewing company */
  role?: 'parent' | 'child';
  peer?: GroupPeerProfile | null;
  peer_display_name?: string | null;
};

export function isGroupLinkType(v: unknown): v is GroupLinkType {
  return (
    typeof v === 'string' &&
    GROUP_LINK_TYPES.some((t) => t.value === v)
  );
}

export function linkTypeMeta(type: string) {
  return (
    GROUP_LINK_TYPES.find((t) => t.value === type) ||
    GROUP_LINK_TYPES[GROUP_LINK_TYPES.length - 1]
  );
}

export function displayCompanyName(
  p: Pick<GroupPeerProfile, 'trading_name' | 'legal_name'> | null | undefined,
  fallbackId?: number
): string {
  if (!p) return fallbackId ? `Company #${fallbackId}` : 'Unknown company';
  return (
    (p.trading_name && String(p.trading_name).trim()) ||
    (p.legal_name && String(p.legal_name).trim()) ||
    (fallbackId ? `Company #${fallbackId}` : 'Unknown company')
  );
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'pending':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'rejected':
      return 'bg-rose-50 text-rose-800 border-rose-200';
    case 'left':
    case 'revoked':
      return 'bg-neutral-100 text-neutral-600 border-neutral-200';
    default:
      return 'bg-neutral-50 text-neutral-700 border-neutral-200';
  }
}

export const MIGRATION_HINT =
  'Run supabase/migrations/20260723_company_group_links.sql';

export const PROFILE_PEER_SELECT =
  'id, trading_name, legal_name, business_type, industry, city, country, verification_status, logo_url';
