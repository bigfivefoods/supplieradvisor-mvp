import { NextRequest, NextResponse } from 'next/server';
import { legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';
import { uploadSensitiveDoc } from '@/lib/storage/private-docs';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const gate = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 12MB' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const ref = await uploadSensitiveDoc({
      companyId: gate.userId,
      kind: 'consumer-id-document',
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
