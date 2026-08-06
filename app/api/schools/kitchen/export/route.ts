import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import { loadKitchenInventorySnapshot } from '@/lib/schools/kitchen-inventory';
import {
  buildKitchenInventoryCsv,
  buildKitchenInventoryPdf,
  kitchenInventoryCsvFilename,
  kitchenInventoryPdfFilename,
} from '@/lib/schools/kitchen-inventory-pdf';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/schools/kitchen/export?companyId=&format=pdf|csv&download=1&lowOnly=1
 * School kitchen inventory levels download (PDF / CSV).
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
    const lowOnly =
      sp.get('lowOnly') === '1' ||
      sp.get('lowOnly') === 'true' ||
      sp.get('low') === '1';
    const forceDownload =
      sp.get('download') === '1' ||
      sp.get('download') === 'true' ||
      format === 'csv';

    const supabase = getSupabaseServer();
    const { school, error } = await getOrCreateSchoolProfile(
      supabase,
      companyId
    );
    if (error || !school) {
      return NextResponse.json(
        {
          error:
            error ||
            'Kitchen inventory is available for school profiles only. Open Schools as a school company.',
        },
        { status: 503 }
      );
    }

    const snapshot = await loadKitchenInventorySnapshot(
      supabase,
      companyId,
      school as Record<string, unknown>
    );

    let rows = snapshot.stock;
    if (lowOnly) {
      rows = rows.filter(
        (r) =>
          r.low_stock ||
          r.cover_status === 'reorder' ||
          r.cover_status === 'critical'
      );
    }

    if (format === 'csv') {
      const csv = buildKitchenInventoryCsv(rows, {
        schoolName: snapshot.schoolName,
        learners: snapshot.learners,
        cover_days: snapshot.cover_policy.cover_days,
        reorder_cover_days: snapshot.cover_policy.reorder_cover_days,
        lead_time_days: snapshot.cover_policy.lead_time_days,
      });
      const filename = kitchenInventoryCsvFilename(
        snapshot.schoolName,
        new Date(),
        lowOnly
      );
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'private, max-age=60',
        },
      });
    }

    const buf = await buildKitchenInventoryPdf({
      snapshot: { ...snapshot, stock: rows, low_count: rows.filter((r) => r.low_stock).length },
      lowOnly,
    });
    const filename = kitchenInventoryPdfFilename(
      snapshot.schoolName,
      new Date(),
      lowOnly
    );
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
    console.error('[kitchen inventory export]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Export failed' },
      { status: 500 }
    );
  }
}
