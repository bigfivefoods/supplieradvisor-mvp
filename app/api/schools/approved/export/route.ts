import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  cloneNationalIntoAgency,
  ensureNationalNsnpSeed,
  loadApprovedProducts,
  resolveCatalogueContext,
} from '@/lib/schools/approved-catalogue';
import { enrichProductsWithMealFlags } from '@/lib/schools/meal-guide';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import {
  approvedFoodsCsvFilename,
  approvedFoodsPdfFilename,
  buildApprovedFoodsCsv,
  buildApprovedFoodsPdf,
} from '@/lib/schools/approved-foods-pdf';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/schools/approved/export?companyId=&format=pdf|csv&download=1&all=1
 * Download NSNP approved foods catalogue for DBE, schools, and SPs.
 */
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

    const format = String(sp.get('format') || 'pdf').toLowerCase();
    const activeOnly = sp.get('all') !== '1';
    const forceDownload =
      sp.get('download') === '1' ||
      sp.get('download') === 'true' ||
      format === 'csv';

    const supabase = getSupabaseServer();
    await ensureNationalNsnpSeed(supabase);
    const ctx = await resolveCatalogueContext(supabase, companyId);

    let agencyProfileId = ctx.agencyProfileId;
    if (ctx.canEdit) {
      agencyProfileId = companyId;
    }

    // Seed empty agency catalogue once
    if (agencyProfileId != null) {
      const owned = await loadApprovedProducts(supabase, agencyProfileId, {
        activeOnly: true,
        includeNationalFallback: false,
      });
      if (!owned.length) {
        await cloneNationalIntoAgency(supabase, agencyProfileId);
      }
    }

    let products = await loadApprovedProducts(
      supabase,
      ctx.canEdit ? companyId : agencyProfileId,
      {
        activeOnly,
        includeNationalFallback: !ctx.canEdit && agencyProfileId == null,
      }
    );
    products = enrichProductsWithMealFlags(products);

    let schoolName: string | null = null;
    let roleLabel = 'Programme user';
    if (ctx.canEdit) {
      roleLabel = 'DBE / PEU';
    } else {
      const { data: isp } = await supabase
        .from('nsnp_isp_profiles')
        .select('profile_id')
        .eq('profile_id', companyId)
        .limit(1)
        .maybeSingle();
      if (isp) roleLabel = 'Service provider';
      else {
        roleLabel = 'School';
        const got = await getOrCreateSchoolProfile(supabase, companyId).catch(
          () => null
        );
        if (got?.school?.school_name) {
          schoolName = String(got.school.school_name);
        }
      }
    }

    const mapped = products.map((p) => ({
      id: Number(p.id) || String(p.id || ''),
      name: String(p.name || 'Product'),
      brand_name: p.brand_name != null ? String(p.brand_name) : null,
      category: p.category != null ? String(p.category) : null,
      uom: p.uom != null ? String(p.uom) : null,
      province: p.province != null ? String(p.province) : null,
      for_breakfast: Boolean(p.for_breakfast),
      for_lunch: Boolean(p.for_lunch),
      active: p.active !== false,
      barcode: p.barcode != null ? String(p.barcode) : null,
      sku: p.sku != null ? String(p.sku) : null,
    }));

    if (format === 'csv') {
      const csv = buildApprovedFoodsCsv(mapped);
      const filename = approvedFoodsCsvFilename(ctx.agencyName);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'private, max-age=60',
        },
      });
    }

    const buf = await buildApprovedFoodsPdf({
      agencyName: ctx.agencyName,
      schoolName,
      roleLabel,
      products: mapped,
      includeInactive: !activeOnly,
    });
    const filename = approvedFoodsPdfFilename(ctx.agencyName);
    const bytes = new Uint8Array(buf);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': forceDownload
          ? `attachment; filename="${filename}"`
          : `inline; filename="${filename}"`,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (e: unknown) {
    console.error('[approved foods export]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Export failed' },
      { status: 500 }
    );
  }
}
