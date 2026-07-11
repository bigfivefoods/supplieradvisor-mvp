import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const projectId = Number(sp.get('projectId'));
    const privyUserId = sp.get('privyUserId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;
    const supabase = getSupabaseServer();
    let q = supabase
      .from('pm_milestones')
      .select('*, pm_projects(name)')
      .eq('profile_id', companyId)
      .order('due_date', { ascending: true, nullsFirst: false });
    if (Number.isFinite(projectId) && projectId > 0) q = q.eq('project_id', projectId);
    const { data, error } = await q.limit(300);
    if (error) {
      // fallback without join
      const { data: rows, error: e2 } = await supabase
        .from('pm_milestones')
        .select('*')
        .eq('profile_id', companyId)
        .order('due_date', { ascending: true });
      if (e2) {
        return NextResponse.json({
          success: true,
          milestones: [],
          warning: e2.message,
        });
      }
      return NextResponse.json({ success: true, milestones: rows || [] });
    }
    return NextResponse.json({ success: true, milestones: data || [] });
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
    const projectId = Number(body.project_id);
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) return NextResponse.json({ error: mem.error }, { status: mem.status });
    if (!Number.isFinite(projectId) || !String(body.title || '').trim()) {
      return NextResponse.json({ error: 'project_id and title required' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('pm_milestones')
      .insert({
        profile_id: companyId,
        project_id: projectId,
        title: String(body.title).trim(),
        due_date: body.due_date || null,
        status: body.status || 'open',
        done: false,
        sort_order: Number(body.sort_order) || 0,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, milestone: data }, { status: 201 });
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
    if (body.title != null) updates.title = body.title;
    if (body.due_date !== undefined) updates.due_date = body.due_date;
    if (body.status != null) updates.status = body.status;
    if (body.done === true) {
      updates.done = true;
      updates.status = 'done';
      updates.completed_at = new Date().toISOString();
    } else if (body.done === false) {
      updates.done = false;
      updates.status = 'open';
      updates.completed_at = null;
    }
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('pm_milestones')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, milestone: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
