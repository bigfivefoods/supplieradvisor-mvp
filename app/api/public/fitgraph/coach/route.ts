/**
 * Coach portal API (token auth, no Supabase user session).
 * GET  ?token=  — coach's upcoming sessions + roster
 * POST { token, action, ... } — share session, update capacity/notes, book guest
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  FITGRAPH_COACH_TOKENS_KEY,
  buildCoachPortalPayload,
  newId,
  parseCompanyIdFromToken,
  readFitgraphFromMetadata,
  sessionBookingCount,
  writeFitgraphToMetadata,
  type FitBooking,
  type FitClient,
  type FitCoach,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function resolveCoach(
  token: string
): Promise<{
  companyId: number;
  meta: Record<string, unknown>;
  store: FitgraphStore;
  coach: FitCoach;
} | null> {
  const clean = token.trim();
  if (!clean || clean.length < 8) return null;
  const supabase = getSupabaseServer();

  // Prefer company id embedded in token
  let companyId = parseCompanyIdFromToken(clean);

  if (companyId == null) {
    // Scan via coach token map key — limited fetch of recent profiles with fitgraph
    // Fallback: try contains with partial won't work for map keys; use eq on nested path if possible
    const { data: rows } = await supabase
      .from('profiles')
      .select('id, metadata')
      .not('metadata', 'is', null)
      .limit(200);
    for (const row of rows || []) {
      const meta =
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : {};
      const map = meta[FITGRAPH_COACH_TOKENS_KEY];
      if (map && typeof map === 'object' && clean in (map as object)) {
        companyId = Number(row.id);
        break;
      }
      const store = readFitgraphFromMetadata(meta);
      const c = store.coaches.find((x) => x.portal_token === clean);
      if (c) {
        companyId = Number(row.id);
        break;
      }
    }
  }

  if (companyId == null || !Number.isFinite(companyId)) return null;

  const { data: prof } = await supabase
    .from('profiles')
    .select('id, metadata')
    .eq('id', companyId)
    .maybeSingle();
  if (!prof) return null;

  const meta =
    prof.metadata && typeof prof.metadata === 'object'
      ? { ...(prof.metadata as Record<string, unknown>) }
      : {};
  const store = readFitgraphFromMetadata(meta);
  const coach = store.coaches.find((c) => c.portal_token === clean);
  if (!coach || coach.active === false) return null;

  return { companyId: Number(prof.id), meta, store, coach };
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
      key: `public-fit-coach:${ip}`,
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

    const resolved = await resolveCoach(token);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Coach portal not found' },
        { status: 404 }
      );
    }

    const from = request.nextUrl.searchParams.get('from') || undefined;
    const portal = buildCoachPortalPayload(
      resolved.store,
      resolved.coach,
      from || undefined
    );
    const brand = resolved.store.settings?.brand_name || 'Gym';

    return NextResponse.json({
      success: true,
      brand,
      portal,
      website_enabled: resolved.store.settings?.enabled === true,
      public_token: resolved.store.settings?.enabled
        ? resolved.store.settings?.public_token
        : undefined,
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
      key: `public-fit-coach-write:${ip}`,
      limit: 60,
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
    const action = String(body.action || '');
    if (!token || !action) {
      return NextResponse.json(
        { error: 'token and action required' },
        { status: 400 }
      );
    }

    const resolved = await resolveCoach(token);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Coach portal not found' },
        { status: 404 }
      );
    }

    const { companyId, meta, store, coach } = resolved;
    if (coach.can_manage_classes === false) {
      return NextResponse.json(
        { error: 'Coach cannot manage classes' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const sessionId = String(body.session_id || body.sessionId || '');

    if (action === 'share_session') {
      const session = store.sessions.find(
        (s) => s.id === sessionId && s.coach_id === coach.id
      );
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      session.public = body.public !== false;
      if (session.public && !session.share_code) {
        session.share_code = `s_${Math.random().toString(36).slice(2, 10)}`;
      }
      if (body.public_notes != null) {
        session.public_notes = String(body.public_notes);
      }
      // Ensure website is on so share is meaningful
      if (session.public && store.settings) {
        store.settings.enabled = true;
      }
      await saveStore(companyId, meta, store);
      const portal = buildCoachPortalPayload(store, coach);
      return NextResponse.json({
        success: true,
        message: session.public
          ? 'Class shared on public calendar'
          : 'Class hidden from public calendar',
        session: {
          id: session.id,
          public: session.public,
          share_code: session.share_code,
          public_notes: session.public_notes,
        },
        portal,
        public_token: store.settings?.public_token,
      });
    }

    if (action === 'update_session') {
      const session = store.sessions.find(
        (s) => s.id === sessionId && s.coach_id === coach.id
      );
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      if (body.capacity != null) session.capacity = Number(body.capacity);
      if (body.notes != null) session.notes = String(body.notes);
      if (body.public_notes != null) session.public_notes = String(body.public_notes);
      if (body.status === 'cancelled' || body.status === 'completed') {
        session.status = body.status;
      }
      if (body.location != null) session.location = String(body.location);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        portal: buildCoachPortalPayload(store, coach),
      });
    }

    if (action === 'book_guest') {
      const session = store.sessions.find(
        (s) => s.id === sessionId && s.coach_id === coach.id
      );
      if (!session || session.status === 'cancelled') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      const name = String(body.name || body.guest_name || '').trim();
      if (!name) {
        return NextResponse.json({ error: 'name required' }, { status: 400 });
      }
      const email = body.email ? String(body.email).trim() : '';
      const phone = body.phone ? String(body.phone).trim() : '';

      let clientId = '';
      if (email) {
        const existing = store.clients.find(
          (c) => c.email && c.email.toLowerCase() === email.toLowerCase()
        );
        if (existing) clientId = existing.id;
      }
      if (!clientId) {
        const client: FitClient = {
          id: newId('cli'),
          code: `C-${store.clients.length + 1}`,
          name,
          email: email || undefined,
          phone: phone || undefined,
          membership_status: 'trial',
          coach_id: coach.id,
          active: true,
          notes: 'Booked via coach portal',
          created_at: now,
          updated_at: now,
        };
        store.clients.push(client);
        clientId = client.id;
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
        source: 'coach',
        guest_name: name,
        guest_email: email || undefined,
        guest_phone: phone || undefined,
      };
      store.bookings.push(booking);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        booking: { id: booking.id, status },
        portal: buildCoachPortalPayload(store, coach),
      });
    }

    if (action === 'mark_attended') {
      const bookingId = String(body.booking_id || '');
      const booking = store.bookings.find((b) => b.id === bookingId);
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      const session = store.sessions.find((s) => s.id === booking.session_id);
      if (!session || session.coach_id !== coach.id) {
        return NextResponse.json({ error: 'Not your session' }, { status: 403 });
      }
      booking.status = 'attended';
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        portal: buildCoachPortalPayload(store, coach),
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    console.error('[public/fitgraph/coach]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
