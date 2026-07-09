import { createClient } from '@/utils/supabase/client';

const IMAGE_BUCKETS = ['product-images', 'container-photos', 'company-documents'];
const DOC_BUCKETS = ['product-documents', 'company-documents', 'contractor-documents'];

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

/** Product photo (JPG/PNG/WebP). */
export async function uploadProductImage(
  file: File,
  companyId: number | string,
  skuOrName?: string
): Promise<{ url: string | null; error?: string }> {
  if (!file.type.startsWith('image/')) {
    return { url: null, error: 'Please choose an image file (JPG, PNG, WebP)' };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { url: null, error: 'Image must be under 8MB' };
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safe = (skuOrName || 'product').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const filePath = `${companyId}/products/images/${safe}-${Date.now()}.${ext}`;
  return uploadToBuckets(file, filePath, IMAGE_BUCKETS);
}

/** Specifications sheet (PDF preferred; also Office docs). */
export async function uploadProductSpecSheet(
  file: File,
  companyId: number | string,
  skuOrName?: string
): Promise<{ url: string | null; fileName?: string; error?: string }> {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
  ];
  if (file.type && !allowed.includes(file.type) && !file.type.startsWith('image/')) {
    return { url: null, error: 'Use PDF, Word, or image for the specifications sheet' };
  }
  if (file.size > 15 * 1024 * 1024) {
    return { url: null, error: 'Spec sheet must be under 15MB' };
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
  const safe = (skuOrName || 'product').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const filePath = `${companyId}/products/specs/${safe}-${Date.now()}.${ext}`;
  const result = await uploadToBuckets(file, filePath, DOC_BUCKETS);
  return { ...result, fileName: file.name };
}
