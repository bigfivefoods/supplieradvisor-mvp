/**
 * Public Fitgraph calendar + booking (website embed).
 * GET  ?token=  — public calendar payload (no auth)
 * POST { token, action: 'book', session_id, name, email?, phone? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  FITGRAPH_PUBLIC_TOKEN_KEY,
  buildPublicCalendarPayload,
  newId,
  parseCompanyIdFromToken,
  readFitgraphFromMetadata,
  sessionBookingCount,
  writeFitgraphToMetadata,
  type FitBooking,
  type FitClient,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function resolveByToken(
  token: string
): Promise<{ companyId: number; meta: Record<string, unknown>; store: FitgraphStore } | null> {
  const supabase = getSupabaseServer();
  const clean = token.trim();
  if (!clean || clean.length < 8) return null;

  // Fast path: metadata root index
  const { data: byIndex } = await supabase
    .from('profiles')
    .select('id, metadata')
    .contains('metadata', { [FITGRAPH_PUBLIC_TOKEN_KEY]: clean })
    .maybeSingle();

  if (byIndex) {
    const meta =
      byIndex.metadata && typeof byIndex.metadata === 'object'
        ? { ...(byIndex.metadata as Record<string, unknown>) }
        : {};
    const store = readFitgraphFromMetadata(meta);
    if (store.settings?.public_token === clean && store.settings?.enabled) {
      return { companyId: Number(byIndex.id), meta, store };
    }
  }

  // Parse company id from fg_{id}_… tokens
  const parsed = parseCompanyIdFromToken(clean);
  if (parsed != null && Number.isFinite(parsed)) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, metadata')
      .eq('id', parsed)
      .maybeSingle();
    if (prof) {
      const meta =
        prof.metadata && typeof prof.metadata === 'object'
          ? { ...(prof.metadata as Record<string, unknown>) }
          : {};
      const store = readFitgraphFromMetadata(meta);
      if (store.settings?.public_token === clean && store.settings?.enabled) {
        return { companyId: Number(prof.id), meta, store };
      }
    }
  }

  return null;
}

async function saveStore(
  companyId: number,
  meta: Record<string, unknown>,
  store: FitgraphStore
) {
  const supabase = getSupabaseServer();
  const nextMeta = writeFitgraphToMetadata(meta, store);
  const { error } = await supabase
    .from('profiles')
    .update({
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId);
  if (error) throw new Error(error.message);
}

export async function GET(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `public-fitgraph:${ip}`,
      limit: 120,
      windowMs: 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }

    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }

    const resolved = await resolveByToken(token);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Calendar not found or not published' },
        { status: 404 }
      );
    }

    const from = request.nextUrl.searchParams.get('from') || undefined;
    const to = request.nextUrl.searchParams.get('to') || undefined;
    const coachId = request.nextUrl.searchParams.get('coachId') || undefined;

    const calendar = buildPublicCalendarPayload(resolved.store, {
      from: from || undefined,
      to: to || undefined,
      coachId: coachId || undefined,
    });

    return NextResponse.json({
      success: true,
      calendar,
      companyId: resolved.companyId,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `public-fitgraph-book:${ip}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }

    const body = await request.json();
    const token = String(body.token || '').trim();
    const action = String(body.action || 'book');
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }

    const resolved = await resolveByToken(token);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Calendar not found or not published' },
        { status: 404 }
      );
    }

    const { companyId, meta, store } = resolved;
    if (store.settings?.allow_public_booking === false) {
      return NextResponse.json(
        { error: 'Online booking is disabled' },
        { status: 403 }
      );
    }

    if (action !== 'book') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const sessionId = String(body.session_id || body.sessionId || '');
    const name = String(body.name || body.guest_name || '').trim();
    const email = body.email || body.guest_email
      ? String(body.email || body.guest_email).trim()
      : '';
    const phone = body.phone || body.guest_phone
      ? String(body.phone || body.guest_phone).trim()
      : '';

    if (!sessionId || !name) {
      return NextResponse.json(
        { error: 'session_id and name required' },
        { status: 400 }
      );
    }

    const session = store.sessions.find((s) => s.id === sessionId);
    if (!session || session.public !== true || session.status !== 'scheduled') {
      return NextResponse.json(
        { error: 'Session not available for booking' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    // Match existing client by email if possible
    let clientId = '';
    if (email) {
      const existing = store.clients.find(
        (c) =>
          c.email &&
          c.email.toLowerCase() === email.toLowerCase() &&
          c.active !== false
      );
      if (existing) clientId = existing.id;
    }

    if (!clientId) {
      const client: FitClient = {
        id: newId('cli'),
        code: `W-${store.clients.length + 1}`,
        name,
        email: email || undefined,
        phone: phone || undefined,
        membership_status: 'trial',
        active: true,
        notes: 'Created via website booking',
        created_at: now,
        updated_at: now,
      };
      store.clients.push(client);
      clientId = client.id;
    }

    // Duplicate booking check
    const dup = store.bookings.find(
      (b) =>
        b.session_id === sessionId &&
        b.client_id === clientId &&
        (b.status === 'booked' || b.status === 'waitlist' || b.status === 'attended')
    );
    if (dup) {
      return NextResponse.json(
        { error: 'Already booked on this class', booking_id: dup.id, status: dup.status },
        { status: 409 }
      );
    }

    const cap = session.capacity ?? 999;
    const count = sessionBookingCount(store, sessionId);
    const status: FitBooking['status'] = count >= cap ? 'waitlist' : 'booked';

    const booking: FitBooking = {
      id: newId('bkg'),
      session_id: sessionId,
      client_id: clientId,
      status,
      booked_at: now,
      source: 'website',
      guest_name: name,
      guest_email: email || undefined,
      guest_phone: phone || undefined,
    };
    store.bookings.push(booking);
    await saveStore(companyId, meta, store);

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        status: booking.status,
        session_id: sessionId,
        message:
          status === 'waitlist'
            ? 'Class is full — you are on the waitlist'
            : 'Booked successfully',
      },
      calendar: buildPublicCalendarPayload(store),
    });
  } catch (e: unknown) {
    console.error('[public/fitgraph]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
