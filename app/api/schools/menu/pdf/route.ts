import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import {
  resolveCatalogueContext,
  sanitizeMenuItemsProducts,
  loadApprovedProducts,
} from '@/lib/schools/approved-catalogue';
import {
  loadMandatedMenu,
  parseMenuItems,
} from '@/lib/schools/agency-menu';
import {
  buildWeeklyMenuPdf,
  weeklyMenuPdfFilename,
} from '@/lib/schools/weekly-menu-pdf';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/schools/menu/pdf?companyId=&download=1&id=
 * Printable NSNP weekly menu (A4 landscape) for schools / DBE.
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

    const supabase = getSupabaseServer();
    const ctx = await resolveCatalogueContext(supabase, companyId);
    const mandated = await loadMandatedMenu(supabase, companyId);

    let menu = mandated.menu;
    const menuId = sp.get('id') ? Number(sp.get('id')) : null;
    if (menuId && Number.isFinite(menuId) && ctx.agencyProfileId) {
      const { data } = await supabase
        .from('school_menu_cycles')
        .select('*')
        .eq('id', menuId)
        .eq('agency_profile_id', ctx.agencyProfileId)
        .maybeSingle();
      if (data) {
        menu = {
          id: Number(data.id),
          name: String(data.name),
          description:
            data.description != null ? String(data.description) : null,
          cycle_days: Number(data.cycle_days || 7),
          items: parseMenuItems(data.items),
          active: data.active !== false,
          agency_profile_id: Number(data.agency_profile_id),
          agency_name: ctx.agencyName,
        };
      }
    }

    if (!menu) {
      return NextResponse.json(
        {
          error:
            'No programme menu published yet. DBE / PEU must publish the weekly menu first.',
        },
        { status: 404 }
      );
    }

    const agencyId = Number(
      menu.agency_profile_id || mandated.agencyProfileId || ctx.agencyProfileId
    );
    let items = parseMenuItems(menu.items);
    if (agencyId) {
      const sanitized = await sanitizeMenuItemsProducts(
        supabase,
        agencyId,
        items
      );
      items = sanitized.items;
    }

    // Product labels for PDF
    const productLabels: Record<number, string> = {};
    if (agencyId) {
      const catalogue = await loadApprovedProducts(supabase, agencyId, {
        activeOnly: true,
        includeNationalFallback: false,
      });
      for (const p of catalogue) {
        const id = Number(p.id);
        if (!Number.isFinite(id)) continue;
        const brand = p.brand_name != null ? String(p.brand_name) : '';
        const name = String(p.name || 'Product');
        productLabels[id] = brand ? `${brand} · ${name}` : name;
      }
    }

    let schoolName: string | null = null;
    if (!ctx.canEdit) {
      const got = await getOrCreateSchoolProfile(supabase, companyId).catch(
        () => null
      );
      if (got?.school) {
        schoolName =
          got.school.school_name != null
            ? String(got.school.school_name)
            : null;
      }
    }

    const buf = await buildWeeklyMenuPdf({
      menuName: menu.name,
      agencyName: menu.agency_name || mandated.agencyName || ctx.agencyName,
      schoolName,
      description: menu.description,
      items,
      productLabels,
    });

    const filename = weeklyMenuPdfFilename(menu.name);
    const forceDownload =
      sp.get('download') === '1' || sp.get('download') === 'true';
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
    console.error('weekly menu pdf', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'PDF generation failed' },
      { status: 500 }
    );
  }
}
