import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { legacyPrivyFrom, requireCompanyAccess } from '@/lib/auth/api-auth';
import { syncUserCalendars } from '@/lib/sales/calendar-engine';
import { googleConfigured, outlookConfigured } from '@/lib/sales/calendar-secrets';

export const dynamic = 'force-dynamic';

async function gate(request: NextRequest, companyId: number, body?: Record<string, unknown>) {
  return requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request, body) });
}

export async function GET(request: NextRequest) {
  const companyId = Number(request.nextUrl.searchParams.get('companyId'));
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 });
  }
  const access = await gate(request, companyId);
  if (!access.ok) return access.response;
  const supabase = getSupabaseServer();
  const links = await supabase
    .from('crm_calendar_links')
    .select('provider, account_email, calendar_name, status, last_error, last_synced_at')
    .eq('profile_id', companyId)
    .eq('user_id', access.userId);
  if (links.error && /does not exist|schema cache/i.test(links.error.message)) {
    return NextResponse.json({
      tableReady: false,
      googleReady: googleConfigured(),
      outlookReady: outlookConfigured(),
      links: [],
    });
  }
  if (links.error) return NextResponse.json({ error: links.error.message }, { status: 500 });
  return NextResponse.json({
    tableReady: true,
    googleReady: googleConfigured(),
    outlookReady: outlookConfigured(),
    links: links.data || [],
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = Number(body.companyId);
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 });
  }
  const access = await gate(request, companyId, body);
  if (!access.ok) return access.response;
  try {
    const result = await syncUserCalendars(companyId, access.userId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Calendar sync failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = Number(body.companyId);
  const provider = String(body.provider || '');
  if (!Number.isFinite(companyId) || companyId <= 0 || !['google', 'outlook', 'apple'].includes(provider)) {
    return NextResponse.json({ error: 'companyId and provider required' }, { status: 400 });
  }
  const access = await gate(request, companyId, body);
  if (!access.ok) return access.response;
  const supabase = getSupabaseServer();
  const removed = await supabase
    .from('crm_calendar_links')
    .delete()
    .eq('profile_id', companyId)
    .eq('user_id', access.userId)
    .eq('provider', provider);
  if (removed.error) return NextResponse.json({ error: removed.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
