/**
 * Production profiles uses older column names for some document URLs
 * (registration_document_url) while the app UI uses *_certificate_url /
 * *_license_url. Always dual-read and dual-write so saves never vanish.
 */

/** Canonical app field → list of physical DB columns to write (first is preferred UI source). */
export const DOCUMENT_URL_ALIASES: Record<string, readonly string[]> = {
  registration_certificate_url: [
    'registration_document_url',
    'registration_certificate_url',
  ],
  vat_certificate_url: ['vat_certificate_url', 'vat_document_url'],
  bee_certificate_url: ['bee_certificate_url'],
  bank_confirmation_url: ['bank_confirmation_url'],
  logo_url: ['logo_url'],
  import_license_url: ['import_document_url', 'import_license_url'],
  export_license_url: ['export_document_url', 'export_license_url'],
  tax_document_url: ['tax_document_url'],
} as const;

/** All DB column names that may hold a company document URL. */
export const ALL_DOCUMENT_DB_COLUMNS = Array.from(
  new Set(Object.values(DOCUMENT_URL_ALIASES).flat())
);

/** App-facing field names used by the profile UI / upload API. */
export const APP_DOCUMENT_FIELDS = Object.keys(DOCUMENT_URL_ALIASES);

/**
 * Expand one app document field into all physical columns for a PATCH body.
 * Example: registration_certificate_url → also sets registration_document_url.
 */
export function expandDocumentUrlWrites(
  updates: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...updates };

  for (const [appField, dbCols] of Object.entries(DOCUMENT_URL_ALIASES)) {
    if (out[appField] === undefined) continue;
    const value = out[appField];
    for (const col of dbCols) {
      if (out[col] === undefined) out[col] = value;
    }
  }

  // If only a legacy DB name was sent, mirror onto the app field
  for (const [appField, dbCols] of Object.entries(DOCUMENT_URL_ALIASES)) {
    if (out[appField] !== undefined) continue;
    for (const col of dbCols) {
      if (out[col] !== undefined) {
        out[appField] = out[col];
        break;
      }
    }
  }

  return out;
}

/**
 * Read document URLs from a raw profiles row into canonical app field names.
 */
export function resolveDocumentUrlsFromRow(
  row: Record<string, unknown>
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const [appField, dbCols] of Object.entries(DOCUMENT_URL_ALIASES)) {
    let found: string | null = null;
    for (const col of dbCols) {
      const v = row[col];
      if (v != null && String(v).trim()) {
        found = String(v);
        break;
      }
    }
    // Also check app field itself
    if (!found && row[appField] != null && String(row[appField]).trim()) {
      found = String(row[appField]);
    }
    result[appField] = found;
  }
  return result;
}

/**
 * Given an app profileField (e.g. registration_certificate_url), return the
 * ordered list of DB columns to update on upload.
 */
export function dbColumnsForAppField(profileField: string): string[] {
  if (DOCUMENT_URL_ALIASES[profileField]) {
    return [...DOCUMENT_URL_ALIASES[profileField]];
  }
  // Accept legacy DB names directly
  for (const [appField, cols] of Object.entries(DOCUMENT_URL_ALIASES)) {
    if (cols.includes(profileField) || appField === profileField) {
      return [...cols];
    }
  }
  return [profileField];
}

/** Storage buckets that exist in production (verified). */
export const COMPANY_DOC_BUCKETS = ['company-documents', 'certificates'] as const;
export const COMPANY_IMAGE_BUCKETS = [
  'company-documents',
  'certificates',
  'container-photos',
  'container-images',
] as const;
