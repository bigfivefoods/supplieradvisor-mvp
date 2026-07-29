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
import {
  buildLearnerTemplateAXlsx,
  LEARNER_XLSX_MIME,
  learnerTemplateCsv,
  parseLearnerFile,
} from '@/lib/schools/import';
import { maskName, privacyEnabled } from '@/lib/schools/privacy';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const template = String(sp.get('template') || '');

    // Template A — Excel .xlsx (preferred)
    if (
      template === '1' ||
      template === 'xlsx' ||
      template === 'a' ||
      template === 'A'
    ) {
      const format = String(sp.get('format') || 'xlsx').toLowerCase();
      if (format === 'csv') {
        return new NextResponse(learnerTemplateCsv(), {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition':
              'attachment; filename="NSNP_Learners_Template_A.csv"',
          },
        });
      }
      const bytes = buildLearnerTemplateAXlsx({ includeExamples: true });
      return new NextResponse(Buffer.from(bytes), {
        headers: {
          'Content-Type': LEARNER_XLSX_MIME,
          'Content-Disposition':
            'attachment; filename="NSNP_Learners_Template_A.xlsx"',
          'Cache-Control': 'no-store',
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

    const q = String(sp.get('q') || '').trim();
    const status = String(sp.get('verification') || '').trim();
    const grade = String(sp.get('grade') || '').trim();

    let query = supabase
      .from('school_learners')
      .select('*')
      .eq('school_profile_id', school.id)
      .eq('profile_id', companyId)
      .order('last_name', { ascending: true })
      .limit(2000);

    if (status) query = query.eq('verification_status', status);
    if (grade) query = query.eq('grade', grade);

    const { data, error: lErr } = await query;
    if (lErr) {
      return NextResponse.json({ error: lErr.message }, { status: 400 });
    }

    let learners = data || [];
    if (q) {
      const qq = q.toLowerCase();
      learners = learners.filter((l) => {
        const hay =
          `${l.first_name} ${l.last_name} ${l.external_id || ''} ${l.grade || ''} ${l.class_name || ''}`
            .toLowerCase();
        return hay.includes(qq);
      });
    }

    const privacy = privacyEnabled(
      school as { metadata?: unknown; privacy_mode?: boolean | null }
    );
    if (privacy) {
      learners = learners.map((l) => ({
        ...l,
        display_name: maskName(l.first_name, l.last_name, true),
        first_name: l.first_name
          ? `${String(l.first_name)[0]}.`
          : l.first_name,
        last_name: l.last_name ? `${String(l.last_name)[0]}.` : l.last_name,
        guardian_phone: l.guardian_phone ? '•••' : l.guardian_phone,
        guardian_name: l.guardian_name
          ? maskName(String(l.guardian_name), '', true)
          : l.guardian_name,
        id_number: l.id_number ? '••••' : l.id_number,
      }));
    }

    return NextResponse.json({
      success: true,
      schoolId: school.id,
      privacy_mode: privacy,
      learners,
      counts: {
        total: learners.length,
        verified: learners.filter((l) =>
          ['school_verified', 'attested'].includes(
            String(l.verification_status)
          )
        ).length,
        eligible: learners.filter((l) => l.nsnp_eligible !== false).length,
      },
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

    const supabase = getSupabaseServer();
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }
    const schoolId = Number(school.id);

    // Bulk CSV / Template A (.xlsx) import
    if (
      body.csv != null ||
      body.xlsxBase64 != null ||
      body.import === true
    ) {
      const parsed = parseLearnerFile({
        fileName: body.fileName,
        csvText: body.csv != null ? String(body.csv) : null,
        xlsxBase64:
          body.xlsxBase64 != null ? String(body.xlsxBase64) : null,
      });
      if (!parsed.rows.length) {
        return NextResponse.json(
          {
            error: 'No valid learner rows',
            parseErrors: parsed.errors,
          },
          { status: 400 }
        );
      }

      const { data: batch } = await supabase
        .from('school_import_batches')
        .insert({
          school_profile_id: schoolId,
          profile_id: companyId,
          kind: 'learners',
          file_name: body.fileName || 'import.xlsx',
          row_count: parsed.rows.length,
          error_count: parsed.errors.length,
          errors: parsed.errors,
          created_by: gate.userId || null,
        })
        .select('id')
        .single();

      const batchId = batch?.id != null ? Number(batch.id) : null;
      const inserts = parsed.rows.map((r) => ({
        school_profile_id: schoolId,
        profile_id: companyId,
        external_id: r.external_id || null,
        first_name: r.first_name,
        last_name: r.last_name,
        date_of_birth: r.date_of_birth || null,
        grade: r.grade || null,
        class_name: r.class_name || null,
        gender: r.gender || null,
        nsnp_eligible: r.nsnp_eligible !== false,
        special_diet: r.special_diet || null,
        guardian_name: r.guardian_name || null,
        guardian_phone: r.guardian_phone || null,
        verification_status: 'draft',
        status: 'active',
        import_batch_id: batchId,
      }));

      let success = 0;
      const insertErrors: string[] = [];
      for (let i = 0; i < inserts.length; i += 200) {
        const chunk = inserts.slice(i, i + 200);
        const { error: iErr, data } = await supabase
          .from('school_learners')
          .insert(chunk)
          .select('id');
        if (iErr) insertErrors.push(iErr.message);
        else success += data?.length || chunk.length;
      }

      if (batchId) {
        await supabase
          .from('school_import_batches')
          .update({
            success_count: success,
            error_count: parsed.errors.length + insertErrors.length,
          })
          .eq('id', batchId);
      }

      await refreshSchoolCounts(supabase, schoolId, companyId);

      return NextResponse.json({
        success: true,
        imported: success,
        parseErrors: parsed.errors,
        insertErrors,
        batchId,
      });
    }

    // Single create
    if (!body.first_name || !body.last_name) {
      return NextResponse.json(
        { error: 'first_name and last_name required' },
        { status: 400 }
      );
    }

    const { data, error: cErr } = await supabase
      .from('school_learners')
      .insert({
        school_profile_id: schoolId,
        profile_id: companyId,
        external_id: body.external_id || null,
        first_name: String(body.first_name).trim(),
        last_name: String(body.last_name).trim(),
        date_of_birth: body.date_of_birth || null,
        grade: body.grade || null,
        class_name: body.class_name || null,
        gender: body.gender || null,
        nsnp_eligible: body.nsnp_eligible !== false,
        special_diet: body.special_diet || null,
        guardian_name: body.guardian_name || null,
        guardian_phone: body.guardian_phone || null,
        verification_status: body.verification_status || 'draft',
        status: body.status || 'active',
      })
      .select('*')
      .single();

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 400 });
    }
    await refreshSchoolCounts(supabase, schoolId, companyId);
    return NextResponse.json({ success: true, learner: data });
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

    // Bulk verify / attestation
    if (Array.isArray(body.ids) && body.verification_status) {
      const ids = body.ids
        .map(Number)
        .filter((n: number) => Number.isFinite(n));
      if (!ids.length) {
        return NextResponse.json(
          { error: 'ids required for bulk update' },
          { status: 400 }
        );
      }
      const st = String(body.verification_status);
      const { error: bErr } = await supabase
        .from('school_learners')
        .update({
          verification_status: st,
          verified_at: ['school_verified', 'attested'].includes(st)
            ? new Date().toISOString()
            : null,
          verified_by: gate.userId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', companyId)
        .eq('school_profile_id', school.id)
        .in('id', ids);
      if (bErr) {
        return NextResponse.json({ error: bErr.message }, { status: 400 });
      }
      await refreshSchoolCounts(supabase, Number(school.id), companyId);
      return NextResponse.json({ success: true, updated: ids.length });
    }

    // Single learner update
    const id = Number(body.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'id required (or ids for bulk verification)' },
        { status: 400 }
      );
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    const strFields = [
      'first_name',
      'last_name',
      'grade',
      'class_name',
      'gender',
      'special_diet',
      'status',
      'external_id',
      'guardian_name',
      'guardian_phone',
      'date_of_birth',
    ] as const;
    for (const k of strFields) {
      if (body[k] !== undefined) {
        const v = body[k];
        if (v === null || v === '') {
          // first/last must stay non-empty when provided
          if (k === 'first_name' || k === 'last_name') {
            return NextResponse.json(
              { error: `${k} cannot be empty` },
              { status: 400 }
            );
          }
          patch[k] = null;
        } else {
          patch[k] = String(v).trim();
        }
      }
    }
    if (body.nsnp_eligible !== undefined) {
      const v = body.nsnp_eligible;
      if (v === false || v === 'N' || v === 'n' || v === 'no' || v === 0 || v === '0') {
        patch.nsnp_eligible = false;
      } else {
        patch.nsnp_eligible = true;
      }
    }
    if (body.verification_status) {
      patch.verification_status = body.verification_status;
      if (
        ['school_verified', 'attested'].includes(
          String(body.verification_status)
        )
      ) {
        patch.verified_at = new Date().toISOString();
        patch.verified_by = gate.userId || null;
      }
    }

    const { data, error } = await supabase
      .from('school_learners')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .eq('school_profile_id', school.id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    await refreshSchoolCounts(supabase, Number(school.id), companyId);
    return NextResponse.json({ success: true, learner: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
