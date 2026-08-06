import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  getAgencyRegistration,
  resolveCatalogueContext,
} from '@/lib/schools/approved-catalogue';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import {
  normalizeTerms,
  normalizeWeekdays,
} from '@/lib/schools/feeding-calendar';
import {
  buildFeedingCalendarPdf,
  feedingCalendarPdfFilename,
} from '@/lib/schools/feeding-calendar-pdf';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/schools/feeding-calendar/pdf?companyId=&year=2026&download=1
 * Printable annual NSNP feeding calendar for DBE, schools, and SPs.
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

    const year = Number(sp.get('year') || new Date().getFullYear());
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const agency = await getAgencyRegistration(supabase, companyId);
    const ctx = await resolveCatalogueContext(supabase, companyId);
    const agencyProfileId = agency?.profile_id
      ? Number(agency.profile_id)
      : ctx.agencyProfileId
        ? Number(ctx.agencyProfileId)
        : null;

    if (!agencyProfileId) {
      return NextResponse.json(
        {
          error:
            'No department feeding calendar available. DBE must publish one first, or join a department.',
        },
        { status: 404 }
      );
    }

    const isAgency = Boolean(agency);
    let roleLabel = 'Programme user';
    let schoolName: string | null = null;
    if (isAgency) roleLabel = 'DBE / PEU';
    else {
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

    // Prefer published for schools/SPs; agency may print draft
    let calQuery = supabase
      .from('nsnp_feeding_calendars')
      .select('*')
      .eq('agency_profile_id', agencyProfileId)
      .eq('year', year)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (!isAgency) {
      calQuery = calQuery.eq('status', 'published');
    }
    const { data: cal } = await calQuery.maybeSingle();

    if (!cal) {
      return NextResponse.json(
        {
          error: `No feeding calendar for ${year}. DBE must create and publish it.`,
        },
        { status: 404 }
      );
    }

    // Schools/SPs only download published calendars
    if (!isAgency && String(cal.status) !== 'published') {
      return NextResponse.json(
        {
          error: `DBE has not published the ${year} feeding calendar yet.`,
        },
        { status: 404 }
      );
    }

    const { data: dayRows } = await supabase
      .from('nsnp_feeding_calendar_days')
      .select('feed_date, is_feeding, day_type, label, term_number')
      .eq('calendar_id', Number(cal.id))
      .order('feed_date', { ascending: true })
      .limit(400);

    const days = (dayRows || []).map((d) => ({
      feed_date: String(d.feed_date).slice(0, 10),
      is_feeding: Boolean(d.is_feeding),
      day_type: String(d.day_type || 'school_day'),
      label: d.label != null ? String(d.label) : null,
      term_number:
        d.term_number != null && Number.isFinite(Number(d.term_number))
          ? Number(d.term_number)
          : null,
    }));

    if (!days.length) {
      return NextResponse.json(
        {
          error:
            'Calendar has no days generated yet. DBE should regenerate the year first.',
        },
        { status: 404 }
      );
    }

    const agencyName =
      agency?.agency_name != null
        ? String(agency.agency_name)
        : ctx.agencyName || null;

    const buf = await buildFeedingCalendarPdf({
      year,
      name: String(cal.name || `NSNP feeding calendar ${year}`),
      agencyName,
      schoolName,
      roleLabel,
      status: String(cal.status || 'draft'),
      notes: cal.notes != null ? String(cal.notes) : null,
      terms: normalizeTerms(cal.terms),
      days,
    });

    const forceDownload =
      sp.get('download') === '1' || sp.get('download') === 'true';
    const filename = feedingCalendarPdfFilename(year);
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
    console.error('[feeding-calendar pdf]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'PDF generation failed' },
      { status: 500 }
    );
  }
}
