import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

/**
 * GET ?companyId= — recent AR statement email / dunning activity for collections audit.
 */
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
      .select('id, action, summary, created_at, metadata')
      .eq('profile_id', companyId)
      .in('action', [
        'ar.statement_emailed',
        'invoice.dunning',
        'invoice.resend',
      ])
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      // Soft empty if table/filter issues
      return NextResponse.json({
        success: true,
        events: [],
        warning: error.message,
      });
    }

    return NextResponse.json({
      success: true,
      events: (data || []).map((r) => ({
        id: String(r.id),
        action: r.action,
        summary: r.summary || r.action,
        created_at: r.created_at,
        metadata: r.metadata,
      })),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
