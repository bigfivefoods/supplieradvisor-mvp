import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess } from '@/lib/auth/api-auth';
import { ensureOutlookCalendar, exchangeOutlookCode } from '@/lib/sales/calendar-microsoft';
import { syncUserCalendars } from '@/lib/sales/calendar-engine';
import { readCalendarState, sealSecret } from '@/lib/sales/calendar-secrets';
import { DIARY_CALENDAR_NAME } from '@/lib/sales/calendar-sync';
import { appBaseUrl } from '@/lib/customers/invoice-feedback-token';

export const dynamic = 'force-dynamic';

function back(query: string) {
  return NextResponse.redirect(`${appBaseUrl()}/sales/tasks?${query}`);
}

export async function GET(request: NextRequest) {
  const state = readCalendarState(request.nextUrl.searchParams.get('state') || '');
  const code = request.nextUrl.searchParams.get('code') || '';
  if (!state || state.provider !== 'outlook' || !code) return back('calendar=error');
  const access = await requireCompanyAccess(request, state.companyId);
  if (!access.ok || access.userId !== state.userId) return back('calendar=error');
  try {
    const tokens = await exchangeOutlookCode(code);
    const calendarId = await ensureOutlookCalendar(tokens.accessToken);
    const supabase = getSupabaseServer();
    const saved = await supabase.from('crm_calendar_links').upsert(
      {
        profile_id: state.companyId,
        user_id: state.userId,
        provider: 'outlook',
        account_email: tokens.email || null,
        calendar_id: calendarId,
        calendar_name: DIARY_CALENDAR_NAME,
        secret_enc: sealSecret(tokens.refreshToken),
        status: 'active',
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,user_id,provider' }
    );
    if (saved.error) return back('calendar=error');
    await syncUserCalendars(state.companyId, state.userId);
    return back('calendar=outlook');
  } catch {
    return back('calendar=error');
  }
}
