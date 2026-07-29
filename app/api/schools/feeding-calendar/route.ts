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
import {
  countFeedingDaysFromCalendar,
  defaultSaTerms,
  generateYearDays,
  normalizeTerms,
  normalizeWeekdays,
  summarizeMonths,
  summarizeTerms,
  yearFeedingTotal,
  type FeedingCalendarDay,
} from '@/lib/schools/feeding-calendar';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * DBE annual feeding calendar — cascades to schools & SPs.
 *
 * GET  ?companyId=&year=2026
 * POST action: ensure_year | save_calendar | regenerate | set_days | publish | unpublish
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
    const ctx = await resolveAgencyCtx(supabase, companyId);
    if (!ctx.agencyProfileId) {
      return NextResponse.json({
        success: true,
        role: ctx.role,
        canEdit: false,
        year,
        calendar: null,
        message:
          ctx.role === 'agency'
            ? 'Register as DBE/PEU first'
            : 'Join a department to see the feeding calendar',
      });
    }

    const cal = await loadCalendar(supabase, ctx.agencyProfileId, year);
    // Schools/SPs only see published calendars (agency sees draft too)
    if (cal && ctx.role !== 'agency' && cal.status !== 'published') {
      return NextResponse.json({
        success: true,
        role: ctx.role,
        canEdit: false,
        year,
        calendar: null,
        message: 'DBE has not published the feeding calendar for this year yet',
      });
    }

    const days = cal ? await loadDays(supabase, Number(cal.id)) : [];
    const terms = cal
      ? normalizeTerms(cal.terms)
      : defaultSaTerms(year);
    const payload = cal
      ? {
          id: Number(cal.id),
          agency_profile_id: Number(cal.agency_profile_id),
          year: Number(cal.year),
          name: String(cal.name || 'NSNP feeding calendar'),
          status: String(cal.status || 'draft'),
          default_weekdays: normalizeWeekdays(cal.default_weekdays),
          terms,
          notes: cal.notes != null ? String(cal.notes) : null,
          published_at: cal.published_at != null ? String(cal.published_at) : null,
          days,
        }
      : null;

    return NextResponse.json({
      success: true,
      role: ctx.role,
      canEdit: ctx.role === 'agency',
      agencyProfileId: ctx.agencyProfileId,
      year,
      calendar: payload,
      summary: payload
        ? {
            year_feeding_days: yearFeedingTotal(days),
            months: summarizeMonths(days),
            terms: summarizeTerms(terms, days),
          }
        : null,
      defaults: {
        terms: defaultSaTerms(year),
        weekdays: [1, 2, 3, 4, 5],
      },
    });
  } catch (e: unknown) {
    console.error('[feeding-calendar GET]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const agency = await getAgencyRegistration(supabase, companyId);
    if (!agency) {
      return NextResponse.json(
        { error: 'Only DBE/PEU can edit the feeding calendar' },
        { status: 403 }
      );
    }

    const action = String(body.action || '');
    const year = Number(body.year || new Date().getFullYear());
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    if (action === 'ensure_year') {
      const existing = await loadCalendar(supabase, companyId, year);
      if (existing) {
        const days = await loadDays(supabase, Number(existing.id));
        return NextResponse.json({
          success: true,
          calendar: existing,
          day_count: days.length,
          created: false,
        });
      }
      const terms = defaultSaTerms(year);
      const { data, error } = await supabase
        .from('nsnp_feeding_calendars')
        .insert({
          agency_profile_id: companyId,
          year,
          name: `NSNP feeding calendar ${year}`,
          status: 'draft',
          default_weekdays: [1, 2, 3, 4, 5],
          terms,
          notes:
            'Draft — review term dates against the official DBE school calendar, then publish for schools and SPs.',
        })
        .select('*')
        .single();
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) {
          return NextResponse.json(
            {
              error:
                'Run migration 20260729_nsnp_feeding_calendar.sql for feeding calendar tables',
            },
            { status: 400 }
          );
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      const days = generateYearDays({ year, terms });
      await replaceDays(supabase, Number(data.id), days);
      return NextResponse.json({
        success: true,
        calendar: data,
        day_count: days.length,
        created: true,
        year_feeding_days: yearFeedingTotal(days),
      });
    }

    const cal = await loadCalendar(supabase, companyId, year);
    if (!cal && action !== 'ensure_year') {
      return NextResponse.json(
        { error: 'Create the year calendar first (ensure_year)' },
        { status: 400 }
      );
    }
    const calendarId = Number(cal!.id);

    if (action === 'save_calendar') {
      const terms = normalizeTerms(body.terms ?? cal!.terms);
      const weekdays = normalizeWeekdays(
        body.default_weekdays ?? cal!.default_weekdays
      );
      const { data, error } = await supabase
        .from('nsnp_feeding_calendars')
        .update({
          name: body.name != null ? String(body.name) : cal!.name,
          terms,
          default_weekdays: weekdays,
          notes: body.notes != null ? String(body.notes) : cal!.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', calendarId)
        .eq('agency_profile_id', companyId)
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, calendar: data });
    }

    if (action === 'regenerate') {
      // Optional: save terms first if provided
      let terms = normalizeTerms(cal!.terms);
      let weekdays = normalizeWeekdays(cal!.default_weekdays);
      if (body.terms) terms = normalizeTerms(body.terms);
      if (body.default_weekdays) {
        weekdays = normalizeWeekdays(body.default_weekdays);
      }
      await supabase
        .from('nsnp_feeding_calendars')
        .update({
          terms,
          default_weekdays: weekdays,
          updated_at: new Date().toISOString(),
        })
        .eq('id', calendarId);

      const days = generateYearDays({
        year,
        terms,
        defaultWeekdays: weekdays,
        extraHolidays: Array.isArray(body.extra_holidays)
          ? body.extra_holidays
          : undefined,
      });
      await replaceDays(supabase, calendarId, days);
      return NextResponse.json({
        success: true,
        day_count: days.length,
        year_feeding_days: yearFeedingTotal(days),
        months: summarizeMonths(days),
        terms: summarizeTerms(terms, days),
      });
    }

    if (action === 'set_days') {
      const rows = Array.isArray(body.days) ? body.days : [];
      if (!rows.length) {
        return NextResponse.json({ error: 'days required' }, { status: 400 });
      }
      const now = new Date().toISOString();
      // Upsert in chunks
      const payload = rows
        .map((r: Record<string, unknown>) => {
          const feed_date = String(r.feed_date || r.date || '').slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(feed_date)) return null;
          return {
            calendar_id: calendarId,
            feed_date,
            is_feeding: Boolean(r.is_feeding),
            day_type: String(r.day_type || (r.is_feeding ? 'school_day' : 'admin_closed')),
            label: r.label != null ? String(r.label) : null,
            term_number:
              r.term_number != null && r.term_number !== ''
                ? Number(r.term_number)
                : null,
            updated_at: now,
          };
        })
        .filter(Boolean);
      if (!payload.length) {
        return NextResponse.json({ error: 'No valid days' }, { status: 400 });
      }
      const { error } = await supabase
        .from('nsnp_feeding_calendar_days')
        .upsert(payload, { onConflict: 'calendar_id,feed_date' });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      await supabase
        .from('nsnp_feeding_calendars')
        .update({ updated_at: now })
        .eq('id', calendarId);
      const days = await loadDays(supabase, calendarId);
      return NextResponse.json({
        success: true,
        year_feeding_days: yearFeedingTotal(days),
        months: summarizeMonths(days),
      });
    }

    if (action === 'publish') {
      const days = await loadDays(supabase, calendarId);
      if (!days.length) {
        return NextResponse.json(
          { error: 'Generate days before publishing' },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from('nsnp_feeding_calendars')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', calendarId)
        .eq('agency_profile_id', companyId)
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        calendar: data,
        message: 'Published — schools and SPs can now see feeding days',
        year_feeding_days: yearFeedingTotal(days),
      });
    }

    if (action === 'unpublish') {
      const { data, error } = await supabase
        .from('nsnp_feeding_calendars')
        .update({
          status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', calendarId)
        .eq('agency_profile_id', companyId)
        .select('*')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        calendar: data,
        message: 'Unpublished — back to draft (hidden from schools/SPs)',
      });
    }

    if (action === 'count_period') {
      const from = String(body.from || '').slice(0, 10);
      const to = String(body.to || '').slice(0, 10);
      const days = await loadDays(supabase, calendarId);
      return NextResponse.json({
        success: true,
        from,
        to,
        feeding_days: countFeedingDaysFromCalendar(days, from, to),
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    console.error('[feeding-calendar POST]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}

async function resolveAgencyCtx(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number
): Promise<{
  role: 'agency' | 'school' | 'isp';
  agencyProfileId: number | null;
}> {
  const agency = await getAgencyRegistration(supabase, companyId);
  if (agency) {
    return { role: 'agency', agencyProfileId: companyId };
  }
  const { data: isp } = await supabase
    .from('nsnp_isp_profiles')
    .select('profile_id')
    .eq('profile_id', companyId)
    .maybeSingle();
  if (isp) {
    const { data: al } = await supabase
      .from('nsnp_isp_agency_links')
      .select('agency_profile_id, status')
      .eq('isp_profile_id', companyId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    return {
      role: 'isp',
      agencyProfileId: al?.agency_profile_id
        ? Number(al.agency_profile_id)
        : null,
    };
  }
  const ctx = await resolveCatalogueContext(supabase, companyId);
  return { role: 'school', agencyProfileId: ctx.agencyProfileId };
}

async function loadCalendar(
  supabase: ReturnType<typeof getSupabaseServer>,
  agencyProfileId: number,
  year: number
) {
  const { data, error } = await supabase
    .from('nsnp_feeding_calendars')
    .select('*')
    .eq('agency_profile_id', agencyProfileId)
    .eq('year', year)
    .maybeSingle();
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) return null;
    return null;
  }
  return data;
}

async function loadDays(
  supabase: ReturnType<typeof getSupabaseServer>,
  calendarId: number
): Promise<FeedingCalendarDay[]> {
  const { data, error } = await supabase
    .from('nsnp_feeding_calendar_days')
    .select('feed_date, is_feeding, day_type, label, term_number')
    .eq('calendar_id', calendarId)
    .order('feed_date')
    .limit(400);
  if (error || !data) return [];
  return data.map((d) => ({
    feed_date: String(d.feed_date).slice(0, 10),
    is_feeding: d.is_feeding === true,
    day_type: String(d.day_type || 'school_day'),
    label: d.label != null ? String(d.label) : null,
    term_number: d.term_number != null ? Number(d.term_number) : null,
  }));
}

async function replaceDays(
  supabase: ReturnType<typeof getSupabaseServer>,
  calendarId: number,
  days: FeedingCalendarDay[]
) {
  await supabase
    .from('nsnp_feeding_calendar_days')
    .delete()
    .eq('calendar_id', calendarId);

  const now = new Date().toISOString();
  const chunk = 100;
  for (let i = 0; i < days.length; i += chunk) {
    const slice = days.slice(i, i + chunk).map((d) => ({
      calendar_id: calendarId,
      feed_date: d.feed_date,
      is_feeding: d.is_feeding,
      day_type: d.day_type,
      label: d.label ?? null,
      term_number: d.term_number ?? null,
      updated_at: now,
    }));
    const { error } = await supabase
      .from('nsnp_feeding_calendar_days')
      .insert(slice);
    if (error) throw new Error(error.message);
  }
}

