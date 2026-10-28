import { NextRequest, NextResponse } from 'next/server';
import { normalizeDeliveryNoteToken } from '@/lib/customers/delivery-note-token';
import {
  acknowledgeDeliveryNote,
  loadPublicDeliveryNote,
} from '@/lib/customers/delivery-note-store';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

function limited(request: NextRequest, bucket: string) {
  const rl = checkRateLimit({
    key: `delivery-note:${bucket}:${request.headers.get('x-forwarded-for') || 'ip'}`,
    limit: 40,
    windowMs: 60 * 1000,
  });
  if (rl.ok) return null;
  const r = rateLimitResponse(rl.retryAfterSeconds);
  return NextResponse.json(r.body, { status: r.status, headers: r.headers });
}

/**
 * Public read-only delivery note. Signed token, no login, no prices.
 * GET ?token=
 * POST { token, name, date } records received-by on the note.
 */
export async function GET(request: NextRequest) {
  try {
    const blocked = limited(request, 'get');
    if (blocked) return blocked;
    const token = normalizeDeliveryNoteToken(request.nextUrl.searchParams.get('token'));
    const loaded = await loadPublicDeliveryNote(token);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }
    return NextResponse.json(
      { success: true, deliveryNote: loaded.view },
      {
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const blocked = limited(request, 'post');
    if (blocked) return blocked;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const token = normalizeDeliveryNoteToken(body.token);
    const saved = await acknowledgeDeliveryNote({
      token,
      name: String(body.name || ''),
      date: String(body.date || ''),
    });
    if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status });
    return NextResponse.json(
      { success: true, deliveryNote: saved.view },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
