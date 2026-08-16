/**
 * Server-only movement image / video storage.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { COMPANY_DOC_BUCKETS } from '@/lib/business/documentFields';

function safeName(name?: string) {
  return (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
}

export function isAllowedMovementMedia(file: {
  name: string;
  type?: string;
  size?: number;
}): string | null {
  const lower = file.name.toLowerCase();
  const type = file.type || '';
  const image =
    type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/.test(lower);
  const video =
    type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(lower);
  if (!image && !video) {
    return 'Upload an image (JPG, PNG, WebP) or a short video (MP4, WebM)';
  }
  const max = video ? 40 * 1024 * 1024 : 15 * 1024 * 1024;
  if (file.size != null && file.size > max) {
    return video
      ? 'Video must be under 40MB — or paste a YouTube / Vimeo link'
      : 'Image must be under 15MB';
  }
  return null;
}

export async function storeFitMovementMedia(opts: {
  companyId: number;
  fileName: string;
  buffer: Buffer;
  contentType?: string;
}): Promise<{ url: string; fileName: string } | { error: string }> {
  const ext =
    opts.fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
    'bin';
  const filePath = `${opts.companyId}/movements/${Date.now()}-${safeName(
    opts.fileName.replace(/\.[^.]+$/, '')
  )}.${ext}`;
  const supabase = getSupabaseServer();
  const errors: string[] = [];
  for (const bucket of COMPANY_DOC_BUCKETS) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, opts.buffer, {
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
