import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { docNumber } from '@/lib/customers/documents';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const [{ data, error }, { data: customers }] = await Promise.all([
      supabase
        .from('customer_contracts')
        .select('*')
        .eq('profile_id', companyId)
        .order('updated_at', { ascending: false }),
      supabase.from('customers').select('id, trading_name').eq('profile_id', companyId),
    ]);
    if (error) {
      return NextResponse.json({
        success: true,
        contracts: [],
        warning: error.message,
        hint: 'Run 20260709_crm_sales_lifecycle.sql',
      });
    }
    const cMap = Object.fromEntries((customers || []).map((c) => [c.id, c.trading_name]));
    return NextResponse.json({
      success: true,
      contracts: (data || []).map((c) => ({
        ...c,
        customer_name: cMap[c.customer_id] || null,
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
    if (!Number.isFinite(companyId) || !body.title) {
      return NextResponse.json({ error: 'companyId and title required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('customer_contracts')
      .insert({
        profile_id: companyId,
        customer_id: body.customer_id || null,
        contract_number: body.contract_number || docNumber('CTR'),
        title: String(body.title).trim(),
        status: body.status || 'draft',
        contract_type: body.contract_type || 'supply',
        start_date: body.start_date || null,
        end_date: body.end_date || null,
        auto_renew: !!body.auto_renew,
        value: Number(body.value || 0),
        currency: body.currency || 'ZAR',
        payment_terms: body.payment_terms || null,
        sla_summary: body.sla_summary || null,
        notes: body.notes || null,
        owner_name: body.owner_name || null,
        signed_at: body.status === 'active' ? new Date().toISOString() : null,
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
    return NextResponse.json({ success: true, contract: data });
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
      'status',
      'contract_type',
      'start_date',
      'end_date',
      'auto_renew',
      'value',
      'currency',
      'payment_terms',
      'sla_summary',
      'notes',
      'owner_name',
      'customer_id',
    ] as const;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }
    if (body.status === 'active' && body.signed_at === undefined) {
      updates.signed_at = new Date().toISOString();
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('customer_contracts')
      .update(updates)
      .eq('id', Number(body.id))
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, contract: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('customer_contracts').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
