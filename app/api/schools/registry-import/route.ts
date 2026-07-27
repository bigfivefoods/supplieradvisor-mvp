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
  REGISTRY_BATCH_SIZE,
} from '@/lib/schools/school-registry-import';
import { getAgencyRegistration } from '@/lib/schools/approved-catalogue';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST
 *  - multipart file + dryRun=1 → parse only (quick)
 *  - JSON { action: 'import_batch', rows: SchoolRegistryRow[] } → import ≤75 rows
 *    Client parses xlsx once and sends batches to avoid Vercel 504 timeouts.
 */
export async function POST(request: NextRequest) {
  try {
    const ct = request.headers.get('content-type') || '';

    // ── Batch import (JSON) — preferred for large lists ───────────────
    if (ct.includes('application/json')) {
      let body: Record<string, unknown>;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON body', success: false },
          { status: 400 }
        );
      }

      const companyId = Number(body.companyId);
      if (!Number.isFinite(companyId)) {
        return NextResponse.json(
          { error: 'companyId required', success: false },
          { status: 400 }
        );
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
            error: 'Only a registered DBE / PEU / DoH can import schools',
            success: false,
          },
          { status: 403 }
        );
      }

      if (body.action === 'import_batch' || Array.isArray(body.rows)) {
        const rows = (Array.isArray(body.rows) ? body.rows : []) as SchoolRegistryRow[];
        if (!rows.length) {
          return NextResponse.json(
            { error: 'rows[] required', success: false },
            { status: 400 }
          );
        }
        if (rows.length > REGISTRY_BATCH_SIZE + 10) {
          return NextResponse.json(
            {
              error: `Max ${REGISTRY_BATCH_SIZE} schools per batch (got ${rows.length})`,
              success: false,
            },
            { status: 400 }
          );
        }

        const province = String(body.province || 'KwaZulu-Natal');
        const createWorkspaces = Boolean(body.create_workspaces);
        const linkStatus: 'pending' | 'active' =
          body.link_status === 'pending' ? 'pending' : 'active';

        await ensureRegistryColumns(supabase);

        const stats = await importBatchFast(supabase, {
          rows,
          agencyCompanyId: companyId,
          provinceDefault: province,
          createWorkspaces,
          linkStatus,
        });

        return NextResponse.json({
          success: true,
          ...stats,
          batchSize: rows.length,
          message: `Batch: ${stats.inserted} new, ${stats.updated} updated, ${stats.linked} linked`,
        });
      }

      // Legacy full-body json import not supported for large lists
      return NextResponse.json(
        {
          error:
            'Use action import_batch with rows[] (client-side batching). Full-file import times out on 5000+ rows.',
          success: false,
        },
        { status: 400 }
      );
    }

    // ── Multipart: parse-only preview (or tiny imports) ───────────────
    let form: FormData;
    try {
      form = await request.formData();
    } catch (e: unknown) {
      return NextResponse.json(
        {
          error:
            e instanceof Error
              ? `Could not read upload (${e.message})`
              : 'Could not read upload',
          success: false,
        },
        { status: 400 }
      );
    }

    const companyId = Number(form.get('companyId'));
    const province = String(form.get('province') || 'KwaZulu-Natal');
    const dryRun =
      String(form.get('dryRun') || '1') === '1' ||
      form.get('dryRun') === 'true' ||
      form.get('dryRun') === '1';

    if (!Number.isFinite(companyId)) {
      return NextResponse.json(
        { error: 'companyId required', success: false },
        { status: 400 }
      );
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
          error: 'Only a registered DBE / PEU / DoH can import schools',
          success: false,
        },
        { status: 403 }
      );
    }

    const file = form.get('file');
    if (!(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'file required', success: false },
        { status: 400 }
      );
    }
    const fileName =
      file instanceof File ? file.name.toLowerCase() : 'upload.xlsx';
    const ab = await file.arrayBuffer();
    if (!ab.byteLength) {
      return NextResponse.json(
        { error: 'Uploaded file is empty', success: false },
        { status: 400 }
      );
    }
    if (ab.byteLength > 15 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: 'File too large (max 15MB). Split or use CSV.',
          success: false,
        },
        { status: 400 }
      );
    }

    const buf = Buffer.from(ab);
    let parseResult: ReturnType<typeof parseSchoolRegistryBuffer>;
    try {
      parseResult =
        fileName.endsWith('.csv') || fileName.endsWith('.txt')
          ? parseSchoolRegistryCsv(buf.toString('utf8'), {
              provinceDefault: province,
            })
          : parseSchoolRegistryBuffer(buf, { provinceDefault: province });
    } catch (e: unknown) {
      return NextResponse.json(
        {
          error:
            e instanceof Error
              ? `Failed to parse: ${e.message}`
              : 'Failed to parse spreadsheet',
          success: false,
        },
        { status: 400 }
      );
    }

    // Always return parse result for multipart — full import is client-batched
    return NextResponse.json({
      success: true,
      dryRun: true,
      sheetName: parseResult.sheetName,
      headers: parseResult.headers,
      rowCount: parseResult.rows.length,
      parseErrors: parseResult.errors.slice(0, 50),
      parseErrorCount: parseResult.errors.length,
      sample: parseResult.rows.slice(0, 8).map((r) => ({
        school_name: r.school_name,
        district: r.district,
        cmc: r.cmc,
        circuit: r.circuit,
        natemis: r.natemis,
        quintile: r.quintile,
        final_nsnp_approved_enrol: r.final_nsnp_approved_enrol,
      })),
      // Include rows only when small enough; client usually parses itself
      rows:
        parseResult.rows.length <= 200 ? parseResult.rows : undefined,
      useClientBatch: true,
      batchSize: REGISTRY_BATCH_SIZE,
      message: dryRun
        ? `Parsed ${parseResult.rows.length} schools. Use Import to load in batches (avoids timeout).`
        : `Parsed ${parseResult.rows.length} schools — import runs in browser batches.`,
    });
  } catch (e: unknown) {
    console.error('[registry-import]', e);
    const msg = e instanceof Error ? e.message : 'Import failed';
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}

