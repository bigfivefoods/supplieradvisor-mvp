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
  buildClassJoinPath,
  buildCoachPortalPayload,
  createSessionsFromTemplate,
  ensureSessionShareCode,
  newId,
  parseCompanyIdFromToken,
  readFitgraphFromMetadata,
  sessionBookingCount,
  writeFitgraphToMetadata,
  type FitBooking,
  type FitClient,
  type FitCoach,
  type FitRecurrence,
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
    const to = request.nextUrl.searchParams.get('to') || undefined;
    const portal = buildCoachPortalPayload(
      resolved.store,
      resolved.coach,
      from || undefined,
      to || undefined
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
    const now = new Date().toISOString();
    const sessionId = String(body.session_id || body.sessionId || '');

    /**
     * Profile self-service — every coach with a portal can update bio etc.
     * (Does not require can_manage_classes.)
     */
    if (action === 'update_profile') {
      const idx = store.coaches.findIndex((c) => c.id === coach.id);
      if (idx < 0) {
        return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
      }
      const prev = store.coaches[idx];
      if (body.name != null && String(body.name).trim()) {
        prev.name = String(body.name).trim();
      }
      if (body.email !== undefined) {
        prev.email = body.email ? String(body.email).trim() : undefined;
      }
      if (body.phone !== undefined) {
        prev.phone = body.phone ? String(body.phone).trim() : undefined;
      }
      if (body.bio !== undefined) {
        prev.bio = String(body.bio);
      }
      if (body.public_bio !== undefined) {
        prev.public_bio = String(body.public_bio);
      }
      // If only one bio field sent, keep them loosely in sync when the other is empty
      if (body.public_bio != null && !prev.bio) {
        prev.bio = String(body.public_bio);
      }
      if (body.bio != null && !prev.public_bio) {
        prev.public_bio = String(body.bio);
      }
      if (body.photo_url !== undefined) {
        prev.photo_url = body.photo_url
          ? String(body.photo_url).trim()
          : undefined;
      }
      if (body.color !== undefined) {
        prev.color = body.color ? String(body.color).trim() : undefined;
      }
      if (Array.isArray(body.specialties)) {
        const specs = (body.specialties as unknown[])
          .map((s) => String(s).trim())
          .filter(Boolean);
        prev.specialties = specs.length ? specs : ['General'];
      }
      store.coaches[idx] = prev;
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        message: 'Profile updated',
        portal: buildCoachPortalPayload(store, prev),
        coach: {
          id: prev.id,
          name: prev.name,
          email: prev.email,
          phone: prev.phone,
          specialties: prev.specialties,
          bio: prev.bio,
          public_bio: prev.public_bio,
          photo_url: prev.photo_url,
          color: prev.color,
        },
      });
    }

    if (coach.can_manage_classes === false) {
      return NextResponse.json(
        { error: 'Coach cannot manage classes' },
        { status: 403 }
      );
    }

    if (action === 'issue_class_invite') {
      const session = store.sessions.find(
        (s) => s.id === sessionId && s.coach_id === coach.id
      );
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      if (!store.settings) {
        const { defaultPublicSettings } = await import('@/lib/fitness/fitgraph');
        store.settings = defaultPublicSettings(companyId);
      }
      if (!store.settings.public_token) {
        store.settings.public_token = `fg_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      }
      store.settings.allow_public_booking = true;
      const shareCode = ensureSessionShareCode(session);
      await saveStore(companyId, meta, store);
      const path = buildClassJoinPath(store.settings.public_token, shareCode);
      const ct = store.class_types.find((c) => c.id === session.class_type_id);
      const brand = store.settings.brand_name || 'Gym';
      const inviteText = [
        `You're invited to ${ct?.name || 'class'} at ${brand}`,
        `${session.date} at ${session.start_time}`,
        `Coach: ${coach.name}`,
        session.location ? `Where: ${session.location}` : '',
        session.class_plan ? `\nPlan:\n${session.class_plan}` : '',
        `\nJoin / add to calendar:`,
      ]
        .filter(Boolean)
        .join('\n');
      return NextResponse.json({
        success: true,
        portal: buildCoachPortalPayload(store, coach),
        invite: {
          share_code: shareCode,
          path,
          text: inviteText,
        },
        public_token: store.settings.public_token,
      });
    }

    if (action === 'share_session') {
      const session = store.sessions.find(
        (s) => s.id === sessionId && s.coach_id === coach.id
      );
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      session.public = body.public !== false;
      if (session.public) {
        ensureSessionShareCode(session);
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
      if (body.class_plan != null) {
        session.class_plan = String(body.class_plan);
        // Optional short blurb for website if none set
        if (session.class_plan && !session.public_notes) {
          const firstLine = session.class_plan.split('\n')[0]?.trim();
          if (firstLine && firstLine.length <= 160) {
            session.public_notes = firstLine;
          }
        }
      }
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

    if (action === 'mark_attended' || action === 'mark_attendance') {
      const bookingId = String(body.booking_id || '');
      const booking = store.bookings.find((b) => b.id === bookingId);
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      const session = store.sessions.find((s) => s.id === booking.session_id);
      if (!session || session.coach_id !== coach.id) {
        return NextResponse.json({ error: 'Not your session' }, { status: 403 });
      }
      const nextStatus = String(body.status || 'attended');
      if (
        nextStatus !== 'attended' &&
        nextStatus !== 'no_show' &&
        nextStatus !== 'booked' &&
        nextStatus !== 'cancelled'
      ) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      booking.status = nextStatus as FitBooking['status'];
      if (nextStatus === 'attended' || nextStatus === 'no_show') {
        session.status =
          session.status === 'cancelled' ? session.status : 'completed';
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        portal: buildCoachPortalPayload(store, coach),
      });
    }

    if (action === 'mark_attendance_bulk') {
      const marks = Array.isArray(body.marks) ? body.marks : [];
      if (!sessionId) {
        return NextResponse.json(
          { error: 'session_id required' },
          { status: 400 }
        );
      }
      const session = store.sessions.find(
        (s) => s.id === sessionId && s.coach_id === coach.id
      );
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      for (const m of marks) {
        const bid = String((m as { booking_id?: string }).booking_id || '');
        const st = String((m as { status?: string }).status || '');
        const booking = store.bookings.find(
          (b) => b.id === bid && b.session_id === sessionId
        );
        if (
          booking &&
          (st === 'attended' ||
            st === 'no_show' ||
            st === 'booked' ||
            st === 'cancelled')
        ) {
          booking.status = st as FitBooking['status'];
        }
      }
      if (marks.length > 0) {
        session.status =
          session.status === 'cancelled' ? session.status : 'completed';
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        portal: buildCoachPortalPayload(store, coach),
      });
    }

    if (action === 'book_member') {
      const session = store.sessions.find(
        (s) => s.id === sessionId && s.coach_id === coach.id
      );
      if (!session || session.status === 'cancelled') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      const clientId = String(body.client_id || '');
      const client = store.clients.find((c) => c.id === clientId);
      if (!client) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }
      const existing = store.bookings.find(
        (b) =>
          b.session_id === sessionId &&
          b.client_id === clientId &&
          b.status !== 'cancelled'
      );
      if (existing) {
        return NextResponse.json(
          { error: 'Already on this class', booking: existing },
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
        source: 'coach',
      };
      store.bookings.push(booking);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        booking: { id: booking.id, status },
        portal: buildCoachPortalPayload(store, coach),
      });
    }

    if (action === 'create_session' || action === 'create_series') {
      const classTypeId = String(body.class_type_id || '');
      const date = String(body.date || now.slice(0, 10));
      const startTime = String(body.start_time || '06:00');
      if (!classTypeId) {
        return NextResponse.json(
          { error: 'class_type_id required' },
          { status: 400 }
        );
      }
      const ct = store.class_types.find((c) => c.id === classTypeId);
      if (!ct) {
        return NextResponse.json(
          { error: 'Class type not found' },
          { status: 404 }
        );
      }

      let recurrence: FitRecurrence | null = null;
      if (action === 'create_series' || body.repeat === 'weekly') {
        const weekdays = Array.isArray(body.weekdays)
          ? (body.weekdays as number[]).map(Number)
          : undefined;
        recurrence = {
          frequency: 'weekly',
          weekdays,
          until: body.until ? String(body.until) : null,
          count: body.count != null ? Number(body.count) : 8,
        };
      } else {
        recurrence = { frequency: 'none' };
      }

      const created = createSessionsFromTemplate(
        store,
        {
          class_type_id: classTypeId,
          coach_id: coach.id,
          date,
          start_time: startTime,
          end_time: body.end_time != null ? String(body.end_time) : null,
          duration_min:
            body.duration_min != null
              ? Number(body.duration_min)
              : ct.default_duration_min ?? 45,
          capacity:
            body.capacity != null ? Number(body.capacity) : ct.capacity ?? 20,
          location: body.location != null ? String(body.location) : undefined,
          public: body.public === true,
          notes: body.notes != null ? String(body.notes) : undefined,
          public_notes:
            body.public_notes != null ? String(body.public_notes) : undefined,
          class_plan:
            body.class_plan != null ? String(body.class_plan) : undefined,
          origin: 'coach',
        },
        recurrence,
        now
      );
      store.sessions.push(...created);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        created: created.length,
        sessions: created.map((s) => ({
          id: s.id,
          date: s.date,
          start_time: s.start_time,
          series_id: s.series_id,
        })),
        portal: buildCoachPortalPayload(store, coach),
        message:
          created.length > 1
            ? `Created ${created.length} repeating classes`
            : 'Bespoke class created',
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
