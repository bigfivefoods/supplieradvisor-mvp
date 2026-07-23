import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';

const HINT = 'Run supabase/migrations/20260723_hr_people_module.sql';

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
      .from('hr_performance_reviews')
      .select('*')
      .eq('profile_id', companyId)
      .order('review_date', { ascending: false })
      .limit(200);
    if (employeeId > 0) q = q.eq('employee_id', employeeId);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({
        success: true,
        reviews: [],
        warning: error.message,
        hint: HINT,
      });
    }
    return NextResponse.json({ success: true, reviews: data || [] });
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
    const employeeId = Number(body.employee_id);
    if (!Number.isFinite(companyId) || !Number.isFinite(employeeId)) {
      return NextResponse.json(
        { error: 'companyId and employee_id required' },
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
      employee_id: employeeId,
      reviewer_name: body.reviewer_name || null,
      period_label: body.period_label || null,
      review_date: body.review_date || new Date().toISOString().slice(0, 10),
      overall_score:
        body.overall_score != null ? Number(body.overall_score) : null,
      rating: body.rating || null,
      goals: body.goals || null,
      strengths: body.strengths || null,
      improvements: body.improvements || null,
      status: body.status || 'draft',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('hr_performance_reviews')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: HINT },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, review: data }, { status: 201 });
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
      'reviewer_name',
      'period_label',
      'review_date',
      'overall_score',
      'rating',
      'goals',
      'strengths',
      'improvements',
      'status',
    ];
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('hr_performance_reviews')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, review: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
