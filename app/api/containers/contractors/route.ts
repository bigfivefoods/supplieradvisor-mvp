import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('container_contractors')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, contractors: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId ?? body.profile_id);
    if (!Number.isFinite(companyId) || !body.full_name) {
      return NextResponse.json({ error: 'companyId and full_name are required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const payload = {
      profile_id: companyId,
      full_name: String(body.full_name).trim(),
      email: body.email || null,
      phone: body.phone || null,
      id_number: body.id_number || null,
      status: body.status || 'active',
      training_status: body.training_status || 'pending',
      bank_details: body.bank_details || {},
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('container_contractors')
      .insert(payload)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, contractor: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of ['full_name', 'email', 'phone', 'id_number', 'status', 'training_status', 'bank_details'] as const) {
      if (body[f] !== undefined) updates[f] = body[f];
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('container_contractors')
      .update(updates)
      .eq('id', Number(body.id))
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, contractor: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('container_contractors').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
