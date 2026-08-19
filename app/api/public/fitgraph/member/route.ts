/**
 * Member / client portal API (token auth).
 * GET  ?token=  — open class vacancies + my bookings
 * POST { token, action: book | request_join | cancel | rsvp | update_profile }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  FITGRAPH_CLIENT_TOKENS_KEY,
  buildMemberPortalPayload as buildMemberPortalPayloadBase,
  classTypeById,
  evaluateMemberAccess,
  newId,
  parseCompanyIdFromToken,
  readFitgraphFromMetadata,
  recordMemberCheckIn,
  sessionBookingCount,
  sessionKindOf,
  writeFitgraphToMetadata,
  type FitBooking,
  type FitClient,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';
import { applyMemberClassRsvp } from '@/lib/fitness/member-class-rsvp';
import { notifyPatientBookingPush } from '@/lib/b2c/member-push';
import { portalInvoicesForPerson } from '@/lib/b2c/member-account-portal';
import {
  applyCompanyLogoToSettings,
  pickCompanyLogoUrl,
} from '@/lib/business/company-logo';
import { verifyPaystackTransaction } from '@/lib/billing/paystack';
import {
  isAdvisorPayoutReady,
  readAdvisorPayout,
} from '@/lib/billing/advisor-payout';
import {
  applyPaidGymSale,
  clientHasPaidAccess,
  findGymSaleByRef,
  gymRequiresPaidMembership,
  gymShopCatalog,
} from '@/lib/fitness/gym-shop';
import {
  parseGymSaleKind,
  startGymShopCheckout,
} from '@/lib/fitness/gym-sale-checkout';
import { applyGymSalePaystack } from '@/lib/b2c/gym-sale-apply-paystack';
import {
  activeClassSubscriptions,
  buildClassSubscriptionReport,
  memberMayBookSession,
  persistVukaCatalogIfNeeded,
  storeUsesClassSubscribe,
  VUKA_JOINING,
} from '@/lib/fitness/vuka-class-catalog';
import {
  applyMemberDebitBank,
  gymCollectsDebitBank,
  gymRequiresDebitBank,
  memberDebitBankPublic,
} from '@/lib/fitness/member-debit-bank';
import {
  applyGoalToStore,
  createMemberGoal,
  logGoalActual,
  memberFacingGoals,
} from '@/lib/fitness/member-goals';
import {
  applyWatchSessionToStore,
  ensureGarminAccess,
  garminActivityToWatchInput,
  garminConfigured,
  garminRedirectUri,
  matchWatchToSession,
  newPkcePair,
  pullGarminActivities,
  publicWearableStatus,
  GARMIN_AUTHORIZE_URL,
} from '@/lib/fitness/wearables';

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
    .select('id, metadata, logo_url')
    .eq('id', companyId)
    .maybeSingle();
  if (!prof) return null;

  const meta =
    prof.metadata && typeof prof.metadata === 'object'
      ? { ...(prof.metadata as Record<string, unknown>) }
      : {};
  let store = readFitgraphFromMetadata(meta);
  applyCompanyLogoToSettings(store, pickCompanyLogoUrl(prof));
  store = await persistVukaCatalogIfNeeded(Number(prof.id), store, (s) =>
    saveStore(Number(prof.id), meta, s)
  );
  const client = store.clients.find((c) => c.portal_token === clean);
  if (!client || client.active === false) return null;

  return { companyId: Number(prof.id), meta, store, client };
}

function decorateMemberPortal(
  store: FitgraphStore,
  client: FitClient,
  portal: ReturnType<typeof buildMemberPortalPayloadBase>,
  meta: Record<string, unknown>
) {
  const mySubs = activeClassSubscriptions(store, client.id).map((x) => ({
    id: x.sub.id,
    plan_id: x.plan.id,
    plan_name: x.plan.name,
    price_zar: x.plan.price_zar,
    billing: x.plan.billing,
    schedule_label: x.plan.schedule_label,
    addon: x.plan.addon === true,
    status: x.sub.status,
    current_period_end: x.sub.current_period_end || null,
  }));
  const open_classes = (portal.open_classes || []).map((c) => {
    const session = store.sessions.find((s) => s.id === c.id);
    const gate = session
      ? memberMayBookSession(store, client, session)
      : { ok: true as const };
    return {
      ...c,
      can_book: gate.ok,
      need_plan: gate.need_plan === true,
      need_debit_bank: gate.need_debit_bank === true,
      book_hint: gate.ok ? null : gate.error || null,
    };
  });
  return {
    ...portal,
    open_classes,
    vacancies: open_classes.filter((c) => !c.full && !c.my_status),
    shop: gymShopCatalog(store),
    require_paid_membership: gymRequiresPaidMembership(store),
    paid_access: clientHasPaidAccess(store, client),
    payout_ready: isAdvisorPayoutReady(readAdvisorPayout(meta)),
    subscriptions: mySubs,
    class_report: buildClassSubscriptionReport(store, {
      clientId: client.id,
      from: portal.from,
      to: portal.to,
    }),
    joining:
      store.settings?.joining_fee_zar != null
        ? {
            fee_zar: store.settings.joining_fee_zar,
            waived: store.settings.joining_fee_waived !== false,
            note: store.settings.joining_fee_note || VUKA_JOINING.note,
          }
        : null,
    class_subscribe: storeUsesClassSubscribe(store),
    collect_debit_bank: gymCollectsDebitBank(store),
    require_debit_bank: gymRequiresDebitBank(store),
    bank: gymCollectsDebitBank(store)
      ? memberDebitBankPublic(client)
      : null,
    invoices: portalInvoicesForPerson(meta, {
      kind: 'gym',
      refId: client.id,
      email: client.email,
      userId: client.platform_user_id,
    }),
    goals: memberFacingGoals(store, client.id),
    wearable: publicWearableStatus(client),
    watch_sessions: (store.watch_sessions || [])
      .filter((w) => w.client_id === client.id)
      .slice(0, 12)
      .map((w) => ({
        id: w.id,
        booking_id: w.booking_id || null,
        session_id: w.session_id || null,
        source: w.source,
        started_at: w.started_at,
        duration_min: w.duration_min ?? null,
        distance_km: w.distance_km ?? null,
        calories: w.calories ?? null,
        avg_hr: w.avg_hr ?? null,
        activity_type: w.activity_type || null,
      })),
    diary_open: store.settings?.share_member_calendar !== false,
  };
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

    try {
      const { maybeHydratePortalPerson } = await import(
        '@/lib/b2c/wallet-household'
      );
      const hydrated = await maybeHydratePortalPerson(
        request,
        resolved.client
      );
      if (hydrated.changed) {
        const ci = resolved.store.clients.findIndex(
          (c) => c.id === resolved.client.id
        );
        if (ci >= 0) {
          resolved.store.clients[ci] = hydrated.person;
          await saveStore(resolved.companyId, resolved.meta, resolved.store);
        }
        resolved.client = hydrated.person;
      }
    } catch {
      /* wallet hydrate is best-effort */
    }

    const { ensureClientRatingTokens } = await import(
      '@/lib/services/booking-feedback'
    );
    const ratingDirty = ensureClientRatingTokens(
      resolved.store.bookings,
      (b) => {
        const s = resolved.store.sessions.find((x) => x.id === b.session_id);
        return s ? { date: s.date, start_time: s.start_time } : null;
      }
    );
    if (ratingDirty) {
      await saveStore(resolved.companyId, resolved.meta, resolved.store);
    }

    const portal = decorateMemberPortal(
      resolved.store,
      resolved.client,
      buildMemberPortalPayloadBase(
        resolved.store,
        resolved.client,
        from,
        to
      ),
      resolved.meta
    );

    return NextResponse.json({
      success: true,
      portal,
      companyId: resolved.companyId,
      platform_user_linked: Boolean(resolved.client.platform_user_id),
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

    if (action === 'checkout' || action === 'buy') {
      const started = await startGymShopCheckout({
        store,
        meta,
        companyId,
        token,
        kind: parseGymSaleKind(body.kind),
        itemId: String(body.plan_id || body.programme_id || body.item_id || ''),
        name: String(body.name || client.name || '').trim(),
        email: String(body.email || client.email || '').trim().toLowerCase(),
        phone: body.phone
          ? String(body.phone)
          : client.phone || null,
        sessionId: body.session_id ? String(body.session_id) : null,
        clientId: client.id,
        callbackPath: `/member/fitgraph/${encodeURIComponent(token)}`,
      });
      if (!started.ok) {
        return NextResponse.json(
          { error: started.error },
          { status: started.status }
        );
      }
      await saveStore(companyId, meta, started.store);
      return NextResponse.json({
        success: true,
        authorization_url: started.authorizationUrl,
        access_code: started.accessCode,
        reference: started.reference,
        amount_zar: started.amount_zar,
        item: started.item,
      });
    }

    if (action === 'verify_sale' || action === 'verify') {
      const reference = String(body.reference || '').trim();
      if (!reference) {
        return NextResponse.json({ error: 'reference required' }, { status: 400 });
      }
      const v = await verifyPaystackTransaction(reference);
      if (!v.ok) {
        return NextResponse.json({ error: v.error }, { status: 400 });
      }
      const applied = await applyGymSalePaystack({
        data: { reference, metadata: v.metadata || { company_id: companyId } },
        reference,
      });
      if (!applied.ok) {
        const local = findGymSaleByRef(store, reference);
        if (local && local.status !== 'paid') {
          const paid = applyPaidGymSale(store, local, { companyId });
          await saveStore(companyId, meta, paid.store);
          const nextClient =
            paid.store.clients.find((c) => c.id === client.id) || paid.client;
          return NextResponse.json({
            success: true,
            sale: paid.sale,
            portal: {
              ...buildMemberPortalPayloadBase(paid.store, nextClient),
              shop: gymShopCatalog(paid.store),
              require_paid_membership: gymRequiresPaidMembership(paid.store),
              paid_access: clientHasPaidAccess(paid.store, nextClient),
            },
            message: 'Payment recorded — membership is active',
          });
        }
        return NextResponse.json({ error: applied.error }, { status: 400 });
      }
      const { loadWalletCompany } = await import('@/lib/b2c/load-company');
      const freshMeta = (await loadWalletCompany(companyId))?.meta || meta;
      const fresh = readFitgraphFromMetadata(freshMeta);
      const nextClient =
        fresh.clients.find((c) => c.id === client.id) ||
        fresh.clients.find((c) => c.id === applied.clientId) ||
        client;
      return NextResponse.json({
        success: true,
        sale: findGymSaleByRef(fresh, reference),
        portal: {
          ...buildMemberPortalPayloadBase(fresh, nextClient),
          shop: gymShopCatalog(fresh),
          require_paid_membership: gymRequiresPaidMembership(fresh),
          paid_access: clientHasPaidAccess(fresh, nextClient),
        },
        message: 'Payment recorded — membership is active',
      });
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
        portal: buildMemberPortalPayloadBase(store, store.clients[ci]),
      });
    }

    if (action === 'update_profile' || action === 'link_platform_user') {
      const c = store.clients[ci];
      if (action === 'link_platform_user' || body.platform_user_id || body.userId) {
        const { linkPlatformUserId } = await import(
          '@/lib/messaging/link-platform-user'
        );
        try {
          const { requireVerifiedUser, legacyPrivyFrom } = await import(
            '@/lib/auth/api-auth'
          );
          const gate = await requireVerifiedUser(request, {
            legacyPrivyUserId: legacyPrivyFrom(request, body),
          });
          if (gate.ok) linkPlatformUserId(c, gate.userId);
          else
            linkPlatformUserId(
              c,
              body.platform_user_id || body.userId || body.privyUserId
            );
        } catch {
          linkPlatformUserId(
            c,
            body.platform_user_id || body.userId || body.privyUserId
          );
        }
      }
      if (action === 'link_platform_user') {
        store.clients[ci] = c;
        await saveStore(companyId, meta, store);
        return NextResponse.json({
          success: true,
          platform_user_id: c.platform_user_id || null,
          portal: buildMemberPortalPayloadBase(store, c),
          message: c.platform_user_id
            ? 'Linked to your SupplierAdvisor account — messages deliver in-app'
            : 'Could not link system user',
        });
      }
      const { applyPortalProfileUpdate, portalProfileSaveMessage } = await import(
        '@/lib/services/portal-profile'
      );
      const result = applyPortalProfileUpdate(c, body, {
        storeIdOnRoot: true,
        now,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      if (body.debit_bank !== undefined) {
        const bank = applyMemberDebitBank(c, body.debit_bank, now);
        if (!bank.ok) {
          return NextResponse.json({ error: bank.error }, { status: 400 });
        }
      }
      store.clients[ci] = c;
      await saveStore(companyId, meta, store);
      try {
        const { writeThroughPortalIdentity } = await import(
          '@/lib/b2c/wallet-household'
        );
        await writeThroughPortalIdentity(c);
      } catch {
        /* wallet write-through is best-effort */
      }
      return NextResponse.json({
        success: true,
        portal: buildMemberPortalPayloadBase(store, c),
        message: portalProfileSaveMessage(result, body, 'gym records'),
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
      try {
        const { writeThroughFamilyUpsert } = await import(
          '@/lib/b2c/wallet-household'
        );
        await writeThroughFamilyUpsert(c, member);
      } catch {
        /* wallet write-through is best-effort */
      }
      return NextResponse.json({
        success: true,
        member,
        portal: buildMemberPortalPayloadBase(store, c),
        message: patch.id
          ? 'Family member updated'
          : 'Family member added — saved on your wallet and this gym',
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
      try {
        const { writeThroughFamilyRemove } = await import(
          '@/lib/b2c/wallet-household'
        );
        await writeThroughFamilyRemove(c, famId);
      } catch {
        /* wallet write-through is best-effort */
      }
      return NextResponse.json({
        success: true,
        portal: buildMemberPortalPayloadBase(store, c),
        message: 'Family member removed',
      });
    }

    /**
     * Phone check-in — member already on portal (PWA). Optionally verify gym QR
     * token matches this company's public_token (physical presence).
     */
    if (action === 'checkin' || action === 'check_in') {
      const gymToken = String(
        body.gym_token || body.public_token || body.scan_token || ''
      ).trim();
      if (gymToken) {
        const expected = store.settings?.public_token || '';
        if (!expected || gymToken !== expected) {
          return NextResponse.json(
            {
              error:
                'This QR is not for your gym. Scan the check-in code at reception.',
            },
            { status: 400 }
          );
        }
      }
      const result = recordMemberCheckIn(store, store.clients[ci], {
        method: gymToken ? 'qr_phone' : 'app',
        session_id: body.session_id || null,
        notes: body.notes ? String(body.notes) : undefined,
      });
      await saveStore(companyId, meta, result.store);
      return NextResponse.json({
        success: true,
        denied: result.denied,
        duplicate: result.duplicate,
        check_in: result.check_in,
        access: result.access,
        portal: buildMemberPortalPayloadBase(
          result.store,
          result.store.clients[ci]
        ),
        message: result.duplicate
          ? 'Already checked in recently.'
          : result.access.member_message,
        owner_alert: result.access.alert,
      });
    }

    if (
      action === 'cancel' ||
      action === 'cancel_booking' ||
      action === 'rsvp'
    ) {
      const bookingId = String(body.booking_id || body.bookingId || '');
      const coming =
        action === 'rsvp'
          ? body.coming === true ||
            body.rsvp === 'coming' ||
            body.rsvp === true
          : false;
      const result = applyMemberClassRsvp(store, {
        bookingId,
        clientId: client.id,
        coming,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        portal: buildMemberPortalPayloadBase(store, store.clients[ci]),
        promoted: result.promoted
          ? { booking_id: result.promoted.id, client_id: result.promoted.client_id }
          : null,
        message: coming
          ? result.booking.status === 'waitlist'
            ? 'You’re on the waitlist — we’ll notify you if a spot opens'
            : 'You’re marked as coming'
          : result.promoted
            ? 'Can’t make it — your spot was offered to the waitlist'
            : 'Can’t make it — your spot is free',
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

      if (
        gymRequiresPaidMembership(store) &&
        !clientHasPaidAccess(store, store.clients[ci])
      ) {
        return NextResponse.json(
          {
            error:
              'Buy a membership first — payment is required before class booking',
            need_membership: true,
            shop: gymShopCatalog(store),
          },
          { status: 402 }
        );
      }

      // Soft gate: frozen / cancelled / expired membership cannot book
      {
        const access = evaluateMemberAccess(store, store.clients[ci]);
        if (access.level === 'blocked') {
          return NextResponse.json(
            {
              error: access.member_message,
              access,
            },
            { status: 403 }
          );
        }
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
      if (sessionKindOf(store, session) === 'coach_personal') {
        return NextResponse.json(
          { error: 'Coach personal time cannot be booked by members' },
          { status: 400 }
        );
      }

      const classGate = memberMayBookSession(store, store.clients[ci], session);
      if (!classGate.ok) {
        return NextResponse.json(
          {
            error: classGate.error,
            need_membership: classGate.need_plan === true,
            shop: gymShopCatalog(store),
          },
          { status: classGate.need_plan ? 402 : 400 }
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
      await notifyPatientBookingPush({
        platformUserId: client.platform_user_id,
        brand: store.settings?.brand_name,
        title: ct?.name || 'Class',
        date: session.date,
        start_time: session.start_time,
        status: row.status,
        portalPath: client.portal_token
          ? `/member/fitgraph/${client.portal_token}`
          : '/me',
      });

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
        portal: buildMemberPortalPayloadBase(store, store.clients[ci]),
      });
    }

    if (action === 'upsert_goal' || action === 'save_goal') {
      const title = String(body.title || '').trim();
      const kind = String(body.kind || 'custom');
      if (!title && kind === 'custom') {
        return NextResponse.json({ error: 'Give the goal a name' }, { status: 400 });
      }
      const existingId = String(body.goal_id || body.id || '');
      const prev = existingId
        ? (store.goals || []).find(
            (g) => g.id === existingId && g.client_id === client.id
          )
        : null;
      const startVal =
        body.start_value != null && String(body.start_value) !== ''
          ? Number(body.start_value)
          : prev?.start_value ?? null;
      const targetVal =
        body.target_value != null && String(body.target_value) !== ''
          ? Number(body.target_value)
          : prev?.target_value ?? null;
      let goal = prev
        ? {
            ...prev,
            title: title || prev.title,
            kind: kind || prev.kind,
            description:
              body.description != null ? String(body.description) : prev.description,
            unit:
              body.unit != null ? String(body.unit) || null : prev.unit,
            start_value: Number.isFinite(Number(startVal)) ? Number(startVal) : prev.start_value,
            target_value: Number.isFinite(Number(targetVal))
              ? Number(targetVal)
              : prev.target_value,
            target_date:
              body.target_date != null
                ? String(body.target_date).slice(0, 10) || null
                : prev.target_date,
            direction:
              body.direction === 'increase' || body.direction === 'decrease'
                ? body.direction
                : prev.direction,
            updated_at: now,
          }
        : createMemberGoal({
            client_id: client.id,
            coach_id: client.coach_id,
            kind,
            title,
            description: body.description != null ? String(body.description) : undefined,
            unit: body.unit != null ? String(body.unit) : undefined,
            start_value: Number.isFinite(Number(startVal)) ? Number(startVal) : null,
            target_value: Number.isFinite(Number(targetVal)) ? Number(targetVal) : null,
            target_date: body.target_date
              ? String(body.target_date).slice(0, 10)
              : null,
            direction:
              body.direction === 'increase' ? 'increase' : undefined,
            created_by_role: 'member',
            nowIso: now,
          });
      if (body.status === 'paused' || body.status === 'abandoned' || body.status === 'active') {
        goal = { ...goal, status: body.status };
      }
      applyGoalToStore(store, goal, prev ? `Updated goal · ${goal.title}` : `Goal set · ${goal.title}`);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        goal,
        portal: decorateMemberPortal(
          store,
          store.clients[ci],
          buildMemberPortalPayloadBase(store, store.clients[ci]),
          meta
        ),
        message: prev ? 'Goal updated' : 'Goal saved',
      });
    }

    if (action === 'log_goal' || action === 'goal_actual') {
      const goalId = String(body.goal_id || '');
      const value = Number(body.value ?? body.actual);
      if (!Number.isFinite(value)) {
        return NextResponse.json({ error: 'Enter an actual number' }, { status: 400 });
      }
      const prev = (store.goals || []).find(
        (g) => g.id === goalId && g.client_id === client.id
      );
      if (!prev) {
        return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
      }
      const next = logGoalActual(prev, value, {
        note: body.note != null ? String(body.note) : undefined,
        by_role: 'member',
        by_id: client.id,
        source: body.source != null ? String(body.source) : 'manual',
        nowIso: now,
      });
      applyGoalToStore(store, next);
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        goal: next,
        portal: decorateMemberPortal(
          store,
          store.clients[ci],
          buildMemberPortalPayloadBase(store, store.clients[ci]),
          meta
        ),
        message:
          next.status === 'achieved' ? 'Goal hit — well done' : 'Actual saved',
      });
    }

    if (action === 'watch_log') {
      const startedAt = String(body.started_at || now);
      let sessionId = body.session_id ? String(body.session_id) : null;
      let bookingId = body.booking_id ? String(body.booking_id) : null;
      if (bookingId) {
        const b = store.bookings.find(
          (x) => x.id === bookingId && x.client_id === client.id
        );
        if (b) sessionId = b.session_id;
      }
      if (!sessionId) {
        const matched = matchWatchToSession(
          store,
          client.id,
          startedAt,
          body.duration_min != null ? Number(body.duration_min) : null
        );
        sessionId = matched.session_id;
        bookingId = bookingId || matched.booking_id;
      }
      const source = String(body.source || 'manual');
      applyWatchSessionToStore(store, {
        client_id: client.id,
        booking_id: bookingId,
        session_id: sessionId,
        source:
          source === 'garmin' ||
          source === 'apple_watch' ||
          source === 'wear_os'
            ? source
            : 'manual',
        started_at: startedAt,
        duration_min:
          body.duration_min != null && String(body.duration_min).trim() !== ''
            ? Number(body.duration_min)
            : null,
        distance_km:
          body.distance_km != null && String(body.distance_km).trim() !== ''
            ? Number(body.distance_km)
            : null,
        calories:
          body.calories != null && String(body.calories).trim() !== ''
            ? Number(body.calories)
            : null,
        avg_hr:
          body.avg_hr != null && String(body.avg_hr).trim() !== ''
            ? Number(body.avg_hr)
            : null,
        max_hr:
          body.max_hr != null && String(body.max_hr).trim() !== ''
            ? Number(body.max_hr)
            : null,
        activity_type: body.activity_type
          ? String(body.activity_type)
          : null,
      });
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        portal: decorateMemberPortal(
          store,
          store.clients[ci],
          buildMemberPortalPayloadBase(store, store.clients[ci]),
          meta
        ),
        message: 'Watch session saved',
      });
    }

    if (action === 'garmin_start') {
      if (!garminConfigured()) {
        return NextResponse.json(
          {
            error:
              'Garmin Connect is not enabled for this gym yet. You can still log Apple Watch / Garmin stats after class.',
            garmin_available: false,
          },
          { status: 400 }
        );
      }
      const origin = request.headers.get('origin') || undefined;
      const redirectUri = garminRedirectUri(origin || undefined);
      const pkce = newPkcePair();
      const state = `gmn.${companyId}.${client.id}.${Date.now().toString(36)}`;
      store.garmin_oauth_pending = [
        {
          state,
          client_id: client.id,
          portal_token: token,
          code_verifier: pkce.verifier,
          created_at: now,
        },
        ...(store.garmin_oauth_pending || []).filter(
          (p) => Date.now() - new Date(p.created_at).getTime() < 30 * 60 * 1000
        ),
      ].slice(0, 20);
      await saveStore(companyId, meta, store);
      const url = new URL(GARMIN_AUTHORIZE_URL);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', String(process.env.GARMIN_CLIENT_ID));
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('state', state);
      url.searchParams.set('code_challenge', pkce.challenge);
      url.searchParams.set('code_challenge_method', 'S256');
      return NextResponse.json({
        success: true,
        authorize_url: url.toString(),
      });
    }

    if (action === 'garmin_import' || action === 'watch_import') {
      const garmin = store.clients[ci].wearable?.garmin;
      if (!garmin?.connected || !garmin.access_token) {
        return NextResponse.json(
          {
            error: 'Connect Garmin first, or log the session from your watch.',
            need_connect: true,
          },
          { status: 400 }
        );
      }
      const origin = request.headers.get('origin') || undefined;
      const redirectUri = garminRedirectUri(origin);
      const fresh = await ensureGarminAccess(garmin, redirectUri);
      store.clients[ci] = {
        ...store.clients[ci],
        wearable: { ...(store.clients[ci].wearable || {}), garmin: fresh },
      };
      const to = Math.floor(Date.now() / 1000);
      const from = to - 36 * 3600;
      const activities = await pullGarminActivities(
        String(fresh.access_token),
        from,
        to
      );
      let imported = 0;
      for (const act of activities) {
        const input = garminActivityToWatchInput(client.id, act);
        if (!input) continue;
        const matched = matchWatchToSession(
          store,
          client.id,
          input.started_at,
          input.duration_min
        );
        applyWatchSessionToStore(store, {
          ...input,
          session_id: matched.session_id,
          booking_id: matched.booking_id,
        });
        imported += 1;
      }
      store.clients[ci] = {
        ...store.clients[ci],
        wearable: {
          ...(store.clients[ci].wearable || {}),
          garmin: { ...fresh, last_sync_at: now },
        },
      };
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        imported,
        portal: decorateMemberPortal(
          store,
          store.clients[ci],
          buildMemberPortalPayloadBase(store, store.clients[ci]),
          meta
        ),
        message:
          imported > 0
            ? `Imported ${imported} Garmin activit${imported === 1 ? 'y' : 'ies'}`
            : 'No new Garmin activities in the last day',
      });
    }

    if (action === 'garmin_disconnect') {
      store.clients[ci] = {
        ...store.clients[ci],
        wearable: { ...(store.clients[ci].wearable || {}), garmin: null },
      };
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        portal: decorateMemberPortal(
          store,
          store.clients[ci],
          buildMemberPortalPayloadBase(store, store.clients[ci]),
          meta
        ),
        message: 'Garmin disconnected',
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
        portal: buildMemberPortalPayloadBase(store, store.clients[ci]),
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
