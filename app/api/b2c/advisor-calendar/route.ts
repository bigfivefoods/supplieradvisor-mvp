/**
 * SA Member bookable Advisor diaries.
 * GET  ?company=&kind=  — shared slots
 * POST { company, kind, slot_id } — book
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireVerifiedUser,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { loadB2cProfile } from '@/lib/b2c/profile-store';
import { isWalletVisibleMembership } from '@/lib/b2c/company-modules';
import {
  loadBusinessWorkspaceSummary,
  operatorCompanyIds,
} from '@/lib/b2c/workspace';
import {
  CLINIC_KIND_TO_MODULE,
  generateAdvisorMemberSlots,
  bookAdvisorMemberSlot,
  gymCalendarShareOn,
  memberCalendarShareOn,
  newDeskNotice,
  pushDeskNotice,
  type ClinicModuleKey,
} from '@/lib/services/advisor-member-calendar';
import {
  clinicNewId,
  loadClinicModuleStore,
  saveClinicModuleStore,
} from '@/lib/services/advisor-clinic-io';
import { notifyPatientBookingPush } from '@/lib/b2c/member-push';
import {
  FITGRAPH_META_KEY,
  isPublicListingSession,
  newId,
  readFitgraphFromMetadata,
  sessionBookingCount,
  writeFitgraphToMetadata,
} from '@/lib/fitness/fitgraph';
import {
  loadAdvisorModuleStore,
  saveAdvisorModuleStore,
} from '@/lib/business/company-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function memberFor(
  userId: string,
  companyId: number,
  kind: string
) {
  const profile = await loadB2cProfile(userId);
  if (!profile) return null;
  let owned: number[] = [];
  try {
    const ws = await loadBusinessWorkspaceSummary(userId);
    owned = operatorCompanyIds(ws);
  } catch {
    owned = [];
  }
  const memberships = (profile.memberships || []).filter((m) =>
    isWalletVisibleMembership(m, owned)
  );
  const mem =
    memberships.find(
      (m) => m.company_id === companyId && m.kind === kind && m.active !== false
    ) ||
    memberships.find((m) => m.company_id === companyId && m.active !== false);
  return { profile, memberships, mem };
}

function moduleForKind(kind: string): ClinicModuleKey | null {
  return CLINIC_KIND_TO_MODULE[kind] || null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!auth.ok) return auth.response;
    const userId = getCanonicalUserId(auth.userId);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = Number(request.nextUrl.searchParams.get('company') || 0);
    const kind = String(request.nextUrl.searchParams.get('kind') || '');
    const found = await memberFor(userId, companyId, kind);
    if (!found) {
      return NextResponse.json({ calendars: [] });
    }

    const targets = companyId
      ? found.memberships.filter((m) => m.company_id === companyId)
      : found.memberships.filter(
          (m) => CLINIC_KIND_TO_MODULE[m.kind] || m.kind === 'gym'
        );

    const calendars = [];
    for (const mem of targets) {
      if (mem.kind === 'gym') {
        const loaded = await loadAdvisorModuleStore(
          mem.company_id,
          FITGRAPH_META_KEY,
          readFitgraphFromMetadata
        );
        const store = loaded.store;
        const shared = gymCalendarShareOn(store.settings);
        const today = new Date().toISOString().slice(0, 10);
        const slots = shared
          ? store.sessions
              .filter(
                (s) =>
                  isPublicListingSession(store, s) &&
                  s.date >= today &&
                  s.status === 'scheduled'
              )
              .map((s) => {
                const ct = store.class_types.find(
                  (c) => c.id === s.class_type_id
                );
                const coach = store.coaches.find((c) => c.id === s.coach_id);
                const booked = sessionBookingCount(store, s.id);
                const cap = s.capacity ?? ct?.capacity ?? 0;
                return {
                  id: s.id,
                  date: s.date,
                  start_time: String(s.start_time || '').slice(0, 5),
                  end_time: s.end_time
                    ? String(s.end_time).slice(0, 5)
                    : undefined,
                  service_name: ct?.name || 'Class',
                  practitioner_name: coach?.name || null,
                  full: cap > 0 && booked >= cap,
                  spots_left: cap > 0 ? Math.max(0, cap - booked) : 99,
                  virtual: false,
                };
              })
          : [];
        calendars.push({
          company_id: mem.company_id,
          kind: 'gym',
          module: 'fitgraph',
          brand: mem.brand || mem.company_name,
          portal_path: mem.portal_path,
          shared,
          require_accept: false,
          join_status: 'accepted',
          timezone: store.settings?.timezone || 'Africa/Johannesburg',
          slots,
        });
        continue;
      }
      const mod = moduleForKind(mem.kind);
      if (!mod) continue;
      const store = await loadClinicModuleStore(mem.company_id, mod);
      const shared = memberCalendarShareOn(store.settings);
      const slots = shared ? generateAdvisorMemberSlots(store) : [];
      const patient = (store.patients || []).find((p) => p.id === mem.ref_id);
      calendars.push({
        company_id: mem.company_id,
        kind: mem.kind,
        module: mod,
        brand: mem.brand || mem.company_name,
        portal_path: mem.portal_path,
        shared,
        require_accept: store.settings?.require_accept_join === true,
        join_status: patient?.desk_join_status || 'accepted',
        timezone: store.settings?.timezone || 'Africa/Johannesburg',
        slots,
      });
    }

    if (companyId && !calendars.length) {
      return NextResponse.json(
        {
          error: 'Link this practice to your wallet first',
          code: 'need_join',
          company_id: companyId,
          kind,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, calendars });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!auth.ok) return auth.response;
    const userId = getCanonicalUserId(auth.userId);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const companyId = Number(body.company || body.companyId || 0);
    const kind = String(body.kind || '');
    const slotId = String(body.slot_id || body.appointment_id || '');
    if (!companyId || !kind || !slotId) {
      return NextResponse.json(
        { error: 'company, kind and slot_id required' },
        { status: 400 }
      );
    }
    const found = await memberFor(userId, companyId, kind);
    if (!found?.mem) {
      return NextResponse.json(
        { error: 'Link this practice first', code: 'need_join' },
        { status: 404 }
      );
    }
    if (kind === 'gym') {
      const loaded = await loadAdvisorModuleStore(
        companyId,
        FITGRAPH_META_KEY,
        readFitgraphFromMetadata
      );
      const store = loaded.store;
      if (!gymCalendarShareOn(store.settings)) {
        return NextResponse.json(
          { error: 'This gym is not sharing a bookable diary yet' },
          { status: 403 }
        );
      }
      const session = store.sessions.find(
        (s) => s.id === slotId && s.status === 'scheduled'
      );
      if (!session || !isPublicListingSession(store, session)) {
        return NextResponse.json(
          { error: 'That class is no longer on the diary' },
          { status: 409 }
        );
      }
      const client = store.clients.find((c) => c.id === found.mem!.ref_id);
      if (!client) {
        return NextResponse.json(
          { error: 'Member record not found' },
          { status: 404 }
        );
      }
      const existing = store.bookings.find(
        (b) =>
          b.session_id === session.id &&
          b.client_id === client.id &&
          b.status !== 'cancelled'
      );
      if (existing) {
        return NextResponse.json({
          success: true,
          status: existing.status,
          booking_id: existing.id,
          message:
            existing.status === 'waitlist'
              ? 'You are already on the waitlist'
              : 'Already booked',
        });
      }
      const ct = store.class_types.find((c) => c.id === session.class_type_id);
      const cap = session.capacity ?? ct?.capacity ?? 0;
      const bookedN = sessionBookingCount(store, session.id);
      const status =
        cap > 0 && bookedN >= cap ? ('waitlist' as const) : ('booked' as const);
      const bookingId = newId('bkg');
      const now = new Date().toISOString();
      store.bookings.push({
        id: bookingId,
        session_id: session.id,
        client_id: client.id,
        status,
        booked_at: now,
        source: 'member',
        notes:
          status === 'waitlist'
            ? 'SA Member — waitlist'
            : 'SA Member diary booking',
      });
      store.desk_notices = pushDeskNotice(
        store.desk_notices,
        newDeskNotice({
          kind: status === 'waitlist' ? 'booking_request' : 'booking_made',
          person_id: client.id,
          person_name: client.name,
          email: client.email,
          source: 'pwa',
          appointment_id: session.id,
          date: session.date,
          start_time: session.start_time,
          service_name: ct?.name || 'Class',
          note:
            status === 'waitlist'
              ? 'Asked to join a full class'
              : `${session.date} ${session.start_time}`,
        })
      );
      await saveAdvisorModuleStore(
        companyId,
        FITGRAPH_META_KEY,
        store,
        writeFitgraphToMetadata
      );
      await notifyPatientBookingPush({
        platformUserId: client.platform_user_id || userId,
        brand: found.mem.brand || found.mem.company_name,
        title: ct?.name || 'Class',
        date: session.date,
        start_time: session.start_time,
        status,
        portalPath: `${found.mem.portal_path}${
          found.mem.portal_path.includes('?') ? '&' : '?'
        }tab=mine`,
      });
      return NextResponse.json({
        success: true,
        status,
        booking_id: bookingId,
        appointment_id: session.id,
        message:
          status === 'waitlist'
            ? 'You are on the waitlist — the gym will confirm'
            : `Booked ${session.date} at ${String(session.start_time).slice(0, 5)}`,
      });
    }
    const mod = moduleForKind(kind);
    if (!mod) {
      return NextResponse.json({ error: 'Unknown advisor kind' }, { status: 400 });
    }
    const store = await loadClinicModuleStore(companyId, mod);
    const result = bookAdvisorMemberSlot({
      store,
      module: mod,
      patientId: String(found.mem.ref_id),
      slotId,
      newId: (p) => clinicNewId(mod, p),
      source: 'pwa',
      familyMemberId: body.family_member_id
        ? String(body.family_member_id)
        : null,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status }
      );
    }
    await saveClinicModuleStore(companyId, mod, result.store);
    const patient = (result.store.patients || []).find(
      (p) => p.id === found.mem!.ref_id
    );
    await notifyPatientBookingPush({
      platformUserId: patient?.platform_user_id || userId,
      brand: found.mem.brand || found.mem.company_name,
      title: result.slot.service_name,
      date: result.slot.date,
      start_time: result.slot.start_time,
      status: result.status,
      portalPath: `${found.mem.portal_path}${
        found.mem.portal_path.includes('?') ? '&' : '?'
      }tab=mine`,
    });
    return NextResponse.json({
      success: true,
      status: result.status,
      booking_id: result.bookingId,
      appointment_id: result.appointmentId,
      message:
        result.status === 'waitlist'
          ? 'You are on the waitlist — the practice will confirm'
          : `Booked ${result.slot.date} at ${result.slot.start_time}`,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Book failed' },
      { status: 500 }
    );
  }
}
