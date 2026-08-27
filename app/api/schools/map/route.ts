import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  fetchAgencySchoolLinks,
  fetchAllPaged,
  fetchByIds,
} from '@/lib/schools/supabase-page';

/**
 * School locations for map.
 * Prefer schools linked to this company as agency; else all active schools.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const province = request.nextUrl.searchParams.get('province');
    const district = request.nextUrl.searchParams.get('district');
    const bboxRaw = request.nextUrl.searchParams.get('bbox');
    const bbox = bboxRaw
      ? bboxRaw.split(',').map((x) => Number(x.trim()))
      : [];
    const hasBbox =
      bbox.length === 4 && bbox.every((n) => Number.isFinite(n));
    const west = hasBbox ? bbox[0] : null;
    const south = hasBbox ? bbox[1] : null;
    const east = hasBbox ? bbox[2] : null;
    const north = hasBbox ? bbox[3] : null;

    const { data: agency } = await supabase
      .from('nsnp_agency_profiles')
      .select('profile_id')
      .eq('profile_id', companyId)
      .maybeSingle();

    let rows: Array<Record<string, unknown>> = [];
    try {
      if (agency) {
        const links = await fetchAgencySchoolLinks(supabase, companyId, [
          'active',
        ]);
        const ids = links
          .map((l) => Number(l.school_profile_id))
          .filter((n) => Number.isFinite(n) && n > 0);
        rows = await fetchByIds(
          supabase,
          'school_profiles',
          'id, profile_id, school_name, emis_number, province, district, city, lat, lng, quintile, learner_count_enrolled, learner_count_nsnp_eligible, status',
          ids
        );
        rows = rows.filter((s) => String(s.status || 'active') === 'active');
      } else {
        if (!province && !district && !hasBbox) {
          return NextResponse.json({
            success: true,
            schools: [],
            withCoords: 0,
            total: 0,
            error: 'province, district, or bbox is required',
            code: 'MAP_SCOPE_REQUIRED',
          });
        }
        rows = await fetchAllPaged(
          supabase,
          'school_profiles',
          'id, profile_id, school_name, emis_number, province, district, city, lat, lng, quintile, learner_count_enrolled, learner_count_nsnp_eligible, status',
          (q) => {
            q = q.eq('status', 'active').order('id', { ascending: true });
            if (province) q = q.eq('province', province);
            if (district) q = q.eq('district', district);
            if (hasBbox && west != null && south != null && east != null && north != null) {
              q = q
                .gte('lng', Math.min(west, east))
                .lte('lng', Math.max(west, east))
                .gte('lat', Math.min(south, north))
                .lte('lat', Math.max(south, north));
            }
            return q;
          }
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
      if (/does not exist|schema cache/i.test(msg)) {
        return NextResponse.json({
          success: true,
          schools: [],
          warning: 'Run schools migration',
        });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (province) {
      rows = rows.filter(
        (s) =>
          String(s.province || '').toLowerCase() === province.toLowerCase()
      );
    }
    if (district) {
      rows = rows.filter(
        (s) =>
          String(s.district || '').toLowerCase() === district.toLowerCase()
      );
    }

    const schools = rows.map((s) => ({
      ...s,
      has_coords:
        s.lat != null &&
        s.lng != null &&
        Number.isFinite(Number(s.lat)) &&
        Number.isFinite(Number(s.lng)),
    }));

    return NextResponse.json({
      success: true,
      schools,
      withCoords: schools.filter((s) => s.has_coords).length,
      total: schools.length,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
