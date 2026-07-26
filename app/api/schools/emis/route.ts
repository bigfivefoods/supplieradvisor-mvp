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

/**
 * W4 EMIS snapshot import / attest.
 * CSV columns: emis_number, grade, enrolled, nsnp_eligible (optional)
 * Or single-school attest of current learner counts.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
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

    return NextResponse.json({
      success: true,
      emis_number: school.emis_number,
      emis_snapshot: school.emis_snapshot || null,
      emis_attested_at: school.emis_attested_at || null,
      learner_count_enrolled: school.learner_count_enrolled,
      learner_count_verified: school.learner_count_verified,
      template:
        'emis_number,grade,enrolled,nsnp_eligible\n123456,4,40,Y\n123456,5,38,Y\n',
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

    // Attest current register vs EMIS
    if (body.action === 'attest') {
      const snapshot = {
        attested_at: new Date().toISOString(),
        emis_number: body.emis_number || school.emis_number,
        enrolled: school.learner_count_enrolled,
        verified: school.learner_count_verified,
        eligible: school.learner_count_nsnp_eligible,
        note: body.note || 'Term attestation against school register / EMIS',
        by: gate.userId || null,
      };
      const { data, error: uErr } = await supabase
        .from('school_profiles')
        .update({
          emis_number: snapshot.emis_number || school.emis_number,
          emis_snapshot: snapshot,
          emis_attested_at: snapshot.attested_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', school.id)
        .select('*')
        .single();
      if (uErr) {
        // soft columns missing
        return NextResponse.json({
          success: true,
          warning: uErr.message,
          snapshot,
        });
      }
      return NextResponse.json({ success: true, school: data, snapshot });
    }

    // CSV grade headcount import into snapshot + optional learner bulk stubs
    if (body.csv || body.action === 'import') {
      const text = String(body.csv || '');
      const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) {
        return NextResponse.json({ error: 'Empty CSV' }, { status: 400 });
      }
      const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
      const idx = (name: string) => header.indexOf(name);
      const grades: Array<{
        grade: string;
        enrolled: number;
        nsnp_eligible: number;
      }> = [];
      let total = 0;
      let eligible = 0;
      let emis = school.emis_number;

      for (let i = 1; i < lines.length; i += 1) {
        const cols = lines[i].split(',').map((c) => c.trim());
        const grade = cols[idx('grade')] || cols[1] || '';
        const enrolled = Number(cols[idx('enrolled')] || cols[2] || 0);
        const eligRaw = (cols[idx('nsnp_eligible')] || 'Y').toLowerCase();
        const elig =
          eligRaw === 'n' || eligRaw === 'no' || eligRaw === '0'
            ? 0
            : enrolled;
        if (cols[idx('emis_number')]) emis = cols[idx('emis_number')];
        if (!grade || !Number.isFinite(enrolled)) continue;
        grades.push({ grade, enrolled, nsnp_eligible: elig });
        total += enrolled;
        eligible += elig;
      }

      const snapshot = {
        imported_at: new Date().toISOString(),
        emis_number: emis,
        grades,
        total_enrolled: total,
        total_eligible: eligible,
        by: gate.userId || null,
      };

      await supabase
        .from('school_profiles')
        .update({
          emis_number: emis || school.emis_number,
          emis_snapshot: snapshot,
          learner_count_enrolled: total,
          learner_count_nsnp_eligible: eligible,
          emis_attested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', school.id);

      // Placeholders pollute the real learner register — disabled by default.
      // Prefer Learners CSV import with real (or de-identified) records.
      if (body.create_placeholders) {
        return NextResponse.json(
          {
            success: true,
            snapshot,
            grades: grades.length,
            enrolled: total,
            warning:
              'EMIS headcount saved. Placeholder learners are disabled — import real learners under Learners (CSV). Fake rows break claims & prizes.',
            placeholders_created: 0,
          },
          { status: 200 }
        );
      }

      return NextResponse.json({
        success: true,
        snapshot,
        grades: grades.length,
        enrolled: total,
        message:
          'EMIS headcount snapshot saved. Import named learners under Learners for verification & claims.',
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
