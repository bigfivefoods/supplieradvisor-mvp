/**
 * Token-portal person photos (coach / member / clinician) — no Privy session.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { COMPANY_IMAGE_BUCKETS } from '@/lib/business/documentFields';

function safeName(name?: string) {
  return (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40);
}

export function isAllowedPersonPhoto(file: {
  name: string;
  type?: string;
  size?: number;
}): string | null {
  const lower = file.name.toLowerCase();
  const type = file.type || '';
  const ok =
    type.startsWith('image/') ||
    /\.(jpe?g|png|webp|gif)$/.test(lower);
  if (!ok) return 'Please choose an image (JPG, PNG, WebP)';
  if (file.size != null && file.size > 8 * 1024 * 1024) {
    return 'Photo must be under 8MB';
  }
  return null;
}

export type PortalPhotoForm =
  | { ok: true; token: string; file: File }
  | { ok: false; error: string };

export function parsePortalPhotoForm(form: FormData): PortalPhotoForm {
  const token = String(form.get('token') || '').trim();
  const action = String(form.get('action') || '');
  const file = form.get('file');
  if (action !== 'upload_photo' || !(file instanceof File) || !token) {
    return {
      ok: false,
      error: 'token, action=upload_photo and file required',
    };
  }
  return { ok: true, token, file };
}

export type IngestedPersonPhoto =
  | { ok: true; url: string; fileName: string }
  | { ok: false; error: string; status: 400 | 502 };

export async function ingestPersonPhotoFile(
  file: File,
  opts: { companyId: number; kind?: string }
): Promise<IngestedPersonPhoto> {
  const bad = isAllowedPersonPhoto(file);
  if (bad) return { ok: false, error: bad, status: 400 };
  const stored = await storePersonPhoto({
    companyId: opts.companyId,
    kind: opts.kind,
    fileName: file.name,
    buffer: Buffer.from(await file.arrayBuffer()),
    contentType: file.type,
  });
  if ('error' in stored) {
    return { ok: false, error: stored.error, status: 502 };
  }
  return { ok: true, url: stored.url, fileName: stored.fileName };
}

/**
 * If the request is multipart photo upload, handle it and return a response.
 * Otherwise return null so the caller can parse JSON as usual.
 */
export async function tryHandlePortalPhotoMultipart<
  T extends { companyId: number },
>(
  request: NextRequest,
  opts: {
    kind: string;
    notFound: string;
    resolve: (token: string) => Promise<T | null>;
    persist: (
      resolved: T,
      url: string
    ) => Promise<Record<string, unknown> | void>;
  }
): Promise<NextResponse | null> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) return null;
  const parsed = parsePortalPhotoForm(await request.formData());
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const resolved = await opts.resolve(parsed.token);
  if (!resolved) {
    return NextResponse.json({ error: opts.notFound }, { status: 404 });
  }
  const stored = await ingestPersonPhotoFile(parsed.file, {
    companyId: resolved.companyId,
    kind: opts.kind,
  });
  if (!stored.ok) {
    return NextResponse.json(
      { error: stored.error },
      { status: stored.status }
    );
  }
  const extra = await opts.persist(resolved, stored.url);
  return NextResponse.json({
    success: true,
    url: stored.url,
    fileName: stored.fileName,
    ...(extra || {}),
  });
}

export async function storePersonPhoto(opts: {
  companyId: number;
  kind?: string;
  fileName: string;
  buffer: Buffer;
  contentType?: string;
}): Promise<{ url: string; fileName: string } | { error: string }> {
  const kind = String(opts.kind || 'person_photo')
    .replace(/[^a-z0-9_-]/gi, '_')
    .slice(0, 40);
  const ext =
    opts.fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
    'jpg';
  const filePath = `${opts.companyId}/people/${kind}-${Date.now()}-${safeName(
    opts.fileName.replace(/\.[^.]+$/, '')
  )}.${ext}`;
  const supabase = getSupabaseServer();
  const errors: string[] = [];
  for (const bucket of COMPANY_IMAGE_BUCKETS) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, opts.buffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: opts.contentType || 'image/jpeg',
      });
    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return { url: data.publicUrl, fileName: opts.fileName };
    }
    errors.push(`${bucket}: ${error.message}`);
  }
  return { error: errors.join('; ') || 'Upload failed' };
}
