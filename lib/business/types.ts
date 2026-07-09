/** My Business — company workspace types */

export const TEAM_ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'finance', label: 'Finance' },
  { value: 'operations', label: 'Operations' },
  { value: 'sales', label: 'Sales' },
] as const;

export const TIMEZONES = [
  'Africa/Johannesburg',
  'Africa/Nairobi',
  'Africa/Lagos',
  'Africa/Cairo',
  'Europe/London',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Singapore',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
] as const;

export const CURRENCIES = ['ZAR', 'USD', 'EUR', 'GBP', 'NGN', 'KES', 'AED'] as const;

export type CompanyProfile = {
  id: number;
  trading_name?: string | null;
  legal_name?: string | null;
  email?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  sub_industry?: string | null;
  category?: string | null;
  business_type?: string | null;
  description?: string | null;
  about?: string | null;
  city?: string | null;
  region?: string | null;
  province?: string | null;
  country?: string | null;
  continent?: string | null;
  address?: string | null;
  postal_code?: string | null;
  bee_level?: string | null;
  registration_number?: string | null;
  vat_number?: string | null;
  tax_number?: string | null;
  certifications?: string[] | null;
  wallet_address?: string | null;
  logo_url?: string | null;
  primary_currency?: string | null;
  timezone?: string | null;
  is_buyer?: boolean | null;
  is_discoverable?: boolean | null;
  verification_status?: string | null;
  is_verified?: boolean | null;
  relationship_type?: string | null;
  supplier_status?: string | null;
  public_id?: string | null;
  settings?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export type CompanySettings = {
  timezone: string;
  primary_currency: string;
  emailNotifications: boolean;
  projectUpdates: boolean;
  teamInvites: boolean;
  marketingEmails: boolean;
  poAlerts: boolean;
  riadAlerts: boolean;
  weeklyDigest: boolean;
  is_discoverable: boolean;
  is_buyer: boolean;
  defaultPaymentTerms: string;
  fiscalYearStartMonth: number;
};

export type TeamMember = {
  id: number;
  profile_id: number;
  user_id?: string | null;
  name?: string | null;
  email?: string | null;
  invited_email?: string | null;
  role?: string | null;
  status?: string | null;
  joined_at?: string | null;
  invited_at?: string | null;
  created_at?: string;
};

export const DEFAULT_SETTINGS: CompanySettings = {
  timezone: 'Africa/Johannesburg',
  primary_currency: 'ZAR',
  emailNotifications: true,
  projectUpdates: true,
  teamInvites: true,
  marketingEmails: false,
  poAlerts: true,
  riadAlerts: true,
  weeklyDigest: true,
  is_discoverable: true,
  is_buyer: true,
  defaultPaymentTerms: 'Net 30',
  fiscalYearStartMonth: 3,
};

/** Fields safe to PATCH on profiles from the business profile form */
export const PROFILE_EDITABLE_FIELDS = [
  'trading_name',
  'legal_name',
  'email',
  'contact_name',
  'contact_phone',
  'phone',
  'website',
  'industry',
  'sub_industry',
  'category',
  'business_type',
  'description',
  'about',
  'city',
  'region',
  'province',
  'country',
  'continent',
  'address',
  'postal_code',
  'bee_level',
  'registration_number',
  'vat_number',
  'tax_number',
  'certifications',
  'wallet_address',
  'logo_url',
  'primary_currency',
  'timezone',
  'is_buyer',
  'is_discoverable',
] as const;

export function roleBadgeClass(role?: string | null) {
  switch (String(role || '').toLowerCase()) {
    case 'owner':
      return 'bg-slate-900 text-white';
    case 'admin':
      return 'bg-[#00b4d8]/15 text-[#0077b6]';
    case 'finance':
      return 'bg-emerald-100 text-emerald-800';
    case 'operations':
      return 'bg-violet-100 text-violet-800';
    case 'sales':
      return 'bg-amber-100 text-amber-900';
    case 'viewer':
      return 'bg-neutral-100 text-neutral-600';
    default:
      return 'bg-sky-100 text-sky-800';
  }
}

export function memberStatusClass(s?: string | null) {
  switch (String(s || '').toLowerCase()) {
    case 'active':
      return 'bg-emerald-100 text-emerald-800';
    case 'invited':
    case 'pending':
      return 'bg-amber-100 text-amber-900';
    case 'suspended':
    case 'removed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-neutral-100 text-neutral-600';
  }
}
