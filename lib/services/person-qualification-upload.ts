/**
 * Store a qualification certificate on company document buckets.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { COMPANY_DOC_BUCKETS } from '@/lib/business/documentFields';

function safeName(name?: string) {
  return (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
}

export async function storeQualificationCertificate(opts: {
  companyId: number;
  fileName: string;
  buffer: Buffer;
  contentType?: string;
}): Promise<{ url: string; fileName: string } | { error: string }> {
  const ext =
    opts.fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
    'pdf';
  const filePath = `${opts.companyId}/qualifications/${Date.now()}-${safeName(opts.fileName.replace(/\.[^.]+$/, ''))}.${ext}`;
  const supabase = getSupabaseServer();
  const errors: string[] = [];
  for (const bucket of COMPANY_DOC_BUCKETS) {
    const { error } = await supabase.storage.from(bucket).upload(filePath, opts.buffer, {
      cacheControl: '3600',
      upsert: true,
      contentType: opts.contentType || 'application/octet-stream',
    });
    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return { url: data.publicUrl, fileName: opts.fileName };
    }
    errors.push(`${bucket}: ${error.message}`);
  }
  return { error: errors.join('; ') || 'Upload failed' };
}

export function isAllowedCertificateFile(file: {
  name: string;
  type?: string;
  size?: number;
}): string | null {
  const lower = file.name.toLowerCase();
  const ok =
    file.type === 'application/pdf' ||
    lower.endsWith('.pdf') ||
    (file.type || '').startsWith('image/') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.doc') ||
    lower.endsWith('.docx');
  if (!ok) return 'Upload a PDF, image, or Word document';
  if (file.size != null && file.size > 15 * 1024 * 1024) {
    return 'File must be under 15MB';
  }
  return null;
}