async function ensureRegistryColumns(
  supabase: ReturnType<typeof getSupabaseServer>
) {
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
  } catch {
    /* soft */
  }
}

/**
 * Fast batch: one lookup for existing keys, then parallel upserts (capped).
 */
async function importBatchFast(
  supabase: ReturnType<typeof getSupabaseServer>,
  opts: {
    rows: SchoolRegistryRow[];
    agencyCompanyId: number;
    provinceDefault: string;
    createWorkspaces: boolean;
    linkStatus: 'pending' | 'active';
  }
): Promise<{
  inserted: number;
  updated: number;
  linked: number;
  workspaces_created: number;
  errors: Array<{ row: string; message: string }>;
}> {
  const { rows, agencyCompanyId, provinceDefault, createWorkspaces, linkStatus } =
    opts;
  const now = new Date().toISOString();

  const natemisKeys = [
    ...new Set(
      rows.map((r) => r.natemis).filter((x): x is string => Boolean(x))
    ),
  ];
  const emisKeys = [
    ...new Set(
      rows.map((r) => r.emis_number).filter((x): x is string => Boolean(x))
    ),
  ];

  const existingByNatemis = new Map<
    string,
    { id: number; profile_id: number | null }
  >();
  const existingByEmis = new Map<
    string,
    { id: number; profile_id: number | null }
  >();

  // Chunk .in() lookups
  for (let i = 0; i < natemisKeys.length; i += 100) {
    const chunk = natemisKeys.slice(i, i + 100);
    const { data } = await supabase
      .from('school_profiles')
      .select('id, profile_id, natemis, emis_number')
      .in('natemis', chunk);
    for (const s of data || []) {
      if (s.natemis) {
        existingByNatemis.set(String(s.natemis), {
          id: Number(s.id),
          profile_id: s.profile_id != null ? Number(s.profile_id) : null,
        });
      }
    }
  }
  for (let i = 0; i < emisKeys.length; i += 100) {
    const chunk = emisKeys.slice(i, i + 100);
    const { data } = await supabase
      .from('school_profiles')
      .select('id, profile_id, natemis, emis_number')
      .in('emis_number', chunk);
    for (const s of data || []) {
      const rec = {
        id: Number(s.id),
        profile_id: s.profile_id != null ? Number(s.profile_id) : null,
      };
      if (s.emis_number) existingByEmis.set(String(s.emis_number), rec);
      if (s.natemis) existingByNatemis.set(String(s.natemis), rec);
    }
  }

  let inserted = 0;
  let updated = 0;
  let linked = 0;
  let workspaces = 0;
  const errors: Array<{ row: string; message: string }> = [];

  // Parallelism limited
  const concurrency = 12;
  for (let i = 0; i < rows.length; i += concurrency) {
    const slice = rows.slice(i, i + concurrency);
    await Promise.all(
      slice.map(async (row) => {
        try {
          const r = await upsertOne(supabase, {
            row,
            existingByNatemis,
            existingByEmis,
            agencyCompanyId,
            provinceDefault,
            createWorkspaces,
            linkStatus,
            now,
          });
          if (r.inserted) inserted += 1;
          else updated += 1;
          if (r.linked) linked += 1;
          if (r.workspace) workspaces += 1;
        } catch (e: unknown) {
          errors.push({
            row: row.school_name,
            message: e instanceof Error ? e.message : 'failed',
          });
        }
      })
    );
  }

  return {
    inserted,
    updated,
    linked,
    workspaces_created: workspaces,
    errors: errors.slice(0, 30),
  };
}

