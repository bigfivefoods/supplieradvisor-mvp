/**
 * Supporting files on a credit application stay in a private bucket.
 * Callers download them through an authenticated route.
 */
import { randomUUID } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  creditDocumentKind,
  type CreditDocumentKind,
  type CreditDocumentMeta,
} from '@/lib/customers/credit-application';

export const CREDIT_DOC_BUCKET = 'credit-documents';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export type StoredCreditDocument = CreditDocumentMeta & {
  path: string;
  content_type: string;
};

export function publicCreditDocuments(value: unknown): CreditDocumentMeta[] {
  return storedCreditDocuments(value).map(({ id, kind, name, uploaded_at }) => ({
    id,
    kind,
    name,
    uploaded_at,
  }));
}

export function storedCreditDocuments(value: unknown): StoredCreditDocument[] {
  if (!Array.isArray(value)) return [];
  const out: StoredCreditDocument[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const kind = creditDocumentKind(rec.kind);
    const id = String(rec.id || '').trim();
    const path = String(rec.path || '').trim();
    const name = String(rec.name || '').trim().slice(0, 160);
    if (!kind || !id || !path || !name) continue;
    out.push({
      id,
      kind,
      name,
      path,
      content_type: String(rec.content_type || 'application/octet-stream'),
      uploaded_at: String(rec.uploaded_at || ''),
    });
  }
  return out.slice(0, 3);
}

function extOf(name: string, type: string): string {
  const fromName = name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
  if (fromName === 'pdf' || fromName === 'jpg' || fromName === 'jpeg' || fromName === 'png' || fromName === 'webp') {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'pdf';
}

async function ensureBucket(): Promise<string | null> {
  const supabase = getSupabaseServer();
  const created = await supabase.storage.createBucket(CREDIT_DOC_BUCKET, {
    public: false,
    fileSizeLimit: 12 * 1024 * 1024,
    allowedMimeTypes: [...ALLOWED_MIME],
  });
  if (!created.error) return null;
  const msg = created.error.message || '';
  if (/already exists|duplicate/i.test(msg)) return null;
  return msg;
}

export function acceptCreditFile(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (file.size < 8) return 'Choose a file to attach';
  if (file.size > 12 * 1024 * 1024) return 'File must be under 12MB';
  const type = file.type || '';
  if (!ALLOWED_MIME.has(type) && !file.name.toLowerCase().endsWith('.pdf')) {
    return 'Attach a PDF or an image';
  }
  return null;
}

export async function storeCreditDocument(opts: {
  companyId: number;
  customerId: number;
  applicationId: number;
  kind: CreditDocumentKind;
  fileName: string;
  contentType: string;
  body: Buffer;
  existing: StoredCreditDocument[];
}): Promise<StoredCreditDocument[]> {
  const id = randomUUID();
  const ext = extOf(opts.fileName, opts.contentType);
  const path = `${opts.companyId}/credit/${opts.customerId}/${opts.applicationId}/${opts.kind}-${id}.${ext}`;
  const supabase = getSupabaseServer();
  let { error } = await supabase.storage.from(CREDIT_DOC_BUCKET).upload(path, opts.body, {
    contentType: opts.contentType || 'application/pdf',
    upsert: false,
  });
  if (error && /not found|does not exist|bucket/i.test(error.message || '')) {
    const created = await ensureBucket();
    if (created) throw new Error(created);
    const retry = await supabase.storage.from(CREDIT_DOC_BUCKET).upload(path, opts.body, {
      contentType: opts.contentType || 'application/pdf',
      upsert: false,
    });
    error = retry.error;
  }
  if (error) throw new Error(error.message);
  const next: StoredCreditDocument = {
    id,
    kind: opts.kind,
    name: opts.fileName.slice(0, 160),
    path,
    content_type: opts.contentType || 'application/pdf',
    uploaded_at: new Date().toISOString(),
  };
  const previous = opts.existing.find((doc) => doc.kind === opts.kind);
  if (previous?.path) {
    await supabase.storage.from(CREDIT_DOC_BUCKET).remove([previous.path]);
  }
  return [...opts.existing.filter((doc) => doc.kind !== opts.kind), next];
}

export async function readCreditDocument(
  path: string
): Promise<{ body: Buffer; contentType: string } | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.storage.from(CREDIT_DOC_BUCKET).download(path);
  if (error || !data) return null;
  const body = Buffer.from(await data.arrayBuffer());
  const contentType = data.type || 'application/octet-stream';
  return { body, contentType };
}
