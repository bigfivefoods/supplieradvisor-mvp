/**
 * Shared required-document slots on customer and supplier portals.
 * Same field list for host company and the account (customer/supplier)
 * so both parties see — and can fill — the same pack.
 */
import { resolveDocumentUrlsFromRow } from '@/lib/business/documentFields';

export const PORTAL_REQUIRED_DOCS = [
  {
    field: 'registration_certificate_url',
    name: 'Company registration',
    category: 'Legal',
  },
  {
    field: 'vat_certificate_url',
    name: 'VAT certificate',
    category: 'Financial',
  },
  {
    field: 'bee_certificate_url',
    name: 'B-BBEE certificate',
    category: 'Legal',
  },
  {
    field: 'bank_confirmation_url',
    name: 'Bank confirmation letter',
    category: 'Financial',
  },
  {
    field: 'import_license_url',
    name: 'Import license',
    category: 'Legal',
  },
  {
    field: 'export_license_url',
    name: 'Export license',
    category: 'Legal',
  },
  {
    field: 'tax_document_url',
    name: 'Tax document',
    category: 'Financial',
  },
] as const;

export type PortalRequiredDocField = (typeof PORTAL_REQUIRED_DOCS)[number]['field'];

export type PortalDocSlot = {
  field: string;
  name: string;
  url: string | null;
  category: string;
  extra?: boolean;
};

const REQUIRED_FIELDS = new Set<string>(
  PORTAL_REQUIRED_DOCS.map((d) => d.field)
);

function asObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function cleanUrl(v: unknown): string | null {
  const s = String(v || '').trim();
  return s ? s : null;
}

export function isPortalRequiredDocField(
  field: string
): field is PortalRequiredDocField {
  return REQUIRED_FIELDS.has(field);
}