async function upsertOne(
  supabase: ReturnType<typeof getSupabaseServer>,
  opts: {
    row: SchoolRegistryRow;
    existingByNatemis: Map<string, { id: number; profile_id: number | null }>;
    existingByEmis: Map<string, { id: number; profile_id: number | null }>;
    agencyCompanyId: number;
    provinceDefault: string;
    createWorkspaces: boolean;
    linkStatus: 'pending' | 'active';
    now: string;
  }
): Promise<{ inserted: boolean; linked: boolean; workspace: boolean }> {
  const {
    row,
    existingByNatemis,
    existingByEmis,
    agencyCompanyId,
    provinceDefault,
    createWorkspaces,
    linkStatus,
    now,
  } = opts;

  let existing =
    (row.natemis && existingByNatemis.get(row.natemis)) ||
    (row.emis_number && existingByEmis.get(row.emis_number)) ||
    null;

  const enrolled =
    row.final_emis_enrol ??
    row.final_nsnp_approved_enrol ??
    row.nsnp_applic_enrol ??
    0;
  const nsnpEligible =
    row.final_nsnp_approved_enrol ?? row.nsnp_applic_enrol ?? enrolled;

  let profileId = existing?.profile_id ?? null;
  let workspace = false;

  if (createWorkspaces && !profileId) {
    const { data: prof } = await supabase
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
        updated_at: now,
      })
      .select('id')
      .single();
    if (prof?.id) {
      profileId = Number(prof.id);
      workspace = true;
    }
  }

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

  if (existing) {
    if (profileId && !existing.profile_id) patch.profile_id = profileId;
    const { error } = await supabase
      .from('school_profiles')
      .update(patch)
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
    schoolId = existing.id;
  } else {
    const { data, error } = await supabase
      .from('school_profiles')
      .insert({
        ...patch,
        profile_id: profileId,
        created_at: now,
      })
      .select('id')
      .single();
    if (error) {
      // Soft fallback without new columns
      const { data: d2, error: e2 } = await supabase
        .from('school_profiles')
        .insert({
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
          },
        })
        .select('id')
        .single();
      if (e2) throw new Error(e2.message);
      schoolId = Number(d2!.id);
    } else {
      schoolId = Number(data!.id);
    }
    inserted = true;
    const rec = { id: schoolId, profile_id: profileId };
    if (row.natemis) existingByNatemis.set(row.natemis, rec);
    if (row.emis_number) existingByEmis.set(row.emis_number, rec);
  }

  let linked = false;
  const { error: lErr } = await supabase.from('school_agency_links').upsert(
    {
      school_profile_id: schoolId,
      school_company_id: profileId || agencyCompanyId,
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
      return NextResponse.json(
        { error: 'companyId required', success: false },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const agency = await getAgencyRegistration(supabase, companyId);
    if (!agency) {
      return NextResponse.json(
        { error: 'Department only', success: false },
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
      batchSize: REGISTRY_BATCH_SIZE,
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
      tip: 'File is parsed in your browser, then uploaded in small batches (no 504 timeout).',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'Error',
        success: false,
      },
      { status: 500 }
    );
  }
}
