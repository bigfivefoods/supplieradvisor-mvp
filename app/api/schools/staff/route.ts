import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  getOrCreateSchoolProfile,
  refreshSchoolCounts,
} from '@/lib/schools/school-context';
import { parseStaffCsv, staffTemplateCsv } from '@/lib/schools/import';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    if (sp.get('template') === '1') {
      return new NextResponse(staffTemplateCsv(), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition':
            'attachment; filename="NSNP_Staff_Import_Template.csv"',
        },
      });
    }
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
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    const { data, error: sErr } = await supabase
      .from('school_staff')
      .select('*')
      .eq('school_profile_id', school.id)
      .eq('profile_id', companyId)
      .order('last_name', { ascending: true })
      .limit(1000);

    if (sErr) {
      return NextResponse.json({ error: sErr.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, staff: data || [] });
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
    const schoolId = Number(school.id);

    if (body.csv != null || body.import === true) {
      const parsed = parseStaffCsv(String(body.csv || ''));
      if (!parsed.rows.length) {
        return NextResponse.json(
          { error: 'No valid staff rows', parseErrors: parsed.errors },
          { status: 400 }
        );
      }
      const { data: batch } = await supabase
        .from('school_import_batches')
        .insert({
          school_profile_id: schoolId,
          profile_id: companyId,
          kind: 'staff',
          file_name: body.fileName || 'staff.csv',
          row_count: parsed.rows.length,
          created_by: gate.userId || null,
        })
        .select('id')
        .single();

      const inserts = parsed.rows.map((r) => ({
        school_profile_id: schoolId,
        profile_id: companyId,
        external_id: r.external_id || null,
        first_name: r.first_name,
        last_name: r.last_name,
        role: r.role || 'teacher',
        email: r.email || null,
        phone: r.phone || null,
        phase: r.phase || null,
        verification_status: 'draft',
        status: 'active',
        import_batch_id: batch?.id != null ? Number(batch.id) : null,
      }));

      const { error: iErr, data } = await supabase
        .from('school_staff')
        .insert(inserts)
        .select('id');
      if (iErr) {
        return NextResponse.json({ error: iErr.message }, { status: 400 });
      }
      await refreshSchoolCounts(supabase, schoolId, companyId);
      return NextResponse.json({
        success: true,
        imported: data?.length || inserts.length,
        parseErrors: parsed.errors,
      });
    }

    if (!body.first_name || !body.last_name) {
      return NextResponse.json(
        { error: 'first_name and last_name required' },
        { status: 400 }
      );
    }

    const { data, error: cErr } = await supabase
      .from('school_staff')
      .insert({
        school_profile_id: schoolId,
        profile_id: companyId,
        first_name: String(body.first_name),
        last_name: String(body.last_name),
        role: body.role || 'teacher',
        email: body.email || null,
        phone: body.phone || null,
        phase: body.phase || null,
        verification_status: body.verification_status || 'draft',
        status: 'active',
      })
      .select('*')
      .single();

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 400 });
    }
    await refreshSchoolCounts(supabase, schoolId, companyId);
    return NextResponse.json({ success: true, staff: data });
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
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { school } = await getOrCreateSchoolProfile(supabase, companyId);
    if (!school) {
      return NextResponse.json({ error: 'No school' }, { status: 503 });
    }

    if (Array.isArray(body.ids) && body.verification_status) {
      const ids = body.ids.map(Number).filter((n: number) => Number.isFinite(n));
      const st = String(body.verification_status);
      const { error } = await supabase
        .from('school_staff')
        .update({
          verification_status: st,
          verified_at: ['school_verified', 'attested'].includes(st)
            ? new Date().toISOString()
            : null,
          verified_by: gate.userId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', companyId)
        .in('id', ids);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, updated: ids.length });
    }

    const id = Number(body.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of [
      'first_name',
      'last_name',
      'role',
      'email',
      'phone',
      'phase',
      'status',
      'verification_status',
    ]) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (
      body.verification_status &&
      ['school_verified', 'attested'].includes(String(body.verification_status))
    ) {
      patch.verified_at = new Date().toISOString();
      patch.verified_by = gate.userId || null;
    }

    const { data, error } = await supabase
      .from('school_staff')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, staff: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
