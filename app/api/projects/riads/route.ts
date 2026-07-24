import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { MIGRATION_HINT, RIAD_TYPES } from '@/lib/projects/types';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const projectId = Number(sp.get('projectId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    let q = supabase
      .from('pm_project_riads')
      .select('*')
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false })
      .limit(300);
    if (Number.isFinite(projectId) && projectId > 0) {
      q = q.eq('project_id', projectId);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({
        success: true,
        riads: [],
        warning: error.message,
        hint: MIGRATION_HINT,
      });
    }

    const riads = data || [];
    const byType: Record<string, number> = {};
    for (const t of RIAD_TYPES) byType[t.value] = 0;
    let open = 0;
    for (const r of riads) {
      const ty = String(r.riad_type || 'risk');
      byType[ty] = (byType[ty] || 0) + 1;
      if (['open', 'active', 'in_progress'].includes(String(r.status))) open++;
    }

    return NextResponse.json({
      success: true,
      riads,
      summary: { total: riads.length, open, byType },
    });
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
    const projectId = Number(body.project_id ?? body.projectId);
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!Number.isFinite(projectId) || !String(body.title || '').trim()) {
      return NextResponse.json(
        { error: 'project_id and title required' },
        { status: 400 }
      );
    }

    const riadType = RIAD_TYPES.some((t) => t.value === body.riad_type)
      ? body.riad_type
      : 'risk';

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('pm_project_riads')
      .insert({
        profile_id: companyId,
        project_id: projectId,
        riad_log_id: body.riad_log_id ? Number(body.riad_log_id) : null,
        title: String(body.title).trim(),
        riad_type: riadType,
        status: body.status || 'open',
        severity: body.severity || 'medium',
        rpn: body.rpn != null ? Number(body.rpn) : null,
        description: body.description || null,
        owner_name: body.owner_name || null,
        due_date: body.due_date || null,
        created_by: mem.userId,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: MIGRATION_HINT },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: true, riad: data }, { status: 201 });
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
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of [
      'title',
      'riad_type',
      'status',
      'severity',
      'rpn',
      'description',
      'owner_name',
      'due_date',
      'metadata',
    ]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('pm_project_riads')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, riad: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
