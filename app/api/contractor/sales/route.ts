import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { assertContractorContainerAccess } from '@/lib/contractor/access';

export async function GET(request: NextRequest) {
  try {
    const containerId = Number(request.nextUrl.searchParams.get('containerId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId') || '';
    const email = request.nextUrl.searchParams.get('email');
    const userId = getCanonicalUserId(privyUserId);

    if (!userId || !Number.isFinite(containerId)) {
      return NextResponse.json({ error: 'containerId and privyUserId required' }, { status: 400 });
    }

    const access = await assertContractorContainerAccess(containerId, privyUserId, email);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('container_sales')
      .select('*')
      .eq('container_id', containerId)
      .order('sale_date', { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, sales: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = getCanonicalUserId(body.privyUserId);
    const containerId = Number(body.containerId);
    const email = body.email ? String(body.email).toLowerCase() : null;
    const amount = Number(body.gross_amount ?? body.amount ?? 0);

    if (!userId || !Number.isFinite(containerId) || amount <= 0) {
      return NextResponse.json(
        { error: 'privyUserId, containerId, and positive amount required' },
        { status: 400 }
      );
    }

    const access = await assertContractorContainerAccess(containerId, body.privyUserId, email);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const supabase = getSupabaseServer();
    const payload = {
      profile_id: access.container.profile_id,
      container_id: containerId,
      contractor_id: access.contractor.id,
      sale_date: body.sale_date || new Date().toISOString().slice(0, 10),
      gross_amount: amount,
      net_amount: Number(body.net_amount ?? amount),
      currency: body.currency || 'ZAR',
      payment_method: body.payment_method || 'cash',
      notes: body.notes || null,
      items: body.items || [],
      created_by: userId,
    };

    const { data, error } = await supabase.from('container_sales').insert(payload).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, sale: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
