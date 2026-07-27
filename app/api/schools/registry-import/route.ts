import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  parseSchoolRegistryBuffer,
  parseSchoolRegistryCsv,
  type SchoolRegistryRow,
} from '@/lib/schools/school-registry-import';
import { getAgencyRegistration } from '@/lib/schools/approved-catalogue';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST multipart: file (xlsx/csv) + companyId + optional province + link_status
 * Or JSON: { companyId, csvText, province, dryRun, create_workspaces, link_status }
 *
 * Only DBE/DoH agency can import. Upserts school_profiles by NATEMIS / EMIS.
 */
export async function POST(request: NextRequest) {
  try {
    const ct = request.headers.get('content-type') || '';
    let companyId: number;
    let province = 'KwaZulu-Natal';
    let dryRun = false;
    let createWorkspaces = false;
    let linkStatus: 'pending' | 'active' = 'active';
    let parseResult: ReturnType<typeof parseSchoolRegistryBuffer>;

    if (ct.includes('multipart/form-data')) {
      const form = await request.formData();
      companyId = Number(form.get('companyId'));
      province = String(form.get('province') || province);
      dryRun = String(form.get('dryRun') || '') === '1' || form.get('dryRun') === 'true';
      createWorkspaces =
        String(form.get('create_workspaces') || '') === '1' ||
        form.get('create_workspaces') === 'true';
      const ls = String(form.get('link_status') || 'active');
      linkStatus = ls === 'pending' ? 'pending' : 'active';
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'file required' }, { status: 400 });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const name = file.name.toLowerCase();
      if (name.endsWith('.csv') || name.endsWith('.txt')) {
        parseResult = parseSchoolRegistryCsv(buf.toString('utf8'), {
          provinceDefault: province,
        });
      } else {
        parseResult = parseSchoolRegistryBuffer(buf, {
          provinceDefault: province,
        });
      }
    } else {
      const body = await request.json();
      companyId = Number(body.companyId);
      province = String(body.province || province);
      dryRun = Boolean(body.dryRun);
      createWorkspaces = Boolean(body.create_workspaces);
      linkStatus = body.link_status === 'pending' ? 'pending' : 'active';
      if (body.csvText) {
        parseResult = parseSchoolRegistryCsv(String(body.csvText), {
          provinceDefault: province,
        });
      } else if (body.base64) {
        const buf = Buffer.from(String(body.base64), 'base64');
        parseResult = parseSchoolRegistryBuffer(buf, {
          provinceDefault: province,
        });
      } else {
        return NextResponse.json(
          { error: 'file, csvText, or base64 required' },
          { status: 400 }
        );
      }
    }

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const agency = await getAgencyRegistration(supabase, companyId);
    if (!agency) {
      return NextResponse.json(
        {
          error:
            'Only a registered DBE / PEU / DoH can import the school registry. Register under Schools → Desk first.',
        },
        { status: 403 }
      );
    }

    // Ensure columns exist (best-effort)
    try {
      for (const [col, typ] of [
        ['cmc', 'text'],
        ['local_municipality', 'text'],
        ['municipality_ward', 'text'],
        ['natemis', 'text'],
        ['level_label', 'text'],
        ['nsnp_applic_enrol', 'int'],
        ['final_emis_enrol', 'int'],
        ['final_nsnp_approved_enrol', 'int'],
        ['enrolment_year', 'text'],
        ['registry_source', 'text'],
        ['registry_imported_at', 'timestamptz'],
      ] as const) {
        await supabase.rpc('sa_add_column', {
          p_table: 'school_profiles',
          p_column: col,
          p_type: typ,
          p_default: null,
        });
      }
      await supabase.rpc('sa_add_column', {
        p_table: 'school_profiles',
        p_column: 'profile_id',
        p_type: 'bigint',
        p_default: null,
      });
    } catch {
      /* soft */
    }

    const sample = parseResult.rows.slice(0, 5).map((r) => ({
      school_name: r.school_name,
      district: r.district,
      cmc: r.cmc,
      circuit: r.circuit,
      natemis: r.natemis,
      quintile: r.quintile,
      final_nsnp_approved_enrol: r.final_nsnp_approved_enrol,
    }));

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        sheetName: parseResult.sheetName,
        headers: parseResult.headers,
        rowCount: parseResult.rows.length,
        parseErrors: parseResult.errors.slice(0, 50),
        parseErrorCount: parseResult.errors.length,
        sample,
      });
    }

    const now = new Date().toISOString();
    let inserted = 0;
    let updated = 0;
    let linked = 0;
    let workspaces = 0;
    const upsertErrors: Array<{ row: string; message: string }> = [];

    // Process in chunks
    const chunkSize = 40;
    for (let i = 0; i < parseResult.rows.length; i += chunkSize) {
      const chunk = parseResult.rows.slice(i, i + chunkSize);
      for (const row of chunk) {
        try {
          const result = await upsertRegistrySchool(supabase, {
            row,
            agencyCompanyId: companyId,
            provinceDefault: province,
            createWorkspaces,
            linkStatus,
            now,
          });
          if (result.inserted) inserted += 1;
          else updated += 1;
          if (result.linked) linked += 1;
          if (result.workspace) workspaces += 1;
        } catch (e: unknown) {
          upsertErrors.push({
            row: row.school_name,
            message: e instanceof Error ? e.message : 'upsert failed',
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      sheetName: parseResult.sheetName,
      headers: parseResult.headers,
      rowCount: parseResult.rows.length,
      inserted,
      updated,
      linked,
      workspaces_created: workspaces,
      parseErrorCount: parseResult.errors.length,
      parseErrors: parseResult.errors.slice(0, 30),
      upsertErrorCount: upsertErrors.length,
      upsertErrors: upsertErrors.slice(0, 40),
      message: `Imported ${inserted + updated} schools (${inserted} new, ${updated} updated), linked ${linked} to your department.`,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Import failed' },
      { status: 500 }
    );
  }
}

async function upsertRegistrySchool(
  supabase: ReturnType<typeof getSupabaseServer>,
  opts: {
    row: SchoolRegistryRow;
    agencyCompanyId: number;
    provinceDefault: string;
    createWorkspaces: boolean;
    linkStatus: 'pending' | 'active';
    now: string;
  }
): Promise<{ inserted: boolean; linked: boolean; workspace: boolean }> {
  const { row, agencyCompanyId, provinceDefault, createWorkspaces, linkStatus, now } =
    opts;

  // Find existing by natemis then emis
  let existing: { id: number; profile_id: number | null } | null = null;
  if (row.natemis) {
    const { data } = await supabase
      .from('school_profiles')
      .select('id, profile_id')
      .eq('natemis', row.natemis)
      .maybeSingle();
    if (data) existing = { id: Number(data.id), profile_id: data.profile_id != null ? Number(data.profile_id) : null };
  }
  if (!existing && row.emis_number) {
    const { data } = await supabase
      .from('school_profiles')
      .select('id, profile_id')
      .eq('emis_number', row.emis_number)
      .maybeSingle();
    if (data) existing = { id: Number(data.id), profile_id: data.profile_id != null ? Number(data.profile_id) : null };
  }

  const enrolled =
    row.final_emis_enrol ??
    row.final_nsnp_approved_enrol ??
    row.nsnp_applic_enrol ??
    0;
  const nsnpEligible =
    row.final_nsnp_approved_enrol ?? row.nsnp_applic_enrol ?? enrolled;

  const patch: Record<string, unknown> = {
    school_name: row.school_name,
    emis_number: row.emis_number || row.natemis || null,
    natemis: row.natemis || row.emis_number || null,
    province: row.province || provinceDefault,
    district: row.district || null,
    circuit: row.circuit || null,
    cmc: row.cmc || null,
    quintile: row.quintile,
    local_municipality: row.local_municipality || null,
    municipality_ward: row.municipality_ward || null,
    level_label: row.level_label || null,
    phase: row.phase || null,
    nsnp_applic_enrol: row.nsnp_applic_enrol,
    final_emis_enrol: row.final_emis_enrol,
    final_nsnp_approved_enrol: row.final_nsnp_approved_enrol,
    enrolment_year: row.enrolment_year || '2026-27',
    learner_count_enrolled: enrolled,
    learner_count_nsnp_eligible: nsnpEligible,
    registry_source: 'xlsx_import',
    registry_imported_at: now,
    status: 'active',
    updated_at: now,
    member_type: 'school',
    has_on_site_kitchen: true,
    feeding_breakfast: true,
    feeding_lunch: true,
  };

  let schoolId: number;
  let inserted = false;
  let workspace = false;
  let profileId = existing?.profile_id ?? null;

  if (createWorkspaces && !profileId) {
    const { data: prof, error: pErr } = await supabase
      .from('profiles')
      .insert({
        trading_name: row.school_name,
        legal_name: row.school_name,
        org_type: 'school',
        business_type: 'school',
        province: row.province || provinceDefault,
        city: row.local_municipality || null,
        metadata: {
          entity_kind: 'school',
          registry_import: true,
          natemis: row.natemis,
          enabled_modules: { schools: true, home: true, guide: true },
        },
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();
    if (!pErr && prof?.id) {
      profileId = Number(prof.id);
      workspace = true;
    }
  }

  if (existing) {
    if (profileId && !existing.profile_id) patch.profile_id = profileId;
    const { error } = await supabase
      .from('school_profiles')
      .update(patch)
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
    schoolId = existing.id;
  } else {
    const insertRow = {
      ...patch,
      profile_id: profileId,
      created_at: now,
    };
    const { data, error } = await supabase
      .from('school_profiles')
      .insert(insertRow)
      .select('id')
      .single();
    if (error) {
      // Retry without new columns
      if (/column|schema cache/i.test(error.message || '')) {
        const soft = {
          profile_id: profileId,
          school_name: row.school_name,
          emis_number: row.emis_number || row.natemis || null,
          province: row.province || provinceDefault,
          district: row.district || null,
          circuit: row.circuit || null,
          quintile: row.quintile,
          phase: row.phase || null,
          learner_count_enrolled: enrolled,
          learner_count_nsnp_eligible: nsnpEligible,
          status: 'active',
          updated_at: now,
          created_at: now,
          metadata: {
            cmc: row.cmc,
            local_municipality: row.local_municipality,
            municipality_ward: row.municipality_ward,
            natemis: row.natemis,
            level_label: row.level_label,
            nsnp_applic_enrol: row.nsnp_applic_enrol,
            final_emis_enrol: row.final_emis_enrol,
            final_nsnp_approved_enrol: row.final_nsnp_approved_enrol,
            enrolment_year: row.enrolment_year,
            registry_source: 'xlsx_import',
          },
        };
        const retry = await supabase
          .from('school_profiles')
          .insert(soft)
          .select('id')
          .single();
        if (retry.error) throw new Error(retry.error.message);
        schoolId = Number(retry.data!.id);
      } else {
        throw new Error(error.message);
      }
    } else {
      schoolId = Number(data!.id);
    }
    inserted = true;
  }

  // Link to importing agency
  let linked = false;
  const companyForLink = profileId;
  const { error: lErr } = await supabase.from('school_agency_links').upsert(
    {
      school_profile_id: schoolId,
      school_company_id: companyForLink || agencyCompanyId,
      agency_profile_id: agencyCompanyId,
      status: linkStatus,
      accepted_at: linkStatus === 'active' ? now : null,
      notes: 'Registry import',
      updated_at: now,
    },
    { onConflict: 'school_profile_id,agency_profile_id' }
  );
  if (!lErr) {
    linked = true;
    if (linkStatus === 'active') {
      await supabase
        .from('school_profiles')
        .update({
          primary_agency_profile_id: agencyCompanyId,
          updated_at: now,
        })
        .eq('id', schoolId);
    }
  }

  return { inserted, linked, workspace };
}

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
    const agency = await getAgencyRegistration(supabase, companyId);
    if (!agency) {
      return NextResponse.json(
        { error: 'Department only' },
        { status: 403 }
      );
    }

    const { count } = await supabase
      .from('school_profiles')
      .select('*', { count: 'exact', head: true });

    const { count: linkedCount } = await supabase
      .from('school_agency_links')
      .select('*', { count: 'exact', head: true })
      .eq('agency_profile_id', companyId)
      .eq('status', 'active');

    return NextResponse.json({
      success: true,
      schools_in_system: count ?? 0,
      schools_linked_to_you: linkedCount ?? 0,
      expected_columns: [
        'District',
        'CMC',
        'Circuit',
        'Institution Name',
        'Quintile',
        'Local Municipality',
        'Municipality Ward Number',
        'Level',
        'NATEMIS',
        'NSNP Applic. Enrol. 26-27',
        'Final EMIS Enrol:2026',
        'Final NSNP Approved Enrol. 26-27',
      ],
      tip: 'Upload .xlsx or .csv as DBE. Preview with dry run first.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
