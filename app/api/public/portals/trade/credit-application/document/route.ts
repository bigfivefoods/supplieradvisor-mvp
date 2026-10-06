import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { resolveGuestViewer } from '@/lib/portals/portal-guest';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { signedCreditDocumentUrl } from '@/lib/credit/storage';

function badToken() {
  return NextResponse.json({ error: 'Invalid portal link' }, { status: 404 });
}

export async function GET(request: NextRequest) {
  try {
    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    const docId = Number(request.nextUrl.searchParams.get('docId'));
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'ip';
    const rl = checkRateLimit({
      key: `portal-credit-doc:${token.slice(0, 24)}:${ip}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      const r = rateLimitResponse(rl.retryAfterSeconds);
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }

    const guest = await resolveGuestViewer(token);
    if (!guest.ok) return badToken();
    const { portal, viewer } = guest.ctx;
    if (portal.kind !== 'customer' || !viewer.customer_id) return badToken();
    if (!Number.isFinite(docId) || docId <= 0) {
      return NextResponse.json({ error: 'docId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: doc } = await supabase
      .from('credit_application_documents')
      .select('id, application_id, storage_path')
      .eq('id', docId)
      .eq('profile_id', portal.profile_id)
      .maybeSingle();
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const { data: app } = await supabase
      .from('credit_applications')
      .select('id')
      .eq('id', Number(doc.application_id))
      .eq('profile_id', portal.profile_id)
      .eq('customer_id', viewer.customer_id)
      .maybeSingle();
    if (!app) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const signed = await signedCreditDocumentUrl(String(doc.storage_path || ''));
    if (!signed.ok) return NextResponse.json({ error: signed.error }, { status: 500 });

    return NextResponse.json({ success: true, url: signed.url, expiresIn: 300 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
