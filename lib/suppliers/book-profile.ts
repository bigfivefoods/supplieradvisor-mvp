import {
  mergePortalDocSlots,
  type PortalDocSlot,
} from '@/lib/portals/portal-documents';
import type { SrmSupplierRecord } from '@/lib/suppliers/types';

/** Same identity fields the supplier portal Profile tab reads and writes. */
export type SrmBookProfile = {
  logo_url: string;
  trading_name: string;
  legal_name: string;
  contact_name: string;
  job_title: string;
  email: string;
  phone: string;
  website: string;
  vat_number: string;
  registration_number: string;
  address: string;
  city: string;
  country: string;
  payment_terms: string;
  industry: string;
};

export const SRM_BOOK_PROFILE_FIELDS: Array<{
  key: keyof SrmBookProfile;
  label: string;
  required?: boolean;
  span?: boolean;
}> = [
  { key: 'trading_name', label: 'Trading name', required: true },
  { key: 'legal_name', label: 'Legal name' },
  { key: 'contact_name', label: 'Contact name', required: true },
  { key: 'job_title', label: 'Job title' },
  { key: 'email', label: 'Email', required: true },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'website', label: 'Website', span: true },
  { key: 'vat_number', label: 'VAT number' },
  { key: 'registration_number', label: 'Registration number' },
  { key: 'address', label: 'Street address', span: true },
  { key: 'city', label: 'City', required: true },
  { key: 'country', label: 'Country', required: true },
  { key: 'payment_terms', label: 'Payment terms' },
  { key: 'industry', label: 'Industry' },
];

export const EMPTY_SRM_BOOK_PROFILE: SrmBookProfile = {
  logo_url: '',
  trading_name: '',
  legal_name: '',
  contact_name: '',
  job_title: '',
  email: '',
  phone: '',
  website: '',
  vat_number: '',
  registration_number: '',
  address: '',
  city: '',
  country: '',
  payment_terms: '',
  industry: '',
};

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function pick(row: Record<string, unknown>, key: string): string {
  const meta = asRecord(row.metadata);
  const book = asRecord(meta.book_profile);
  const v = row[key] ?? book[key] ?? meta[key] ?? '';
  return String(v || '').trim();
}

export function srmRecordToBookProfile(
  s: SrmSupplierRecord | Record<string, unknown> | null | undefined
): SrmBookProfile {
  if (!s) return { ...EMPTY_SRM_BOOK_PROFILE };
  const row = s as unknown as Record<string, unknown>;
  return {
    logo_url: pick(row, 'logo_url'),
    trading_name: pick(row, 'trading_name'),
    legal_name: pick(row, 'legal_name'),
    contact_name: pick(row, 'contact_name'),
    job_title: pick(row, 'job_title'),
    email: pick(row, 'email'),
    phone: pick(row, 'phone'),
    website: pick(row, 'website'),
    vat_number: pick(row, 'vat_number'),
    registration_number: pick(row, 'registration_number'),
    address: pick(row, 'address'),
    city: pick(row, 'city'),
    country: pick(row, 'country'),
    payment_terms: pick(row, 'payment_terms'),
    industry: pick(row, 'industry'),
  };
}

export function srmBookProfileGaps(p: SrmBookProfile | null): string[] {
  if (!p) {
    return SRM_BOOK_PROFILE_FIELDS.filter((f) => f.required).map((f) => f.label);
  }
  return SRM_BOOK_PROFILE_FIELDS.filter(
    (f) => f.required && !String(p[f.key] || '').trim()
  ).map((f) => f.label);
}

export function srmPortalDocuments(
  s: SrmSupplierRecord | Record<string, unknown> | null | undefined
): PortalDocSlot[] {
  if (!s) return mergePortalDocSlots({});
  const row = s as unknown as Record<string, unknown>;
  return mergePortalDocSlots({
    profileRow: row,
    metadata: row.metadata,
  });
}
