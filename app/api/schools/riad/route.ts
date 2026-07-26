import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import { isClosedLike } from '@/lib/schools/riad';

/**
 * School RIAD register — risks, issues, actions, decisions (module=schools).
 */
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
    const type = sp.get('type');
    const status = sp.get('status');

    let q = supabase
      .from('riad_logs')
      .select('*')
      .eq('profile_id', companyId)
      .or('module.eq.schools,module.eq.school,module.eq.nsnp')
      .order('created_at', { ascending: false })
      .limit(500);

    if (type && type !== 'all') q = q.eq('riad_type', type);
    // "open" means not closed/resolved (principal default view)
    if (status && status !== 'all' && status !== 'open') {
      q = q.eq('status', status);
    }

    const { data, error } = await q;
    if (error) {
      // fallback without module filter
      const retry = await supabase
        .from('riad_logs')
        .select('*')
        .eq('profile_id', companyId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (retry.error) {
        return NextResponse.json({
          success: true,
          items: [],
          summary: emptySummary(),
          warning: error.message,
        });
      }
      let retryItems = retry.data || [];
      if (status === 'open') {
        retryItems = retryItems.filter(
          (it) => !isClosedLike(String(it.status || ''))
        );
      }
      return NextResponse.json({
        success: true,
        items: retryItems,
        summary: summarise(retryItems),
      });
    }

    let items = data || [];
    if (status === 'open') {
      items = items.filter((it) => !isClosedLike(String(it.status || '')));
    }
    return NextResponse.json({
      success: true,
      items,
      summary: summarise(items),
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
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    if (!body.title) {
      return NextResponse.json({ error: 'title required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { school } = await getOrCreateSchoolProfile(supabase, companyId);
    const riadType = body.entry_type || body.riad_type || 'risk';

    const payload: Record<string, unknown> = {
      profile_id: companyId,
      module: 'schools',
      riad_type: riadType,
      title: String(body.title),
      description: body.description || null,
      status: body.status || 'open',
      severity: body.severity || body.priority || 'medium',
      priority: body.priority || body.severity || 'medium',
      category: body.category || null,
      owner_name: body.owner_name || null,
      due_date: body.due_date || null,
      mitigation_plan: body.mitigation_plan || null,
      notes: body.notes || null,
      stakeholder_name: body.category || 'School operations',
      metadata: {
        school_profile_id: school?.id ?? null,
        domain: 'nsnp_school',
        ...(body.metadata || {}),
      },
      created_by: gate.userId || null,
    };

    let { data, error } = await supabase
      .from('riad_logs')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      const minimal = {
        profile_id: companyId,
        title: payload.title,
        description: payload.description,
        status: payload.status,
        riad_type: riadType,
        module: 'schools',
      };
      const retry = await supabase
        .from('riad_logs')
        .insert(minimal)
        .select('*')
        .single();
      if (retry.error) {
        return NextResponse.json({ error: retry.error.message }, { status: 400 });
      }
      data = retry.data;
    }

    return NextResponse.json({ success: true, item: data });
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
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of [
      'title',
      'description',
      'status',
      'severity',
      'priority',
      'category',
      'owner_name',
      'due_date',
      'mitigation_plan',
      'notes',
      'resolution',
    ]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }
    if (body.entry_type || body.riad_type) {
      updates.riad_type = body.entry_type || body.riad_type;
    }
    if (isClosedLike(String(body.status || '')) && !updates.resolution) {
      updates.resolution = body.resolution || 'Closed';
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('riad_logs')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, item: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const id = Number(sp.get('id'));
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('riad_logs')
      .delete()
      .eq('id', id)
      .eq('profile_id', companyId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function emptySummary() {
  return {
    total: 0,
    open: 0,
    closed: 0,
    inProgress: 0,
    onHold: 0,
    critical: 0,
    byStatus: {} as Record<string, number>,
  };
}

function summarise(items: Array<Record<string, unknown>>) {
  const s = emptySummary();
  s.total = items.length;
  for (const it of items) {
    const st = String(it.status || 'open').toLowerCase();
    s.byStatus[st] = (s.byStatus[st] || 0) + 1;
    if (isClosedLike(st)) s.closed += 1;
    else if (st === 'in_progress') s.inProgress += 1;
    else if (st === 'on_hold') s.onHold += 1;
    else s.open += 1;
    const sev = String(it.severity || it.priority || '').toLowerCase();
    if (sev === 'critical') s.critical += 1;
  }
  return s;
}
