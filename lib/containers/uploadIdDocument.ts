import { createClient } from '@/utils/supabase/client';

/**
 * Upload a contractor SA ID document (image or PDF) to Supabase Storage.
 */
export async function uploadContractorIdDocument(
  file: File,
  companyId: number | string,
  contractorKey?: string
): Promise<{ url: string | null; fileName?: string; error?: string }> {
  const supabase = createClient();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
  const safeKey = (contractorKey || 'contractor').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const filePath = `${companyId}/id-docs/${safeKey}-${Date.now()}.${ext}`;

  const allowed = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf',
  ];
  if (file.type && !allowed.includes(file.type) && !file.type.startsWith('image/')) {
    return { url: null, error: 'Please upload an image or PDF of the ID document' };
  }
  if (file.size > 12 * 1024 * 1024) {
    return { url: null, error: 'ID document must be under 12MB' };
  }

  const buckets = ['contractor-documents', 'company-documents', 'container-photos'];

  for (const bucket of buckets) {
    const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });

    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return { url: data.publicUrl, fileName: file.name };
    }
  }

  return {
    url: null,
    error:
      'Could not upload ID document. Create a public Storage bucket named contractor-documents or company-documents.',
  };
}
