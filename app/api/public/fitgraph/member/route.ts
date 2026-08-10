/**
 * Member / client portal API (token auth).
 * GET  ?token=  — open class vacancies + my bookings
 * POST { token, action: book | request_join | cancel | update_profile }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  FITGRAPH_CLIENT_TOKENS_KEY,
  buildMemberPortalPayload,
  classTypeById,
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

async function resolveMember(
  token: string
): Promise<{
  companyId: number;
  meta: Record<string, unknown>;
  store: FitgraphStore;
  client: FitClient;
} | null> {
  const clean = token.trim();
  if (!clean || clean.length < 8) return null;
  const supabase = getSupabaseServer();

  let companyId = parseCompanyIdFromToken(clean);

  if (companyId == null) {
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
      const map = meta[FITGRAPH_CLIENT_TOKENS_KEY];
      if (map && typeof map === 'object' && clean in (map as object)) {
        companyId = Number(row.id);
        break;
      }
      const store = readFitgraphFromMetadata(meta);
      const c = store.clients.find((x) => x.portal_token === clean);
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
  const client = store.clients.find((c) => c.portal_token === clean);
  if (!client || client.active === false) return null;

  return { companyId: Number(prof.id), meta, store, client };
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
      key: `public-fit-member:${ip}`,
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

    const resolved = await resolveMember(token);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Member portal not found' },
        { status: 404 }
      );
    }

    const from = request.nextUrl.searchParams.get('from') || undefined;
    const to = request.nextUrl.searchParams.get('to') || undefined;
    const portal = buildMemberPortalPayload(
      resolved.store,
      resolved.client,
      from,
      to
    );

    return NextResponse.json({
      success: true,
      portal,
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
      key: `public-fit-member-post:${ip}`,
      limit: 40,
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

    const resolved = await resolveMember(token);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Member portal not found' },
        { status: 404 }
      );
    }

    const { companyId, meta, store, client } = resolved;
    const now = new Date().toISOString();
    const ci = store.clients.findIndex((c) => c.id === client.id);
    if (ci < 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    /**
     * Messaging — member ↔ coaches / desk (same store threads as coach portal).
     * This is how members actually read coach care messages.
     */
    if (
      action.startsWith('message_') ||
      action === 'create_thread' ||
      action === 'post_message' ||
      action === 'mark_read' ||
      action === 'archive_thread'
    ) {
      const { applyMessageAction, threadsForParticipant, totalUnread } =
        await import('@/lib/messaging/service-inbox');
      const author = {
        role: 'member' as const,
        ref_id: client.id,
        name: client.name,
      };
      const bodyWithAuthor = {
        ...body,
        author_role: 'member',
        author_ref_id: client.id,
        author_name: client.name,
        participants: Array.isArray(body.participants)
          ? [
              ...(body.participants as Array<Record<string, unknown>>),
              author,
            ]
          : [author],
      };
      // Convenience: message assigned coach or any coach by id
      if (body.coach_id || body.to_coach) {
        const coachId = String(body.coach_id || body.to_coach || '');
        const coach =
          store.coaches.find((c) => c.id === coachId) ||
          (client.coach_id
            ? store.coaches.find((c) => c.id === client.coach_id)
            : null);
        if (coach) {
          bodyWithAuthor.with_role = 'coach';
          bodyWithAuthor.with_ref_id = coach.id;
          bodyWithAuthor.with_name = coach.name;
          bodyWithAuthor.channel = bodyWithAuthor.channel || 'coach_member';
        }
      }
      if (body.to_desk === true || body.channel === 'desk_member') {
        bodyWithAuthor.with_role = 'desk';
        bodyWithAuthor.with_ref_id = 'desk';
        bodyWithAuthor.with_name = 'Front desk';
        bodyWithAuthor.channel = bodyWithAuthor.channel || 'desk_member';
      }

      // Security: only post/read on threads where member is a participant
      if (
        action === 'message_post' ||
        action === 'post_message' ||
        action === 'message_reply' ||
        action === 'message_mark_read' ||
        action === 'mark_read'
      ) {
        const threadId = String(body.thread_id || body.id || '');
        const thr = (store.threads || []).find((t) => t.id === threadId);
        const allowed = thr?.participants?.some(
          (p) => p.role === 'member' && p.ref_id === client.id
        );
        if (!allowed) {
          return NextResponse.json(
            { error: 'Thread not found' },
            { status: 404 }
          );
        }
      }

      const result = applyMessageAction(store.threads, bodyWithAuthor, now);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      store.threads = result.threads;
      await saveStore(companyId, meta, store);

      const myThreads = threadsForParticipant(
        store.threads || [],
        'member',
        client.id
      );
      return NextResponse.json({
        success: true,
        message: 'Message saved',
        thread: result.thread,
        threads: myThreads,
        unread: totalUnread(store.threads || [], 'member', client.id),
        portal: buildMemberPortalPayload(store, store.clients[ci]),
      });
    }

    if (action === 'update_profile') {
      const c = store.clients[ci];
      const { applyPortalProfileUpdate } = await import(
        '@/lib/services/portal-profile'
      );
      const result = applyPortalProfileUpdate(c, body, {
        storeIdOnRoot: true,
        now,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      store.clients[ci] = c;
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        portal: buildMemberPortalPayload(store, c),
        message: result.emailChanged
          ? 'Profile updated — email synced to gym records and care messages'
          : 'Profile updated',
      });
    }

    if (action === 'family_upsert' || action === 'family_save') {
      const c = store.clients[ci];
      const { upsertFamilyMember } = await import(
        '@/lib/services/family-members'
      );
      const patch = (body.member || body.record || body) as Record<
        string,
        unknown
      >;
      const { list, member, error } = upsertFamilyMember(c.family, patch, now);
      if (error) {
        return NextResponse.json({ error }, { status: 400 });
      }
      c.family = list;
      c.updated_at = now;
      store.clients[ci] = c;
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        member,
        portal: buildMemberPortalPayload(store, c),
        message: patch.id
          ? 'Family member updated'
          : 'Family member added — synced to gym desk',
      });
    }

    if (action === 'family_remove' || action === 'family_delete') {
      const c = store.clients[ci];
      const { removeFamilyMember } = await import(
        '@/lib/services/family-members'
      );
      const famId = String(body.member_id || body.id || '');
      if (!famId) {
        return NextResponse.json(
          { error: 'member_id required' },
          { status: 400 }
        );
      }
      c.family = removeFamilyMember(c.family, famId);
      c.updated_at = now;
      store.clients[ci] = c;
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        portal: buildMemberPortalPayload(store, c),
        message: 'Family member removed',
      });
    }

    if (action === 'cancel' || action === 'cancel_booking') {
      const bookingId = String(body.booking_id || body.bookingId || '');
      const bi = store.bookings.findIndex(
        (b) => b.id === bookingId && b.client_id === client.id
      );
      if (bi < 0) {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        );
      }
      const booking = store.bookings[bi];
      if (booking.status === 'attended') {
        return NextResponse.json(
          { error: 'Cannot cancel an attended class' },
          { status: 400 }
        );
      }
      booking.status = 'cancelled';
      store.bookings[bi] = booking;
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        portal: buildMemberPortalPayload(store, store.clients[ci]),
        message: 'Booking cancelled',
      });
    }

    if (
      action === 'book' ||
      action === 'request_join' ||
      action === 'join'
    ) {
      if (store.settings?.allow_public_booking === false) {
        return NextResponse.json(
          { error: 'Online booking is disabled by the gym' },
          { status: 403 }
        );
      }

      const sessionId = String(body.session_id || body.sessionId || '');
      if (!sessionId) {
        return NextResponse.json(
          { error: 'session_id required' },
          { status: 400 }
        );
      }

      const session = store.sessions.find((s) => s.id === sessionId);
      if (
        !session ||
        session.status !== 'scheduled' ||
        session.public !== true
      ) {
        return NextResponse.json(
          { error: 'Class not available for member booking' },
          { status: 404 }
        );
      }

      const dup = store.bookings.find(
        (b) =>
          b.session_id === sessionId &&
          b.client_id === client.id &&
          (b.status === 'booked' ||
            b.status === 'waitlist' ||
            b.status === 'attended')
      );
      if (dup) {
        return NextResponse.json(
          {
            error: 'Already on this class',
            booking_id: dup.id,
            status: dup.status,
          },
          { status: 409 }
        );
      }

      const ct = classTypeById(store, session.class_type_id);
      const cap = session.capacity ?? ct?.capacity ?? 0;
      const booked = sessionBookingCount(store, sessionId);
      const full = cap > 0 && booked >= cap;
      // Full → waitlist (join request); open → booked
      const famId = body.family_member_id
        ? String(body.family_member_id)
        : body.familyMemberId
          ? String(body.familyMemberId)
          : null;
      let famName: string | null = null;
      if (famId) {
        const m = (client.family || []).find(
          (f) => f.id === famId && f.active !== false
        );
        if (m) {
          famName = `${m.name}${m.relationship ? ` (${m.relationship})` : ''}`;
        }
      }
      const finalStatus: FitBooking['status'] = full ? 'waitlist' : 'booked';

      const row: FitBooking = {
        id: newId('bk'),
        session_id: sessionId,
        client_id: client.id,
        status: finalStatus,
        booked_at: now,
        source: 'member_portal',
        notes:
          finalStatus === 'waitlist'
            ? 'Member portal — waitlist / join request'
            : 'Member portal booking',
        family_member_id: famName ? famId : null,
        family_member_name: famName,
      };
      store.bookings.push(row);
      await saveStore(companyId, meta, store);

      return NextResponse.json({
        success: true,
        booking: {
          id: row.id,
          status: row.status,
          message:
            row.status === 'waitlist'
              ? 'Class is full — you are on the waitlist (join request received)'
              : 'You are booked into this class',
        },
        portal: buildMemberPortalPayload(store, store.clients[ci]),
      });
    }

    if (action === 'reschedule_check' || action === 'reschedule') {
      const { evaluateReschedule } = await import(
        '@/lib/services/advisor-reschedule'
      );
      const bookingId = String(body.booking_id || '');
      const booking = store.bookings.find(
        (b) => b.id === bookingId && b.client_id === client.id
      );
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      const session = store.sessions.find((s) => s.id === booking.session_id);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      const decision = evaluateReschedule({
        policy: store.settings?.reschedule_policy,
        eventDate: session.date,
        eventTime: session.start_time,
        personSoftBlocked: client.booking_soft_block === true,
      });
      if (action === 'reschedule_check') {
        return NextResponse.json({ success: true, decision });
      }
      if (!decision.allowed) {
        return NextResponse.json(
          { error: decision.reason || 'Reschedule not allowed', decision },
          { status: 403 }
        );
      }
      const newSessionId = String(body.new_session_id || '');
      const newSession = store.sessions.find(
        (s) =>
          s.id === newSessionId &&
          s.status === 'scheduled' &&
          s.public === true
      );
      if (!newSession) {
        return NextResponse.json(
          { error: 'Target class not available' },
          { status: 400 }
        );
      }
      booking.session_id = newSessionId;
      booking.notes = [
        booking.notes,
        `Member reschedule from ${session.date} ${session.start_time}`,
      ]
        .filter(Boolean)
        .join(' · ');
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        decision,
        message: decision.free
          ? 'Rescheduled'
          : `Rescheduled (late fee R${decision.fee_zar})`,
        portal: buildMemberPortalPayload(store, store.clients[ci]),
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    console.error('[fitgraph member portal]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
