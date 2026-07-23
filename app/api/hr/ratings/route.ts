import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';

const HINT = 'Run supabase/migrations/20260723_hr_people_lifecycle.sql';

function labelFromScore(score: number): string {
  if (score >= 4.5) return 'exceeds';
  if (score >= 3.5) return 'meets';
  if (score >= 2.5) return 'developing';
  return 'needs_improvement';
}

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
      .from('hr_performance_ratings')
      .select('*')
      .eq('profile_id', companyId)
      .order('rating_date', { ascending: false })
      .limit(300);
    if (employeeId > 0) q = q.eq('employee_id', employeeId);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({
        success: true,
        ratings: [],
        warning: error.message,
        hint: HINT,
      });
    }
    return NextResponse.json({ success: true, ratings: data || [] });
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
    const overall = Number(body.overall_score);
    if (
      !Number.isFinite(companyId) ||
      !Number.isFinite(employeeId) ||
      !Number.isFinite(overall)
    ) {
      return NextResponse.json(
        { error: 'companyId, employee_id, overall_score required' },
        { status: 400 }
      );
    }
    if (overall < 1 || overall > 5) {
      return NextResponse.json(
        { error: 'overall_score must be 1–5' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const rating_label = body.rating_label || labelFromScore(overall);
    const supabase = getSupabaseServer();
    const payload = {
      profile_id: companyId,
      employee_id: employeeId,
      rated_by_employee_id: body.rated_by_employee_id
        ? Number(body.rated_by_employee_id)
        : null,
      rated_by_name: body.rated_by_name || gate.userId || null,
      rating_date: body.rating_date || new Date().toISOString().slice(0, 10),
      period_label: body.period_label || null,
      overall_score: overall,
      rating_label,
      quality_score:
        body.quality_score != null ? Number(body.quality_score) : null,
      delivery_score:
        body.delivery_score != null ? Number(body.delivery_score) : null,
      teamwork_score:
        body.teamwork_score != null ? Number(body.teamwork_score) : null,
      leadership_score:
        body.leadership_score != null ? Number(body.leadership_score) : null,
      comments: body.comments || null,
      is_official: Boolean(body.is_official),
      status: 'active',
    };

    const { data, error } = await supabase
      .from('hr_performance_ratings')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: HINT },
        { status: 400 }
      );
    }

    // Stamp latest rating on employee master
    await supabase
      .from('employees')
      .update({
        last_performance_rating: rating_label,
        last_performance_score: overall,
        last_review_date: payload.rating_date,
        updated_at: new Date().toISOString(),
      })
      .eq('id', employeeId)
      .eq('profile_id', companyId);

    // Also create formal review shell when official
    if (payload.is_official) {
      try {
        await supabase.from('hr_performance_reviews').insert({
          profile_id: companyId,
          employee_id: employeeId,
          reviewer_name: payload.rated_by_name,
          period_label: payload.period_label,
          review_date: payload.rating_date,
          overall_score: overall,
          rating: rating_label,
          strengths: body.comments || null,
          status: 'submitted',
          updated_at: new Date().toISOString(),
        });
      } catch {
        /* soft */
      }
    }

    return NextResponse.json({ success: true, rating: data }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
