/**
 * GET/POST — probe FNB Integration Channel credentials (token only).
 * Does not log secrets. Use from Accounting → Bank feed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { parseCompanyId } from '@/lib/accounting/server';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { probeFnbIntegration } from '@/lib/banking';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(
      request.nextUrl.searchParams.get('companyId')
    );
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const supabase = (await import('@/lib/supabase/server-client')).getSupabaseServer();
    const { data: prof } = await supabase
      .from('profiles')
      .select('account_number')
      .eq('id', companyId)
      .maybeSingle();
    const { data: conn } = await supabase
      .from('bank_connections')
      .select('external_account_id')
      .eq('profile_id', companyId)
      .eq('provider', 'fnb')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const accountNumber =
      String(conn?.external_account_id || prof?.account_number || '').replace(
        /\s+/g,
        ''
      ) || undefined;
    const probe = await probeFnbIntegration({ accountNumber });
    return NextResponse.json({ success: true, ...probe });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Probe failed' },
      { status: 500 }
    );
  }
}
