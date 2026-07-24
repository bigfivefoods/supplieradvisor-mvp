import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember } from '@/lib/customers/access';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';
import {
  MIGRATION_HINT,
  PROGRAMME_STATUSES,
} from '@/lib/projects/types';

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
      .from('pm_programmes')
      .select('*')
      .eq('profile_id', companyId)
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({
        success: true,
        programmes: [],
        warning: error.message,
        hint: MIGRATION_HINT,
      });
    }

    const programmes = data || [];
    const ids = programmes.map((p) => p.id);
    let projectCounts: Record<number, { total: number; active: number }> = {};
    if (ids.length) {
      const { data: projects } = await supabase
        .from('pm_projects')
        .select('id, programme_id, status')
        .eq('profile_id', companyId)
        .in('programme_id', ids);
      for (const p of projects || []) {
        const pid = Number(p.programme_id);
        if (!pid) continue;
        const c = projectCounts[pid] || { total: 0, active: 0 };
        c.total += 1;
        if (p.status === 'active' || p.status === 'planning') c.active += 1;
        projectCounts[pid] = c;
      }
    }

    return NextResponse.json({
      success: true,
      programmes: programmes.map((p) => ({
        ...p,
        project_stats: projectCounts[p.id] || { total: 0, active: 0 },
      })),
      summary: {
        total: programmes.length,
        active: programmes.filter((p) => p.status === 'active').length,
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
    if (!String(body.name || '').trim()) {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }

    const status = PROGRAMME_STATUSES.includes(body.status)
      ? body.status
      : 'active';

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('pm_programmes')
      .insert({
        profile_id: companyId,
        name: String(body.name).trim(),
        code: body.code ? String(body.code).trim() : null,
        description: body.description || null,
        status,
        owner_name: body.owner_name || null,
        sponsor_name: body.sponsor_name || null,
        budget: body.budget != null ? Number(body.budget) : null,
        currency: body.currency || 'ZAR',
        start_date: body.start_date || null,
        target_date: body.target_date || null,
        health: body.health || 'green',
        strategic_theme: body.strategic_theme || null,
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
    return NextResponse.json({ success: true, programme: data }, { status: 201 });
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
      'name',
      'code',
      'description',
      'status',
      'owner_name',
      'sponsor_name',
      'budget',
      'currency',
      'start_date',
      'target_date',
      'health',
      'strategic_theme',
      'metadata',
    ]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('pm_programmes')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, programme: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
