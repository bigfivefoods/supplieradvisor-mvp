import { isPortalDocUrl } from '@/lib/portals/portal-documents';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { parseStorageRef, uploadSensitiveDoc } from '@/lib/storage/private-docs';

/** Short-lived signed URLs for portal docs. */
export const PORTAL_SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

function companyIdFromPath(path: string): string {
  return String(path.split('/').filter(Boolean)[0] || 'portal').slice(0, 80);
}

export async function uploadPortalDocument(opts: {
  path: string;
  body: Buffer;
  contentType: string;
}): Promise<{ ok: true; url: string; ref: string; bucket: string } | { ok: false; error: string }> {
  try {
    const ext =
      opts.path.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
      (opts.contentType === 'application/pdf' ? 'pdf' : 'bin');
    const ref = await uploadSensitiveDoc({
      companyId: companyIdFromPath(opts.path),
      kind: opts.path.includes('portal-docs') ? 'portal-docs' : 'portal-po',
      body: opts.body,
      contentType: opts.contentType,
      ext,
    });
    const url = await signPortalDocumentRef(ref);
    if (!isPortalDocUrl(url)) {
      return { ok: false, error: 'Upload stored but signed URL is invalid' };
    }
    return { ok: true, url, ref, bucket: 'sensitive-documents' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

export async function signPortalDocumentRef(ref: string): Promise<string> {
  const parsed = parseStorageRef(ref);
  if (!parsed) throw new Error('Invalid storage reference');
  const supabase = getSupabaseServer();
  const signed = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, PORTAL_SIGNED_URL_SECONDS);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(signed.error?.message || 'Could not sign file');
  }
  return signed.data.signedUrl;
}
