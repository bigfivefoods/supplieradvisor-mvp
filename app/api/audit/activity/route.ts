import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyPermission,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

/**
 * GET ?companyId=&limit=40
 * Recent activity_log rows for the company (audit trail).
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const limit = Math.min(100, Math.max(5, Number(sp.get('limit')) || 40));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyPermission(
      request,
      companyId,
      'settings',
      'view',
      { legacyPrivyUserId: legacyPrivyFrom(request) }
    );
    if (!gate.ok) {
      // Fall back: any member can view light audit
      const { requireCompanyAccess } = await import('@/lib/auth/api-auth');
      const mem = await requireCompanyAccess(request, companyId, {
        legacyPrivyUserId: legacyPrivyFrom(request),
      });
      if (!mem.ok) return mem.response;
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('activity_log')
      .select('id, actor_user_id, action, entity_type, entity_id, summary, metadata, created_at')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          events: [],
          warning: 'activity_log missing — run world_class_schema migration',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, events: data || [] });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
