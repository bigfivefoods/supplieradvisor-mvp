/**
 * Desk inbox: SA Member joins and bookings.
 * GET  ?companyId=&module=
 * POST { companyId, module, id, action: seen|accepted|dismissed }
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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId') || 0);
    const module = parseClinicModule(request.nextUrl.searchParams.get('module'));
    if (!companyId || !module) {
      return NextResponse.json(
        { error: 'companyId and module required' },
        { status: 400 }
      );
    }
    const auth = await requireCompanyAccess(request, companyId);
    if (!auth.ok) return auth.response;
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
    const module = parseClinicModule(body.module);
    const id = String(body.id || '');
    const action = String(body.action || 'seen');
    if (!companyId || !module || !id) {
      return NextResponse.json(
        { error: 'companyId, module and id required' },
        { status: 400 }
      );
    }
    if (
      action !== 'seen' &&
      action !== 'accepted' &&
      action !== 'dismissed'
    ) {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    const auth = await requireCompanyAccess(request, companyId);
    if (!auth.ok) return auth.response;
    const store = await loadClinicModuleStore(companyId, module);
    const next = decideDeskNotice(store, id, action);
    await saveClinicModuleStore(companyId, module, next);
    return NextResponse.json({
      success: true,
      notices: next.desk_notices || [],
      open: openDeskNotices(next.desk_notices),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Update failed' },
      { status: 500 }
    );
  }
}
