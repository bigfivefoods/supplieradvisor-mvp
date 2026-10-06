import { randomUUID } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';

export const CREDIT_APPLICATION_BUCKET = 'credit-application-documents';
export const CREDIT_SIGNED_URL_SECONDS = 300;

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

function sanitizeDocType(v: unknown): string {
  return String(v || 'other').toLowerCase().replace(/[^a-z0-9_\-]/g, '').slice(0, 40) || 'other';
}

export function creditDocumentPath(input: {
  profileId: number;
  applicationId: number;
  docType: string;
  mimeType: string;
}): string {
  const ext = EXT_BY_MIME[input.mimeType] || 'bin';
  const docType = sanitizeDocType(input.docType);
  return `${input.profileId}/${input.applicationId}/${docType}-${randomUUID()}.${ext}`;
}

export async function uploadCreditDocument(input: {
  path: string;
  body: Buffer;
  contentType: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServer();
  const { error } = await supabase.storage
    .from(CREDIT_APPLICATION_BUCKET)
    .upload(input.path, input.body, {
      contentType: input.contentType,
      upsert: false,
      cacheControl: '0',
    });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signedCreditDocumentUrl(path: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.storage
    .from(CREDIT_APPLICATION_BUCKET)
    .createSignedUrl(path, CREDIT_SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message || 'Could not sign URL' };
  }
  return { ok: true, url: data.signedUrl };
}

export async function deleteCreditDocument(path: string): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase.storage.from(CREDIT_APPLICATION_BUCKET).remove([path]);
}
