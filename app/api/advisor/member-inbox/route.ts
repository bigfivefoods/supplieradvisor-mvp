/**
 * Desk inbox: SA Member joins and bookings.
 * GET  ?companyId=&module=
 * POST { companyId, module, id, action: seen|accepted|dismissed|book }
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess } from '@/lib/auth/api-auth';
import {
  decideDeskNotice,
  openDeskNotices,
} from '@/lib/services/advisor-member-calendar';
import {
  loadClinicModuleStore,
  parseClinicModule,
  saveClinicModuleStore,
} from '@/lib/services/advisor-clinic-io';
import { promoteWaitlistBooking } from '@/lib/services/advisor-booking';
import {
  FITGRAPH_META_KEY,
  readFitgraphFromMetadata,
  writeFitgraphToMetadata,
} from '@/lib/fitness/fitgraph';
import {
  loadAdvisorModuleStore,
  saveAdvisorModuleStore,
} from '@/lib/business/company-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId') || 0);
    const moduleRaw = String(request.nextUrl.searchParams.get('module') || '');
    if (!companyId || !moduleRaw) {
      return NextResponse.json(
        { error: 'companyId and module required' },
        { status: 400 }
      );
    }
    const auth = await requireCompanyAccess(request, companyId);
    if (!auth.ok) return auth.response;
    if (moduleRaw === 'fitgraph') {
      const loaded = await loadAdvisorModuleStore(
        companyId,
        FITGRAPH_META_KEY,
        readFitgraphFromMetadata
      );
      const notices = loaded.store.desk_notices || [];
      return NextResponse.json({
        success: true,
        notices,
        open: openDeskNotices(notices),
        share_member_calendar:
          loaded.store.settings?.share_member_calendar !== false &&
          loaded.store.settings?.allow_public_booking !== false,
        require_accept_join: false,
      });
    }
    const module = parseClinicModule(moduleRaw);
    if (!module) {
      return NextResponse.json({ error: 'Unknown module' }, { status: 400 });
    }
    const store = await loadClinicModuleStore(companyId, module);
    const notices = store.desk_notices || [];
    return NextResponse.json({
      success: true,
      notices,
      open: openDeskNotices(notices),
      share_member_calendar: store.settings?.share_member_calendar !== false,
      require_accept_join: store.settings?.require_accept_join === true,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = Number(body.companyId || body.company_id || 0);
    const moduleRaw = String(body.module || '');
    const id = String(body.id || '');
    const action = String(body.action || 'seen');
    if (!companyId || !moduleRaw || !id) {
      return NextResponse.json(
        { error: 'companyId, module and id required' },
        { status: 400 }
      );
    }
    if (
      action !== 'seen' &&
      action !== 'accepted' &&
      action !== 'dismissed' &&
      action !== 'book'
    ) {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    const auth = await requireCompanyAccess(request, companyId);
    if (!auth.ok) return auth.response;

    if (moduleRaw === 'fitgraph') {
      const loaded = await loadAdvisorModuleStore(
        companyId,
        FITGRAPH_META_KEY,
        readFitgraphFromMetadata
      );
      const store = loaded.store;
      if (action === 'book') {
        const notice = (store.desk_notices || []).find((n) => n.id === id);
        if (!notice) {
          return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
        }
        const hit = (store.bookings || []).find(
          (b) =>
            b.status === 'waitlist' &&
            b.client_id === notice.person_id &&
            b.session_id === notice.appointment_id
        );
        if (!hit || !promoteWaitlistBooking(store.bookings, hit.id)) {
          return NextResponse.json(
            { error: 'No waitlist booking to confirm' },
            { status: 404 }
          );
        }
        decideDeskNotice(
          store as unknown as Parameters<typeof decideDeskNotice>[0],
          id,
          'accepted'
        );
      } else {
        decideDeskNotice(
          store as unknown as Parameters<typeof decideDeskNotice>[0],
          id,
          action
        );
      }
      await saveAdvisorModuleStore(
        companyId,
        FITGRAPH_META_KEY,
        store,
        writeFitgraphToMetadata
      );
      return NextResponse.json({
        success: true,
        notices: store.desk_notices || [],
        open: openDeskNotices(store.desk_notices),
      });
    }

    const module = parseClinicModule(moduleRaw);
    if (!module) {
      return NextResponse.json({ error: 'Unknown module' }, { status: 400 });
    }
    const store = await loadClinicModuleStore(companyId, module);
    if (action === 'book') {
      const notice = (store.desk_notices || []).find((n) => n.id === id);
      if (!notice) {
        return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
      }
      const hit = (store.bookings || []).find(
        (b) =>
          b.status === 'waitlist' &&
          b.patient_id === notice.person_id &&
          b.appointment_id === notice.appointment_id
      );
      if (!hit || !promoteWaitlistBooking(store.bookings, hit.id)) {
        return NextResponse.json(
          { error: 'No waitlist booking to confirm' },
          { status: 404 }
        );
      }
      decideDeskNotice(store, id, 'accepted');
    } else {
      decideDeskNotice(store, id, action);
    }
    await saveClinicModuleStore(companyId, module, store);
    return NextResponse.json({
      success: true,
      notices: store.desk_notices || [],
      open: openDeskNotices(store.desk_notices),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Update failed' },
      { status: 500 }
    );
  }
}
