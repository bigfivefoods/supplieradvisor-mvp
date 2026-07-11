import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';

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
    const { data, error } = await supabase
      .from('pm_risks')
      .select('*')
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false });
    if (error) {
      return NextResponse.json({ success: true, risks: [], warning: error.message });
    }
    const risks = (data || []).map((r) => ({
      ...r,
      score: Number(r.likelihood || 0) * Number(r.impact || 0),
    }));
    return NextResponse.json({ success: true, risks });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    if (!String(body.title || '').trim()) {
      return NextResponse.json({ error: 'title required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('pm_risks')
      .insert({
        profile_id: companyId,
        project_id: body.project_id != null ? Number(body.project_id) : null,
        title: String(body.title).trim(),
        description: body.description || null,
        likelihood: Math.min(5, Math.max(1, Number(body.likelihood) || 3)),
        impact: Math.min(5, Math.max(1, Number(body.impact) || 3)),
        status: body.status || 'open',
        mitigation: body.mitigation || null,
        owner_name: body.owner_name || null,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, risk: data }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of [
      'title',
      'description',
      'likelihood',
      'impact',
      'status',
      'mitigation',
      'owner_name',
      'project_id',
    ]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('pm_risks')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, risk: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
