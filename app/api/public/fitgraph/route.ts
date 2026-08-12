/**
 * Public GymAdvisor calendar + booking (website embed).
 * GET  ?token=  — public calendar payload (no auth)
 * POST { token, action: 'book', session_id, name, email?, phone? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  FITGRAPH_PUBLIC_TOKEN_KEY,
  buildClassJoinPayload,
  buildGoogleCalendarUrl,
  buildPublicCalendarPayload,
  buildSessionIcs,
  newId,
  parseCompanyIdFromToken,
  readFitgraphFromMetadata,
  sessionBookingCount,
  sessionByShareCode,
  upsertClassFeedback,
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
    // Accept token even if website toggle is off — join links still work
    if (store.settings?.public_token === clean) {
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
      if (store.settings?.public_token === clean) {
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
    const shareCode = request.nextUrl.searchParams.get('shareCode') ||
      request.nextUrl.searchParams.get('class') ||
      undefined;

    // Single-class join detail (B2C invite link)
    if (shareCode) {
      const join = buildClassJoinPayload(resolved.store, shareCode);
      if (!join) {
        return NextResponse.json(
          { error: 'Class not found or cancelled' },
          { status: 404 }
        );
      }
      const ics = buildSessionIcs({
        sessionId: join.session.id,
        title: `${join.session.class_name} · ${join.brand}`,
        date: join.session.date,
        start_time: join.session.start_time,
        duration_min: join.session.duration_min,
        location: join.session.location,
        description: [
          join.session.coach_name
            ? `Coach: ${join.session.coach_name}`
            : '',
          join.session.class_plan || '',
        ]
          .filter(Boolean)
          .join('\n'),
        brand: join.brand,
      });
      const gcal = buildGoogleCalendarUrl({
        title: `${join.session.class_name} · ${join.brand}`,
        date: join.session.date,
        start_time: join.session.start_time,
        duration_min: join.session.duration_min,
        location: join.session.location,
        description: join.session.class_plan || '',
      });
      return NextResponse.json({
        success: true,
        join,
        calendar_links: {
          google: gcal,
          ics,
        },
        companyId: resolved.companyId,
      });
    }

    // Full calendar still requires website published
    if (resolved.store.settings?.enabled !== true) {
      return NextResponse.json(
        { error: 'Calendar not found or not published' },
        { status: 404 }
      );
    }

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

    const shareCode = String(body.share_code || body.shareCode || '').trim();
    let sessionId = String(body.session_id || body.sessionId || '');
    if (!sessionId && shareCode) {
      const byCode = sessionByShareCode(store, shareCode);
      if (byCode) sessionId = byCode.id;
    }

    /** Member post-class feedback (feeling, intensity, etc.) */
    if (
      action === 'class_feedback' ||
      action === 'submit_feedback' ||
      action === 'member_feedback'
    ) {
      const email = String(body.email || body.guest_email || '')
        .trim()
        .toLowerCase();
      const name = String(body.name || body.guest_name || '').trim();
      if (!sessionId) {
        return NextResponse.json(
          { error: 'session_id or share_code required' },
          { status: 400 }
        );
      }
      if (!email && !name) {
        return NextResponse.json(
          { error: 'Email or name required to match your booking' },
          { status: 400 }
        );
      }
      const session = store.sessions.find((s) => s.id === sessionId);
      if (!session || session.status === 'cancelled') {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      // Prefer booking match by email, then client, then name
      let booking = email
        ? store.bookings.find(
            (b) =>
              b.session_id === sessionId &&
              b.status !== 'cancelled' &&
              ((b.guest_email &&
                b.guest_email.toLowerCase() === email) ||
                store.clients.some(
                  (c) =>
                    c.id === b.client_id &&
                    c.email &&
                    c.email.toLowerCase() === email
                ))
          )
        : undefined;
      if (!booking && name) {
        booking = store.bookings.find(
          (b) =>
            b.session_id === sessionId &&
            b.status !== 'cancelled' &&
            ((b.guest_name &&
              b.guest_name.toLowerCase() === name.toLowerCase()) ||
              store.clients.some(
                (c) =>
                  c.id === b.client_id &&
                  c.name.toLowerCase() === name.toLowerCase()
              ))
        );
      }
      if (!booking) {
        return NextResponse.json(
          {
            error:
              'No booking found for this class. Use the same email or name you booked with.',
          },
          { status: 404 }
        );
      }
      if (booking.status === 'no_show' || booking.status === 'waitlist') {
        return NextResponse.json(
          {
            error:
              'Feedback is available after you attend (not waitlist / no-show).',
          },
          { status: 403 }
        );
      }
      const client = store.clients.find((c) => c.id === booking!.client_id);
      if (!store.class_feedback) store.class_feedback = [];
      const row = upsertClassFeedback(store, {
        session_id: sessionId,
        role: 'member',
        client_id: booking.client_id,
        booking_id: booking.id,
        author_name: name || client?.name || booking.guest_name,
        author_email: email || client?.email || booking.guest_email,
        feeling: body.feeling,
        intensity: body.intensity,
        enjoyment: body.enjoyment,
        would_return: body.would_return,
        comment: body.comment != null ? String(body.comment) : undefined,
        tags: Array.isArray(body.tags)
          ? (body.tags as unknown[]).map(String)
          : undefined,
      });
      // Soft-mark attended when they leave feedback after class date
      const today = new Date().toISOString().slice(0, 10);
      if (
        booking.status === 'booked' &&
        session.date <= today
      ) {
        booking.status = 'attended';
        // Session is already known not cancelled (guard above)
        session.status = 'completed';
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        feedback: {
          id: row.id,
          feeling: row.feeling,
          intensity: row.intensity,
          enjoyment: row.enjoyment,
          would_return: row.would_return,
          comment: row.comment,
          tags: row.tags,
        },
        message: 'Thanks — your class feedback was saved',
      });
    }

    if (action !== 'book' && action !== 'book_class') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    if (store.settings?.allow_public_booking === false) {
      return NextResponse.json(
        { error: 'Online booking is disabled' },
        { status: 403 }
      );
    }

    const name = String(body.name || body.guest_name || '').trim();
    const email = body.email || body.guest_email
      ? String(body.email || body.guest_email).trim()
      : '';
    const phone = body.phone || body.guest_phone
      ? String(body.phone || body.guest_phone).trim()
      : '';

    if (!sessionId || !name) {
      return NextResponse.json(
        { error: 'session_id (or share_code) and name required' },
        { status: 400 }
      );
    }

    const session = store.sessions.find((s) => s.id === sessionId);
    // Allow booking via share link even if not listed on public calendar
    const inviteOnly = Boolean(session?.share_code);
    if (
      !session ||
      session.status !== 'scheduled' ||
      (session.public !== true && !inviteOnly)
    ) {
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

    const ctName =
      store.class_types.find((c) => c.id === session.class_type_id)?.name ||
      'Class';
    const brand = store.settings?.brand_name || 'Gym';
    const ics = buildSessionIcs({
      sessionId: session.id,
      title: `${ctName} · ${brand}`,
      date: session.date,
      start_time: session.start_time,
      duration_min: session.duration_min,
      location: session.location,
      description: session.class_plan || session.public_notes || '',
      brand,
    });
    const gcal = buildGoogleCalendarUrl({
      title: `${ctName} · ${brand}`,
      date: session.date,
      start_time: session.start_time,
      duration_min: session.duration_min,
      location: session.location,
      description: session.class_plan || '',
    });

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
      calendar_links: {
        google: gcal,
        ics,
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
