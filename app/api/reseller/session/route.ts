import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCanonicalUserId, userIdMatchVariants } from '@/lib/auth/identity';
import { requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * POST { privyUserId, email? } — resolve reseller portal session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: body.privyUserId,
    });
    if (!auth.ok) return auth.response;

    const userId = getCanonicalUserId(auth.userId || body.privyUserId);
    const email = body.email ? String(body.email).toLowerCase().trim() : null;
    if (!userId) {
      return NextResponse.json({ error: 'privyUserId required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const variants = userIdMatchVariants(userId);

    let { data: byUser } = await supabase
      .from('container_resellers')
      .select('*')
      .in('user_id', variants);

    let resellers = (byUser || []).filter(
      (r) =>
        r.portal_status === 'active' ||
        r.contract_accepted_at ||
        (r.user_id && r.status === 'active' && r.portal_status !== 'suspended')
    );

    if ((!resellers || resellers.length === 0) && email) {
      const { data: byEmail } = await supabase
        .from('container_resellers')
        .select('*')
        .eq('email', email)
        .neq('portal_status', 'suspended');
      resellers = byEmail || [];
      for (const row of resellers) {
        if (!row.user_id || !variants.includes(String(row.user_id))) {
          await supabase
            .from('container_resellers')
            .update({
              user_id: userId,
              portal_status: 'active',
              contract_accepted_at:
                row.contract_accepted_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);
          row.user_id = userId;
          row.portal_status = 'active';
        }
      }
    }

    if (!resellers.length) {
      return NextResponse.json({
        success: true,
        isReseller: false,
        resellers: [],
        inventory: [],
        sales: [],
      });
    }

    const ids = resellers.map((r) => r.id);
    const profileId = Number(resellers[0].profile_id);

    const [{ data: inventory }, { data: sales }, { data: containers }] =
      await Promise.all([
        supabase
          .from('reseller_inventory')
          .select('*')
          .in('reseller_id', ids)
          .order('product_name'),
        supabase
          .from('reseller_sales')
          .select('*')
          .in('reseller_id', ids)
          .order('sale_date', { ascending: false })
          .limit(50),
        supabase
          .from('containers')
          .select('id, name, container_code, city')
          .eq('profile_id', profileId),
      ]);

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, trading_name, legal_name')
      .eq('id', profileId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      isReseller: true,
      companyName:
        profile?.trading_name || profile?.legal_name || 'Container network',
      resellers,
      inventory: inventory || [],
      sales: sales || [],
      containers: containers || [],
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
