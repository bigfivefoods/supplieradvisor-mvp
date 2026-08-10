import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  attendanceByClass,
  buildClassJoinPath,
  buildCoachPortalPayload,
  closeCoachEngagement,
  createSessionsFromTemplate,
  defaultPublicSettings,
  ensurePublicToken,
  ensureSessionShareCode,
  issueCoachPortalToken,
  issueClientPortalToken,
  newId,
  reopenCoachEngagement,
  readFitgraphFromMetadata,
  sessionBookingCount,
  sessionsInRange,
  summariseFitgraph,
  summariseSessionFeedback,
  upsertClassFeedback,
  addCoachSpecialty,
  removeCoachSpecialty,
  renameCoachSpecialty,
  getCoachSpecialtyOptions,
  writeFitgraphToMetadata,
  type FitBooking,
  type FitCheckIn,
  type FitClassType,
  type FitClient,
  type FitCoach,
  type FitMembershipPlan,
  type FitPtPack,
  type FitRecurrence,
  type FitSession,
  type FitSubscription,
  type FitgraphStore,
  type FitPublicSettings,
} from '@/lib/fitness/fitgraph';
import {
  applyFitClientImport,
  buildFitClientsXlsx,
  FIT_CLIENT_XLSX_MIME,
  parseFitClientsImport,
} from '@/lib/fitness/fitgraph-clients-xlsx';
import { mergeHealthProfile } from '@/lib/health/body-map';
import {
  applyMessageAction,
  threadsForDesk,
  totalUnread,
} from '@/lib/messaging/service-inbox';
import {
  buildPublicFeedbackPath,
  issueFeedbackPrompt,
} from '@/lib/services/booking-feedback';
import { getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import {
  buildServiceMemberInviteLink,
  buildServiceMemberPortalLink,
  defaultShareFlags,
  inviteExpiryIso,
  issueServiceMemberInviteToken,
  mergeInviteFieldsFromRecord,
  serviceMemberInviteEmailHtml,
  serviceMemberInviteEmailText,
} from '@/lib/services/member-invite';

export const runtime = 'nodejs';

type Entity =
  | 'coaches'
  | 'clients'
  | 'membership_plans'
  | 'subscriptions'
  | 'class_types'
  | 'sessions'
  | 'bookings'
  | 'check_ins'
  | 'pt_packs';

async function loadStore(companyId: number) {
  const supabase = getSupabaseServer();
  const { data: prof } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', companyId)
    .maybeSingle();
  const meta =
    prof?.metadata && typeof prof.metadata === 'object'
      ? { ...(prof.metadata as Record<string, unknown>) }
      : {};
  return { meta, store: readFitgraphFromMetadata(meta) };
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

function analysis(store: FitgraphStore) {
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const feedback = [...(store.class_feedback || [])].sort((a, b) =>
    (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at)
  );
  return {
    attendanceByClass: attendanceByClass(store),
    weekSessions: sessionsInRange(
      store,
      today,
      weekEnd.toISOString().slice(0, 10)
    ).map((s) => ({
      ...s,
      booked: sessionBookingCount(store, s.id),
      feedback: summariseSessionFeedback(store, s.id),
    })),
    recentFeedback: feedback.slice(0, 40),
  };
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const { store } = await loadStore(companyId);

    const exportKind = request.nextUrl.searchParams.get('export');
    if (exportKind === 'clients' || exportKind === 'clients_template') {
      const templateOnly = exportKind === 'clients_template';
      const bytes = buildFitClientsXlsx(store, {
        templateOnly,
        brandName: store.settings?.brand_name || undefined,
      });
      const stamp = new Date().toISOString().slice(0, 10);
      const brand = (store.settings?.brand_name || 'fitgraph')
        .replace(/[^\w.-]+/g, '_')
        .slice(0, 40);
      const filename = templateOnly
        ? `${brand}_clients_import_template.xlsx`
        : `${brand}_clients_${stamp}.xlsx`;
      return new NextResponse(Buffer.from(bytes), {
        status: 200,
        headers: {
          'Content-Type': FIT_CLIENT_XLSX_MIME,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({
      success: true,
      store,
      summary: summariseFitgraph(store),
      analysis: analysis(store),
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
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const action = String(body.action || 'upsert');
    const entity = String(body.entity || '') as Entity;
    const { meta, store } = await loadStore(companyId);
    const now = new Date().toISOString();

    if (action === 'seed_demo') {
      const demo = seedDemo(now, companyId);
      await saveStore(companyId, meta, demo);
      return NextResponse.json({
        success: true,
        store: demo,
        summary: summariseFitgraph(demo),
        analysis: analysis(demo),
        message: 'Demo gym loaded',
      });
    }

    /** Messaging: desk · coaches · members */
    if (
      action.startsWith('message_') ||
      action === 'create_thread' ||
      action === 'post_message' ||
      action === 'mark_read' ||
      action === 'archive_thread'
    ) {
      const result = applyMessageAction(store.threads, body, now);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      store.threads = result.threads;
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        thread: result.thread,
        threads: threadsForDesk(store.threads),
        unread: totalUnread(store.threads || [], 'desk', 'desk'),
        message: 'Message saved',
      });
    }

    /** Owner: bulk import clients from .xlsx (or CSV) */
    if (
      action === 'import_clients' ||
      action === 'import_clients_xlsx' ||
      body.import_clients === true
    ) {
      const parsed = parseFitClientsImport({
        xlsxBase64:
          body.xlsxBase64 != null ? String(body.xlsxBase64) : undefined,
        csv: body.csv != null ? String(body.csv) : undefined,
      });
      if (parsed.errors.length && !parsed.rows.length) {
        return NextResponse.json(
          {
            error: parsed.errors[0] || 'Import failed',
            parseErrors: parsed.errors,
          },
          { status: 400 }
        );
      }
      const result = applyFitClientImport(store, parsed.rows, now);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        imported: result.created + result.updated,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        parseErrors: [...parsed.errors, ...result.errors],
        warnings: result.warnings,
        message: `Imported ${result.created} new, updated ${result.updated} existing client(s)`,
      });
    }

    if (action === 'update_settings') {
      const patch = (body.settings || body.record || {}) as Partial<FitPublicSettings>;
      store.settings = ensurePublicToken(
        {
          ...defaultPublicSettings(),
          ...(store.settings || {}),
          ...patch,
        },
        companyId
      );
      if (body.rotate_token === true) {
        store.settings.public_token = `fg_${companyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      }
      // Keep brand from company if blank
      if (!store.settings.brand_name && typeof body.brand_name === 'string') {
        store.settings.brand_name = body.brand_name;
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        message: 'Website / portal settings updated',
      });
    }

    if (action === 'issue_coach_portal') {
      const coachId = String(body.coachId || body.id || '');
      const coach = store.coaches.find((c) => c.id === coachId);
      if (!coach) {
        return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
      }
      coach.portal_token = issueCoachPortalToken(companyId);
      coach.can_manage_classes = true;
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        portal_token: coach.portal_token,
        analysis: analysis(store),
      });
    }

    /** Owner: issue member portal link so client can book open classes */
    if (
      action === 'issue_client_portal' ||
      action === 'issue_member_portal'
    ) {
      const clientId = String(body.clientId || body.client_id || body.id || '');
      const client = store.clients.find((c) => c.id === clientId);
      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
      client.portal_token = issueClientPortalToken(companyId);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        portal_token: client.portal_token,
        analysis: analysis(store),
        message: 'Member portal link issued',
      });
    }

    /** Owner: email invite so client can join as a member and open their portal */
    if (
      action === 'invite_client' ||
      action === 'invite_member' ||
      action === 'send_member_invite'
    ) {
      const clientId = String(body.clientId || body.client_id || body.id || '');
      const client = store.clients.find((c) => c.id === clientId);
      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
      const email = String(body.email || client.email || '')
        .toLowerCase()
        .trim();
      if (!email || !email.includes('@')) {
        return NextResponse.json(
          { error: 'A valid email is required to send a member invite' },
          { status: 400 }
        );
      }

      const nowIso = new Date().toISOString();
      const defaults = defaultShareFlags('fitgraph');
      const inviteToken = issueServiceMemberInviteToken('fitgraph', companyId);
      if (!client.portal_token) {
        client.portal_token = issueClientPortalToken(companyId);
      }
      client.email = email;
      client.invite_token = inviteToken;
      client.invite_status = 'pending';
      client.invite_email = email;
      client.invite_sent_at = nowIso;
      client.invite_accepted_at = null;
      client.invite_expires_at = inviteExpiryIso(14);
      client.share_schedule =
        body.share_schedule !== undefined
          ? body.share_schedule !== false
          : client.share_schedule !== false
            ? true
            : defaults.share_schedule;
      client.share_feedback =
        body.share_feedback !== undefined
          ? body.share_feedback !== false
          : client.share_feedback !== false
            ? true
            : defaults.share_feedback;
      client.updated_at = nowIso;

      const supabase = getSupabaseServer();
      const { data: prof } = await supabase
        .from('profiles')
        .select('trading_name, legal_name')
        .eq('id', companyId)
        .maybeSingle();
      const businessName =
        store.settings?.brand_name ||
        prof?.trading_name ||
        prof?.legal_name ||
        'Your gym';
      const invitedBy = String(body.invitedBy || body.invited_by || 'Your gym team');
      const inviteLink = buildServiceMemberInviteLink('fitgraph', inviteToken);

      let emailWarning: string | undefined;
      try {
        const resend = getResend();
        const { error: emailError } = await resend.emails.send({
          from: getResendFrom(),
          replyTo: getResendReplyTo(),
          to: email,
          subject: `${businessName} invited you to FitAdvisor®`,
          html: serviceMemberInviteEmailHtml({
            inviteeName: client.name,
            businessName,
            invitedBy,
            inviteLink,
            module: 'fitgraph',
          }),
          text: serviceMemberInviteEmailText({
            inviteeName: client.name,
            businessName,
            invitedBy,
            inviteLink,
            module: 'fitgraph',
          }),
        });
        if (emailError) {
          emailWarning = `Invite saved but email failed: ${emailError.message}`;
        }
      } catch (emailErr: unknown) {
        const msg =
          emailErr instanceof Error ? emailErr.message : 'Email failed';
        emailWarning = `Invite saved but email failed: ${msg}`;
      }

      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        invite_token: inviteToken,
        invite_link: inviteLink,
        portal_token: client.portal_token,
        portal_link: buildServiceMemberPortalLink(
          'fitgraph',
          client.portal_token!
        ),
        email_sent: !emailWarning,
        warning: emailWarning,
        message: emailWarning
          ? emailWarning
          : `Member invite sent to ${email}`,
      });
    }

    if (
      action === 'revoke_member_invite' ||
      action === 'revoke_client_invite'
    ) {
      const clientId = String(body.clientId || body.client_id || body.id || '');
      const client = store.clients.find((c) => c.id === clientId);
      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
      client.invite_status = 'revoked';
      client.invite_token = null;
      client.invite_expires_at = null;
      client.updated_at = new Date().toISOString();
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        message: 'Member invite revoked',
      });
    }

    /** Owner: end current coach engagement and archive to history */
    if (
      action === 'close_coach_engagement' ||
      action === 'end_coach_engagement'
    ) {
      const coachId = String(body.coachId || body.id || '');
      const idx = store.coaches.findIndex((c) => c.id === coachId);
      if (idx < 0) {
        return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
      }
      const endDate = body.end_date
        ? String(body.end_date).slice(0, 10)
        : now.slice(0, 10);
      store.coaches[idx] = closeCoachEngagement(store.coaches[idx], endDate, {
        note: body.note != null ? String(body.note) : undefined,
        reason: body.reason != null ? String(body.reason) : undefined,
        nowIso: now,
      });
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        message: 'Coach engagement ended and saved to history',
      });
    }

    /** Owner: rehire / start a new engagement (keeps prior history) */
    if (
      action === 'reopen_coach_engagement' ||
      action === 'rehire_coach'
    ) {
      const coachId = String(body.coachId || body.id || '');
      const idx = store.coaches.findIndex((c) => c.id === coachId);
      if (idx < 0) {
        return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
      }
      const startDate = body.start_date
        ? String(body.start_date).slice(0, 10)
        : now.slice(0, 10);
      // If still open, archive current stint first so history stays complete
      let coach = store.coaches[idx];
      if (coach.active !== false && !coach.end_date) {
        const endBefore = body.end_before
          ? String(body.end_before).slice(0, 10)
          : startDate;
        coach = closeCoachEngagement(coach, endBefore, {
          note: 'Closed before rehire',
          reason: 'rehire',
          nowIso: now,
        });
      }
      store.coaches[idx] = reopenCoachEngagement(coach, startDate);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        message: 'Coach engagement reopened',
      });
    }

    /** Owner: coach calendar payload (plan vs actual) */
    if (action === 'coach_calendar') {
      const coachId = String(body.coachId || body.coach_id || '');
      const coach = store.coaches.find((c) => c.id === coachId);
      if (!coach) {
        return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
      }
      const from = body.from ? String(body.from) : undefined;
      const to = body.to ? String(body.to) : undefined;
      return NextResponse.json({
        success: true,
        portal: buildCoachPortalPayload(store, coach, from, to),
        store,
        summary: summariseFitgraph(store),
      });
    }

    /** Create one-off or weekly series of sessions (owner or for a coach) */
    if (action === 'create_session_series' || action === 'create_session') {
      const coachId = String(body.coach_id || body.coachId || '');
      const classTypeId = String(body.class_type_id || '');
      const date = String(body.date || now.slice(0, 10));
      const startTime = String(body.start_time || '06:00');
      if (!coachId || !classTypeId) {
        return NextResponse.json(
          { error: 'coach_id and class_type_id required' },
          { status: 400 }
        );
      }
      if (!store.coaches.find((c) => c.id === coachId)) {
        return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
      }
      if (!store.class_types.find((c) => c.id === classTypeId)) {
        return NextResponse.json(
          { error: 'Class type not found' },
          { status: 404 }
        );
      }
      let recurrence: FitRecurrence | null = null;
      if (
        action === 'create_session_series' ||
        body.repeat === 'weekly' ||
        body.frequency === 'weekly'
      ) {
        recurrence = {
          frequency: 'weekly',
          weekdays: Array.isArray(body.weekdays)
            ? (body.weekdays as number[]).map(Number)
            : undefined,
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
          coach_id: coachId,
          date,
          start_time: startTime,
          end_time: body.end_time != null ? String(body.end_time) : null,
          duration_min:
            body.duration_min != null ? Number(body.duration_min) : null,
          capacity: body.capacity != null ? Number(body.capacity) : null,
          location: body.location != null ? String(body.location) : undefined,
          public: body.public === true,
          notes: body.notes != null ? String(body.notes) : undefined,
          public_notes:
            body.public_notes != null ? String(body.public_notes) : undefined,
          class_plan:
            body.class_plan != null ? String(body.class_plan) : undefined,
          origin: 'owner',
        },
        recurrence,
        now
      );
      store.sessions.push(...created);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        created: created.length,
        sessions: created,
        message:
          created.length > 1
            ? `Scheduled ${created.length} classes in series`
            : 'Bespoke class scheduled',
      });
    }

    /**
     * Issue / refresh B2C join link for a class.
     * Ensures public token + share_code; returns join URL for WhatsApp/email.
     */
    if (action === 'issue_class_invite') {
      const sessionId = String(body.session_id || body.id || '');
      const session = store.sessions.find((s) => s.id === sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      store.settings = ensurePublicToken(store.settings, companyId);
      // Keep calendar usable for invites even if not fully published
      if (store.settings.allow_public_booking === false) {
        store.settings.allow_public_booking = true;
      }
      const shareCode = ensureSessionShareCode(session);
      await saveStore(companyId, meta, store);
      const path = buildClassJoinPath(
        store.settings.public_token,
        shareCode
      );
      const ct = store.class_types.find((c) => c.id === session.class_type_id);
      const coach = store.coaches.find((c) => c.id === session.coach_id);
      const brand = store.settings.brand_name || 'Gym';
      const inviteText = [
        `You're invited to ${ct?.name || 'class'} at ${brand}`,
        `${session.date} at ${session.start_time}`,
        coach?.name ? `Coach: ${coach.name}` : '',
        session.location ? `Where: ${session.location}` : '',
        session.class_plan ? `\nPlan:\n${session.class_plan}` : '',
        `\nJoin / add to calendar:`,
      ]
        .filter(Boolean)
        .join('\n');

      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        invite: {
          share_code: shareCode,
          path,
          // Client prepends origin
          text: inviteText,
          class_name: ct?.name,
          date: session.date,
          start_time: session.start_time,
        },
      });
    }

    /** Update planned class activities (visible to members & coaches) */
    if (action === 'update_class_plan') {
      const sessionId = String(body.session_id || body.id || '');
      const session = store.sessions.find((s) => s.id === sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      session.class_plan =
        body.class_plan != null ? String(body.class_plan) : '';
      // Keep public_notes in sync as short summary if blank and plan provided
      if (
        body.sync_public !== false &&
        session.class_plan &&
        !session.public_notes
      ) {
        const firstLine = session.class_plan.split('\n')[0]?.trim();
        if (firstLine && firstLine.length <= 160) {
          session.public_notes = firstLine;
        }
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        session: {
          id: session.id,
          class_plan: session.class_plan,
          public_notes: session.public_notes,
        },
      });
    }

    if (action === 'mark_attendance') {
      const bookingId = String(body.booking_id || '');
      const status = String(body.status || 'attended') as FitBooking['status'];
      const booking = store.bookings.find((b) => b.id === bookingId);
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      if (
        status !== 'attended' &&
        status !== 'no_show' &&
        status !== 'booked' &&
        status !== 'cancelled'
      ) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      booking.status = status;
      const session = store.sessions.find((s) => s.id === booking.session_id);
      if (
        session &&
        (status === 'attended' || status === 'no_show') &&
        session.status !== 'cancelled'
      ) {
        session.status = 'completed';
      }
      let feedbackPath: string | null = null;
      if (status === 'attended') {
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
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        feedback_prompt:
          status === 'attended' && booking.feedback_token
            ? {
                booking_id: booking.id,
                token: booking.feedback_token,
                path: feedbackPath,
                requested_at: booking.feedback_requested_at,
                submitted: Boolean(booking.feedback_submitted_at),
              }
            : null,
        message:
          status === 'attended' && feedbackPath
            ? 'Marked attended — feedback link ready for the member'
            : undefined,
      });
    }

    /** Owner: manage coach specialty catalogue (add / rename / remove) */
    if (
      action === 'manage_specialties' ||
      action === 'coach_specialties'
    ) {
      const op = String(body.op || body.operation || 'list');
      if (!store.settings) store.settings = defaultPublicSettings(companyId);
      // Seed catalogue once if never customised (so edits persist)
      if (
        !Array.isArray(store.settings.coach_specialties) ||
        store.settings.coach_specialties.length === 0
      ) {
        store.settings.coach_specialties = getCoachSpecialtyOptions(store);
      }

      if (op === 'list') {
        return NextResponse.json({
          success: true,
          specialties: getCoachSpecialtyOptions(store),
          store,
          summary: summariseFitgraph(store),
        });
      }

      if (op === 'add') {
        const result = addCoachSpecialty(
          store,
          String(body.name || body.specialty || '')
        );
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        await saveStore(companyId, meta, store);
        return NextResponse.json({
          success: true,
          specialties: result.options,
          store,
          summary: summariseFitgraph(store),
          analysis: analysis(store),
          message: 'Specialty added',
        });
      }

      if (op === 'rename' || op === 'edit') {
        const result = renameCoachSpecialty(
          store,
          String(body.from || body.old_name || body.old || ''),
          String(body.to || body.new_name || body.name || '')
        );
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        await saveStore(companyId, meta, store);
        return NextResponse.json({
          success: true,
          specialties: result.options,
          store,
          summary: summariseFitgraph(store),
          analysis: analysis(store),
          message: 'Specialty updated',
        });
      }

      if (op === 'remove' || op === 'delete') {
        const result = removeCoachSpecialty(
          store,
          String(body.name || body.specialty || body.from || ''),
          { stripFromCoaches: body.strip_from_coaches === true }
        );
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        await saveStore(companyId, meta, store);
        return NextResponse.json({
          success: true,
          specialties: result.options,
          store,
          summary: summariseFitgraph(store),
          analysis: analysis(store),
          message: 'Specialty removed from catalogue',
        });
      }

      if (op === 'set' || op === 'replace') {
        // Replace full list (ordered)
        const list = Array.isArray(body.specialties)
          ? (body.specialties as unknown[])
              .map((s) => String(s).trim())
              .filter(Boolean)
          : [];
        if (!list.length) {
          return NextResponse.json(
            { error: 'specialties array required' },
            { status: 400 }
          );
        }
        const seen = new Set<string>();
        const unique: string[] = [];
        for (const s of list) {
          const k = s.toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          unique.push(s.slice(0, 48));
        }
        store.settings.coach_specialties = unique;
        await saveStore(companyId, meta, store);
        return NextResponse.json({
          success: true,
          specialties: unique,
          store,
          summary: summariseFitgraph(store),
          analysis: analysis(store),
          message: 'Specialty catalogue saved',
        });
      }

      return NextResponse.json(
        { error: 'Unknown op — use list|add|rename|remove|set' },
        { status: 400 }
      );
    }

    /** Owner desk: record member or coach class feedback */
    if (
      action === 'submit_class_feedback' ||
      action === 'class_feedback'
    ) {
      const sessionId = String(body.session_id || '');
      const session = store.sessions.find((s) => s.id === sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      const role =
        String(body.role || 'member') === 'coach' ? 'coach' : 'member';
      if (!store.class_feedback) store.class_feedback = [];
      const row = upsertClassFeedback(
        store,
        {
          session_id: sessionId,
          role,
          client_id: body.client_id != null ? String(body.client_id) : null,
          coach_id:
            body.coach_id != null
              ? String(body.coach_id)
              : role === 'coach'
                ? session.coach_id || null
                : null,
          booking_id:
            body.booking_id != null ? String(body.booking_id) : null,
          author_name:
            body.author_name != null ? String(body.author_name) : undefined,
          author_email:
            body.author_email != null
              ? String(body.author_email).toLowerCase()
              : undefined,
          feeling: body.feeling,
          intensity: body.intensity,
          enjoyment: body.enjoyment,
          would_return: body.would_return,
          comment: body.comment != null ? String(body.comment) : undefined,
          tags: Array.isArray(body.tags)
            ? (body.tags as unknown[]).map(String)
            : undefined,
        },
        now
      );
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        feedback: row,
        message: 'Feedback saved',
      });
    }

    if (action === 'mark_attendance_bulk') {
      const sessionId = String(body.session_id || '');
      const marks = Array.isArray(body.marks) ? body.marks : [];
      for (const m of marks) {
        const bid = String((m as { booking_id?: string }).booking_id || '');
        const st = String((m as { status?: string }).status || '');
        const booking = store.bookings.find(
          (b) =>
            b.id === bid && (!sessionId || b.session_id === sessionId)
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
      if (sessionId) {
        const session = store.sessions.find((s) => s.id === sessionId);
        if (session && session.status !== 'cancelled' && marks.length > 0) {
          session.status = 'completed';
        }
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
      });
    }

    if (action === 'delete') {
      const id = String(body.id || '');
      if (!id || !entity) {
        return NextResponse.json(
          { error: 'entity and id required' },
          { status: 400 }
        );
      }
      const key = entity as keyof FitgraphStore;
      const list = store[key];
      if (Array.isArray(list)) {
        (store as Record<string, unknown>)[key] = list.filter(
          (row: { id?: string }) => row.id !== id
        );
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
      });
    }

    if (!entity) {
      return NextResponse.json({ error: 'entity required' }, { status: 400 });
    }
    const rec = (body.record || body) as Record<string, unknown>;
    upsert(store, entity, rec, now);
    await saveStore(companyId, meta, store);
    return NextResponse.json({
      success: true,
      store,
      summary: summariseFitgraph(store),
      analysis: analysis(store),
    });
  } catch (e: unknown) {
    console.error('[fitgraph]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function upsert(
  store: FitgraphStore,
  entity: Entity,
  rec: Record<string, unknown>,
  now: string
) {
  if (!store.subscriptions) store.subscriptions = [];
  if (!store.settings) store.settings = defaultPublicSettings();

  if (entity === 'coaches') {
    const id = String(rec.id || newId('coh'));
    const i = store.coaches.findIndex((c) => c.id === id);
    const prev = i >= 0 ? store.coaches[i] : null;
    const startDate =
      rec.start_date != null && String(rec.start_date).trim()
        ? String(rec.start_date).slice(0, 10)
        : prev?.start_date || now.slice(0, 10);
    let endDate: string | null =
      rec.end_date !== undefined
        ? rec.end_date
          ? String(rec.end_date).slice(0, 10)
          : null
        : prev?.end_date ?? null;
    let history = Array.isArray(prev?.history)
      ? [...(prev!.history || [])]
      : Array.isArray(rec.history)
        ? (rec.history as FitCoach['history'])
        : [];
    // If owner newly sets an end date on an open engagement, archive to history
    if (endDate && prev && !prev.end_date && startDate) {
      const closed = closeCoachEngagement(
        { ...prev, start_date: startDate, history },
        endDate,
        {
          note:
            rec.ended_note != null ? String(rec.ended_note) : undefined,
          reason:
            rec.ended_reason != null ? String(rec.ended_reason) : undefined,
          nowIso: now,
        }
      );
      history = closed.history || history;
    }
    // If owner clears end date after a closed stint, treat as rehire (history kept)
    if (
      endDate === null &&
      prev?.end_date &&
      rec.end_date !== undefined
    ) {
      // prior stint already in history from close; ensure current open period uses startDate
      history = Array.isArray(prev.history) ? [...prev.history] : history;
    }
    const activeExplicit =
      rec.active !== undefined ? rec.active !== false : undefined;
    const row: FitCoach = {
      id,
      code: String(rec.code || `C-${store.coaches.length + 1}`),
      name: String(rec.name || 'Coach'),
      email: rec.email != null ? String(rec.email) : prev?.email,
      phone: rec.phone != null ? String(rec.phone) : prev?.phone,
      specialties: Array.isArray(rec.specialties)
        ? (rec.specialties as string[])
        : rec.specialty
          ? [String(rec.specialty)]
          : prev?.specialties || [],
      bio: rec.bio != null ? String(rec.bio) : prev?.bio,
      public_bio:
        rec.public_bio != null ? String(rec.public_bio) : prev?.public_bio,
      photo_url:
        rec.photo_url !== undefined
          ? rec.photo_url
            ? String(rec.photo_url)
            : undefined
          : prev?.photo_url,
      portal_token:
        rec.portal_token !== undefined
          ? rec.portal_token
            ? String(rec.portal_token)
            : null
          : prev?.portal_token ?? null,
      can_manage_classes:
        rec.can_manage_classes !== undefined
          ? rec.can_manage_classes !== false
          : prev?.can_manage_classes !== false,
      color: rec.color != null ? String(rec.color) : prev?.color,
      start_date: startDate,
      end_date: endDate,
      rate_zar:
        rec.rate_zar !== undefined
          ? rec.rate_zar === null || rec.rate_zar === ''
            ? null
            : Number(rec.rate_zar)
          : prev?.rate_zar ?? null,
      rate_basis:
        rec.rate_basis !== undefined
          ? rec.rate_basis
            ? String(rec.rate_basis)
            : null
          : prev?.rate_basis ?? 'per_class',
      rate_note:
        rec.rate_note != null
          ? String(rec.rate_note)
          : prev?.rate_note,
      contracts: Array.isArray(rec.contracts)
        ? (rec.contracts as FitCoach['contracts'])
        : prev?.contracts || [],
      history,
      active:
        activeExplicit !== undefined
          ? activeExplicit
          : endDate
            ? false
            : prev?.active !== false,
      created_at: prev?.created_at || now,
    };
    if (i >= 0) store.coaches[i] = row;
    else store.coaches.push(row);
  } else if (entity === 'clients') {
    const id = String(rec.id || newId('cli'));
    const i = store.clients.findIndex((c) => c.id === id);
    const prev = i >= 0 ? store.clients[i] : null;
    const healthPatch =
      rec.health !== undefined ||
      rec.injured !== undefined ||
      rec.injury_areas !== undefined ||
      rec.injury_notes !== undefined ||
      rec.injury_status !== undefined ||
      rec.training_modifications !== undefined ||
      rec.goals !== undefined ||
      rec.pain_score !== undefined;
    const row: FitClient = {
      id,
      code: String(rec.code || prev?.code || `M-${store.clients.length + 1}`),
      name: String(rec.name || prev?.name || 'Client'),
      email:
        rec.email !== undefined
          ? rec.email
            ? String(rec.email)
            : undefined
          : prev?.email,
      phone:
        rec.phone !== undefined
          ? rec.phone
            ? String(rec.phone)
            : undefined
          : prev?.phone,
      photo_url:
        rec.photo_url !== undefined
          ? rec.photo_url
            ? String(rec.photo_url)
            : undefined
          : prev?.photo_url,
      portal_token:
        rec.portal_token !== undefined
          ? rec.portal_token
            ? String(rec.portal_token)
            : null
          : prev?.portal_token ?? null,
      ...mergeInviteFieldsFromRecord(prev, rec as Record<string, unknown>),
      share_schedule:
        rec.share_schedule !== undefined
          ? rec.share_schedule !== false
          : prev?.share_schedule !== false,
      share_feedback:
        rec.share_feedback !== undefined
          ? rec.share_feedback !== false
          : prev?.share_feedback !== false,
      membership_plan_id:
        rec.membership_plan_id !== undefined
          ? rec.membership_plan_id
            ? String(rec.membership_plan_id)
            : null
          : prev?.membership_plan_id ?? null,
      membership_status: String(
        rec.membership_status || prev?.membership_status || 'active'
      ),
      start_date:
        rec.start_date !== undefined
          ? rec.start_date
            ? String(rec.start_date).slice(0, 10)
            : null
          : prev?.start_date ?? null,
      end_date:
        rec.end_date !== undefined
          ? rec.end_date
            ? String(rec.end_date).slice(0, 10)
            : null
          : prev?.end_date ?? null,
      coach_id:
        rec.coach_id !== undefined
          ? rec.coach_id
            ? String(rec.coach_id)
            : null
          : prev?.coach_id ?? null,
      emergency_contact:
        rec.emergency_contact !== undefined
          ? rec.emergency_contact
            ? String(rec.emergency_contact)
            : undefined
          : prev?.emergency_contact,
      notes:
        rec.notes !== undefined
          ? rec.notes
            ? String(rec.notes)
            : undefined
          : prev?.notes,
      health: healthPatch
        ? mergeHealthProfile(prev?.health, rec, {
            now,
            updatedBy: String(rec.health_updated_by || 'desk'),
          })
        : prev?.health,
      active:
        rec.active !== undefined ? rec.active !== false : prev?.active !== false,
      created_at: prev?.created_at || now,
      updated_at: now,
    };
    if (i >= 0) store.clients[i] = row;
    else store.clients.push(row);
  } else if (entity === 'membership_plans') {
    const id = String(rec.id || newId('pln'));
    const i = store.membership_plans.findIndex((p) => p.id === id);
    const row: FitMembershipPlan = {
      id,
      code: String(rec.code || `P-${store.membership_plans.length + 1}`),
      name: String(rec.name || 'Plan'),
      price_zar: Number(rec.price_zar) || 0,
      billing:
        (rec.billing as FitMembershipPlan['billing']) || 'monthly',
      class_credits:
        rec.class_credits != null ? Number(rec.class_credits) : null,
      pt_credits: rec.pt_credits != null ? Number(rec.pt_credits) : null,
      description:
        rec.description != null ? String(rec.description) : undefined,
      public: rec.public !== false,
      active: rec.active !== false,
      created_at: i >= 0 ? store.membership_plans[i].created_at : now,
    };
    if (i >= 0) store.membership_plans[i] = row;
    else store.membership_plans.push(row);
  } else if (entity === 'subscriptions') {
    const id = String(rec.id || newId('sub'));
    const i = store.subscriptions.findIndex((s) => s.id === id);
    const prev = i >= 0 ? store.subscriptions[i] : null;
    const planId = String(rec.plan_id || prev?.plan_id || '');
    const plan = store.membership_plans.find((p) => p.id === planId);
    const row: FitSubscription = {
      id,
      client_id: String(rec.client_id || prev?.client_id || ''),
      plan_id: planId,
      status: (rec.status as FitSubscription['status']) || 'active',
      started_at: String(
        rec.started_at || prev?.started_at || now.slice(0, 10)
      ),
      current_period_end:
        rec.current_period_end != null
          ? String(rec.current_period_end)
          : prev?.current_period_end ?? null,
      cancel_at:
        rec.cancel_at != null ? String(rec.cancel_at) : prev?.cancel_at ?? null,
      class_credits_remaining:
        rec.class_credits_remaining != null
          ? Number(rec.class_credits_remaining)
          : prev?.class_credits_remaining ??
            plan?.class_credits ??
            null,
      auto_renew: rec.auto_renew !== false,
      notes: rec.notes != null ? String(rec.notes) : prev?.notes,
      created_at: prev?.created_at || now,
      updated_at: now,
    };
    if (i >= 0) store.subscriptions[i] = row;
    else store.subscriptions.push(row);
    // Sync client membership status
    const ci = store.clients.findIndex((c) => c.id === row.client_id);
    if (ci >= 0) {
      store.clients[ci] = {
        ...store.clients[ci],
        membership_plan_id: row.plan_id,
        membership_status:
          row.status === 'active' || row.status === 'trialing'
            ? row.status === 'trialing'
              ? 'trial'
              : 'active'
            : row.status === 'paused'
              ? 'paused'
              : row.status === 'cancelled'
                ? 'cancelled'
                : 'expired',
        end_date: row.current_period_end,
        updated_at: now,
      };
    }
  } else if (entity === 'class_types') {
    const id = String(rec.id || newId('cls'));
    const i = store.class_types.findIndex((c) => c.id === id);
    const row: FitClassType = {
      id,
      code: String(rec.code || `T-${store.class_types.length + 1}`),
      name: String(rec.name || 'Class'),
      category: rec.category != null ? String(rec.category) : undefined,
      default_duration_min:
        rec.default_duration_min != null
          ? Number(rec.default_duration_min)
          : 45,
      capacity: rec.capacity != null ? Number(rec.capacity) : 20,
      description:
        rec.description != null ? String(rec.description) : undefined,
      active: rec.active !== false,
      created_at: i >= 0 ? store.class_types[i].created_at : now,
    };
    if (i >= 0) store.class_types[i] = row;
    else store.class_types.push(row);
  } else if (entity === 'sessions') {
    const id = String(rec.id || newId('ses'));
    const i = store.sessions.findIndex((s) => s.id === id);
    const prev = i >= 0 ? store.sessions[i] : null;
    const ct = store.class_types.find(
      (c) => c.id === String(rec.class_type_id || prev?.class_type_id || '')
    );
    const makePublic = rec.public === true || rec.public === 'true';
    const row: FitSession = {
      id,
      class_type_id: String(
        rec.class_type_id || prev?.class_type_id || ''
      ),
      coach_id:
        rec.coach_id !== undefined
          ? rec.coach_id
            ? String(rec.coach_id)
            : null
          : prev?.coach_id ?? null,
      date: String(rec.date || prev?.date || now.slice(0, 10)),
      start_time: String(rec.start_time || prev?.start_time || '06:00'),
      end_time:
        rec.end_time != null
          ? String(rec.end_time)
          : prev?.end_time ?? null,
      duration_min:
        rec.duration_min != null
          ? Number(rec.duration_min)
          : prev?.duration_min ?? ct?.default_duration_min ?? 45,
      capacity:
        rec.capacity != null
          ? Number(rec.capacity)
          : prev?.capacity ?? ct?.capacity ?? 20,
      location:
        rec.location != null
          ? String(rec.location)
          : prev?.location,
      status: (rec.status as FitSession['status']) || prev?.status || 'scheduled',
      public:
        rec.public !== undefined
          ? makePublic || rec.public === true
          : prev?.public === true,
      share_code:
        rec.share_code !== undefined
          ? rec.share_code
            ? String(rec.share_code)
            : null
          : prev?.share_code ||
            (makePublic || prev?.public
              ? `s_${Math.random().toString(36).slice(2, 10)}`
              : null),
      notes: rec.notes != null ? String(rec.notes) : prev?.notes,
      public_notes:
        rec.public_notes != null
          ? String(rec.public_notes)
          : prev?.public_notes,
      class_plan:
        rec.class_plan != null
          ? String(rec.class_plan)
          : prev?.class_plan,
      series_id:
        rec.series_id !== undefined
          ? rec.series_id
            ? String(rec.series_id)
            : null
          : prev?.series_id ?? null,
      origin:
        rec.origin != null
          ? String(rec.origin)
          : prev?.origin ?? 'owner',
      created_at: prev?.created_at || now,
    };
    if (i >= 0) store.sessions[i] = row;
    else store.sessions.push(row);
  } else if (entity === 'bookings') {
    const id = String(rec.id || newId('bkg'));
    const i = store.bookings.findIndex((b) => b.id === id);
    const sessionId = String(rec.session_id || '');
    const status = (rec.status as FitBooking['status']) || 'booked';
    // capacity check for new bookings
    if (i < 0 && status === 'booked') {
      const session = store.sessions.find((s) => s.id === sessionId);
      const cap = session?.capacity ?? 999;
      const count = sessionBookingCount(store, sessionId);
      if (count >= cap) {
        // auto waitlist
        const row: FitBooking = {
          id,
          session_id: sessionId,
          client_id: String(rec.client_id || ''),
          status: 'waitlist',
          booked_at: now,
          source: String(rec.source || 'desk'),
          guest_name:
            rec.guest_name != null ? String(rec.guest_name) : undefined,
          guest_email:
            rec.guest_email != null ? String(rec.guest_email) : undefined,
          guest_phone:
            rec.guest_phone != null ? String(rec.guest_phone) : undefined,
          notes: rec.notes != null ? String(rec.notes) : 'Auto waitlist — full',
        };
        store.bookings.push(row);
        return;
      }
    }
    const prev = i >= 0 ? store.bookings[i] : null;
    let row: FitBooking = {
      id,
      session_id: sessionId || prev?.session_id || '',
      client_id: String(rec.client_id || prev?.client_id || ''),
      status,
      booked_at: prev?.booked_at || now,
      source: String(rec.source || prev?.source || 'desk'),
      guest_name:
        rec.guest_name != null
          ? String(rec.guest_name)
          : prev?.guest_name,
      guest_email:
        rec.guest_email != null
          ? String(rec.guest_email)
          : prev?.guest_email,
      guest_phone:
        rec.guest_phone != null
          ? String(rec.guest_phone)
          : prev?.guest_phone,
      notes: rec.notes != null ? String(rec.notes) : prev?.notes,
      feedback_token: prev?.feedback_token ?? null,
      feedback_requested_at: prev?.feedback_requested_at ?? null,
      feedback_submitted_at: prev?.feedback_submitted_at ?? null,
      feedback_id: prev?.feedback_id ?? null,
    };
    if (status === 'attended') {
      row = issueFeedbackPrompt(row, now);
    }
    if (i >= 0) store.bookings[i] = row;
    else store.bookings.push(row);

    // PT pack consume on attended PT-like booking (optional: when mark attended)
    if (status === 'attended' && rec.consume_pt === true) {
      const pack = store.pt_packs.find(
        (p) =>
          p.client_id === row.client_id &&
          p.sessions_used < p.sessions_total
      );
      if (pack) {
        pack.sessions_used += 1;
      }
    }
  } else if (entity === 'check_ins') {
    const id = String(rec.id || newId('cki'));
    const i = store.check_ins.findIndex((c) => c.id === id);
    const row: FitCheckIn = {
      id,
      client_id: String(rec.client_id || ''),
      date: String(rec.date || now.slice(0, 10)),
      time:
        rec.time != null
          ? String(rec.time)
          : now.slice(11, 16),
      method: (rec.method as FitCheckIn['method']) || 'front_desk',
      session_id:
        rec.session_id != null ? String(rec.session_id) : null,
      notes: rec.notes != null ? String(rec.notes) : undefined,
      created_at: i >= 0 ? store.check_ins[i].created_at : now,
    };
    if (i >= 0) store.check_ins[i] = row;
    else store.check_ins.push(row);
  } else if (entity === 'pt_packs') {
    const id = String(rec.id || newId('ptp'));
    const i = store.pt_packs.findIndex((p) => p.id === id);
    const row: FitPtPack = {
      id,
      client_id: String(rec.client_id || ''),
      coach_id: rec.coach_id != null ? String(rec.coach_id) : null,
      sessions_total: Number(rec.sessions_total) || 0,
      sessions_used: Number(rec.sessions_used) || 0,
      purchased_at: String(rec.purchased_at || now.slice(0, 10)),
      expires_at:
        rec.expires_at != null ? String(rec.expires_at) : null,
      price_zar: rec.price_zar != null ? Number(rec.price_zar) : null,
      notes: rec.notes != null ? String(rec.notes) : undefined,
      created_at: i >= 0 ? store.pt_packs[i].created_at : now,
    };
    if (i >= 0) store.pt_packs[i] = row;
    else store.pt_packs.push(row);
  } else {
    throw new Error('Unknown entity');
  }
}

function seedDemo(now: string, companyId?: number): FitgraphStore {
  const today = now.slice(0, 10);
  const d = (offset: number) => {
    const x = new Date(today + 'T12:00:00');
    x.setDate(x.getDate() + offset);
    return x.toISOString().slice(0, 10);
  };
  const c1 = newId('coh');
  const c2 = newId('coh');
  const p1 = newId('pln');
  const p2 = newId('pln');
  const t1 = newId('cls');
  const t2 = newId('cls');
  const t3 = newId('cls');
  const m1 = newId('cli');
  const m2 = newId('cli');
  const m3 = newId('cli');
  const s1 = newId('ses');
  const s2 = newId('ses');
  const s3 = newId('ses');
  const s4 = newId('ses');
  const cid = companyId != null && Number.isFinite(companyId) ? companyId : 0;
  const publicToken =
    cid > 0
      ? `fg_${cid}_${Math.random().toString(36).slice(2, 12)}`
      : `fg_demo_${Math.random().toString(36).slice(2, 12)}`;

  return {
    settings: {
      enabled: true,
      public_token: publicToken,
      brand_name: 'VUKA Fitness',
      allow_public_booking: true,
      show_coaches: true,
      show_pricing: true,
      timezone: 'Africa/Johannesburg',
      contact_email: 'hello@vukafitness.example',
      contact_phone: '+27 11 000 0000',
      embed_primary_color: '#7c3aed',
    },
    coaches: [
      {
        id: c1,
        code: 'TH',
        name: 'Thandi Mokoena',
        email: 'thandi@vukafitness.example',
        phone: '+27 82 000 1111',
        specialties: ['HIIT', 'Strength'],
        public_bio: 'HIIT & strength coach — morning energy classes.',
        portal_token:
          cid > 0
            ? issueCoachPortalToken(cid)
            : `coach_thandi_${Math.random().toString(36).slice(2, 8)}`,
        can_manage_classes: true,
        color: '#059669',
        start_date: d(-90),
        end_date: null,
        rate_zar: 350,
        rate_basis: 'per_class',
        history: [],
        active: true,
        created_at: now,
      },
      {
        id: c2,
        code: 'JP',
        name: 'Johan Pretorius',
        email: 'johan@vukafitness.example',
        specialties: ['Personal training', 'Functional'],
        public_bio: 'PT & functional movement.',
        portal_token:
          cid > 0
            ? issueCoachPortalToken(cid)
            : `coach_johan_${Math.random().toString(36).slice(2, 8)}`,
        can_manage_classes: true,
        color: '#0284c7',
        start_date: d(-60),
        end_date: null,
        rate_zar: 450,
        rate_basis: 'hourly',
        rate_note: 'PT sessions',
        history: [
          {
            id: 'eng_demo_jp1',
            start_date: d(-400),
            end_date: d(-200),
            note: 'Previous contract',
            ended_reason: 'contract_end',
            rate_zar: 380,
            rate_basis: 'hourly',
          },
        ],
        active: true,
        created_at: now,
      },
    ],
    membership_plans: [
      {
        id: p1,
        code: 'UNLIM',
        name: 'Unlimited monthly',
        price_zar: 899,
        billing: 'monthly',
        class_credits: null,
        public: true,
        description: 'Unlimited group classes.',
        active: true,
        created_at: now,
      },
      {
        id: p2,
        code: '8PACK',
        name: '8-class pack',
        price_zar: 640,
        billing: 'pack',
        class_credits: 8,
        public: true,
        active: true,
        created_at: now,
      },
    ],
    subscriptions: [
      {
        id: newId('sub'),
        client_id: m1,
        plan_id: p1,
        status: 'active',
        started_at: d(-30),
        current_period_end: d(30),
        class_credits_remaining: null,
        auto_renew: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: newId('sub'),
        client_id: m2,
        plan_id: p2,
        status: 'active',
        started_at: d(-14),
        current_period_end: d(60),
        class_credits_remaining: 5,
        auto_renew: false,
        created_at: now,
        updated_at: now,
      },
    ],
    class_types: [
      {
        id: t1,
        code: 'HIIT45',
        name: 'HIIT 45',
        category: 'HIIT',
        default_duration_min: 45,
        capacity: 16,
        active: true,
        created_at: now,
      },
      {
        id: t2,
        code: 'STR',
        name: 'Strength foundations',
        category: 'Strength',
        default_duration_min: 50,
        capacity: 12,
        active: true,
        created_at: now,
      },
      {
        id: t3,
        code: 'YOGA',
        name: 'Morning yoga',
        category: 'Yoga',
        default_duration_min: 60,
        capacity: 20,
        active: true,
        created_at: now,
      },
    ],
    clients: [
      {
        id: m1,
        code: 'M001',
        name: 'Aisha Nkosi',
        email: 'aisha@example.com',
        phone: '+27 83 111 2222',
        membership_plan_id: p1,
        membership_status: 'active',
        start_date: d(-30),
        coach_id: c2,
        health: {
          injured: true,
          injury_areas: ['Shoulder'],
          injury_side: 'left',
          injury_status: 'recovering',
          injury_onset: d(-21),
          injury_notes: 'Rotator cuff irritation — mild after overhead work.',
          training_modifications:
            'Avoid kipping and heavy overhead press; band external rotations OK.',
          goals: 'Pain-free overhead press by next month.',
          pain_score: 3,
          medical_clearance: true,
          updated_at: now,
          updated_by: 'desk',
        },
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: m2,
        code: 'M002',
        name: 'Lebo Dlamini',
        email: 'lebo@example.com',
        membership_plan_id: p2,
        membership_status: 'active',
        start_date: d(-14),
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: m3,
        code: 'M003',
        name: 'Sam van Wyk',
        membership_plan_id: p1,
        membership_status: 'trial',
        start_date: d(-3),
        coach_id: c1,
        health: {
          injured: true,
          injury_areas: ['Knee'],
          injury_side: 'right',
          injury_status: 'acute',
          injury_onset: d(-5),
          injury_notes: 'Twinge on lunges — possible patellofemoral irritation.',
          training_modifications:
            'No deep lunges or box jumps; bike and glute bridges preferred.',
          goals: 'Return to HIIT without knee flare-ups.',
          pain_score: 4,
          updated_at: now,
          updated_by: 'desk',
        },
        active: true,
        created_at: now,
        updated_at: now,
      },
    ],
    sessions: [
      {
        id: s1,
        class_type_id: t1,
        coach_id: c1,
        date: today,
        start_time: '06:00',
        duration_min: 45,
        capacity: 16,
        location: 'Studio A',
        status: 'scheduled',
        public: true,
        share_code: 's_hiit_am',
        public_notes: 'Bring a mat · all levels',
        created_at: now,
      },
      {
        id: s2,
        class_type_id: t2,
        coach_id: c2,
        date: today,
        start_time: '17:30',
        duration_min: 50,
        capacity: 12,
        location: 'Weights floor',
        status: 'scheduled',
        public: true,
        share_code: 's_str_pm',
        created_at: now,
      },
      {
        id: s3,
        class_type_id: t3,
        coach_id: c1,
        date: d(1),
        start_time: '07:00',
        duration_min: 60,
        capacity: 20,
        location: 'Studio B',
        status: 'scheduled',
        public: true,
        share_code: 's_yoga_am',
        created_at: now,
      },
      {
        id: s4,
        class_type_id: t1,
        coach_id: c1,
        date: d(2),
        start_time: '06:00',
        duration_min: 45,
        capacity: 16,
        location: 'Studio A',
        status: 'scheduled',
        public: true,
        share_code: 's_hiit_wed',
        created_at: now,
      },
    ],
    bookings: [
      {
        id: newId('bkg'),
        session_id: s1,
        client_id: m1,
        status: 'booked',
        booked_at: now,
      },
      {
        id: newId('bkg'),
        session_id: s1,
        client_id: m2,
        status: 'booked',
        booked_at: now,
      },
      {
        id: newId('bkg'),
        session_id: s2,
        client_id: m1,
        status: 'booked',
        booked_at: now,
      },
    ],
    check_ins: [
      {
        id: newId('cki'),
        client_id: m1,
        date: today,
        time: '05:55',
        method: 'front_desk',
        session_id: s1,
        created_at: now,
      },
    ],
    pt_packs: [
      {
        id: newId('ptp'),
        client_id: m3,
        coach_id: c2,
        sessions_total: 10,
        sessions_used: 2,
        purchased_at: d(-10),
        price_zar: 3500,
        created_at: now,
      },
    ],
    threads: [
      {
        id: newId('thr'),
        channel: 'coach_member',
        subject: 'Knee care plan · Sam van Wyk',
        participants: [
          { role: 'desk', ref_id: 'desk', name: 'Front desk' },
          { role: 'coach', ref_id: c1, name: 'Thandi Mokoena' },
          { role: 'member', ref_id: m3, name: 'Sam van Wyk' },
        ],
        messages: [
          {
            id: newId('msg'),
            body: 'Sam flagged a right-knee twinge on lunges — please keep sessions low-impact this week and note any pain.',
            author_role: 'desk',
            author_ref_id: 'desk',
            author_name: 'Front desk',
            created_at: now,
            read_by: ['desk:desk'],
          },
          {
            id: newId('msg'),
            body: 'Got it — bike + glute bridges only. I’ll check in after Thursday HIIT.',
            author_role: 'coach',
            author_ref_id: c1,
            author_name: 'Thandi Mokoena',
            created_at: now,
            read_by: [`coach:${c1}`],
          },
        ],
        created_at: now,
        updated_at: now,
      },
      {
        id: newId('thr'),
        channel: 'colleague',
        subject: 'Cover request · Friday AM',
        participants: [
          { role: 'desk', ref_id: 'desk', name: 'Front desk' },
          { role: 'coach', ref_id: c1, name: 'Thandi Mokoena' },
          { role: 'coach', ref_id: c2, name: 'Coach peer' },
        ],
        messages: [
          {
            id: newId('msg'),
            body: 'Can anyone cover the 06:00 HIIT Friday? I’m on leave.',
            author_role: 'coach',
            author_ref_id: c1,
            author_name: 'Thandi Mokoena',
            created_at: now,
            read_by: [`coach:${c1}`],
          },
        ],
        created_at: now,
        updated_at: now,
      },
    ],
    updated_at: now,
  };
}
