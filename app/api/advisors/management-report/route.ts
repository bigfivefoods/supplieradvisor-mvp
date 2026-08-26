/**
 * Owner management report for all Advisors.
 * GET ?advisor=&companyId=&from=&to=&slice=&format=json|pdf&dim_*=
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  type AdvisorReportId,
  type ManagementReportFilters,
  defaultPeriod,
  ensureManagementCharts,
  managementReportPdfFilename,
} from '@/lib/advisors/management-report';
import { buildAdvisorManagementReport } from '@/lib/advisors/management-report-build';
import {
  buildManagementReportPdf,
} from '@/lib/advisors/management-report-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADVISORS: AdvisorReportId[] = [
  'fitgraph',
  'physiograph',
  'dentalgraph',
  'medicalgraph',
  'vetgraph',
  'psychiatrygraph',
  'fieldgraph',
  'quarrygraph',
  'hiregraph',
  'schools',
  'health',
];

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

    const advisor = String(sp.get('advisor') || '') as AdvisorReportId;
    if (!ADVISORS.includes(advisor)) {
      return NextResponse.json(
        {
          error: `advisor required — one of: ${ADVISORS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const period = defaultPeriod(30);
    const from = sp.get('from') || period.from;
    const to = sp.get('to') || period.to;
    const format = String(sp.get('format') || 'json').toLowerCase();
    // PDF one-pager always uses overview (full key metrics pack)
    const slice =
      format === 'pdf' ? 'overview' : sp.get('slice') || 'overview';

    const dims: Record<string, string> = {};
    sp.forEach((value, key) => {
      if (key.startsWith('dim_') && value) {
        dims[key.slice(4)] = value;
      }
    });

    const filters: ManagementReportFilters = {
      from,
      to,
      slice,
      dims,
    };

    const supabase = getSupabaseServer();
    const { data: profRow } = await supabase
      .from('profiles')
      .select('id, trading_name, legal_name, metadata')
      .eq('id', companyId)
      .maybeSingle();
    const prof = (profRow ?? null) as {
      id?: number;
      trading_name?: string | null;
      legal_name?: string | null;
      metadata?: unknown;
    } | null;

    const meta =
      prof?.metadata && typeof prof.metadata === 'object'
        ? ({ ...(prof.metadata as Record<string, unknown>) } as Record<
            string,
            unknown
          >)
        : {};
    const companyName = String(
      prof?.trading_name ||
        prof?.legal_name ||
        `Company #${companyId}`
    );

    const built = await buildAdvisorManagementReport({
      advisor,
      companyId,
      companyName,
      filters,
      supabase,
      profileMeta: meta,
      profileName: companyName,
    });
    const doc = {
      ...built,
      charts: ensureManagementCharts(built),
    };

    if (format === 'pdf') {
      const buf = await buildManagementReportPdf(doc);
      const filename = managementReportPdfFilename(doc);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({
      success: true,
      report: doc,
      advisors: ADVISORS,
    });
  } catch (e: unknown) {
    console.error('[advisors/management-report]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
