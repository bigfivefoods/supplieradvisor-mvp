import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { resolveGuestViewer } from '@/lib/portals/portal-guest';

const ALLOWED = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const token = String(form.get('token') || '').trim();
    const file = form.get('file');
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'ip';
    const rl = checkRateLimit({
      key: `portal-upload:${token.slice(0, 24)}:${ip}`,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      const r = rateLimitResponse(rl.retryAfterSeconds);
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }
    const guest = await resolveGuestViewer(token);
    if (!guest.ok) {
      return NextResponse.json({ error: guest.error }, { status: guest.status });
    }
    if (!(file instanceof File) || file.size < 8) {
      return NextResponse.json({ error: 'Choose a file to attach' }, { status: 400 });
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 12MB' }, { status: 400 });
    }
    const type = file.type || 'application/octet-stream';
    if (!ALLOWED.has(type) && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Attach a PDF, image, or Word document' },
        { status: 400 }
      );
    }
    const ext =
      file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
      'pdf';
    const purpose = String(form.get('purpose') || 'po').toLowerCase();
    const field = String(form.get('field') || 'file')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 80) || 'file';
    const folder = purpose === 'company-doc' ? 'portal-docs' : 'portal-po';
    const path = `${guest.ctx.portal.profile_id}/${folder}/${guest.ctx.viewer.id}-${field}-${Date.now()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { uploadPortalDocument } = await import('@/lib/portals/portal-storage');
    const stored = await uploadPortalDocument({
      path,
      body: buf,
      contentType: type,
    });
    if (!stored.ok) {
      return NextResponse.json(
        {
          error: stored.error,
          hint: 'Paste RUN_THIS_FOR_BRIEF19.sql in the Supabase SQL editor to create a public company-documents bucket.',
        },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      url: stored.url,
      name: file.name.slice(0, 160),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