export function isPortalDocUrl(url: string): boolean {
  const u = String(url || '').trim();
  if (u.length < 8 || u.length > 4000) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function emptyRequiredDocSlots(): PortalDocSlot[] {
  return PORTAL_REQUIRED_DOCS.map((d) => ({
    field: d.field,
    name: d.name,
    category: d.category,
    url: null,
  }));
}

function matchRequired(field: string, name: string) {
  const f = field.trim();
  const n = name.trim().toLowerCase();
  return PORTAL_REQUIRED_DOCS.find(
    (d) => d.field === f || d.name.toLowerCase() === n
  );
}

/** Pull required-field URLs from CRM/SRM metadata (required_documents + documents list). */
export function urlsFromDocMetadata(
  metadata: unknown
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const meta = asObject(metadata);
  const required = asObject(meta.required_documents);
  for (const d of PORTAL_REQUIRED_DOCS) {
    const hit = cleanUrl(required[d.field]) || cleanUrl(required[d.name]);
    if (hit) out[d.field] = hit;
  }
  const list = Array.isArray(meta.documents) ? meta.documents : [];
  for (const item of list) {
    const row = asObject(item);
    const url = cleanUrl(row.url);
    if (!url) continue;
    const match = matchRequired(String(row.field || ''), String(row.name || ''));
    if (match && !out[match.field]) out[match.field] = url;
  }
  return out;
}

function extraSlotsFromMetadata(metadata: unknown): PortalDocSlot[] {
  const meta = asObject(metadata);
  const list = Array.isArray(meta.documents) ? meta.documents : [];
  const out: PortalDocSlot[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const row = asObject(item);
    const url = cleanUrl(row.url);
    if (!url) continue;
    const name = String(row.name || 'Document').trim() || 'Document';
    const field = String(row.field || '').trim();
    if (matchRequired(field, name)) continue;
    const key = `${name.toLowerCase()}::${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      field: field || `extra:${name.toLowerCase().replace(/\s+/g, '_').slice(0, 40)}`,
      name,
      url,
      category: String(row.category || 'Other'),
      extra: true,
    });
    if (out.length >= 16) break;
  }
  return out;
}

/**
 * Always returns the full required field set (empty slots included) plus
 * any extra vault files. Later sources overlay earlier ones.
 */
export function mergePortalDocSlots(opts: {
  profileRow?: Record<string, unknown> | null;
  metadata?: unknown;
}): PortalDocSlot[] {
  const row = opts.profileRow || null;
  const rowUrls = row ? resolveDocumentUrlsFromRow(row) : {};
  const profileMeta = urlsFromDocMetadata(row?.metadata);
  const bookMeta = urlsFromDocMetadata(
    opts.metadata !== undefined ? opts.metadata : row?.metadata
  );
  const urls: Record<string, string | null> = {};
  for (const d of PORTAL_REQUIRED_DOCS) {
    urls[d.field] =
      bookMeta[d.field] ||
      profileMeta[d.field] ||
      cleanUrl(rowUrls[d.field]) ||
      null;
  }
  const extras = [
    ...extraSlotsFromMetadata(row?.metadata),
    ...extraSlotsFromMetadata(
      opts.metadata !== undefined ? opts.metadata : undefined
    ),
  ];
  const seen = new Set<string>();
  const extra: PortalDocSlot[] = [];
  for (const e of extras) {
    const key = `${e.name.toLowerCase()}::${e.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    extra.push(e);
  }
  return [
    ...PORTAL_REQUIRED_DOCS.map((d) => ({
      field: d.field,
      name: d.name,
      category: d.category,
      url: urls[d.field] || null,
    })),
    ...extra,
  ];
}

export function applyPortalDocSlotUrl(
  slots: PortalDocSlot[] | undefined,
  field: string,
  url: string | null
): PortalDocSlot[] {
  const list = slots?.length ? slots : emptyRequiredDocSlots();
  let hit = false;
  const next = list.map((d) => {
    if (d.field !== field) return d;
    hit = true;
    return { ...d, url };
  });
  if (hit) return next;
  const known = PORTAL_REQUIRED_DOCS.find((d) => d.field === field);
  if (!known) return next;
  return next.map((d) => (d.field === known.field ? { ...d, url } : d));
}

/** Persist a required-doc URL into CRM/SRM metadata without dropping other keys. */
export function mergeRequiredDocIntoMetadata(
  metadata: unknown,
  field: string,
  url: string | null,
  nowIso: string
): Record<string, unknown> {
  const meta = { ...asObject(metadata) };
  const required = { ...asObject(meta.required_documents) };
  const known = PORTAL_REQUIRED_DOCS.find((d) => d.field === field);
  if (url) required[field] = url;
  else delete required[field];
  meta.required_documents = required;
  const list = Array.isArray(meta.documents) ? [...meta.documents] : [];
  const nextList: unknown[] = [];
  for (const item of list) {
    const row = asObject(item);
    const match = matchRequired(String(row.field || ''), String(row.name || ''));
    if (match?.field === field) continue;
    nextList.push(item);
  }
  if (url && known) {
    nextList.unshift({
      field,
      name: known.name,
      url,
      category: known.category,
      uploaded_at: nowIso,
    });
  }
  meta.documents = nextList;
  return meta;
}

export function mergeExtraDocIntoMetadata(
  metadata: unknown,
  opts: { name: string; url: string; category: string; nowIso: string }
): Record<string, unknown> {
  const meta = { ...asObject(metadata) };
  const list = Array.isArray(meta.documents) ? [...meta.documents] : [];
  const slug = opts.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'document';
  list.unshift({
    field: `extra:${slug}:${Date.now()}`,
    name: opts.name.slice(0, 160),
    url: opts.url,
    category: opts.category.slice(0, 40) || 'Other',
    extra: true,
    uploaded_at: opts.nowIso,
  });
  meta.documents = list.slice(0, 40);
  return meta;
}

export function filledPortalDocs(
  slots: PortalDocSlot[]
): Array<{ name: string; url: string; category: string }> {
  return slots
    .filter((s) => s.url)
    .map((s) => ({
      name: s.name,
      url: s.url as string,
      category: s.category,
    }));
}
