/**
 * Upload a container photo through the server-side uploader.
 */
export async function uploadContainerPhoto(
  file: File,
  companyId: number | string,
  containerCode?: string
): Promise<{ url: string | null; error?: string }> {
  if (!file.type.startsWith('image/')) {
    return { url: null, error: 'Please choose an image file (JPG, PNG, WebP)' };
  }
  const body = new FormData();
  body.append('file', file);
  body.append('companyId', String(companyId));
  const safeCode = (containerCode || 'container').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  body.append('kind', `container_photo-${safeCode}`);

  const res = await fetch('/api/business/upload', {
    method: 'POST',
    body,
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) {
    return { url: null, error: data?.error || 'Could not upload image' };
  }
  return { url: String(data.url) };
}
