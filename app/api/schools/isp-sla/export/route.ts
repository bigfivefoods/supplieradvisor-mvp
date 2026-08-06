import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getAgencyRegistration } from '@/lib/schools/approved-catalogue';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import {
  loadIspSlaScorecard,
  roleLabelForIspSla,
} from '@/lib/schools/isp-sla-scorecard';
import {
  buildIspSlaCsv,
  buildIspSlaPdf,
  ispSlaCsvFilename,
  ispSlaPdfFilename,
} from '@/lib/schools/isp-sla-pdf';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/schools/isp-sla/export?companyId=&from=&to=&format=pdf|csv&download=1&label=
 * Download SP SLA · OTIFEF metrics for the PeriodSlicer cover period.
 * Available to DBE, schools, and SPs (scope follows role).
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
    const to = sp.get('to') || new Date().toISOString().slice(0, 10);
    const fromDefault = new Date();
    fromDefault.setMonth(fromDefault.getMonth() - 3);
    const from = sp.get('from') || fromDefault.toISOString().slice(0, 10);
    const periodLabel = sp.get('label') ? String(sp.get('label')) : null;
    const forceDownload =
      sp.get('download') === '1' ||
      sp.get('download') === 'true' ||
      format === 'csv';

    const supabase = getSupabaseServer();
    const card = await loadIspSlaScorecard(supabase, companyId, {
      from,
      to,
      persist: false,
    });

    let schoolName: string | null = null;
    let agencyName: string | null = null;
    let viewerName: string | null = null;
    const roleLabel = roleLabelForIspSla(card.role);

    if (card.role === 'agency') {
      const agency = await getAgencyRegistration(supabase, companyId);
      agencyName =
        agency?.agency_name != null
          ? String(agency.agency_name)
          : null;
      if (!agencyName) {
        const { data: p } = await supabase
          .from('profiles')
          .select('trading_name, legal_name')
          .eq('id', companyId)
          .maybeSingle();
        agencyName = p?.trading_name || p?.legal_name || null;
      }
    } else if (card.role === 'school') {
      const got = await getOrCreateSchoolProfile(supabase, companyId).catch(
        () => null
      );
      schoolName = got?.school?.school_name
        ? String(got.school.school_name)
        : null;
    } else {
      const { data: isp } = await supabase
        .from('nsnp_isp_profiles')
        .select('trading_name')
        .eq('profile_id', companyId)
        .maybeSingle();
      viewerName = isp?.trading_name
        ? String(isp.trading_name)
        : null;
      if (!viewerName) {
        const { data: p } = await supabase
          .from('profiles')
          .select('trading_name, legal_name')
          .eq('id', companyId)
          .maybeSingle();
        viewerName = p?.trading_name || p?.legal_name || null;
      }
    }

    if (format === 'csv') {
      const csv = buildIspSlaCsv(card.isps, {
        from,
        to,
        label: periodLabel,
      });
      const filename = ispSlaCsvFilename(from, to);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'private, max-age=60',
        },
      });
    }

    const buf = await buildIspSlaPdf({
      periodFrom: from,
      periodTo: to,
      periodLabel,
      roleLabel,
      schoolName,
      agencyName,
      viewerName,
      isps: card.isps,
      summary: card.summary,
      legend: card.otifef_legend,
    });
    const filename = ispSlaPdfFilename(from, to);
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
    console.error('[isp-sla export]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Export failed' },
      { status: 500 }
    );
  }
}
