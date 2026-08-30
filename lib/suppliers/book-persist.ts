import { bookRoleFromMeta, parsePartyBookRole } from '@/lib/accounting/party-roles';
import { missingSelectColumn } from '@/lib/portals/select-retry';

export const SUPPLIER_PATCH_FIELDS = [
  'trading_name',
  'legal_name',
  'email',
  'phone',
  'contact_name',
  'job_title',
  'website',
  'industry',
  'sub_industry',
  'category',
  'city',
  'region',
  'province',
  'country',
  'continent',
  'address',
  'postal_code',
  'vat_number',
  'registration_number',
  'payment_terms',
  'status',
  'invite_status',
  'wallet_address',
  'certifications',
  'bee_level',
  'verified',
  'owner_name',
  'notes',
  'logo_url',
  'tags',
  'linked_profile_id',
  'connection_id',
  'otifef_pct',
  'trust_score',
  'rating_avg',
  'rating_count',
] as const;

const BOOK_SYNC_KEYS = [
  'vat_number',
  'registration_number',
  'payment_terms',
  'job_title',
  'website',
  'address',
  'continent',
  'province',
  'region',
  'city',
  'country',
  'industry',
] as const;

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

/** Empty string is a valid clear — store null so the column round-trips empty. */
export function emptyToNull(v: unknown): unknown {
  if (v === '') return null;
  return v;
}

export function supplierPatchUpdates(
  body: Record<string, unknown>,
  prevMetadata?: unknown
): Record<string, unknown> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  for (const f of SUPPLIER_PATCH_FIELDS) {
    if (body[f] !== undefined) updates[f] = emptyToNull(body[f]);
  }
  if (updates.province != null && updates.region === undefined) {
    updates.region = updates.province;
  }
  const meta = asRecord(prevMetadata);
  const book = asRecord(meta.book_profile);
  for (const key of BOOK_SYNC_KEYS) {
    if (updates[key] !== undefined) {
      const v = updates[key];
      if (v == null || v === '') delete book[key];
      else book[key] = v;
    }
  }
  meta.book_profile = book;
  const role =
    parsePartyBookRole(body.party_book_role) ||
    bookRoleFromMeta(meta) ||
    'supplier';
  meta.party_book_role = role;
  updates.metadata = meta;
  return updates;
}

/** Strip only the missing column from an UPDATE payload. Columns that exist stay. */
export function stripMissingUpdateColumn(
  updates: Record<string, unknown>,
  errorMessage: string | null | undefined
): Record<string, unknown> | null {
  const missing = missingSelectColumn(errorMessage);
  if (!missing || !(missing in updates)) return null;
  const next = { ...updates };
  delete next[missing];
  return next;
}

export const KELPACK_PINNED_PRODUCT_IDS = [
  2, 3, 4, 5, 6, 7, 8, 9, 42, 44, 45, 46,
] as const;
