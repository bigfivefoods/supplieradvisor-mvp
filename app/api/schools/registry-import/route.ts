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
/** Prefer Pro plan 60s; Hobby still caps ~10s — keep batches small + bulk SQL. */
export const maxDuration = 60;

/**
 * POST
 *  - multipart file → parse preview only (prefer client-side parse)
 *  - JSON { action: 'import_batch', rows: SchoolRegistryRow[] } → bulk upsert ≤25 rows
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

type ExistingSchool = { id: number; profile_id: number | null };

function rowToPatch(
  row: SchoolRegistryRow,
  provinceDefault: string,
  now: string,
  extras?: { profile_id?: number | null; primary_agency_profile_id?: number | null }
): Record<string, unknown> {
  const enrolled =
    row.final_emis_enrol ??
    row.final_nsnp_approved_enrol ??
    row.nsnp_applic_enrol ??
    0;
  const nsnpEligible =
    row.final_nsnp_approved_enrol ?? row.nsnp_applic_enrol ?? enrolled;

  return {
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
    ...(extras?.profile_id != null ? { profile_id: extras.profile_id } : {}),
    ...(extras?.primary_agency_profile_id != null
      ? { primary_agency_profile_id: extras.primary_agency_profile_id }
      : {}),
  };
}

/**
 * Bulk batch: few round-trips (lookup → insert/update → link), not per-school.
 * Required to stay under Vercel FUNCTION_INVOCATION_TIMEOUT.
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
  const errors: Array<{ row: string; message: string }> = [];
  let workspaces = 0;

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

  const existingByNatemis = new Map<string, ExistingSchool>();
  const existingByEmis = new Map<string, ExistingSchool>();

  const remember = (s: {
    id: number;
    profile_id: number | null;
    natemis?: string | null;
    emis_number?: string | null;
  }) => {
    const rec: ExistingSchool = {
      id: Number(s.id),
      profile_id: s.profile_id != null ? Number(s.profile_id) : null,
    };
    if (s.natemis) existingByNatemis.set(String(s.natemis), rec);
    if (s.emis_number) existingByEmis.set(String(s.emis_number), rec);
  };

  if (natemisKeys.length) {
    const { data } = await supabase
      .from('school_profiles')
      .select('id, profile_id, natemis, emis_number')
      .in('natemis', natemisKeys);
    for (const s of data || []) remember(s as Parameters<typeof remember>[0]);
  }
  if (emisKeys.length) {
    const { data } = await supabase
      .from('school_profiles')
      .select('id, profile_id, natemis, emis_number')
      .in('emis_number', emisKeys);
    for (const s of data || []) remember(s as Parameters<typeof remember>[0]);
  }

  // Optional workspaces only when asked (slow path — keep batch small)
  const profileByKey = new Map<string, number>();
  if (createWorkspaces) {
    for (const row of rows) {
      const key = row.natemis || row.emis_number || row.school_name;
      const existing =
        (row.natemis && existingByNatemis.get(row.natemis)) ||
        (row.emis_number && existingByEmis.get(row.emis_number)) ||
        null;
      if (existing?.profile_id) {
        profileByKey.set(key, existing.profile_id);
        continue;
      }
      const { data: prof, error } = await supabase
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
      if (!error && prof?.id) {
        profileByKey.set(key, Number(prof.id));
        workspaces += 1;
      }
    }
  }

  type Prepared = {
    row: SchoolRegistryRow;
    existing: ExistingSchool | null;
    patch: Record<string, unknown>;
  };

  const prepared: Prepared[] = rows.map((row) => {
    const existing =
      (row.natemis && existingByNatemis.get(row.natemis)) ||
      (row.emis_number && existingByEmis.get(row.emis_number)) ||
      null;
    const key = row.natemis || row.emis_number || row.school_name;
    const profileId =
      profileByKey.get(key) ?? existing?.profile_id ?? null;
    const patch = rowToPatch(row, provinceDefault, now, {
      profile_id: profileId,
      primary_agency_profile_id:
        linkStatus === 'active' ? agencyCompanyId : null,
    });
    return { row, existing, patch };
  });

  const toInsert = prepared.filter((p) => !p.existing);
  const toUpdate = prepared.filter((p) => p.existing);

  let inserted = 0;
  let updated = 0;

  // Bulk insert new schools (1–2 round-trips)
  if (toInsert.length) {
    const payloads = toInsert.map((p) => ({
      ...p.patch,
      created_at: now,
    }));
    const { data, error } = await supabase
      .from('school_profiles')
      .insert(payloads)
      .select('id, natemis, emis_number, profile_id');

    if (error) {
      // Fallback: lean columns if migration columns missing
      const lean = toInsert.map((p) => {
        const enrolled = Number(p.patch.learner_count_enrolled || 0);
        return {
          school_name: p.row.school_name,
          emis_number: p.row.emis_number || p.row.natemis || null,
          province: p.row.province || provinceDefault,
          district: p.row.district || null,
          circuit: p.row.circuit || null,
          quintile: p.row.quintile,
          phase: p.row.phase || null,
          learner_count_enrolled: enrolled,
          learner_count_nsnp_eligible: Number(
            p.patch.learner_count_nsnp_eligible || enrolled
          ),
          status: 'active',
          updated_at: now,
          created_at: now,
          profile_id: p.patch.profile_id ?? null,
          metadata: {
            cmc: p.row.cmc,
            local_municipality: p.row.local_municipality,
            municipality_ward: p.row.municipality_ward,
            natemis: p.row.natemis,
            level_label: p.row.level_label,
            nsnp_applic_enrol: p.row.nsnp_applic_enrol,
            final_emis_enrol: p.row.final_emis_enrol,
            final_nsnp_approved_enrol: p.row.final_nsnp_approved_enrol,
          },
        };
      });
      const { data: d2, error: e2 } = await supabase
        .from('school_profiles')
        .insert(lean)
        .select('id, natemis, emis_number, profile_id');
      if (e2) {
        errors.push({ row: 'bulk insert', message: e2.message });
      } else {
        inserted = (d2 || []).length;
        for (const s of d2 || [])
          remember(s as Parameters<typeof remember>[0]);
      }
    } else {
      inserted = (data || []).length;
      for (const s of data || [])
        remember(s as Parameters<typeof remember>[0]);
    }
  }

  // Bulk update existing via upsert on primary key (1 round-trip)
  if (toUpdate.length) {
    const payloads = toUpdate.map((p) => ({
      id: p.existing!.id,
      ...p.patch,
    }));
    const { error } = await supabase
      .from('school_profiles')
      .upsert(payloads, { onConflict: 'id' });
    if (error) {
      // Fallback: sequential update (still small batch)
      for (const p of toUpdate) {
        const { error: uErr } = await supabase
          .from('school_profiles')
          .update(p.patch)
          .eq('id', p.existing!.id);
        if (uErr) {
          errors.push({ row: p.row.school_name, message: uErr.message });
        } else {
          updated += 1;
        }
      }
    } else {
      updated = toUpdate.length;
    }
  }

  // Resolve school ids for agency links
  const schoolIds: Array<{
    schoolId: number;
    profileId: number | null;
  }> = [];

  for (const p of prepared) {
    const existing =
      p.existing ||
      (p.row.natemis && existingByNatemis.get(p.row.natemis)) ||
      (p.row.emis_number && existingByEmis.get(p.row.emis_number)) ||
      null;
    if (existing) {
      schoolIds.push({
        schoolId: existing.id,
        profileId: existing.profile_id,
      });
    }
  }

  // Re-fetch any inserts that didn't land in maps (e.g. missing natemis)
  if (schoolIds.length < prepared.length) {
    const missingNat = prepared
      .filter(
        (p) =>
          p.row.natemis &&
          !existingByNatemis.has(p.row.natemis) &&
          !(p.row.emis_number && existingByEmis.has(p.row.emis_number))
      )
      .map((p) => p.row.natemis!)
      .filter(Boolean);
    if (missingNat.length) {
      const { data } = await supabase
        .from('school_profiles')
        .select('id, profile_id, natemis, emis_number')
        .in('natemis', missingNat);
      for (const s of data || []) {
        remember(s as Parameters<typeof remember>[0]);
        schoolIds.push({
          schoolId: Number(s.id),
          profileId: s.profile_id != null ? Number(s.profile_id) : null,
        });
      }
    }
  }

  // Deduplicate link targets
  const seenLink = new Set<number>();
  const linkRows = schoolIds
    .filter((s) => {
      if (seenLink.has(s.schoolId)) return false;
      seenLink.add(s.schoolId);
      return true;
    })
    .map((s) => ({
      school_profile_id: s.schoolId,
      school_company_id: s.profileId || agencyCompanyId,
      agency_profile_id: agencyCompanyId,
      status: linkStatus,
      accepted_at: linkStatus === 'active' ? now : null,
      notes: 'Registry import',
      updated_at: now,
    }));

  let linked = 0;
  if (linkRows.length) {
    const { error: lErr } = await supabase
      .from('school_agency_links')
      .upsert(linkRows, { onConflict: 'school_profile_id,agency_profile_id' });
    if (lErr) {
      errors.push({ row: 'agency links', message: lErr.message });
    } else {
      linked = linkRows.length;
    }
  }

  return {
    inserted,
    updated,
    linked,
    workspaces_created: workspaces,
    errors: errors.slice(0, 30),
  };
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
