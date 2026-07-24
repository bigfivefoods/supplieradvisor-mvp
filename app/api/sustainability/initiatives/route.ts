import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { MIGRATION_HINT } from '@/lib/sustainability/types';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('esg_initiatives')
      .select('*')
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({
        success: true,
        initiatives: [],
        warning: error.message,
        hint: MIGRATION_HINT,
      });
    }

    const initiatives = data || [];
    return NextResponse.json({
      success: true,
      initiatives,
      summary: {
        total: initiatives.length,
        in_progress: initiatives.filter((i) => i.status === 'in_progress').length,
        completed: initiatives.filter((i) => i.status === 'completed').length,
        planned: initiatives.filter((i) => i.status === 'planned').length,
      },
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
    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!String(body.title || '').trim()) {
      return NextResponse.json({ error: 'title required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('esg_initiatives')
      .insert({
        profile_id: companyId,
        title: String(body.title).trim(),
        description: body.description || null,
        pillar: body.pillar || 'environment',
        status: body.status || 'planned',
        owner_name: body.owner_name || null,
        target_id: body.target_id ? Number(body.target_id) : null,
        project_id: body.project_id ? Number(body.project_id) : null,
        sdg_goal: body.sdg_goal != null ? Number(body.sdg_goal) : null,
        start_date: body.start_date || null,
        target_date: body.target_date || null,
        estimated_impact: body.estimated_impact || null,
        progress: body.progress != null ? Number(body.progress) : 0,
        health: body.health || 'green',
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
    return NextResponse.json({ success: true, initiative: data }, { status: 201 });
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
      'description',
      'pillar',
      'status',
      'owner_name',
      'target_id',
      'project_id',
      'sdg_goal',
      'start_date',
      'target_date',
      'estimated_impact',
      'progress',
      'health',
      'metadata',
    ]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('esg_initiatives')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, initiative: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
