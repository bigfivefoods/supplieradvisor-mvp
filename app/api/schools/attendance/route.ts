import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';

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

    const from = sp.get('from') || '';
    const to = sp.get('to') || '';

    const supabase = getSupabaseServer();
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    let q = supabase
      .from('school_attendance_days')
      .select('*')
      .eq('school_profile_id', school.id)
      .order('attendance_date', { ascending: false })
      .limit(500);
    if (from) q = q.gte('attendance_date', from);
    if (to) q = q.lte('attendance_date', to);

    const { data, error: aErr } = await q;
    if (aErr) {
      return NextResponse.json({ error: aErr.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, attendance: data || [] });
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
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    const attendanceDate =
      body.attendance_date || new Date().toISOString().slice(0, 10);
    const enrolled =
      body.enrolled != null
        ? Number(body.enrolled)
        : Number(school.learner_count_enrolled || 0);
    const present = Number(body.present || 0);
    const absent =
      body.absent != null ? Number(body.absent) : Math.max(0, enrolled - present);

    // Replace same-day row for grade (or whole school when grade empty)
    let del = supabase
      .from('school_attendance_days')
      .delete()
      .eq('school_profile_id', school.id)
      .eq('attendance_date', attendanceDate);
    if (body.grade) {
      del = del.eq('grade', body.grade);
    } else {
      del = del.is('grade', null);
    }
    await del;

    const { data, error: iErr } = await supabase
      .from('school_attendance_days')
      .insert({
        school_profile_id: school.id,
        profile_id: companyId,
        attendance_date: attendanceDate,
        grade: body.grade || null,
        enrolled,
        present,
        absent,
        notes: body.notes || null,
        created_by: gate.userId || null,
      })
      .select('*')
      .single();

    if (iErr) {
      return NextResponse.json({ error: iErr.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, attendance: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
