import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { uploadSensitiveDoc } from '@/lib/storage/private-docs';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const companyId = Number(form.get('companyId'));
    const contractorKey = String(form.get('contractorKey') || 'contractor').trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const allowed = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'application/pdf',
    ]);
    if (file.type && !allowed.has(file.type) && !file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Please upload an image or PDF of the ID document' },
        { status: 400 }
      );
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: 'ID document must be under 12MB' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const ref = await uploadSensitiveDoc({
      companyId,
      kind: `id-docs-${contractorKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}`,
      body: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || 'application/octet-stream',
      ext,
    });

    return NextResponse.json({ success: true, ref, url: ref, fileName: file.name });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
