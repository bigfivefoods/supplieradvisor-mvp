import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';

/** GET ?companyId= — trust.settle_bump history for trust page */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('activity_log')
      .select('id, action, summary, metadata, created_at')
      .eq('profile_id', companyId)
      .in('action', ['trust.settle_bump', 'ar.payment_claim_confirmed'])
      .order('created_at', { ascending: false })
      .limit(40);

    if (error) {
      return NextResponse.json({
        success: true,
        events: [],
        warning: error.message,
      });
    }

    return NextResponse.json({
      success: true,
      events: data || [],
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
