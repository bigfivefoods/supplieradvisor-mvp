/**
 * Coach portal API (token auth, no Supabase user session).
 * GET  ?token=  — coach's upcoming sessions + roster
 * POST { token, action, ... } — create/update/delete sessions, share, book guest, attendance
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  FITGRAPH_COACH_TOKENS_KEY,
  applySessionKindRules,
  buildClassJoinPath,
  buildCoachPortalPayload,
  coachPersonalBookingError,
  createSessionsFromTemplate,
  ensureSessionShareCode,
  resolveClassTypeForSession,
  resolveSessionTimes,
  sessionKindOf,
  newId,
  parseCompanyIdFromToken,
  readFitgraphFromMetadata,
  sessionBookingCount,
  upsertClassFeedback,
  writeFitgraphToMetadata,
  type FitBooking,
  type FitClient,
  type FitCoach,
  type FitRecurrence,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';
import { mergeHealthProfile } from '@/lib/health/body-map';
import {
  applyMessageAction,
  threadsForParticipant,
  totalUnread,
} from '@/lib/messaging/service-inbox';
import {
  buildPublicFeedbackPath,
  issueFeedbackPrompt,
} from '@/lib/services/booking-feedback';

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
  _meta: Record<string, unknown>,
  store: FitgraphStore
) {
  const { saveAdvisorModuleStore } = await import('@/lib/business/company-data');
  const { FITGRAPH_META_KEY, writeFitgraphToMetadata } = await import(
    '@/lib/fitness/fitgraph'
  );
  await saveAdvisorModuleStore(
    companyId,
    FITGRAPH_META_KEY,
    store,
    writeFitgraphToMetadata
  );
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

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const token = String(form.get('token') || '').trim();
      const action = String(form.get('action') || '');
      const file = form.get('file');
      if (
        (action !== 'upload_certificate' &&
          action !== 'upload_movement_media') ||
        !(file instanceof File)
      ) {
        return NextResponse.json(
          {
            error:
              'token, action=upload_certificate|upload_movement_media and file required',
          },
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
      if (action === 'upload_movement_media') {
        const { isAllowedMovementMedia, storeFitMovementMedia } = await import(
          '@/lib/fitness/movement-upload'
        );
        const bad = isAllowedMovementMedia(file);
        if (bad) {
          return NextResponse.json({ error: bad }, { status: 400 });
        }
        const stored = await storeFitMovementMedia({
          companyId: resolved.companyId,
          fileName: file.name,
          buffer: Buffer.from(await file.arrayBuffer()),
          contentType: file.type,
        });
        if ('error' in stored) {
          return NextResponse.json({ error: stored.error }, { status: 502 });
        }
        return NextResponse.json({
          success: true,
          url: stored.url,
          fileName: stored.fileName,
        });
      }
      const {
        isAllowedCertificateFile,
        storeQualificationCertificate,
      } = await import('@/lib/services/person-qualification-upload');
      const bad = isAllowedCertificateFile(file);
      if (bad) {
        return NextResponse.json({ error: bad }, { status: 400 });
      }
      const stored = await storeQualificationCertificate({
        companyId: resolved.companyId,
        fileName: file.name,
        buffer: Buffer.from(await file.arrayBuffer()),
        contentType: file.type,
      });
      if ('error' in stored) {
        return NextResponse.json({ error: stored.error }, { status: 502 });
      }
      return NextResponse.json({
        success: true,
        url: stored.url,
        fileName: stored.fileName,
      });
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
     * Messaging — coach ↔ member / desk / colleague coaches.
     * Does not require can_manage_classes.
     */
    if (
      action.startsWith('message_') ||
      action === 'create_thread' ||
      action === 'post_message' ||
      action === 'mark_read' ||
      action === 'archive_thread'
    ) {
      const author = {
        role: 'coach' as const,
        ref_id: coach.id,
        name: coach.name,
      };
      const bodyWithAuthor = {
        ...body,
        author_role: 'coach',
        author_ref_id: coach.id,
        author_name: coach.name,
        // Ensure coach is always a participant on threads they create
        participants: Array.isArray(body.participants)
          ? [
              ...(body.participants as Array<Record<string, unknown>>),
              author,
            ]
          : [author],
      };
      // Convenience: message a member by client_id
      if (body.client_id && !body.with_ref_id) {
        const client = store.clients.find(
          (c) => c.id === String(body.client_id)
        );
        if (client) {
          bodyWithAuthor.with_role = 'member';
          bodyWithAuthor.with_ref_id = client.id;
          bodyWithAuthor.with_name = client.name;
          if (!bodyWithAuthor.channel) {
            bodyWithAuthor.channel = 'coach_member';
          }
        }
      }
      if (body.to_desk === true || body.channel === 'desk_coach') {
        bodyWithAuthor.with_role = bodyWithAuthor.with_role || 'desk';
        bodyWithAuthor.with_ref_id = bodyWithAuthor.with_ref_id || 'desk';
        bodyWithAuthor.with_name = bodyWithAuthor.with_name || 'Front desk';
        bodyWithAuthor.channel = bodyWithAuthor.channel || 'desk_coach';
      }
      if (body.coach_id && String(body.coach_id) !== coach.id) {
        const other = store.coaches.find((c) => c.id === String(body.coach_id));
        if (other) {
          bodyWithAuthor.with_role = 'coach';
          bodyWithAuthor.with_ref_id = other.id;
          bodyWithAuthor.with_name = other.name;
          bodyWithAuthor.channel = bodyWithAuthor.channel || 'colleague';
        }
      }

      const result = applyMessageAction(
        store.threads,
        bodyWithAuthor,
        now
      );
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      store.threads = result.threads;
      await saveStore(companyId, meta, store);
      let mailResult: { emailed: number; errors: string[] } | null = null;

      // Mirror coach care messages into members' company Messages (email match)
      // AND email the member's Fit portal address so they actually get the message.
      if (result.thread) {
        try {
          const {
            fanOutServiceThreadToMemberCompanies,
            shouldFanOutServiceMessage,
          } = await import('@/lib/messaging/service-to-company');
          const act = String(bodyWithAuthor.action || body.action || '');
          if (shouldFanOutServiceMessage(act)) {
            const gymName = store.settings?.brand_name || 'Gym';
            await fanOutServiceThreadToMemberCompanies({
              gymCompanyId: companyId,
              gymName: String(gymName),
              module: 'fitgraph',
              serviceThread: result.thread,
              people: store.clients || [],
            });

            const { notifyMembersOnServiceThread } = await import(
              '@/lib/messaging/service-message-email'
            );
            mailResult = await notifyMembersOnServiceThread({
              thread: result.thread,
              people: store.clients || [],
              brand: String(gymName),
              moduleLabel: 'GymAdvisor®',
              portalBasePath: '/member/fitgraph',
            });
            if (mailResult.errors.length) {
              console.warn('[coach portal] member email', mailResult);
            }
          }
        } catch (e) {
          console.warn('[coach portal] service→company fan-out failed', e);
        }
      }

      const from = body.from ? String(body.from) : undefined;
      const to = body.to ? String(body.to) : undefined;
      const myThreads = threadsForParticipant(
        store.threads || [],
        'coach',
        coach.id
      );
      // recompute mail if we have it in scope - attach delivery note
      let deliveryNote = 'Message saved';
      try {
        /* delivery already logged */
      } catch { /* */ }
      const deliveryParts: string[] = ['Message saved (in-app)'];
      if (mailResult) {
        if (mailResult.emailed > 0) {
          deliveryParts.push(
            `email backup to ${mailResult.emailed} not-yet-linked member(s)`
          );
        } else if (mailResult.errors.length) {
          deliveryParts.push(
            'member can read in portal Messages (system user or portal)'
          );
        }
      }
      return NextResponse.json({
        success: true,
        message: deliveryParts.join(' · '),
        delivery: mailResult,
        thread: result.thread,
        threads: myThreads,
        unread: totalUnread(store.threads || [], 'coach', coach.id),
        portal: buildCoachPortalPayload(store, coach, from, to),
      });
    }

    /**
     * Member profile + injury awareness — coaches update so the floor knows
     * what to adapt. Does not require can_manage_classes.
     */
    if (
      action === 'update_client' ||
      action === 'update_client_health' ||
      action === 'update_member'
    ) {
      const clientId = String(body.client_id || body.id || '').trim();
      if (!clientId) {
        return NextResponse.json(
          { error: 'client_id required' },
          { status: 400 }
        );
      }
      const idx = store.clients.findIndex((c) => c.id === clientId);
      if (idx < 0) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
      const prev = store.clients[idx];
      if (body.name != null && String(body.name).trim()) {
        prev.name = String(body.name).trim();
      }
      if (body.email !== undefined) {
        prev.email = body.email ? String(body.email).trim() : undefined;
      }
      if (body.phone !== undefined) {
        prev.phone = body.phone ? String(body.phone).trim() : undefined;
      }
      if (body.emergency_contact !== undefined) {
        prev.emergency_contact = body.emergency_contact
          ? String(body.emergency_contact).trim()
          : undefined;
      }
      if (body.notes !== undefined) {
        prev.notes = body.notes ? String(body.notes) : undefined;
      }
      const healthPatch =
        body.health !== undefined ||
        body.injured !== undefined ||
        body.injury_areas !== undefined ||
        body.injury_notes !== undefined ||
        body.injury_status !== undefined ||
        body.injury_side !== undefined ||
        body.injury_onset !== undefined ||
        body.training_modifications !== undefined ||
        body.goals !== undefined ||
        body.pain_score !== undefined ||
        body.medical_clearance !== undefined;
      if (healthPatch) {
        prev.health = mergeHealthProfile(prev.health, body, {
          now,
          updatedBy: `coach:${coach.name}`,
        });
      }
      prev.updated_at = now;
      store.clients[idx] = prev;
      await saveStore(companyId, meta, store);
      const from = body.from ? String(body.from) : undefined;
      const to = body.to ? String(body.to) : undefined;
      return NextResponse.json({
        success: true,
        message: 'Member profile updated',
        client: {
          id: prev.id,
          code: prev.code,
          name: prev.name,
          email: prev.email,
          phone: prev.phone,
          emergency_contact: prev.emergency_contact,
          notes: prev.notes,
          health: prev.health,
        },
        portal: buildCoachPortalPayload(store, coach, from, to),
      });
    }

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
      if (body.id_number !== undefined) {
        prev.id_number = body.id_number
          ? String(body.id_number).trim()
          : undefined;
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
      if (body.qualifications !== undefined) {
        const { parseQualifications } = await import(
          '@/lib/services/person-qualifications'
        );
        prev.qualifications = parseQualifications(body.qualifications);
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
          qualifications: prev.qualifications || [],
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
      if (sessionKindOf(store, session) === 'coach_personal') {
        return NextResponse.json(
          { error: 'Coach personal time cannot be shared as a join link' },
          { status: 400 }
        );
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
      if (sessionKindOf(store, session) === 'coach_personal') {
        return NextResponse.json(
          { error: 'Coach personal time cannot be listed on the public calendar' },
          { status: 400 }
        );
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
      if (body.class_type_id != null && String(body.class_type_id).trim()) {
        const ctId = String(body.class_type_id);
        const ct = store.class_types.find((c) => c.id === ctId);
        if (!ct) {
          return NextResponse.json(
            { error: 'Class type not found' },
            { status: 404 }
          );
        }
        session.class_type_id = ctId;
      }
      if (body.date != null && String(body.date).trim()) {
        session.date = String(body.date).slice(0, 10);
      }
      if (body.start_time != null && String(body.start_time).trim()) {
        session.start_time = String(body.start_time).slice(0, 5);
      }
      if (body.end_time !== undefined) {
        session.end_time =
          body.end_time == null || body.end_time === ''
            ? null
            : String(body.end_time).slice(0, 5);
      }
      if (body.duration_min != null && body.duration_min !== '') {
        session.duration_min = Number(body.duration_min);
      }
      if (body.session_kind != null || body.class_type_id != null) {
        const resolved = resolveClassTypeForSession(store, {
          class_type_id: session.class_type_id,
          session_kind:
            body.session_kind != null
              ? body.session_kind
              : session.session_kind,
        });
        session.session_kind = resolved.kind;
        if (resolved.class_type_id) {
          session.class_type_id = resolved.class_type_id;
        }
      }
      const times = resolveSessionTimes({
        start_time: session.start_time,
        end_time: session.end_time,
        duration_min: session.duration_min,
      });
      session.start_time = times.start_time;
      session.end_time = times.end_time;
      session.duration_min = times.duration_min;
      const kind = sessionKindOf(store, session);
      const rules = applySessionKindRules(kind, {
        public: session.public === true,
        capacity: session.capacity,
      });
      if (body.capacity === null || body.capacity === '') {
        session.capacity = rules.capacity;
      } else if (body.capacity != null) {
        session.capacity =
          kind === 'coach_personal' ? 0 : Number(body.capacity);
      } else {
        session.capacity = rules.capacity;
      }
      if (kind !== 'class') {
        session.public = false;
      }
      if (body.programme_id !== undefined) {
        session.programme_id = body.programme_id
          ? String(body.programme_id)
          : null;
      }
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
      if (
        body.status === 'cancelled' ||
        body.status === 'completed' ||
        body.status === 'scheduled'
      ) {
        session.status = body.status;
      }
      if (body.location != null) session.location = String(body.location);
      if (body.public === true || body.public === false) {
        session.public = kind === 'class' ? body.public : false;
        if (session.public) {
          ensureSessionShareCode(session);
          if (store.settings) store.settings.enabled = true;
        }
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        message: 'Class updated',
        portal: buildCoachPortalPayload(store, coach),
      });
    }

    if (action === 'delete_session' || action === 'delete') {
      const session = store.sessions.find(
        (s) => s.id === sessionId && s.coach_id === coach.id
      );
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      const deleteSeries =
        body.delete_series === true || body.series === true;
      const seriesId = session.series_id ? String(session.series_id) : null;
      if (deleteSeries && seriesId) {
        const removeIds = new Set(
          store.sessions
            .filter((s) => s.series_id === seriesId)
            .map((s) => s.id)
        );
        store.sessions = store.sessions.filter((s) => !removeIds.has(s.id));
        store.bookings = (store.bookings || []).filter(
          (b) => !removeIds.has(b.session_id)
        );
        await saveStore(companyId, meta, store);
        return NextResponse.json({
          success: true,
          deleted: removeIds.size,
          message: `Deleted ${removeIds.size} classes in series`,
          portal: buildCoachPortalPayload(store, coach),
        });
      }
      store.sessions = store.sessions.filter((s) => s.id !== session.id);
      store.bookings = (store.bookings || []).filter(
        (b) => b.session_id !== session.id
      );
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        deleted: 1,
        message: 'Class deleted',
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
      const blocked = coachPersonalBookingError(store, session);
      if (blocked) {
        return NextResponse.json({ error: blocked }, { status: 400 });
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
      let feedbackPath: string | null = null;
      if (nextStatus === 'attended') {
        const prompted = issueFeedbackPrompt(booking, now);
        booking.feedback_token = prompted.feedback_token;
        booking.feedback_requested_at = prompted.feedback_requested_at;
        if (booking.feedback_token) {
          feedbackPath = buildPublicFeedbackPath(
            'fitgraph',
            companyId,
            booking.feedback_token
          );
        }
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        portal: buildCoachPortalPayload(store, coach),
        feedback_prompt:
          nextStatus === 'attended' && booking.feedback_token
            ? {
                booking_id: booking.id,
                token: booking.feedback_token,
                path: feedbackPath,
              }
            : null,
      });
    }

    /** Coach post-session feedback (how they feel, intensity of the class) */
    if (
      action === 'class_feedback' ||
      action === 'submit_feedback' ||
      action === 'coach_feedback'
    ) {
      const sid = String(body.session_id || sessionId || '');
      const session = store.sessions.find(
        (s) => s.id === sid && s.coach_id === coach.id
      );
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found or not yours' },
          { status: 404 }
        );
      }
      if (!store.class_feedback) store.class_feedback = [];
      const row = upsertClassFeedback(store, {
        session_id: session.id,
        role: 'coach',
        coach_id: coach.id,
        author_name: coach.name,
        author_email: coach.email,
        feeling: body.feeling,
        intensity: body.intensity,
        enjoyment: body.enjoyment,
        would_return: body.would_return,
        comment: body.comment != null ? String(body.comment) : undefined,
        tags: Array.isArray(body.tags)
          ? (body.tags as unknown[]).map(String)
          : undefined,
      });
      const today = new Date().toISOString().slice(0, 10);
      if (session.date <= today && session.status === 'scheduled') {
        session.status = 'completed';
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        feedback: row,
        portal: buildCoachPortalPayload(store, coach),
        message: 'Coach feedback saved',
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

    if (action === 'schedule_member' || action === 'book_with_member') {
      const clientId = String(body.client_id || '');
      const client = store.clients.find(
        (c) => c.id === clientId && c.active !== false
      );
      if (!client) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }
      const date = String(body.date || now.slice(0, 10)).slice(0, 10);
      const startTime = String(body.start_time || '09:00').slice(0, 5);
      const resolved = resolveClassTypeForSession(store, {
        class_type_id: String(body.class_type_id || ''),
        session_kind: 'private_pt',
      });
      if (!resolved.class_type_id) {
        return NextResponse.json(
          { error: 'Could not resolve a personal-training session type' },
          { status: 400 }
        );
      }
      const created = createSessionsFromTemplate(
        store,
        {
          class_type_id: resolved.class_type_id,
          coach_id: coach.id,
          date,
          start_time: startTime,
          end_time: body.end_time != null ? String(body.end_time) : null,
          duration_min:
            body.duration_min != null ? Number(body.duration_min) : 60,
          session_kind: 'private_pt',
          capacity: 1,
          location: body.location != null ? String(body.location) : undefined,
          public: false,
          notes: body.notes != null ? String(body.notes) : `PT with ${client.name}`,
          origin: 'coach',
        },
        { frequency: 'none' },
        now
      );
      store.sessions.push(...created);
      const session = created[0];
      if (!session) {
        return NextResponse.json(
          { error: 'Could not create the appointment' },
          { status: 500 }
        );
      }
      const booking: FitBooking = {
        id: newId('bkg'),
        session_id: session.id,
        client_id: client.id,
        status: 'booked',
        booked_at: now,
        source: 'coach',
      };
      store.bookings.push(booking);
      if (!client.coach_id) {
        const ci = store.clients.findIndex((c) => c.id === client.id);
        if (ci >= 0) {
          store.clients[ci] = {
            ...store.clients[ci],
            coach_id: coach.id,
            updated_at: now,
          };
        }
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        session_id: session.id,
        booking: { id: booking.id, status: booking.status },
        portal: buildCoachPortalPayload(store, coach),
        message: `Booked ${client.name} with you on ${date} at ${startTime}`,
      });
    }

    if (action === 'book_member') {
      const session = store.sessions.find(
        (s) => s.id === sessionId && s.coach_id === coach.id
      );
      if (!session || session.status === 'cancelled') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      const blocked = coachPersonalBookingError(store, session);
      if (blocked) {
        return NextResponse.json({ error: blocked }, { status: 400 });
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
      const resolved = resolveClassTypeForSession(store, {
        class_type_id: classTypeId,
        session_kind: body.session_kind,
      });
      if (resolved.kind === 'class' && !resolved.class_type_id) {
        return NextResponse.json(
          { error: 'class_type_id required' },
          { status: 400 }
        );
      }
      if (!resolved.class_type_id) {
        return NextResponse.json(
          { error: 'Could not resolve class type for this session' },
          { status: 400 }
        );
      }
      const ct = store.class_types.find((c) => c.id === resolved.class_type_id);
      if (!ct) {
        return NextResponse.json(
          { error: 'Class type not found' },
          { status: 404 }
        );
      }

      let recurrence: FitRecurrence | null = null;
      const rawFreq = String(body.frequency || body.repeat || '')
        .toLowerCase()
        .trim();
      const freq: FitRecurrence['frequency'] =
        rawFreq === 'daily' || rawFreq === 'weekly' || rawFreq === 'monthly'
          ? rawFreq
          : action === 'create_series'
            ? 'weekly'
            : 'none';
      if (freq === 'none') {
        recurrence = { frequency: 'none' };
      } else {
        recurrence = {
          frequency: freq,
          interval:
            body.interval != null && body.interval !== ''
              ? Number(body.interval)
              : 1,
          weekdays: Array.isArray(body.weekdays)
            ? (body.weekdays as number[]).map(Number)
            : undefined,
          until: body.until ? String(body.until) : null,
          count:
            body.count != null && body.count !== ''
              ? Number(body.count)
              : null,
        };
      }

      const created = createSessionsFromTemplate(
        store,
        {
          class_type_id: resolved.class_type_id,
          coach_id: coach.id,
          programme_id:
            body.programme_id != null && String(body.programme_id).trim()
              ? String(body.programme_id)
              : null,
          date,
          start_time: startTime,
          end_time: body.end_time != null ? String(body.end_time) : null,
          duration_min:
            body.duration_min != null
              ? Number(body.duration_min)
              : ct.default_duration_min ?? 45,
          session_kind: resolved.kind,
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
            ? resolved.kind === 'coach_personal'
              ? `Blocked ${created.length} personal-time slots`
              : resolved.kind === 'private_pt'
                ? `Scheduled ${created.length} private PT sessions`
                : `Created ${created.length} repeating classes`
            : resolved.kind === 'coach_personal'
              ? 'Personal time blocked on your diary'
              : resolved.kind === 'private_pt'
                ? 'Private PT scheduled'
                : 'Bespoke class created',
      });
    }

    if (
      action === 'upsert_movement' ||
      action === 'update_movement_media' ||
      action === 'delete_movement' ||
      action === 'upsert_programme' ||
      action === 'delete_programme'
    ) {
      if (!store.movements) store.movements = [];
      if (!store.programmes) store.programmes = [];
      const {
        upsertMovement,
        upsertProgramme,
        removeMovementFromProgrammes,
        clearProgrammeFromSessions,
      } = await import('@/lib/fitness/movements');
      if (action === 'upsert_movement') {
        const rec = {
          ...(body.record && typeof body.record === 'object'
            ? (body.record as Record<string, unknown>)
            : body),
          coach_id: coach.id,
        };
        if (!String(rec.name || '').trim()) {
          return NextResponse.json(
            { error: 'Movement name required' },
            { status: 400 }
          );
        }
        const existing = rec.id
          ? store.movements.find((m) => m.id === String(rec.id))
          : null;
        if (existing && existing.coach_id && existing.coach_id !== coach.id) {
          return NextResponse.json(
            { error: 'You can only edit your own movements' },
            { status: 403 }
          );
        }
        const { isSystemMovement } = await import(
          '@/lib/fitness/movement-catalog'
        );
        if (existing && isSystemMovement(existing)) {
          existing.image_url =
            rec.image_url !== undefined
              ? rec.image_url
                ? String(rec.image_url)
                : null
              : existing.image_url ?? null;
          existing.video_url =
            rec.video_url !== undefined
              ? rec.video_url
                ? String(rec.video_url)
                : null
              : existing.video_url ?? null;
          if (rec.video_description != null) {
            existing.video_description = String(rec.video_description);
          }
          existing.updated_at = now;
          await saveStore(companyId, meta, store);
          return NextResponse.json({
            success: true,
            movement: existing,
            portal: buildCoachPortalPayload(store, coach),
            message: 'Catalog image / video updated',
          });
        }
        const row = upsertMovement(store.movements, rec, now, newId);
        await saveStore(companyId, meta, store);
        return NextResponse.json({
          success: true,
          movement: row,
          portal: buildCoachPortalPayload(store, coach),
          message: existing ? 'Movement updated' : 'Movement added to library',
        });
      }
      if (action === 'update_movement_media') {
        if (!store.movements) store.movements = [];
        const id = String(body.id || body.movement_id || '');
        const existing = store.movements.find((m) => m.id === id);
        if (!existing) {
          return NextResponse.json(
            { error: 'Movement not found' },
            { status: 404 }
          );
        }
        if (existing.coach_id && existing.coach_id !== coach.id) {
          return NextResponse.json(
            { error: 'You can only change media on your own movements' },
            { status: 403 }
          );
        }
        if (body.image_url !== undefined) {
          existing.image_url = body.image_url
            ? String(body.image_url)
            : null;
        }
        if (body.video_url !== undefined) {
          existing.video_url = body.video_url
            ? String(body.video_url)
            : null;
        }
        if (body.video_description != null) {
          existing.video_description = String(body.video_description);
        }
        existing.updated_at = now;
        await saveStore(companyId, meta, store);
        return NextResponse.json({
          success: true,
          movement: existing,
          portal: buildCoachPortalPayload(store, coach),
          message: existing.image_url
            ? 'Image saved'
            : 'Catalog image restored',
        });
      }
      if (action === 'delete_movement') {
        const id = String(body.id || body.movement_id || '');
        const existing = store.movements.find((m) => m.id === id);
        if (!existing) {
          return NextResponse.json(
            { error: 'Movement not found' },
            { status: 404 }
          );
        }
        if (existing.coach_id && existing.coach_id !== coach.id) {
          return NextResponse.json(
            { error: 'You can only delete your own movements' },
            { status: 403 }
          );
        }
        {
          const { isSystemMovement } = await import(
            '@/lib/fitness/movement-catalog'
          );
          if (isSystemMovement(existing)) {
            return NextResponse.json(
              { error: 'Built-in catalog movements cannot be deleted' },
              { status: 400 }
            );
          }
        }
        store.movements = store.movements.filter((m) => m.id !== id);
        removeMovementFromProgrammes(store.programmes, id);
        await saveStore(companyId, meta, store);
        return NextResponse.json({
          success: true,
          portal: buildCoachPortalPayload(store, coach),
          message: 'Movement removed',
        });
      }
      if (action === 'upsert_programme') {
        const rec = {
          ...(body.record && typeof body.record === 'object'
            ? (body.record as Record<string, unknown>)
            : body),
          coach_id: coach.id,
        };
        if (!String(rec.name || '').trim()) {
          return NextResponse.json(
            { error: 'Programme name required' },
            { status: 400 }
          );
        }
        const existing = rec.id
          ? store.programmes.find((p) => p.id === String(rec.id))
          : null;
        if (existing && existing.coach_id && existing.coach_id !== coach.id) {
          return NextResponse.json(
            { error: 'You can only edit your own programmes' },
            { status: 403 }
          );
        }
        const row = upsertProgramme(store.programmes, rec, now, newId);
        await saveStore(companyId, meta, store);
        return NextResponse.json({
          success: true,
          programme: row,
          portal: buildCoachPortalPayload(store, coach),
          message: existing ? 'Programme updated' : 'Programme saved',
        });
      }
      const id = String(body.id || body.programme_id || '');
      const existing = store.programmes.find((p) => p.id === id);
      if (!existing) {
        return NextResponse.json(
          { error: 'Programme not found' },
          { status: 404 }
        );
      }
      if (existing.coach_id && existing.coach_id !== coach.id) {
        return NextResponse.json(
          { error: 'You can only delete your own programmes' },
          { status: 403 }
        );
      }
      store.programmes = store.programmes.filter((p) => p.id !== id);
      clearProgrammeFromSessions(store.sessions, id);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        portal: buildCoachPortalPayload(store, coach),
        message: 'Programme removed',
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
