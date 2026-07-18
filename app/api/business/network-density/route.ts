import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';

/** GET ?companyId= — partners / pending / open-to-trade density for home */
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
    const [accepted, pendingIn, invites] = await Promise.all([
      supabase
        .from('business_connections')
        .select('id', { count: 'exact', head: true })
        .or(
          `requester_profile_id.eq.${companyId},requestee_profile_id.eq.${companyId}`
        )
        .eq('status', 'accepted'),
      supabase
        .from('business_connections')
        .select('id', { count: 'exact', head: true })
        .eq('requestee_profile_id', companyId)
        .eq('status', 'pending'),
      supabase
        .from('activity_log')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId)
        .like('action', '%invite%')
        .gte(
          'created_at',
          new Date(Date.now() - 30 * 86400000).toISOString()
        ),
    ]);

    let openToTradeSuggestions = 0;
    try {
      const { loadOpenToTradeRanking } = await import(
        '@/lib/business/network-ranking'
      );
      const ranked = await loadOpenToTradeRanking({
        viewerCompanyId: companyId,
        limit: 10,
      });
      openToTradeSuggestions = ranked.filter((r) => r.id !== companyId).length;
    } catch {
      openToTradeSuggestions = 0;
    }

    return NextResponse.json({
      success: true,
      density: {
        acceptedConnections: accepted.count ?? 0,
        pendingIncoming: pendingIn.count ?? 0,
        invites30d: invites.count ?? 0,
        openToTradeSuggestions,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
