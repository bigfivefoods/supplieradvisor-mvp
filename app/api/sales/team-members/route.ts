import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getCompanyMembership } from '@/lib/business/access';
import { canView, canWrite } from '@/lib/business/permissions';

/**
 * GET ?companyId=
 * Active company team members for deal assignment (sales portal + CRM).
 * Any active member with sales_portal or customers access (not full team admin).
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

    const mem = await getCompanyMembership(gate.userId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    const canList =
      canWrite(mem.role, 'sales_portal') ||
      canWrite(mem.role, 'customers') ||
      canView(mem.role, 'team') ||
      canView(mem.role, 'customers');
    if (!canList) {
      return NextResponse.json(
        { error: 'Your role cannot list team members for deals' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('business_users')
      .select(
        'id, user_id, name, email, invited_email, role, status'
      )
      .eq('profile_id', companyId)
      .eq('status', 'active')
      .order('name', { ascending: true })
      .limit(100);

    if (error) {
      return NextResponse.json({
        success: true,
        members: [],
        warning: error.message,
      });
    }

    const members = (data || []).map((m) => {
      const displayName =
        String(m.name || '').trim() ||
        String(m.email || m.invited_email || '').trim() ||
        `User ${String(m.user_id || '').slice(0, 8)}`;
      return {
        id: Number(m.id),
        user_id: m.user_id ? String(m.user_id) : null,
        name: displayName,
        email: m.email || m.invited_email || null,
        role: m.role || null,
      };
    }).filter((m) => m.user_id);

    return NextResponse.json({ success: true, members });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
