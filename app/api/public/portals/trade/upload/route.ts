import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
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
    const path = `${guest.ctx.portal.profile_id}/portal-po/${guest.ctx.viewer.id}-${Date.now()}.${ext}`;
    const supabase = getSupabaseServer();
    const buf = Buffer.from(await file.arrayBuffer());
    const buckets = ['company-documents', 'product-documents'];
    let url: string | null = null;
    let last = '';
    for (const bucket of buckets) {
      const { error } = await supabase.storage.from(bucket).upload(path, buf, {
        contentType: type,
        upsert: true,
      });
      if (!error) {
        const pub = supabase.storage.from(bucket).getPublicUrl(path);
        url = pub.data.publicUrl;
        break;
      }
      last = error.message;
    }
    if (!url) {
      return NextResponse.json(
        {
          error: last || 'Upload failed',
          hint: 'Create a public Storage bucket named company-documents.',
        },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      url,
      name: file.name.slice(0, 160),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
