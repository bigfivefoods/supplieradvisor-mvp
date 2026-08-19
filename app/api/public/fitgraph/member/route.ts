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
        message: result.emailChanged
          ? 'Profile updated — email synced to your wallet and gym records'
          : 'Profile updated on your wallet',
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
        portal: buildMemberPortalPayloadBase(store, store.clients[ci]),
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
