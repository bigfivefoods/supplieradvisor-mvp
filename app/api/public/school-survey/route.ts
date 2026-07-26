import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';

/**
 * Public food survey — no auth.
 * GET ?token=… → survey meta + school name
 * POST body { token, rating, … } → response
 */
export async function GET(request: NextRequest) {
  try {
    const token = String(
      request.nextUrl.searchParams.get('token') || ''
    ).trim();
    if (!token || token.length < 8) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: survey, error } = await supabase
      .from('school_food_surveys')
      .select(
        'id, title, audience, meal_type, active, questions, starts_on, ends_on, school_profile_id, response_count, avg_rating'
      )
      .eq('public_token', token)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }
    if (!survey.active) {
      return NextResponse.json(
        { error: 'This survey is closed', closed: true },
        { status: 410 }
      );
    }

    let schoolName = 'School meal survey';
    if (survey.school_profile_id) {
      const { data: school } = await supabase
        .from('school_profiles')
        .select('school_name, photo_url')
        .eq('id', survey.school_profile_id)
        .maybeSingle();
      if (school?.school_name) schoolName = String(school.school_name);
      return NextResponse.json({
        success: true,
        survey: {
          title: survey.title,
          audience: survey.audience,
          meal_type: survey.meal_type,
          questions: survey.questions,
        },
        school: {
          name: schoolName,
          photo_url: school?.photo_url || null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      survey: {
        title: survey.title,
        audience: survey.audience,
        meal_type: survey.meal_type,
        questions: survey.questions,
      },
      school: { name: schoolName, photo_url: null },
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
    const token = String(body.token || '').trim();
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }

    const rating = Number(body.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'rating 1–5 required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { data: survey, error } = await supabase
      .from('school_food_surveys')
      .select('id, school_profile_id, active, response_count, avg_rating')
      .eq('public_token', token)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }
    if (!survey.active) {
      return NextResponse.json({ error: 'Survey closed' }, { status: 410 });
    }

    const clamp = (v: unknown) => {
      if (v == null || v === '') return null;
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      return Math.min(5, Math.max(1, Math.round(n)));
    };

    const row = {
      survey_id: survey.id,
      school_profile_id: survey.school_profile_id,
      rating: Math.round(rating),
      taste: clamp(body.taste),
      portion: clamp(body.portion),
      cleanliness: clamp(body.cleanliness),
      variety: clamp(body.variety),
      would_recommend:
        body.would_recommend === true || body.would_recommend === false
          ? Boolean(body.would_recommend)
          : null,
      comment: body.comment ? String(body.comment).slice(0, 1000) : null,
      respondent_role: body.respondent_role
        ? String(body.respondent_role).slice(0, 40)
        : null,
      grade: body.grade ? String(body.grade).slice(0, 20) : null,
      meal_date: body.meal_date || new Date().toISOString().slice(0, 10),
      answers: body.answers || {},
    };

    const { data: inserted, error: insErr } = await supabase
      .from('school_food_survey_responses')
      .insert(row)
      .select('id')
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    // Rolling avg on survey
    const prevCount = Number(survey.response_count) || 0;
    const prevAvg = Number(survey.avg_rating) || 0;
    const nextCount = prevCount + 1;
    const nextAvg =
      prevCount === 0
        ? rating
        : Math.round(((prevAvg * prevCount + rating) / nextCount) * 100) / 100;

    await supabase
      .from('school_food_surveys')
      .update({
        response_count: nextCount,
        avg_rating: nextAvg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', survey.id);

    return NextResponse.json({
      success: true,
      id: inserted?.id,
      thankYou: true,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
