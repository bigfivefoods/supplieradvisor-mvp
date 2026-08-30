import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isPortalDocUrl } from '@/lib/portals/portal-documents';

export const PORTAL_DOC_BUCKETS = [
  'company-documents',
  'product-documents',
] as const;

/** Signed URLs live at least 7 days; 30 days keeps portal slots open. */
export const PORTAL_SIGNED_URL_SECONDS = 60 * 60 * 24 * 30;

const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

async function ensureBucket(name: string): Promise<string | null> {
  const supabase = getSupabaseServer();
  const created = await supabase.storage.createBucket(name, {
    public: true,
    fileSizeLimit: 12 * 1024 * 1024,
    allowedMimeTypes: ALLOWED_MIME,
  });
  if (!created.error) return null;
  const msg = created.error.message || '';
  if (/already exists|duplicate/i.test(msg)) {
    await supabase.storage.updateBucket(name, { public: true }).catch(() => null);
    return null;
  }
  return msg;
}

async function signedOrPublicUrl(
  bucket: string,
  path: string
): Promise<string | null> {
  const supabase = getSupabaseServer();
  const signed = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, PORTAL_SIGNED_URL_SECONDS);
  const signedUrl = signed.data?.signedUrl || null;
  if (signedUrl && isPortalDocUrl(signedUrl)) return signedUrl;
  const pub = supabase.storage.from(bucket).getPublicUrl(path);
  const publicUrl = pub.data?.publicUrl || null;
  if (publicUrl && isPortalDocUrl(publicUrl)) return publicUrl;
  return signedUrl || publicUrl || null;
}

export async function uploadPortalDocument(opts: {
  path: string;
  body: Buffer;
  contentType: string;
}): Promise<{ ok: true; url: string; bucket: string } | { ok: false; error: string }> {
  const supabase = getSupabaseServer();
  let last = '';
  for (const bucket of PORTAL_DOC_BUCKETS) {
    let { error } = await supabase.storage.from(bucket).upload(opts.path, opts.body, {
      contentType: opts.contentType,
      upsert: true,
    });
    if (error && /not found|does not exist|bucket/i.test(error.message || '')) {
      const created = await ensureBucket(bucket);
      if (created) last = created;
      const retry = await supabase.storage.from(bucket).upload(opts.path, opts.body, {
        contentType: opts.contentType,
        upsert: true,
      });
      error = retry.error;
    }
    if (error) {
      last = error.message;
      continue;
    }
    const url = await signedOrPublicUrl(bucket, opts.path);
    if (url && isPortalDocUrl(url)) {
      return { ok: true, url, bucket };
    }
    last = 'Upload stored but no http(s) URL was returned';
  }
  return {
    ok: false,
    error: last || 'Upload failed',
  };
}
