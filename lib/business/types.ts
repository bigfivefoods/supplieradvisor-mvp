/** My Business — company workspace types */

import { TEAM_ROLE_OPTIONS } from '@/lib/business/permissions';

/** @deprecated Prefer TEAM_ROLE_OPTIONS from permissions — kept for existing imports */
export const TEAM_ROLES = TEAM_ROLE_OPTIONS.map((r) => ({
  value: r.value,
  label: r.label,
  description: r.description,
  rights: r.rights,
}));

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

/**
 * Full profile shape as stored historically on public.profiles.
 * Includes legacy column names so we never drop existing Supabase data.
 */
export type CompanyProfile = {
  id: number;
  trading_name?: string | null;
  legal_name?: string | null;
  email?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_number?: string | null;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  industries?: string[] | string | null;
  sub_industry?: string | null;
  category?: string | null;
  business_type?: string | null;
  description?: string | null;
  about?: string | null;
  short_description?: string | null;
  city?: string | null;
  region?: string | null;
  province?: string | null;
  country?: string | null;
  continent?: string | null;
  address?: string | null;
  street?: string | null;
  postal_code?: string | null;
  bee_level?: string | null;
  bee_certificate_url?: string | null;
  registration_number?: string | null;
  /** App canonical — dual-reads registration_document_url in production */
  registration_certificate_url?: string | null;
  /** Legacy production column */
  registration_document_url?: string | null;
  vat_number?: string | null;
  tax_number?: string | null;
  tax_document_url?: string | null;
  certifications?: string[] | null;
  iso_certifications?: string[] | null;
  /** Structured certs: { name, awarded_date?, expiry_date?, file_url? }[] */
  uploaded_certificates?: CertificationEntry[] | unknown;
  sub_industries?: string[] | string | null;
  wallet_address?: string | null;
  logo_url?: string | null;
  primary_currency?: string | null;
  timezone?: string | null;
  is_buyer?: boolean | null;
  is_discoverable?: boolean | null;
  verification_status?: string | null;
  is_verified?: boolean | null;
  verified_at?: string | null;
  verification_payment_ref?: string | null;
  relationship_type?: string | null;
  supplier_status?: string | null;
  public_id?: string | null;
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  /** SA 6-digit branch code (for invoices + VerifyNow AVS) */
  branch_code?: string | null;
  /** e.g. Current, Savings */
  account_type?: string | null;
  bank_verification_status?: string | null;
  bank_verified_at?: string | null;
  bank_verification_payment_ref?: string | null;
  iban?: string | null;
  swift?: string | null;
  bank_confirmation_url?: string | null;
  vat_certificate_url?: string | null;
  /** Legacy production column */
  vat_document_url?: string | null;
  director_id_number?: string | null;
  export_license_number?: string | null;
  import_license_number?: string | null;
  /** App canonical — dual-reads export_document_url */
  export_license_url?: string | null;
  /** Legacy production column */
  export_document_url?: string | null;
  /** App canonical — dual-reads import_document_url */
  import_license_url?: string | null;
  /** Legacy production column */
  import_document_url?: string | null;
  /** Per-country export licenses: { country, license_number?, file_url? }[] */
  export_licenses?: ExportLicenseEntry[] | unknown;
  latitude?: number | string | null;
  longitude?: number | string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  settings?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type CertificationEntry = {
  name: string;
  awarded_date?: string | null;
  expiry_date?: string | null;
  file_url?: string | null;
};

export type ExportLicenseEntry = {
  country: string;
  license_number?: string | null;
  file_url?: string | null;
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

/**
 * All columns we allow PATCH to write.
 * Includes legacy names used by the previous profile form so saves never wipe history.
 */
export const PROFILE_EDITABLE_FIELDS = [
  'trading_name',
  'legal_name',
  'email',
  'contact_name',
  'contact_phone',
  'contact_number',
  'phone',
  'website',
  'industry',
  'industries',
  'sub_industry',
  'sub_industries',
  'category',
  'business_type',
  'description',
  'about',
  'short_description',
  'city',
  'region',
  'province',
  'country',
  'continent',
  'address',
  'street',
  'postal_code',
  'latitude',
  'longitude',
  'lat',
  'lng',
  'bee_level',
  'bee_certificate_url',
  'registration_number',
  // App + production aliases for registration docs
  'registration_certificate_url',
  'registration_document_url',
  'vat_number',
  'tax_number',
  'tax_document_url',
  'certifications',
  'iso_certifications',
  'uploaded_certificates',
  'wallet_address',
  'logo_url',
  'primary_currency',
  'timezone',
  'is_buyer',
  'is_discoverable',
  'bank_name',
  'account_name',
  'account_number',
  'branch_code',
  'account_type',
  'iban',
  'swift',
  'bank_confirmation_url',
  'vat_certificate_url',
  'vat_document_url',
  'director_id_number',
  'export_license_number',
  'import_license_number',
  // App + production aliases for licenses
  'export_license_url',
  'export_document_url',
  'import_license_url',
  'import_document_url',
  'export_licenses',
  'metadata',
] as const;

/** Coerce legacy iso_certifications (string[] or {name,selected}[]) into string names. */
function normalizeCertList(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  const names: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) {
      names.push(item.trim());
      continue;
    }
    if (item && typeof item === 'object') {
      const obj = item as { name?: string; selected?: boolean };
      // Old profile UI stored { name, selected, file_url } — keep selected or any named entry
      if (obj.name && (obj.selected === undefined || obj.selected === true)) {
        names.push(String(obj.name));
      }
    }
  }
  return names;
}

