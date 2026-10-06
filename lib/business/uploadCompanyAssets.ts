function safeName(name?: string) {
  return (name || 'file').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
}

async function uploadViaBusinessApi(opts: {
  file: File;
  companyId: number | string;
  kind: string;
  privyUserId?: string | null;
  profileField?: string | null;
}): Promise<{
  url: string | null;
  fileName?: string;
  error?: string;
  profileSynced?: boolean;
  profile?: Record<string, unknown> | null;
  columnsWritten?: string[];
  bucket?: string;
  details?: unknown;
}> {
  const body = new FormData();
  body.append('file', opts.file);
  body.append('companyId', String(opts.companyId));
  body.append('kind', opts.kind);
  if (opts.privyUserId) body.append('privyUserId', String(opts.privyUserId));
  if (opts.profileField) body.append('profileField', opts.profileField);

  const res = await fetch('/api/business/upload', { method: 'POST', body, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    return {
      url: null,
      error: data.error || 'Upload failed',
      details: data,
    };
  }
  return {
    url: String(data.url),
    fileName: data.fileName || opts.file.name,
    profileSynced: Boolean(data.profileSynced),
    profile: data.profile || null,
    columnsWritten: data.columnsWritten || [],
    bucket: data.bucket,
    details: data.profileError || data.details,
  };
}

export async function uploadCompanyAssetServerFirst(opts: {
  file: File;
  companyId: number | string;
  kind: string;
  privyUserId?: string | null;
  profileField?: string | null;
}): Promise<{
  url: string | null;
  fileName?: string;
  error?: string;
  profileSynced?: boolean;
  profile?: Record<string, unknown> | null;
  columnsWritten?: string[];
  bucket?: string;
  details?: unknown;
}> {
  const { file, companyId, kind, privyUserId, profileField } = opts;
  return uploadViaBusinessApi({
    file,
    companyId,
    kind,
    privyUserId,
    profileField,
  });
}

/** Company logo image. */
export async function uploadCompanyLogo(
  file: File,
  companyId: number | string
): Promise<{ url: string | null; error?: string; bucket?: string }> {
  if (!file.type.startsWith('image/')) {
    return { url: null, error: 'Please choose an image file (JPG, PNG, WebP)' };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { url: null, error: 'Logo must be under 8MB' };
  }
  const res = await uploadViaBusinessApi({ file, companyId, kind: 'logo' });
  return { url: res.url, error: res.error, bucket: res.bucket };
}

/** Generic company document (PDF/image) — reg, VAT, BEE, bank letter, licenses. */
export async function uploadCompanyDocument(
  file: File,
  companyId: number | string,
  kind: string
): Promise<{ url: string | null; fileName?: string; error?: string; bucket?: string }> {
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
  const res = await uploadViaBusinessApi({
    file,
    companyId,
    kind: safeName(kind),
  });
  return { url: res.url, fileName: file.name, error: res.error, bucket: res.bucket };
}
