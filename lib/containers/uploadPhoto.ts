import { createClient } from '@/utils/supabase/client';

/**
 * Upload a container photo to Supabase Storage and return the public URL.
 * Tries `container-photos` then `container-images`.
 */
export async function uploadContainerPhoto(
  file: File,
  companyId: number | string,
  containerCode?: string
): Promise<{ url: string | null; error?: string }> {
  const supabase = createClient();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeCode = (containerCode || 'container').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = `${companyId}/${safeCode}-${Date.now()}.${ext}`;

  const buckets = ['container-photos', 'container-images', 'company-documents'];

  for (const bucket of buckets) {
    const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });

    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return { url: data.publicUrl };
    }

    // Try next bucket if this one fails (missing bucket / RLS)
    if (
      !error.message?.toLowerCase().includes('not found') &&
      !error.message?.toLowerCase().includes('bucket')
    ) {
      // Permission or other hard error — still try next
      continue;
    }
  }

  return {
    url: null,
    error: 'Could not upload image. Check Storage buckets container-photos / container-images are public.',
  };
}
