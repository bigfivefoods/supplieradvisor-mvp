import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';

const AREAS = [
  'kitchen',
  'classroom',
  'ablution',
  'grounds',
  'roof',
  'electrical',
  'water',
  'furniture',
  'safety',
  'other',
] as const;

/**
 * School facilities & kitchen maintenance register.
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
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'School not found' }, { status: 503 });
    }

    const status = sp.get('status');
    let q = supabase
      .from('school_maintenance_items')
      .select('*')
      .eq('school_profile_id', school.id)
      .order('created_at', { ascending: false })
      .limit(300);

    if (status && status !== 'all') q = q.eq('status', status);

    const { data, error: listErr } = await q;
    if (listErr) {
      return NextResponse.json({
        success: true,
        items: [],
        summary: emptySummary(),
        areas: AREAS,
        warning: listErr.message,
      });
    }

    const items = data || [];
    return NextResponse.json({
      success: true,
      items,
      summary: summarise(items),
      areas: AREAS,
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
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'School not found' }, { status: 503 });
    }

    const payload = {
      school_profile_id: school.id,
      profile_id: companyId,
      title: String(body.title).slice(0, 200),
      description: body.description ? String(body.description).slice(0, 2000) : null,
      area: body.area || 'other',
      priority: body.priority || 'medium',
      status: body.status || 'open',
      reported_by: body.reported_by || null,
      assigned_to: body.assigned_to || null,
      cost_estimate:
        body.cost_estimate != null && body.cost_estimate !== ''
          ? Number(body.cost_estimate)
          : null,
      due_date: body.due_date || null,
      photo_url: body.photo_url || null,
      notes: body.notes || null,
      linked_riad_id: body.linked_riad_id || null,
      metadata: body.metadata || {},
    };

    const { data, error: insErr } = await supabase
      .from('school_maintenance_items')
      .insert(payload)
      .select('*')
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    // Optional: auto-create RIAD issue for high/critical
    if (
      body.createRiad !== false &&
      ['high', 'critical'].includes(String(payload.priority))
    ) {
      try {
        const { data: riad } = await supabase
          .from('riad_logs')
          .insert({
            profile_id: companyId,
            module: 'schools',
            riad_type: 'issue',
            title: `Maintenance: ${payload.title}`,
            description: payload.description,
            status: 'open',
            severity: payload.priority,
            priority: payload.priority,
            category: 'Facilities & buildings',
            owner_name: payload.assigned_to,
            due_date: payload.due_date,
            metadata: {
              school_profile_id: school.id,
              maintenance_id: data.id,
              area: payload.area,
            },
          })
          .select('id')
          .single();
        if (riad?.id) {
          await supabase
            .from('school_maintenance_items')
            .update({ linked_riad_id: riad.id })
            .eq('id', data.id);
          data.linked_riad_id = riad.id;
        }
      } catch {
        /* soft */
      }
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

    const supabase = getSupabaseServer();
    const { school } = await getOrCreateSchoolProfile(supabase, companyId);
    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 503 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of [
      'title',
      'description',
      'area',
      'priority',
      'status',
      'reported_by',
      'assigned_to',
      'cost_estimate',
      'cost_actual',
      'due_date',
      'photo_url',
      'notes',
      'linked_riad_id',
    ]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }
    if (body.status === 'done' && !body.completed_at) {
      updates.completed_at = new Date().toISOString();
    }
    if (body.status && body.status !== 'done') {
      updates.completed_at = null;
    }

    const { data, error } = await supabase
      .from('school_maintenance_items')
      .update(updates)
      .eq('id', id)
      .eq('school_profile_id', school.id)
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
    const { school } = await getOrCreateSchoolProfile(supabase, companyId);
    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 503 });
    }

    const { error } = await supabase
      .from('school_maintenance_items')
      .delete()
      .eq('id', id)
      .eq('school_profile_id', school.id);

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
    inProgress: 0,
    done: 0,
    critical: 0,
  };
}

function summarise(items: Array<Record<string, unknown>>) {
  const s = emptySummary();
  s.total = items.length;
  for (const it of items) {
    const st = String(it.status || 'open').toLowerCase();
    if (st === 'done' || st === 'cancelled') s.done += 1;
    else if (st === 'in_progress' || st === 'waiting_parts') s.inProgress += 1;
    else s.open += 1;
    if (String(it.priority || '').toLowerCase() === 'critical') s.critical += 1;
  }
  return s;
}
