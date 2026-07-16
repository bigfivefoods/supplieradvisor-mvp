import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  requireVerifiedUser,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';

/**
 * GET /api/sam/history?companyId=&limit=
 * Recent SAM conversation turns for the company (or current user if no company).
 */
export async function GET(request: NextRequest) {
  try {
    const companyIdRaw = request.nextUrl.searchParams.get('companyId');
    const companyId = companyIdRaw ? Number(companyIdRaw) : NaN;
    const limit = Math.min(
      50,
      Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 20))
    );

    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!auth.ok) return auth.response;

    if (Number.isFinite(companyId) && companyId > 0) {
      const gate = await requireCompanyAccess(request, companyId, {
        legacyPrivyUserId: legacyPrivyFrom(request),
      });
      if (!gate.ok) return gate.response;
    }

    const supabase = getSupabaseServer();
    let q = supabase
      .from('sam_conversations')
      .select(
        'id, profile_id, user_id, pathname, model, api, user_message, assistant_message, error, metadata, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (Number.isFinite(companyId) && companyId > 0) {
      q = q.eq('profile_id', companyId);
    } else {
      q = q.eq('user_id', auth.userId);
    }

    const { data, error } = await q;
    if (error) {
      if (/relation|does not exist/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          conversations: [],
          warning: 'Run 20260716_platform_improvements.sql',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      conversations: data || [],
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
