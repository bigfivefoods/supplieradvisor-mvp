import { createClient } from '@/utils/supabase/client';

const IMAGE_BUCKETS = ['company-documents', 'product-images', 'container-photos'];
const DOC_BUCKETS = ['company-documents', 'product-documents', 'contractor-documents'];

async function uploadToBuckets(
  file: File,
  filePath: string,
  buckets: string[]
): Promise<{ url: string | null; error?: string }> {
  const supabase = createClient();
  for (const bucket of buckets) {
    const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });
    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return { url: data.publicUrl };
    }
  }
  return {
    url: null,
    error: `Upload failed. Create a public Storage bucket: ${buckets[0]} (or company-documents).`,
  };
}

function safeName(name?: string) {
  return (name || 'file').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
}

/**
 * Preferred path: server upload with service role (bypasses Storage RLS).
 * Falls back to browser Supabase client if the API is unavailable.
 */
export async function uploadCompanyAssetServerFirst(opts: {
  file: File;
  companyId: number | string;
  kind: string;
  privyUserId?: string | null;
  /** When set, server also PATCHes this profiles column with the new URL. */
  profileField?: string | null;
}): Promise<{
  url: string | null;
  fileName?: string;
  error?: string;
  profileSynced?: boolean;
  profile?: Record<string, unknown> | null;
}> {
  const { file, companyId, kind, privyUserId, profileField } = opts;

  // 1) Server-side (service role) — reliable for production
  try {
    const body = new FormData();
    body.append('file', file);
    body.append('companyId', String(companyId));
    body.append('privyUserId', String(privyUserId || ''));
    body.append('kind', kind);
    if (profileField) body.append('profileField', profileField);

    const res = await fetch('/api/business/upload', { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      return {
        url: String(data.url),
        fileName: data.fileName || file.name,
        profileSynced: Boolean(data.profileSynced),
        profile: data.profile || null,
      };
    }
    // If server returned a useful error and no fallback is likely better, surface it
    // but still try client fallback for transient issues.
    console.warn('Server upload failed, trying client:', data.error || res.status);
  } catch (e) {
    console.warn('Server upload network error, trying client:', e);
  }

  // 2) Client fallback
  const isLogo = kind === 'logo' || profileField === 'logo_url';
  if (isLogo) {
    const r = await uploadCompanyLogo(file, companyId);
    return { ...r, profileSynced: false };
  }
  const r = await uploadCompanyDocument(file, companyId, kind);
  return { ...r, profileSynced: false };
}

/** Company logo image. */
export async function uploadCompanyLogo(
  file: File,
  companyId: number | string
): Promise<{ url: string | null; error?: string }> {
  if (!file.type.startsWith('image/')) {
    return { url: null, error: 'Please choose an image file (JPG, PNG, WebP)' };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { url: null, error: 'Logo must be under 8MB' };
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const filePath = `${companyId}/profile/logo-${Date.now()}.${ext}`;
  return uploadToBuckets(file, filePath, IMAGE_BUCKETS);
}

/** Generic company document (PDF/image) — reg, VAT, BEE, bank letter, licenses. */
export async function uploadCompanyDocument(
  file: File,
  companyId: number | string,
  kind: string
): Promise<{ url: string | null; fileName?: string; error?: string }> {
  const allowed = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (file.type && !allowed.includes(file.type) && !file.type.startsWith('image/')) {
    return { url: null, error: 'Please upload a PDF, Word doc, or image' };
  }
  if (file.size > 15 * 1024 * 1024) {
    return { url: null, error: 'File must be under 15MB' };
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
  const filePath = `${companyId}/profile/${safeName(kind)}-${Date.now()}.${ext}`;
  const result = await uploadToBuckets(file, filePath, DOC_BUCKETS);
  return { ...result, fileName: file.name };
}
