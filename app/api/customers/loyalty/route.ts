import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { tierFromLifetime } from '@/lib/customers/documents';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const [{ data: accounts, error }, { data: txns }, { data: customers }] = await Promise.all([
      supabase
        .from('loyalty_accounts')
        .select('*')
        .eq('profile_id', companyId)
        .order('points_balance', { ascending: false }),
      supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('customers').select('id, trading_name').eq('profile_id', companyId),
    ]);
    if (error) {
      return NextResponse.json({
        success: true,
        accounts: [],
        transactions: [],
        warning: error.message,
        hint: 'Run 20260709_crm_sales_lifecycle.sql',
      });
    }
    const cMap = Object.fromEntries((customers || []).map((c) => [c.id, c.trading_name]));
    return NextResponse.json({
      success: true,
      accounts: (accounts || []).map((a) => ({
        ...a,
        customer_name: cMap[a.customer_id] || `#${a.customer_id}`,
      })),
      transactions: (txns || []).map((t) => ({
        ...t,
        customer_name: cMap[t.customer_id] || null,
      })),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const customerId = Number(body.customer_id);
    const action = body.action || 'enroll';
    if (!Number.isFinite(companyId) || !Number.isFinite(customerId)) {
      return NextResponse.json({ error: 'companyId and customer_id required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const now = new Date().toISOString();

    let { data: acct } = await supabase
      .from('loyalty_accounts')
      .select('*')
      .eq('profile_id', companyId)
      .eq('customer_id', customerId)
      .maybeSingle();

    if (action === 'enroll' || !acct) {
      if (acct) {
        return NextResponse.json({ success: true, account: acct, already: true });
      }
      const created = await supabase
        .from('loyalty_accounts')
        .insert({
          profile_id: companyId,
          customer_id: customerId,
          points_balance: 0,
          lifetime_earned: 0,
          lifetime_redeemed: 0,
          tier: 'bronze',
          status: 'active',
          enrolled_at: now,
        })
        .select('*')
        .single();
      if (created.error) {
        return NextResponse.json(
          { error: created.error.message, hint: 'Run 20260709_crm_sales_lifecycle.sql' },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, account: created.data });
    }

    // earn | redeem | adjust
    const points = Number(body.points || 0);
    if (!points) return NextResponse.json({ error: 'points required' }, { status: 400 });

    let delta = points;
    if (action === 'redeem') delta = -Math.abs(points);
    else if (action === 'earn') delta = Math.abs(points);

    const balance = Number(acct.points_balance || 0) + delta;
    if (balance < -0.0001) {
      return NextResponse.json({ error: 'Insufficient points' }, { status: 409 });
    }

    const lifetime_earned =
      Number(acct.lifetime_earned || 0) + (delta > 0 ? delta : 0);
    const lifetime_redeemed =
      Number(acct.lifetime_redeemed || 0) + (delta < 0 ? Math.abs(delta) : 0);
    const tier = tierFromLifetime(lifetime_earned);

    const { data: updated, error } = await supabase
      .from('loyalty_accounts')
      .update({
        points_balance: balance,
        lifetime_earned,
        lifetime_redeemed,
        tier,
        updated_at: now,
      })
      .eq('id', acct.id)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('loyalty_transactions').insert({
      profile_id: companyId,
      loyalty_account_id: acct.id,
      customer_id: customerId,
      txn_type: action === 'adjust' ? 'adjust' : delta > 0 ? 'earn' : 'redeem',
      points: delta,
      balance_after: balance,
      notes: body.notes || null,
    });

    return NextResponse.json({ success: true, account: updated });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
