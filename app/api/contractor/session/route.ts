import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';
import { getContainerOperatorMetrics } from '@/lib/contractor/access';
import { requireVerifiedUser } from '@/lib/auth/api-auth';
import { canAppearInCompanySwitcher } from '@/lib/business/permissions';

/**
 * POST /api/contractor/session
 * Resolve operator portal access for a Privy user.
 * Body: { privyUserId, email? }
 *
 * Pure contractors (isContractor && !isBusinessUser) must only use /contractor.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const _auth = await requireVerifiedUser(request, { legacyPrivyUserId: body.privyUserId });
    if (!_auth.ok) return _auth.response;
    const userId = getCanonicalUserId(body.privyUserId);
    const email = body.email ? String(body.email).toLowerCase().trim() : null;

    if (!userId) {
      return NextResponse.json({ error: 'privyUserId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const variants = userIdMatchVariants(userId);
    const lite = body.lite === true;

    if (lite) {
      const [{ data: linked }, { data: memberships }] = await Promise.all([
        supabase
          .from('container_contractors')
          .select('id, user_id, status, portal_status, contract_accepted_at')
          .in('user_id', variants)
          .limit(8),
        supabase
          .from('business_users')
          .select('id, role')
          .in('user_id', variants)
          .eq('status', 'active')
          .limit(40),
      ]);
      const isLiveContractor = (c: {
        contract_accepted_at?: string | null;
        portal_status?: string | null;
        user_id?: string | null;
        status?: string | null;
      }) =>
        Boolean(
          c.contract_accepted_at ||
            c.portal_status === 'active' ||
            (c.user_id &&
              c.status === 'active' &&
              c.portal_status !== 'invited' &&
              c.portal_status !== 'suspended')
        );
      let isContractor = (linked || []).some(isLiveContractor);
      if (!isContractor && email) {
        const { data: byEmail } = await supabase
          .from('container_contractors')
          .select('id')
          .eq('email', email)
          .not('contract_accepted_at', 'is', null)
          .limit(1);
        isContractor = Boolean(byEmail?.length);
      }
      const isBusinessUser = (memberships || []).some((m) =>
        canAppearInCompanySwitcher(m.role ? String(m.role) : null)
      );
      return NextResponse.json({
        success: true,
        lite: true,
        isContractor,
        isBusinessUser,
        isPureContractor: isContractor && !isBusinessUser,
      });
    }

    // Contractors linked by user_id who completed contract acceptance
    const { data: linked } = await supabase
      .from('container_contractors')
      .select('*')
      .in('user_id', variants);

    let byUser = (linked || []).filter(
      (c) =>
        c.contract_accepted_at ||
        c.portal_status === 'active' ||
        // legacy rows linked before portal_status existed
        (c.user_id && c.status === 'active' && c.portal_status !== 'invited' && c.portal_status !== 'suspended')
    );

    // Also by email if contract accepted
    if ((!byUser || byUser.length === 0) && email) {
      const { data: byEmail } = await supabase
        .from('container_contractors')
        .select('*')
        .eq('email', email)
        .not('contract_accepted_at', 'is', null);
      byUser = byEmail || [];

      for (const row of byUser) {
        if (!row.user_id || !variants.includes(String(row.user_id))) {
          await supabase
            .from('container_contractors')
            .update({
              user_id: userId,
              portal_status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);
          row.user_id = userId;
          row.portal_status = 'active';
        }
      }
    }

    const contractors = byUser || [];

    const { data: memberships } = await supabase
      .from('business_users')
      .select('id, role')
      .in('user_id', variants)
      .eq('status', 'active')
      .limit(40);

    const isBusinessUser = (memberships || []).some((m) =>
      canAppearInCompanySwitcher(m.role ? String(m.role) : null)
    );

    if (contractors.length === 0) {
      return NextResponse.json({
        success: true,
        isContractor: false,
        isBusinessUser,
        isPureContractor: false,
        contractors: [],
        containers: [],
        metrics: [],
      });
    }

    const contractorIds = contractors.map((c) => c.id);
    const { data: containers } = await supabase
      .from('containers')
      .select('*')
      .in('contractor_id', contractorIds)
      .order('name');

    let list = containers || [];

    // Fallback: containers from accepted invites
    if (list.length === 0 && email) {
      const { data: invites } = await supabase
        .from('contractor_invites')
        .select('container_id')
        .eq('email', email)
        .eq('status', 'accepted');
      const ids = [...new Set((invites || []).map((i) => i.container_id).filter(Boolean))];
      if (ids.length) {
        const { data: more } = await supabase.from('containers').select('*').in('id', ids);
        list = more || [];
      }
    }

    // Live metrics per allocated container only
    const metrics = await Promise.all(
      list.map((c) => getContainerOperatorMetrics(c.id, c.profile_id ?? null))
    );

    return NextResponse.json({
      success: true,
      isContractor: true,
      isBusinessUser,
      isPureContractor: !isBusinessUser,
      contractors,
      containers: list,
      metrics,
      primaryContractor: contractors[0],
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Session failed' },
      { status: 500 }
    );
  }
}
