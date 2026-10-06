import { randomBytes } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';

export const SENSITIVE_DOC_BUCKET = 'sensitive-documents';
export const LEGACY_PUBLIC_BUCKETS = new Set([
  'company-documents',
  'certificates',
  'product-documents',
]);

const LEGACY_PUBLIC_PATH = '/storage/v1/object/public/';

export type StoredDocTarget = {
  bucket: string;
  path: string;
};

export type ResolvedStoredDoc = {
  input: string;
  primary: StoredDocTarget;
  candidates: StoredDocTarget[];
  legacy: boolean;
};

function clampSeconds(seconds?: number): number {
  const n = Number(seconds || 300);
  if (!Number.isFinite(n)) return 300;
  return Math.min(300, Math.max(1, Math.floor(n)));
}

function cleanSegment(value: string, fallback: string): string {
  const out = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-');
  return out || fallback;
}

function cleanExt(value?: string | null, contentType?: string): string {
  const ext = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10);
  if (ext) return ext;
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType?.startsWith('image/')) {
    return contentType.slice(6).replace(/[^a-z0-9]/g, '') || 'img';
  }
  return 'bin';
}

export function parseStorageRef(ref: string): StoredDocTarget | null {
  const text = String(ref || '').trim();
  if (!text.startsWith('sb://')) return null;
  const rest = text.slice(5);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  const bucket = rest.slice(0, slash).trim();
  const path = rest.slice(slash + 1).trim().replace(/^\/+/, '');
  if (!bucket || !path) return null;
  return { bucket, path };
}

export function toStorageRef(target: StoredDocTarget): string {
  return `sb://${target.bucket}/${target.path.replace(/^\/+/, '')}`;
}

export function parseLegacyPublicStorageUrl(input: string): StoredDocTarget | null {
  try {
    const raw = String(input || '').trim();
    const url = new URL(raw);
    const idx = url.pathname.indexOf(LEGACY_PUBLIC_PATH);
    if (idx < 0) return null;
    const suffix = url.pathname.slice(idx + LEGACY_PUBLIC_PATH.length);
    const parts = suffix.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const bucket = parts[0];
    const path = parts.slice(1).join('/');
    if (!LEGACY_PUBLIC_BUCKETS.has(bucket) || !path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

export function resolveStoredDoc(input: string): ResolvedStoredDoc {
  const ref = parseStorageRef(input);
  if (ref) {
    return {
      input,
      primary: ref,
      candidates: [ref],
      legacy: false,
    };
  }

  const legacy = parseLegacyPublicStorageUrl(input);
  if (!legacy) throw new Error('Unsupported storage reference');

  const migrated: StoredDocTarget = {
    bucket: SENSITIVE_DOC_BUCKET,
    path: `legacy/${legacy.bucket}/${legacy.path}`,
  };

  return {
    input,
    primary: migrated,
    candidates: [migrated, legacy],
    legacy: true,
  };
}

export async function ensureSensitiveBucket(): Promise<string | null> {
  const supabase = getSupabaseServer();
  const created = await supabase.storage.createBucket(SENSITIVE_DOC_BUCKET, {
    public: false,
    fileSizeLimit: 25 * 1024 * 1024,
  });
  if (!created.error) return null;
  const msg = created.error.message || '';
  if (/already exists|duplicate/i.test(msg)) return null;
  return msg;
}

export async function uploadSensitiveDoc(opts: {
  companyId: number | string;
  kind: string;
  body: Buffer;
  contentType?: string;
  ext?: string | null;
}): Promise<string> {
  const owner = cleanSegment(String(opts.companyId), 'owner');
  const kind = cleanSegment(opts.kind, 'document');
  const ext = cleanExt(opts.ext, opts.contentType);
  const ts = Date.now();
  const rand = randomBytes(8).toString('hex');
  const path = `${owner}/${kind}/${ts}-${rand}.${ext}`;
  const supabase = getSupabaseServer();

  let { error } = await supabase.storage.from(SENSITIVE_DOC_BUCKET).upload(path, opts.body, {
    upsert: false,
    contentType: opts.contentType || 'application/octet-stream',
  });

  if (error && /bucket[^\n]*not found|does not exist/i.test(error.message || '')) {
    const ensured = await ensureSensitiveBucket();
    if (ensured) throw new Error(ensured);
    const retry = await supabase.storage.from(SENSITIVE_DOC_BUCKET).upload(path, opts.body, {
      upsert: false,
      contentType: opts.contentType || 'application/octet-stream',
    });
    error = retry.error;
  }

  if (error) throw new Error(error.message || 'Upload failed');
  return toStorageRef({ bucket: SENSITIVE_DOC_BUCKET, path });
}

export async function signSensitiveRef(ref: string, seconds?: number): Promise<string> {
  const target = parseStorageRef(ref);
  if (!target) throw new Error('Invalid storage reference');
  const supabase = getSupabaseServer();
  const signed = await supabase.storage
    .from(target.bucket)
    .createSignedUrl(target.path, clampSeconds(seconds));
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(signed.error?.message || 'Could not sign file');
  }
  return signed.data.signedUrl;
}
