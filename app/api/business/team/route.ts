import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';

/**
 * GET ?companyId=&privyUserId=
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (privyUserId) {
      const mem = await assertCompanyMember(privyUserId, companyId);
      if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    const [{ data: members, error }, { data: company }] = await Promise.all([
      supabase
        .from('business_users')
        .select(
          'id, profile_id, user_id, name, email, invited_email, role, status, joined_at, invited_at, created_at'
        )
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('profiles')
        .select('id, trading_name, legal_name')
        .eq('id', companyId)
        .maybeSingle(),
    ]);

    if (error) {
      return NextResponse.json({
        success: true,
        members: [],
        company: company || null,
        warning: error.message,
      });
    }

    const list = members || [];
    const counts = {
      total: list.length,
      active: list.filter((m) => m.status === 'active').length,
      invited: list.filter((m) =>
        ['invited', 'pending'].includes(String(m.status || '').toLowerCase())
      ).length,
      owners: list.filter((m) => String(m.role || '').toLowerCase() === 'owner').length,
    };

    return NextResponse.json({
      success: true,
      members: list,
      company: company || null,
      counts,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * PATCH — update role / status of a member
 * Body: { companyId, privyUserId, memberId, role?, status? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const memberId = Number(body.memberId || body.id);
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    if (!Number.isFinite(memberId)) {
      return NextResponse.json({ error: 'memberId required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.role != null) updates.role = String(body.role);
    if (body.status != null) updates.status = String(body.status);
    if (body.name != null) updates.name = String(body.name);

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('business_users')
      .update(updates)
      .eq('id', memberId)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'business.team_updated',
      entity_type: 'business_users',
      entity_id: String(memberId),
      summary: `Team member updated (${body.role || body.status || 'fields'})`,
      metadata: updates,
    });

    return NextResponse.json({ success: true, member: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * DELETE ?companyId=&privyUserId=&memberId=
 * Soft-remove: status = removed
 */
export async function DELETE(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const memberId = Number(sp.get('memberId'));
    const privyUserId = sp.get('privyUserId');
    const mem = await assertCompanyMember(privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    if (!Number.isFinite(memberId)) {
      return NextResponse.json({ error: 'memberId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: target } = await supabase
      .from('business_users')
      .select('id, role, status, user_id')
      .eq('id', memberId)
      .eq('profile_id', companyId)
      .maybeSingle();

    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    if (String(target.role) === 'owner' && target.user_id === mem.userId) {
      return NextResponse.json(
        { error: 'Owners cannot remove themselves. Transfer ownership first.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('business_users')
      .update({ status: 'removed', updated_at: new Date().toISOString() })
      .eq('id', memberId)
      .eq('profile_id', companyId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'business.team_removed',
      entity_type: 'business_users',
      entity_id: String(memberId),
      summary: 'Team member removed',
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
