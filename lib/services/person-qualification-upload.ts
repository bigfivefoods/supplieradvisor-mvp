/**
 * Store a qualification certificate on company document buckets.
 */
import { uploadSensitiveDoc } from '@/lib/storage/private-docs';

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
  try {
    const ref = await uploadSensitiveDoc({
      companyId: opts.companyId,
      kind: `qualifications-${safeName(opts.fileName.replace(/\.[^.]+$/, ''))}`,
      body: opts.buffer,
      contentType: opts.contentType || 'application/octet-stream',
      ext,
    });
    return { url: ref, fileName: opts.fileName };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Upload failed' };
  }
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
