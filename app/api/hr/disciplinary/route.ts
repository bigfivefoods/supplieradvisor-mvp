import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';

const HINT = 'Run supabase/migrations/20260723_hr_people_lifecycle.sql';

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
    const status = sp.get('status');
    const caseId = Number(sp.get('caseId') || 0);
    const supabase = getSupabaseServer();

    if (caseId > 0) {
      const { data: row, error } = await supabase
        .from('hr_disciplinary_cases')
        .select('*')
        .eq('id', caseId)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (error || !row) {
        return NextResponse.json(
          { error: error?.message || 'Case not found', hint: HINT },
          { status: 404 }
        );
      }
      const { data: events } = await supabase
        .from('hr_disciplinary_events')
        .select('*')
        .eq('case_id', caseId)
        .order('event_date', { ascending: false });
      return NextResponse.json({
        success: true,
        case: row,
        events: events || [],
      });
    }

    let q = supabase
      .from('hr_disciplinary_cases')
      .select('*')
      .eq('profile_id', companyId)
      .order('raised_date', { ascending: false })
      .limit(200);
    if (employeeId > 0) q = q.eq('employee_id', employeeId);
    if (status && status !== 'all') q = q.eq('status', status);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({
        success: true,
        cases: [],
        warning: error.message,
        hint: HINT,
      });
    }
    return NextResponse.json({ success: true, cases: data || [] });
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

    // Timeline event on existing case
    if (body.action === 'add_event') {
      const caseId = Number(body.case_id);
      if (!Number.isFinite(companyId) || !Number.isFinite(caseId) || !body.summary) {
        return NextResponse.json(
          { error: 'companyId, case_id, summary required' },
          { status: 400 }
        );
      }
      const gate = await requireCompanyAccess(request, companyId, {
        legacyPrivyUserId: legacyPrivyFrom(request, body),
      });
      if (!gate.ok) return gate.response;
      const supabase = getSupabaseServer();
      const { data, error } = await supabase
        .from('hr_disciplinary_events')
        .insert({
          profile_id: companyId,
          case_id: caseId,
          event_type: body.event_type || 'note',
          summary: String(body.summary).trim(),
          actor_name: body.actor_name || gate.userId || null,
        })
        .select('*')
        .single();
      if (error) {
        return NextResponse.json(
          { error: error.message, hint: HINT },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, event: data }, { status: 201 });
    }

    if (!Number.isFinite(companyId) || !Number.isFinite(employeeId) || !body.title) {
      return NextResponse.json(
        { error: 'companyId, employee_id, title required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { count } = await supabase
      .from('hr_disciplinary_cases')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', companyId);
    const case_number =
      body.case_number ||
      `DISC-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`;

    // Pull BU from employee if not provided
    let business_unit_id = body.business_unit_id
      ? Number(body.business_unit_id)
      : null;
    let work_center_id = body.work_center_id
      ? Number(body.work_center_id)
      : null;
    if (!business_unit_id) {
      const { data: emp } = await supabase
        .from('employees')
        .select('business_unit_id, work_center_id')
        .eq('id', employeeId)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (emp?.business_unit_id) business_unit_id = Number(emp.business_unit_id);
      if (!work_center_id && emp?.work_center_id) {
        work_center_id = Number(emp.work_center_id);
      }
    }

    const payload = {
      profile_id: companyId,
      employee_id: employeeId,
      case_number,
      case_type: body.case_type || 'misconduct',
      severity: body.severity || 'verbal',
      title: String(body.title).trim(),
      description: body.description || null,
      incident_date: body.incident_date || null,
      raised_date: body.raised_date || new Date().toISOString().slice(0, 10),
      raised_by: body.raised_by || gate.userId || null,
      status: body.status || 'open',
      outcome: body.outcome || null,
      hearing_date: body.hearing_date || null,
      business_unit_id,
      work_center_id,
      related_policy: body.related_policy || null,
      notes: body.notes || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('hr_disciplinary_cases')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: HINT },
        { status: 400 }
      );
    }

    await supabase.from('hr_disciplinary_events').insert({
      profile_id: companyId,
      case_id: data.id,
      event_type: 'note',
      summary: `Case opened: ${payload.title}`,
      actor_name: gate.userId || null,
    });

    // Mirror status onto employee
    const severity = String(payload.severity);
    const discStatus =
      severity === 'dismissal'
        ? 'dismissal_pending'
        : severity === 'suspension'
          ? 'suspension'
          : severity === 'final'
            ? 'final'
            : severity === 'written'
              ? 'written'
              : severity === 'verbal'
                ? 'verbal'
                : 'clear';
    await supabase
      .from('employees')
      .update({
        disciplinary_status: discStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', employeeId)
      .eq('profile_id', companyId);

    return NextResponse.json({ success: true, case: data }, { status: 201 });
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
      'case_type',
      'severity',
      'title',
      'description',
      'incident_date',
      'status',
      'outcome',
      'hearing_date',
      'sanction_start',
      'sanction_end',
      'appeal_deadline',
      'related_policy',
      'notes',
      'business_unit_id',
      'work_center_id',
    ];
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }

    const supabase = getSupabaseServer();
    const { data: prev } = await supabase
      .from('hr_disciplinary_cases')
      .select('*')
      .eq('id', id)
      .eq('profile_id', companyId)
      .maybeSingle();

    const { data, error } = await supabase
      .from('hr_disciplinary_cases')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (prev && body.status && body.status !== prev.status) {
      await supabase.from('hr_disciplinary_events').insert({
        profile_id: companyId,
        case_id: id,
        event_type: String(body.status),
        summary: `Status → ${body.status}${body.outcome ? ` · outcome ${body.outcome}` : ''}`,
        actor_name: gate.userId || null,
      });
    }

    if (data?.employee_id && (body.status === 'closed' || body.outcome)) {
      const outcome = String(body.outcome || data.outcome || '');
      let disc = 'clear';
      if (outcome.includes('dismissal')) disc = 'dismissal_pending';
      else if (outcome.includes('suspension')) disc = 'suspension';
      else if (outcome.includes('final')) disc = 'final';
      else if (outcome.includes('written')) disc = 'written';
      else if (outcome.includes('verbal')) disc = 'verbal';
      else if (body.status === 'closed' && !outcome) disc = 'clear';
      await supabase
        .from('employees')
        .update({
          disciplinary_status: disc,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.employee_id)
        .eq('profile_id', companyId);
    }

    return NextResponse.json({ success: true, case: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
