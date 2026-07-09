import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const type = request.nextUrl.searchParams.get('type');
    const status = request.nextUrl.searchParams.get('status');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    let q = supabase
      .from('customer_riad')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(300);
    if (type && type !== 'all') q = q.eq('entry_type', type);
    if (status && status !== 'all') q = q.eq('status', status);

    const [{ data, error }, { data: customers }] = await Promise.all([
      q,
      supabase.from('customers').select('id, trading_name').eq('profile_id', companyId),
    ]);
    if (error) {
      return NextResponse.json({
        success: true,
        entries: [],
        warning: error.message,
        hint: 'Run 20260709_crm_sales_lifecycle.sql',
      });
    }
    const cMap = Object.fromEntries((customers || []).map((c) => [c.id, c.trading_name]));
    const entries = (data || []).map((e) => ({
      ...e,
      customer_name: e.customer_id ? cMap[e.customer_id] : null,
    }));
    const counts = {
      risk: entries.filter((e) => e.entry_type === 'risk' && e.status !== 'closed').length,
      issue: entries.filter((e) => e.entry_type === 'issue' && e.status !== 'closed').length,
      action: entries.filter((e) => e.entry_type === 'action' && e.status !== 'closed').length,
      decision: entries.filter((e) => e.entry_type === 'decision' && e.status !== 'closed').length,
      open: entries.filter((e) => e.status !== 'closed').length,
    };
    return NextResponse.json({ success: true, entries, counts });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || !body.title) {
      return NextResponse.json({ error: 'companyId and title required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('customer_riad')
      .insert({
        profile_id: companyId,
        customer_id: body.customer_id || null,
        entry_type: body.entry_type || 'risk',
        title: String(body.title).trim(),
        description: body.description || null,
        status: body.status || 'open',
        severity: body.severity || 'medium',
        owner_name: body.owner_name || null,
        due_date: body.due_date || null,
        related_order_id: body.related_order_id || null,
        related_claim_id: body.related_claim_id || null,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) {
      return NextResponse.json(
        { error: error.message, hint: 'Run 20260709_crm_sales_lifecycle.sql' },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, entry: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const fields = [
      'title',
      'description',
      'status',
      'severity',
      'owner_name',
      'due_date',
      'entry_type',
      'customer_id',
    ] as const;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }
    if (body.status === 'closed') updates.closed_at = new Date().toISOString();
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('customer_riad')
      .update(updates)
      .eq('id', Number(body.id))
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, entry: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('customer_riad').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
