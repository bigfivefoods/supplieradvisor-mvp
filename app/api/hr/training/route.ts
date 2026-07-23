import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';

const HINT =
  'Run supabase/migrations/20260709_world_class_schema.sql and 20260723_hr_people_module.sql';

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

    const employeeId = Number(sp.get('employeeId') || 0);
    const supabase = getSupabaseServer();
    let q = supabase
      .from('training_records')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (employeeId > 0) q = q.eq('employee_id', employeeId);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({
        success: true,
        records: [],
        warning: error.message,
        hint: HINT,
      });
    }
    return NextResponse.json({ success: true, records: data || [] });
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
    if (!Number.isFinite(companyId) || !body.course_name) {
      return NextResponse.json(
        { error: 'companyId and course_name required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const payload = {
      profile_id: companyId,
      employee_id: body.employee_id ? Number(body.employee_id) : null,
      course_name: String(body.course_name).trim(),
      provider: body.provider || null,
      status: body.status || 'assigned',
      due_date: body.due_date || null,
      completed_at: body.completed_at || null,
      score: body.score != null ? Number(body.score) : null,
      certificate_url: body.certificate_url || null,
      metadata: body.metadata || {},
    };

    const { data, error } = await supabase
      .from('training_records')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: HINT },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, record: data }, { status: 201 });
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
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const allowed = [
      'course_name',
      'provider',
      'status',
      'due_date',
      'completed_at',
      'score',
      'certificate_url',
      'employee_id',
    ];
    const patch: Record<string, unknown> = {};
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (body.status === 'completed' && !body.completed_at) {
      patch.completed_at = new Date().toISOString();
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('training_records')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, record: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
