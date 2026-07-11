import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { docNumber } from '@/lib/customers/documents';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const supabase = getSupabaseServer();
    const [{ data, error }, { data: customers }] = await Promise.all([
      supabase
        .from('customer_claims')
        .select('*')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false }),
      supabase.from('customers').select('id, trading_name').eq('profile_id', companyId),
    ]);
    if (error) {
      return NextResponse.json({
        success: true,
        claims: [],
        warning: error.message,
        hint: 'Run 20260709_crm_sales_lifecycle.sql',
      });
    }
    const cMap = Object.fromEntries((customers || []).map((c) => [c.id, c.trading_name]));
    return NextResponse.json({
      success: true,
      claims: (data || []).map((c) => ({
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

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('customer_claims')
      .insert({
        profile_id: companyId,
        customer_id: body.customer_id || null,
        order_id: body.order_id || null,
        invoice_id: body.invoice_id || null,
        claim_number: body.claim_number || docNumber('CLM'),
        claim_type: body.claim_type || 'quality',
        status: body.status || 'open',
        priority: body.priority || 'medium',
        title: String(body.title).trim(),
        description: body.description || null,
        amount_claimed: Number(body.amount_claimed || 0),
        amount_approved: Number(body.amount_approved || 0),
        currency: body.currency || 'ZAR',
        owner_name: body.owner_name || null,
        opened_at: new Date().toISOString(),
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
    return NextResponse.json({ success: true, claim: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const fields = [
      'status',
      'priority',
      'title',
      'description',
      'amount_claimed',
      'amount_approved',
      'resolution_notes',
      'owner_name',
      'claim_type',
    ] as const;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }
    if (['resolved', 'closed', 'approved', 'rejected'].includes(String(body.status))) {
      updates.resolved_at = new Date().toISOString();
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('customer_claims')
      .update(updates)
      .eq('id', Number(body.id))
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, claim: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('customer_claims').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
