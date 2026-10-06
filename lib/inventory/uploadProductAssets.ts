async function uploadViaServer(opts: {
  file: File;
  companyId: number | string;
  kind: string;
}): Promise<{ url: string | null; error?: string }> {
  const body = new FormData();
  body.append('file', opts.file);
  body.append('companyId', String(opts.companyId));
  body.append('kind', opts.kind);

  const res = await fetch('/api/business/upload', {
    method: 'POST',
    body,
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) {
    return { url: null, error: data?.error || 'Upload failed' };
  }
  return { url: String(data.url) };
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
  const suffix = (skuOrName || 'product').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  return uploadViaServer({ file, companyId, kind: `product_image-${suffix}` });
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
  const suffix = (skuOrName || 'product').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const result = await uploadViaServer({ file, companyId, kind: `product_specs-${suffix}` });
  return { ...result, fileName: file.name };
}
