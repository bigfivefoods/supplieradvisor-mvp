import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  ensureSensitiveBucket,
  SENSITIVE_DOC_BUCKET,
} from '@/lib/storage/private-docs';
import { requirePlatformConsoleAccess } from '@/lib/system/platform-console-gate';

type BucketName = 'company-documents' | 'certificates' | 'product-documents';

type ListedFile = {
  bucket: BucketName;
  path: string;
  size: number;
};

const BUCKETS: BucketName[] = [
  'company-documents',
  'certificates',
  'product-documents',
];

const PROFILE_PUBLIC_IMAGE_KINDS = new Set([
  'logo',
  'customer_logo',
  'supplier_logo',
  'nsnp_product',
  'practitioner_photo',
  'coach_photo',
  'client_photo',
  'school_photo',
  'product_image',
]);

function shouldCopyLegacy(bucket: BucketName, path: string): boolean {
  if (bucket === 'certificates' || bucket === 'product-documents') return true;
  const p = path.toLowerCase();
  if (p.startsWith('people/')) return false;
  if (/^did_privy_[^/]+\/photo-/.test(p)) return false;
  const profileMatch = p.match(/\/profile\/([a-z0-9_]+)-/);
  if (profileMatch && PROFILE_PUBLIC_IMAGE_KINDS.has(profileMatch[1])) return false;
  return true;
}

async function listFiles(bucket: BucketName, prefix = ''): Promise<ListedFile[]> {
  const supabase = getSupabaseServer();
  const out: ListedFile[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) break;
    if (!data || data.length === 0) break;
    for (const row of data) {
      const full = `${prefix ? `${prefix}/` : ''}${row.name}`;
      const isFolder = !row.id;
      if (isFolder) {
        const nested = await listFiles(bucket, full);
        out.push(...nested);
      } else {
        const size = Number(row.metadata?.size || 0);
        out.push({ bucket, path: full, size: Number.isFinite(size) ? size : 0 });
      }
    }
    offset += data.length;
    if (data.length < 100) break;
  }
  return out;
}

async function lookupTargetSize(path: string): Promise<number | null> {
  const supabase = getSupabaseServer();
  const idx = path.lastIndexOf('/');
  const dir = idx > 0 ? path.slice(0, idx) : '';
  const name = idx > 0 ? path.slice(idx + 1) : path;
  const { data, error } = await supabase.storage.from(SENSITIVE_DOC_BUCKET).list(dir, {
    search: name,
    limit: 10,
  });
  if (error || !data) return null;
  const hit = data.find((x) => x.name === name && x.id);
  if (!hit) return null;
  const size = Number(hit.metadata?.size || 0);
  return Number.isFinite(size) ? size : 0;
}

async function copyOne(file: ListedFile): Promise<'copied' | 'exists' | 'failed'> {
  const supabase = getSupabaseServer();
  const targetPath = `legacy/${file.bucket}/${file.path}`;
  const existingSize = await lookupTargetSize(targetPath);
  if (existingSize != null && existingSize === file.size) return 'exists';

  const dl = await supabase.storage.from(file.bucket).download(file.path);
  if (dl.error || !dl.data) return 'failed';
  const body = Buffer.from(await dl.data.arrayBuffer());

  const up = await supabase.storage.from(SENSITIVE_DOC_BUCKET).upload(targetPath, body, {
    upsert: false,
    contentType: dl.data.type || 'application/octet-stream',
  });
  if (!up.error) return 'copied';
  if (!/duplicate|already exists/i.test(up.error.message || '')) return 'failed';

  const afterSize = await lookupTargetSize(targetPath);
  if (afterSize != null && afterSize === body.length) return 'exists';
  return 'failed';
}

async function deleteOneIfCopied(file: ListedFile): Promise<'deleted' | 'skipped'> {
  const supabase = getSupabaseServer();
  const targetPath = `legacy/${file.bucket}/${file.path}`;
  const copySize = await lookupTargetSize(targetPath);
  if (copySize == null || copySize !== file.size) return 'skipped';

  const rm = await supabase.storage.from(file.bucket).remove([file.path]);
  if (rm.error) return 'skipped';
  return 'deleted';
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const gate = await requirePlatformConsoleAccess(request);
    if (!gate.ok) return gate.response;

    const apply = request.nextUrl.searchParams.get('apply') === '1';
    const deleteOriginals = request.nextUrl.searchParams.get('deleteOriginals') === '1';
    const dryRun = !apply && !deleteOriginals;

    const files = (await Promise.all(BUCKETS.map((bucket) => listFiles(bucket)))).flat();
    const candidates = files.filter((f) => shouldCopyLegacy(f.bucket, f.path));

    const byBucket = {
      'company-documents': candidates.filter((f) => f.bucket === 'company-documents').length,
      certificates: candidates.filter((f) => f.bucket === 'certificates').length,
      'product-documents': candidates.filter((f) => f.bucket === 'product-documents').length,
    };

    let copied = 0;
    let alreadyPresent = 0;
    let copyFailed = 0;
    let deleted = 0;
    let deleteSkipped = 0;

    if (apply || deleteOriginals) {
      const ensured = await ensureSensitiveBucket();
      if (ensured) {
        return NextResponse.json({ error: ensured }, { status: 500 });
      }
    }

    if (apply) {
      for (const file of candidates) {
        const result = await copyOne(file);
        if (result === 'copied') copied += 1;
        else if (result === 'exists') alreadyPresent += 1;
        else copyFailed += 1;
      }
    }

    if (deleteOriginals) {
      for (const file of candidates) {
        const result = await deleteOneIfCopied(file);
        if (result === 'deleted') deleted += 1;
        else deleteSkipped += 1;
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      apply,
      deleteOriginals,
      candidates: candidates.length,
      byBucket,
      copied,
      alreadyPresent,
      copyFailed,
      deleted,
      deleteSkipped,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Migration failed' },
      { status: 500 }
    );
  }
}
