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
  'psychiatrygraph',
  'fieldgraph',
  'quarrygraph',
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
    const slice = sp.get('slice') || 'overview';
    const format = String(sp.get('format') || 'json').toLowerCase();

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
    let prof: Record<string, unknown> | null = null;
    for (const select of [
      'id, trading_name, legal_name, metadata',
      'id, name, metadata',
      'id, metadata',
    ]) {
      const { data, error } = await supabase
        .from('profiles')
        .select(select)
        .eq('id', companyId)
        .maybeSingle();
      if (!error && data) {
        prof = data as Record<string, unknown>;
        break;
      }
    }

    const meta =
      prof?.metadata && typeof prof.metadata === 'object'
        ? (prof.metadata as Record<string, unknown>)
        : {};
    const companyName = String(
      prof?.trading_name ||
        prof?.legal_name ||
        prof?.name ||
        `Company #${companyId}`
    );

    const doc = await buildAdvisorManagementReport({
      advisor,
      companyId,
      companyName,
      filters,
      supabase,
      profileMeta: meta,
      profileName: companyName,
    });

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
