/**
 * Upload a contractor SA ID document through a gated server route.
 */
export async function uploadContractorIdDocument(
  file: File,
  companyId: number | string,
  contractorKey?: string
): Promise<{ url: string | null; fileName?: string; error?: string }> {
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

  const body = new FormData();
  body.append('file', file);
  body.append('companyId', String(companyId));
  body.append('contractorKey', String(contractorKey || 'contractor'));

  const res = await fetch('/api/containers/id-document', {
    method: 'POST',
    body,
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) {
    return { url: null, error: data?.error || 'Could not upload ID document' };
  }

  return { url: String(data.url), fileName: String(data.fileName || file.name) };
}
