import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getAgencyRegistration } from '@/lib/schools/approved-catalogue';
import { familyForAgencyType } from '@/lib/entities/programme-hierarchy';
import {
  parseSpRegistryBuffer,
  parseSpRegistryCsv,
  buildSpRegistryTemplateXlsx,
  SP_REGISTRY_BATCH_SIZE,
  type SpRegistryRow,
  type SpTemplateRow,
} from '@/lib/schools/sp-registry-import';
import { fetchAllPaged } from '@/lib/schools/supabase-page';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * DBE SP registry import
 *  - JSON { action: 'import_batch', rows } → bulk upsert ≤25 SPs + agency links
 *  - multipart file → parse preview only
 */
export async function POST(request: NextRequest) {
  try {
    const ct = request.headers.get('content-type') || '';

    if (ct.includes('application/json')) {
      let body: Record<string, unknown>;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON', success: false },
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
            error: 'Only a registered DBE / PEU can import service providers',
            success: false,
          },
          { status: 403 }
        );
      }
      if (
        familyForAgencyType(String(agency.agency_type || 'dbe')) === 'health'
      ) {
        return NextResponse.json(
          {
            error: 'Use the Health module for health SPs',
            success: false,
          },
          { status: 403 }
        );
      }

      if (body.action === 'import_batch' || Array.isArray(body.rows)) {
        const rows = (Array.isArray(body.rows) ? body.rows : []) as SpRegistryRow[];
        if (!rows.length) {
          return NextResponse.json(
            { error: 'rows[] required', success: false },
            { status: 400 }
          );
        }
        if (rows.length > SP_REGISTRY_BATCH_SIZE + 10) {
          return NextResponse.json(
            {
              error: `Max ${SP_REGISTRY_BATCH_SIZE} SPs per batch (got ${rows.length})`,
              success: false,
            },
            { status: 400 }
          );
        }

        const province = String(body.province || 'KwaZulu-Natal');
        const linkStatus: 'pending' | 'active' =
          body.link_status === 'pending' ? 'pending' : 'active';

        await ensureSpColumns(supabase);

        const stats = await importSpBatch(supabase, {
          rows,
          agencyCompanyId: companyId,
          provinceDefault: province,
          linkStatus,
        });

        return NextResponse.json({
          success: true,
          ...stats,
          batchSize: rows.length,
          message: `Batch: ${stats.inserted} new, ${stats.updated} updated, ${stats.linked} linked`,
        });
      }

      return NextResponse.json(
        {
          error: 'Use action import_batch with rows[]',
          success: false,
        },
        { status: 400 }
      );
    }

    // Multipart preview
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
        { error: 'DBE only', success: false },
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
        { error: 'Empty file', success: false },
        { status: 400 }
      );
    }

    const buf = Buffer.from(ab);
    const parseResult =
      fileName.endsWith('.csv') || fileName.endsWith('.txt')
        ? parseSpRegistryCsv(buf.toString('utf8'), {
            provinceDefault: province,
          })
        : parseSpRegistryBuffer(buf, { provinceDefault: province });

    return NextResponse.json({
      success: true,
      dryRun: true,
      sheetName: parseResult.sheetName,
      headers: parseResult.headers,
      rowCount: parseResult.rows.length,
      parseErrors: parseResult.errors.slice(0, 50),
      parseErrorCount: parseResult.errors.length,
      sample: parseResult.rows.slice(0, 8),
      useClientBatch: true,
      batchSize: SP_REGISTRY_BATCH_SIZE,
      message: `Parsed ${parseResult.rows.length} service providers. Import in browser batches.`,
    });
  } catch (e: unknown) {
    console.error('[sp-registry-import]', e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'Import failed',
        success: false,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    // Blank or populated .xlsx template (no auth required for blank; export needs company)
    if (sp.get('template') === '1') {
      const exportExisting = sp.get('export') === '1';
      const companyId = Number(sp.get('companyId'));

      if (exportExisting) {
        if (!Number.isFinite(companyId)) {
          return NextResponse.json(
            { error: 'companyId required for export', success: false },
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

        const links = await fetchAllPaged(
          supabase,
          'nsnp_isp_agency_links',
          'isp_profile_id, status',
          (q) => q.eq('agency_profile_id', companyId)
        );

        const ispIds = [
          ...new Set(
            (links || [])
              .map((l) => Number(l.isp_profile_id))
              .filter((n) => Number.isFinite(n))
          ),
        ];

        const rows: SpTemplateRow[] = [];
        if (ispIds.length) {
          // Chunk .in() lookups
          const chunk = 200;
          for (let i = 0; i < ispIds.length; i += chunk) {
            const slice = ispIds.slice(i, i + chunk);
            const { data } = await supabase
              .from('nsnp_isp_profiles')
              .select(
                'profile_id, trading_name, district, cluster_allocation, csd_number'
              )
              .in('profile_id', slice);
            for (const r of data || []) {
              rows.push({
                name: String(r.trading_name || '').trim() || `SP ${r.profile_id}`,
                district: r.district ? String(r.district) : null,
                cluster_allocation: r.cluster_allocation
                  ? String(r.cluster_allocation)
                  : null,
                csd_number: r.csd_number ? String(r.csd_number) : null,
              });
            }
          }
          rows.sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          );
        }

        const buf = buildSpRegistryTemplateXlsx(rows, {
          includeExamples: false,
        });
        const filename =
          rows.length > 0
            ? `NSNP_Service_Providers_Export_${rows.length}.xlsx`
            : 'NSNP_Service_Providers_Import_Template.xlsx';

        return new NextResponse(new Uint8Array(buf), {
          headers: {
            'Content-Type':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
          },
        });
      }

      // Blank template with example rows
      const buf = buildSpRegistryTemplateXlsx(undefined, {
        includeExamples: true,
      });
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition':
            'attachment; filename="NSNP_Service_Providers_Import_Template.xlsx"',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    const companyId = Number(sp.get('companyId'));
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

    const { count: ispCount } = await supabase
      .from('nsnp_isp_profiles')
      .select('*', { count: 'exact', head: true });

    const { count: linkedCount } = await supabase
      .from('nsnp_isp_agency_links')
      .select('*', { count: 'exact', head: true })
      .eq('agency_profile_id', companyId)
      .eq('status', 'active');

    const { count: registryCount } = await supabase
      .from('nsnp_isp_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('registry_source', 'xlsx_import');

    return NextResponse.json({
      success: true,
      sps_in_system: ispCount ?? 0,
      sps_linked_to_you: linkedCount ?? 0,
      sps_from_registry: registryCount ?? 0,
      batchSize: SP_REGISTRY_BATCH_SIZE,
      expected_columns: [
        'District',
        'Cluster Allocation',
        'Name of Service Provider',
        'CSD Number',
      ],
      template_url: '/api/schools/sp-registry-import?template=1',
      export_url: `/api/schools/sp-registry-import?template=1&export=1&companyId=${companyId}`,
      tip: 'Download the .xlsx template, update rows, then Preview → Import. Upserts by CSD number.',
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

async function ensureSpColumns(
  supabase: ReturnType<typeof getSupabaseServer>
) {
  try {
    for (const [col, typ] of [
      ['csd_number', 'text'],
      ['district', 'text'],
      ['cluster_allocation', 'text'],
      ['registry_source', 'text'],
      ['registry_imported_at', 'timestamptz'],
    ] as const) {
      await supabase.rpc('sa_add_column', {
        p_table: 'nsnp_isp_profiles',
        p_column: col,
        p_type: typ,
        p_default: null,
      });
    }
  } catch {
    /* soft */
  }
}

async function importSpBatch(
  supabase: ReturnType<typeof getSupabaseServer>,
  opts: {
    rows: SpRegistryRow[];
    agencyCompanyId: number;
    provinceDefault: string;
    linkStatus: 'pending' | 'active';
  }
): Promise<{
  inserted: number;
  updated: number;
  linked: number;
  errors: Array<{ row: string; message: string }>;
}> {
  const { rows, agencyCompanyId, provinceDefault, linkStatus } = opts;
  const now = new Date().toISOString();
  const errors: Array<{ row: string; message: string }> = [];
  let inserted = 0;
  let updated = 0;
  let linked = 0;

  // Lookup existing by CSD
  const csdKeys = [
    ...new Set(
      rows.map((r) => r.csd_number).filter((x): x is string => Boolean(x))
    ),
  ];
  const existingByCsd = new Map<
    string,
    { profile_id: number; id: number }
  >();

  if (csdKeys.length) {
    const { data } = await supabase
      .from('nsnp_isp_profiles')
      .select('id, profile_id, csd_number, trading_name')
      .in('csd_number', csdKeys);
    for (const s of data || []) {
      if (s.csd_number) {
        existingByCsd.set(String(s.csd_number), {
          id: Number(s.id),
          profile_id: Number(s.profile_id),
        });
      }
    }
  }

  // Also match by trading name for rows without CSD or unknown CSD
  const nameKeys = [
    ...new Set(rows.map((r) => r.name.toLowerCase().trim())),
  ];
  const existingByName = new Map<string, { profile_id: number; id: number }>();
  // Only scan when we have rows missing from CSD map
  if (nameKeys.length && nameKeys.length <= 50) {
    const { data: byName } = await supabase
      .from('nsnp_isp_profiles')
      .select('id, profile_id, trading_name')
      .limit(2000);
    for (const s of byName || []) {
      const n = String(s.trading_name || '')
        .toLowerCase()
        .trim();
      if (n && nameKeys.includes(n)) {
        existingByName.set(n, {
          id: Number(s.id),
          profile_id: Number(s.profile_id),
        });
      }
    }
  }

  for (const row of rows) {
    try {
      let existing =
        (row.csd_number && existingByCsd.get(row.csd_number)) ||
        existingByName.get(row.name.toLowerCase().trim()) ||
        null;

      const provinces = [
        ...new Set(
          [row.province || provinceDefault, row.district]
            .filter(Boolean)
            .map((x) => String(x))
        ),
      ];

      let profileId = existing?.profile_id ?? null;
      let isNew = false;

      if (!profileId) {
        const { data: prof, error: pErr } = await supabase
          .from('profiles')
          .insert({
            trading_name: row.name,
            legal_name: row.name,
            org_type: 'nsnp_isp',
            business_type: 'nsnp_isp',
            province: row.province || provinceDefault,
            city: row.district || null,
            country: 'South Africa',
            continent: 'Africa',
            planet: 'Earth',
            status: 'active',
            created_at: now,
            updated_at: now,
            metadata: {
              entity_kind: 'sp',
              registry_import: true,
              csd_number: row.csd_number,
              district: row.district,
              cluster_allocation: row.cluster_allocation,
              enabled_modules: {
                schools: true,
                suppliers: true,
                inventory: true,
                network: true,
                home: true,
                guide: true,
              },
              directory_visible: true,
            },
          })
          .select('id')
          .single();
        if (pErr || !prof) {
          errors.push({
            row: row.name,
            message: pErr?.message || 'profile create failed',
          });
          continue;
        }
        profileId = Number(prof.id);
        isNew = true;
      } else {
        // Soft-update company name/location
        await supabase
          .from('profiles')
          .update({
            trading_name: row.name,
            legal_name: row.name,
            org_type: 'nsnp_isp',
            business_type: 'nsnp_isp',
            province: row.province || provinceDefault,
            city: row.district || null,
            status: 'active',
            updated_at: now,
          })
          .eq('id', profileId);
      }

      const ispPatch: Record<string, unknown> = {
        profile_id: profileId,
        trading_name: row.name,
        provinces,
        district: row.district || null,
        cluster_allocation: row.cluster_allocation || null,
        csd_number: row.csd_number || null,
        registry_source: 'xlsx_import',
        registry_imported_at: now,
        compliance_status: linkStatus === 'active' ? 'compliant' : 'pending',
        food_handling_cert: true,
        updated_at: now,
      };

      if (linkStatus === 'active') {
        ispPatch.approved_by_agency_profile_id = agencyCompanyId;
        ispPatch.approved_at = now;
      }

      if (existing && !isNew) {
        const { error: uErr } = await supabase
          .from('nsnp_isp_profiles')
          .update(ispPatch)
          .eq('profile_id', profileId);
        if (uErr) {
          // Retry without new columns
          const { error: u2 } = await supabase
            .from('nsnp_isp_profiles')
            .update({
              trading_name: row.name,
              provinces,
              compliance_status:
                linkStatus === 'active' ? 'compliant' : 'pending',
              updated_at: now,
              metadata: {
                csd_number: row.csd_number,
                district: row.district,
                cluster_allocation: row.cluster_allocation,
                registry_source: 'xlsx_import',
              },
            })
            .eq('profile_id', profileId);
          if (u2) {
            errors.push({ row: row.name, message: u2.message });
            continue;
          }
        }
        updated += 1;
      } else {
        const { error: iErr } = await supabase
          .from('nsnp_isp_profiles')
          .upsert(ispPatch, { onConflict: 'profile_id' });
        if (iErr) {
          const { error: i2 } = await supabase.from('nsnp_isp_profiles').insert({
            profile_id: profileId,
            trading_name: row.name,
            provinces,
            compliance_status:
              linkStatus === 'active' ? 'compliant' : 'pending',
            food_handling_cert: true,
            updated_at: now,
            metadata: {
              csd_number: row.csd_number,
              district: row.district,
              cluster_allocation: row.cluster_allocation,
              registry_source: 'xlsx_import',
            },
          });
          if (i2) {
            errors.push({ row: row.name, message: i2.message });
            continue;
          }
        }
        inserted += 1;
        if (row.csd_number) {
          existingByCsd.set(row.csd_number, {
            id: 0,
            profile_id: profileId,
          });
        }
      }

      // Link to DBE
      const { error: lErr } = await supabase
        .from('nsnp_isp_agency_links')
        .upsert(
          {
            isp_profile_id: profileId,
            agency_profile_id: agencyCompanyId,
            status: linkStatus,
            accepted_at: linkStatus === 'active' ? now : null,
            notes: 'Registry import',
            updated_at: now,
          },
          { onConflict: 'isp_profile_id,agency_profile_id' }
        );

      if (lErr) {
        // Soft insert without onConflict
        const { error: l2 } = await supabase.from('nsnp_isp_agency_links').insert({
          isp_profile_id: profileId,
          agency_profile_id: agencyCompanyId,
          status: linkStatus,
          updated_at: now,
          notes: 'Registry import',
        });
        if (!l2) linked += 1;
        else {
          // maybe already exists
          const { data: existingLink } = await supabase
            .from('nsnp_isp_agency_links')
            .select('id')
            .eq('isp_profile_id', profileId)
            .eq('agency_profile_id', agencyCompanyId)
            .maybeSingle();
          if (existingLink) {
            await supabase
              .from('nsnp_isp_agency_links')
              .update({
                status: linkStatus,
                accepted_at: linkStatus === 'active' ? now : null,
                updated_at: now,
                notes: 'Registry import',
              })
              .eq('id', existingLink.id);
            linked += 1;
          } else {
            errors.push({ row: row.name, message: lErr.message });
          }
        }
      } else {
        linked += 1;
      }
    } catch (e: unknown) {
      errors.push({
        row: row.name,
        message: e instanceof Error ? e.message : 'failed',
      });
    }
  }

  return {
    inserted,
    updated,
    linked,
    errors: errors.slice(0, 40),
  };
}
