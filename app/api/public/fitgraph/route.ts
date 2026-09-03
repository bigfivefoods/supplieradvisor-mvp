/**
 * Public GymAdvisor calendar + booking (website embed).
 * GET  ?token=  — public calendar payload (no auth)
 * POST { token, action: 'book', session_id, name, email?, phone? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { isStaleModuleStoreError } from '@/lib/business/company-data';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { verifyPaystackTransaction } from '@/lib/billing/paystack';
import {
  isAdvisorCardPayReady,
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
  FITGRAPH_PUBLIC_TOKEN_KEY,
  buildClassJoinPayload,
  buildGoogleCalendarUrl,
  buildPublicCalendarPayload,
  buildSessionIcs,
  ensureClientPortalToken,
  newId,
  parseCompanyIdFromToken,
  readFitgraphFromMetadata,
  sessionBookingCount,
  sessionByShareCode,
  sessionKindOf,
  upsertClassFeedback,
  FITGRAPH_META_KEY,
  type FitBooking,
  type FitClient,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';
import { saveFitgraphPatch } from '@/lib/fitness/fitgraph-io';
import { loadAdvisorStoreForPublicToken } from '@/lib/business/advisor-store-resolve';
import { memberMayBookSession } from '@/lib/fitness/vuka-class-catalog';
import {
  gymJoinMemberPath,
  isComplimentaryClassInvite,
} from '@/lib/fitness/gym-grow-share';
import {
  newDeskNotice,
  pushDeskNotice,
} from '@/lib/services/advisor-member-calendar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function resolveByToken(
  token: string,
  fresh = false
): Promise<{ companyId: number; meta: Record<string, unknown>; store: FitgraphStore } | null> {
  const clean = token.trim();
  if (!clean || clean.length < 8) return null;
  const loaded = await loadAdvisorStoreForPublicToken({
    token: clean,
    moduleKey: FITGRAPH_META_KEY,
    read: readFitgraphFromMetadata,
    parseCompanyId: parseCompanyIdFromToken,
    indexKeys: [FITGRAPH_PUBLIC_TOKEN_KEY],
    fresh,
  });
  if (!loaded) return null;
  // Accept token even if website toggle is off — join links still work
  if (loaded.store.settings?.public_token !== clean) return null;
  return loaded;
}

async function saveStore<K extends keyof FitgraphStore>(
  companyId: number,
  meta: Record<string, unknown>,
  store: FitgraphStore,
  ...keys: K[]
): Promise<string> {
  const patch = {} as Pick<FitgraphStore, K>;
  for (const key of keys) {
    patch[key] = store[key] as Pick<FitgraphStore, K>[K];
  }
  const ifUpdatedAtRaw = meta.__if_updated_at;
  const ifUpdatedAt =
    typeof ifUpdatedAtRaw === 'string' && ifUpdatedAtRaw.trim()
      ? ifUpdatedAtRaw.trim()
      : null;
  const updatedAt = await saveFitgraphPatch(companyId, patch, { ifUpdatedAt });
  store.updated_at = updatedAt;
  return updatedAt;
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

    const { listGymInventoryShop, mergeGymShopWithInventory } = await import(
      '@/lib/fitness/gym-inventory-shop'
    );
    const inventory = await listGymInventoryShop(resolved.companyId);

    return NextResponse.json(
      {
        success: true,
        calendar,
        shop: mergeGymShopWithInventory(
          gymShopCatalog(resolved.store),
          inventory
        ),
        payout_ready: isAdvisorCardPayReady(readAdvisorPayout(resolved.meta)),
        companyId: resolved.companyId,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=15, stale-while-revalidate=60',
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

    const resolved = await resolveByToken(token, true);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Calendar not found or not published' },
        { status: 404 }
      );
    }

    const { companyId, meta } = resolved;
    let store = resolved.store;
    const payloadUpdatedAt =
      typeof body.updated_at === 'string' && body.updated_at.trim()
        ? body.updated_at.trim()
        : typeof body.if_updated_at === 'string' && body.if_updated_at.trim()
          ? body.if_updated_at.trim()
          : null;
    if (payloadUpdatedAt) {
      meta.__if_updated_at = payloadUpdatedAt;
    }

    if (action === 'onboard_member' || action === 'onboard_contract') {
      const { applyContractToClient } = await import(
        '@/lib/fitness/member-contract'
      );
      const { appendJoinEvent } = await import('@/lib/fitness/member-profile');
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const phone = String(body.phone || '').trim();
      const idNumber = String(body.id_number || '').replace(/\D/g, '');
      if (name.length < 2) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
      }
      if (!email.includes('@') && phone.replace(/\D/g, '').length < 7) {
        return NextResponse.json(
          { error: 'Email or mobile number is required' },
          { status: 400 }
        );
      }
      if (body.terms_accepted !== true || body.parq_accepted !== true) {
        return NextResponse.json(
          { error: 'Please accept the terms and the health questionnaire' },
          { status: 400 }
        );
      }
      const kindsRaw = Array.isArray(body.kinds)
        ? (body.kinds as unknown[]).map((k) => String(k || ''))
        : [String(body.kind || body.contract_kind || 'group')];
      const kinds = [
        ...new Set(
          kindsRaw.map((k) => (k === 'private' ? 'private' : 'group'))
        ),
      ] as Array<'group' | 'private'>;
      if (String(body.kind || '') === 'both') {
        kinds.length = 0;
        kinds.push('group', 'private');
      }
      const kind = kinds.includes('private') && !kinds.includes('group')
        ? 'private'
        : kinds[0] || 'group';
      const parqRaw =
        body.parq && typeof body.parq === 'object'
          ? (body.parq as Record<string, unknown>)
          : {};
      const now = new Date().toISOString();
      const sub = {
        kind,
        submitted_at: now.slice(0, 10),
        heard_about: body.heard_about ? String(body.heard_about) : null,
        name,
        id_number: idNumber || null,
        phone: phone || null,
        email: email || null,
        date_of_birth: body.date_of_birth
          ? String(body.date_of_birth).slice(0, 10)
          : null,
        start_date: body.start_date
          ? String(body.start_date).slice(0, 10)
          : now.slice(0, 10),
        occupation: body.occupation ? String(body.occupation) : null,
        employer_student_number: body.employer_student_number
          ? String(body.employer_student_number)
          : null,
        medical_aid: body.medical_aid ? String(body.medical_aid) : null,
        medical_aid_plan: body.medical_aid_plan
          ? String(body.medical_aid_plan)
          : null,
        emergency_contact: body.emergency_contact
          ? String(body.emergency_contact)
          : null,
        address: body.address ? String(body.address) : null,
        gp: body.gp ? String(body.gp) : null,
        parq: {
          heart_condition: parqRaw.heart_condition === true,
          chest_pain_activity: parqRaw.chest_pain_activity === true,
          chest_pain_rest: parqRaw.chest_pain_rest === true,
          dizziness_unconscious: parqRaw.dizziness_unconscious === true,
          taking_medication: parqRaw.taking_medication === true,
          other_reason: parqRaw.other_reason === true,
          pain_injuries: parqRaw.pain_injuries === true,
          surgeries_12m: parqRaw.surgeries_12m === true,
          chronic_disease: parqRaw.chronic_disease === true,
        },
        parq_explanation: body.parq_explanation
          ? String(body.parq_explanation)
          : null,
        terms_accepted: true,
        parq_accepted: true,
        class_option: body.class_option ? String(body.class_option) : null,
        class_amount_zar: body.class_amount_zar
          ? Number(body.class_amount_zar)
          : null,
        debit_amount_zar: body.debit_amount_zar
          ? Number(body.debit_amount_zar)
          : null,
        account_holder: body.account_holder ? String(body.account_holder) : null,
        account_type: body.account_type ? String(body.account_type) : null,
        account_number: body.account_number ? String(body.account_number) : null,
        bank_name: body.bank_name ? String(body.bank_name) : null,
        source: 'onboarding' as const,
        signature_name: body.signature_name ? String(body.signature_name) : name,
      };
      const existingClient = store.clients.find(
        (c) =>
          c.active !== false &&
          ((idNumber && c.id_number === idNumber) ||
            (email && c.email && c.email.toLowerCase() === email))
      );
      let client =
        existingClient ||
        ({
          id: newId('cli'),
          code: `M${Date.now().toString(36).slice(-5).toUpperCase()}`,
          name,
          membership_status: 'active',
          active: true,
          created_at: now,
          updated_at: now,
        } as FitClient);
      if (!existingClient) store.clients.push(client);
      for (const k of kinds.length ? kinds : [kind]) {
        client = applyContractToClient(client, { ...sub, kind: k }, now);
        if (body.signature_name) {
          const last = client.contracts?.[client.contracts.length - 1];
          if (last) last.signature_name = String(body.signature_name);
        }
        client.join_events = appendJoinEvent(client, {
          at: now,
          kind: 'joined_pwa',
          title:
            k === 'private'
              ? 'Private onboarding form submitted'
              : 'Group onboarding form submitted',
          source: 'pwa',
        });
      }
      const idx = store.clients.findIndex((c) => c.id === client.id);
      if (idx >= 0) store.clients[idx] = client;
      {
        const { attachCrmToAdvisorPerson } = await import(
          '@/lib/b2c/member-account-ar'
        );
        await attachCrmToAdvisorPerson({
          companyId,
          kind: 'gym',
          person: client,
        });
        const stampedIdx = store.clients.findIndex((c) => c.id === client.id);
        if (stampedIdx >= 0) store.clients[stampedIdx] = client;
      }
      store.desk_notices = pushDeskNotice(
        store.desk_notices,
        newDeskNotice({
          kind: 'member_joined',
          person_id: client.id,
          person_name: client.name,
          email: client.email || null,
          phone: client.phone || null,
          source: 'portal',
          note: kinds.includes('private') && kinds.includes('group')
            ? 'Member + private application'
            : kinds.includes('private')
              ? 'Private client application'
              : 'Member application',
        })
      );
      await saveStore(companyId, meta, store, 'clients', 'desk_notices');
      const portalToken = ensureClientPortalToken(client, companyId);
      // Re-save if token was just issued
      const latestIdx = store.clients.findIndex((c) => c.id === client.id);
      if (latestIdx >= 0) store.clients[latestIdx] = client;
      await saveStore(companyId, meta, store, 'clients');
      return NextResponse.json({
        success: true,
        portal_token: portalToken,
        portal_path: `/member/fitgraph/${encodeURIComponent(portalToken)}`,
        client_id: client.id,
      });
    }

    // ── Door auth: request_code ───────────────────────────────────────────
    if (action === 'request_code') {
      const {
        generateEmailCode,
        buildAuthCodePayload,
        findClientByEmail,
        findCoachByEmail,
      } = await import('@/lib/fitness/gym-door-auth');
      const email = String(body.email || '').trim().toLowerCase();
      const lane = String(body.lane || 'returning');
      if (!email.includes('@')) {
        return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
      }
      let person: { id: string; name: string; auth_code_hash?: string | null; auth_code_expires_at?: string | null } | null = null;
      let personKind: 'client' | 'coach' = 'client';
      if (lane === 'coach') {
        const coach = findCoachByEmail(store, email);
        if (!coach) {
          return NextResponse.json({ error: 'No active coach found for that email' }, { status: 404 });
        }
        person = coach;
        personKind = 'coach';
      } else {
        const client = findClientByEmail(store, email);
        if (!client) {
          return NextResponse.json({ error: 'No active member found for that email' }, { status: 404 });
        }
        person = client;
        personKind = 'client';
      }
      const code = generateEmailCode();
      const payload = buildAuthCodePayload(code);
      person.auth_code_hash = payload.code_hash;
      person.auth_code_expires_at = payload.expires_at;
      if (personKind === 'coach') {
        const idx = store.coaches.findIndex((c) => c.id === person!.id);
        if (idx >= 0) store.coaches[idx] = { ...store.coaches[idx], ...person };
      } else {
        const idx = store.clients.findIndex((c) => c.id === person!.id);
        if (idx >= 0) store.clients[idx] = { ...store.clients[idx], ...person };
      }
      await saveStore(companyId, meta, store, personKind === 'coach' ? 'coaches' : 'clients');
      // Send email via Resend
      try {
        const { getResend, getResendFrom } = await import('@/lib/resend');
        const resend = getResend();
        await resend.emails.send({
          from: getResendFrom(),
          to: email,
          subject: `Your ${store.settings?.brand_name || 'gym'} sign-in code`,
          text: `Your ${store.settings?.brand_name || 'gym'} sign-in code is: ${code}\n\nThis code expires in 10 minutes. Do not share it.`,
          html: `<p>Your <strong>${store.settings?.brand_name || 'gym'}</strong> sign-in code is:</p><p style="font-size:2em;letter-spacing:0.2em;font-weight:bold">${code}</p><p>This code expires in 10 minutes. Do not share it.</p>`,
        });
      } catch {
        // Best-effort: don't leak send errors to the client
      }
      return NextResponse.json({ success: true });
    }

    // ── Door auth: verify_code ────────────────────────────────────────────
    if (action === 'verify_code') {
      const { verifyAuthCode, findClientByEmail, findCoachByEmail } = await import('@/lib/fitness/gym-door-auth');
      const { ensureCoachPortalToken } = await import('@/lib/fitness/fitgraph');
      const email = String(body.email || '').trim().toLowerCase();
      const code = String(body.code || '').trim();
      const lane = String(body.lane || 'returning');
      if (!email.includes('@') || code.length !== 6) {
        return NextResponse.json({ error: 'Email and 6-digit code required' }, { status: 400 });
      }
      if (lane === 'coach') {
        const coach = findCoachByEmail(store, email);
        if (!coach) {
          return NextResponse.json({ error: 'No active coach found for that email' }, { status: 404 });
        }
        const ok = verifyAuthCode(
          { code_hash: coach.auth_code_hash ?? '', expires_at: coach.auth_code_expires_at ?? '' },
          code
        );
        if (!ok) {
          return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
        }
        // Invalidate code
        coach.auth_code_hash = null;
        coach.auth_code_expires_at = null;
        const portalToken = ensureCoachPortalToken(coach, companyId);
        const idx = store.coaches.findIndex((c) => c.id === coach.id);
        if (idx >= 0) store.coaches[idx] = coach;
        await saveStore(companyId, meta, store, 'coaches');
        return NextResponse.json({
          success: true,
          portal_token: portalToken,
          portal_path: `/coach/fitgraph/${encodeURIComponent(portalToken)}`,
          offer_pin: !coach.pin_hash,
        });
      } else {
        const client = findClientByEmail(store, email);
        if (!client) {
          return NextResponse.json({ error: 'No active member found for that email' }, { status: 404 });
        }
        const ok = verifyAuthCode(
          { code_hash: client.auth_code_hash ?? '', expires_at: client.auth_code_expires_at ?? '' },
          code
        );
        if (!ok) {
          return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
        }
        // Invalidate code
        client.auth_code_hash = null;
        client.auth_code_expires_at = null;
        const portalToken = ensureClientPortalToken(client, companyId);
        const idx = store.clients.findIndex((c) => c.id === client.id);
        if (idx >= 0) store.clients[idx] = client;
        await saveStore(companyId, meta, store, 'clients');
        return NextResponse.json({
          success: true,
          portal_token: portalToken,
          portal_path: `/member/fitgraph/${encodeURIComponent(portalToken)}`,
          offer_pin: !client.pin_hash,
        });
      }
    }

    // ── Door auth: set_pin ────────────────────────────────────────────────
    if (action === 'set_pin') {
      const { hashPin, isValidPin, findClientByEmail, findCoachByEmail } = await import('@/lib/fitness/gym-door-auth');
      const { clientMatchesPortalToken } = await import('@/lib/fitness/fitgraph');
      const email = String(body.email || '').trim().toLowerCase();
      const pin = String(body.pin || '').trim();
      const lane = String(body.lane || 'returning');
      const portalToken = String(body.portal_token || '').trim();
      if (!isValidPin(pin)) {
        return NextResponse.json({ error: 'PIN must be 4–6 digits' }, { status: 400 });
      }
      if (!portalToken) {
        return NextResponse.json({ error: 'portal_token required' }, { status: 401 });
      }
      if (lane === 'coach') {
        const coach = findCoachByEmail(store, email);
        if (!coach || String(coach.portal_token || '').trim() !== portalToken) {
          return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
        }
        coach.pin_hash = hashPin(pin);
        const idx = store.coaches.findIndex((c) => c.id === coach.id);
        if (idx >= 0) store.coaches[idx] = coach;
        await saveStore(companyId, meta, store, 'coaches');
      } else {
        const client = findClientByEmail(store, email);
        if (!client || !clientMatchesPortalToken(client, portalToken)) {
          return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
        }
        client.pin_hash = hashPin(pin);
        const idx = store.clients.findIndex((c) => c.id === client.id);
        if (idx >= 0) store.clients[idx] = client;
        await saveStore(companyId, meta, store, 'clients');
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'checkout' || action === 'buy') {
      const started = await startGymShopCheckout({
        store,
        meta,
        companyId,
        token,
        kind: parseGymSaleKind(body.kind),
        itemId: String(body.plan_id || body.programme_id || body.item_id || ''),
        name: String(body.name || '').trim(),
        email: String(body.email || '').trim().toLowerCase(),
        phone: body.phone ? String(body.phone) : null,
        sessionId: body.session_id ? String(body.session_id) : null,
      });
      if (!started.ok) {
        return NextResponse.json(
          { error: started.error },
          { status: started.status }
        );
      }
      await saveStore(companyId, meta, started.store, 'gym_sales');
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
          {
            const { attachCrmToAdvisorPerson } = await import(
              '@/lib/b2c/member-account-ar'
            );
            await attachCrmToAdvisorPerson({
              companyId,
              kind: 'gym',
              person: paid.client,
            });
            const ci = paid.store.clients.findIndex(
              (c) => c.id === paid.client.id
            );
            if (ci >= 0) paid.store.clients[ci] = paid.client;
          }
          await saveStore(
            companyId,
            meta,
            paid.store,
            'gym_sales',
            'clients',
            'subscriptions',
            'programme_enrollments',
            'bookings'
          );
          return NextResponse.json({
            success: true,
            sale: paid.sale,
            portal_token: paid.client.portal_token,
            message: 'Payment recorded — membership is active',
          });
        }
        return NextResponse.json({ error: applied.error }, { status: 400 });
      }
      const { loadAdvisorModuleStore } = await import(
        '@/lib/business/company-data'
      );
      const fresh = (
        await loadAdvisorModuleStore(
          companyId,
          FITGRAPH_META_KEY,
          readFitgraphFromMetadata
        )
      ).store;
      const sale = findGymSaleByRef(fresh, reference);
      const client = fresh.clients.find((c) => c.id === applied.clientId);
      return NextResponse.json({
        success: true,
        sale,
        portal_token: client?.portal_token,
        message: 'Payment recorded — membership is active',
      });
    }

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
      await saveStore(companyId, meta, store, 'class_feedback', 'bookings', 'sessions');
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

    const complimentaryInvite = isComplimentaryClassInvite({
      complimentary: body.complimentary,
      trial: body.trial,
      share_code: shareCode || body.share_code,
    });
    if (store.settings?.allow_public_booking === false && !complimentaryInvite) {
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
    const complimentary = isComplimentaryClassInvite({
      complimentary: body.complimentary,
      trial: body.trial,
      share_code: body.share_code || session?.share_code,
    });
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
    if (sessionKindOf(store, session) === 'coach_personal') {
      return NextResponse.json(
        { error: 'Coach personal time cannot be booked' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    // Match existing client by email if possible
    let clientId = '';
    let existingClient = null as FitClient | null;
    if (email) {
      const existing = store.clients.find(
        (c) =>
          c.email &&
          c.email.toLowerCase() === email.toLowerCase() &&
          c.active !== false
      );
      if (existing) {
        clientId = existing.id;
        existingClient = existing;
      }
    }

    if (
      !complimentary &&
      gymRequiresPaidMembership(store) &&
      !clientHasPaidAccess(store, existingClient)
    ) {
      return NextResponse.json(
        {
          error: 'Buy a membership first — payment is required before class booking',
          need_membership: true,
          shop: gymShopCatalog(store),
        },
        { status: 402 }
      );
    }
    if (existingClient && !complimentary) {
      const classGate = memberMayBookSession(store, existingClient, session);
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
        notes: complimentary
          ? 'Complimentary intro class (shared invite)'
          : 'Created via website booking',
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
      source: complimentary ? 'invite' : 'website',
      guest_name: name,
      guest_email: email || undefined,
      guest_phone: phone || undefined,
      notes: complimentary ? 'Complimentary intro class' : undefined,
    };
    store.bookings.push(booking);
    if (complimentary) {
      store.desk_notices = pushDeskNotice(
        store.desk_notices,
        newDeskNotice({
          kind: 'member_joined',
          person_id: clientId,
          person_name: name,
          email: email || null,
          phone: phone || null,
          source: 'portal',
          service_name: store.class_types.find((c) => c.id === session.class_type_id)
            ?.name || 'Class',
          date: session.date,
          start_time: session.start_time,
          note: 'Complimentary intro class — follow up to join',
        })
      );
    }
    {
      const person = store.clients.find((c) => c.id === clientId);
      if (person) {
        const { attachCrmToAdvisorPerson } = await import(
          '@/lib/b2c/member-account-ar'
        );
        await attachCrmToAdvisorPerson({
          companyId,
          kind: 'gym',
          person,
        });
      }
    }
    await saveStore(companyId, meta, store, 'bookings', 'clients', 'desk_notices');

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
        complimentary: complimentary || undefined,
        message: complimentary
          ? status === 'waitlist'
            ? 'This intro class is full — you are on the waitlist. Join as a member below.'
            : 'You’re booked on a complimentary intro class. Join as a member to keep training.'
          : status === 'waitlist'
            ? 'Class is full — you are on the waitlist'
            : 'Booked successfully',
      },
      join: store.settings?.public_token
        ? {
            member: gymJoinMemberPath(store.settings.public_token, 'group'),
            private: gymJoinMemberPath(store.settings.public_token, 'private'),
            both: gymJoinMemberPath(store.settings.public_token, 'both'),
          }
        : null,
      calendar_links: {
        google: gcal,
        ics,
      },
      calendar: buildPublicCalendarPayload(store),
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
    console.error('[public/fitgraph]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
