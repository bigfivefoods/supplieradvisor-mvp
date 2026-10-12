import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { legacyPrivyFrom, requireCompanyAccess } from '@/lib/auth/api-auth';
import { appleConnectError, connectAppleCalendar, normalizeApplePassword } from '@/lib/sales/calendar-apple';
import { sealSecret } from '@/lib/sales/calendar-secrets';
import { DIARY_CALENDAR_NAME } from '@/lib/sales/calendar-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const companyId = Number(body.companyId);
  const appleId = String(body.appleId || '').trim().toLowerCase();
  const appPassword = normalizeApplePassword(String(body.appPassword || ''));
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 });
  }
  const access = await requireCompanyAccess(request, companyId, {
    legacyPrivyUserId: legacyPrivyFrom(request, body),
  });
  if (!access.ok) return access.response;
  const inputError = appleConnectError(appleId, appPassword);
  if (inputError) {
    return NextResponse.json({ error: inputError }, { status: 400 });
  }
  try {
    const connected = await connectAppleCalendar(appleId, appPassword);
    const supabase = getSupabaseServer();
    const saved = await supabase.from('crm_calendar_links').upsert(
      {
        profile_id: companyId,
        user_id: access.userId,
        provider: 'apple',
        account_email: appleId,
        calendar_id: connected.calendarHref,
        calendar_name: DIARY_CALENDAR_NAME,
        secret_enc: sealSecret(JSON.stringify({ appleId, appPassword })),
        status: 'active',
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,user_id,provider' }
    );
    if (saved.error) {
      const missing = /does not exist|schema cache/i.test(saved.error.message);
      return NextResponse.json(
        { error: saved.error.message, hint: missing ? 'Run RUN_THIS_FOR_CALENDAR_SYNC.sql' : undefined },
        { status: missing ? 503 : 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Apple Calendar could not connect' },
      { status: 400 }
    );
  }
}
