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
  memberCalendarShareOn,
  type ClinicModuleKey,
} from '@/lib/services/advisor-member-calendar';
import {
  clinicNewId,
  loadClinicModuleStore,
  saveClinicModuleStore,
} from '@/lib/services/advisor-clinic-io';
import { notifyPatientBookingPush } from '@/lib/b2c/member-push';

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
      : found.memberships.filter((m) => CLINIC_KIND_TO_MODULE[m.kind]);

    const calendars = [];
    for (const mem of targets) {
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
    const mod = moduleForKind(kind);
    if (!companyId || !mod || !slotId) {
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
