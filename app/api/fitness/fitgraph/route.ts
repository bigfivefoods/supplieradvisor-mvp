import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyRoles,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  promoteNextWaitlist,
  promoteWaitlistBooking,
  resolveFamilyAttendee,
} from '@/lib/services/advisor-booking';
import { findRoomDiaryConflict } from '@/lib/services/clinic-public-calendar';
import { mergePersonInviteFromRecord } from '@/lib/services/advisor-workforce';
import { mergeContractorCommercialFromRecord } from '@/lib/clinic/contractor-commercial';
import {
  attendanceByClass,
  buildClassJoinPath,
  buildCoachPortalPayload,
  closeCoachEngagement,
  applySessionKindRules,
  coachPersonalBookingError,
  createSessionsFromTemplate,
  defaultPublicSettings,
  ensurePublicToken,
  ensureSessionShareCode,
  resolveClassTypeForSession,
  resolveSessionTimes,
  sessionKindOf,
  issueCoachPortalToken,
  issueClientPortalToken,
  ensureClientPortalToken,
  newId,
  reopenCoachEngagement,
  readFitgraphFromMetadata,
  sessionBookingCount,
  sessionsInRange,
  setGymOwnerEmails,
  coachIsGymOwner,
  coachPortalEmails,
  summariseFitgraph,
  summariseSessionFeedback,
  upsertClassFeedback,
  addCoachSpecialty,
  removeCoachSpecialty,
  renameCoachSpecialty,
  getCoachSpecialtyOptions,

  gymCheckinPath,
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
import { parseQualifications } from '@/lib/services/person-qualifications';
import { upsertMovement, upsertProgramme } from '@/lib/fitness/movements';
import { buildDemoShopProgramme } from '@/lib/fitness/demo-shop-programme';
import {
  enrollClientOnProgramme,
  upsertProgrammeLog,
} from '@/lib/fitness/programme-follow';
import {
  applyFitClientImport,
  buildFitClientsXlsx,
  FIT_CLIENT_XLSX_MIME,
  parseFitClientsImport,
} from '@/lib/fitness/fitgraph-clients-xlsx';
import { omitClientRosterFields } from '@/lib/fitness/client-roster-fields';
import {
  applyGymClientNumberFromAr,
  needsGymClientNumber,
  recodeGymClientNumbers,
} from '@/lib/fitness/gym-client-number';
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
import { applyGymAttendanceMark } from '@/lib/fitness/apply-gym-attendance';
import { gymCoachAwayOn } from '@/lib/services/staff-away';
import { notifyMemberToRateClass } from '@/lib/fitness/notify-class-feedback';
import {
  applyAnnouncementAction,
  isAnnouncementAction,
} from '@/lib/services/member-announcements';
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
import { loadFitgraphMerged, saveFitgraphMerged, saveFitgraphPatch } from '@/lib/fitness/fitgraph-io';
import {
  persistVukaCatalogIfNeeded,
  storeUsesClassSubscribe,
} from '@/lib/fitness/vuka-class-catalog';
import { applyFloorTaskAction } from '@/lib/services/advisor-floor-tasks';
import { GYM_DEFAULT_TZ, isoDateInZone } from '@/lib/fitness/gym-local-time';
import { applyMemberDebitBank } from '@/lib/fitness/member-debit-bank';
import { fitgraphDeskGetWindow } from '@/lib/fitness/fitgraph-desk-get-window';
import {
  allocateMemberToClass,
  applyPrivatePtBookings,
  bookDeskMemberOntoSession,
  ensureClassTypeForSubscribePlan,
  ensureSessionCapacityForMembers,
  expandSessionToSeries,
  mergeSubscribersIntoCoachSessions,
  parseFitClientIds,
  scheduleClassOnCalendar,
  setClassMembers,
  stampCatalogSeriesAndBookSubscribers,
  updateClassDesk,
} from '@/lib/fitness/class-allocate';
import { parseRecurrenceBody } from '@/lib/schedule/recurrence';
import { appendJoinEvent } from '@/lib/fitness/member-profile';
import { parseMemberPassport } from '@/lib/b2c/member-passport';
import { mergeMedicalRecord } from '@/lib/clinic/patient-medical';
import { resolveCompanyEmails } from '@/lib/billing/company-emails';
import { isStaleModuleStoreError } from '@/lib/business/company-data';

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
  | 'pt_packs'
  | 'movements'
  | 'programmes'
  | 'programme_enrollments'
  | 'programme_logs'
  | 'leaderboard_activities';

async function loadStore(companyId: number, opts?: { fresh?: boolean }) {
  return loadFitgraphMerged(companyId, opts);
}

async function saveStore(
  companyId: number,
  meta: Record<string, unknown>,
  store: FitgraphStore
) {
  const ifUpdatedAtRaw = meta.__if_updated_at;
  const ifUpdatedAt =
    typeof ifUpdatedAtRaw === 'string' && ifUpdatedAtRaw.trim()
      ? ifUpdatedAtRaw.trim()
      : null;
  await saveFitgraphMerged(companyId, store, { ifUpdatedAt });
}

/**
 * Brief 52 — fast calendar patch save.
 * Only the keys present in `patch` are written; all other arrays on the server
 * row are untouched (Brief 50/52 SQL union-merge preserves them).
 * Returns the `updated_at` stamp written into the data so the client can
 * update its CAS token without a full reload.
 */
async function savePatch(
  companyId: number,
  meta: Record<string, unknown>,
  patch: Partial<FitgraphStore>
): Promise<string> {
  const ifUpdatedAtRaw = meta.__if_updated_at;
  const ifUpdatedAt =
    typeof ifUpdatedAtRaw === 'string' && ifUpdatedAtRaw.trim()
      ? ifUpdatedAtRaw.trim()
      : null;
  return saveFitgraphPatch(companyId, patch, { ifUpdatedAt });
}

function keyedStorePatch<K extends keyof FitgraphStore>(
  store: FitgraphStore,
  ...keys: K[]
): Pick<FitgraphStore, K> {
  const patch = {} as Pick<FitgraphStore, K>;
  for (const key of keys) {
    patch[key] = store[key] as Pick<FitgraphStore, K>[K];
  }
  return patch;
}

async function savePatchForKeys<K extends keyof FitgraphStore>(
  companyId: number,
  meta: Record<string, unknown>,
  store: FitgraphStore,
  ...keys: K[]
): Promise<string> {
  const updatedAt = await savePatch(
    companyId,
    meta,
    keyedStorePatch(store, ...keys)
  );
  store.updated_at = updatedAt;
  return updatedAt;
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

async function stampOwnerEmails(companyId: number, store: FitgraphStore): Promise<void> {
  try {
    const { emails } = await resolveCompanyEmails(companyId, {
      roleAllowlist: ['owner'],
      includeInvited: true,
      limit: 20,
    });
    const ownerEmails = [
      ...emails,
      store.settings?.contact_email,
    ].filter((e): e is string => Boolean(e));
    setGymOwnerEmails(store, ownerEmails);
  } catch {
    /* best-effort */
  }
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyRoles(request, companyId, ['owner'], {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const loaded = await loadStore(companyId);
    const store = await persistVukaCatalogIfNeeded(
      companyId,
      loaded.store,
      async (next) => {
        await saveStore(companyId, loaded.meta, next);
      },
      {
        tradingName: loaded.store.settings?.brand_name,
        applyCatalog: false,
      }
    );

    // Stamp owner emails so coachIsGymOwner works correctly on every load
    await stampOwnerEmails(companyId, store);
    const include = request.nextUrl.searchParams.get('include');
    const windowedStore = fitgraphDeskGetWindow(store, {
      include,
      bookings: request.nextUrl.searchParams.get('bookings'),
      checkIns: request.nextUrl.searchParams.get('check_ins'),
    });

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

    return NextResponse.json(
      {
        success: true,
        store: windowedStore,
        summary: summariseFitgraph(store),
      },
      {
        headers: {
          'Cache-Control': 'private, no-store',
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
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyRoles(request, companyId, ['owner'], {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const action = String(body.action || 'upsert');
    const entity = String(body.entity || '') as Entity;
    const { meta, store } = await loadStore(companyId, { fresh: true });
    const payloadUpdatedAt =
      (body &&
      typeof body === 'object' &&
      'updated_at' in body &&
      typeof body.updated_at === 'string' &&
      body.updated_at.trim()
        ? body.updated_at.trim()
        : null) ||
      (body &&
      typeof body === 'object' &&
      'store' in body &&
      body.store &&
      typeof body.store === 'object' &&
      'updated_at' in body.store &&
      typeof body.store.updated_at === 'string' &&
      body.store.updated_at.trim()
        ? body.store.updated_at.trim()
        : null) ||
      (body &&
      typeof body === 'object' &&
      'data' in body &&
      body.data &&
      typeof body.data === 'object' &&
      'updated_at' in body.data &&
      typeof body.data.updated_at === 'string' &&
      body.data.updated_at.trim()
        ? body.data.updated_at.trim()
        : null);
    if (payloadUpdatedAt) {
      meta.__if_updated_at = payloadUpdatedAt;
    }
    const now = new Date().toISOString();

    // Stamp owner emails on every mutation load so coachIsGymOwner resolves correctly
    await stampOwnerEmails(companyId, store);

    if (action === 'seed_demo') {
      const demo = seedDemo(now, companyId);
      const withCatalog = await persistVukaCatalogIfNeeded(
        companyId,
        demo,
        async () => undefined
      );
      await saveStore(companyId, meta, withCatalog);
      return NextResponse.json({
        success: true,
        store: withCatalog,
        summary: summariseFitgraph(withCatalog),
        analysis: analysis(withCatalog),
        message: 'Demo gym loaded',
      });
    }

    if (action === 'floor_task') {
      const today = isoDateInZone(store.settings?.timezone || GYM_DEFAULT_TZ);
      const result = applyFloorTaskAction(store.floor_tasks, body, now, today);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      store.floor_tasks = result.tasks;
      await savePatchForKeys(companyId, meta, store, 'floor_tasks');
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        task: result.task,
      });
    }

    /** Messaging: desk · coaches · members (+ fan-out to member company inboxes) */
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
      const updatedAt = await savePatch(companyId, meta, { threads: store.threads });
      store.updated_at = updatedAt;

      // Mirror coach/desk care messages into members' own company Messages
      // when their client email matches a platform company (e.g. craig@…).
      let fanOut: { delivered: number; companyIds: number[] } | undefined;
      if (
        result.thread &&
        (action === 'message_create_thread' ||
          action === 'create_thread' ||
          action === 'message_start' ||
          action === 'message_post' ||
          action === 'post_message' ||
          action === 'message_reply')
      ) {
        try {
          const { fanOutServiceThreadToMemberCompanies } = await import(
            '@/lib/messaging/service-to-company'
          );
          const supabase = getSupabaseServer();
          const { data: prof } = await supabase
            .from('profiles')
            .select('trading_name, legal_name')
            .eq('id', companyId)
            .maybeSingle();
          const gymName =
            store.settings?.brand_name ||
            prof?.trading_name ||
            prof?.legal_name ||
            'Gym';
          fanOut = await fanOutServiceThreadToMemberCompanies({
            gymCompanyId: companyId,
            gymName: String(gymName),
            module: 'fitgraph',
            serviceThread: result.thread,
            people: store.clients || [],
          });
          const { notifyMembersOnServiceThread } = await import(
            '@/lib/messaging/service-message-email'
          );
          const mail = await notifyMembersOnServiceThread({
            thread: result.thread,
            people: store.clients || [],
            brand: String(gymName),
            moduleLabel: 'GymAdvisor®',
            portalBasePath: '/member/fitgraph',
          });
          if (mail.emailed > 0) {
            fanOut = {
              delivered: (fanOut?.delivered || 0) + mail.emailed,
              companyIds: fanOut?.companyIds || [],
            };
          }
        } catch (e) {
          console.warn('[fitgraph] service→company fan-out failed', e);
        }
      }

      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        thread: result.thread,
        threads: threadsForDesk(store.threads),
        unread: totalUnread(store.threads || [], 'desk', 'desk'),
        fan_out: fanOut,
        message:
          fanOut && fanOut.delivered > 0
            ? `Message saved · notified ${fanOut.delivered} member channel(s)`
            : 'Message saved',
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
      const { attachCrmToAdvisorPerson } = await import(
        '@/lib/b2c/member-account-ar'
      );
      let stamped = 0;
      for (const person of store.clients || []) {
        if (person.crm_customer_id) continue;
        const id = await attachCrmToAdvisorPerson({
          companyId,
          kind: 'gym',
          person,
        });
        if (id) stamped += 1;
      }
      recodeGymClientNumbers(store.clients || []);
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

    if (action === 'backfill_client_crm') {
      const {
        attachCrmToAdvisorPerson,
        isPaddedMemberArCode,
        needsGymCrmStamp,
      } = await import(
        '@/lib/b2c/member-account-ar'
      );
      const { backfillAdvisorPartyUids } = await import(
        '@/lib/accounting/party-gl-accounts'
      );
      await backfillAdvisorPartyUids(companyId);
      const requestedLimit = Number(body.limit);
      const limit = Number.isFinite(requestedLimit)
        ? Math.min(600, Math.max(1, Math.trunc(requestedLimit)))
        : 300;
      let stamped = 0;
      let skipped = 0;
      let linked_existing = 0;
      let created = 0;
      let processed = 0;
      for (const person of store.clients || []) {
        const needsStamp = needsGymCrmStamp(person);
        const needsCode = needsGymClientNumber(person, store.clients || []);
        const needsRecode =
          !needsStamp &&
          !needsCode &&
          Number(person.crm_customer_id || 0) > 0 &&
          isPaddedMemberArCode(person.ar_account_code);
        if (!needsStamp && !needsCode && !needsRecode) continue;
        if (processed >= limit) break;
        processed += 1;
        try {
          const result = await attachCrmToAdvisorPerson({
            companyId,
            kind: 'gym',
            person,
          });
          if (result?.id) {
            stamped += 1;
            if (result.created) created += 1;
            else linked_existing += 1;
          } else {
            skipped += 1;
          }
        } catch {
          skipped += 1;
        }
      }
      const numbered = recodeGymClientNumbers(store.clients || []);
      await savePatchForKeys(companyId, meta, store, 'clients');
      const remaining = (store.clients || []).reduce(
        (count, person) =>
          needsGymCrmStamp(person) ||
          needsGymClientNumber(person, store.clients || [])
            ? count + 1
            : count,
        0
      );
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        stamped,
        skipped,
        linked_existing,
        created,
        numbered,
        remaining,
        message: `Stamped ${stamped} client(s) onto CRM (${linked_existing} existing, ${created} new), ${numbered} client number(s) from CoA, ${skipped} skipped`,
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
      const updatedAt = await savePatch(companyId, meta, { settings: store.settings });
      store.updated_at = updatedAt;
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        message: 'Website / portal settings updated',
      });
    }

    if (isAnnouncementAction(action)) {
      try {
        const result = applyAnnouncementAction(
          store.announcements,
          action,
          body
        );
        store.announcements = result.list;
        const updatedAt = await savePatch(companyId, meta, { announcements: store.announcements });
        store.updated_at = updatedAt;
        return NextResponse.json({
          success: true,
          store,
          summary: summariseFitgraph(store),
          analysis: analysis(store),
          message: result.message,
        });
      } catch (e: unknown) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Announcement failed' },
          { status: 400 }
        );
      }
    }

    if (action === 'issue_coach_portal') {
      const coachId = String(body.coachId || body.id || '');
      const coach = store.coaches.find((c) => c.id === coachId);
      if (!coach) {
        return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
      }
      coach.portal_token = issueCoachPortalToken(companyId);
      coach.can_manage_classes = true;
      const updatedAt = await savePatch(companyId, meta, { coaches: store.coaches });
      store.updated_at = updatedAt;

      // Send the work-invite link to the coach's email.
      // When the coach IS the gym owner (coachIsGymOwner), coachPortalEmails
      // returns the owner email — the link goes there (not skipped, not to a
      // second address).
      const sendTo = coachPortalEmails(coach).filter((e) => e.includes('@'));
      if (sendTo.length) {
        const portalLink = `${process.env.NEXT_PUBLIC_APP_URL || ''}/coach/fitgraph/${coach.portal_token}`;
        const businessName = store.settings?.brand_name || 'Your Gym';
        const isOwnerCoach = coachIsGymOwner(store, coach);
        const subjectSuffix = isOwnerCoach ? ' (coach access)' : '';
        try {
          const resend = getResend();
          for (const to of sendTo) {
            await resend.emails.send({
              from: getResendFrom(),
              replyTo: getResendReplyTo(),
              to,
              subject: `${businessName} — your GymAdvisor® coach workspace${subjectSuffix}`,
              tags: [{ name: 'company_id', value: String(companyId) }],
              html: `<p>Hi ${coach.name},</p><p>Your GymAdvisor® coach workspace is ready: <a href="${portalLink}">${portalLink}</a></p><p>${businessName} team</p>`,
              text: `Hi ${coach.name},\n\nYour GymAdvisor® coach workspace is ready:\n${portalLink}\n\n${businessName} team`,
            });
          }
        } catch {
          /* email best-effort — portal token already issued */
        }
      }

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
      const portalToken = ensureClientPortalToken(client, companyId);
      const updatedAt = await savePatch(companyId, meta, { clients: store.clients });
      store.updated_at = updatedAt;
      void import('@/lib/b2c/directory').then(({ indexBrandPerson }) =>
        indexBrandPerson({
          kind: 'gym',
          companyId,
          companyName: store.settings?.brand_name,
          brand: store.settings?.brand_name,
          refId: client.id,
          refLabel: client.name,
          email: client.email,
          phone: client.phone,
          portalToken,
          portalPath: `/member/fitgraph/${encodeURIComponent(portalToken)}`,
          checkinPath: store.settings?.public_token
            ? gymCheckinPath(store.settings.public_token)
            : null,
        })
      );
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
      client.join_events = appendJoinEvent(client, {
        at: nowIso,
        kind: 'invite_sent',
        title: 'SA Member invite sent',
        note: email,
        source: 'invite',
      });
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
        .select('trading_name, legal_name, logo_url')
        .eq('id', companyId)
        .maybeSingle();
      const businessName =
        store.settings?.brand_name ||
        prof?.trading_name ||
        prof?.legal_name ||
        'Your gym';
      const invitedBy = String(body.invitedBy || body.invited_by || 'Your gym team');
      const inviteLink = buildServiceMemberInviteLink('fitgraph', inviteToken);
      const { memberAppLink } = await import('@/lib/b2c/member-app');
      const appLink = client.portal_token
        ? memberAppLink(client.portal_token)
        : memberAppLink(inviteToken);

      let emailWarning: string | undefined;
      try {
        const resend = getResend();
        const { error: emailError } = await resend.emails.send({
          from: getResendFrom(),
          replyTo: getResendReplyTo(),
          to: email,
          subject: `${businessName} invited you to GymAdvisor®`,
          tags: [{ name: 'company_id', value: String(companyId) }],
          html: serviceMemberInviteEmailHtml({
            inviteeName: client.name,
            businessName,
            invitedBy,
            inviteLink,
            module: 'fitgraph',
            memberAppLink: appLink,
            logoUrl: String(prof?.logo_url || store.settings?.company_logo_url || '').trim() || null,
          }),
          text: serviceMemberInviteEmailText({
            inviteeName: client.name,
            businessName,
            invitedBy,
            inviteLink,
            module: 'fitgraph',
            memberAppLink: appLink,
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

      await savePatchForKeys(companyId, meta, store, 'clients');
      void import('@/lib/b2c/directory').then(({ indexBrandPerson }) =>
        indexBrandPerson({
          kind: 'gym',
          companyId,
          companyName: businessName,
          brand: businessName,
          refId: client.id,
          refLabel: client.name,
          email,
          phone: client.phone,
          portalToken: client.portal_token,
          portalPath: `/member/fitgraph/${encodeURIComponent(client.portal_token!)}`,
          checkinPath: store.settings?.public_token
            ? gymCheckinPath(store.settings.public_token)
            : null,
        })
      );
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        invite_token: inviteToken,
        invite_link: inviteLink,
        member_app_link: appLink,
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
      await savePatchForKeys(companyId, meta, store, 'clients');
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
      await savePatchForKeys(companyId, meta, store, 'coaches');
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
      await savePatchForKeys(companyId, meta, store, 'coaches');
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
      try {
        const { emails } = await resolveCompanyEmails(companyId, {
          roleAllowlist: ['owner'],
          includeInvited: true,
          limit: 20,
        });
        setGymOwnerEmails(store, emails);
      } catch {
        /* contact_email still applies */
      }
      const portal = buildCoachPortalPayload(store, coach, from, to);
      portal.sessions = mergeSubscribersIntoCoachSessions(store, portal.sessions);
      return NextResponse.json({
        success: true,
        portal,
        store,
        summary: summariseFitgraph(store),
      });
    }

    /** Create one-off or repeating series (daily/weekly/monthly) of sessions */
    if (action === 'create_session_series' || action === 'create_session') {
      const coachIdRaw = String(body.coach_id || body.coachId || '').trim();
      const coachId = coachIdRaw || null;
      const classTypeId = String(body.class_type_id || '');
      const date = String(body.date || now.slice(0, 10));
      const startTime = String(body.start_time || '06:00');
      const resolved = resolveClassTypeForSession(store, {
        class_type_id: classTypeId,
        session_kind: body.session_kind,
      });
      // Flow: create class first → assign coach later → book members later.
      // Private PT / coach personal time use system class types and need a coach.
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
      if (coachId && !store.coaches.find((c) => c.id === coachId)) {
        return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
      }
      if (coachId && resolved.kind !== 'away' && resolved.kind !== 'coach_personal') {
        try {
          const { readLeaveBlocksFromMeta } = await import(
            '@/lib/core-os/leave'
          );
          const { gymCoachAwayOn, staffAssignmentBlocked } = await import(
            '@/lib/services/staff-away'
          );
          const coach = store.coaches.find((c) => c.id === coachId);
          const gate = staffAssignmentBlocked({
            personId: coachId,
            date,
            hrEmployeeId: coach?.hr_employee_id,
            hrWindows: readLeaveBlocksFromMeta(meta),
            diaryAway: gymCoachAwayOn(store.sessions, coachId, date),
          });
          if (gate.blocked) {
            return NextResponse.json(
              { error: `Coach ${gate.reason}` },
              { status: 409 }
            );
          }
        } catch {
          /* leave / away gate is best-effort */
        }
      }
      if (!store.class_types.find((c) => c.id === resolved.class_type_id)) {
        return NextResponse.json(
          { error: 'Class type not found' },
          { status: 404 }
        );
      }
      if (resolved.kind !== 'class' && !coachId) {
        return NextResponse.json(
          { error: 'Pick a coach for private PT, personal time, or away' },
          { status: 400 }
        );
      }
      let recurrence: FitRecurrence | null = null;
      const rawFreq = String(body.frequency || body.repeat || '')
        .toLowerCase()
        .trim();
      const freq: FitRecurrence['frequency'] =
        rawFreq === 'daily' || rawFreq === 'weekly' || rawFreq === 'monthly'
          ? rawFreq
          : action === 'create_session_series'
            ? 'weekly' // legacy: series action defaulted to weekly
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
      if (resolved.kind === 'away' && (!recurrence || recurrence.frequency === 'none')) {
        const { awayUntilRecurrence } = await import(
          '@/lib/services/staff-away'
        );
        const untilRec = awayUntilRecurrence(date, body.until);
        if (untilRec) recurrence = untilRec;
      }
      const created = createSessionsFromTemplate(
        store,
        {
          class_type_id: resolved.class_type_id,
          coach_id: coachId,
          date,
          start_time: startTime,
          end_time: body.end_time != null ? String(body.end_time) : null,
          duration_min:
            body.duration_min != null ? Number(body.duration_min) : null,
          session_kind: resolved.kind,
          personal_reason:
            resolved.kind === 'away'
              ? String(body.personal_reason || body.away_reason || 'leave')
              : null,
          capacity: body.capacity != null ? Number(body.capacity) : null,
          location: body.location != null ? String(body.location) : undefined,
          room: body.room != null ? String(body.room) : null,
          agreed_rate_zar:
            body.agreed_rate_zar != null && body.agreed_rate_zar !== ''
              ? Number(body.agreed_rate_zar)
              : null,
          public: body.public === true,
          notes: body.notes != null ? String(body.notes) : undefined,
          public_notes:
            body.public_notes != null ? String(body.public_notes) : undefined,
          class_plan:
            body.class_plan != null ? String(body.class_plan) : undefined,
          origin: 'owner',
          programme_id:
            body.programme_id != null && String(body.programme_id).trim()
              ? String(body.programme_id)
              : null,
        },
        recurrence,
        now
      );
      store.sessions.push(...created);
      if (resolved.kind === 'class') {
        stampCatalogSeriesAndBookSubscribers(store, created, now);
      }
      const ptClientIds = parseFitClientIds(body.client_ids, body.client_id);
      if (resolved.kind === 'private_pt' && ptClientIds.length) {
        const rateRaw = body.agreed_rate_zar;
        applyPrivatePtBookings(store, {
          sessionIds: created.map((s) => s.id),
          clientIds: ptClientIds,
          now,
          rateZar:
            rateRaw == null || rateRaw === ''
              ? null
              : Number(rateRaw),
        });
      }
      {
        const { emailSessionCalendar } = await import(
          '@/lib/fitness/session-calendar'
        );
        for (const s of created) {
          void emailSessionCalendar({ store, sessionId: s.id }).catch(() => null);
        }
      }
      const updatedAt = await savePatch(companyId, meta, { sessions: store.sessions, bookings: store.bookings });
      store.updated_at = updatedAt;
      return NextResponse.json({
        success: true,
        ...(body.lite === true ? { updated_at: updatedAt } : { store }),
        summary: summariseFitgraph(store),
        ...(body.lite === true ? {} : { analysis: analysis(store) }),
        created: created.length,
        sessions: created,
        message:
          created.length > 1
            ? resolved.kind === 'coach_personal'
              ? `Blocked ${created.length} personal-time slots`
              : resolved.kind === 'private_pt'
                ? `Scheduled ${created.length} private PT sessions`
                : `Scheduled ${created.length} classes in series`
            : resolved.kind === 'coach_personal'
              ? 'Personal time blocked on the calendar'
              : resolved.kind === 'private_pt'
                ? 'Private PT scheduled'
                : 'Bespoke class scheduled',
      });
    }

    if (action === 'save_calendar_sessions') {
      const selectedId = String(body.session_id || '').trim();
      const selected = store.sessions.find((s) => s.id === selectedId);
      if (!selected) {
        return NextResponse.json({ error: 'Class not found' }, { status: 400 });
      }
      const seriesEdit = await import('@/lib/services/advisor-series-edit');
      const scopeRaw = String(body.scope || 'one');
      const scope =
        scopeRaw === 'future' || scopeRaw === 'all' ? scopeRaw : 'one';
      const ids = seriesEdit.resolveSeriesEditIds(
        store.sessions.map((s) => ({
          id: s.id,
          date: s.date,
          series_id: s.series_id,
        })),
        selected.id,
        scope
      );
      const rawPatch = (body.patch || {}) as Record<string, unknown>;
      const patch =
        rawPatch as import('@/lib/services/advisor-series-edit').SeriesPatch;
      const newDate =
        rawPatch.date != null ? String(rawPatch.date) : undefined;
      for (const id of ids) {
        const i = store.sessions.findIndex((s) => s.id === id);
        if (i < 0) continue;
        const isAnchor = id === selected.id;
        store.sessions[i] = seriesEdit.applySeriesPatch(
          store.sessions[i],
          patch,
          {
            isAnchor,
            newDate: isAnchor ? newDate : undefined,
          }
        ) as (typeof store.sessions)[number];
      }
      const ptClientIds = parseFitClientIds(body.client_ids, body.client_id);
      if (
        Array.isArray(body.client_ids) ||
        String(body.client_id || '').trim()
      ) {
        const rateRaw = body.agreed_rate_zar ?? patch.agreed_rate_zar;
        applyPrivatePtBookings(store, {
          sessionIds: ids,
          clientIds: ptClientIds,
          now,
          rateZar:
            rateRaw == null || rateRaw === '' ? null : Number(rateRaw),
          sync: true,
        });
      }
      const recurrence = parseRecurrenceBody(
        body as Record<string, unknown>
      );
      const expanded =
        recurrence.frequency === 'none'
          ? { added: 0, created: [] as typeof store.sessions }
          : expandSessionToSeries(store, {
              sessionId: selected.id,
              recurrence,
              now,
            });
      const updatedAt = await savePatch(companyId, meta, { sessions: store.sessions, bookings: store.bookings });
      store.updated_at = updatedAt;
      const updated = ids.length + expanded.added;
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        updated,
        added: expanded.added,
        message:
          expanded.added > 0
            ? `Saved as a series · ${expanded.added + 1} dates`
            : ids.length > 1
              ? `Updated ${ids.length} sessions`
              : 'Session updated',
      });
    }

    if (action === 'allocate_member') {
      const chargedRaw = body.charged_zar;
      const chargedZar =
        chargedRaw === '' || chargedRaw == null
          ? null
          : Number(chargedRaw);
      if (chargedZar != null && !Number.isFinite(chargedZar)) {
        return NextResponse.json(
          { error: 'Class actual rate must be a number' },
          { status: 400 }
        );
      }
      const chargesRaw = body.charges_by_plan_id;
      let chargesByPlanId: Record<string, number | null> | undefined;
      if (chargesRaw && typeof chargesRaw === 'object' && !Array.isArray(chargesRaw)) {
        chargesByPlanId = {};
        for (const [planId, raw] of Object.entries(
          chargesRaw as Record<string, unknown>
        )) {
          if (!planId) continue;
          if (raw === '' || raw == null) {
            chargesByPlanId[planId] = null;
            continue;
          }
          const n = Number(raw);
          if (!Number.isFinite(n)) {
            return NextResponse.json(
              { error: 'Class actual rate must be a number' },
              { status: 400 }
            );
          }
          chargesByPlanId[planId] = n;
        }
      }
      const privateRaw = body.private_rate_zar;
      const privateRateZar =
        privateRaw === '' || privateRaw == null
          ? null
          : Number(privateRaw);
      if (privateRateZar != null && !Number.isFinite(privateRateZar)) {
        return NextResponse.json(
          { error: 'Private rate must be a number' },
          { status: 400 }
        );
      }
      const statusRaw = String(body.status || '').trim();
      const status =
        statusRaw === 'active' ||
        statusRaw === 'trialing' ||
        statusRaw === 'past_due' ||
        statusRaw === 'paused' ||
        statusRaw === 'cancelled' ||
        statusRaw === 'expired'
          ? statusRaw
          : undefined;
      const flagsExplicit =
        body.member !== undefined || body.private_client !== undefined;
      const planIds = Array.isArray(body.plan_ids)
        ? (body.plan_ids as unknown[]).map((id) => String(id || '')).filter(Boolean)
        : undefined;
      const person =
        body.name !== undefined ||
        body.email !== undefined ||
        body.phone !== undefined ||
        body.notes !== undefined
          ? {
              name: body.name != null ? String(body.name) : undefined,
              email: body.email != null ? String(body.email) : undefined,
              phone: body.phone != null ? String(body.phone) : undefined,
              notes: body.notes != null ? String(body.notes) : undefined,
            }
          : undefined;
      const inactive = body.inactive === true;
      const result = allocateMemberToClass(store, {
        clientId: String(body.client_id || ''),
        planId: body.plan_id ? String(body.plan_id) : planIds?.[0] || null,
        planIds,
        chargedZar,
        chargesByPlanId,
        privateRateZar,
        status,
        kind: String(body.kind || '') === 'private' ? 'private' : 'member',
        member: flagsExplicit ? body.member === true : undefined,
        privateClient: flagsExplicit
          ? body.private_client === true
          : undefined,
        coachId: body.coach_id ? String(body.coach_id) : null,
        person,
        inactive,
        now,
      });
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      await savePatchForKeys(
        companyId,
        meta,
        store,
        'clients',
        'subscriptions',
        'bookings'
      );
      // CRM stamp is best-effort and must not block the response.
      const allocatedForCrm = store.clients.find(
        (c) => c.id === String(body.client_id || '')
      );
      if (allocatedForCrm) {
        void (async () => {
          try {
            const { attachCrmToAdvisorPerson } = await import(
              '@/lib/b2c/member-account-ar'
            );
            await attachCrmToAdvisorPerson({
              companyId,
              kind: 'gym',
              person: allocatedForCrm,
            });
            applyGymClientNumberFromAr(allocatedForCrm, store.clients || []);
            // If CRM stamp mutated the client, persist the updated clients snapshot.
            await savePatchForKeys(companyId, meta, store, 'clients');
          } catch {
            /* best-effort — Brief 38 stamps the gym book */
          }
        })();
      }
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        booked: result.booked,
        cancelled: result.cancelled,
        message: inactive
          ? 'Marked inactive'
          : result.booked > 0
            ? `Allocated · booked onto ${result.booked} class${
                result.booked === 1 ? '' : 'es'
              } on the calendar`
            : 'Allocated',
      });
    }

    if (action === 'set_class_members') {
      const clientIds = Array.isArray(body.client_ids)
        ? (body.client_ids as unknown[]).map((id) => String(id || '')).filter(Boolean)
        : [];
      const result = setClassMembers(store, {
        planId: String(body.plan_id || ''),
        clientIds,
        now,
      });
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      try {
        const { attachCrmToAdvisorPerson } = await import(
          '@/lib/b2c/member-account-ar'
        );
        for (const cid of clientIds) {
          const person = store.clients.find((c) => c.id === cid);
          if (!person || Number(person.crm_customer_id) > 0) continue;
          await attachCrmToAdvisorPerson({
            companyId,
            kind: 'gym',
            person,
          });
        }
      } catch {
        /* best-effort — CRM miss must not fail the class save */
      }
      recodeGymClientNumbers(store.clients || []);
      const updatedAt = await savePatch(companyId, meta, {
        clients: store.clients,
        subscriptions: store.subscriptions,
        bookings: store.bookings,
      });
      store.updated_at = updatedAt;
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        members: result.members,
        booked: result.booked,
        dropped: result.dropped,
        message:
          result.members === 1
            ? 'Saved 1 member on this class'
            : `Saved ${result.members} members on this class`,
      });
    }

    if (action === 'update_class_desk') {
      const planId = String(body.plan_id || body.id || '');
      const coachRaw = body.coach_id;
      const coachId =
        coachRaw === undefined
          ? undefined
          : coachRaw
            ? String(coachRaw)
            : null;
      const patch =
        body.patch && typeof body.patch === 'object'
          ? (body.patch as Record<string, unknown>)
          : body;
      const hasPatch =
        patch.name != null ||
        patch.code != null ||
        patch.price_zar != null ||
        patch.billing != null ||
        patch.schedule_label != null ||
        patch.description != null ||
        patch.public != null ||
        patch.location != null ||
        patch.class_credits !== undefined ||
        patch.pt_credits !== undefined ||
        patch.access != null ||
        patch.programme_id !== undefined;
      const sessionRaw =
        body.session && typeof body.session === 'object'
          ? (body.session as Record<string, unknown>)
          : null;
      const result = updateClassDesk(store, {
        planId,
        patch: hasPatch
          ? {
              code: patch.code != null ? String(patch.code) : undefined,
              name: patch.name != null ? String(patch.name) : undefined,
              price_zar:
                patch.price_zar != null ? Number(patch.price_zar) : undefined,
              billing: patch.billing
                ? (String(patch.billing) as FitMembershipPlan['billing'])
                : undefined,
              schedule_label:
                patch.schedule_label != null
                  ? String(patch.schedule_label)
                  : undefined,
              description:
                patch.description != null
                  ? String(patch.description)
                  : undefined,
              public:
                patch.public != null ? patch.public === true : undefined,
              location:
                patch.location != null ? String(patch.location) : undefined,
              class_credits:
                patch.class_credits !== undefined
                  ? patch.class_credits == null || patch.class_credits === ''
                    ? null
                    : Number(patch.class_credits)
                  : undefined,
              pt_credits:
                patch.pt_credits !== undefined
                  ? patch.pt_credits == null || patch.pt_credits === ''
                    ? null
                    : Number(patch.pt_credits)
                  : undefined,
              access: patch.access
                ? (String(patch.access) as FitMembershipPlan['access'])
                : undefined,
              programme_id:
                patch.programme_id !== undefined
                  ? patch.programme_id
                    ? String(patch.programme_id)
                    : null
                  : undefined,
            }
          : undefined,
        coachId,
        sessionPatch: sessionRaw
          ? {
              start_time: sessionRaw.start_time
                ? String(sessionRaw.start_time)
                : undefined,
              end_time:
                sessionRaw.end_time != null
                  ? String(sessionRaw.end_time)
                  : undefined,
              location:
                sessionRaw.location != null
                  ? String(sessionRaw.location)
                  : undefined,
              public:
                sessionRaw.public != null
                  ? sessionRaw.public === true
                  : undefined,
            }
          : undefined,
        fromDate: body.from_date ? String(body.from_date) : now.slice(0, 10),
        now,
      });
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      const updatedAt = await savePatch(companyId, meta, {
        sessions: store.sessions,
        membership_plans: store.membership_plans,
        class_types: store.class_types,
      });
      store.updated_at = updatedAt;
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        sessionsUpdated: result.sessionsUpdated,
        message:
          result.sessionsUpdated > 0
            ? `Saved · ${result.sessionsUpdated} upcoming class${
                result.sessionsUpdated === 1 ? '' : 'es'
              } updated`
            : 'Saved',
      });
    }

    if (action === 'schedule_class') {
      const rawFreq = String(body.frequency || body.repeat || '')
        .toLowerCase()
        .trim();
      const freq: FitRecurrence['frequency'] =
        rawFreq === 'daily' || rawFreq === 'weekly' || rawFreq === 'monthly'
          ? rawFreq
          : 'none';
      const recurrence: FitRecurrence =
        freq === 'none'
          ? { frequency: 'none' }
          : {
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
      const result = scheduleClassOnCalendar(store, {
        planId: String(body.plan_id || ''),
        date: String(body.date || now.slice(0, 10)),
        start_time: String(body.start_time || ''),
        end_time: body.end_time != null ? String(body.end_time) : null,
        duration_min:
          body.duration_min != null ? Number(body.duration_min) : null,
        coach_id: body.coach_id ? String(body.coach_id) : null,
        location: body.location != null ? String(body.location) : undefined,
        room: body.room != null ? String(body.room) : null,
        capacity: body.capacity != null ? Number(body.capacity) : null,
        public: body.public !== false,
        recurrence,
        now,
      });
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      const updatedAt = await savePatch(companyId, meta, {
        sessions: store.sessions,
        bookings: store.bookings,
        membership_plans: store.membership_plans,
        class_types: store.class_types,
      });
      store.updated_at = updatedAt;
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        created: result.sessions.length,
        booked: result.booked,
        sessions: result.sessions,
        message: `${result.sessions.length} class${
          result.sessions.length === 1 ? '' : 'es'
        } on the calendar${
          result.booked
            ? ` · ${result.booked} member booking${
                result.booked === 1 ? '' : 's'
              }`
            : ''
        }`,
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
      if (sessionKindOf(store, session) === 'coach_personal') {
        return NextResponse.json(
          { error: 'Coach personal time cannot be shared as a join link' },
          { status: 400 }
        );
      }
      const hadPublicToken = Boolean(store.settings?.public_token);
      const hadAllowPublicBooking = store.settings?.allow_public_booking !== false;
      store.settings = ensurePublicToken(store.settings, companyId);
      // Keep calendar usable for invites even if not fully published
      if (store.settings.allow_public_booking === false) {
        store.settings.allow_public_booking = true;
      }
      const hadShareCode = Boolean(session.share_code);
      const shareCode = ensureSessionShareCode(session);
      // Skip the write when both tokens already existed and settings unchanged.
      if (!hadPublicToken || !hadShareCode || !hadAllowPublicBooking) {
        await savePatchForKeys(companyId, meta, store, 'settings', 'sessions');
      }
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
      const updatedAt = await savePatch(companyId, meta, { sessions: store.sessions });
      store.updated_at = updatedAt;
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
      const sessionHint = body.session_id ? String(body.session_id) : undefined;
      const marked = applyGymAttendanceMark(store, {
        bookingId,
        status: String(body.status || 'attended'),
        now,
        requireSessionId: sessionHint,
        sessionId: sessionHint,
        clientId: body.client_id ? String(body.client_id) : undefined,
      });
      if (!marked.ok) {
        return NextResponse.json(
          { error: marked.error },
          { status: marked.error === 'Booking not found' ? 404 : 400 }
        );
      }
      const booking = marked.booking;
      const status = booking.status;
      const prevStatus = marked.prevStatus;
      // Cancelled → promote waitlist + email offer
      let promoted: FitBooking | null = null;
      if (status === 'cancelled' && booking.session_id) {
        const { promoteNextWaitlist } = await import(
          '@/lib/services/advisor-booking'
        );
        const { sendWaitlistOfferEmail } = await import(
          '@/lib/services/advisor-reminders'
        );
        promoted = promoteNextWaitlist(
          store.bookings,
          (b) => b.session_id === booking.session_id,
          now
        );
        if (promoted) {
          const client = store.clients.find((c) => c.id === promoted!.client_id);
          const session = store.sessions.find(
            (s) => s.id === promoted!.session_id
          );
          const ct = session
            ? store.class_types.find((t) => t.id === session.class_type_id)
            : null;
          if (client?.email && session) {
            await sendWaitlistOfferEmail({
              to: client.email,
              personName:
                promoted.family_member_name || client.name || 'Member',
              brand: store.settings?.brand_name || 'Gym',
              eventTitle: ct?.name || 'Class',
              date: session.date,
              start_time: session.start_time,
              location: session.location,
              manageUrl: client.portal_token
                ? `/member/fitgraph/${client.portal_token}`
                : undefined,
              moduleLabel: 'GymAdvisor®',
              moduleKey: 'fitgraph',
              logoUrl: store.settings?.company_logo_url || null,
            });
          }
        }
      }
      let feedbackPath: string | null = null;
      let packRemaining: number | null = null;
      if (status === 'attended' && booking.feedback_token) {
        feedbackPath = buildPublicFeedbackPath(
          'fitgraph',
          companyId,
          booking.feedback_token
        );
      }
      if (status === 'attended') {
        // Consume PT / session pack if available
        if (prevStatus !== 'attended') {
          const {
            consumePackSession,
            fitPtPackToLedger,
            ledgerToFitPtPack,
          } = await import('@/lib/services/advisor-pack-ledger');
          const ledgers = (store.pt_packs || []).map(fitPtPackToLedger);
          const session = store.sessions.find((s) => s.id === booking.session_id);
          const { packs, remaining, consumed } = consumePackSession(ledgers, {
            personId: booking.client_id,
            bookingId: booking.id,
            providerId: session?.coach_id,
            now,
          });
          store.pt_packs = packs.map(ledgerToFitPtPack) as typeof store.pt_packs;
          packRemaining = remaining;
          if (consumed) {
            const { appendAdvisorEvent } = await import(
              '@/lib/services/advisor-events'
            );
            const ev = appendAdvisorEvent(meta, {
              module: 'fitgraph',
              company_id: companyId,
              type: 'pack.consumed',
              person_id: booking.client_id,
              booking_id: booking.id,
              meta: { pack_id: consumed.id, remaining },
            });
            Object.assign(meta, ev.metadata);
          }
          // Progress active treatment plans
          if (store.treatment_plans?.length) {
            const { progressTreatmentPlanOnAttend } = await import(
              '@/lib/services/advisor-clinical'
            );
            store.treatment_plans = store.treatment_plans.map((tp) =>
              tp.person_id === booking.client_id && tp.status === 'active'
                ? progressTreatmentPlanOnAttend(tp, now)
                : tp
            );
          }
        }
      }
      {
        const { appendAdvisorEvent, dispatchAdvisorEventSideEffects } =
          await import('@/lib/services/advisor-events');
        const ev = appendAdvisorEvent(meta, {
          module: 'fitgraph',
          company_id: companyId,
          type:
            status === 'cancelled'
              ? 'booking.cancelled'
              : 'attendance.marked',
          person_id: booking.client_id,
          booking_id: booking.id,
          meta: { status, prev: prevStatus },
        });
        Object.assign(meta, ev.metadata);
        void dispatchAdvisorEventSideEffects(ev.event);
      }
      const updatedAt = await savePatch(companyId, meta, {
        bookings: store.bookings,
        pt_packs: store.pt_packs,
        treatment_plans: store.treatment_plans,
      });
      store.updated_at = updatedAt;
      if (marked.newlyAttended) {
        await notifyMemberToRateClass({ store, booking }).catch(() => null);
      }
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        ...(body.lite === true ? {} : { analysis: analysis(store) }),
        waitlist_promoted: promoted
          ? { booking_id: promoted.id, client_id: promoted.client_id }
          : null,
        pack_remaining: packRemaining,
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
            ? 'Marked attended — member notified to rate the class'
            : promoted
              ? 'Cancelled — next waitlist member promoted to booked'
              : status === 'no_show'
                ? 'Marked no-show — member stats updated'
                : undefined,
      });
    }

    /** Freeze / unfreeze membership */
    if (
      action === 'freeze_membership' ||
      action === 'unfreeze_membership' ||
      action === 'membership_freeze'
    ) {
      const clientId = String(body.client_id || body.id || '');
      const client = store.clients.find((c) => c.id === clientId);
      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
      const { membershipStatusAfterFreeze } = await import(
        '@/lib/services/advisor-booking'
      );
      const freeze =
        action === 'freeze_membership' ||
        body.freeze === true ||
        body.op === 'freeze';
      if (freeze) {
        client.membership_status = membershipStatusAfterFreeze(
          client.membership_status,
          'freeze'
        );
        client.membership_frozen_at = now;
        client.membership_freeze_until = body.until
          ? String(body.until).slice(0, 10)
          : null;
      } else {
        client.membership_status = membershipStatusAfterFreeze(
          client.membership_status,
          'unfreeze'
        );
        client.membership_frozen_at = null;
        client.membership_freeze_until = null;
      }
      client.join_events = appendJoinEvent(client, {
        at: now,
        kind: freeze ? 'frozen' : 'unfrozen',
        title: freeze ? 'Membership frozen' : 'Membership unfrozen',
        note: freeze && client.membership_freeze_until
          ? `Until ${client.membership_freeze_until}`
          : undefined,
        source: 'desk',
      });
      client.updated_at = now;
      await savePatchForKeys(companyId, meta, store, 'clients');
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        message: freeze
          ? 'Membership frozen'
          : 'Membership unfrozen — status active',
      });
    }

    /** Send booking reminders (next 24h) */
    if (action === 'promote_slot_waitlist') {
      const promoted = promoteWaitlistBooking(
        store.bookings,
        String(body.booking_id || body.id || ''),
        now
      );
      if (!promoted) {
        return NextResponse.json(
          { error: 'Waitlist booking not found' },
          { status: 404 }
        );
      }
      const updatedAt = await savePatch(companyId, meta, { bookings: store.bookings });
      store.updated_at = updatedAt;
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        message: 'Booked from waitlist',
      });
    }

    if (action === 'send_reminders') {
      const {
        sendBookingReminderEmail,
        needsReminder,
      } = await import('@/lib/services/advisor-reminders');
      let sent = 0;
      let skipped = 0;
      const errors: string[] = [];
      for (const b of store.bookings) {
        if (b.status !== 'booked') continue;
        const session = store.sessions.find((s) => s.id === b.session_id);
        if (!session || session.status === 'cancelled') continue;
        if (!needsReminder(b, session.date, session.start_time, 24)) {
          skipped++;
          continue;
        }
        const client = store.clients.find((c) => c.id === b.client_id);
        const email = client?.email || b.guest_email;
        if (!email) {
          skipped++;
          continue;
        }
        const ct = store.class_types.find(
          (c) => c.id === session.class_type_id
        );
        const attendee =
          b.family_member_name || client?.name || b.guest_name || 'Member';
        const result = await sendBookingReminderEmail({
          to: email,
          personName: attendee,
          brand: store.settings?.brand_name || 'Gym',
          eventTitle: ct?.name || 'Class',
          date: session.date,
          start_time: session.start_time,
          location: session.location,
          manageUrl: client?.portal_token
            ? `/member/fitgraph/${client.portal_token}`
            : undefined,
          moduleLabel: 'GymAdvisor®',
          moduleKey: 'fitgraph',
          logoUrl: store.settings?.company_logo_url || null,
        });
        if (result.ok) {
          b.reminded_at = now;
          b.reminder_count = (Number(b.reminder_count) || 0) + 1;
          sent++;
        } else {
          errors.push(result.error || 'fail');
        }
      }
      await savePatchForKeys(companyId, meta, store, 'bookings');
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        reminders: { sent, skipped, errors: errors.slice(0, 5) },
        message: `Sent ${sent} reminder${sent === 1 ? '' : 's'}`,
      });
    }

    /** Phase A–C: visit notes, outcomes scores, treatment plans */
    if (
      action === 'upsert_visit_note' ||
      action === 'record_outcome' ||
      action === 'upsert_treatment_plan' ||
      action === 'book_from_treatment_plan'
    ) {
      if (action === 'book_from_treatment_plan') {
        const {
          findNextBookableAppointment,
          nextOpenTreatmentStep,
        } = await import('@/lib/services/advisor-clinical');
        const planId = String(body.plan_id || '');
        const personId = String(body.person_id || body.client_id || '');
        store.treatment_plans = store.treatment_plans || [];
        const plan = store.treatment_plans.find(
          (p) =>
            p.id === planId ||
            (!planId && p.person_id === personId && p.status === 'active')
        );
        if (!plan) {
          return NextResponse.json(
            { error: 'Treatment plan not found' },
            { status: 404 }
          );
        }
        const step = nextOpenTreatmentStep(plan);
        if (!step) {
          return NextResponse.json(
            { error: 'No open plan steps to book' },
            { status: 400 }
          );
        }
        const sessionsAsAppts = (store.sessions || []).map((s) => ({
          id: s.id,
          service_id: s.class_type_id,
          date: s.date,
          start_time: s.start_time,
          status: s.status === 'cancelled' ? 'cancelled' : 'scheduled',
        }));
        let sessionId = findNextBookableAppointment({
          appointments: sessionsAsAppts,
          bookings: store.bookings.map((b) => ({
            session_id: b.session_id,
            status: b.status,
          })),
          serviceId: step.service_id,
          useSessionId: true,
        });
        if (!sessionId && step.service_id) {
          sessionId = findNextBookableAppointment({
            appointments: sessionsAsAppts,
            bookings: store.bookings.map((b) => ({
              session_id: b.session_id,
              status: b.status,
            })),
            useSessionId: true,
          });
        }
        if (!sessionId) {
          return NextResponse.json(
            { error: 'No open class session available' },
            { status: 400 }
          );
        }
        const clientId = plan.person_id;
        const exists = store.bookings.find(
          (b) =>
            b.session_id === sessionId &&
            b.client_id === clientId &&
            b.status !== 'cancelled'
        );
        if (exists) {
          return NextResponse.json(
            { error: 'Member already booked on that session' },
            { status: 400 }
          );
        }
        const session = store.sessions.find((s) => s.id === sessionId);
        const capacity = session?.capacity ?? 20;
        const booked = store.bookings.filter(
          (b) =>
            b.session_id === sessionId &&
            (b.status === 'booked' || b.status === 'attended')
        ).length;
        const status = booked >= capacity ? 'waitlist' : 'booked';
        store.bookings.unshift({
          id: `bk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          session_id: sessionId,
          client_id: clientId,
          status: status as 'booked' | 'waitlist',
          booked_at: now,
          source: 'treatment_plan',
        });
        await savePatchForKeys(companyId, meta, store, 'bookings');
        return NextResponse.json({
          success: true,
          store,
          summary: summariseFitgraph(store),
          analysis: analysis(store),
          session_id: sessionId,
          message:
            status === 'waitlist'
              ? `Waitlisted for next session (“${step.title}”)`
              : `Booked next session for “${step.title}”`,
        });
      }
      if (action === 'upsert_visit_note') {
        const { newVisitNote } = await import('@/lib/services/advisor-clinical');
        store.visit_notes = store.visit_notes || [];
        const note = newVisitNote({
          person_id: String(body.person_id || body.client_id || ''),
          body: String(body.body || body.notes || ''),
          booking_id: body.booking_id ? String(body.booking_id) : null,
          session_id: body.session_id ? String(body.session_id) : null,
          author_name: body.author_name ? String(body.author_name) : 'Desk',
          soap: body.soap as
            | {
                subjective?: string;
                objective?: string;
                assessment?: string;
                plan?: string;
              }
            | undefined,
          pain_score:
            body.pain_score != null ? Number(body.pain_score) : null,
          function_score:
            body.function_score != null ? Number(body.function_score) : null,
          now,
        });
        store.visit_notes.unshift(note);
        const { appendAdvisorEvent } = await import(
          '@/lib/services/advisor-events'
        );
        const ev = appendAdvisorEvent(meta, {
          module: 'fitgraph',
          company_id: companyId,
          type: 'visit_note.saved',
          person_id: note.person_id,
          booking_id: note.booking_id,
        });
        Object.assign(meta, ev.metadata);
      } else if (action === 'record_outcome') {
        const { newOutcomeScore } = await import(
          '@/lib/services/advisor-clinical'
        );
        store.outcome_scores = store.outcome_scores || [];
        const row = newOutcomeScore({
          person_id: String(body.person_id || body.client_id || ''),
          instrument: String(body.instrument || 'pain_nrs'),
          score: Number(body.score),
          max_score: body.max_score != null ? Number(body.max_score) : 10,
          notes: body.notes ? String(body.notes) : undefined,
          booking_id: body.booking_id ? String(body.booking_id) : null,
          now,
        });
        store.outcome_scores.unshift(row);
      } else {
        const { newTreatmentPlan } = await import(
          '@/lib/services/advisor-clinical'
        );
        store.treatment_plans = store.treatment_plans || [];
        if (body.id) {
          const i = store.treatment_plans.findIndex(
            (t) => t.id === String(body.id)
          );
          if (i >= 0) {
            store.treatment_plans[i] = {
              ...store.treatment_plans[i],
              title: body.title
                ? String(body.title)
                : store.treatment_plans[i].title,
              goals: body.goals != null ? String(body.goals) : store.treatment_plans[i].goals,
              status: (body.status as typeof store.treatment_plans[0]['status']) ||
                store.treatment_plans[i].status,
              updated_at: now,
            };
          }
        } else {
          store.treatment_plans.unshift(
            newTreatmentPlan({
              person_id: String(body.person_id || body.client_id || ''),
              title: String(body.title || 'Program plan'),
              goals: body.goals ? String(body.goals) : undefined,
              steps: Array.isArray(body.steps) ? body.steps : undefined,
              now,
            })
          );
        }
      }
      const clinicalPatchKeys: Array<keyof FitgraphStore> =
        action === 'upsert_visit_note'
          ? ['visit_notes']
          : action === 'record_outcome'
            ? ['outcome_scores']
            : ['treatment_plans'];
      await savePatchForKeys(companyId, meta, store, ...clinicalPatchKeys);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
      });
    }

    /** Reschedule booking (desk or self-serve with policy) */
    if (action === 'reschedule_booking') {
      const { evaluateReschedule } = await import(
        '@/lib/services/advisor-reschedule'
      );
      const bookingId = String(body.booking_id || '');
      const booking = store.bookings.find((b) => b.id === bookingId);
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      const session = store.sessions.find((s) => s.id === booking.session_id);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      const client = store.clients.find((c) => c.id === booking.client_id);
      const decision = evaluateReschedule({
        policy: store.settings?.reschedule_policy,
        eventDate: session.date,
        eventTime: session.start_time,
        personSoftBlocked: client?.booking_soft_block === true,
      });
      if (body.check_only) {
        return NextResponse.json({ success: true, decision });
      }
      if (!decision.allowed && body.force !== true) {
        return NextResponse.json(
          { error: decision.reason || 'Reschedule not allowed', decision },
          { status: 403 }
        );
      }
      const newSessionId = String(body.new_session_id || '');
      const newSession = store.sessions.find((s) => s.id === newSessionId);
      if (!newSession || newSession.status === 'cancelled') {
        return NextResponse.json(
          { error: 'new_session_id required and must be open' },
          { status: 400 }
        );
      }
      booking.session_id = newSessionId;
      booking.notes = [
        booking.notes,
        `Rescheduled from ${session.date} ${session.start_time}`,
        decision.fee_zar > 0 ? `Late fee R${decision.fee_zar}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      const { appendAdvisorEvent } = await import(
        '@/lib/services/advisor-events'
      );
      const ev = appendAdvisorEvent(meta, {
        module: 'fitgraph',
        company_id: companyId,
        type: 'booking.rescheduled',
        person_id: booking.client_id,
        booking_id: booking.id,
        amount_zar: decision.fee_zar || null,
        meta: {
          from_session: session.id,
          to_session: newSessionId,
          free: decision.free,
        },
      });
      Object.assign(meta, ev.metadata);
      const updatedAt = await savePatch(companyId, meta, { bookings: store.bookings });
      store.updated_at = updatedAt;
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        decision,
        message: decision.free
          ? 'Booking rescheduled'
          : `Rescheduled · late fee R${decision.fee_zar}`,
      });
    }

    /** Outcomes snapshot for hub */
    if (action === 'outcomes') {
      const { computeOutcomes, recallCandidates } = await import(
        '@/lib/services/advisor-outcomes'
      );
      const eventNameById: Record<string, string> = {};
      for (const s of store.sessions) {
        const ct = store.class_types.find((c) => c.id === s.class_type_id);
        eventNameById[s.id] = ct?.name || 'Class';
      }
      const soft = store.clients.filter((c) => c.booking_soft_block).length;
      const outcomes = computeOutcomes({
        bookings: store.bookings,
        feedback: (store.class_feedback || []).map((f) => ({
          feeling: f.feeling,
          would_return: f.would_return,
          created_at: f.created_at,
          event_id: f.session_id,
        })),
        eventNameById,
        peopleSoftBlocked: soft,
        periodDays: Number(body.period_days) || 30,
      });
      const recalls = recallCandidates({
        people: store.clients,
        bookings: store.bookings.map((b) => ({
          client_id: b.client_id,
          status: b.status,
          booked_at: b.booked_at,
        })),
        recallAfterDays: Number(body.recall_after_days) || 45,
      });
      return NextResponse.json({ success: true, outcomes, recalls });
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
        await savePatchForKeys(companyId, meta, store, 'settings');
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
        await savePatchForKeys(companyId, meta, store, 'settings', 'coaches');
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
        await savePatchForKeys(companyId, meta, store, 'settings', 'coaches');
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
        await savePatchForKeys(companyId, meta, store, 'settings');
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

    if (action === 'enroll_programme') {
      const programmeId = String(body.programme_id || '');
      const programme = (store.programmes || []).find((p) => p.id === programmeId);
      if (!programme || programme.active === false) {
        return NextResponse.json(
          { error: 'Programme not found' },
          { status: 404 }
        );
      }
      const ids = Array.isArray(body.client_ids)
        ? body.client_ids.map((x: unknown) => String(x || '').trim()).filter(Boolean)
        : [String(body.client_id || '').trim()].filter(Boolean);
      if (!ids.length) {
        return NextResponse.json(
          { error: 'Pick at least one client' },
          { status: 400 }
        );
      }
      if (!store.programme_enrollments) store.programme_enrollments = [];
      const startDate = String(body.start_date || now).slice(0, 10);
      const rows = [];
      for (const clientId of ids) {
        const client = store.clients.find((c) => c.id === clientId);
        if (!client || client.active === false) continue;
        const row = enrollClientOnProgramme(
          store.programme_enrollments,
          {
            client_id: client.id,
            programme_id: programmeId,
            coach_id: body.coach_id
              ? String(body.coach_id)
              : client.coach_id || programme.coach_id || null,
            source: String(body.source || 'assigned'),
            start_date: startDate,
            status: 'active',
          },
          now,
          newId
        );
        const bought = new Set(client.purchased_programme_ids || []);
        bought.add(programmeId);
        client.purchased_programme_ids = [...bought];
        client.updated_at = now;
        rows.push(row);
      }
      if (!rows.length) {
        return NextResponse.json(
          { error: 'No matching clients to enroll' },
          { status: 400 }
        );
      }
      await savePatchForKeys(
        companyId,
        meta,
        store,
        'programme_enrollments',
        'clients'
      );
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        enrollments: rows,
        message:
          rows.length === 1
            ? 'Client enrolled on the programme'
            : `${rows.length} clients enrolled`,
      });
    }

    if (action === 'log_programme') {
      const enrollmentId = String(body.enrollment_id || '');
      const enrollment = (store.programme_enrollments || []).find(
        (e) => e.id === enrollmentId
      );
      if (!enrollment) {
        return NextResponse.json(
          { error: 'Enrollment not found' },
          { status: 404 }
        );
      }
      if (!store.programme_logs) store.programme_logs = [];
      const row = upsertProgrammeLog(
        store.programme_logs,
        {
          ...body,
          enrollment_id: enrollment.id,
          programme_id: enrollment.programme_id,
          client_id: enrollment.client_id,
          by_role: String(body.by_role || 'desk'),
        },
        now,
        newId
      );
      await savePatchForKeys(companyId, meta, store, 'programme_logs');
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        log: row,
        message: 'Programme log saved',
      });
    }

    if (action === 'log_goal' || action === 'goal_actual') {
      const {
        applyGoalToStore,
        logGoalActual,
        parseGoalNumber,
      } = await import('@/lib/fitness/member-goals');
      const value = parseGoalNumber(body.value ?? body.actual);
      if (value == null) {
        return NextResponse.json({ error: 'Enter an actual number' }, { status: 400 });
      }
      const prev = (store.goals || []).find(
        (g) => g.id === String(body.goal_id || body.id || '')
      );
      if (!prev) {
        return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
      }
      const next = logGoalActual(prev, value, {
        by_role: 'owner',
        source: 'desk',
        nowIso: (body.at || body.date)
          ? String(body.at || body.date)
          : now,
      });
      applyGoalToStore(store, next);
      await savePatchForKeys(companyId, meta, store, 'goals');
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        goal: next,
        message:
          next.status === 'achieved' ? 'Goal hit — well done' : 'Actual saved',
      });
    }

    if (action === 'upsert_leaderboard_activity') {
      const { upsertGymBoardActivity } = await import(
        '@/lib/fitness/gym-leaderboard'
      );
      const result = upsertGymBoardActivity(
        store.leaderboard_activities,
        { ...body, ...(body.record as object), source: 'owner' },
        now
      );
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      store.leaderboard_activities = result.list;
      await savePatchForKeys(companyId, meta, store, 'leaderboard_activities');
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        activity: result.row,
        message: 'Leadership activity saved',
      });
    }

    if (action === 'assign_leaderboard_activity') {
      const { assignGymBoardActivity } = await import(
        '@/lib/fitness/gym-leaderboard'
      );
      const result = assignGymBoardActivity(
        store.leaderboard_assignments,
        {
          activity_id: String(body.activity_id || ''),
          class_type_id: String(body.class_type_id || ''),
          session_id: body.session_id ? String(body.session_id) : null,
        },
        now
      );
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      store.leaderboard_assignments = result.list;
      await savePatchForKeys(companyId, meta, store, 'leaderboard_assignments');
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        assignment: result.row,
        message: 'Activity added to class',
      });
    }

    if (action === 'unassign_leaderboard_activity') {
      const { unassignGymBoardActivity } = await import(
        '@/lib/fitness/gym-leaderboard'
      );
      store.leaderboard_assignments = unassignGymBoardActivity(
        store.leaderboard_assignments,
        String(body.id || body.assignment_id || '')
      );
      await savePatchForKeys(companyId, meta, store, 'leaderboard_assignments');
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        message: 'Activity removed from class',
      });
    }

    if (action === 'log_leaderboard_score') {
      const { parseGymBoardActivities, parseChallengeValue, upsertGymBoardScore } =
        await import('@/lib/fitness/gym-leaderboard');
      const activity = parseGymBoardActivities(store.leaderboard_activities).find(
        (a) => a.id === String(body.activity_id || '') && a.active
      );
      if (!activity) {
        return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
      }
      const parsed = parseChallengeValue(
        body.value ?? body.display,
        activity.win
      );
      if ('error' in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const scored = upsertGymBoardScore(
        store.leaderboard_scores,
        {
          activity_id: activity.id,
          client_id: String(body.client_id || ''),
          session_id: body.session_id ? String(body.session_id) : null,
          class_type_id: body.class_type_id
            ? String(body.class_type_id)
            : null,
          value: parsed.value,
          display: parsed.display,
        },
        now
      );
      store.leaderboard_scores = scored.list;
      await savePatchForKeys(companyId, meta, store, 'leaderboard_scores');
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        score: scored.row,
        message: 'Score logged',
      });
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
      await savePatchForKeys(companyId, meta, store, 'class_feedback');
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
        feedback: row,
        message: 'Feedback saved',
      });
    }

    if (action === 'add_session_members') {
      const sessionId = String(body.session_id || '');
      const session = store.sessions.find((s) => s.id === sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Class not found' }, { status: 404 });
      }
      const blocked = coachPersonalBookingError(store, session);
      if (blocked) {
        return NextResponse.json({ error: blocked }, { status: 400 });
      }
      const { dedupeFitgraphBookings } = await import(
        '@/lib/fitness/gym-bookings'
      );
      const ids = parseFitClientIds(body.client_ids, body.client_id);
      const already = new Set(
        (store.bookings || [])
          .filter(
            (b) =>
              b.session_id === session.id &&
              b.status !== 'cancelled' &&
              b.status !== 'no_show'
          )
          .map((b) => b.client_id)
      );
      const incoming = ids.filter((id) => !already.has(id));
      ensureSessionCapacityForMembers(
        session,
        already.size + incoming.length
      );
      let added = 0;
      let skipped = 0;
      for (const clientId of ids) {
        const client = store.clients.find((c) => c.id === clientId);
        if (!client) {
          skipped += 1;
          continue;
        }
        const result = bookDeskMemberOntoSession(store, session, client, now, {
          force: true,
        });
        if (result === 'skipped') skipped += 1;
        else added += 1;
      }
      dedupeFitgraphBookings(store);
      const updatedAt = await savePatch(companyId, meta, {
        bookings: store.bookings,
        sessions: store.sessions,
      });
      store.updated_at = updatedAt;
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        ...(body.lite === true ? {} : { analysis: analysis(store) }),
        added,
        skipped,
        message:
          added === 0
            ? skipped
              ? 'Already on this class'
              : 'No members added'
            : added === 1
              ? 'Member added to class'
              : `${added} members added to class`,
      });
    }

    if (action === 'mark_attendance_bulk') {
      const sessionId = String(body.session_id || '');
      const marks = Array.isArray(body.marks) ? body.marks : [];
      const rateBookings: FitBooking[] = [];
      for (const m of marks) {
        const bid = String((m as { booking_id?: string }).booking_id || '');
        const st = String((m as { status?: string }).status || '');
        const markSessionId = String(
          (m as { session_id?: string }).session_id || sessionId || ''
        );
        const marked = applyGymAttendanceMark(store, {
          bookingId: bid,
          status: st,
          now,
          requireSessionId: markSessionId || undefined,
          sessionId: markSessionId || undefined,
          clientId: String((m as { client_id?: string }).client_id || ''),
        });
        if (marked.ok && marked.newlyAttended) rateBookings.push(marked.booking);
      }
      const updatedAt = await savePatch(companyId, meta, { bookings: store.bookings });
      store.updated_at = updatedAt;
      await Promise.all(
        rateBookings.map((booking) =>
          notifyMemberToRateClass({ store, booking }).catch(() => null)
        )
      );
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        ...(body.lite === true ? {} : { analysis: analysis(store) }),
        rated: rateBookings.length,
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
      if (entity === 'movements') {
        const { isSystemMovement } = await import(
          '@/lib/fitness/movement-catalog'
        );
        const existing = (store.movements || []).find((m) => m.id === id);
        if (existing && isSystemMovement(existing)) {
          return NextResponse.json(
            { error: 'Built-in catalog movements cannot be deleted' },
            { status: 400 }
          );
        }
        const { removeMovementFromProgrammes } = await import(
          '@/lib/fitness/movements'
        );
        if (!store.programmes) store.programmes = [];
        removeMovementFromProgrammes(store.programmes, id);
      }
      if (entity === 'programmes') {
        const { clearProgrammeFromSessions } = await import(
          '@/lib/fitness/movements'
        );
        clearProgrammeFromSessions(store.sessions, id);
        for (const p of store.programmes || []) {
          p.session_ids = (p.session_ids || []).filter((x) => x !== id);
        }
        for (const e of store.programme_enrollments || []) {
          if (e.programme_id === id && e.status === 'active') {
            e.status = 'cancelled';
            e.updated_at = now;
          }
        }
      }
      if (entity === 'leaderboard_activities') {
        store.leaderboard_assignments = (store.leaderboard_assignments || []).filter(
          (a) => a.activity_id !== id
        );
      }
      const deletePatchKeys: Array<keyof FitgraphStore> = [entity];
      if (entity === 'movements') {
        deletePatchKeys.push('programmes');
      } else if (entity === 'programmes') {
        deletePatchKeys.push('sessions', 'programme_enrollments');
      } else if (entity === 'leaderboard_activities') {
        deletePatchKeys.push('leaderboard_assignments');
      } else if (entity === 'sessions') {
        deletePatchKeys.push('bookings', 'removed_ids');
      }
      if (Array.isArray(list)) {
        // Optional: delete whole class series when series_id matches
        if (
          entity === 'sessions' &&
          (body.delete_series === true || body.series === true)
        ) {
          const target = store.sessions.find((s) => s.id === id);
          const seriesId = target?.series_id
            ? String(target.series_id)
            : null;
          if (seriesId) {
            const removeIds = new Set(
              store.sessions
                .filter((s) => s.series_id === seriesId)
                .map((s) => s.id)
            );
            const dropBookings = (store.bookings || [])
              .filter((b) => removeIds.has(b.session_id))
              .map((b) => b.id);
            const { rememberRemovedFitgraphIds } = await import(
              '@/lib/fitness/fitgraph-merge'
            );
            rememberRemovedFitgraphIds(store, 'sessions', removeIds);
            rememberRemovedFitgraphIds(store, 'bookings', dropBookings);
            store.sessions = store.sessions.filter((s) => !removeIds.has(s.id));
            store.bookings = (store.bookings || []).filter(
              (b) => !removeIds.has(b.session_id)
            );
            await savePatchForKeys(companyId, meta, store, ...deletePatchKeys);
            return NextResponse.json({
              success: true,
              store,
              summary: summariseFitgraph(store),
              analysis: analysis(store),
              deleted: removeIds.size,
              message: `Deleted ${removeIds.size} classes in series`,
            });
          }
        }

        (store as unknown as Record<string, unknown>)[key] = (
          list as Array<{ id?: string }>
        ).filter((row) => row.id !== id);
        // Drop bookings tied to a removed class
        if (entity === 'sessions') {
          const dropBookings = (store.bookings || [])
            .filter((b) => b.session_id === id)
            .map((b) => b.id);
          const { rememberRemovedFitgraphIds } = await import(
            '@/lib/fitness/fitgraph-merge'
          );
          rememberRemovedFitgraphIds(store, 'sessions', [id]);
          rememberRemovedFitgraphIds(store, 'bookings', dropBookings);
          store.bookings = (store.bookings || []).filter(
            (b) => b.session_id !== id
          );
        }
      }
      await savePatchForKeys(companyId, meta, store, ...deletePatchKeys);
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
    if (entity === 'bookings') {
      const session = store.sessions.find(
        (s) => s.id === String(rec.session_id || '')
      );
      const blocked = coachPersonalBookingError(store, session);
      if (blocked) {
        return NextResponse.json({ error: blocked }, { status: 400 });
      }
    }
    const existingClientId = rec.id ? String(rec.id) : '';
    const hadSettings = Boolean(store.settings);
    const clientWasNew =
      entity === 'clients' &&
      (!existingClientId ||
        !store.clients.some((c) => c.id === existingClientId));
    upsert(store, entity, rec, now);

    let walletInvite: {
      email_sent?: boolean;
      warning?: string;
      invite_link?: string;
      wallet_linked?: boolean;
      email?: string;
    } | null = null;
    if (entity === 'clients' && body.lite !== true && rec.lite !== true) {
      const person =
        store.clients.find(
          (c) => existingClientId && c.id === existingClientId
        ) || store.clients[store.clients.length - 1];
      if (person) {
        const { attachWalletAndMaybeInvite } = await import(
          '@/lib/services/desk-wallet-link'
        );
        const sendInvite =
          rec.send_wallet_invite !== false &&
          (clientWasNew || rec.send_wallet_invite === true);
        const linked = await attachWalletAndMaybeInvite({
          person,
          operatorUserId: gate.userId,
          sendInvite,
          module: 'fitgraph',
          companyId,
          businessName: store.settings?.brand_name || 'Your gym',
          invitedBy: String(rec.invited_by || rec.invitedBy || 'Your gym team'),
          issuePortalToken: () => issueClientPortalToken(companyId),
        });
        const ci = store.clients.findIndex((c) => c.id === person.id);
        if (ci >= 0) store.clients[ci] = linked.person;
        const { attachCrmToAdvisorPerson } = await import(
          '@/lib/b2c/member-account-ar'
        );
        await attachCrmToAdvisorPerson({
          companyId,
          kind: 'gym',
          person: linked.person,
        });
        applyGymClientNumberFromAr(linked.person, store.clients || []);
        if (ci >= 0) store.clients[ci] = linked.person;
        walletInvite = {
          email_sent: linked.invite?.email_sent,
          warning: linked.invite?.warning,
          invite_link: linked.invite?.invite_link,
          wallet_linked: linked.wallet_linked,
          email: linked.person.email,
        };
      }
    }

    // Dual-write coaches → People / HR directory
    let peopleSync: { employeeId: number | null; created?: boolean } | null =
      null;
    if (entity === 'coaches') {
      const coachId = String(
        rec.id || store.coaches[store.coaches.length - 1]?.id || ''
      );
      const coach = store.coaches.find((c) => c.id === coachId);
      if (coach) {
        if (
          (coach.engagement === 'contractor' || !coach.engagement) &&
          !coach.portal_token
        ) {
          coach.portal_token = issueCoachPortalToken(companyId);
          coach.can_manage_classes = coach.can_manage_classes !== false;
        }
        const { syncStoreStaffPersonToHr } = await import(
          '@/lib/hr/sync-service-person'
        );
        peopleSync = await syncStoreStaffPersonToHr({
          companyId,
          source: 'fitgraph_coach',
          person: {
            ...coach,
            employment_type:
              coach.engagement === 'employed' ? 'full_time' : 'contract',
          },
        });
        const { attachApToAdvisorContractor } = await import(
          '@/lib/b2c/advisor-ap-sync'
        );
        await attachApToAdvisorContractor({
          companyId,
          kind: 'fitgraph_coach',
          person: coach,
        });
      }
    }

    const upsertPatchKeys: Array<keyof FitgraphStore> = [entity];
    if (!hadSettings && store.settings) {
      upsertPatchKeys.push('settings');
    }
    if (entity === 'membership_plans' && storeUsesClassSubscribe(store)) {
      upsertPatchKeys.push('class_types');
    }
    if (entity === 'sessions') {
      upsertPatchKeys.push('bookings', 'clients');
    }
    await savePatchForKeys(companyId, meta, store, ...upsertPatchKeys);
    return NextResponse.json({
      success: true,
      store,
      summary: summariseFitgraph(store),
      ...(body.lite === true ? {} : { analysis: analysis(store) }),
      people_sync: peopleSync,
      invite_sent: walletInvite?.email_sent,
      invite_link: walletInvite?.invite_link,
      wallet_linked: walletInvite?.wallet_linked,
      warning: walletInvite?.warning,
      message:
        entity === 'coaches' && peopleSync?.employeeId
          ? peopleSync.created
            ? 'Coach saved and added to People directory'
            : 'Coach saved and People record updated'
          : walletInvite?.warning
            ? walletInvite.warning
            : walletInvite?.email_sent
              ? `Member saved — invite sent to ${walletInvite.email} to link their SA Member wallet`
              : walletInvite?.wallet_linked
                ? 'Member saved — profile and family pulled from their SA Member wallet'
                : undefined,
    });
  } catch (e: unknown) {
    if (isStaleModuleStoreError(e)) {
      return NextResponse.json(
        {
          error: 'stale_store',
          updated_at: e.updatedAt,
          message: 'This GymAdvisor book changed in another tab. Refresh and try again.',
        },
        { status: 409 }
      );
    }
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
      code: String(rec.code || prev?.code || `C-${store.coaches.length + 1}`),
      name: String(rec.name || prev?.name || 'Coach'),
      email: rec.email != null ? String(rec.email) : prev?.email,
      phone: rec.phone != null ? String(rec.phone) : prev?.phone,
      id_number:
        rec.id_number !== undefined
          ? rec.id_number
            ? String(rec.id_number).trim()
            : undefined
          : prev?.id_number,
      identity: prev?.identity,
      hr_employee_id:
        rec.hr_employee_id !== undefined
          ? rec.hr_employee_id
            ? Number(rec.hr_employee_id)
            : null
          : prev?.hr_employee_id ?? null,
      srm_supplier_id:
        rec.srm_supplier_id !== undefined
          ? rec.srm_supplier_id
            ? Number(rec.srm_supplier_id)
            : null
          : prev?.srm_supplier_id ?? null,
      ap_account_code:
        rec.ap_account_code !== undefined
          ? rec.ap_account_code
            ? String(rec.ap_account_code)
            : null
          : prev?.ap_account_code ?? null,
      specialties: Array.isArray(rec.specialties)
        ? (rec.specialties as string[])
        : rec.specialty
          ? [String(rec.specialty)]
          : prev?.specialties || [],
      bio: rec.bio != null ? String(rec.bio) : prev?.bio,
      public_bio:
        rec.public_bio != null ? String(rec.public_bio) : prev?.public_bio,
      qualifications:
        rec.qualifications !== undefined
          ? parseQualifications(rec.qualifications)
          : prev?.qualifications || [],
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
      ...mergeContractorCommercialFromRecord(prev, rec),
      contracts: Array.isArray(rec.contracts)
        ? (rec.contracts as FitCoach['contracts'])
        : prev?.contracts || [],
      history,
      ...mergePersonInviteFromRecord(prev, rec),
      active:
        activeExplicit !== undefined
          ? activeExplicit
          : endDate
            ? false
            : prev?.active !== false,
      created_at: prev?.created_at || now,
      // Sticky fields — only the owner of that data updates them; a desk or
      // calendar save that omits these must not wipe them from the stored row.
      platform_user_id:
        rec.platform_user_id !== undefined
          ? rec.platform_user_id
            ? String(rec.platform_user_id)
            : null
          : prev?.platform_user_id ?? null,
      goals: rec.goals !== undefined
        ? (Array.isArray(rec.goals) ? (rec.goals as FitCoach['goals']) : prev?.goals)
        : prev?.goals,
      personal_bests: rec.personal_bests !== undefined
        ? (Array.isArray(rec.personal_bests)
            ? (rec.personal_bests as FitCoach['personal_bests'])
            : prev?.personal_bests)
        : prev?.personal_bests,
      result_logs: rec.result_logs !== undefined
        ? (Array.isArray(rec.result_logs)
            ? (rec.result_logs as FitCoach['result_logs'])
            : prev?.result_logs)
        : prev?.result_logs,
      injuries: rec.injuries !== undefined
        ? (Array.isArray(rec.injuries)
            ? (rec.injuries as FitCoach['injuries'])
            : prev?.injuries)
        : prev?.injuries,
      auth_code_hash:
        rec.auth_code_hash !== undefined
          ? rec.auth_code_hash
            ? String(rec.auth_code_hash)
            : null
          : prev?.auth_code_hash ?? null,
      pin_hash:
        rec.pin_hash !== undefined
          ? rec.pin_hash
            ? String(rec.pin_hash)
            : null
          : prev?.pin_hash ?? null,
      sort_order:
        rec.sort_order != null
          ? Number(rec.sort_order)
          : prev?.sort_order,
    };
    if (i >= 0) store.coaches[i] = row;
    else store.coaches.push(row);
  } else if (entity === 'clients') {
    rec = omitClientRosterFields(rec);
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
    let debitBank = prev?.debit_bank;
    if (rec.debit_bank !== undefined) {
      if (!rec.debit_bank) {
        debitBank = undefined;
      } else {
        const scratch: FitClient = {
          id: id,
          code: 'tmp',
          name: 'tmp',
          created_at: now,
          updated_at: now,
          debit_bank: prev?.debit_bank,
        };
        const applied = applyMemberDebitBank(scratch, rec.debit_bank, now);
        if (!applied.ok) {
          throw new Error(applied.error);
        }
        debitBank = scratch.debit_bank;
      }
    }
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
      id_number:
        rec.id_number !== undefined
          ? rec.id_number
            ? String(rec.id_number).trim()
            : undefined
          : prev?.id_number,
      /** Portal self-serve verification — never wipe on desk save */
      identity: prev?.identity,
      family:
        rec.family !== undefined
          ? Array.isArray(rec.family)
            ? (rec.family as FitClient['family'])
            : prev?.family
          : prev?.family,
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
      crm_customer_id:
        rec.crm_customer_id !== undefined
          ? rec.crm_customer_id
            ? Number(rec.crm_customer_id)
            : null
          : prev?.crm_customer_id ?? null,
      ar_account_code:
        rec.ar_account_code !== undefined
          ? rec.ar_account_code
            ? String(rec.ar_account_code)
            : null
          : prev?.ar_account_code ?? null,
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
      private_client:
        rec.private_client !== undefined
          ? rec.private_client === true
          : prev?.private_client === true,
      coach_id:
        rec.coach_id !== undefined
          ? rec.coach_id
            ? String(rec.coach_id)
            : null
          : prev?.coach_id ?? null,
      agreed_rate_zar:
        rec.agreed_rate_zar !== undefined
          ? rec.agreed_rate_zar == null || rec.agreed_rate_zar === ''
            ? null
            : Number(rec.agreed_rate_zar)
          : prev?.agreed_rate_zar ?? null,
      private_rate_zar:
        rec.private_rate_zar !== undefined
          ? rec.private_rate_zar == null || rec.private_rate_zar === ''
            ? null
            : Number(rec.private_rate_zar)
          : prev?.private_rate_zar ?? null,
      emergency_contact:
        rec.emergency_contact !== undefined
          ? rec.emergency_contact
            ? String(rec.emergency_contact)
            : undefined
          : prev?.emergency_contact,
      date_of_birth:
        rec.date_of_birth !== undefined
          ? rec.date_of_birth
            ? String(rec.date_of_birth).slice(0, 10)
            : null
          : prev?.date_of_birth ?? null,
      next_of_kin:
        rec.next_of_kin !== undefined
          ? rec.next_of_kin
            ? String(rec.next_of_kin)
            : undefined
          : prev?.next_of_kin,
      next_of_kin_phone:
        rec.next_of_kin_phone !== undefined
          ? rec.next_of_kin_phone
            ? String(rec.next_of_kin_phone)
            : undefined
          : prev?.next_of_kin_phone,
      next_of_kin_relationship:
        rec.next_of_kin_relationship !== undefined
          ? rec.next_of_kin_relationship
            ? String(rec.next_of_kin_relationship)
            : undefined
          : prev?.next_of_kin_relationship,
      passport:
        rec.passport !== undefined && rec.passport && typeof rec.passport === 'object'
          ? parseMemberPassport(rec.passport)
          : prev?.passport,
      medical:
        rec.medical !== undefined
          ? mergeMedicalRecord(prev?.medical, rec.medical)
          : prev?.medical,
      join_events: Array.isArray(rec.join_events)
        ? (rec.join_events as FitClient['join_events'])
        : prev?.join_events,
      contract_kind:
        rec.contract_kind === 'private' || rec.contract_kind === 'group'
          ? rec.contract_kind
          : prev?.contract_kind,
      contracts: Array.isArray(rec.contracts)
        ? (rec.contracts as FitClient['contracts'])
        : prev?.contracts,
      occupation:
        rec.occupation !== undefined
          ? rec.occupation
            ? String(rec.occupation)
            : undefined
          : prev?.occupation,
      heard_about:
        rec.heard_about !== undefined
          ? rec.heard_about
            ? String(rec.heard_about)
            : undefined
          : prev?.heard_about,
      employer_student_number:
        rec.employer_student_number !== undefined
          ? rec.employer_student_number
            ? String(rec.employer_student_number)
            : undefined
          : prev?.employer_student_number,
      address:
        rec.address !== undefined
          ? rec.address
            ? String(rec.address)
            : undefined
          : prev?.address,
      gp_contact:
        rec.gp_contact !== undefined
          ? rec.gp_contact
            ? String(rec.gp_contact)
            : undefined
          : prev?.gp_contact,
      notes:
        rec.notes !== undefined
          ? rec.notes
            ? String(rec.notes)
            : undefined
          : prev?.notes,
      debit_bank: debitBank,
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
      // Sticky fields — only the PWA / coach pathway writes these; desk saves
      // that omit them must not wipe the stored values.
      platform_user_id:
        rec.platform_user_id !== undefined
          ? rec.platform_user_id
            ? String(rec.platform_user_id)
            : null
          : prev?.platform_user_id ?? null,
      goals: rec.goals !== undefined
        ? (Array.isArray(rec.goals) ? (rec.goals as FitClient['goals']) : prev?.goals)
        : prev?.goals,
      personal_bests: rec.personal_bests !== undefined
        ? (Array.isArray(rec.personal_bests)
            ? (rec.personal_bests as FitClient['personal_bests'])
            : prev?.personal_bests)
        : prev?.personal_bests,
      result_logs: rec.result_logs !== undefined
        ? (Array.isArray(rec.result_logs)
            ? (rec.result_logs as FitClient['result_logs'])
            : prev?.result_logs)
        : prev?.result_logs,
      injuries: rec.injuries !== undefined
        ? (Array.isArray(rec.injuries)
            ? (rec.injuries as FitClient['injuries'])
            : prev?.injuries)
        : prev?.injuries,
      auth_code_hash:
        rec.auth_code_hash !== undefined
          ? rec.auth_code_hash
            ? String(rec.auth_code_hash)
            : null
          : prev?.auth_code_hash ?? null,
      pin_hash:
        rec.pin_hash !== undefined
          ? rec.pin_hash
            ? String(rec.pin_hash)
            : null
          : prev?.pin_hash ?? null,
    };
    if (!prev) {
      row.join_events = appendJoinEvent(row, {
        at: now,
        kind: 'created',
        title: 'Added to the gym book',
        source: 'desk',
      });
    } else if (
      row.start_date &&
      row.start_date !== prev.start_date
    ) {
      row.join_events = appendJoinEvent(row, {
        at: now,
        kind: 'membership_started',
        title: `Membership start ${row.start_date}`,
        source: 'desk',
      });
    }
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
      image_url:
        rec.image_url !== undefined
          ? rec.image_url
            ? String(rec.image_url)
            : null
          : store.membership_plans[i]?.image_url ?? null,
      video_url:
        rec.video_url !== undefined
          ? rec.video_url
            ? String(rec.video_url)
            : null
          : store.membership_plans[i]?.video_url ?? null,
      public: rec.public !== false,
      access:
        rec.access === 'programme' || rec.access === 'both'
          ? rec.access
          : 'classes',
      programme_id:
        rec.programme_id != null && String(rec.programme_id)
          ? String(rec.programme_id)
          : null,
      class_type_ids: Array.isArray(rec.class_type_ids)
        ? rec.class_type_ids.map(String)
        : rec.class_type_ids === undefined
          ? store.membership_plans[i]?.class_type_ids
          : [],
      series_ids: Array.isArray(rec.series_ids)
        ? rec.series_ids.map(String)
        : rec.series_ids === undefined
          ? store.membership_plans[i]?.series_ids
          : [],
      unlocks_all_classes:
        rec.unlocks_all_classes != null
          ? rec.unlocks_all_classes === true
          : store.membership_plans[i]?.unlocks_all_classes,
      excluded_class_type_ids: Array.isArray(rec.excluded_class_type_ids)
        ? rec.excluded_class_type_ids.map(String)
        : rec.excluded_class_type_ids === undefined
          ? store.membership_plans[i]?.excluded_class_type_ids
          : [],
      weekly_class_limit:
        rec.weekly_class_limit != null
          ? Number(rec.weekly_class_limit)
          : store.membership_plans[i]?.weekly_class_limit ?? null,
      addon:
        rec.addon != null
          ? rec.addon === true
          : store.membership_plans[i]?.addon,
      audience:
        rec.audience != null
          ? String(rec.audience)
          : store.membership_plans[i]?.audience,
      schedule_label:
        rec.schedule_label != null
          ? String(rec.schedule_label)
          : store.membership_plans[i]?.schedule_label,
      location:
        rec.location != null
          ? String(rec.location)
          : store.membership_plans[i]?.location,
      default_coach_id:
        rec.default_coach_id !== undefined
          ? rec.default_coach_id
            ? String(rec.default_coach_id)
            : null
          : store.membership_plans[i]?.default_coach_id ?? null,
      sibling_discount_pct:
        rec.sibling_discount_pct != null
          ? Number(rec.sibling_discount_pct)
          : store.membership_plans[i]?.sibling_discount_pct,
      sort_order:
        rec.sort_order != null
          ? Number(rec.sort_order)
          : store.membership_plans[i]?.sort_order,
      catalog:
        rec.catalog != null
          ? String(rec.catalog)
          : store.membership_plans[i]?.catalog ||
            (store.settings?.class_subscribe === true ? 'vuka' : undefined),
      active: rec.active !== false,
      created_at: i >= 0 ? store.membership_plans[i].created_at : now,
    };
    if (storeUsesClassSubscribe(store)) {
      ensureClassTypeForSubscribePlan(store, row, now, { syncFields: true });
    }
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
      charged_zar:
        rec.charged_zar !== undefined
          ? rec.charged_zar == null || rec.charged_zar === ''
            ? null
            : Number(rec.charged_zar)
          : prev?.charged_zar ?? null,
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
    const prev = i >= 0 ? store.class_types[i] : null;
    const row: FitClassType = {
      id,
      code: String(rec.code || prev?.code || `T-${store.class_types.length + 1}`),
      name: String(rec.name || prev?.name || 'Class'),
      category:
        rec.category != null
          ? String(rec.category)
          : prev?.category,
      default_duration_min:
        rec.default_duration_min != null
          ? Number(rec.default_duration_min)
          : prev?.default_duration_min ?? 45,
      capacity:
        rec.capacity != null
          ? Number(rec.capacity)
          : prev?.capacity ?? 20,
      description:
        rec.description != null
          ? String(rec.description)
          : prev?.description,
      color:
        rec.color !== undefined
          ? rec.color
            ? String(rec.color)
            : null
          : prev?.color ?? null,
      active:
        rec.active !== undefined ? rec.active !== false : prev?.active !== false,
      created_at: prev?.created_at || now,
    };
    if (i >= 0) store.class_types[i] = row;
    else store.class_types.push(row);
  } else if (entity === 'sessions') {
    const id = String(rec.id || newId('ses'));
    const i = store.sessions.findIndex((s) => s.id === id);
    const prev = i >= 0 ? store.sessions[i] : null;
    const roomName = String(
      rec.room !== undefined
        ? rec.room || ''
        : rec.location !== undefined
          ? rec.location || ''
          : prev?.room || prev?.location || ''
    ).trim();
    if (roomName) {
      const roomConflict = findRoomDiaryConflict({
        appointments: store.sessions.map((s) => ({
          id: s.id,
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time,
          duration_min: s.duration_min,
          location: s.room || s.location,
          status: s.status,
        })),
        room: roomName,
        date: String(rec.date || prev?.date || now.slice(0, 10)),
        start_time: String(rec.start_time || prev?.start_time || '06:00'),
        duration_min:
          rec.duration_min != null
            ? Number(rec.duration_min)
            : prev?.duration_min ?? 45,
        end_time:
          rec.end_time != null ? String(rec.end_time) : prev?.end_time ?? null,
        excludeId: id,
      });
      if (roomConflict.conflict) {
        return NextResponse.json(
          {
            error: roomConflict.message,
            code: 'ROOM_DOUBLE_BOOK',
            conflict: roomConflict,
          },
          { status: 409 }
        );
      }
    }
    const resolved = resolveClassTypeForSession(store, {
      class_type_id: String(
        rec.class_type_id || prev?.class_type_id || ''
      ),
      session_kind:
        rec.session_kind !== undefined
          ? rec.session_kind
          : prev?.session_kind,
    });
    const ct = store.class_types.find((c) => c.id === resolved.class_type_id);
    const times = resolveSessionTimes({
      start_time: String(rec.start_time || prev?.start_time || '06:00'),
      end_time:
        rec.end_time != null
          ? String(rec.end_time)
          : rec.duration_min != null
            ? null
            : prev?.end_time ?? null,
      duration_min:
        rec.duration_min != null
          ? Number(rec.duration_min)
          : prev?.duration_min ?? ct?.default_duration_min ?? 45,
      fallbackDuration: ct?.default_duration_min ?? 45,
    });
    const rules = applySessionKindRules(resolved.kind, {
      public:
        rec.public !== undefined
          ? rec.public === true || rec.public === 'true'
          : prev?.public === true,
      capacity:
        rec.capacity != null
          ? Number(rec.capacity)
          : prev?.capacity ?? ct?.capacity ?? 20,
    });
    const makePublic = rules.public;
    const nextCoachId =
      rec.coach_id !== undefined
        ? rec.coach_id
          ? String(rec.coach_id)
          : null
        : prev?.coach_id ?? null;
    const nextDate = String(rec.date || prev?.date || now.slice(0, 10));
    if (
      nextCoachId &&
      resolved.kind !== 'away' &&
      resolved.kind !== 'coach_personal'
    ) {
      const diaryAway = gymCoachAwayOn(
        store.sessions.filter((s) => s.id !== id),
        nextCoachId,
        nextDate
      );
      if (diaryAway) {
        throw new Error(`Coach is away on ${nextDate}`);
      }
    }
    const row: FitSession = {
      id,
      class_type_id: resolved.class_type_id,
      coach_id:
        rec.coach_id !== undefined
          ? rec.coach_id
            ? String(rec.coach_id)
            : null
          : prev?.coach_id ?? null,
      date: String(rec.date || prev?.date || now.slice(0, 10)),
      start_time: times.start_time,
      end_time: times.end_time,
      duration_min: times.duration_min,
      session_kind: resolved.kind,
      personal_reason:
        rec.personal_reason !== undefined
          ? rec.personal_reason
            ? String(rec.personal_reason)
            : null
          : prev?.personal_reason ??
            (resolved.kind === 'away' ? 'leave' : null),
      capacity: rules.capacity,
      location:
        rec.location != null
          ? String(rec.location)
          : prev?.location,
      room:
        rec.room !== undefined
          ? rec.room
            ? String(rec.room)
            : null
          : prev?.room ?? (rec.location != null ? String(rec.location) : null),
      agreed_rate_zar:
        rec.agreed_rate_zar !== undefined
          ? rec.agreed_rate_zar == null || rec.agreed_rate_zar === ''
            ? null
            : Number(rec.agreed_rate_zar)
          : prev?.agreed_rate_zar ?? null,
      status: (rec.status as FitSession['status']) || prev?.status || 'scheduled',
      public: rules.public,
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
      programme_id:
        rec.programme_id !== undefined
          ? rec.programme_id
            ? String(rec.programme_id)
            : null
          : prev?.programme_id ?? null,
      created_at: prev?.created_at || now,
    };
    if (i >= 0) store.sessions[i] = row;
    else store.sessions.push(row);
    if (!row.session_kind || row.session_kind === 'class') {
      stampCatalogSeriesAndBookSubscribers(store, [row], now);
    }
    const ptClientIds = parseFitClientIds(rec.client_ids, rec.client_id);
    if (resolved.kind === 'private_pt' && ptClientIds.length) {
      const rateRaw = rec.agreed_rate_zar;
      applyPrivatePtBookings(store, {
        sessionIds: [row.id],
        clientIds: ptClientIds,
        now,
        rateZar:
          rateRaw == null || rateRaw === '' ? null : Number(rateRaw),
      });
    }
  } else if (entity === 'bookings') {
    const sessionId = String(rec.session_id || '');
    const clientId = String(rec.client_id || '');
    const famKey =
      rec.family_member_id != null ? String(rec.family_member_id) : '';
    const byId = rec.id
      ? store.bookings.find((b) => b.id === String(rec.id))
      : undefined;
    const seat =
      byId ||
      (sessionId && clientId
        ? store.bookings.find(
            (b) =>
              b.session_id === sessionId &&
              b.client_id === clientId &&
              String(b.family_member_id || '') === famKey &&
              b.status !== 'cancelled'
          ) ||
          store.bookings.find(
            (b) =>
              b.session_id === sessionId &&
              b.client_id === clientId &&
              String(b.family_member_id || '') === famKey
          )
        : undefined);
    const id = String(byId?.id || seat?.id || rec.id || newId('bkg'));
    const i = store.bookings.findIndex((b) => b.id === id);
    const status = (rec.status as FitBooking['status']) || 'booked';
    // capacity check for new bookings
    if (i < 0 && status === 'booked') {
      const session = store.sessions.find((s) => s.id === sessionId);
      const cap = session?.capacity ?? 999;
      const count = sessionBookingCount(store, sessionId);
      // Family attendee resolution
      let famIdCap =
        rec.family_member_id != null ? String(rec.family_member_id) : null;
      let famNameCap: string | undefined;
      if (famIdCap) {
        const client = store.clients.find(
          (c) => c.id === String(rec.client_id || '')
        );
        const fam = resolveFamilyAttendee(client?.family, famIdCap);
        if (fam) famNameCap = fam.label;
        else famIdCap = null;
      }
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
          family_member_id: famIdCap,
          family_member_name: famNameCap || null,
          notes: rec.notes != null ? String(rec.notes) : 'Auto waitlist — full',
        };
        store.bookings.push(row);
        return;
      }
    }
    const prev = i >= 0 ? store.bookings[i] : null;
    let famId =
      rec.family_member_id !== undefined
        ? rec.family_member_id
          ? String(rec.family_member_id)
          : null
        : prev?.family_member_id ?? null;
    let famName = prev?.family_member_name ?? null;
    if (rec.family_member_id !== undefined) {
      const client = store.clients.find(
        (c) => c.id === String(rec.client_id || prev?.client_id || '')
      );
      const fam = resolveFamilyAttendee(client?.family, famId);
      famName = fam?.label || null;
      if (!fam) famId = null;
    }
    let noteOut =
      rec.notes != null ? String(rec.notes) : prev?.notes;
    // Soft-block check for new bookings
    if (i < 0 && status === 'booked') {
      const client = store.clients.find(
        (c) => c.id === String(rec.client_id || '')
      );
      if (client?.booking_soft_block && rec.force !== true) {
        noteOut = [noteOut, 'Soft-block: high no-show history']
          .filter(Boolean)
          .join(' · ');
      }
    }
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
      notes: noteOut,
      family_member_id: famId,
      family_member_name: famName,
      reminded_at: prev?.reminded_at ?? null,
      reminder_count: prev?.reminder_count,
      waitlist_offered_at: prev?.waitlist_offered_at ?? null,
      waitlist_accepted_at: prev?.waitlist_accepted_at ?? null,
      updated_at: now,
      feedback_token: prev?.feedback_token ?? null,
      feedback_requested_at: prev?.feedback_requested_at ?? null,
      feedback_submitted_at: prev?.feedback_submitted_at ?? null,
      feedback_id: prev?.feedback_id ?? null,
      coach_feedback: prev?.coach_feedback ?? null,
      coach_feedback_at: prev?.coach_feedback_at ?? null,
    };
    // Status transition: cancel → promote waitlist
    if (
      prev &&
      prev.status !== 'cancelled' &&
      status === 'cancelled' &&
      row.session_id
    ) {
      promoteNextWaitlist(
        store.bookings,
        (b) => b.session_id === row.session_id && b.id !== row.id,
        now
      );
    }
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
  } else if (entity === 'movements') {
    if (!store.movements) store.movements = [];
    upsertMovement(store.movements, rec, now, newId);
  } else if (entity === 'programmes') {
    if (!store.programmes) store.programmes = [];
    upsertProgramme(store.programmes, rec, now, newId);
  } else if (entity === 'programme_enrollments') {
    if (!store.programme_enrollments) store.programme_enrollments = [];
    enrollClientOnProgramme(store.programme_enrollments, rec, now, newId);
  } else if (entity === 'programme_logs') {
    if (!store.programme_logs) store.programme_logs = [];
    upsertProgrammeLog(store.programme_logs, rec, now, newId);
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
      embed_primary_color: '#E8E830',
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
    programmes: [buildDemoShopProgramme(now, c1)],
    updated_at: now,
  };
}
