import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  attendanceByClass,
  buildCoachPortalPayload,
  createSessionsFromTemplate,
  defaultPublicSettings,
  ensurePublicToken,
  issueCoachPortalToken,
  newId,
  readFitgraphFromMetadata,
  sessionBookingCount,
  sessionsInRange,
  summariseFitgraph,
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
  return {
    attendanceByClass: attendanceByClass(store),
    weekSessions: sessionsInRange(
      store,
      today,
      weekEnd.toISOString().slice(0, 10)
    ).map((s) => ({
      ...s,
      booked: sessionBookingCount(store, s.id),
    })),
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
      await saveStore(companyId, meta, store);
      return NextResponse.json({
        success: true,
        store,
        summary: summariseFitgraph(store),
        analysis: analysis(store),
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
    const row: FitCoach = {
      id,
      code: String(rec.code || `C-${store.coaches.length + 1}`),
      name: String(rec.name || 'Coach'),
      email: rec.email != null ? String(rec.email) : undefined,
      phone: rec.phone != null ? String(rec.phone) : undefined,
      specialties: Array.isArray(rec.specialties)
        ? (rec.specialties as string[])
        : rec.specialty
          ? [String(rec.specialty)]
          : [],
      bio: rec.bio != null ? String(rec.bio) : undefined,
      public_bio:
        rec.public_bio != null ? String(rec.public_bio) : prev?.public_bio,
      photo_url:
        rec.photo_url != null ? String(rec.photo_url) : prev?.photo_url,
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
      color: rec.color != null ? String(rec.color) : undefined,
      active: rec.active !== false,
      created_at: prev?.created_at || now,
    };
    if (i >= 0) store.coaches[i] = row;
    else store.coaches.push(row);
  } else if (entity === 'clients') {
    const id = String(rec.id || newId('cli'));
    const i = store.clients.findIndex((c) => c.id === id);
    const row: FitClient = {
      id,
      code: String(rec.code || `M-${store.clients.length + 1}`),
      name: String(rec.name || 'Client'),
      email: rec.email != null ? String(rec.email) : undefined,
      phone: rec.phone != null ? String(rec.phone) : undefined,
      membership_plan_id:
        rec.membership_plan_id != null
          ? String(rec.membership_plan_id)
          : null,
      membership_status: String(rec.membership_status || 'active'),
      start_date: rec.start_date != null ? String(rec.start_date) : null,
      end_date: rec.end_date != null ? String(rec.end_date) : null,
      coach_id: rec.coach_id != null ? String(rec.coach_id) : null,
      emergency_contact:
        rec.emergency_contact != null
          ? String(rec.emergency_contact)
          : undefined,
      notes: rec.notes != null ? String(rec.notes) : undefined,
      active: rec.active !== false,
      created_at: i >= 0 ? store.clients[i].created_at : now,
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
    const row: FitBooking = {
      id,
      session_id: sessionId,
      client_id: String(rec.client_id || ''),
      status,
      booked_at: i >= 0 ? store.bookings[i].booked_at : now,
      source: String(rec.source || 'desk'),
      guest_name:
        rec.guest_name != null ? String(rec.guest_name) : undefined,
      guest_email:
        rec.guest_email != null ? String(rec.guest_email) : undefined,
      guest_phone:
        rec.guest_phone != null ? String(rec.guest_phone) : undefined,
      notes: rec.notes != null ? String(rec.notes) : undefined,
    };
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
    updated_at: now,
  };
}
