import { isPortalDocUrl } from '@/lib/portals/portal-documents';
import { signSensitiveRef, uploadSensitiveDoc } from '@/lib/storage/private-docs';

/** Short-lived signed URLs for portal docs. */
export const PORTAL_SIGNED_URL_SECONDS = 300;

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
    const url = await signSensitiveRef(ref, PORTAL_SIGNED_URL_SECONDS);
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
