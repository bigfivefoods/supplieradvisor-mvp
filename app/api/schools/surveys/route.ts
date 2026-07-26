import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';

function newToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * School food satisfaction surveys — create/list for principals;
 * public responses go through /api/public/school-survey.
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

    const surveyId = sp.get('id') ? Number(sp.get('id')) : null;

    if (surveyId && Number.isFinite(surveyId)) {
      const { data: survey, error: sErr } = await supabase
        .from('school_food_surveys')
        .select('*')
        .eq('id', surveyId)
        .eq('school_profile_id', school.id)
        .maybeSingle();
      if (sErr) {
        return NextResponse.json({ error: sErr.message }, { status: 400 });
      }
      if (!survey) {
        return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
      }
      const { data: responses } = await supabase
        .from('school_food_survey_responses')
        .select('*')
        .eq('survey_id', surveyId)
        .order('created_at', { ascending: false })
        .limit(200);
      return NextResponse.json({
        success: true,
        survey,
        responses: responses || [],
        publicPath: `/s/food/${survey.public_token}`,
      });
    }

    const { data: surveys, error: listErr } = await supabase
      .from('school_food_surveys')
      .select('*')
      .eq('school_profile_id', school.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (listErr) {
      return NextResponse.json({
        success: true,
        surveys: [],
        summary: emptySummary(),
        warning: listErr.message,
      });
    }

    const items = surveys || [];
    const summary = {
      total: items.length,
      active: items.filter((s) => s.active).length,
      responses: items.reduce(
        (n, s) => n + (Number(s.response_count) || 0),
        0
      ),
      avgRating: avgOf(
        items.map((s) => Number(s.avg_rating)).filter((n) => Number.isFinite(n) && n > 0)
      ),
    };

    return NextResponse.json({ success: true, surveys: items, summary });
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

    const supabase = getSupabaseServer();
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'School not found' }, { status: 503 });
    }

    const token = newToken();
    const payload = {
      school_profile_id: school.id,
      profile_id: companyId,
      title: String(body.title || 'How was your school meal?').slice(0, 200),
      audience: String(body.audience || 'learner').slice(0, 40),
      public_token: token,
      active: body.active !== false,
      meal_type: String(body.meal_type || 'lunch').slice(0, 40),
      questions: body.questions || [
        { id: 'taste', label: 'Taste' },
        { id: 'portion', label: 'Portion size' },
        { id: 'cleanliness', label: 'Cleanliness' },
        { id: 'variety', label: 'Variety' },
      ],
      starts_on: body.starts_on || null,
      ends_on: body.ends_on || null,
    };

    const { data, error: insErr } = await supabase
      .from('school_food_surveys')
      .insert(payload)
      .select('*')
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      survey: data,
      publicPath: `/s/food/${token}`,
    });
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
      'audience',
      'active',
      'meal_type',
      'questions',
      'starts_on',
      'ends_on',
    ]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }

    const { data, error } = await supabase
      .from('school_food_surveys')
      .update(updates)
      .eq('id', id)
      .eq('school_profile_id', school.id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, survey: data });
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
      .from('school_food_surveys')
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
  return { total: 0, active: 0, responses: 0, avgRating: null as number | null };
}

function avgOf(nums: number[]) {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}