function normalizeStringList(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const arr = value.map(String).map((s) => s.trim()).filter(Boolean);
    return arr.length ? arr : null;
  }
  if (typeof value === 'string' && value.trim()) {
    const arr = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return arr.length ? arr : null;
  }
  return null;
}

function normalizeCertEntries(value: unknown): CertificationEntry[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  const out: CertificationEntry[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ name: item.trim() });
      continue;
    }
    if (item && typeof item === 'object') {
      const obj = item as {
        name?: string;
        awarded_date?: string;
        expiry_date?: string;
        file_url?: string;
        selected?: boolean;
      };
      if (obj.name && (obj.selected === undefined || obj.selected === true)) {
        out.push({
          name: String(obj.name),
          awarded_date: obj.awarded_date || null,
          expiry_date: obj.expiry_date || null,
          file_url: obj.file_url || null,
        });
      }
    }
  }
  return out;
}

function normalizeExportLicenses(value: unknown): ExportLicenseEntry[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  return value
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const o = x as ExportLicenseEntry;
      return {
        country: String(o.country || ''),
        license_number: o.license_number || null,
        file_url: o.file_url || null,
      };
    })
    .filter((x) => x.country);
}

/** Normalize a raw profiles row so the UI can bind consistently without losing data. */
export function normalizeProfileRow(row: Record<string, unknown>): CompanyProfile {
  const industriesArr = normalizeStringList(row.industries);
  const industryFromArray =
    industriesArr && industriesArr.length > 0 ? industriesArr[0] : null;

  const certsFromModern = normalizeCertList(row.certifications);
  const certsFromLegacy = normalizeCertList(row.iso_certifications);
  const certs = certsFromModern.length > 0 ? certsFromModern : certsFromLegacy;

  const certEntries = normalizeCertEntries(
    row.uploaded_certificates ?? row.certifications ?? row.iso_certifications
  );
  // Prefer structured entries; fill from name-only certs when empty
  const uploaded =
    certEntries.length > 0
      ? certEntries
      : certs.map((name) => ({ name } as CertificationEntry));

  const subIndustries =
    normalizeStringList(row.sub_industries) ||
    (row.sub_industry ? [String(row.sub_industry)] : null);

  const lat =
    row.latitude != null
      ? row.latitude
      : row.lat != null
        ? row.lat
        : null;
  const lng =
    row.longitude != null
      ? row.longitude
      : row.lng != null
        ? row.lng
        : null;

  return {
    ...row,
    id: Number(row.id),
    // Phone aliases — production historically used contact_number
    contact_phone:
      (row.contact_phone as string) ||
      (row.contact_number as string) ||
      (row.phone as string) ||
      null,
    contact_number:
      (row.contact_number as string) ||
      (row.contact_phone as string) ||
      (row.phone as string) ||
      null,
    phone:
      (row.phone as string) ||
      (row.contact_phone as string) ||
      (row.contact_number as string) ||
      null,
    // Address aliases — production historically used street
    address: (row.address as string) || (row.street as string) || null,
    street: (row.street as string) || (row.address as string) || null,
    // Description aliases — production historically used short_description
    description:
      (row.description as string) ||
      (row.short_description as string) ||
      (row.about as string) ||
      null,
    short_description:
      (row.short_description as string) ||
      (row.description as string) ||
      (row.about as string) ||
      null,
    about:
      (row.about as string) ||
      (row.description as string) ||
      (row.short_description as string) ||
      null,
    // Industry aliases — production used industries[]
    industry: (row.industry as string) || industryFromArray,
    industries: industriesArr ?? (row.industry ? [String(row.industry)] : null),
    sub_industries: subIndustries,
    sub_industry: (row.sub_industry as string) || (subIndustries?.[0] ?? null),
    // Cert aliases — production used iso_certifications (often object[])
    certifications: certs.length ? certs : uploaded.map((c) => c.name),
    iso_certifications: certs.length ? certs : uploaded.map((c) => c.name),
    uploaded_certificates: uploaded,
    // Business type aliases
    business_type:
      (row.business_type as string) || (row.category as string) || null,
    category: (row.category as string) || (row.business_type as string) || null,
    bee_level: (row.bee_level as string) || null,
    bee_certificate_url: (row.bee_certificate_url as string) || null,
    // Document URL dual-read: production uses *_document_url for reg/import/export
    registration_certificate_url:
      (row.registration_certificate_url as string) ||
      (row.registration_document_url as string) ||
      null,
    registration_document_url:
      (row.registration_document_url as string) ||
      (row.registration_certificate_url as string) ||
      null,
    vat_certificate_url:
      (row.vat_certificate_url as string) ||
      (row.vat_document_url as string) ||
      null,
    vat_document_url:
      (row.vat_document_url as string) ||
      (row.vat_certificate_url as string) ||
      null,
    import_license_url:
      (row.import_license_url as string) ||
      (row.import_document_url as string) ||
      null,
    import_document_url:
      (row.import_document_url as string) ||
      (row.import_license_url as string) ||
      null,
    export_license_url:
      (row.export_license_url as string) ||
      (row.export_document_url as string) ||
      null,
    export_document_url:
      (row.export_document_url as string) ||
      (row.export_license_url as string) ||
      null,
    bank_confirmation_url: (row.bank_confirmation_url as string) || null,
    logo_url: (row.logo_url as string) || null,
    tax_document_url: (row.tax_document_url as string) || null,
    // export_licenses may live only in metadata when column missing
    export_licenses: normalizeExportLicenses(
      row.export_licenses ??
        (row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as { export_licenses?: unknown }).export_licenses
          : null)
    ),
    latitude: lat as number | string | null,
    longitude: lng as number | string | null,
    lat: lat as number | string | null,
    lng: lng as number | string | null,
  } as CompanyProfile;
}

export function roleBadgeClass(role?: string | null) {
  const r = String(role || '').toLowerCase().replace(/[\s-]+/g, '_');
  switch (r) {
    case 'owner':
      return 'bg-[#00b4d8] text-white';
    case 'admin':
      return 'bg-[#00b4d8]/15 text-[#0077b6]';
    case 'finance':
      return 'bg-emerald-100 text-emerald-800';
    case 'operations':
      return 'bg-violet-100 text-violet-800';
    case 'sales':
      return 'bg-amber-100 text-amber-900';
    case 'sales_contractor':
    case 'salescontractor':
      return 'bg-orange-100 text-orange-900 border border-orange-200';
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
